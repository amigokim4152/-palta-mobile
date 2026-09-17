import {
  buildBusinessReturnLink,
  businessReturnLinkLabel,
  type BusinessReturnLinkSource,
} from './businessReturnLink.js';

export type BusinessShareAssetVariant =
  | 'counter_card'
  | 'packaging_sticker'
  | 'receipt_footer'
  | 'social_share';

export type BusinessShareAssetSpec = Readonly<{
  variant: BusinessShareAssetVariant;
  businessName: string;
  headline: string;
  supportingText?: string;
  destinationUrl: string;
  qrPayload?: string;
  source: BusinessReturnLinkSource;
  campaignId?: string;
  print?: Readonly<{
    widthMm: number;
    heightMm: number;
  }>;
}>;

function defaultSource(variant: BusinessShareAssetVariant): BusinessReturnLinkSource {
  switch (variant) {
    case 'counter_card': return 'counter';
    case 'packaging_sticker': return 'packaging';
    case 'receipt_footer': return 'receipt';
    case 'social_share': return 'social';
  }
}

function printSize(variant: BusinessShareAssetVariant): BusinessShareAssetSpec['print'] {
  switch (variant) {
    case 'counter_card':
      return { widthMm: 100, heightMm: 150 };
    case 'packaging_sticker':
      return { widthMm: 60, heightMm: 60 };
    case 'receipt_footer':
      return { widthMm: 72, heightMm: 30 };
    case 'social_share':
      return undefined;
  }
}

/**
 * Free, renderer-neutral PR asset spec. Palta can later render it in-app, on the
 * web or through a design adapter without making the merchant maintain another
 * profile. QR generation should happen locally/in our own renderer from
 * `qrPayload`; this contract does not require a paid QR API.
 */
export function buildBusinessShareAsset(input: {
  canonicalBusinessUrl: string;
  businessName: string;
  variant: BusinessShareAssetVariant;
  campaignId?: string;
  supportingText?: string;
}): BusinessShareAssetSpec {
  const businessName = input.businessName.trim();
  if (!businessName) throw new Error('Business share asset requires a business name');
  const source = defaultSource(input.variant);
  const returnLink = buildBusinessReturnLink({
    canonicalBusinessUrl: input.canonicalBusinessUrl,
    source,
    ...(input.campaignId ? { campaignId: input.campaignId } : {}),
  });
  const size = printSize(input.variant);

  return {
    variant: input.variant,
    businessName,
    headline: businessReturnLinkLabel(source),
    ...(input.supportingText?.trim() ? { supportingText: input.supportingText.trim() } : {}),
    destinationUrl: returnLink.destinationUrl,
    ...(input.variant !== 'social_share' ? { qrPayload: returnLink.qrPayload } : {}),
    source,
    ...(returnLink.campaignId ? { campaignId: returnLink.campaignId } : {}),
    ...(size ? { print: size } : {}),
  };
}
