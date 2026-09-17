import type { PrintDocumentKind, PrinterSupportTier, PrinterTransport } from './printCore.js';
import {
  certificationIsCurrent,
  supportTierFromCertification,
  type PrinterCertificationPlatform,
  type PrinterCertificationRecord,
} from './printerCertification.js';

export type PrinterUseContext =
  | 'mobile_solo'
  | 'fixed_single_register'
  | 'fixed_multi_register'
  | 'kitchen'
  | 'warehouse_label'
  | 'office_document';

export type PrinterPackageRole = 'receipt' | 'kitchen' | 'label' | 'document';

export type PrinterPackageRequirement = {
  role: PrinterPackageRole;
  documentKinds: readonly PrintDocumentKind[];
  preferredTransports: readonly PrinterTransport[];
  required: boolean;
};

export type PrinterPackagePlan = {
  context: PrinterUseContext;
  requirements: readonly PrinterPackageRequirement[];
  guidance: readonly string[];
};

export function planPrinterPackage(context: PrinterUseContext): PrinterPackagePlan {
  if (context === 'mobile_solo') {
    return {
      context,
      requirements: [
        {
          role: 'receipt',
          documentKinds: ['receipt'],
          preferredTransports: ['bluetooth', 'network', 'vendor_sdk'],
          required: false,
        },
      ],
      guidance: [
        'digital_receipt_first',
        'physical_printer_optional',
        'prefer_vendor_supported_mobile_path',
      ],
    };
  }

  if (context === 'fixed_single_register') {
    return {
      context,
      requirements: [
        {
          role: 'receipt',
          documentKinds: ['receipt'],
          preferredTransports: ['network', 'usb', 'vendor_sdk', 'os_spooler'],
          required: true,
        },
      ],
      guidance: [
        'prefer_network_for_shared_reconnectability',
        'usb_is_good_for_dedicated_single_register',
        'bluetooth_not_primary_for_fixed_counter',
      ],
    };
  }

  if (context === 'fixed_multi_register') {
    return {
      context,
      requirements: [
        {
          role: 'receipt',
          documentKinds: ['receipt'],
          preferredTransports: ['network', 'vendor_sdk', 'os_spooler'],
          required: true,
        },
      ],
      guidance: [
        'network_printer_preferred',
        'explicit_backup_route_recommended',
        'avoid_register_specific_usb_as_only_shared_printer',
      ],
    };
  }

  if (context === 'kitchen') {
    return {
      context,
      requirements: [
        {
          role: 'kitchen',
          documentKinds: ['kitchen_ticket'],
          preferredTransports: ['network', 'vendor_sdk', 'usb'],
          required: true,
        },
      ],
      guidance: [
        'network_path_preferred',
        'status_reconciliation_required',
        'explicit_fallback_route_recommended',
      ],
    };
  }

  if (context === 'warehouse_label') {
    return {
      context,
      requirements: [
        {
          role: 'label',
          documentKinds: ['label'],
          preferredTransports: ['network', 'usb', 'bluetooth', 'vendor_sdk'],
          required: true,
        },
      ],
      guidance: [
        'prefer_native_label_language_or_vendor_sdk',
        'validate_media_and_barcode_alignment',
      ],
    };
  }

  return {
    context,
    requirements: [
      {
        role: 'document',
        documentKinds: ['a4_document'],
        preferredTransports: ['ipp', 'os_spooler', 'network'],
        required: false,
      },
    ],
    guidance: ['prefer_os_or_ipp_pdf_path', 'pdf_download_remains_fallback'],
  };
}

export type ProcurementCandidateDecision = {
  eligible: boolean;
  score: number;
  supportTier: PrinterSupportTier;
  reasons: readonly string[];
};

const SUPPORT_SCORE: Readonly<Record<PrinterSupportTier, number>> = {
  palta_recommended: 100,
  palta_certified: 80,
  compatible: 55,
  legacy_bridge: 35,
  unknown: 0,
};

function transportPreferenceScore(
  transport: PrinterTransport,
  preferred: readonly PrinterTransport[],
): number {
  const index = preferred.indexOf(transport);
  if (index < 0) return 0;
  return Math.max(1, 20 - index * 4);
}

/**
 * Procurement eligibility is intentionally based only on tested certification
 * records. A model being popular or listed online is not enough for Palta to
 * recommend buying it. The intended POS/bridge platform must match the platform
 * that was actually certified; another platform needs its own certification record.
 */
export function assessProcurementCandidate(input: {
  record: PrinterCertificationRecord;
  requirement: PrinterPackageRequirement;
  platform: PrinterCertificationPlatform;
  now: string;
}): ProcurementCandidateDecision {
  const reasons: string[] = [];
  if (!certificationIsCurrent(input.record, input.now)) {
    return { eligible: false, score: 0, supportTier: 'unknown', reasons: ['certification_expired'] };
  }
  if (input.record.platform !== input.platform) {
    return { eligible: false, score: 0, supportTier: 'unknown', reasons: ['platform_not_certified'] };
  }
  if (!input.requirement.documentKinds.every((kind) => input.record.documentKinds.includes(kind))) {
    return { eligible: false, score: 0, supportTier: 'unknown', reasons: ['document_kind_not_certified'] };
  }

  const supportTier = supportTierFromCertification(input.record, input.now);
  if (supportTier === 'unknown') {
    return { eligible: false, score: 0, supportTier, reasons: ['technical_certification_not_sufficient'] };
  }

  let score = SUPPORT_SCORE[supportTier];
  score += transportPreferenceScore(input.record.transport, input.requirement.preferredTransports);

  if (input.record.procurementStatus === 'preferred_chile') {
    score += 25;
    reasons.push('preferred_chile');
  } else if (input.record.procurementStatus === 'available_chile') {
    score += 12;
    reasons.push('available_chile');
  } else if (input.record.procurementStatus === 'unavailable_chile') {
    return { eligible: false, score: 0, supportTier, reasons: ['unavailable_chile'] };
  } else {
    reasons.push('chile_availability_not_verified');
  }

  if (input.requirement.preferredTransports.includes(input.record.transport)) {
    reasons.push(`preferred_transport:${input.record.transport}`);
  }
  reasons.push(`platform:${input.record.platform}`);
  reasons.push(`support:${supportTier}`);

  return { eligible: true, score, supportTier, reasons };
}

export type ExistingPrinterReuseDecision =
  | 'reuse_recommended'
  | 'reuse_after_test'
  | 'reuse_legacy_bridge'
  | 'guided_diagnosis'
  | 'replace_if_printing_is_critical';

export function decideExistingPrinterReuse(input: {
  supportTier: PrinterSupportTier;
  requiredForOperation: boolean;
  diagnosticsPassed: boolean;
}): ExistingPrinterReuseDecision {
  if (
    (input.supportTier === 'palta_recommended' || input.supportTier === 'palta_certified') &&
    input.diagnosticsPassed
  ) {
    return 'reuse_recommended';
  }
  if (input.supportTier === 'compatible') {
    return input.diagnosticsPassed ? 'reuse_after_test' : 'guided_diagnosis';
  }
  if (input.supportTier === 'legacy_bridge' && input.diagnosticsPassed) {
    return 'reuse_legacy_bridge';
  }
  if (input.requiredForOperation) return 'replace_if_printing_is_critical';
  return 'guided_diagnosis';
}
