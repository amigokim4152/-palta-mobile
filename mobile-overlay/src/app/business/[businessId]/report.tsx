import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, TextInput, View } from 'react-native';
import { ScreenFrame } from '../../../components/ScreenFrame';
import { mobileRuntime } from '../../../services/paltaClient';

const correctionOptions = [
  { id: 'hours', label: 'El horario está desactualizado', field: 'hours', reason: 'outdated' },
  { id: 'today_hours', label: 'Hoy estaba cerrado o tenía otro horario', field: 'hours', reason: 'temporarily_changed' },
  { id: 'phone', label: 'El teléfono no corresponde', field: 'phone', reason: 'wrong_value' },
  { id: 'whatsapp', label: 'El WhatsApp no corresponde', field: 'whatsapp', reason: 'wrong_value' },
  { id: 'address', label: 'La dirección está incorrecta', field: 'address', reason: 'wrong_value' },
  { id: 'moved', label: 'El negocio se cambió de lugar', field: 'address', reason: 'business_moved' },
  { id: 'closed', label: 'Este negocio cerró', field: 'lifecycle', reason: 'business_closed' },
  { id: 'services', label: 'Los servicios publicados no corresponden', field: 'services', reason: 'wrong_value' },
  { id: 'channel', label: 'Un enlace externo está incorrecto', field: 'channel_link', reason: 'wrong_value' },
] as const;

type CorrectionOption = (typeof correctionOptions)[number];

export default function BusinessFactReportScreen() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const [selected, setSelected] = useState<CorrectionOption | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function submit() {
    if (!businessId || !selected || mobileRuntime.status !== 'ready') return;
    setSubmitting(true);
    setMessage(null);
    try {
      await mobileRuntime.client.corrections.submitBusinessCorrection(businessId, {
        field: selected.field,
        reason: selected.reason,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      setSubmitted(true);
      setMessage(
        'Gracias. Guardamos tu aviso para revisión. Este reporte no cambia automáticamente la ficha del negocio.',
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `No pudimos guardar el aviso: ${error.message}`
          : 'No pudimos guardar el aviso.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenFrame
      title="Corregir información"
      subtitle="Ayúdanos a mantener útil la información local"
    >
      <View style={{ gap: 14 }}>
        <Text style={{ lineHeight: 21, opacity: 0.72 }}>
          Cuéntanos qué dato parece incorrecto. Palta lo tratará como una señal para revisar; no reemplazaremos la información automáticamente sólo por recibir un reporte.
        </Text>

        {correctionOptions.map((option) => {
          const active = selected?.id === option.id;
          return (
            <Pressable
              key={option.id}
              disabled={submitted}
              onPress={() => setSelected(option)}
              style={{
                borderWidth: active ? 2 : 1,
                borderRadius: 14,
                padding: 14,
                opacity: submitted ? 0.55 : 1,
              }}
            >
              <Text style={{ fontWeight: active ? '800' : '600' }}>{option.label}</Text>
            </Pressable>
          );
        })}

        <TextInput
          editable={!submitted}
          value={note}
          onChangeText={setNote}
          placeholder="Detalle opcional: qué viste, cuándo, o cuál dato debería revisarse"
          multiline
          maxLength={1000}
          style={{
            minHeight: 110,
            borderWidth: 1,
            borderRadius: 14,
            padding: 12,
            textAlignVertical: 'top',
          }}
        />

        {!submitted ? (
          <Pressable
            disabled={!selected || submitting}
            onPress={() => void submit()}
            style={{
              borderWidth: 1,
              borderRadius: 14,
              padding: 14,
              opacity: !selected || submitting ? 0.45 : 1,
            }}
          >
            <Text style={{ fontWeight: '800', textAlign: 'center' }}>
              {submitting ? 'Enviando…' : 'Enviar aviso'}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => router.back()}
            style={{ borderWidth: 1, borderRadius: 14, padding: 14 }}
          >
            <Text style={{ fontWeight: '800', textAlign: 'center' }}>Volver al negocio</Text>
          </Pressable>
        )}

        {message ? <Text style={{ lineHeight: 20, opacity: 0.72 }}>{message}</Text> : null}
      </View>
    </ScreenFrame>
  );
}
