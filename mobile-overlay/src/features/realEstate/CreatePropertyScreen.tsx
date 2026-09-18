import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import type {
  ListingPublisherType,
  PropertyTransactionType,
  PropertyType,
} from '../../../../src/realEstate/realEstateContracts';
import {
  REAL_ESTATE_PROPERTY_TYPE_LABELS,
  REAL_ESTATE_PUBLISHER_LABELS,
  REAL_ESTATE_TRANSACTION_LABELS,
} from '../../../../src/realEstate/realEstateDiscovery';
import type { RealEstateMediaRef } from '../../../../src/realEstate/realEstateMedia';
import {
  createRealEstateDraft,
  type RealEstateContactPreference,
  type RealEstateListingDraft,
  type RealEstateListingDraftInput,
  validateRealEstateDraft,
} from '../../../../src/realEstate/realEstatePublishing';
import { ExpoSQLiteRealEstateDraftStore } from '../../adapters/expoSqliteRealEstateDraftStore';
import { FilterChip } from '../../components/common/FilterChip';
import { PaltaButton } from '../../components/common/PaltaButton';
import { paltaTheme } from '../../theme/paltaTheme';
import { RealEstateDraftMediaPicker } from './RealEstateDraftMediaPicker';

const PROPERTY_TYPES: readonly PropertyType[] = [
  'apartment', 'house', 'room', 'office', 'commercial', 'land', 'parcel', 'warehouse',
];

function numberValue(value: string): number | undefined {
  const normalized = value.trim().replace(/\./g, '').replace(',', '.');
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function fieldValue(value: number | undefined): string {
  return value === undefined ? '' : String(value);
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
  multiline?: boolean;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 13, fontWeight: '800', color: paltaTheme.color.textSecondary }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={paltaTheme.color.textMuted}
        keyboardType={keyboardType}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={{
          minHeight: multiline ? 110 : 48,
          paddingHorizontal: paltaTheme.spacing.md,
          paddingVertical: multiline ? paltaTheme.spacing.sm : 0,
          borderRadius: paltaTheme.radius.control,
          borderWidth: 1,
          borderColor: paltaTheme.color.border,
          backgroundColor: paltaTheme.color.surface,
          color: paltaTheme.color.textPrimary,
          fontSize: 15,
        }}
      />
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: paltaTheme.spacing.sm }}>
      <Text style={{ fontSize: 18, fontWeight: '900', color: paltaTheme.color.textPrimary }}>{title}</Text>
      <View
        style={{
          padding: paltaTheme.spacing.md,
          gap: paltaTheme.spacing.md,
          borderRadius: paltaTheme.radius.surface,
          backgroundColor: paltaTheme.color.surface,
          borderWidth: 1,
          borderColor: paltaTheme.color.divider,
        }}
      >
        {children}
      </View>
    </View>
  );
}

export function CreatePropertyScreen() {
  const params = useLocalSearchParams<{ draftId?: string }>();
  const draftId = typeof params.draftId === 'string' ? params.draftId : undefined;
  const [workingDraftId] = useState(
    () => draftId ?? `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  const db = useSQLiteContext();
  const draftStore = useMemo(() => new ExpoSQLiteRealEstateDraftStore(db), [db]);
  const [editingDraft, setEditingDraft] = useState<RealEstateListingDraft | null>(null);
  const [loadingDraft, setLoadingDraft] = useState(Boolean(draftId));
  const [transactionType, setTransactionType] = useState<PropertyTransactionType>('rent');
  const [propertyType, setPropertyType] = useState<PropertyType>('apartment');
  const [publisherType, setPublisherType] = useState<ListingPublisherType>('owner_direct');
  const [comuna, setComuna] = useState('');
  const [sectorOrAddress, setSectorOrAddress] = useState('');
  const [price, setPrice] = useState('');
  const [commonExpenses, setCommonExpenses] = useState('');
  const [usableArea, setUsableArea] = useState('');
  const [totalArea, setTotalArea] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [parking, setParking] = useState('');
  const [description, setDescription] = useState('');
  const [contactPreference, setContactPreference] = useState<RealEstateContactPreference>('palta');
  const [mediaItems, setMediaItems] = useState<readonly RealEstateMediaRef[]>([]);
  const [legacyPhotoCount, setLegacyPhotoCount] = useState(0);
  const [exactAddressPrivate, setExactAddressPrivate] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!draftId) {
      setEditingDraft(null);
      setLoadingDraft(false);
      return () => {
        active = false;
      };
    }

    setLoadingDraft(true);
    void draftStore.getDraft(draftId)
      .then((draft) => {
        if (!active) return;
        if (!draft) {
          setValidationMessage('No encontramos este borrador. Puedes crear una publicación nueva.');
          return;
        }
        setEditingDraft(draft);
        setTransactionType(draft.transactionType);
        setPropertyType(draft.propertyType);
        setPublisherType(draft.publisherType);
        setComuna(draft.comuna);
        setSectorOrAddress(draft.sectorOrAddress);
        setPrice(fieldValue(draft.transactionType === 'sale' ? draft.priceUf : draft.priceClp));
        setCommonExpenses(fieldValue(draft.commonExpensesClp));
        setUsableArea(fieldValue(draft.usableAreaM2));
        setTotalArea(fieldValue(draft.totalAreaM2));
        setBedrooms(fieldValue(draft.bedrooms));
        setBathrooms(fieldValue(draft.bathrooms));
        setParking(fieldValue(draft.parkingSpaces));
        setDescription(draft.description ?? '');
        setContactPreference(draft.contactPreference);
        setMediaItems(draft.media ?? []);
        setLegacyPhotoCount(draft.media ? 0 : draft.photoCount);
        setExactAddressPrivate(draft.exactAddressPrivate);
      })
      .finally(() => {
        if (active) setLoadingDraft(false);
      });

    return () => {
      active = false;
    };
  }, [draftId, draftStore]);

  function updateMedia(items: readonly RealEstateMediaRef[]) {
    setMediaItems(items);
    setLegacyPhotoCount(0);
    setValidationMessage(null);
  }

  function buildInput(): RealEstateListingDraftInput {
    const numericPrice = numberValue(price);
    return {
      transactionType,
      propertyType,
      publisherType,
      comuna,
      sectorOrAddress,
      ...(transactionType === 'sale'
        ? { priceUf: numericPrice }
        : { priceClp: numericPrice }),
      commonExpensesClp: numberValue(commonExpenses),
      usableAreaM2: numberValue(usableArea),
      totalAreaM2: numberValue(totalArea),
      bedrooms: numberValue(bedrooms),
      bathrooms: numberValue(bathrooms),
      parkingSpaces: numberValue(parking),
      description: description.trim() || undefined,
      contactPreference,
      photoCount: mediaItems.length,
      media: mediaItems,
      exactAddressPrivate,
    };
  }

  async function saveDraft() {
    setSaving(true);
    try {
      const input = buildInput();
      const errors = validateRealEstateDraft(input);
      const draft = createRealEstateDraft(input, {
        id: editingDraft?.id ?? workingDraftId,
        ...(editingDraft?.createdAt ? { createdAt: editingDraft.createdAt } : {}),
      });
      await draftStore.saveDraft(draft);
      setValidationMessage(
        errors.length
          ? `Borrador guardado. Falta completar: ${errors.map((error) => error.message).join(' ')}`
          : 'Borrador completo y listo para revisión.',
      );
      router.replace('/propiedades/mine');
    } finally {
      setSaving(false);
    }
  }

  if (loadingDraft) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: paltaTheme.color.textSecondary }}>Cargando borrador…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: paltaTheme.spacing.md,
          paddingBottom: 56,
          gap: paltaTheme.spacing.xl,
        }}
      >
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 28, fontWeight: '900', color: paltaTheme.color.textPrimary }}>
            {editingDraft ? 'Editar propiedad' : 'Publicar propiedad'}
          </Text>
          <Text style={{ fontSize: 13, lineHeight: 19, color: paltaTheme.color.textMuted }}>
            {editingDraft
              ? 'Continúa tu borrador. Los datos y fotos cargadas permanecen vinculados al mismo borrador.'
              : 'Completa los datos y agrega fotos. El borrador queda guardado en el dispositivo mientras Palta prepara la publicación y verificación.'}
          </Text>
        </View>

        <Section title="Operación">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: paltaTheme.spacing.xs }}>
            {(['rent', 'sale', 'temporary_rent'] as const).map((type) => (
              <FilterChip
                key={type}
                label={REAL_ESTATE_TRANSACTION_LABELS[type]}
                selected={transactionType === type}
                onPress={() => {
                  setTransactionType(type);
                  setPrice('');
                }}
              />
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: paltaTheme.spacing.xs }}>
            {PROPERTY_TYPES.map((type) => (
              <FilterChip
                key={type}
                label={REAL_ESTATE_PROPERTY_TYPE_LABELS[type]}
                selected={propertyType === type}
                onPress={() => setPropertyType(type)}
              />
            ))}
          </View>
        </Section>

        <Section title="Quién publica">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: paltaTheme.spacing.xs }}>
            {(['owner_direct', 'broker', 'real_estate_business'] as const).map((type) => (
              <FilterChip
                key={type}
                label={REAL_ESTATE_PUBLISHER_LABELS[type]}
                selected={publisherType === type}
                onPress={() => setPublisherType(type)}
              />
            ))}
          </View>
          {publisherType !== 'owner_direct' ? (
            <Text style={{ fontSize: 12, lineHeight: 18, color: paltaTheme.color.textMuted }}>
              Corredor e Inmobiliaria se vincularán a un Business Profile verificado de Palta antes de publicar.
            </Text>
          ) : null}
        </Section>

        <Section title="Ubicación">
          <FormField label="Comuna" value={comuna} onChangeText={setComuna} placeholder="Ej. Providencia" />
          <FormField
            label="Sector o dirección"
            value={sectorOrAddress}
            onChangeText={setSectorOrAddress}
            placeholder="Ej. Pedro de Valdivia / dirección exacta"
          />
          <FilterChip
            label="Ocultar dirección exacta al público"
            selected={exactAddressPrivate}
            onPress={() => setExactAddressPrivate(!exactAddressPrivate)}
          />
          <Text style={{ fontSize: 12, lineHeight: 18, color: paltaTheme.color.textMuted }}>
            Palta puede usar la ubicación precisa para mapa y validación sin mostrarla públicamente hasta que corresponda.
          </Text>
        </Section>

        <Section title="Precio y gastos">
          <FormField
            label={transactionType === 'sale' ? 'Precio en UF' : 'Precio mensual en CLP'}
            value={price}
            onChangeText={setPrice}
            placeholder={transactionType === 'sale' ? 'Ej. 7450' : 'Ej. 780000'}
            keyboardType="numeric"
          />
          <FormField
            label="Gastos comunes CLP"
            value={commonExpenses}
            onChangeText={setCommonExpenses}
            placeholder="Opcional"
            keyboardType="numeric"
          />
        </Section>

        <Section title="Características">
          <View style={{ flexDirection: 'row', gap: paltaTheme.spacing.sm }}>
            <View style={{ flex: 1 }}>
              <FormField label="m² útiles" value={usableArea} onChangeText={setUsableArea} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <FormField label="m² totales" value={totalArea} onChangeText={setTotalArea} keyboardType="numeric" />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: paltaTheme.spacing.sm }}>
            <View style={{ flex: 1 }}>
              <FormField label="Dormitorios" value={bedrooms} onChangeText={setBedrooms} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <FormField label="Baños" value={bathrooms} onChangeText={setBathrooms} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <FormField label="Estac." value={parking} onChangeText={setParking} keyboardType="numeric" />
            </View>
          </View>
        </Section>

        <Section title="Fotos y descripción">
          {legacyPhotoCount > 0 ? (
            <View
              style={{
                padding: paltaTheme.spacing.sm,
                borderRadius: paltaTheme.radius.control,
                backgroundColor: paltaTheme.color.surfaceMuted,
              }}
            >
              <Text style={{ fontSize: 12, lineHeight: 18, color: paltaTheme.color.textSecondary }}>
                Este borrador antiguo marcaba {legacyPhotoCount} foto(s) de demostración. Vuelve a elegir las fotos reales para cargarlas de forma segura.
              </Text>
            </View>
          ) : null}
          <RealEstateDraftMediaPicker
            draftId={workingDraftId}
            items={mediaItems}
            onChange={updateMedia}
          />
          <FormField
            label="Descripción"
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder="Describe distribución, estado, orientación, equipamiento y condiciones relevantes."
          />
        </Section>

        <Section title="Contacto">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: paltaTheme.spacing.xs }}>
            {([
              ['palta', 'Palta'],
              ['whatsapp', 'WhatsApp'],
              ['phone', 'Teléfono'],
            ] as const).map(([value, label]) => (
              <FilterChip
                key={value}
                label={label}
                selected={contactPreference === value}
                onPress={() => setContactPreference(value)}
              />
            ))}
          </View>
        </Section>

        {validationMessage ? (
          <Text style={{ fontSize: 12, lineHeight: 18, color: paltaTheme.color.textSecondary }}>
            {validationMessage}
          </Text>
        ) : null}

        <PaltaButton
          label={editingDraft ? 'Guardar cambios' : 'Guardar borrador'}
          loading={saving}
          onPress={() => void saveDraft()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
