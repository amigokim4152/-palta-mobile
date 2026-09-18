import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { paltaTheme } from '../../theme/paltaTheme';
import { findAutosDemoListing } from './autosDemoData';
import { useAutosDemoState } from './autosDemoState';

export function AutosInquiryDemoScreen() {
  const { listingId } = useLocalSearchParams<{ listingId: string }>();
  const demoState = useAutosDemoState();
  const item =
    demoState.publishedListings.find((candidate) => candidate.listing.id === listingId) ??
    findAutosDemoListing(listingId);
  const [message, setMessage] = useState('Hola, ¿el auto sigue disponible? Me gustaría coordinar para verlo.');
  const [sent, setSent] = useState(false);

  if (!item) {
    return (
      <SafeAreaView style={{ flex: 1, padding: paltaTheme.spacing.xl, backgroundColor: paltaTheme.color.canvas }}>
        <Text style={{ fontSize: 18, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Publicación no disponible</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: paltaTheme.spacing.md, paddingBottom: 48, gap: paltaTheme.spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: paltaTheme.spacing.sm }}>
          <Pressable onPress={() => router.back()} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 24, color: paltaTheme.color.textPrimary }}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 25, fontWeight: '900', color: paltaTheme.color.textPrimary }}>Consultar</Text>
            <Text style={{ marginTop: 2, fontSize: 12, color: paltaTheme.color.textMuted }}>Mensaje sobre esta publicación</Text>
          </View>
        </View>

        <View style={{ padding: paltaTheme.spacing.md, borderRadius: paltaTheme.radius.surface, borderWidth: 1, borderColor: paltaTheme.color.divider, backgroundColor: paltaTheme.color.surface }}>
          <Text style={{ fontSize: 16, fontWeight: '900', color: paltaTheme.color.textPrimary }}>{item.listing.title}</Text>
          <Text style={{ marginTop: 4, fontSize: 13, color: paltaTheme.color.brandPrimary }}>
            ${new Intl.NumberFormat('es-CL').format(item.listing.priceClp)}
          </Text>
          <Text style={{ marginTop: 3, fontSize: 12, color: paltaTheme.color.textMuted }}>{item.listing.comuna}</Text>
        </View>

        {sent ? (
          <View style={{ padding: paltaTheme.spacing.lg, borderRadius: paltaTheme.radius.surface, backgroundColor: paltaTheme.color.brandSoft, gap: 6 }}>
            <Text style={{ fontSize: 17, fontWeight: '900', color: paltaTheme.color.brandPrimary }}>Consulta enviada · demo</Text>
            <Text style={{ fontSize: 13, lineHeight: 19, color: paltaTheme.color.textSecondary }}>
              La conversación queda asociada al listingId y al vendedor. Al conectar Messaging Core, este handoff conservará el mismo contexto.
            </Text>
            <Pressable onPress={() => router.replace('/autos')} style={{ marginTop: paltaTheme.spacing.sm }}>
              <Text style={{ fontWeight: '900', color: paltaTheme.color.brandPrimary }}>Volver a Autos ›</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={{ gap: paltaTheme.spacing.xs }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: paltaTheme.color.textSecondary }}>Tu mensaje</Text>
              <TextInput
                value={message}
                onChangeText={setMessage}
                multiline
                textAlignVertical="top"
                placeholder="Escribe tu consulta"
                placeholderTextColor={paltaTheme.color.textMuted}
                style={{ minHeight: 150, padding: paltaTheme.spacing.md, borderRadius: paltaTheme.radius.surface, borderWidth: 1, borderColor: paltaTheme.color.divider, backgroundColor: paltaTheme.color.surface, color: paltaTheme.color.textPrimary }}
              />
            </View>

            <View style={{ padding: paltaTheme.spacing.md, borderRadius: paltaTheme.radius.surface, backgroundColor: paltaTheme.color.surfaceMuted }}>
              <Text style={{ fontSize: 12, lineHeight: 18, color: paltaTheme.color.textSecondary }}>
                Palta no necesita exponer tu teléfono al vendedor para iniciar la conversación. Si después ambas partes prefieren WhatsApp, el traspaso puede ser explícito.
              </Text>
            </View>

            <Pressable
              disabled={!message.trim()}
              onPress={() => setSent(true)}
              style={({ pressed }) => ({
                minHeight: 54,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: paltaTheme.radius.surface,
                backgroundColor: pressed ? paltaTheme.color.brandMid : paltaTheme.color.brandPrimary,
                opacity: message.trim() ? 1 : 0.45,
              })}
            >
              <Text style={{ fontSize: 15, fontWeight: '900', color: paltaTheme.color.surface }}>Enviar consulta</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
