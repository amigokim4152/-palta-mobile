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
import type { VehicleBodyType } from '../../../../src/autos/autosContracts';
import { FilterChip } from '../../components/common/FilterChip';
import { paltaTheme } from '../../theme/paltaTheme';
import { AUTOS_DEMO_LISTINGS } from './autosDemoData';
import { toggleAutosListingSaved, useAutosDemoState } from './autosDemoState';
import { VehicleListingCard } from './VehicleListingCard';

type AutosFilter = 'all' | VehicleBodyType | 'hybrid';

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

export function AutosScreen() {
  const demoState = useAutosDemoState();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<AutosFilter>('all');
  const [ownerDirectOnly, setOwnerDirectOnly] = useState(false);
  const [budgetOnly, setBudgetOnly] = useState(false);
  const [recentOnly, setRecentOnly] = useState(false);
  const [lowMileageOnly, setLowMileageOnly] = useState(false);

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

  const hasFilters =
    filter !== 'all' || ownerDirectOnly || budgetOnly || recentOnly || lowMileageOnly;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: paltaTheme.spacing.md,
          paddingBottom: 48,
          gap: paltaTheme.spacing.lg,
        }}
      >
        <View style={{ gap: 3 }}>
          <Text style={{ fontSize: 29, fontWeight: '900', letterSpacing: -0.5, color: paltaTheme.color.textPrimary }}>
            Autos
          </Text>
          <Text style={{ fontSize: 13, lineHeight: 18, color: paltaTheme.color.textMuted }}>
            Compra y vende vehículos cerca de ti
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: paltaTheme.spacing.xs }}>
          <QuickAction title="Vender mi auto" subtitle="Publicar" onPress={() => router.push('/autos/sell')} />
          <QuickAction
            title="Guardados"
            subtitle={`${demoState.savedListingIds.length} favoritos`}
            onPress={() => router.push('/autos/saved')}
          />
          <QuickAction
            title="Mis autos"
            subtitle={demoState.publishedListings.length ? 'Publicación activa' : 'Tus vehículos'}
            onPress={() => router.push('/autos/mine')}
          />
        </View>

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
            value={query}
            onChangeText={setQuery}
            placeholder="Marca, modelo, comuna..."
            placeholderTextColor={paltaTheme.color.textMuted}
            style={{ flex: 1, minHeight: 48, fontSize: 15, color: paltaTheme.color.textPrimary }}
          />
        </View>

        <View style={{ gap: paltaTheme.spacing.xs }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: paltaTheme.spacing.xs }}
          >
            {FILTERS.map((item) => (
              <FilterChip
                key={item.key}
                label={item.label}
                selected={filter === item.key}
                onPress={() => setFilter(item.key)}
              />
            ))}
            <FilterChip
              label="Dueño directo"
              selected={ownerDirectOnly}
              onPress={() => setOwnerDirectOnly(!ownerDirectOnly)}
            />
            <FilterChip
              label="Hasta $15M"
              selected={budgetOnly}
              onPress={() => setBudgetOnly(!budgetOnly)}
            />
            <FilterChip
              label="2022+"
              selected={recentOnly}
              onPress={() => setRecentOnly(!recentOnly)}
            />
            <FilterChip
              label="< 40.000 km"
              selected={lowMileageOnly}
              onPress={() => setLowMileageOnly(!lowMileageOnly)}
            />
          </ScrollView>
        </View>

        {!query && !hasFilters ? (
          <View
            style={{
              padding: paltaTheme.spacing.md,
              borderRadius: paltaTheme.radius.surface,
              backgroundColor: paltaTheme.color.brandSoft,
              gap: 4,
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '900', color: paltaTheme.color.brandPrimary }}>
              Venta local, con más contexto
            </Text>
            <Text style={{ fontSize: 12, lineHeight: 17, color: paltaTheme.color.textSecondary }}>
              Palta distingue dueño directo y automotora, conecta el negocio cuando corresponde y mantiene el vehículo separado de la publicación.
            </Text>
          </View>
        ) : null}

        <View style={{ gap: paltaTheme.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 19, fontWeight: '900', color: paltaTheme.color.textPrimary }}>
              {query || hasFilters ? 'Resultados' : 'Autos cerca de ti'}
            </Text>
            <Text style={{ fontSize: 12, color: paltaTheme.color.textMuted }}>
              {listings.length} {listings.length === 1 ? 'publicación' : 'publicaciones'}
            </Text>
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
            <View
              style={{
                padding: paltaTheme.spacing.xl,
                borderRadius: paltaTheme.radius.surface,
                borderWidth: 1,
                borderColor: paltaTheme.color.divider,
                backgroundColor: paltaTheme.color.surface,
              }}
            >
              <Text style={{ fontSize: 17, fontWeight: '900', color: paltaTheme.color.textPrimary }}>
                No encontramos autos con estos filtros
              </Text>
              <Text style={{ marginTop: 5, fontSize: 13, color: paltaTheme.color.textSecondary }}>
                Prueba otra marca, comuna o tipo de vehículo.
              </Text>
            </View>
          )}
        </View>

        <Text style={{ fontSize: 11, lineHeight: 16, color: paltaTheme.color.textMuted }}>
          Estado demo interactivo. La persistencia se reemplazará por la cuenta Palta sin cambiar esta navegación.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
