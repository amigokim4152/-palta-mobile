import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Linking,
  Pressable,
  SafeAreaView,
  Text,
  View,
} from 'react-native';

import type { BusinessApiDetail } from '../../../../src/api/paltaApiClient';
import { PaltaApiError } from '../../../../src/api/paltaApiClient';
import {
  getAuthenticatedMobileRuntime,
  mobileRuntime,
} from '../../services/paltaClient';
import { paltaTheme } from '../../theme/paltaTheme';

function whatsappUrl(business?: BusinessApiDetail): string | undefined {
  const publicLink = business?.channel_links?.find((link) => link.provider === 'whatsapp')?.url;
  if (publicLink) return publicLink;
  const raw = business?.contact?.whatsapp?.trim();
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) return raw;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return undefined;
  const normalized = digits.startsWith('56')
    ? digits
    : digits.length === 9 && digits.startsWith('9')
      ? `56${digits}`
      : digits;
  return `https://wa.me/${normalized}`;
}

function phoneUrl(business?: BusinessApiDetail): string | undefined {
  const raw = business?.contact?.phone?.trim();
  if (!raw) return undefined;
  const dialable = raw.replace(/[^+\d]/g, '');
  return dialable ? `tel:${dialable}` : undefined;
}

export function BusinessConversationEntryScreen() {
  const { businessId } = useLocalSearchParams<{ businessId?: string }>();
  const [business, setBusiness] = useState<BusinessApiDetail | undefined>();
  const [message, setMessage] = useState('Abriendo la conversación…');
  const [retryKey, setRetryKey] = useState(0);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!businessId) {
        setMessage('No encontramos el negocio para esta consulta.');
        setUnavailable(true);
        return;
      }

      setUnavailable(false);
      setMessage('Abriendo la conversación…');

      let loadedBusiness: BusinessApiDetail | undefined;
      if (mobileRuntime.status === 'ready') {
        try {
          loadedBusiness = await mobileRuntime.client.getBusiness(businessId);
          if (active) setBusiness(loadedBusiness);
        } catch {
          // Business detail is useful for title/fallback channels but is not an
          // authorization prerequisite for Shared Messaging.
        }
      }

      const runtime = getAuthenticatedMobileRuntime();
      if (runtime.status !== 'ready') {
        if (!active) return;
        setMessage(runtime.message);
        setUnavailable(true);
        return;
      }

      try {
        const conversation = await runtime.client.messaging.openBusinessConversation(businessId);
        if (!active) return;
        router.replace({
          pathname: '/messages/[conversationId]',
          params: {
            conversationId: conversation.conversation_id,
            businessId,
            businessName: loadedBusiness?.name ?? business?.name ?? 'Negocio',
          },
        });
      } catch (error) {
        if (!active) return;
        const expectedUnavailable =
          error instanceof PaltaApiError && [403, 404, 409, 422].includes(error.status);
        setMessage(
          expectedUnavailable
            ? 'Este negocio todavía no atiende consultas por Palta.'
            : 'No pudimos abrir la conversación. Puedes volver a intentar.',
        );
        setUnavailable(true);
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, [businessId, retryKey]);

  const whatsapp = whatsappUrl(business);
  const phone = phoneUrl(business);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: paltaTheme.color.canvas }}>
      <View
        style={{
          flex: 1,
          padding: paltaTheme.spacing.md,
          justifyContent: 'center',
          gap: paltaTheme.spacing.md,
        }}
      >
        <View style={{ gap: paltaTheme.spacing.xs }}>
          <Text
            style={{
              fontSize: 24,
              fontWeight: '800',
              color: paltaTheme.color.textPrimary,
            }}
          >
            {business?.name ?? 'Consulta'}
          </Text>
          <Text style={{ lineHeight: 21, color: paltaTheme.color.textSecondary }}>
            {message}
          </Text>
        </View>

        {unavailable ? (
          <View style={{ gap: paltaTheme.spacing.sm }}>
            <Pressable
              onPress={() => setRetryKey((value) => value + 1)}
              style={({ pressed }) => ({
                minHeight: paltaTheme.touch.minimum,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: paltaTheme.radius.control,
                backgroundColor: pressed
                  ? paltaTheme.color.brandSoft
                  : paltaTheme.color.brandPrimary,
              })}
            >
              <Text style={{ fontWeight: '800', color: '#FFFFFF' }}>Reintentar</Text>
            </Pressable>

            {whatsapp ? (
              <Pressable
                onPress={() => void Linking.openURL(whatsapp)}
                style={({ pressed }) => ({
                  minHeight: paltaTheme.touch.minimum,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: paltaTheme.radius.control,
                  backgroundColor: pressed
                    ? paltaTheme.color.surfaceMuted
                    : paltaTheme.color.surface,
                })}
              >
                <Text style={{ fontWeight: '800', color: paltaTheme.color.textPrimary }}>
                  Abrir WhatsApp
                </Text>
              </Pressable>
            ) : null}

            {phone ? (
              <Pressable
                onPress={() => void Linking.openURL(phone)}
                style={({ pressed }) => ({
                  minHeight: paltaTheme.touch.minimum,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: paltaTheme.radius.control,
                  backgroundColor: pressed
                    ? paltaTheme.color.surfaceMuted
                    : paltaTheme.color.surface,
                })}
              >
                <Text style={{ fontWeight: '800', color: paltaTheme.color.textPrimary }}>
                  Llamar
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => ({
                minHeight: paltaTheme.touch.minimum,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.65 : 1,
              })}
            >
              <Text style={{ fontWeight: '800', color: paltaTheme.color.textSecondary }}>
                Volver al negocio
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
