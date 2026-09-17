import { useCallback, useEffect, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, TextInput, View } from 'react-native';
import { ErrorState, LoadingState } from '../../../../components/AsyncStateBlock';
import { ScreenFrame } from '../../../../components/ScreenFrame';
import { SectionHeading } from '../../../../components/common/SectionHeading';
import { useAsyncResource } from '../../../../hooks/useAsyncResource';
import { mobileRuntime } from '../../../../services/paltaClient';
import type {
  BusinessOperatingInterval,
  BusinessWeekday,
  BusinessWeeklySchedule,
} from '../../../../../../src/business/businessOperatingRules';
import type { BusinessOperationalState } from '../../../../../../src/business/businessOperationalState';

const days: readonly { key: BusinessWeekday; label: string }[] = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

function stateLabel(state?: BusinessOperationalState): string {
  switch (state) {
    case 'open_now': return 'Abierto ahora';
    case 'closed_now': return 'Cerrado ahora';
    case 'closed_today': return 'Cerrado hoy';
    case 'temporarily_closed': return 'Cerrado temporalmente';
    case 'seasonal_closed': return 'Cerrado por temporada';
    case 'paused': return 'Atención pausada';
    case 'permanently_closed': return 'Cerrado permanentemente';
    default: return 'Horario por confirmar';
  }
}

function cloneWeekly(weekly: BusinessWeeklySchedule): Record<BusinessWeekday, BusinessOperatingInterval[]> {
  return Object.fromEntries(
    days.map(({ key }) => [
      key,
      (weekly[key] ?? []).map((interval) => ({ ...interval })),
    ]),
  ) as Record<BusinessWeekday, BusinessOperatingInterval[]>;
}

function validTime(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [hour, minute] = value.split(':').map(Number);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

function validateWeekly(weekly: Record<BusinessWeekday, BusinessOperatingInterval[]>): string | null {
  for (const { key, label } of days) {
    for (const interval of weekly[key]) {
      if (!validTime(interval.opensAt) || !validTime(interval.closesAt)) {
        return `Revisa el horario de ${label}. Usa formato 24 horas, por ejemplo 09:00.`;
      }
      if (interval.opensAt === interval.closesAt) {
        return `${label}: la hora de apertura y cierre no pueden ser iguales.`;
      }
    }
  }
  return null;
}

export default function BusinessOperatingHoursScreen() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const [weekly, setWeekly] = useState<Record<BusinessWeekday, BusinessOperatingInterval[]> | null>(null);
  const [todayOpen, setTodayOpen] = useState('12:00');
  const [todayClose, setTodayClose] = useState('18:00');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [initializedFor, setInitializedFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!businessId) throw new Error('Business ID missing');
    if (mobileRuntime.status !== 'ready') throw new Error(mobileRuntime.message);
    const [business, operating] = await Promise.all([
      mobileRuntime.client.getBusiness(businessId),
      mobileRuntime.client.operatingRules.get(businessId),
    ]);
    return { business, operating };
  }, [businessId]);

  const { state, refresh } = useAsyncResource(load);
  const business = state.data?.business;
  const operating = state.data?.operating;

  useEffect(() => {
    if (!business || !operating || initializedFor === business.id) return;
    setWeekly(cloneWeekly(operating.rules.weekly));
    setInitializedFor(business.id);
  }, [business, operating, initializedFor]);

  const activeTemporaryClosure = useMemo(() => {
    const now = Date.now();
    return operating?.rules.temporaryClosures?.find((closure) => {
      const from = Date.parse(closure.effectiveFrom);
      const until = Date.parse(closure.effectiveUntil);
      return Number.isFinite(from) && Number.isFinite(until) && from <= now && now < until;
    });
  }, [operating]);

  const seasonalRuleCount =
    (operating?.rules.seasonalSchedules?.length ?? 0) +
    (operating?.rules.seasonalClosures?.length ?? 0);

  function changeInterval(
    weekday: BusinessWeekday,
    index: number,
    field: 'opensAt' | 'closesAt',
    value: string,
  ) {
    setWeekly((current) => {
      if (!current) return current;
      const next = { ...current, [weekday]: current[weekday].map((item) => ({ ...item })) };
      next[weekday][index] = { ...next[weekday][index], [field]: value };
      return next;
    });
  }

  function addInterval(weekday: BusinessWeekday) {
    setWeekly((current) => {
      if (!current) return current;
      return {
        ...current,
        [weekday]: [...current[weekday], { opensAt: '09:00', closesAt: '18:00' }],
      };
    });
  }

  function removeInterval(weekday: BusinessWeekday, index: number) {
    setWeekly((current) => {
      if (!current) return current;
      return {
        ...current,
        [weekday]: current[weekday].filter((_, itemIndex) => itemIndex !== index),
      };
    });
  }

  async function saveWeekly() {
    if (!businessId || !weekly || mobileRuntime.status !== 'ready') return;
    const validation = validateWeekly(weekly);
    if (validation) {
      setMessage(validation);
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await mobileRuntime.client.operatingRules.replaceWeeklySchedule(businessId, {
        timezone: operating?.rules.timezone ?? 'America/Santiago',
        weekly,
      });
      setInitializedFor(null);
      await refresh();
      setMessage('Guardamos tu horario normal. Palta calculará el estado automáticamente.');
    } catch (error) {
      setMessage(error instanceof Error ? `No se pudo guardar: ${error.message}` : 'No se pudo guardar el horario.');
    } finally {
      setSaving(false);
    }
  }

  async function runQuickAction(
    action:
      | { action: 'close_today' }
      | { action: 'clear_today_exception' }
      | { action: 'set_today_hours'; intervals: BusinessOperatingInterval[] }
      | { action: 'close_temporarily'; effectiveUntil: string }
      | { action: 'clear_temporary_closure'; closureId: string },
    successMessage: string,
  ) {
    if (!businessId || mobileRuntime.status !== 'ready') return;
    setSaving(true);
    setMessage(null);
    try {
      await mobileRuntime.client.operatingRules.quickAction(businessId, action);
      setInitializedFor(null);
      await refresh();
      setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? `No se pudo actualizar: ${error.message}` : 'No se pudo actualizar el estado.');
    } finally {
      setSaving(false);
    }
  }

  if (state.status === 'loading' && !state.data) {
    return (
      <ScreenFrame title="Horarios">
        <LoadingState label="Cargando horarios…" />
      </ScreenFrame>
    );
  }

  if (state.status === 'error' && !state.data) {
    return (
      <ScreenFrame title="Horarios">
        <ErrorState message={state.message} onRetry={() => void refresh()} />
      </ScreenFrame>
    );
  }

  if (!business || !operating || !weekly) return null;

  return (
    <ScreenFrame
      title="Horarios"
      subtitle={business.name}
      action={
        <Pressable onPress={() => router.back()} style={{ paddingVertical: 8 }}>
          <Text style={{ fontWeight: '800' }}>Volver</Text>
        </Pressable>
      }
    >
      <View style={{ gap: 18 }}>
        <View style={{ borderWidth: 1, borderRadius: 14, padding: 14, gap: 5 }}>
          <Text style={{ fontSize: 12, fontWeight: '800', opacity: 0.58 }}>HOY</Text>
          <Text style={{ fontSize: 19, fontWeight: '800' }}>
            {stateLabel(operating.projection.operational_state)}
          </Text>
          <Text style={{ opacity: 0.66 }}>
            {operating.projection.local_date} · {operating.projection.local_time}
          </Text>
          {operating.projection.next_open_local ? (
            <Text style={{ opacity: 0.68 }}>
              Próxima apertura: {operating.projection.next_open_local.localDate} · {operating.projection.next_open_local.localTime}
            </Text>
          ) : null}
        </View>

        <SectionHeading
          title="Cambio sólo por hoy"
          subtitle="No modifica tu horario normal de la próxima semana."
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Pressable
            disabled={saving}
            onPress={() => void runQuickAction(
              { action: 'close_today' },
              'Marcamos el negocio como cerrado sólo por hoy.',
            )}
            style={{ borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, opacity: saving ? 0.55 : 1 }}
          >
            <Text style={{ fontWeight: '800' }}>Cerrar hoy</Text>
          </Pressable>
          <Pressable
            disabled={saving}
            onPress={() => void runQuickAction(
              { action: 'clear_today_exception' },
              'Hoy vuelve a seguir tu horario normal.',
            )}
            style={{ borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, opacity: saving ? 0.55 : 1 }}
          >
            <Text style={{ fontWeight: '800' }}>Usar horario normal</Text>
          </Pressable>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={{ fontWeight: '800' }}>Horario especial de hoy</Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TextInput
              value={todayOpen}
              onChangeText={setTodayOpen}
              placeholder="12:00"
              autoCapitalize="none"
              style={{ borderWidth: 1, borderRadius: 12, padding: 10, minWidth: 90 }}
            />
            <Text>–</Text>
            <TextInput
              value={todayClose}
              onChangeText={setTodayClose}
              placeholder="18:00"
              autoCapitalize="none"
              style={{ borderWidth: 1, borderRadius: 12, padding: 10, minWidth: 90 }}
            />
            <Pressable
              disabled={saving}
              onPress={() => {
                if (!validTime(todayOpen) || !validTime(todayClose) || todayOpen === todayClose) {
                  setMessage('Revisa el horario especial. Usa formato 24 horas, por ejemplo 12:00–18:00.');
                  return;
                }
                void runQuickAction(
                  { action: 'set_today_hours', intervals: [{ opensAt: todayOpen, closesAt: todayClose }] },
                  'Guardamos el horario especial sólo para hoy.',
                );
              }}
              style={{ borderWidth: 1, borderRadius: 12, padding: 10, opacity: saving ? 0.55 : 1 }}
            >
              <Text style={{ fontWeight: '800' }}>Aplicar</Text>
            </Pressable>
          </View>
        </View>

        <SectionHeading
          title="Cierre temporal"
          subtitle="Úsalo para vacaciones, arreglos o una pausa excepcional."
        />
        {activeTemporaryClosure ? (
          <View style={{ gap: 8 }}>
            <Text style={{ opacity: 0.68 }}>
              Cierre activo hasta {new Date(activeTemporaryClosure.effectiveUntil).toLocaleString('es-CL')}.
            </Text>
            <Pressable
              disabled={saving}
              onPress={() => void runQuickAction(
                { action: 'clear_temporary_closure', closureId: activeTemporaryClosure.id },
                'Quitamos el cierre temporal. Palta vuelve a usar tu horario normal y excepciones vigentes.',
              )}
              style={{ borderWidth: 1, borderRadius: 12, padding: 12, opacity: saving ? 0.55 : 1 }}
            >
              <Text style={{ textAlign: 'center', fontWeight: '800' }}>Reabrir / terminar pausa</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            disabled={saving}
            onPress={() => void runQuickAction(
              {
                action: 'close_temporarily',
                effectiveUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              },
              'Marcamos un cierre temporal por 7 días. Puedes terminarlo antes desde aquí.',
            )}
            style={{ borderWidth: 1, borderRadius: 12, padding: 12, opacity: saving ? 0.55 : 1 }}
          >
            <Text style={{ textAlign: 'center', fontWeight: '800' }}>Cerrar por 7 días</Text>
          </Pressable>
        )}

        <SectionHeading
          title="Temporadas"
          subtitle="Para negocios que cambian su horario o cierran según la época del año."
        />
        <Pressable
          onPress={() =>
            router.push(`/business/manage/${encodeURIComponent(business.id)}/seasons`)
          }
          style={{ borderWidth: 1, borderRadius: 14, padding: 14, gap: 5 }}
        >
          <Text style={{ fontWeight: '800', fontSize: 16 }}>Horario de temporada</Text>
          <Text style={{ opacity: 0.68, lineHeight: 20 }}>
            {seasonalRuleCount > 0
              ? `${seasonalRuleCount} regla${seasonalRuleCount === 1 ? '' : 's'} guardada${seasonalRuleCount === 1 ? '' : 's'}. Ejemplo: mayo–agosto sólo viernes, sábado y domingo.`
              : 'Configura una vez reglas como “mayo–agosto sólo viernes, sábado y domingo” o un cierre completo de temporada.'}
          </Text>
        </Pressable>

        <SectionHeading
          title="Horario normal"
          subtitle="Configúralo una vez. Palta calcula cada día si estás abierto; sólo vuelves aquí cuando algo cambia."
        />
        {days.map(({ key, label }) => (
          <View key={key} style={{ borderWidth: 1, borderRadius: 14, padding: 12, gap: 9 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontWeight: '800', fontSize: 16 }}>{label}</Text>
              <Pressable onPress={() => addInterval(key)} style={{ paddingVertical: 4, paddingHorizontal: 8 }}>
                <Text style={{ fontWeight: '800' }}>+ Tramo</Text>
              </Pressable>
            </View>
            {weekly[key].length === 0 ? (
              <Text style={{ opacity: 0.58 }}>Cerrado</Text>
            ) : (
              weekly[key].map((interval, index) => (
                <View key={`${key}-${index}`} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <TextInput
                    value={interval.opensAt}
                    onChangeText={(value) => changeInterval(key, index, 'opensAt', value)}
                    autoCapitalize="none"
                    style={{ borderWidth: 1, borderRadius: 10, padding: 9, minWidth: 82 }}
                  />
                  <Text>–</Text>
                  <TextInput
                    value={interval.closesAt}
                    onChangeText={(value) => changeInterval(key, index, 'closesAt', value)}
                    autoCapitalize="none"
                    style={{ borderWidth: 1, borderRadius: 10, padding: 9, minWidth: 82 }}
                  />
                  <Pressable onPress={() => removeInterval(key, index)} style={{ padding: 7 }}>
                    <Text style={{ fontWeight: '700' }}>Quitar</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>
        ))}

        <Pressable
          disabled={saving}
          onPress={() => void saveWeekly()}
          style={{ borderWidth: 1, borderRadius: 12, padding: 13, opacity: saving ? 0.55 : 1 }}
        >
          <Text style={{ textAlign: 'center', fontWeight: '800' }}>
            {saving ? 'Guardando…' : 'Guardar horario normal'}
          </Text>
        </Pressable>

        <Text style={{ opacity: 0.62, lineHeight: 20 }}>
          Los horarios son parte de tu perfil gratuito. No necesitas un plan pagado para mantener correcto el estado del negocio.
        </Text>
        {message ? <Text style={{ opacity: 0.76, lineHeight: 20 }}>{message}</Text> : null}
        {state.status === 'error' ? (
          <ErrorState message={state.message} onRetry={() => void refresh()} />
        ) : null}
      </View>
    </ScreenFrame>
  );
}
