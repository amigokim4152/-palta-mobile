import type {
  CompatibilityManifestEntry,
  PrinterCompatibilityManifest,
} from './printRouting.js';

export type PrinterRuntimeContext = {
  appVersion: string;
  bridgeVersion?: string;
  bridgeProtocolVersion?: number;
  adapterVersions: Readonly<Record<string, string>>;
};

export type PrinterRuntimeCompatibilityAction =
  | 'none'
  | 'update_app'
  | 'update_bridge'
  | 'update_adapter'
  | 'bridge_required';

export type PrinterRuntimeCompatibilityDecision = {
  compatible: boolean;
  action: PrinterRuntimeCompatibilityAction;
  reasons: string[];
};

export type ManifestFreshness = 'fresh' | 'stale' | 'future_timestamp' | 'invalid_timestamp';

function parseNumericVersion(value: string): number[] {
  const normalized = value.trim().split('-', 1)[0] ?? '';
  if (!/^\d+(?:\.\d+)*$/.test(normalized)) {
    throw new Error(`Unsupported version format: ${value}`);
  }
  return normalized.split('.').map((segment) => Number(segment));
}

/** Returns -1, 0 or 1 for left <, = or > right. */
export function compareNumericVersions(left: string, right: string): -1 | 0 | 1 {
  const a = parseNumericVersion(left);
  const b = parseNumericVersion(right);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const av = a[index] ?? 0;
    const bv = b[index] ?? 0;
    if (av < bv) return -1;
    if (av > bv) return 1;
  }
  return 0;
}

function isOlder(current: string, minimum: string): boolean {
  return compareNumericVersions(current, minimum) < 0;
}

const ACTION_PRIORITY: Readonly<Record<PrinterRuntimeCompatibilityAction, number>> = {
  none: 0,
  update_adapter: 1,
  update_bridge: 2,
  bridge_required: 3,
  update_app: 4,
};

function prioritizeAction(
  current: PrinterRuntimeCompatibilityAction,
  candidate: PrinterRuntimeCompatibilityAction,
): PrinterRuntimeCompatibilityAction {
  return ACTION_PRIORITY[candidate] > ACTION_PRIORITY[current] ? candidate : current;
}

/**
 * A manifest entry may describe hardware we know how to support, but the current
 * app/bridge still has to contain a sufficiently new executable adapter. Remote
 * manifest data can never magically add executable printer support.
 */
export function assessPrinterRuntimeCompatibility(input: {
  entry: CompatibilityManifestEntry;
  runtime: PrinterRuntimeContext;
}): PrinterRuntimeCompatibilityDecision {
  const requirements = input.entry.runtimeRequirements;
  if (!requirements) return { compatible: true, action: 'none', reasons: [] };

  const reasons: string[] = [];
  let action: PrinterRuntimeCompatibilityAction = 'none';

  if (
    requirements.minAppVersion !== undefined &&
    isOlder(input.runtime.appVersion, requirements.minAppVersion)
  ) {
    reasons.push(`app>=${requirements.minAppVersion}`);
    action = prioritizeAction(action, 'update_app');
  }

  if (requirements.minBridgeVersion !== undefined) {
    if (input.runtime.bridgeVersion === undefined) {
      reasons.push(`bridge>=${requirements.minBridgeVersion}`);
      action = prioritizeAction(action, 'bridge_required');
    } else if (isOlder(input.runtime.bridgeVersion, requirements.minBridgeVersion)) {
      reasons.push(`bridge>=${requirements.minBridgeVersion}`);
      action = prioritizeAction(action, 'update_bridge');
    }
  }

  if (requirements.minBridgeProtocolVersion !== undefined) {
    if (input.runtime.bridgeProtocolVersion === undefined) {
      reasons.push(`bridgeProtocol>=${requirements.minBridgeProtocolVersion}`);
      action = prioritizeAction(action, 'bridge_required');
    } else if (input.runtime.bridgeProtocolVersion < requirements.minBridgeProtocolVersion) {
      reasons.push(`bridgeProtocol>=${requirements.minBridgeProtocolVersion}`);
      action = prioritizeAction(action, 'update_bridge');
    }
  }

  if (requirements.minAdapterVersion !== undefined) {
    const currentAdapterVersion = input.runtime.adapterVersions[input.entry.adapterKey];
    if (
      currentAdapterVersion === undefined ||
      isOlder(currentAdapterVersion, requirements.minAdapterVersion)
    ) {
      reasons.push(`${input.entry.adapterKey}>=${requirements.minAdapterVersion}`);
      action = prioritizeAction(action, 'update_adapter');
    }
  }

  return {
    compatible: reasons.length === 0,
    action,
    reasons,
  };
}

/**
 * Staleness does not disable an already configured printer. It prevents Palta from
 * making a fresh "recommended/certified" promise from obsolete compatibility data.
 */
export function assessCompatibilityManifestFreshness(input: {
  manifest: PrinterCompatibilityManifest;
  now: string;
  maxAgeDays?: number;
}): ManifestFreshness {
  const generated = Date.parse(input.manifest.generatedAt);
  const now = Date.parse(input.now);
  if (!Number.isFinite(generated) || !Number.isFinite(now)) return 'invalid_timestamp';
  if (generated > now + 5 * 60 * 1000) return 'future_timestamp';

  const maxAgeDays = input.maxAgeDays ?? 30;
  if (!Number.isFinite(maxAgeDays) || maxAgeDays <= 0) {
    throw new Error('maxAgeDays must be a positive number.');
  }
  const ageMs = now - generated;
  return ageMs > maxAgeDays * 24 * 60 * 60 * 1000 ? 'stale' : 'fresh';
}

export function mayClaimFreshCertification(freshness: ManifestFreshness): boolean {
  return freshness === 'fresh';
}
