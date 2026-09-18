import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {
  MarketReviewTag,
  MarketTransactionRecord,
} from '../../../../src/market/marketPersistenceContract';
import { paltaTheme } from '../../theme/paltaTheme';
import { getMarketRuntime } from './marketRuntime';

const reviewTags: Array<{ key: MarketReviewTag; label: string }> = [
  { key: 'good_communication', label: 'Buena comunicación' },
  { key: 'punctual', label: 'Puntual' },
  { key: 'kind', label: 'Amable' },
  { key: 'as_described', label: 'Producto como se describió' },
  { key: 'easy_coordination', label: 'Coordinación fácil' },
];

export function MarketReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const runtime = useMemo(() => getMarketRuntime(), []);
  const [transaction, setTransaction] = useState<MarketTransactionRecord | null>();
  const [selected, setSelected] = useState<MarketReviewTag[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!id || !runtime.read) {
      setTransaction(null);
      setError(runtime.unavailableReason ?? 'Mercado no está disponible.');
      return;
    }
    let active = true;
    runtime.read
      .listMyTransactions({ limit: 50 })
      .then((page) => {
        if (!active) return;
        const found = page.items.find((item) => item.id === id) ?? null;
        setTransaction(found?.status === 'completed' ? found : null);
        if (!found || found.status !== 'completed') {
          setError('La reseña sólo está disponible después de completar la transacción.');
        }
      })
      .catch(() => {
        if (!active) return;
        setTransaction(null);
        setError('No pudimos cargar esta transacción.');
      });
    return () => {
      active = false;
    };
  }, [id, runtime]);

  function toggleTag(tag: MarketReviewTag) {
    setSelected((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag],
    );
  }

  async function submitReview() {
    if (!transaction || !runtime.mutation || selected.length === 0 || submitting) {
      return;
    }
    setSubmitting(true);
    setError(undefined);
    try {
      await runtime.mutation.createReview({
        transactionId: transaction.id,
        tags: selected,
      });
      setSubmitted(true);
    } catch {
      setError('No pudimos guardar la reseña. Intenta nuevamente.');
    } finally {
      setSubmitting(false);
    }
  }

  if (transaction === undefined) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.title}>Cargando transacción…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!transaction) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.title}>No encontramos una transacción para reseñar</Text>
          {error ? <Text style={styles.centerBody}>{error}</Text> : null}
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
        <Text style={styles.headerTitle}>Reseña de la transacción</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <View style={styles.contextCard}>
          <Text style={styles.contextLabel}>Artículo</Text>
          <Text style={styles.contextTitle}>{transaction.listingSnapshot.title}</Text>
          <Text style={styles.contextMeta}>
            {transaction.listingSnapshot.comunaName}
          </Text>
        </View>

        {submitted ? (
          <View style={styles.successCard}>
            <Text style={styles.successTitle}>Reseña guardada</Text>
            <Text style={styles.successBody}>
              Las señales de confianza quedan vinculadas a una transacción completada, no a comentarios públicos sueltos.
            </Text>
            <Pressable
              onPress={() => router.replace('/market/my-listings')}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryButtonText}>Volver a mis publicaciones</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View>
              <Text style={styles.title}>¿Cómo fue la coordinación?</Text>
              <Text style={styles.subtitle}>
                Elige señales concretas de la experiencia. No es necesario publicar información personal de la otra persona.
              </Text>
            </View>

            <View style={styles.tagWrap}>
              {reviewTags.map((tag) => {
                const active = selected.includes(tag.key);
                return (
                  <Pressable
                    key={tag.key}
                    onPress={() => toggleTag(tag.key)}
                    style={[styles.tag, active && styles.tagActive]}
                  >
                    <Text style={[styles.tagText, active && styles.tagTextActive]}>
                      {active ? '✓ ' : ''}{tag.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.noteBox}>
              <Text style={styles.noteTitle}>Privacidad</Text>
              <Text style={styles.noteBody}>
                No muestres dirección, teléfono ni información sensible de la otra persona en una reseña.
              </Text>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <Pressable
              disabled={selected.length === 0 || submitting || !runtime.mutation}
              onPress={submitReview}
              style={[
                styles.primaryButton,
                (selected.length === 0 || submitting || !runtime.mutation) &&
                  styles.primaryButtonDisabled,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {submitting ? 'Guardando…' : 'Enviar reseña'}
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: paltaTheme.color.canvas },
  header: {
    height: 56,
    paddingHorizontal: 10,
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
  backText: { color: paltaTheme.color.textPrimary, fontSize: 36, lineHeight: 38 },
  headerTitle: {
    color: paltaTheme.color.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  headerSpacer: { width: 44 },
  content: { flex: 1, padding: 18, gap: 20 },
  contextCard: {
    borderRadius: paltaTheme.radius.surface,
    backgroundColor: paltaTheme.color.surfaceMuted,
    padding: 14,
  },
  contextLabel: {
    color: paltaTheme.color.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  contextTitle: {
    marginTop: 4,
    color: paltaTheme.color.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  contextMeta: {
    marginTop: 4,
    color: paltaTheme.color.textSecondary,
    fontSize: 12,
  },
  title: {
    color: paltaTheme.color.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 6,
    color: paltaTheme.color.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  tag: {
    minHeight: 42,
    justifyContent: 'center',
    borderRadius: paltaTheme.radius.pill,
    borderWidth: 1,
    borderColor: paltaTheme.color.border,
    backgroundColor: paltaTheme.color.surface,
    paddingHorizontal: 13,
  },
  tagActive: {
    borderColor: paltaTheme.color.brandPrimary,
    backgroundColor: paltaTheme.color.brandSoft,
  },
  tagText: {
    color: paltaTheme.color.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  tagTextActive: { color: paltaTheme.color.brandPrimary, fontWeight: '800' },
  noteBox: {
    borderRadius: paltaTheme.radius.surface,
    backgroundColor: paltaTheme.color.surfaceMuted,
    padding: 14,
  },
  noteTitle: {
    color: paltaTheme.color.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  noteBody: {
    marginTop: 4,
    color: paltaTheme.color.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  errorText: {
    color: paltaTheme.color.danger,
    fontSize: 12,
    lineHeight: 17,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: paltaTheme.radius.control,
    backgroundColor: paltaTheme.color.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primaryButtonDisabled: { opacity: 0.4 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  successCard: {
    borderRadius: paltaTheme.radius.surface,
    borderWidth: 1,
    borderColor: paltaTheme.color.brandPrimary,
    backgroundColor: paltaTheme.color.surface,
    padding: 18,
    gap: 12,
  },
  successTitle: {
    color: paltaTheme.color.brandPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  successBody: {
    color: paltaTheme.color.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  centerBody: {
    color: paltaTheme.color.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
