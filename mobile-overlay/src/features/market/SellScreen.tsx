import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  marketCategories,
  marketTradeModes,
  type MarketCategoryKey,
  type MarketTradeMode,
} from '../../../../src/market/marketCatalog';
import { assertMarketListingDraft } from '../../../../src/market/marketPersistenceContract';
import { paltaTheme } from '../../theme/paltaTheme';
import { getMarketRuntime } from './marketRuntime';

type SellCategory = Exclude<MarketCategoryKey, 'all'>;

export function SellScreen() {
  const runtime = useMemo(() => getMarketRuntime(), []);
  const [category, setCategory] = useState<SellCategory>('home');
  const [tradeMode, setTradeMode] = useState<MarketTradeMode>('sale');
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [mediaAssetIds, setMediaAssetIds] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [selectingMedia, setSelectingMedia] = useState(false);
  const [formError, setFormError] = useState<string | undefined>();

  const categoryChoices = marketCategories.filter(
    (item): item is { key: SellCategory; label: string } => item.key !== 'all',
  );
  const publicArea =
    runtime.publicArea ??
    (runtime.mode === 'development_preview'
      ? { comunaName: 'Vitacura', comunaCode: '13132' }
      : undefined);

  async function addPhoto() {
    if (mediaAssetIds.length >= 10 || selectingMedia) return;

    if (runtime.selectListingMedia) {
      setSelectingMedia(true);
      setFormError(undefined);
      try {
        const selected = await runtime.selectListingMedia({
          currentAssetIds: mediaAssetIds,
          maxAssets: 10,
        });
        setMediaAssetIds(selected.slice(0, 10));
      } catch {
        setFormError('No pudimos agregar las fotos. Intenta nuevamente.');
      } finally {
        setSelectingMedia(false);
      }
      return;
    }

    if (runtime.mode === 'development_preview') {
      setMediaAssetIds((current) => [
        ...current,
        `preview-upload:${current.length + 1}`,
      ]);
      setFormError(undefined);
      return;
    }

    setFormError(
      'La carga de fotos requiere la conexión con Media Core antes de publicar.',
    );
  }

  async function publish() {
    if (!runtime.mutation || publishing) {
      setFormError(
        runtime.unavailableReason ?? 'Mercado todavía no puede publicar en este runtime.',
      );
      return;
    }
    if (!publicArea) {
      setFormError(
        'Selecciona una comuna de entrega antes de publicar. Mercado no guarda tu dirección exacta.',
      );
      return;
    }

    const normalizedPrice = price.replace(/[^0-9]/g, '');
    const parsedPrice = normalizedPrice ? Number.parseInt(normalizedPrice, 10) : undefined;

    try {
      assertMarketListingDraft({
        title,
        description,
        tradeMode,
        ...(typeof parsedPrice === 'number' ? { priceClp: parsedPrice } : {}),
        mediaAssetIds,
      });
    } catch {
      setFormError(
        tradeMode === 'sale'
          ? 'Agrega al menos una foto, un título y un precio válido.'
          : 'Agrega al menos una foto y un título válido.',
      );
      return;
    }

    setPublishing(true);
    setFormError(undefined);
    try {
      await runtime.mutation.createListing({
        title: title.trim(),
        description: description.trim(),
        category,
        tradeMode,
        ...(typeof parsedPrice === 'number' ? { priceClp: parsedPrice } : {}),
        location: publicArea,
        mediaAssetIds,
        publish: true,
      });
      router.replace('/market/my-listings');
    } catch {
      setFormError('No pudimos publicar el artículo. Revisa los datos e intenta nuevamente.');
    } finally {
      setPublishing(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Vender</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {runtime.mode === 'development_preview' ? (
          <View style={styles.previewNotice}>
            <Text style={styles.previewNoticeText}>
              Vista previa: la publicación se guarda sólo durante esta sesión de desarrollo.
            </Text>
          </View>
        ) : null}

        <Pressable onPress={addPhoto} style={styles.photoBox}>
          <Text style={styles.photoPlus}>＋</Text>
          <Text style={styles.photoTitle}>
            {selectingMedia ? 'Agregando…' : 'Agregar fotos'}
          </Text>
          <Text style={styles.photoCaption}>{mediaAssetIds.length} / 10</Text>
        </Pressable>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>¿Qué estás vendiendo?</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Ej. Bicicleta urbana Trek"
            placeholderTextColor={paltaTheme.color.textMuted}
            maxLength={120}
            style={styles.input}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Tipo de publicación</Text>
          <View style={styles.wrapRow}>
            {marketTradeModes.map((mode) => {
              const selected = mode.key === tradeMode;
              return (
                <Pressable
                  key={mode.key}
                  onPress={() => {
                    setTradeMode(mode.key);
                    if (mode.key !== 'sale') setPrice('');
                  }}
                  style={[styles.choiceChip, selected && styles.choiceChipSelected]}
                >
                  <Text
                    style={[
                      styles.choiceChipText,
                      selected && styles.choiceChipTextSelected,
                    ]}
                  >
                    {mode.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {tradeMode === 'sale' ? (
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Precio</Text>
            <View style={styles.priceInputWrap}>
              <Text style={styles.currency}>$</Text>
              <TextInput
                value={price}
                onChangeText={setPrice}
                placeholder="0"
                placeholderTextColor={paltaTheme.color.textMuted}
                keyboardType="number-pad"
                style={styles.priceInput}
              />
              <Text style={styles.currencyCode}>CLP</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Categoría</Text>
          <View style={styles.wrapRow}>
            {categoryChoices.map((item) => {
              const selected = item.key === category;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setCategory(item.key)}
                  style={[styles.choiceChip, selected && styles.choiceChipSelected]}
                >
                  <Text
                    style={[
                      styles.choiceChipText,
                      selected && styles.choiceChipTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Zona de entrega</Text>
          <View style={styles.locationRow}>
            <View style={styles.locationTextBlock}>
              <Text style={styles.locationMain}>
                {publicArea?.comunaName ?? 'Comuna pendiente'}
              </Text>
              <Text style={styles.locationSub}>
                {publicArea
                  ? 'La ubicación exacta no se muestra públicamente'
                  : 'Location Core debe entregar una zona pública antes de publicar'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Descripción</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={4000}
            textAlignVertical="top"
            placeholder="Estado, tiempo de uso, detalles y forma de entrega"
            placeholderTextColor={paltaTheme.color.textMuted}
            style={styles.textArea}
          />
          <Text style={styles.aiHint}>
            Más adelante Palta podrá sugerir título, categoría y precio a partir de las fotos.
          </Text>
        </View>

        {formError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{formError}</Text>
          </View>
        ) : null}

        <Pressable
          disabled={publishing || selectingMedia}
          style={({ pressed }) => [
            styles.publishButton,
            pressed && styles.pressed,
            (publishing || selectingMedia) && styles.publishButtonDisabled,
          ]}
          onPress={publish}
        >
          <Text style={styles.publishText}>
            {publishing ? 'Publicando…' : 'Publicar'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: paltaTheme.color.canvas,
  },
  header: {
    height: 54,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: paltaTheme.color.divider,
    backgroundColor: paltaTheme.color.canvas,
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
    fontWeight: '300',
  },
  headerTitle: {
    color: paltaTheme.color.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  headerSpacer: { width: 44 },
  content: {
    padding: 18,
    paddingBottom: 40,
    gap: 24,
  },
  previewNotice: {
    borderRadius: paltaTheme.radius.surface,
    backgroundColor: paltaTheme.color.brandSoft,
    padding: 12,
  },
  previewNoticeText: {
    color: paltaTheme.color.brandPrimary,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  photoBox: {
    width: 112,
    height: 112,
    borderRadius: paltaTheme.radius.surface,
    borderWidth: 1,
    borderColor: paltaTheme.color.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: paltaTheme.color.surface,
  },
  photoPlus: {
    color: paltaTheme.color.brandPrimary,
    fontSize: 25,
    lineHeight: 26,
  },
  photoTitle: {
    marginTop: 6,
    color: paltaTheme.color.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  photoCaption: {
    marginTop: 2,
    color: paltaTheme.color.textMuted,
    fontSize: 11,
  },
  fieldGroup: { gap: 10 },
  label: {
    color: paltaTheme.color.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  input: {
    height: 50,
    borderRadius: paltaTheme.radius.control,
    borderWidth: 1,
    borderColor: paltaTheme.color.border,
    backgroundColor: paltaTheme.color.surface,
    color: paltaTheme.color.textPrimary,
    fontSize: 16,
    paddingHorizontal: 14,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choiceChip: {
    minHeight: 40,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: paltaTheme.radius.pill,
    borderWidth: 1,
    borderColor: paltaTheme.color.border,
    backgroundColor: paltaTheme.color.surface,
  },
  choiceChipSelected: {
    borderColor: paltaTheme.color.brandPrimary,
    backgroundColor: paltaTheme.color.brandSoft,
  },
  choiceChipText: {
    color: paltaTheme.color.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  choiceChipTextSelected: {
    color: paltaTheme.color.brandPrimary,
    fontWeight: '800',
  },
  priceInputWrap: {
    height: 50,
    borderRadius: paltaTheme.radius.control,
    borderWidth: 1,
    borderColor: paltaTheme.color.border,
    backgroundColor: paltaTheme.color.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  currency: {
    color: paltaTheme.color.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  priceInput: {
    flex: 1,
    marginLeft: 8,
    color: paltaTheme.color.textPrimary,
    fontSize: 17,
    paddingVertical: 0,
  },
  currencyCode: {
    color: paltaTheme.color.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  locationRow: {
    minHeight: 68,
    borderRadius: paltaTheme.radius.control,
    borderWidth: 1,
    borderColor: paltaTheme.color.border,
    backgroundColor: paltaTheme.color.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locationTextBlock: { flex: 1, paddingRight: 8 },
  locationMain: {
    color: paltaTheme.color.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  locationSub: {
    marginTop: 3,
    color: paltaTheme.color.textMuted,
    fontSize: 12,
  },
  textArea: {
    minHeight: 130,
    borderRadius: paltaTheme.radius.control,
    borderWidth: 1,
    borderColor: paltaTheme.color.border,
    backgroundColor: paltaTheme.color.surface,
    color: paltaTheme.color.textPrimary,
    fontSize: 15,
    lineHeight: 21,
    padding: 14,
  },
  aiHint: {
    color: paltaTheme.color.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  errorBox: {
    borderRadius: paltaTheme.radius.control,
    backgroundColor: paltaTheme.color.surfaceMuted,
    padding: 12,
  },
  errorText: {
    color: paltaTheme.color.danger,
    fontSize: 12,
    lineHeight: 17,
  },
  publishButton: {
    minHeight: 54,
    borderRadius: paltaTheme.radius.control,
    backgroundColor: paltaTheme.color.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishButtonDisabled: { opacity: 0.5 },
  publishText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  pressed: { opacity: 0.84 },
});
