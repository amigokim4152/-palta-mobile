import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { MapFeature } from '../../../../src/adapters/mapCore';
import type { VehicleBodyType } from '../../../../src/autos/autosContracts';
import { FilterChip } from '../../components/common/FilterChip';
import { NeighborhoodMap } from '../../components/map/NeighborhoodMap';
import { mobileRuntime } from '../../services/paltaClient';
import { paltaTheme } from '../../theme/paltaTheme';
import { AUTOS_DEMO_LISTINGS } from './autosDemoData';
import { AUTOS_SANTIAGO_MAP_CENTER, autosDemoPointForListing } from './autosDemoMap';
import { toggleAutosListingSaved, useAutosDemoState } from './autosDemoState';
import { VehicleListingCard } from './VehicleListingCard';

type AutosFilter = 'all' | VehicleBodyType | 'hybrid';
type AutosView = 'list' | 'map';

const FILTERS: readonly { key: AutosFilter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'suv', label: 'SUV' },
  { key: 'sedan', label: 'Sedán' },
  { key: 'pickup', label: 'Pickup' },
  { key: 'hatchback', label: 'Hatchback' },
  { key: 'hybrid', label: 'Híbridos' },
];

function QuickAction({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 72,
        justifyContent: 'center',
        paddingHorizontal: paltaTheme.spacing.sm,
        borderRadius: paltaTheme.radius.surface,
        borderWidth: 1,
        borderColor: paltaTheme.color.divider,
        backgroundColor: pressed ? paltaTheme.color.surfaceMuted : paltaTheme.color.surface,
      })}
    >
      <Text style={{ fontSize: 14, fontWeight: '900', color: paltaTheme.color.textPrimary }}>{title}</Text>
      <Text numberOfLines={1} style={{ marginTop: 3, fontSize: 11, color: paltaTheme.color.textMuted }}>{subtitle}</Text>
    </Pressable>
  );
}

function ViewToggle({ value, onChange }: { value: AutosView; onChange: (value: AutosView) => void }) {
  return (
    <View style={{ flexDirection: 'row', padding: 3, borderRadius: paltaTheme.radius.pill, backgroundColor: paltaTheme.color.surfaceMuted }}>
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
        minHeight: 52,
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
        placeholder="Marca, modelo, comuna..."
        placeholderTextColor={paltaTheme.color.textMuted}
        style={{ flex: 1, minHeight: 48, fontSize: 15, color: paltaTheme.color.textPrimary }}
      />
    </View>
  );
}

function DiscoveryFilters({
  filter,
  setFilter,
  ownerDirectOnly,
  setOwnerDirectOnly,
  budgetOnly,
  setBudgetOnly,
  recentOnly,
  setRecentOnly,
  lowMileageOnly,
  setLowMileageOnly,
}: {
  filter: AutosFilter;
  setFilter: (value: AutosFilter) => void;
  ownerDirectOnly: boolean;
  setOwnerDirectOnly: (value: boolean) => void;
  budgetOnly: boolean;
  setBudgetOnly: (value: boolean) => void;
  recentOnly: boolean;
  setRecentOnly: (value: boolean) => void;
  lowMileageOnly: boolean;
  setLowMileageOnly: (value: boolean) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: paltaTheme.spacing.xs }}>
      {FILTERS.map((item) => (
        <FilterChip
          key={item.key}
          label={item.label}
          selected={filter === item.key}
          onPress={() => setFilter(item.key)}
        />
      ))}
      <FilterChip label="Dueño directo" selected={ownerDirectOnly} onPress={() => setOwnerDirectOnly(!ownerDirectOnly)} />
      <FilterChip label="Hasta $15M" selected={budgetOnly} onPress={() => setBudgetOnly(!budgetOnly)} />
      <FilterChip label="2022+" selected={recentOnly} onPress={() => setRecentOnly(!recentOnly)} />
      <FilterChip label="< 40.000 km" selected={lowMileageOnly} onPress={() => setLowMileageOnly(!lowMileageOnly)} />
    </ScrollView>
  );
}

export function AutosScreen() {
  const demoState = useAutosDemoState();
  const [view, setView] = useState<AutosView>('list');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<AutosFilter>('all');
  const [ownerDirectOnly, setOwnerDirectOnly] = useState(false);
  const [budgetOnly, setBudgetOnly] = useState(false);
  const [recentOnly, setRecentOnly] = useState(false);
  const [lowMileageOnly, setLowMileageOnly] = useState(false);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);

  const allListings = useMemo(
    () => [...demoState.publishedListings, ...AUTOS_DEMO_LISTINGS],
    [demoState.publishedListings],
  );

  const listings = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('es-CL');
    return allListings.filter(({ vehicle, listing }) => {
      if (filter === 'hybrid' && vehicle.fuel !== 'hybrid') return false;
      if (filter !== 'all' && filter !== 'hybrid' && vehicle.bodyType !== filter) return false;
      if (ownerDirectOnly && listing.sellerType !== 'owner_direct') return false;
      if (budgetOnly && listing.priceClp > 15000000) return false;
      if (recentOnly && vehicle.year < 2022) return false;
      if (lowMileageOnly && listing.mileageKm >= 40000) return false;
      if (
        normalizedQuery &&
        !`${listing.title} ${vehicle.make} ${vehicle.model} ${listing.comuna} ${listing.sector ?? ''}`
          .toLocaleLowerCase('es-CL')
          .includes(normalizedQuery)
      ) {
        return false;
      }
      return true;
    });
  }, [allListings, budgetOnly, filter, lowMileageOnly, ownerDirectOnly, query, recentOnly]);

  const selectedListing =
    listings.find((item) => item.listing.id === selectedListingId) ?? listings[0];

  const mapFeatures = useMemo<MapFeature[]>(
    () =>
      listings.map((item) => ({
        id: item.listing.id,
        entityType: 'vehicle_listing',
        coordinate: autosDemoPointForListing(item),
        title: item.listing.title,
        categoryKey: item.vehicle.bodyType,
        selected: item.listing.id === selectedListing?.listing.id,
      })),
    [listings, selectedListing?.listing.id],
  );

  const hasFilters =
    filter !== 'all' || ownerDirectOnly || budgetOnly || recentOnly || lowMileageOnly;

  const filters = (
    <DiscoveryFilters
      filter={filter}
      setFilter={setFilter}
      ownerDirectOnly={ownerDirectOnly}
      setOwnerDirectOnly={setOwnerDirectOnly}
      budgetOnly={budgetOnly}
      setBudgetOnly={setBudgetOnly}
      recentOnly={recentOnly}
      setRecentOnly={setRecentOnly}
      lowMileageOnly={lowMileageOnly}
      setLowMileageOnly={setLowMileageOnly}
    />
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
                initialCenter={selectedListing ? autosDemoPointForListing(selectedListing) : AUTOS_SANTIAGO_MAP_CENTER}
                initialZoom={11.5}
                onSelectEntity={setSelectedListingId}
              />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: paltaTheme.color.surfaceMuted }}>
                <Text style={{ fontWeight: '800', color: paltaTheme.color.textPrimary }}>Mapa no disponible</Text>
              </View>
            )}
          </View>

          <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: paltaTheme.spacing.sm, gap: paltaTheme.spacing.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: paltaTheme.spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 24, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Autos</Text>
                <Text style={{ marginTop: 2, fontSize: 12, color: paltaTheme.color.textMuted }}>Explora vehículos por zona</Text>
              </View>
              <ViewToggle value={view} onChange={setView} />
            </View>
            <SearchBar value={query} onChangeText={setQuery} />
            {filters}
          </View>

          {listings.length ? (
            <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: paltaTheme.spacing.sm }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: paltaTheme.spacing.sm, paddingHorizontal: paltaTheme.spacing.sm }}
              >
                {listings.map((item) => (
                  <View key={item.listing.id} style={{ width: 310 }}>
                    <VehicleListingCard
                      item={item}
                      saved={demoState.savedListingIds.includes(item.listing.id)}
                      selected={item.listing.id === selectedListing?.listing.id}
                      onToggleSaved={() => toggleAutosListingSaved(item.listing.id)}
                      onPress={() => {
                        setSelectedListingId(item.listing.id);
                        router.push(`/autos/listing/${encodeURIComponent(item.listing.id)}`);
                      }}
                    />
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : (
            <View style={{ position: 'absolute', left: paltaTheme.spacing.md, right: paltaTheme.spacing.md, bottom: paltaTheme.spacing.lg, padding: paltaTheme.spacing.md, borderRadius: paltaTheme.radius.surface, backgroundColor: paltaTheme.color.surface }}>
              <Text style={{ fontWeight: '900', color: paltaTheme.color.textPrimary }}>No hay autos con estos filtros</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: paltaTheme.spacing.md, paddingBottom: 48, gap: paltaTheme.spacing.lg }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: paltaTheme.spacing.sm }}>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ fontSize: 29, fontWeight: '900', letterSpacing: -0.5, color: paltaTheme.color.textPrimary }}>Autos</Text>
            <Text style={{ fontSize: 13, lineHeight: 18, color: paltaTheme.color.textMuted }}>Compra y vende vehículos cerca de ti</Text>
          </View>
          <ViewToggle value={view} onChange={setView} />
        </View>

        <View style={{ flexDirection: 'row', gap: paltaTheme.spacing.xs }}>
          <QuickAction title="Vender mi auto" subtitle="Publicar" onPress={() => router.push('/autos/sell')} />
          <QuickAction title="Guardados" subtitle={`${demoState.savedListingIds.length} favoritos`} onPress={() => router.push('/autos/saved')} />
          <QuickAction title="Mis autos" subtitle={demoState.publishedListings.length ? 'Publicación activa' : 'Tus vehículos'} onPress={() => router.push('/autos/mine')} />
        </View>

        <SearchBar value={query} onChangeText={setQuery} />
        {filters}

        {!query && !hasFilters ? (
          <View style={{ padding: paltaTheme.spacing.md, borderRadius: paltaTheme.radius.surface, backgroundColor: paltaTheme.color.brandSoft, gap: 4 }}>
            <Text style={{ fontSize: 15, fontWeight: '900', color: paltaTheme.color.brandPrimary }}>Venta local, con más contexto</Text>
            <Text style={{ fontSize: 12, lineHeight: 17, color: paltaTheme.color.textSecondary }}>
              Palta distingue dueño directo y automotora, conecta el negocio cuando corresponde y mantiene el vehículo separado de la publicación.
            </Text>
          </View>
        ) : null}

        <View style={{ gap: paltaTheme.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 19, fontWeight: '900', color: paltaTheme.color.textPrimary }}>{query || hasFilters ? 'Resultados' : 'Autos cerca de ti'}</Text>
            <Text style={{ fontSize: 12, color: paltaTheme.color.textMuted }}>{listings.length} {listings.length === 1 ? 'publicación' : 'publicaciones'}</Text>
          </View>

          {listings.length ? (
            <View style={{ gap: paltaTheme.spacing.sm }}>
              {listings.map((item) => (
                <VehicleListingCard
                  key={item.listing.id}
                  item={item}
                  saved={demoState.savedListingIds.includes(item.listing.id)}
                  onToggleSaved={() => toggleAutosListingSaved(item.listing.id)}
                  onPress={() => router.push(`/autos/listing/${encodeURIComponent(item.listing.id)}`)}
                />
              ))}
            </View>
          ) : (
            <View style={{ padding: paltaTheme.spacing.xl, borderRadius: paltaTheme.radius.surface, borderWidth: 1, borderColor: paltaTheme.color.divider, backgroundColor: paltaTheme.color.surface }}>
              <Text style={{ fontSize: 17, fontWeight: '900', color: paltaTheme.color.textPrimary }}>No encontramos autos con estos filtros</Text>
              <Text style={{ marginTop: 5, fontSize: 13, color: paltaTheme.color.textSecondary }}>Prueba otra marca, comuna o tipo de vehículo.</Text>
            </View>
          )}
        </View>

        <Text style={{ fontSize: 11, lineHeight: 16, color: paltaTheme.color.textMuted }}>
          Estado demo interactivo. La persistencia y las coordenadas demo se reemplazarán por cuenta y Place Core sin cambiar esta navegación.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
