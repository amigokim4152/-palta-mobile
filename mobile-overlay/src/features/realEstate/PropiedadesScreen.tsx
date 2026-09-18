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
import { FilterChip } from '../../components/common/FilterChip';
import { NeighborhoodMap } from '../../components/map/NeighborhoodMap';
import { mobileRuntime } from '../../services/paltaClient';
import { paltaTheme } from '../../theme/paltaTheme';
import { PropertyListingCard } from './PropertyListingCard';
import { PROPERTY_DEMO_LISTINGS } from './propertyDemoData';
import { RealEstateHomeSections } from './RealEstateHomeSections';

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
  setTransactionType,
  propertyType,
  setPropertyType,
  ownerDirectOnly,
  setOwnerDirectOnly,
}: {
  transactionType: PropertyTransactionType;
  setTransactionType: (value: PropertyTransactionType) => void;
  propertyType?: PropertyType;
  setPropertyType: (value: PropertyType | undefined) => void;
  ownerDirectOnly: boolean;
  setOwnerDirectOnly: (value: boolean) => void;
}) {
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
            onPress={() => setTransactionType(transaction)}
          />
        ))}
        <FilterChip label="Dueño directo" selected={ownerDirectOnly} onPress={() => setOwnerDirectOnly(!ownerDirectOnly)} />
        <FilterChip label="Precio" />
        <FilterChip label="Superficie" />
        <FilterChip label="Dormitorios" />
        <FilterChip label="Baños" />
        <FilterChip label="Estacionamiento" />
        <FilterChip label="Más filtros" />
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
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);

  const listings = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('es-CL');
    return PROPERTY_DEMO_LISTINGS.filter((item) => {
      if (item.listing.transactionType !== transactionType) return false;
      if (propertyType && item.property.type !== propertyType) return false;
      if (ownerDirectOnly && item.publisherType !== 'owner_direct') return false;
      if (params.businessId && item.listing.publisherBusinessId !== params.businessId) return false;
      if (
        normalizedQuery &&
        !`${item.comuna} ${item.sector} ${item.property.address.displayAddress ?? ''}`
          .toLocaleLowerCase('es-CL')
          .includes(normalizedQuery)
      ) {
        return false;
      }
      return true;
    });
  }, [ownerDirectOnly, params.businessId, propertyType, query, transactionType]);

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

  const controls = (
    <View style={{ gap: paltaTheme.spacing.sm }}>
      <SearchBar value={query} onChangeText={setQuery} />
      <DiscoveryControls
        transactionType={transactionType}
        setTransactionType={setTransactionType}
        propertyType={propertyType}
        setPropertyType={setPropertyType}
        ownerDirectOnly={ownerDirectOnly}
        setOwnerDirectOnly={setOwnerDirectOnly}
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

        {controls}

        {!params.businessId && !query ? <RealEstateHomeSections /> : null}

        <View style={{ gap: paltaTheme.spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: paltaTheme.color.textPrimary }}>
              {query ? 'Resultados' : params.businessId ? 'Propiedades publicadas' : 'Propiedades para ti'}
            </Text>
            <Text style={{ fontSize: 12, color: paltaTheme.color.textMuted }}>
              {listings.length} {listings.length === 1 ? 'propiedad' : 'propiedades'}
            </Text>
          </View>

          {listings.length ? (
            <View style={{ gap: paltaTheme.spacing.sm }}>
              {listings.map((item) => (
                <PropertyListingCard key={item.listing.id} item={item} onPress={() => openListing(item.listing.id)} />
              ))}
            </View>
          ) : (
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
              <Text style={{ marginTop: 6, color: paltaTheme.color.textSecondary }}>Prueba otra zona, tipo de propiedad o forma de publicación.</Text>
            </View>
          )}
        </View>

        <Text style={{ fontSize: 11, lineHeight: 16, color: paltaTheme.color.textMuted }}>
          Vista en desarrollo: los bloques marcados como demo serán reemplazados por fuentes reales verificadas sin cambiar la navegación del producto.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
