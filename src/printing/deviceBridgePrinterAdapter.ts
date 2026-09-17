import {
  assertValidBridgePrintEnvelope,
  type BridgePrintAck,
  type BridgePrintEnvelope,
  type BridgePrinterEndpoint,
  type PrintBridgeIdentity,
} from './deviceBridge.js';
import type { RenderedPrintArtifact } from './imagePrint.js';
import type {
  PrintContent,
  PrintDispatchResult,
  PrintJob,
  PrinterAdapter,
  PrinterHealth,
  PrinterIdentity,
} from './printCore.js';

export type DeviceBridgePrinterBinding = {
  printerId: string;
  bridge: PrintBridgeIdentity;
  endpoint: BridgePrinterEndpoint;
};

export interface BridgePrinterClient {
  health(input: { bridgeId: string; printerEndpointId: string }): Promise<BridgePrinterEndpoint['health']>;
  submitPrint(envelope: BridgePrintEnvelope): Promise<BridgePrintAck>;
}

export interface PrintArtifactResolver {
  resolve(job: PrintJob, printer: PrinterIdentity): Promise<RenderedPrintArtifact>;
}

function expectedArtifactKind(content: PrintContent): RenderedPrintArtifact['kind'] {
  if (content.kind === 'label') return 'label_bitmap';
  if (content.kind === 'a4_document') return 'document_pdf';
  return 'receipt_bitmap';
}

function assertBinding(binding: DeviceBridgePrinterBinding): void {
  if (!binding.printerId.trim()) throw new Error('Device Bridge binding requires printerId.');
  if (binding.endpoint.bridgeId !== binding.bridge.bridgeId) {
    throw new Error('Device Bridge endpoint belongs to another bridge.');
  }
  if (!binding.endpoint.endpointId.trim() || !binding.endpoint.adapterKey.trim()) {
    throw new Error('Device Bridge endpoint identity and adapterKey are required.');
  }
}

function assertPrinterMatchesBinding(
  printer: PrinterIdentity,
  binding: DeviceBridgePrinterBinding,
): void {
  if (printer.id !== binding.printerId) {
    throw new Error('Device Bridge adapter received a different canonical printer.');
  }
  if (printer.businessId !== binding.bridge.businessId) {
    throw new Error('Device Bridge adapter cannot cross business boundaries.');
  }
  if (printer.adapterKey !== binding.endpoint.adapterKey) {
    throw new Error('Device Bridge endpoint adapterKey does not match canonical printer configuration.');
  }
}

function assertAckMatchesEnvelope(envelope: BridgePrintEnvelope, ack: BridgePrintAck): void {
  if (ack.requestId !== envelope.requestId || ack.printJobId !== envelope.printJobId) {
    throw new Error('Device Bridge print acknowledgement does not match the submitted print request.');
  }
  if (ack.code !== undefined && !ack.code.trim()) {
    throw new Error('Device Bridge print acknowledgement code cannot be blank.');
  }
}

function mapAck(ack: BridgePrintAck): PrintDispatchResult {
  if (ack.outcome === 'printed') return { outcome: 'printed' };
  if (ack.outcome === 'accepted') return { outcome: 'submitted' };
  if (ack.outcome === 'unknown') {
    return { outcome: 'unknown', code: ack.code ?? 'bridge_outcome_unknown' };
  }

  // A generic bridge "failed" acknowledgement is not enough evidence that zero
  // physical output occurred. Protocol-v2 status reconciliation can later return
  // failed_before_output when the durable bridge ledger proves it. Until then the
  // safe canonical state is unknown, not retryable.
  return { outcome: 'unknown', code: ack.code ?? 'bridge_failed_unconfirmed_output' };
}

/**
 * Generic Device Bridge adapter. It transports a Palta-rendered immutable artifact
 * to one already-bound endpoint; vendor/layout logic remains behind the bridge.
 */
export class DeviceBridgePrinterAdapter implements PrinterAdapter {
  readonly key: string;

  constructor(
    private readonly binding: DeviceBridgePrinterBinding,
    private readonly client: BridgePrinterClient,
    private readonly artifacts: PrintArtifactResolver,
    private readonly createRequestId: () => string,
  ) {
    assertBinding(binding);
    this.key = binding.endpoint.adapterKey;
  }

  supports(printer: PrinterIdentity, _content: PrintContent): boolean {
    try {
      assertPrinterMatchesBinding(printer, this.binding);
      return true;
    } catch {
      return false;
    }
  }

  async health(printer: PrinterIdentity): Promise<PrinterHealth> {
    assertPrinterMatchesBinding(printer, this.binding);
    try {
      return await this.client.health({
        bridgeId: this.binding.bridge.bridgeId,
        printerEndpointId: this.binding.endpoint.endpointId,
      });
    } catch {
      return 'bridge_unreachable';
    }
  }

  async print(printer: PrinterIdentity, job: PrintJob): Promise<PrintDispatchResult> {
    assertPrinterMatchesBinding(printer, this.binding);
    if (job.printerId !== printer.id || job.businessId !== printer.businessId) {
      throw new Error('Device Bridge print job does not match the resolved printer.');
    }
    if (job.status !== 'dispatching' || job.submittedAt === undefined) {
      throw new Error('Device Bridge can submit only a durably claimed dispatching print job.');
    }

    const artifact = await this.artifacts.resolve(job, printer);
    if (artifact.kind !== expectedArtifactKind(job.content)) {
      throw new Error('Rendered print artifact kind does not match the PrintJob content.');
    }
    if (!artifact.objectRef.trim() || !/^[a-f0-9]{64}$/i.test(artifact.sha256)) {
      throw new Error('Rendered print artifact requires objectRef and SHA-256 digest.');
    }

    const requestId = this.createRequestId().trim();
    if (!requestId) throw new Error('Device Bridge print request ID is required.');

    const envelope: BridgePrintEnvelope = {
      protocolVersion: this.binding.bridge.protocolVersion,
      requestId,
      bridgeId: this.binding.bridge.bridgeId,
      printerEndpointId: this.binding.endpoint.endpointId,
      printJobId: job.id,
      artifactRef: artifact.objectRef,
      artifactSha256: artifact.sha256,
      idempotencyKey: job.idempotencyKey,
      createdAt: job.submittedAt,
    };
    assertValidBridgePrintEnvelope(envelope);

    const ack = await this.client.submitPrint(envelope);
    assertAckMatchesEnvelope(envelope, ack);
    return mapAck(ack);
  }
}
