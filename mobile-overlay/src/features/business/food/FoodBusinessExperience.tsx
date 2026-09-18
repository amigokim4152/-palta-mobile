import { useCallback, useMemo } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Image,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from 'react-native';
import type { BusinessApiDetail } from '../../../../../src/api/paltaApiClient';
import { createFoodOrderIntent } from '../../../../../src/business/foodVertical';
import { ErrorState, LoadingState } from '../../../components/AsyncStateBlock';
import { useAsyncResource } from '../../../hooks/useAsyncResource';
import { mobileRuntime } from '../../../services/paltaClient';
import { paltaTheme } from '../../../theme/paltaTheme';

function whatsappUrl(business: BusinessApiDetail): string | undefined {
  const linked = business.channel_links?.find((link) => link.provider === 'whatsapp')?.url;
  if (linked) return linked;
  const raw = business.contact?.whatsapp?.trim();
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) return raw;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return undefined;
  const normalized = digits.startsWith('56')
    ? digits
    : digits.length === 9 && digits.startsWith('9')
      ? `56${digits}`
      : digits;
  return `https://wa.me/${normalized}`;
}

function orderChannel(business: BusinessApiDetail):
  | { label: string; url: string; kind: 'delivery' | 'whatsapp' | 'website' }
  | undefined {
  const delivery = business.channel_links?.find(
    (link) => link.provider === 'delivery_marketplace',
  );
  if (delivery) return { label: 'Pedir delivery', url: delivery.url, kind: 'delivery' };

  const whatsapp = whatsappUrl(business);
  if (whatsapp) return { label: 'Pedir por WhatsApp', url: whatsapp, kind: 'whatsapp' };

  const website =
    business.channel_links?.find((link) => link.provider === 'website')?.url ??
    business.contact?.website;
  if (website) return { label: 'Ver menú / pedir', url: website, kind: 'website' };

  return undefined;
}

function ActionButton({
  label,
  onPress,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 52,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: paltaTheme.spacing.md,
        borderRadius: paltaTheme.radius.control,
        borderWidth: variant === 'secondary' ? 1 : 0,
        borderColor: paltaTheme.color.divider,
        backgroundColor:
          variant === 'primary'
            ? pressed
              ? paltaTheme.color.brandMid
              : paltaTheme.color.brandPrimary
            : pressed
              ? paltaTheme.color.surfaceMuted
              : paltaTheme.color.surface,
      })}
    >
      <Text
        style={{
          fontSize: 15,
          fontWeight: '800',
          color:
            variant === 'primary' ? paltaTheme.color.surface : paltaTheme.color.textPrimary,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function FoodBusinessExperience() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();

  const loadBusiness = useCallback(async () => {
    if (!businessId) throw new Error('Business ID missing');
    if (mobileRuntime.status !== 'ready') throw new Error(mobileRuntime.message);
    const [business, coupons] = await Promise.all([
      mobileRuntime.client.getBusiness(businessId),
      mobileRuntime.client.getBusinessBasicCoupons(businessId),
    ]);
    return { business, coupons: coupons.items };
  }, [businessId]);

  const { state, refresh } = useAsyncResource(loadBusiness);
  const business = state.data?.business;
  const coupons = state.data?.coupons ?? [];
  const channel = useMemo(() => (business ? orderChannel(business) : undefined), [business]);

  const orderIntent = useMemo(
    () => (businessId ? createFoodOrderIntent(businessId) : undefined),
    [businessId],
  );

  if (state.status === 'loading' && !state.data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
        <View style={{ flex: 1, padding: paltaTheme.spacing.md }}>
          <LoadingState label="Cargando opciones para pedir…" />
        </View>
      </SafeAreaView>
    );
  }

  if (state.status === 'error' && !state.data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
        <View style={{ flex: 1, padding: paltaTheme.spacing.md }}>
          <ErrorState message={state.message} onRetry={() => void refresh()} />
        </View>
      </SafeAreaView>
    );
  }

  if (!business || !orderIntent) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
        <View style={{ padding: paltaTheme.spacing.md }}>
          <Text style={{ color: paltaTheme.color.textSecondary }}>No hay datos disponibles.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const firstPhoto = business.photo_urls?.find(Boolean);
  const openNow = business.operational_state === 'open_now';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ position: 'relative' }}>
          {firstPhoto ? (
            <Image
              source={{ uri: firstPhoto }}
              accessibilityLabel={`Foto de ${business.name}`}
              resizeMode="cover"
              style={{ width: '100%', height: 230, backgroundColor: paltaTheme.color.surfaceMuted }}
            />
          ) : (
            <View
              style={{
                height: 190,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: paltaTheme.color.brandSoft,
              }}
            >
              <Text style={{ fontSize: 64, fontWeight: '800', color: paltaTheme.color.brandPrimary }}>
                {business.name.trim().charAt(0).toUpperCase() || 'P'}
              </Text>
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => ({
              position: 'absolute',
              top: paltaTheme.spacing.sm,
              left: paltaTheme.spacing.md,
              minWidth: 48,
              minHeight: 48,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: paltaTheme.radius.pill,
              backgroundColor: pressed ? paltaTheme.color.surfaceMuted : paltaTheme.color.surface,
            })}
          >
            <Text style={{ fontWeight: '800', color: paltaTheme.color.textPrimary }}>Volver</Text>
          </Pressable>
        </View>

        <View style={{ padding: paltaTheme.spacing.md, gap: paltaTheme.spacing.md }}>
          <View style={{ gap: 6 }}>
            <Text
              style={{
                fontSize: 27,
                lineHeight: 32,
                fontWeight: '800',
                color: paltaTheme.color.textPrimary,
              }}
            >
              {business.name}
            </Text>
            <Text
              style={{
                fontSize: 14,
                fontWeight: '700',
                color: openNow ? paltaTheme.color.brandPrimary : paltaTheme.color.textSecondary,
              }}
            >
              {business.opening_status ?? (openNow ? 'Abierto ahora' : 'Horario por confirmar')}
            </Text>
            {business.service_labels?.length ? (
              <Text style={{ lineHeight: 20, color: paltaTheme.color.textSecondary }}>
                {business.service_labels.slice(0, 3).join(' · ')}
              </Text>
            ) : null}
          </View>

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
            <Text style={{ fontSize: 18, fontWeight: '800', color: paltaTheme.color.textPrimary }}>
              Pedir comida
            </Text>
            {channel ? (
              <>
                <Text style={{ lineHeight: 20, color: paltaTheme.color.textSecondary }}>
                  Usa el canal de pedido disponible de este local. Palta mantiene el mismo negocio y tu contexto de descubrimiento.
                </Text>
                <ActionButton
                  label={channel.label}
                  onPress={() => void Linking.openURL(channel.url)}
                />
              </>
            ) : (
              <Text style={{ lineHeight: 20, color: paltaTheme.color.textSecondary }}>
                Este local todavía no tiene un canal de pedido conectado. Puedes revisar su perfil completo para ver contacto, horarios y novedades.
              </Text>
            )}
            <ActionButton
              label="Ver perfil completo"
              variant="secondary"
              onPress={() => router.push(`/business/${encodeURIComponent(business.id)}`)}
            />
          </View>

          {coupons.length ? (
            <View
              style={{
                padding: paltaTheme.spacing.md,
                gap: paltaTheme.spacing.xs,
                borderRadius: paltaTheme.radius.surface,
                backgroundColor: paltaTheme.color.avocadoCream,
              }}
            >
              <Text style={{ fontSize: 17, fontWeight: '800', color: paltaTheme.color.textPrimary }}>
                Beneficios
              </Text>
              {coupons.map((coupon) => (
                <View key={coupon.id} style={{ gap: 3 }}>
                  <Text style={{ fontWeight: '800', color: paltaTheme.color.textPrimary }}>
                    {coupon.title}
                  </Text>
                  {coupon.description ? (
                    <Text style={{ lineHeight: 19, color: paltaTheme.color.textSecondary }}>
                      {coupon.description}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}

          {business.description ? (
            <View
              style={{
                padding: paltaTheme.spacing.md,
                gap: paltaTheme.spacing.xs,
                borderRadius: paltaTheme.radius.surface,
                backgroundColor: paltaTheme.color.surface,
              }}
            >
              <Text style={{ fontSize: 17, fontWeight: '800', color: paltaTheme.color.textPrimary }}>
                Sobre el local
              </Text>
              <Text style={{ lineHeight: 21, color: paltaTheme.color.textSecondary }}>
                {business.description}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
