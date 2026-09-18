import type { ReactNode } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, ScrollView, Share, Text, View } from 'react-native';
import {
  formatListingPrice,
  formatPropertyFacts,
  REAL_ESTATE_PROPERTY_TYPE_LABELS,
  REAL_ESTATE_PUBLISHER_LABELS,
  REAL_ESTATE_TRANSACTION_LABELS,
} from '../../../../src/realEstate/realEstateDiscovery';
import type {
  RealEstateContextVerification,
  RealEstateNearbyRef,
} from '../../../../src/realEstate/realEstateContext';
import { PaltaButton } from '../../components/common/PaltaButton';
import { paltaTheme } from '../../theme/paltaTheme';
import { findPropertyDetailDemo } from './propertyDetailDemoData';
import { SaveRealEstateSearchButton } from './SaveRealEstateSearchButton';
import { useRealEstateListing } from './useRealEstateListing';
import { useRealEstatePropertyContext } from './useRealEstatePropertyContext';
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

function evidenceLabel(verification: RealEstateContextVerification): string {
  switch (verification) {
    case 'verified':
      return 'Verificado';
    case 'corroborated':
      return 'Corroborado';
    case 'needs_verification':
      return 'Por verificar';
    case 'demo':
      return 'Dato de prueba';
  }
}

function nearbyMeta(item: RealEstateNearbyRef): string {
  return [
    item.walkingMinutes !== undefined ? `${item.walkingMinutes} min a pie` : undefined,
    item.distanceMeters !== undefined ? `${new Intl.NumberFormat('es-CL').format(item.distanceMeters)} m` : undefined,
    evidenceLabel(item.evidence.verification),
  ].filter(Boolean).join(' · ');
}

export function PropertyListingDetailScreen() {
  const params = useLocalSearchParams<{ listingId?: string }>();
  const listingId = typeof params.listingId === 'string' ? params.listingId : '';
  const { listing: item, loading, error } = useRealEstateListing(listingId);
  const propertyContext = useRealEstatePropertyContext(item?.property.id ?? '');
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

  const currentItem = item;
  const { listing, property } = currentItem;
  const context = propertyContext.context;
  const isSaved = savedListings.isSaved(listing.id);

  async function shareListing() {
    await Share.share({
      message: [
        'Propiedad en Somos Palta',
        `${currentItem.sector} · ${currentItem.comuna}`,
        formatListingPrice(listing),
        formatPropertyFacts(property),
      ].filter(Boolean).join('\n'),
    });
  }

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
              {REAL_ESTATE_TRANSACTION_LABELS[listing.transactionType]} · {REAL_ESTATE_PUBLISHER_LABELS[currentItem.publisherType]}
            </Text>
            <Text style={{ fontSize: 28, fontWeight: '900', color: paltaTheme.color.textPrimary }}>{formatListingPrice(listing)}</Text>
            <Text style={{ fontSize: 17, fontWeight: '800', color: paltaTheme.color.textPrimary }}>{currentItem.sector} · {currentItem.comuna}</Text>
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
                    text: currentItem.comuna,
                    transactionType: listing.transactionType,
                    propertyType: property.type,
                  }}
                />
              </View>
            </View>
          </Surface>

          {context?.building ? (
            <Surface>
              <Text style={{ fontSize: 17, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Edificio / condominio</Text>
              <Text style={{ fontSize: 15, fontWeight: '800', color: paltaTheme.color.textPrimary }}>
                {context.building.building.name ?? 'Edificio sin nombre confirmado'}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {context.building.yearBuilt !== undefined ? <Pill label={`${context.building.yearBuilt}`} /> : null}
                {context.building.floors !== undefined ? <Pill label={`${context.building.floors} pisos`} /> : null}
                {context.building.unitCount !== undefined ? <Pill label={`${context.building.unitCount} unidades`} /> : null}
              </View>
              <Text style={{ fontSize: 11, color: paltaTheme.color.textMuted }}>
                {evidenceLabel(context.building.evidence.verification)} · ID canónico {context.building.building.id}
              </Text>
            </Surface>
          ) : null}

          <Surface>
            <Text style={{ fontSize: 17, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Ubicación y entorno</Text>
            <Text style={{ color: paltaTheme.color.textSecondary }}>{property.address.displayAddress ?? `${currentItem.comuna}, Chile`}</Text>
            {propertyContext.loading ? (
              <Text style={{ fontSize: 12, color: paltaTheme.color.textMuted }}>Cargando contexto cercano…</Text>
            ) : null}
            {propertyContext.error ? (
              <Text style={{ fontSize: 12, color: paltaTheme.color.textMuted }}>
                No pudimos actualizar el contexto cercano. El aviso principal sigue disponible.
              </Text>
            ) : null}
            {context?.nearby.map((nearby) => (
              <View key={`${nearby.sourceCore}:${nearby.entityId}`} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: paltaTheme.spacing.md }}>
                <Text style={{ flex: 1, fontSize: 13, fontWeight: '800', color: paltaTheme.color.textPrimary }}>
                  {nearby.displayLabel ?? nearby.kind}
                </Text>
                <Text style={{ flex: 1, textAlign: 'right', fontSize: 12, color: paltaTheme.color.textMuted }}>
                  {nearbyMeta(nearby)}
                </Text>
              </View>
            ))}
            {!propertyContext.loading && !propertyContext.error && !context?.nearby.length ? (
              <Text style={{ fontSize: 12, color: paltaTheme.color.textMuted }}>
                Aún no hay contexto cercano verificado para esta propiedad.
              </Text>
            ) : null}
            <Text style={{ fontSize: 12, lineHeight: 18, color: paltaTheme.color.textMuted }}>
              Metro, Red bus, colegios, salud, parques y comercio se referencian desde los cores compartidos de Palta; Propiedades no duplica esas entidades.
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
            <Text style={{ fontWeight: '800', color: paltaTheme.color.textPrimary }}>{currentItem.publisherLabel}</Text>
            <Text style={{ fontSize: 13, color: paltaTheme.color.textMuted }}>
              {currentItem.publisherType === 'owner_direct'
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
            <PaltaButton
              label="Compartir"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => void shareListing()}
            />
            <PaltaButton
              label="Consultar"
              style={{ flex: 1 }}
              onPress={() => router.push(`/propiedades/contact/${encodeURIComponent(listing.id)}`)}
            />
          </View>

          <Text style={{ fontSize: 11, lineHeight: 16, color: paltaTheme.color.textMuted }}>
            Compartir usa el sistema del teléfono. Consultar prepara una solicitud local; el envío real se conectará a Message/Care Core y a la identidad verificada del publicador.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
