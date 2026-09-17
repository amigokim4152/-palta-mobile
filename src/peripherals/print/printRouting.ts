import type {
  PrintJob,
  PrintRequirement,
  PrinterCapability,
  PrinterProfile,
} from './printCore.js';

export type PrinterSupportTier = 'recommended' | 'supported' | 'best_effort' | 'unsupported';

export type PrinterCompatibilityAssessment = {
  tier: PrinterSupportTier;
  compatible: boolean;
  reasons: readonly string[];
};

function hasAllCapabilities(
  printer: PrinterProfile,
  required: ReadonlySet<PrinterCapability>,
): boolean {
  for (const capability of required) {
    if (!printer.capabilities.has(capability)) return false;
  }
  return true;
}

export function assessPrinterCompatibility(
  printer: PrinterProfile,
  requirement: PrintRequirement,
): PrinterCompatibilityAssessment {
  const reasons: string[] = [];
  if (!printer.enabled) reasons.push('printer_disabled');
  if (printer.printerClass !== requirement.printerClass) reasons.push('printer_class_mismatch');
  if (!hasAllCapabilities(printer, requirement.requiredCapabilities)) {
    reasons.push('missing_required_capability');
  }
  if (
    requirement.preferredMediaWidthMm !== undefined &&
    printer.mediaWidthMm !== undefined &&
    Math.abs(printer.mediaWidthMm - requirement.preferredMediaWidthMm) > 1
  ) {
    reasons.push('media_width_mismatch');
  }

  if (reasons.length > 0) {
    return { tier: 'unsupported', compatible: false, reasons };
  }

  if (printer.verified && printer.protocol !== 'unknown') {
    return { tier: 'recommended', compatible: true, reasons: ['verified_profile'] };
  }

  if (printer.protocol !== 'unknown') {
    return { tier: 'supported', compatible: true, reasons: ['known_protocol_unverified_model'] };
  }

  return { tier: 'best_effort', compatible: true, reasons: ['generic_os_or_bridge_fallback'] };
}

export type PrintRouteDecision = {
  printerId: string;
  supportTier: PrinterSupportTier;
  reason: 'preferred' | 'outlet_verified' | 'business_verified' | 'compatible_fallback';
};

export function selectPrinterForJob(
  job: PrintJob,
  requirement: PrintRequirement,
  printers: readonly PrinterProfile[],
): PrintRouteDecision {
  const candidates = printers
    .filter((printer) => printer.businessId === job.businessId)
    .map((printer) => ({ printer, assessment: assessPrinterCompatibility(printer, requirement) }))
    .filter(({ assessment }) => assessment.compatible);

  if (job.preferredPrinterId !== undefined) {
    const preferred = candidates.find(({ printer }) => printer.id === job.preferredPrinterId);
    if (preferred !== undefined) {
      return {
        printerId: preferred.printer.id,
        supportTier: preferred.assessment.tier,
        reason: 'preferred',
      };
    }
  }

  if (job.outletId !== undefined) {
    const outletVerified = candidates.find(
      ({ printer }) => printer.outletId === job.outletId && printer.verified,
    );
    if (outletVerified !== undefined) {
      return {
        printerId: outletVerified.printer.id,
        supportTier: outletVerified.assessment.tier,
        reason: 'outlet_verified',
      };
    }
  }

  const verified = candidates.find(({ printer }) => printer.verified);
  if (verified !== undefined) {
    return {
      printerId: verified.printer.id,
      supportTier: verified.assessment.tier,
      reason: 'business_verified',
    };
  }

  const fallback = candidates[0];
  if (fallback !== undefined) {
    return {
      printerId: fallback.printer.id,
      supportTier: fallback.assessment.tier,
      reason: 'compatible_fallback',
    };
  }

  throw new Error('No compatible printer is available for this print job.');
}

export type PrintSupportPolicy = {
  allowBestEffortExistingHardware: boolean;
  blockUnknownProtocolForAutomaticPrinting: boolean;
};

export function canUsePrinterForAutomaticPrinting(
  printer: PrinterProfile,
  assessment: PrinterCompatibilityAssessment,
  policy: PrintSupportPolicy,
): boolean {
  if (!assessment.compatible) return false;
  if (assessment.tier === 'best_effort' && !policy.allowBestEffortExistingHardware) return false;
  if (printer.protocol === 'unknown' && policy.blockUnknownProtocolForAutomaticPrinting) return false;
  return true;
}
