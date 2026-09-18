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
import { findDemoPropertyListing } from './propertyDemoData';

export function PropertyListingDetailScreen() {
  const params = useLocalSearchParams<{ listingId?: string }>();
  const listingId = typeof params.listingId === 'string' ? params.listingId : '';
  const item = findDemoPropertyListing(listingId);

  if (!item) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
        <View style={{ flex: 1, padding: paltaTheme.spacing.lg, justifyContent: 'center', gap: paltaTheme.spacing.md }}>
          <Text style={{ fontSize: 22, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Esta propiedad no está disponible</Text>
          <Text style={{ color: paltaTheme.color.textSecondary }}>Puede haber sido retirada, vendida o arrendada.</Text>
          <PaltaButton label="Volver a Propiedades" onPress={() => router.replace('/propiedades')} />
        </View>
      </SafeAreaView>
    );
  }

  const { listing, property } = item;

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
          <Text style={{ marginTop: 6, color: paltaTheme.color.textMuted }}>Galería de fotos</Text>
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
          </View>

          <View
            style={{
              padding: paltaTheme.spacing.md,
              borderRadius: paltaTheme.radius.surface,
              backgroundColor: paltaTheme.color.surface,
              borderWidth: 1,
              borderColor: paltaTheme.color.divider,
              gap: 8,
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Ubicación y entorno</Text>
            <Text style={{ color: paltaTheme.color.textSecondary }}>{property.address.displayAddress ?? `${item.comuna}, Chile`}</Text>
            <Text style={{ fontSize: 13, lineHeight: 19, color: paltaTheme.color.textMuted }}>
              Aquí se conectarán Metro, buses, colegios, salud, parques, comercio y tiempos de traslado desde el Map/Neighborhood Core de Palta.
            </Text>
            <PaltaButton label="Ver en el mapa" variant="secondary" onPress={() => router.push('/propiedades/map')} />
          </View>

          <View
            style={{
              padding: paltaTheme.spacing.md,
              borderRadius: paltaTheme.radius.surface,
              backgroundColor: paltaTheme.color.surface,
              borderWidth: 1,
              borderColor: paltaTheme.color.divider,
              gap: 8,
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Publicado por</Text>
            <Text style={{ fontWeight: '800', color: paltaTheme.color.textPrimary }}>{item.publisherLabel}</Text>
            <Text style={{ fontSize: 13, color: paltaTheme.color.textMuted }}>
              {item.publisherType === 'owner_direct'
                ? 'Contacto directo del propietario.'
                : 'El perfil profesional reutiliza la identidad, verificación y contacto de Negocios.'}
            </Text>
            {listing.publisherBusinessId ? (
              <PaltaButton
                label="Ver perfil del negocio"
                variant="secondary"
                onPress={() => router.push(`/business/${encodeURIComponent(listing.publisherBusinessId!)}`)}
              />
            ) : null}
          </View>

          <View style={{ flexDirection: 'row', gap: paltaTheme.spacing.sm }}>
            <PaltaButton label="Guardar" variant="secondary" style={{ flex: 1 }} />
            <PaltaButton label="Consultar" style={{ flex: 1 }} />
          </View>

          <Text style={{ fontSize: 11, lineHeight: 16, color: paltaTheme.color.textMuted }}>
            Vista en desarrollo con datos de prueba. El flujo de contacto y publicación se conectará a los contratos reales del módulo.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
