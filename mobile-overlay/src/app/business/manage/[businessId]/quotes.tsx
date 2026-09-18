import { useCallback, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { BusinessQuoteInboxItem } from '../../../../../../src/api/businessQuotesApiClient';
import { EmptyState, ErrorState, LoadingState } from '../../../../components/AsyncStateBlock';
import { ScreenFrame } from '../../../../components/ScreenFrame';
import { useAsyncResource } from '../../../../hooks/useAsyncResource';
import { mobileRuntime } from '../../../../services/paltaClient';
import { paltaTheme } from '../../../../theme/paltaTheme';

function statusCopy(item: BusinessQuoteInboxItem): { label: string; attention: boolean } {
  if (item.selected) return { label: 'Te eligieron', attention: false };
  if (item.status === 'selected') return { label: 'Solicitud cerrada', attention: false };
  if (item.status === 'completed') return { label: 'Finalizada', attention: false };
  if (item.status === 'cancelled') return { label: 'Cancelada', attention: false };
  if (item.response) return { label: 'Respondida', attention: false };
  return { label: 'Esperando tu respuesta', attention: true };
}

function parseClp(value: string): number | undefined {
  const digits = value.replace(/\D/g, '');
  if (!digits) return undefined;
  const amount = Number(digits);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : undefined;
}

function formatClp(value?: number): string | undefined {
  if (value === undefined) return undefined;
  return `$${value.toLocaleString('es-CL')}`;
}

export default function BusinessQuoteInboxScreen() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!businessId) throw new Error('Business ID missing');
    if (mobileRuntime.status !== 'ready') throw new Error(mobileRuntime.message);
    return mobileRuntime.client.quotes.getBusinessInbox(businessId);
  }, [businessId]);

  const { state, refresh } = useAsyncResource(load, {
    isEmpty: (response) => response.items.length === 0,
  });

  function beginResponse(item: BusinessQuoteInboxItem) {
    setEditingId(item.id);
    setAmountText(item.response?.amount_clp !== undefined ? String(item.response.amount_clp) : '');
    setNote(item.response?.note ?? '');
    setMessage(null);
  }

  async function submitResponse() {
    if (!businessId || !editingId || mobileRuntime.status !== 'ready') return;
    const amountClp = parseClp(amountText);
    const cleanNote = note.trim();
    if (amountText.trim() && amountClp === undefined) {
      setMessage('Revisa el monto. Usa sólo un valor válido en pesos chilenos.');
      return;
    }
    if (amountClp === undefined && !cleanNote) {
      setMessage('Agrega un monto o una nota antes de responder.');
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      await mobileRuntime.client.quotes.submitBusinessResponse(editingId, businessId, {
        ...(amountClp !== undefined ? { amountClp } : {}),
        ...(cleanNote ? { note: cleanNote } : {}),
      });
      setEditingId(null);
      setAmountText('');
      setNote('');
      setMessage('Respuesta guardada. La persona podrá compararla dentro de su solicitud.');
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No pudimos guardar la respuesta.');
    } finally {
      setSubmitting(false);
    }
  }

  if (state.status === 'loading' && !state.data) {
    return (
      <ScreenFrame title="Cotizaciones">
        <LoadingState label="Cargando solicitudes…" />
      </ScreenFrame>
    );
  }

  if (state.status === 'error' && !state.data) {
    return (
      <ScreenFrame title="Cotizaciones">
        <ErrorState message={state.message} onRetry={() => void refresh()} />
      </ScreenFrame>
    );
  }

  const items = state.data?.items ?? [];

  return (
    <ScreenFrame
      title="Cotizaciones"
      subtitle="Solicitudes reales enviadas a este negocio"
    >
      <View style={{ gap: paltaTheme.spacing.sm }}>
        <View
          style={{
            padding: paltaTheme.spacing.md,
            borderRadius: paltaTheme.radius.surface,
            backgroundColor: paltaTheme.color.surfaceMuted,
          }}
        >
          <Text style={{ color: paltaTheme.color.textSecondary, lineHeight: 20 }}>
            Aquí sólo ves la solicitud y la respuesta de tu propio negocio. Palta no muestra a un negocio los montos, notas ni identidad de las respuestas de otros negocios.
          </Text>
        </View>

        {message ? (
          <Text style={{ color: paltaTheme.color.textSecondary, lineHeight: 20 }}>{message}</Text>
        ) : null}

        {items.length === 0 ? (
          <EmptyState
            title="No hay solicitudes pendientes"
            body="Cuando una persona incluya este negocio en una cotización, aparecerá aquí."
          />
        ) : (
          items.map((item) => {
            const status = statusCopy(item);
            const editing = editingId === item.id;
            return (
              <View
                key={item.id}
                style={{
                  padding: paltaTheme.spacing.md,
                  gap: paltaTheme.spacing.sm,
                  borderWidth: 1,
                  borderColor: status.attention
                    ? paltaTheme.color.brandFresh
                    : paltaTheme.color.divider,
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
                      color: status.attention
                        ? paltaTheme.color.brandPrimary
                        : paltaTheme.color.textMuted,
                    }}
                  >
                    {status.label.toUpperCase()}
                  </Text>
                  <Text style={{ fontSize: 12, color: paltaTheme.color.textMuted }}>
                    {new Date(item.created_at).toLocaleDateString('es-CL')}
                  </Text>
                </View>

                <Text
                  style={{
                    fontSize: 17,
                    lineHeight: 23,
                    fontWeight: '800',
                    color: paltaTheme.color.textPrimary,
                  }}
                >
                  {item.description}
                </Text>

                {item.requested_for ? (
                  <Text style={{ color: paltaTheme.color.textSecondary }}>
                    Solicitado para {new Date(item.requested_for).toLocaleString('es-CL')}
                  </Text>
                ) : null}

                {item.response ? (
                  <View
                    style={{
                      gap: paltaTheme.spacing.xxs,
                      padding: paltaTheme.spacing.sm,
                      borderRadius: paltaTheme.radius.control,
                      backgroundColor: paltaTheme.color.surfaceMuted,
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '800', color: paltaTheme.color.textMuted }}>
                      TU RESPUESTA
                    </Text>
                    {item.response.amount_clp !== undefined ? (
                      <Text style={{ fontWeight: '800', color: paltaTheme.color.textPrimary }}>
                        {formatClp(item.response.amount_clp)}
                      </Text>
                    ) : null}
                    {item.response.note ? (
                      <Text style={{ color: paltaTheme.color.textSecondary, lineHeight: 20 }}>
                        {item.response.note}
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                {item.can_respond ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => beginResponse(item)}
                    style={({ pressed }) => ({
                      minHeight: paltaTheme.touch.minimum,
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: paltaTheme.spacing.md,
                      borderRadius: paltaTheme.radius.control,
                      backgroundColor: pressed
                        ? paltaTheme.color.brandMid
                        : paltaTheme.color.brandPrimary,
                    })}
                  >
                    <Text style={{ color: paltaTheme.color.surface, fontWeight: '800' }}>
                      {item.response ? 'Actualizar respuesta' : 'Responder'}
                    </Text>
                  </Pressable>
                ) : null}

                {editing ? (
                  <View style={{ gap: paltaTheme.spacing.sm }}>
                    <TextInput
                      value={amountText}
                      onChangeText={setAmountText}
                      keyboardType="number-pad"
                      placeholder="Monto CLP (opcional)"
                      placeholderTextColor={paltaTheme.color.textMuted}
                      style={{
                        minHeight: paltaTheme.touch.minimum,
                        paddingHorizontal: paltaTheme.spacing.sm,
                        borderWidth: 1,
                        borderColor: paltaTheme.color.border,
                        borderRadius: paltaTheme.radius.control,
                        color: paltaTheme.color.textPrimary,
                        backgroundColor: paltaTheme.color.canvas,
                      }}
                    />
                    <TextInput
                      value={note}
                      onChangeText={setNote}
                      multiline
                      placeholder="Qué incluye, disponibilidad u otra información útil"
                      placeholderTextColor={paltaTheme.color.textMuted}
                      style={{
                        minHeight: 96,
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
                        onPress={() => void submitResponse()}
                        style={({ pressed }) => ({
                          flex: 1,
                          minHeight: paltaTheme.touch.minimum,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: paltaTheme.radius.control,
                          backgroundColor: pressed
                            ? paltaTheme.color.brandMid
                            : paltaTheme.color.brandPrimary,
                          opacity: submitting ? 0.6 : 1,
                        })}
                      >
                        <Text style={{ color: paltaTheme.color.surface, fontWeight: '800' }}>
                          {submitting ? 'Guardando…' : 'Guardar respuesta'}
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        disabled={submitting}
                        onPress={() => setEditingId(null)}
                        style={({ pressed }) => ({
                          minHeight: paltaTheme.touch.minimum,
                          alignItems: 'center',
                          justifyContent: 'center',
                          paddingHorizontal: paltaTheme.spacing.md,
                          borderRadius: paltaTheme.radius.control,
                          backgroundColor: pressed
                            ? paltaTheme.color.surfaceMuted
                            : paltaTheme.color.canvas,
                        })}
                      >
                        <Text style={{ fontWeight: '800', color: paltaTheme.color.textSecondary }}>
                          Cancelar
                        </Text>
                      </Pressable>
                    </View>
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