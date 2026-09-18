import { Text, View } from 'react-native';
import type { BusinessApiDetail } from '../../../../../src/api/paltaApiClient';
import {
  projectFoodFulfillment,
  type FoodFulfillmentMode,
  type FoodFulfillmentProfile,
  type FoodMoneyEvidence,
} from '../../../../../src/business/foodFulfillment';
import { paltaTheme } from '../../../theme/paltaTheme';

type FoodBusinessWithFulfillment = BusinessApiDetail & {
  food_fulfillment?: FoodFulfillmentProfile;
};

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-CL')
    .trim();
}

function inferFulfillmentFromStrongSignals(
  business: BusinessApiDetail,
): FoodFulfillmentProfile | undefined {
  const modes = new Set<FoodFulfillmentMode>();
  const labels = (business.service_labels ?? []).map(normalize);

  if (business.channel_links?.some((link) => link.provider === 'delivery_marketplace')) {
    modes.add('external_delivery');
  }
  if (labels.some((label) => /\b(retiro|pickup|pick up)\b/.test(label))) {
    modes.add('pickup');
  }
  if (labels.some((label) => /\b(delivery propio|despacho propio|reparto propio)\b/.test(label))) {
    modes.add('merchant_delivery');
  }

  if (modes.size === 0) return undefined;
  return {
    modes: [...modes],
    source: 'unknown',
  };
}

export function resolveFoodFulfillmentProfile(
  business: BusinessApiDetail,
): FoodFulfillmentProfile | undefined {
  return (business as FoodBusinessWithFulfillment).food_fulfillment ??
    inferFulfillmentFromStrongSignals(business);
}

function modeLabel(mode: FoodFulfillmentMode): string {
  if (mode === 'pickup') return 'Retiro';
  if (mode === 'merchant_delivery') return 'Entrega del local';
  if (mode === 'external_delivery') return 'Delivery externo';
  return 'Palta Delivery';
}

function moneyLabel(value: FoodMoneyEvidence | undefined): string | undefined {
  if (!value) return undefined;
  const amount = new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: value.currency,
    maximumFractionDigits: 0,
  }).format(value.amount_minor);
  return value.promotion ? `${amount} promo` : amount;
}

function minuteRangeLabel(
  range: FoodFulfillmentProfile['delivery_minutes'],
): string | undefined {
  if (!range) return undefined;
  return range.max !== undefined && range.max !== range.min
    ? `${range.min}–${range.max} min`
    : `${range.min} min`;
}

export function FoodFulfillmentSummary({
  business,
  distanceM,
}: {
  business: BusinessApiDetail;
  distanceM?: number;
}) {
  const profile = resolveFoodFulfillmentProfile(business);
  if (!profile) return null;

  const projection = projectFoodFulfillment(profile, distanceM);
  const deliveryTime = minuteRangeLabel(profile.delivery_minutes);
  const deliveryFee = moneyLabel(profile.delivery_fee);
  const minimumOrder = moneyLabel(profile.minimum_order);
  const outsideRadius = projection.distance_eligibility === 'outside_radius';

  return (
    <View
      style={{
        padding: paltaTheme.spacing.md,
        gap: paltaTheme.spacing.sm,
        borderRadius: paltaTheme.radius.surface,
        backgroundColor: paltaTheme.color.surface,
        borderWidth: 1,
        borderColor: paltaTheme.color.divider,
      }}
    >
      <View style={{ gap: 3 }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: paltaTheme.color.textPrimary }}>
          Entrega y retiro
        </Text>
        <Text style={{ lineHeight: 19, color: paltaTheme.color.textSecondary }}>
          {outsideRadius
            ? 'Estás fuera del radio de entrega informado. El retiro puede seguir disponible.'
            : 'Opciones informadas para este local.'}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
        {profile.modes.map((mode) => (
          <View
            key={mode}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 7,
              borderRadius: paltaTheme.radius.pill,
              backgroundColor:
                mode !== 'pickup' && outsideRadius
                  ? paltaTheme.color.surfaceMuted
                  : paltaTheme.color.brandSoft,
            }}
          >
            <Text
              style={{
                fontSize: 12,
                fontWeight: '800',
                color:
                  mode !== 'pickup' && outsideRadius
                    ? paltaTheme.color.textMuted
                    : paltaTheme.color.brandPrimary,
              }}
            >
              {modeLabel(mode)}
            </Text>
          </View>
        ))}
      </View>

      {deliveryTime || deliveryFee || minimumOrder || profile.delivery_radius_m !== undefined ? (
        <View style={{ gap: 4 }}>
          {deliveryTime ? (
            <Text style={{ color: paltaTheme.color.textSecondary }}>Entrega estimada: {deliveryTime}</Text>
          ) : null}
          {deliveryFee ? (
            <Text style={{ color: paltaTheme.color.textSecondary }}>Despacho mostrado: {deliveryFee}</Text>
          ) : null}
          {minimumOrder ? (
            <Text style={{ color: paltaTheme.color.textSecondary }}>Pedido mínimo: {minimumOrder}</Text>
          ) : null}
          {profile.delivery_radius_m !== undefined ? (
            <Text style={{ color: paltaTheme.color.textSecondary }}>
              Radio informado: {(profile.delivery_radius_m / 1000).toFixed(1).replace('.', ',')} km
            </Text>
          ) : null}
        </View>
      ) : null}

      {profile.delivery_fee?.basis === 'official_source_observed' ? (
        <Text style={{ fontSize: 12, lineHeight: 17, color: paltaTheme.color.textMuted }}>
          El valor de despacho fue observado en una fuente oficial y puede ser temporal o promocional.
        </Text>
      ) : null}
    </View>
  );
}
