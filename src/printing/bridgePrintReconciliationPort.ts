import {
  assertBridgeStatusMatchesRequest,
  assertValidBridgePrintStatusRequest,
  bridgeSupportsPrintReconciliation,
  type BridgePrintStatusRequest,
  type BridgePrintStatusResult,
  type PrintBridgeIdentity,
} from './deviceBridge.js';
import type {
  PrintReconciliationLookup,
  PrintReconciliationPort,
  PrintReconciliationResult,
} from './printReconciliation.js';

export interface PrintBridgeStatusClient {
  getPrintStatus(request: BridgePrintStatusRequest): Promise<BridgePrintStatusResult>;
}

export class BridgePrintReconciliationPort implements PrintReconciliationPort {
  constructor(
    private readonly bridge: PrintBridgeIdentity,
    private readonly client: PrintBridgeStatusClient,
    private readonly createRequestId: () => string,
  ) {
    if (!bridgeSupportsPrintReconciliation(bridge)) {
      throw new Error('Configured Print Bridge does not support protocol v2 reconciliation.');
    }
  }

  async lookup(input: PrintReconciliationLookup): Promise<PrintReconciliationResult> {
    if (input.businessId !== this.bridge.businessId) {
      throw new Error('Print Bridge belongs to another business.');
    }
    const requestId = this.createRequestId().trim();
    if (!requestId) throw new Error('Print reconciliation request ID is required.');

    const request: BridgePrintStatusRequest = {
      protocolVersion: 2,
      requestId,
      bridgeId: this.bridge.bridgeId,
      printJobId: input.printJobId,
      idempotencyKey: input.idempotencyKey,
    };
    assertValidBridgePrintStatusRequest(request);

    const result = await this.client.getPrintStatus(request);
    assertBridgeStatusMatchesRequest(request, result);

    if (result.outcome === 'printed') {
      const mapped: PrintReconciliationResult = {
        outcome: 'printed',
        observedAt: result.observedAt,
      };
      if (result.providerJobId !== undefined) mapped.providerJobId = result.providerJobId;
      return mapped;
    }
    if (result.outcome === 'accepted') {
      const mapped: PrintReconciliationResult = {
        outcome: 'accepted',
        observedAt: result.observedAt,
      };
      if (result.providerJobId !== undefined) mapped.providerJobId = result.providerJobId;
      return mapped;
    }
    if (result.outcome === 'failed_before_output') {
      return {
        outcome: 'failed_before_output',
        observedAt: result.observedAt,
        code: result.code ?? 'bridge_failed_before_output',
      };
    }
    if (result.outcome === 'unknown') {
      const mapped: PrintReconciliationResult = {
        outcome: 'unknown',
        observedAt: result.observedAt,
      };
      if (result.code !== undefined) mapped.code = result.code;
      return mapped;
    }

    const mapped: PrintReconciliationResult = {
      outcome: 'not_found',
      observedAt: result.observedAt,
    };
    if (result.code !== undefined) mapped.code = result.code;
    return mapped;
  }
}
