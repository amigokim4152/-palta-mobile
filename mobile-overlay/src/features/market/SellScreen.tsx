import { router } from 'expo-router';
import { useState } from 'react';
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
import { paltaTheme } from '../../theme/paltaTheme';

export function SellScreen() {
  const [category, setCategory] = useState<MarketCategoryKey>('home');
  const [tradeMode, setTradeMode] = useState<MarketTradeMode>('sale');
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');

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
        <View style={styles.photoBox}>
          <Text style={styles.photoPlus}>＋</Text>
          <Text style={styles.photoTitle}>Agregar fotos</Text>
          <Text style={styles.photoCaption}>0 / 10</Text>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>¿Qué estás vendiendo?</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Ej. Bicicleta urbana Trek"
            placeholderTextColor={paltaTheme.color.textMuted}
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
                  onPress={() => setTradeMode(mode.key)}
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
            {marketCategories
              .filter((item) => item.key !== 'all')
              .map((item) => {
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
          <Pressable style={styles.locationRow}>
            <View>
              <Text style={styles.locationMain}>Vitacura</Text>
              <Text style={styles.locationSub}>
                La ubicación exacta no se muestra públicamente
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Descripción</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
            placeholder="Estado, tiempo de uso, detalles y forma de entrega"
            placeholderTextColor={paltaTheme.color.textMuted}
            style={styles.textArea}
          />
          <Text style={styles.aiHint}>
            Más adelante Palta podrá sugerir título, categoría y precio a partir de las fotos.
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.publishButton, pressed && styles.pressed]}
          onPress={() => router.back()}
        >
          <Text style={styles.publishText}>Ver vista previa</Text>
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
  headerSpacer: {
    width: 44,
  },
  content: {
    padding: 18,
    paddingBottom: 40,
    gap: 24,
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
  fieldGroup: {
    gap: 10,
  },
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
  chevron: {
    color: paltaTheme.color.textMuted,
    fontSize: 26,
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
  publishButton: {
    minHeight: 54,
    borderRadius: paltaTheme.radius.control,
    backgroundColor: paltaTheme.color.brandPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  publishText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.84,
  },
});
