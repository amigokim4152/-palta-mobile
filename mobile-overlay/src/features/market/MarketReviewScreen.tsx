import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { paltaTheme } from '../../theme/paltaTheme';
import { marketPreviewListings } from './marketPreviewData';

const reviewTags = [
  'Buena comunicación',
  'Puntual',
  'Amable',
  'Producto como se describió',
  'Coordinación fácil',
] as const;

export function MarketReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [selected, setSelected] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const listing = __DEV__
    ? marketPreviewListings.find((item) => item.id === id)
    : undefined;

  if (!listing) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.title}>No encontramos esta transacción</Text>
          <Pressable style={styles.primaryButton} onPress={() => router.back()}>
            <Text style={styles.primaryButtonText}>Volver</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  function toggleTag(tag: string) {
    setSelected((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag],
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
          <Text style={styles.contextTitle}>{listing.title}</Text>
          <Text style={styles.contextMeta}>{listing.comuna}</Text>
        </View>

        {submitted ? (
          <View style={styles.successCard}>
            <Text style={styles.successTitle}>Reseña preparada</Text>
            <Text style={styles.successBody}>
              Esta vista previa no publica datos reales. En producción la reseña se guardará después de una transacción completada.
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
                Elige lo que corresponda. La confianza se construye con señales concretas, no con comentarios públicos innecesarios.
              </Text>
            </View>

            <View style={styles.tagWrap}>
              {reviewTags.map((tag) => {
                const active = selected.includes(tag);
                return (
                  <Pressable
                    key={tag}
                    onPress={() => toggleTag(tag)}
                    style={[styles.tag, active && styles.tagActive]}
                  >
                    <Text style={[styles.tagText, active && styles.tagTextActive]}>
                      {active ? '✓ ' : ''}{tag}
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

            <Pressable
              disabled={selected.length === 0}
              onPress={() => setSubmitted(true)}
              style={[
                styles.primaryButton,
                selected.length === 0 && styles.primaryButtonDisabled,
              ]}
            >
              <Text style={styles.primaryButtonText}>Enviar reseña</Text>
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
});
