export type BridgeTransport = 'local_network' | 'ethernet' | 'wifi';
export type BridgePrinterTransport = 'usb' | 'serial' | 'bluetooth_classic' | 'bluetooth_le' | 'network';

export type PrintBridgeIdentity = {
  bridgeId: string;
  businessId: string;
  outletId?: string;
  displayName: string;
  publicKeyFingerprint: string;
  softwareVersion: string;
  protocolVersion: 1;
  transports: BridgeTransport[];
  advertisedService: '_palta-print._tcp';
};

export type BridgePrinterEndpoint = {
  endpointId: string;
  bridgeId: string;
  displayName: string;
  manufacturer?: string;
  model?: string;
  transport: BridgePrinterTransport;
  adapterKey: string;
  health: 'ready' | 'offline' | 'permission_required' | 'driver_required' | 'unknown';
};

export type BridgePairingRequest = {
  bridgeId: string;
  expectedPublicKeyFingerprint: string;
  oneTimeSetupCode: string;
  clientDeviceId: string;
};

export type BridgePairingResult = {
  bridgeId: string;
  clientDeviceId: string;
  pairingId: string;
  pairedAt: string;
  expiresAt?: string;
};

export type BridgePrintEnvelope = {
  protocolVersion: 1;
  requestId: string;
  bridgeId: string;
  printerEndpointId: string;
  printJobId: string;
  artifactRef: string;
  artifactSha256: string;
  idempotencyKey: string;
  createdAt: string;
};

export type BridgePrintAck = {
  requestId: string;
  printJobId: string;
  outcome: 'accepted' | 'printed' | 'unknown' | 'failed';
  code?: string;
};

export function assertValidBridgePairingRequest(request: BridgePairingRequest): void {
  if (!request.bridgeId.trim() || !request.clientDeviceId.trim()) {
    throw new Error('Bridge and client device IDs are required.');
  }
  if (request.expectedPublicKeyFingerprint.trim().length < 16) {
    throw new Error('Bridge public-key fingerprint is required.');
  }
  if (!/^[0-9A-Z-]{6,32}$/i.test(request.oneTimeSetupCode)) {
    throw new Error('Bridge pairing requires a valid one-time setup code.');
  }
}

export function assertValidBridgePrintEnvelope(envelope: BridgePrintEnvelope): void {
  if (envelope.protocolVersion !== 1) throw new Error('Unsupported Print Bridge protocol version.');
  if (!envelope.requestId.trim() || !envelope.bridgeId.trim() || !envelope.printerEndpointId.trim()) {
    throw new Error('Bridge print envelope identifiers are required.');
  }
  if (!envelope.printJobId.trim() || !envelope.idempotencyKey.trim()) {
    throw new Error('Print job and idempotency identifiers are required.');
  }
  if (!envelope.artifactRef.trim() || !/^[a-f0-9]{64}$/i.test(envelope.artifactSha256)) {
    throw new Error('Bridge print envelope requires an artifact reference and SHA-256 digest.');
  }
}

export type BridgeDiscoveryPolicy = {
  serviceType: '_palta-print._tcp';
  useBonjour: true;
  allowPublicInternetDiscovery: false;
  pairBeforePrint: true;
};

export const DEFAULT_BRIDGE_DISCOVERY_POLICY: BridgeDiscoveryPolicy = {
  serviceType: '_palta-print._tcp',
  useBonjour: true,
  allowPublicInternetDiscovery: false,
  pairBeforePrint: true,
};

/**
 * BLE is useful for setup/discovery, but large raster jobs should prefer local
 * Wi-Fi/Ethernet when the bridge can provide it. This keeps image-label printing
 * fast and avoids making iPad Bluetooth quirks the critical print path.
 */
export function preferredBridgeDataPath(input: {
  localNetworkAvailable: boolean;
  ethernetAvailable: boolean;
  bluetoothOnly: boolean;
}): 'ethernet' | 'local_network' | 'bluetooth_fallback' {
  if (input.ethernetAvailable) return 'ethernet';
  if (input.localNetworkAvailable) return 'local_network';
  if (input.bluetoothOnly) return 'bluetooth_fallback';
  throw new Error('No Print Bridge data path is available.');
}
