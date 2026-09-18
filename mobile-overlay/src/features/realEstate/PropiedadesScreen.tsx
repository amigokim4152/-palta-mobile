import { useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { MapFeature } from '../../../../src/adapters/mapCore';
import type {
  PropertyTransactionType,
  PropertyType,
} from '../../../../src/realEstate/realEstateContracts';
import {
  REAL_ESTATE_PROPERTY_TYPE_LABELS,
  REAL_ESTATE_TRANSACTION_LABELS,
  type RealEstateDiscoveryView,
} from '../../../../src/realEstate/realEstateDiscovery';
import type { RealEstateListingQuery } from '../../../../src/realEstate/realEstateRepository';
import { FilterChip } from '../../components/common/FilterChip';
import { NeighborhoodMap } from '../../components/map/NeighborhoodMap';
import { mobileRuntime } from '../../services/paltaClient';
import { paltaTheme } from '../../theme/paltaTheme';
import { PropertyListingCard } from './PropertyListingCard';
import { RealEstateAccountActions } from './RealEstateAccountActions';
import { RealEstateHomeSections } from './RealEstateHomeSections';
import { SaveRealEstateSearchButton } from './SaveRealEstateSearchButton';
import { useRealEstateListings } from './useRealEstateListings';
import { useSavedRealEstateListings } from './useSavedRealEstateListings';

const SANTIAGO_CENTER = { latitude: -33.4489, longitude: -70.6693 } as const;
const PROPERTY_TYPE_ORDER: readonly PropertyType[] = [
  'apartment',
  'house',
  'room',
  'office',
  'commercial',
  'land',
  'parcel',
  'warehouse',
];

const AREA_PRESETS = [undefined, 50, 80, 120] as const;
const BEDROOM_PRESETS = [undefined, 1, 2, 3] as const;
const BATHROOM_PRESETS = [undefined, 1, 2, 3] as const;
const PARKING_PRESETS = [undefined, 1, 2] as const;

const PRICE_PRESETS = {
  rent: [
    { label: 'Precio' },
    { label: '≤ $800 mil', maxPriceClp: 800000 },
    { label: '≤ $1,2 M', maxPriceClp: 1200000 },
    { label: '≤ $1,8 M', maxPriceClp: 1800000 },
  ],
  sale: [
    { label: 'Precio' },
    { label: '≤ UF 6.000', maxPriceUf: 6000 },
    { label: '≤ UF 9.000', maxPriceUf: 9000 },
    { label: '≤ UF 15.000', maxPriceUf: 15000 },
  ],
  temporary_rent: [
    { label: 'Precio' },
    { label: '≤ $450 mil', maxPriceClp: 450000 },
    { label: '≤ $750 mil', maxPriceClp: 750000 },
    { label: '≤ $1,2 M', maxPriceClp: 1200000 },
  ],
} as const;

function nextPreset<T>(values: readonly T[], current: T): T {
  const index = values.findIndex((value) => value === current);
  return values[(index + 1) % values.length] ?? values[0]!;
}

function ViewToggle({ value, onChange }: { value: RealEstateDiscoveryView; onChange: (value: RealEstateDiscoveryView) => void }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        padding: 3,
        borderRadius: paltaTheme.radius.pill,
        backgroundColor: paltaTheme.color.surfaceMuted,
      }}
    >
      {(['list', 'map'] as const).map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option)}
            style={{
              minHeight: 38,
              justifyContent: 'center',
              paddingHorizontal: 14,
              borderRadius: paltaTheme.radius.pill,
              backgroundColor: selected ? paltaTheme.color.surface : 'transparent',
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '800', color: selected ? paltaTheme.color.textPrimary : paltaTheme.color.textMuted }}>
              {option === 'list' ? 'Lista' : 'Mapa'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SearchBar({ value, onChangeText }: { value: string; onChangeText: (value: string) => void }) {
  return (
    <View
      style={{
        minHeight: 50,
        flexDirection: 'row',
        alignItems: 'center',
        gap: paltaTheme.spacing.xs,
        paddingHorizontal: paltaTheme.spacing.md,
        borderRadius: paltaTheme.radius.prominent,
        borderWidth: 1,
        borderColor: paltaTheme.color.divider,
        backgroundColor: paltaTheme.color.surface,
      }}
    >
      <Text style={{ fontSize: 18, color: paltaTheme.color.textMuted }}>⌕</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Comuna, barrio, edificio o dirección"
        placeholderTextColor={paltaTheme.color.textMuted}
        style={{ flex: 1, minHeight: 46, fontSize: 15, color: paltaTheme.color.textPrimary }}
      />
    </View>
  );
}

function DiscoveryControls({
  transactionType,
  onTransactionTypeChange,
  propertyType,
  setPropertyType,
  ownerDirectOnly,
  setOwnerDirectOnly,
  pricePresetIndex,
  setPricePresetIndex,
  minArea,
  setMinArea,
  minBedrooms,
  setMinBedrooms,
  minBathrooms,
  setMinBathrooms,
  minParking,
  setMinParking,
}: {
  transactionType: PropertyTransactionType;
  onTransactionTypeChange: (value: PropertyTransactionType) => void;
  propertyType?: PropertyType;
  setPropertyType: (value: PropertyType | undefined) => void;
  ownerDirectOnly: boolean;
  setOwnerDirectOnly: (value: boolean) => void;
  pricePresetIndex: number;
  setPricePresetIndex: (value: number) => void;
  minArea: number | undefined;
  setMinArea: (value: number | undefined) => void;
  minBedrooms: number | undefined;
  setMinBedrooms: (value: number | undefined) => void;
  minBathrooms: number | undefined;
  setMinBathrooms: (value: number | undefined) => void;
  minParking: number | undefined;
  setMinParking: (value: number | undefined) => void;
}) {
  const pricePresets = PRICE_PRESETS[transactionType];
  const pricePreset = pricePresets[pricePresetIndex] ?? pricePresets[0];

  return (
    <View style={{ gap: paltaTheme.spacing.xs }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: paltaTheme.spacing.xs }}
      >
        {(['rent', 'sale', 'temporary_rent'] as const).map((transaction) => (
          <FilterChip
            key={transaction}
            label={REAL_ESTATE_TRANSACTION_LABELS[transaction]}
            selected={transactionType === transaction}
            onPress={() => onTransactionTypeChange(transaction)}
          />
        ))}
        <FilterChip label="Dueño directo" selected={ownerDirectOnly} onPress={() => setOwnerDirectOnly(!ownerDirectOnly)} />
        <FilterChip
          label={pricePreset.label}
          selected={pricePresetIndex > 0}
          onPress={() => setPricePresetIndex((pricePresetIndex + 1) % pricePresets.length)}
        />
        <FilterChip
          label={minArea ? `${minArea}+ m²` : 'Superficie'}
          selected={minArea !== undefined}
          onPress={() => setMinArea(nextPreset(AREA_PRESETS, minArea))}
        />
        <FilterChip
          label={minBedrooms ? `${minBedrooms}+ dorm.` : 'Dormitorios'}
          selected={minBedrooms !== undefined}
          onPress={() => setMinBedrooms(nextPreset(BEDROOM_PRESETS, minBedrooms))}
        />
        <FilterChip
          label={minBathrooms ? `${minBathrooms}+ baños` : 'Baños'}
          selected={minBathrooms !== undefined}
          onPress={() => setMinBathrooms(nextPreset(BATHROOM_PRESETS, minBathrooms))}
        />
        <FilterChip
          label={minParking ? `${minParking}+ estac.` : 'Estacionamiento'}
          selected={minParking !== undefined}
          onPress={() => setMinParking(nextPreset(PARKING_PRESETS, minParking))}
        />
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: paltaTheme.spacing.xs }}
      >
        <FilterChip label="Todos" selected={!propertyType} onPress={() => setPropertyType(undefined)} />
        {PROPERTY_TYPE_ORDER.map((type) => (
          <FilterChip
            key={type}
            label={REAL_ESTATE_PROPERTY_TYPE_LABELS[type]}
            selected={propertyType === type}
            onPress={() => setPropertyType(propertyType === type ? undefined : type)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

export function PropiedadesScreen({ initialView = 'list' }: { initialView?: RealEstateDiscoveryView }) {
  const params = useLocalSearchParams<{ source?: string; businessId?: string }>();
  const [view, setView] = useState<RealEstateDiscoveryView>(initialView);
  const [query, setQuery] = useState('');
  const [transactionType, setTransactionType] = useState<PropertyTransactionType>('rent');
  const [propertyType, setPropertyType] = useState<PropertyType | undefined>();
  const [ownerDirectOnly, setOwnerDirectOnly] = useState(false);
  const [pricePresetIndex, setPricePresetIndex] = useState(0);
  const [minArea, setMinArea] = useState<number | undefined>();
  const [minBedrooms, setMinBedrooms] = useState<number | undefined>();
  const [minBathrooms, setMinBathrooms] = useState<number | undefined>();
  const [minParking, setMinParking] = useState<number | undefined>();
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const { isSaved, toggleSaved } = useSavedRealEstateListings();

  const repositoryQuery = useMemo<RealEstateListingQuery>(() => {
    const pricePreset = PRICE_PRESETS[transactionType][pricePresetIndex] ?? PRICE_PRESETS[transactionType][0];
    return {
      text: query,
      businessId: params.businessId,
      transactionType,
      propertyType,
      publisherType: ownerDirectOnly ? 'owner_direct' : undefined,
      ...('maxPriceClp' in pricePreset && pricePreset.maxPriceClp !== undefined ? { maxPriceClp: pricePreset.maxPriceClp } : {}),
      ...('maxPriceUf' in pricePreset && pricePreset.maxPriceUf !== undefined ? { maxPriceUf: pricePreset.maxPriceUf } : {}),
      minUsableAreaM2: minArea,
      minBedrooms,
      minBathrooms,
      minParkingSpaces: minParking,
    };
  }, [minArea, minBathrooms, minBedrooms, minParking, ownerDirectOnly, params.businessId, pricePresetIndex, propertyType, query, transactionType]);

  const { listings, loading, error } = useRealEstateListings(repositoryQuery);

  const mapFeatures = useMemo<MapFeature[]>(
    () =>
      listings.flatMap((item) => {
        const point = item.property.address.point;
        if (!point) return [];
        return [
          {
            id: item.listing.id,
            entityType: 'property_listing',
            coordinate: point,
            title: item.sector,
            categoryKey: item.property.type,
            selected: item.listing.id === selectedListingId,
          },
        ];
      }),
    [listings, selectedListingId],
  );

  const selectedListing = listings.find((item) => item.listing.id === selectedListingId) ?? listings[0];

  function openListing(listingId: string) {
    router.push(`/propiedades/listing/${encodeURIComponent(listingId)}`);
  }

  function changeTransactionType(value: PropertyTransactionType) {
    setTransactionType(value);
    setPricePresetIndex(0);
    setSelectedListingId(null);
  }

  const controls = (
    <View style={{ gap: paltaTheme.spacing.sm }}>
      <SearchBar value={query} onChangeText={setQuery} />
      <DiscoveryControls
        transactionType={transactionType}
        onTransactionTypeChange={changeTransactionType}
        propertyType={propertyType}
        setPropertyType={setPropertyType}
        ownerDirectOnly={ownerDirectOnly}
        setOwnerDirectOnly={setOwnerDirectOnly}
        pricePresetIndex={pricePresetIndex}
        setPricePresetIndex={setPricePresetIndex}
        minArea={minArea}
        setMinArea={setMinArea}
        minBedrooms={minBedrooms}
        setMinBedrooms={setMinBedrooms}
        minBathrooms={minBathrooms}
        setMinBathrooms={setMinBathrooms}
        minParking={minParking}
        setMinParking={setMinParking}
      />
    </View>
  );

  if (view === 'map') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.surfaceMuted }}>
        <View style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>
            {mobileRuntime.status === 'ready' && mobileRuntime.mapStyleUrl ? (
              <NeighborhoodMap
                mapStyle={mobileRuntime.mapStyleUrl}
                features={mapFeatures}
                initialCenter={selectedListing?.property.address.point ?? SANTIAGO_CENTER}
                initialZoom={12}
                onSelectEntity={setSelectedListingId}
              />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: paltaTheme.color.surfaceMuted }}>
                <Text style={{ fontWeight: '800', color: paltaTheme.color.textPrimary }}>Mapa no disponible</Text>
              </View>
            )}
          </View>

          <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: paltaTheme.spacing.sm, gap: paltaTheme.spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: paltaTheme.spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 24, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Propiedades</Text>
                <Text style={{ marginTop: 2, fontSize: 12, color: paltaTheme.color.textMuted }}>Busca por zona y compara en el mapa</Text>
              </View>
              <ViewToggle value={view} onChange={setView} />
            </View>
            {controls}
          </View>

          <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: paltaTheme.spacing.sm }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: paltaTheme.spacing.sm, paddingHorizontal: paltaTheme.spacing.sm }}
            >
              {listings.map((item) => (
                <View key={item.listing.id} style={{ width: 250 }}>
                  <PropertyListingCard
                    item={item}
                    compact
                    selected={item.listing.id === selectedListing?.listing.id}
                    saved={isSaved(item.listing.id)}
                    onToggleSaved={() => void toggleSaved(item.listing.id)}
                    onPress={() => openListing(item.listing.id)}
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
      <ScrollView contentContainerStyle={{ padding: paltaTheme.spacing.md, paddingBottom: 40, gap: paltaTheme.spacing.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: paltaTheme.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 28, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Propiedades</Text>
            <Text style={{ marginTop: 3, fontSize: 13, color: paltaTheme.color.textMuted }}>
              {params.businessId ? 'Propiedades de este negocio' : 'Encuentra un lugar para vivir o trabajar cerca de ti'}
            </Text>
          </View>
          <ViewToggle value={view} onChange={setView} />
        </View>

        {!params.businessId ? <RealEstateAccountActions /> : null}

        {controls}

        {!params.businessId ? (
          <View style={{ alignItems: 'flex-start' }}>
            <SaveRealEstateSearchButton query={repositoryQuery} />
          </View>
        ) : null}

        {!params.businessId && !query ? <RealEstateHomeSections /> : null}

        <View style={{ gap: paltaTheme.spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: paltaTheme.color.textPrimary }}>
              {query ? 'Resultados' : params.businessId ? 'Propiedades publicadas' : 'Propiedades para ti'}
            </Text>
            <Text style={{ fontSize: 12, color: paltaTheme.color.textMuted }}>
              {loading ? 'Buscando…' : `${listings.length} ${listings.length === 1 ? 'propiedad' : 'propiedades'}`}
            </Text>
          </View>

          {error ? (
            <View
              style={{
                padding: paltaTheme.spacing.md,
                borderRadius: paltaTheme.radius.surface,
                backgroundColor: paltaTheme.color.surface,
                borderWidth: 1,
                borderColor: paltaTheme.color.divider,
              }}
            >
              <Text style={{ fontWeight: '800', color: paltaTheme.color.textPrimary }}>No pudimos cargar las propiedades</Text>
              <Text style={{ marginTop: 5, color: paltaTheme.color.textMuted }}>{error}</Text>
            </View>
          ) : null}

          {!loading && !error && listings.length ? (
            <View style={{ gap: paltaTheme.spacing.sm }}>
              {listings.map((item) => (
                <PropertyListingCard
                  key={item.listing.id}
                  item={item}
                  saved={isSaved(item.listing.id)}
                  onToggleSaved={() => void toggleSaved(item.listing.id)}
                  onPress={() => openListing(item.listing.id)}
                />
              ))}
            </View>
          ) : null}

          {!loading && !error && !listings.length ? (
            <View
              style={{
                padding: paltaTheme.spacing.xl,
                borderRadius: paltaTheme.radius.surface,
                backgroundColor: paltaTheme.color.surface,
                borderWidth: 1,
                borderColor: paltaTheme.color.divider,
              }}
            >
              <Text style={{ fontSize: 17, fontWeight: '800', color: paltaTheme.color.textPrimary }}>No encontramos propiedades con estos filtros</Text>
              <Text style={{ marginTop: 6, color: paltaTheme.color.textSecondary }}>Prueba otra zona, tipo de propiedad o rango de precio.</Text>
            </View>
          ) : null}
        </View>

        <Text style={{ fontSize: 11, lineHeight: 16, color: paltaTheme.color.textMuted }}>
          Vista en desarrollo: los bloques marcados como demo serán reemplazados por fuentes reales verificadas sin cambiar la navegación del producto.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
