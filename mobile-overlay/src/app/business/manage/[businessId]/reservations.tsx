import { useCallback, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { BusinessReservationInboxItem } from '../../../../../../src/api/businessReservationsApiClient';
import { EmptyState, ErrorState, LoadingState } from '../../../../components/AsyncStateBlock';
import { ScreenFrame } from '../../../../components/ScreenFrame';
import { useAsyncResource } from '../../../../hooks/useAsyncResource';
import { mobileRuntime } from '../../../../services/paltaClient';
import { paltaTheme } from '../../../../theme/paltaTheme';

function statusLabel(item: BusinessReservationInboxItem): string {
  switch (item.status) {
    case 'confirmed': return 'CONFIRMADA';
    case 'declined': return 'NO DISPONIBLE';
    case 'cancelled': return 'CANCELADA';
    default: return 'ESPERANDO TU RESPUESTA';
  }
}

export default function BusinessReservationInboxScreen() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!businessId) throw new Error('Business ID missing');
    if (mobileRuntime.status !== 'ready') throw new Error(mobileRuntime.message);
    const business = await mobileRuntime.client.getBusiness(businessId);
    if (business.verification_status !== 'verified') {
      throw new Error('Sólo un propietario verificado puede gestionar solicitudes de reserva.');
    }
    return mobileRuntime.client.reservations.getBusinessInbox(businessId);
  }, [businessId]);

  const { state, refresh } = useAsyncResource(load, {
    isEmpty: (response) => response.items.length === 0,
  });

  function beginDecision(item: BusinessReservationInboxItem) {
    setEditingId(item.id);
    setNote(item.owner_note ?? '');
    setMessage(null);
  }

  async function respond(decision: 'confirmed' | 'declined') {
    if (!businessId || !editingId || mobileRuntime.status !== 'ready') return;
    setSubmitting(true);
    setMessage(null);
    try {
      await mobileRuntime.client.reservations.respond(editingId, businessId, {
        decision,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      setEditingId(null);
      setNote('');
      setMessage(
        decision === 'confirmed'
          ? 'Reserva confirmada. Palta actualizó el mismo seguimiento del usuario.'
          : 'Marcaste que no hay disponibilidad. Palta actualizó el mismo seguimiento del usuario.',
      );
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No pudimos guardar la decisión.');
    } finally {
      setSubmitting(false);
    }
  }

  if (state.status === 'loading' && !state.data) {
    return (
      <ScreenFrame title="Reservas">
        <LoadingState label="Cargando solicitudes…" />
      </ScreenFrame>
    );
  }

  if (state.status === 'error' && !state.data) {
    return (
      <ScreenFrame title="Reservas">
        <ErrorState message={state.message} onRetry={() => void refresh()} />
      </ScreenFrame>
    );
  }

  const items = state.data?.items ?? [];

  return (
    <ScreenFrame title="Reservas" subtitle="Solicitudes enviadas a este negocio">
      <View style={{ gap: paltaTheme.spacing.sm }}>
        <View
          style={{
            padding: paltaTheme.spacing.md,
            borderRadius: paltaTheme.radius.surface,
            backgroundColor: paltaTheme.color.surfaceMuted,
          }}
        >
          <Text style={{ color: paltaTheme.color.textSecondary, lineHeight: 20 }}>
            Una solicitud enviada por WhatsApp no es una reserva confirmada. Confirma o indica que no hay disponibilidad sólo cuando tu negocio haya revisado realmente la solicitud.
          </Text>
        </View>

        {message ? (
          <Text style={{ color: paltaTheme.color.textSecondary, lineHeight: 20 }}>{message}</Text>
        ) : null}

        {items.length === 0 ? (
          <EmptyState
            title="No hay solicitudes de reserva"
            body="Cuando una persona confirme en Palta que envió una solicitud por WhatsApp, aparecerá aquí."
          />
        ) : (
          items.map((item) => {
            const editing = editingId === item.id;
            return (
              <View
                key={item.id}
                style={{
                  gap: paltaTheme.spacing.sm,
                  padding: paltaTheme.spacing.md,
                  borderWidth: 1,
                  borderColor: item.can_respond ? paltaTheme.color.brandFresh : paltaTheme.color.divider,
                  borderRadius: paltaTheme.radius.surface,
                  backgroundColor: paltaTheme.color.surface,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: paltaTheme.spacing.sm }}>
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 12,
                      fontWeight: '800',
                      color: item.can_respond ? paltaTheme.color.brandPrimary : paltaTheme.color.textMuted,
                    }}
                  >
                    {statusLabel(item)}
                  </Text>
                  <Text style={{ fontSize: 12, color: paltaTheme.color.textMuted }}>
                    {new Date(item.created_at).toLocaleDateString('es-CL')}
                  </Text>
                </View>

                <Text style={{ fontSize: 17, fontWeight: '800', color: paltaTheme.color.textPrimary }}>
                  {new Date(item.requested_for).toLocaleString('es-CL')}
                </Text>
                {item.note ? (
                  <Text style={{ color: paltaTheme.color.textSecondary, lineHeight: 20 }}>{item.note}</Text>
                ) : null}
                {item.owner_note ? (
                  <View
                    style={{
                      padding: paltaTheme.spacing.sm,
                      borderRadius: paltaTheme.radius.control,
                      backgroundColor: paltaTheme.color.surfaceMuted,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '800', color: paltaTheme.color.textMuted }}>
                      TU RESPUESTA
                    </Text>
                    <Text style={{ color: paltaTheme.color.textSecondary, lineHeight: 20 }}>{item.owner_note}</Text>
                  </View>
                ) : null}

                {item.can_respond ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => beginDecision(item)}
                    style={({ pressed }) => ({
                      minHeight: paltaTheme.touch.minimum,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: paltaTheme.radius.control,
                      backgroundColor: pressed ? paltaTheme.color.brandMid : paltaTheme.color.brandPrimary,
                    })}
                  >
                    <Text style={{ color: paltaTheme.color.surface, fontWeight: '800' }}>Responder</Text>
                  </Pressable>
                ) : null}

                {editing ? (
                  <View style={{ gap: paltaTheme.spacing.sm }}>
                    <TextInput
                      value={note}
                      onChangeText={setNote}
                      multiline
                      maxLength={2000}
                      placeholder="Mensaje opcional para la confirmación o falta de disponibilidad"
                      placeholderTextColor={paltaTheme.color.textMuted}
                      style={{
                        minHeight: 92,
                        padding: paltaTheme.spacing.sm,
                        borderWidth: 1,
                        borderColor: paltaTheme.color.border,
                        borderRadius: paltaTheme.radius.control,
                        color: paltaTheme.color.textPrimary,
                        backgroundColor: paltaTheme.color.canvas,
                        textAlignVertical: 'top',
                      }}
                    />
                    <View style={{ flexDirection: 'row', gap: paltaTheme.spacing.xs }}>
                      <Pressable
                        accessibilityRole="button"
                        disabled={submitting}
                        onPress={() => void respond('confirmed')}
                        style={({ pressed }) => ({
                          flex: 1,
                          minHeight: paltaTheme.touch.minimum,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: paltaTheme.radius.control,
                          backgroundColor: pressed ? paltaTheme.color.brandMid : paltaTheme.color.brandPrimary,
                          opacity: submitting ? 0.6 : 1,
                        })}
                      >
                        <Text style={{ color: paltaTheme.color.surface, fontWeight: '800' }}>
                          {submitting ? 'Guardando…' : 'Confirmar'}
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        disabled={submitting}
                        onPress={() => void respond('declined')}
                        style={({ pressed }) => ({
                          flex: 1,
                          minHeight: paltaTheme.touch.minimum,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: paltaTheme.radius.control,
                          backgroundColor: pressed ? paltaTheme.color.surfaceMuted : paltaTheme.color.canvas,
                          borderWidth: 1,
                          borderColor: paltaTheme.color.border,
                          opacity: submitting ? 0.6 : 1,
                        })}
                      >
                        <Text style={{ color: paltaTheme.color.textSecondary, fontWeight: '800' }}>No disponible</Text>
                      </Pressable>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      disabled={submitting}
                      onPress={() => setEditingId(null)}
                      style={{ alignItems: 'center', paddingVertical: paltaTheme.spacing.xs }}
                    >
                      <Text style={{ color: paltaTheme.color.textMuted, fontWeight: '700' }}>Volver</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })
        )}

        {state.status === 'error' && state.data ? (
          <ErrorState message={state.message} onRetry={() => void refresh()} />
        ) : null}
      </View>
    </ScreenFrame>
  );
}
