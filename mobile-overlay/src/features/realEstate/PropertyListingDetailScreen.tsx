import type { ReactNode } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';
import {
  formatListingPrice,
  formatPropertyFacts,
  REAL_ESTATE_PROPERTY_TYPE_LABELS,
  REAL_ESTATE_PUBLISHER_LABELS,
  REAL_ESTATE_TRANSACTION_LABELS,
} from '../../../../src/realEstate/realEstateDiscovery';
import { PaltaButton } from '../../components/common/PaltaButton';
import { paltaTheme } from '../../theme/paltaTheme';
import { findPropertyDetailDemo } from './propertyDetailDemoData';
import { SaveRealEstateSearchButton } from './SaveRealEstateSearchButton';
import { useRealEstateListing } from './useRealEstateListing';
import { useSavedRealEstateListings } from './useSavedRealEstateListings';

function Surface({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        padding: paltaTheme.spacing.md,
        borderRadius: paltaTheme.radius.surface,
        backgroundColor: paltaTheme.color.surface,
        borderWidth: 1,
        borderColor: paltaTheme.color.divider,
        gap: 9,
      }}
    >
      {children}
    </View>
  );
}

function Pill({ label }: { label: string }) {
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: paltaTheme.radius.pill, backgroundColor: paltaTheme.color.surfaceMuted }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: paltaTheme.color.textSecondary }}>{label}</Text>
    </View>
  );
}

export function PropertyListingDetailScreen() {
  const params = useLocalSearchParams<{ listingId?: string }>();
  const listingId = typeof params.listingId === 'string' ? params.listingId : '';
  const { listing: item, loading, error } = useRealEstateListing(listingId);
  const savedListings = useSavedRealEstateListings();
  const detail = findPropertyDetailDemo(listingId);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
        <View style={{ flex: 1, padding: paltaTheme.spacing.lg, justifyContent: 'center' }}>
          <Text style={{ textAlign: 'center', color: paltaTheme.color.textSecondary }}>Cargando propiedad…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!item || error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
        <View style={{ flex: 1, padding: paltaTheme.spacing.lg, justifyContent: 'center', gap: paltaTheme.spacing.md }}>
          <Text style={{ fontSize: 22, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Esta propiedad no está disponible</Text>
          <Text style={{ color: paltaTheme.color.textSecondary }}>{error ?? 'Puede haber sido retirada, vendida o arrendada.'}</Text>
          <PaltaButton label="Volver a Propiedades" onPress={() => router.replace('/propiedades')} />
        </View>
      </SafeAreaView>
    );
  }

  const { listing, property } = item;
  const isSaved = savedListings.isSaved(listing.id);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <View
          style={{
            height: 270,
            margin: paltaTheme.spacing.md,
            marginBottom: 0,
            borderRadius: paltaTheme.radius.sheet,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: paltaTheme.color.brandSoft,
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: '900', color: paltaTheme.color.brandPrimary }}>
            {REAL_ESTATE_PROPERTY_TYPE_LABELS[property.type]}
          </Text>
          <Text style={{ marginTop: 6, color: paltaTheme.color.textMuted }}>Galería de fotos · conectar media real</Text>
        </View>

        <View style={{ padding: paltaTheme.spacing.md, gap: paltaTheme.spacing.lg }}>
          <View style={{ gap: 5 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: paltaTheme.color.brandPrimary }}>
              {REAL_ESTATE_TRANSACTION_LABELS[listing.transactionType]} · {REAL_ESTATE_PUBLISHER_LABELS[item.publisherType]}
            </Text>
            <Text style={{ fontSize: 28, fontWeight: '900', color: paltaTheme.color.textPrimary }}>{formatListingPrice(listing)}</Text>
            <Text style={{ fontSize: 17, fontWeight: '800', color: paltaTheme.color.textPrimary }}>{item.sector} · {item.comuna}</Text>
            <Text style={{ fontSize: 15, color: paltaTheme.color.textSecondary }}>{formatPropertyFacts(property)}</Text>
            {listing.commonExpensesClp !== undefined ? (
              <Text style={{ fontSize: 13, color: paltaTheme.color.textMuted }}>
                Gastos comunes ${new Intl.NumberFormat('es-CL').format(listing.commonExpensesClp)}
              </Text>
            ) : null}
            {detail?.highlights?.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 5 }}>
                {detail.highlights.map((highlight) => <Pill key={highlight} label={highlight} />)}
              </View>
            ) : null}
          </View>

          <Surface>
            <Text style={{ fontSize: 17, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Precio y alertas</Text>
            <Text style={{ fontSize: 13, color: paltaTheme.color.textSecondary }}>Guarda esta propiedad o guarda una búsqueda similar para revisarla después.</Text>
            {detail?.marketReference ? (
              <View style={{ padding: paltaTheme.spacing.sm, borderRadius: paltaTheme.radius.control, backgroundColor: paltaTheme.color.surfaceMuted }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: paltaTheme.color.textPrimary }}>{detail.marketReference.label}</Text>
                <Text style={{ marginTop: 3, fontSize: 13, color: paltaTheme.color.textSecondary }}>{detail.marketReference.value}</Text>
                <Text style={{ marginTop: 4, fontSize: 10, lineHeight: 14, color: paltaTheme.color.textMuted }}>{detail.marketReference.disclaimer}</Text>
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', gap: paltaTheme.spacing.sm }}>
              <PaltaButton
                label={isSaved ? 'Guardado' : 'Guardar'}
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => void savedListings.toggleSaved(listing.id)}
              />
              <View style={{ flex: 1 }}>
                <SaveRealEstateSearchButton
                  query={{
                    text: item.comuna,
                    transactionType: listing.transactionType,
                    propertyType: property.type,
                  }}
                />
              </View>
            </View>
          </Surface>

          {detail?.building ? (
            <Surface>
              <Text style={{ fontSize: 17, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Edificio / condominio</Text>
              <Text style={{ fontSize: 15, fontWeight: '800', color: paltaTheme.color.textPrimary }}>{detail.building.name}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {detail.building.yearBuilt ? <Pill label={`${detail.building.yearBuilt}`} /> : null}
                {detail.building.floors ? <Pill label={`${detail.building.floors} pisos`} /> : null}
                {detail.building.units ? <Pill label={`${detail.building.units} unidades`} /> : null}
              </View>
              {detail.building.parkingNote ? <Text style={{ fontSize: 13, color: paltaTheme.color.textSecondary }}>{detail.building.parkingNote}</Text> : null}
              <Text style={{ fontSize: 10, color: paltaTheme.color.textMuted }}>Datos demo hasta conectar una fuente verificable de edificio.</Text>
            </Surface>
          ) : null}

          <Surface>
            <Text style={{ fontSize: 17, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Ubicación y entorno</Text>
            <Text style={{ color: paltaTheme.color.textSecondary }}>{property.address.displayAddress ?? `${item.comuna}, Chile`}</Text>
            {detail?.nearby?.map((nearby) => (
              <View key={nearby.label} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: paltaTheme.spacing.md }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: paltaTheme.color.textPrimary }}>{nearby.label}</Text>
                <Text style={{ flex: 1, textAlign: 'right', fontSize: 12, color: paltaTheme.color.textMuted }}>{nearby.detail}</Text>
              </View>
            ))}
            <Text style={{ fontSize: 12, lineHeight: 18, color: paltaTheme.color.textMuted }}>
              Metro, Red bus, colegios, salud, parques, comercio y tiempos de traslado se resolverán desde los cores compartidos de Palta, no desde copias dentro del aviso.
            </Text>
            <PaltaButton label="Ver en el mapa" variant="secondary" onPress={() => router.push('/propiedades/map')} />
          </Surface>

          {detail?.livedReview ? (
            <Surface>
              <Text style={{ fontSize: 17, fontWeight: '900', color: paltaTheme.color.textPrimary }}>{detail.livedReview.title}</Text>
              <Text style={{ fontSize: 13, lineHeight: 19, color: paltaTheme.color.textSecondary }}>{detail.livedReview.body}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {detail.livedReview.tags.map((tag) => <Pill key={tag} label={tag} />)}
              </View>
            </Surface>
          ) : null}

          <Surface>
            <Text style={{ fontSize: 17, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Publicado por</Text>
            <Text style={{ fontWeight: '800', color: paltaTheme.color.textPrimary }}>{item.publisherLabel}</Text>
            <Text style={{ fontSize: 13, color: paltaTheme.color.textMuted }}>
              {item.publisherType === 'owner_direct'
                ? 'Contacto directo del propietario. La identidad y verificación se conectarán al account/trust core.'
                : 'El perfil profesional reutiliza identidad, verificación, reseñas y contacto de Negocios.'}
            </Text>
            {listing.publisherBusinessId ? (
              <PaltaButton
                label="Ver perfil del negocio"
                variant="secondary"
                onPress={() => router.push(`/business/${encodeURIComponent(listing.publisherBusinessId!)}`)}
              />
            ) : null}
          </Surface>

          <View style={{ flexDirection: 'row', gap: paltaTheme.spacing.sm }}>
            <PaltaButton label="Compartir" variant="secondary" disabled style={{ flex: 1 }} />
            <PaltaButton label="Consultar" disabled style={{ flex: 1 }} />
          </View>

          <Text style={{ fontSize: 11, lineHeight: 16, color: paltaTheme.color.textMuted }}>
            Vista en desarrollo con datos de prueba. Compartir y consultar se activarán al conectar Share/Message Core y la identidad verificada del publicador.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
