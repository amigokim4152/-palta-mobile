import { useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import {
  createRealEstateInquiryDraft,
  type RealEstateInquiryChannel,
} from '../../../../src/realEstate/realEstateInquiry';
import { ExpoSQLiteRealEstateInquiryStore } from '../../adapters/expoSqliteRealEstateInquiryStore';
import { FilterChip } from '../../components/common/FilterChip';
import { PaltaButton } from '../../components/common/PaltaButton';
import { paltaTheme } from '../../theme/paltaTheme';
import { useRealEstateListing } from './useRealEstateListing';

export function PropertyInquiryScreen() {
  const params = useLocalSearchParams<{ listingId?: string }>();
  const listingId = typeof params.listingId === 'string' ? params.listingId : '';
  const { listing: item, loading, error } = useRealEstateListing(listingId);
  const db = useSQLiteContext();
  const store = useMemo(() => new ExpoSQLiteRealEstateInquiryStore(db), [db]);
  const [channel, setChannel] = useState<RealEstateInquiryChannel>('palta');
  const [message, setMessage] = useState('Hola, me interesa esta propiedad. ¿Sigue disponible?');
  const [visitRequested, setVisitRequested] = useState(false);
  const [financingQuestion, setFinancingQuestion] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function saveInquiry() {
    if (!item) return;
    setSaving(true);
    try {
      await store.saveDraft(createRealEstateInquiryDraft({
        listingId: item.listing.id,
        ...(item.listing.publisherBusinessId
          ? { publisherBusinessId: item.listing.publisherBusinessId }
          : {}),
        channel,
        message,
        visitRequested,
        financingQuestion,
      }));
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: paltaTheme.color.textSecondary }}>Cargando propiedad…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!item || error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
        <View style={{ flex: 1, justifyContent: 'center', padding: paltaTheme.spacing.lg, gap: paltaTheme.spacing.md }}>
          <Text style={{ fontSize: 21, fontWeight: '900', color: paltaTheme.color.textPrimary }}>No podemos preparar la consulta</Text>
          <Text style={{ color: paltaTheme.color.textSecondary }}>{error ?? 'La propiedad ya no está disponible.'}</Text>
          <PaltaButton label="Volver" onPress={() => router.back()} />
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
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 28, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Consultar</Text>
          <Text style={{ fontSize: 13, color: paltaTheme.color.textMuted }}>
            {item.sector} · {item.comuna} · {item.publisherLabel}
          </Text>
        </View>

        <View
          style={{
            padding: paltaTheme.spacing.md,
            borderRadius: paltaTheme.radius.surface,
            borderWidth: 1,
            borderColor: paltaTheme.color.divider,
            backgroundColor: paltaTheme.color.surface,
            gap: paltaTheme.spacing.md,
          }}
        >
          <Text style={{ fontSize: 17, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Canal preferido</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: paltaTheme.spacing.xs }}>
            <FilterChip label="Palta" selected={channel === 'palta'} onPress={() => setChannel('palta')} />
            <FilterChip label="WhatsApp" selected={channel === 'whatsapp'} onPress={() => setChannel('whatsapp')} />
            <FilterChip label="Teléfono" selected={channel === 'phone'} onPress={() => setChannel('phone')} />
          </View>
          <Text style={{ fontSize: 12, lineHeight: 18, color: paltaTheme.color.textMuted }}>
            El canal se respetará cuando exista un contacto verificado del publicador. Palta no inventará números ni abrirá WhatsApp sin un destino confirmado.
          </Text>
        </View>

        <View
          style={{
            padding: paltaTheme.spacing.md,
            borderRadius: paltaTheme.radius.surface,
            borderWidth: 1,
            borderColor: paltaTheme.color.divider,
            backgroundColor: paltaTheme.color.surface,
            gap: paltaTheme.spacing.sm,
          }}
        >
          <Text style={{ fontSize: 17, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Mensaje</Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            multiline
            textAlignVertical="top"
            placeholder="Escribe tu consulta"
            placeholderTextColor={paltaTheme.color.textMuted}
            style={{
              minHeight: 130,
              padding: paltaTheme.spacing.md,
              borderWidth: 1,
              borderColor: paltaTheme.color.border,
              borderRadius: paltaTheme.radius.control,
              color: paltaTheme.color.textPrimary,
              backgroundColor: paltaTheme.color.canvas,
              fontSize: 15,
            }}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: paltaTheme.spacing.xs }}>
            <FilterChip label="Quiero coordinar visita" selected={visitRequested} onPress={() => setVisitRequested(!visitRequested)} />
            <FilterChip label="Tengo duda de financiamiento" selected={financingQuestion} onPress={() => setFinancingQuestion(!financingQuestion)} />
          </View>
        </View>

        <View
          style={{
            padding: paltaTheme.spacing.md,
            borderRadius: paltaTheme.radius.surface,
            backgroundColor: paltaTheme.color.brandSoft,
            gap: 5,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '900', color: paltaTheme.color.brandPrimary }}>Demo segura</Text>
          <Text style={{ fontSize: 12, lineHeight: 18, color: paltaTheme.color.textSecondary }}>
            Por ahora esta acción guarda una consulta local preparada. El envío real se conectará a Message/Care Core, identidad verificada y WhatsApp/telefonía cuando correspondan.
          </Text>
        </View>

        <PaltaButton
          label={saved ? 'Consulta preparada' : 'Guardar consulta'}
          loading={saving}
          disabled={saved || message.trim().length < 5}
          onPress={() => void saveInquiry()}
        />
        {saved ? <PaltaButton label="Volver a la propiedad" variant="secondary" onPress={() => router.back()} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
