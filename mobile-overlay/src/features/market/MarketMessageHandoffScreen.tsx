import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  buildMarketMessageIntent,
  marketMessagePresetText,
  type MarketMessagePreset,
} from '../../../../src/market/marketMessageIntent';
import type { MarketPublicListing } from '../../../../src/market/marketPersistenceContract';
import { paltaTheme } from '../../theme/paltaTheme';
import { getMarketRuntime } from './marketRuntime';

const presets: MarketMessagePreset[] = [
  'availability',
  'pickup',
  'offer',
  'coordinate',
];

export function MarketMessageHandoffScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const runtime = useMemo(() => getMarketRuntime(), []);
  const [listing, setListing] = useState<MarketPublicListing | null>();
  const [preset, setPreset] = useState<MarketMessagePreset>('availability');
  const [prepared, setPrepared] = useState(false);

  useEffect(() => {
    if (!id || !runtime.read) {
      setListing(null);
      return;
    }
    let active = true;
    runtime.read
      .getPublicListing(id)
      .then((next) => {
        if (active) setListing(next);
      })
      .catch(() => {
        if (active) setListing(null);
      });
    return () => {
      active = false;
    };
  }, [id, runtime]);

  const intent = useMemo(() => {
    if (!listing) return undefined;
    return buildMarketMessageIntent({
      listingId: listing.id,
      listingTitle: listing.title,
      sellerActorId: listing.seller.sellerUserId,
      preset,
    });
  }, [listing, preset]);

  if (listing === undefined) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.title}>Preparando conversación…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!listing || !intent) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.title}>No se puede iniciar el mensaje</Text>
          <Text style={styles.centerBody}>
            {runtime.mode === 'unavailable'
              ? runtime.unavailableReason
              : 'La publicación ya no está disponible.'}
          </Text>
          <Pressable style={styles.primaryButton} onPress={() => router.back()}>
            <Text style={styles.primaryButtonText}>Volver</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Mensaje</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <View style={styles.listingContext}>
          <Text style={styles.contextLabel}>Sobre esta publicación</Text>
          <Text numberOfLines={2} style={styles.listingTitle}>
            {listing.title}
          </Text>
          <Text style={styles.sellerLine}>
            {listing.seller.displayName} · {listing.location.comunaName}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Mensaje rápido</Text>
        <View style={styles.presetList}>
          {presets.map((item) => {
            const selected = item === preset;
            return (
              <Pressable
                key={item}
                onPress={() => {
                  setPreset(item);
                  setPrepared(false);
                }}
                style={[styles.presetCard, selected && styles.presetCardSelected]}
              >
                <Text
                  style={[
                    styles.presetText,
                    selected && styles.presetTextSelected,
                  ]}
                >
                  {marketMessagePresetText[item]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.coreBoundaryBox}>
          <Text style={styles.coreBoundaryTitle}>Message Core</Text>
          <Text style={styles.coreBoundaryBody}>
            La conversación será una transacción vinculada a esta publicación. Mercado conserva el contexto; Mensajes conserva la conversación.
          </Text>
        </View>

        {prepared ? (
          <View style={styles.readyBox}>
            <Text style={styles.readyTitle}>Solicitud preparada</Text>
            <Text style={styles.readyBody}>
              Contexto: listing · {intent.context.resourceId}
            </Text>
            <Text style={styles.readyBody}>Mensaje: {intent.initialText}</Text>
            <Text style={styles.pendingText}>
              La UI compartida de Mensajes sigue pendiente de integración. No se crea un chat paralelo dentro de Mercado.
            </Text>
          </View>
        ) : null}

        <Pressable
          onPress={() => setPrepared(true)}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>
            {prepared ? 'Solicitud lista' : 'Continuar con Mensajes'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: paltaTheme.color.canvas },
  header: {
    height: 54,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paltaTheme.color.divider,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    color: paltaTheme.color.textPrimary,
    fontSize: 36,
    lineHeight: 38,
  },
  headerTitle: {
    color: paltaTheme.color.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  headerSpacer: { width: 44 },
  content: { flex: 1, padding: 18, gap: 18 },
  listingContext: {
    borderRadius: paltaTheme.radius.surface,
    backgroundColor: paltaTheme.color.surface,
    borderWidth: 1,
    borderColor: paltaTheme.color.border,
    padding: 14,
  },
  contextLabel: {
    color: paltaTheme.color.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  listingTitle: {
    marginTop: 5,
    color: paltaTheme.color.textPrimary,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '800',
  },
  sellerLine: {
    marginTop: 5,
    color: paltaTheme.color.textSecondary,
    fontSize: 12,
  },
  sectionTitle: {
    color: paltaTheme.color.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  presetList: { gap: 8 },
  presetCard: {
    minHeight: 48,
    justifyContent: 'center',
    borderRadius: paltaTheme.radius.control,
    borderWidth: 1,
    borderColor: paltaTheme.color.border,
    backgroundColor: paltaTheme.color.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  presetCardSelected: {
    borderColor: paltaTheme.color.brandPrimary,
    backgroundColor: paltaTheme.color.brandSoft,
  },
  presetText: {
    color: paltaTheme.color.textSecondary,
    fontSize: 14,
    lineHeight: 19,
  },
  presetTextSelected: {
    color: paltaTheme.color.brandPrimary,
    fontWeight: '700',
  },
  coreBoundaryBox: {
    borderRadius: paltaTheme.radius.surface,
    backgroundColor: paltaTheme.color.surfaceMuted,
    padding: 14,
  },
  coreBoundaryTitle: {
    color: paltaTheme.color.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  coreBoundaryBody: {
    marginTop: 4,
    color: paltaTheme.color.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  readyBox: {
    borderRadius: paltaTheme.radius.surface,
    borderWidth: 1,
    borderColor: paltaTheme.color.brandPrimary,
    backgroundColor: paltaTheme.color.surface,
    padding: 14,
  },
  readyTitle: {
    color: paltaTheme.color.brandPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  readyBody: {
    marginTop: 4,
    color: paltaTheme.color.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  pendingText: {
    marginTop: 8,
    color: paltaTheme.color.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: paltaTheme.radius.control,
    backgroundColor: paltaTheme.color.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primaryButtonPressed: { opacity: 0.84 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  title: {
    color: paltaTheme.color.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  centerBody: {
    color: paltaTheme.color.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
