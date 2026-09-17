import { useCallback, useMemo, useState } from 'react';
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

const months = [
  ['01', 'Ene'], ['02', 'Feb'], ['03', 'Mar'], ['04', 'Abr'],
  ['05', 'May'], ['06', 'Jun'], ['07', 'Jul'], ['08', 'Ago'],
  ['09', 'Sep'], ['10', 'Oct'], ['11', 'Nov'], ['12', 'Dic'],
] as const;

const monthEnd: Record<string, string> = {
  '01': '31', '02': '28', '03': '31', '04': '30',
  '05': '31', '06': '30', '07': '31', '08': '31',
  '09': '30', '10': '31', '11': '30', '12': '31',
};

const weekdays: readonly { key: BusinessWeekday; label: string }[] = [
  { key: 'monday', label: 'Lun' },
  { key: 'tuesday', label: 'Mar' },
  { key: 'wednesday', label: 'Mié' },
  { key: 'thursday', label: 'Jue' },
  { key: 'friday', label: 'Vie' },
  { key: 'saturday', label: 'Sáb' },
  { key: 'sunday', label: 'Dom' },
];

function validTime(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [hour, minute] = value.split(':').map(Number);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

function monthLabel(month: string): string {
  return months.find(([value]) => value === month)?.[1] ?? month;
}

function rangeLabel(startsOn: string, endsOn: string): string {
  return `${monthLabel(startsOn.slice(0, 2))} – ${monthLabel(endsOn.slice(0, 2))}`;
}

function seasonalWeekly(
  selected: ReadonlySet<BusinessWeekday>,
  interval: BusinessOperatingInterval,
): BusinessWeeklySchedule {
  return Object.fromEntries(
    weekdays
      .filter(({ key }) => selected.has(key))
      .map(({ key }) => [key, [{ ...interval }]]),
  );
}

function scheduleSummary(weekly: BusinessWeeklySchedule): string {
  const openDays = weekdays.filter(({ key }) => (weekly[key] ?? []).length > 0);
  if (!openDays.length) return 'Sin días de atención';
  const firstInterval = weekly[openDays[0]!.key]?.[0];
  const sameHours = firstInterval && openDays.every(({ key }) => {
    const intervals = weekly[key] ?? [];
    return intervals.length === 1 &&
      intervals[0]?.opensAt === firstInterval.opensAt &&
      intervals[0]?.closesAt === firstInterval.closesAt;
  });
  const dayText = openDays.map((item) => item.label).join(' · ');
  return sameHours && firstInterval
    ? `${dayText} · ${firstInterval.opensAt}–${firstInterval.closesAt}`
    : `${dayText} · horarios distintos`;
}

export default function BusinessSeasonalHoursScreen() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const [startMonth, setStartMonth] = useState('05');
  const [endMonth, setEndMonth] = useState('08');
  const [selectedDays, setSelectedDays] = useState<Set<BusinessWeekday>>(
    new Set<BusinessWeekday>(['friday', 'saturday', 'sunday']),
  );
  const [opensAt, setOpensAt] = useState('12:00');
  const [closesAt, setClosesAt] = useState('20:00');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
  const startsOn = `${startMonth}-01`;
  const endsOn = `${endMonth}-${monthEnd[endMonth] ?? '28'}`;
  const preview = useMemo(
    () => `${monthLabel(startMonth)}–${monthLabel(endMonth)} · ${weekdays.filter(({ key }) => selectedDays.has(key)).map((item) => item.label).join(' · ') || 'sin días'} · ${opensAt}–${closesAt}`,
    [startMonth, endMonth, selectedDays, opensAt, closesAt],
  );

  function toggleDay(day: BusinessWeekday) {
    setSelectedDays((current) => {
      const next = new Set(current);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  async function saveSpecialSeason() {
    if (!businessId || mobileRuntime.status !== 'ready') return;
    if (!selectedDays.size) {
      setMessage('Elige al menos un día de atención para esta temporada.');
      return;
    }
    if (!validTime(opensAt) || !validTime(closesAt) || opensAt === closesAt) {
      setMessage('Revisa la hora. Usa formato 24 horas, por ejemplo 12:00–20:00.');
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const id = `season-${startMonth}-${endMonth}-${Date.now().toString(36)}`;
      await mobileRuntime.client.operatingRules.upsertSeasonalSchedule(businessId, id, {
        startsOn,
        endsOn,
        weekly: seasonalWeekly(selectedDays, { opensAt, closesAt }),
      });
      await refresh();
      setMessage('Guardamos la temporada. Se aplicará automáticamente cada año hasta que la elimines.');
    } catch (error) {
      setMessage(error instanceof Error ? `No se pudo guardar: ${error.message}` : 'No se pudo guardar la temporada.');
    } finally {
      setSaving(false);
    }
  }

  async function saveFullClosure() {
    if (!businessId || mobileRuntime.status !== 'ready') return;
    setSaving(true);
    setMessage(null);
    try {
      const id = `seasonal-closure-${startMonth}-${endMonth}-${Date.now().toString(36)}`;
      await mobileRuntime.client.operatingRules.upsertSeasonalClosure(businessId, id, {
        startsOn,
        endsOn,
      });
      await refresh();
      setMessage('Guardamos el cierre de temporada. Palta lo aplicará automáticamente cada año.');
    } catch (error) {
      setMessage(error instanceof Error ? `No se pudo guardar: ${error.message}` : 'No se pudo guardar el cierre de temporada.');
    } finally {
      setSaving(false);
    }
  }

  async function removeSeason(id: string) {
    if (!businessId || mobileRuntime.status !== 'ready') return;
    setSaving(true);
    try {
      await mobileRuntime.client.operatingRules.removeSeasonalSchedule(businessId, id);
      await refresh();
      setMessage('Eliminamos esa temporada. El horario normal vuelve a aplicarse en esas fechas.');
    } finally {
      setSaving(false);
    }
  }

  async function removeClosure(id: string) {
    if (!businessId || mobileRuntime.status !== 'ready') return;
    setSaving(true);
    try {
      await mobileRuntime.client.operatingRules.removeSeasonalClosure(businessId, id);
      await refresh();
      setMessage('Eliminamos ese cierre de temporada.');
    } finally {
      setSaving(false);
    }
  }

  if (state.status === 'loading' && !state.data) {
    return (
      <ScreenFrame title="Temporadas">
        <LoadingState label="Cargando temporadas…" />
      </ScreenFrame>
    );
  }
  if (state.status === 'error' && !state.data) {
    return (
      <ScreenFrame title="Temporadas">
        <ErrorState message={state.message} onRetry={() => void refresh()} />
      </ScreenFrame>
    );
  }
  if (!business || !operating) return null;

  return (
    <ScreenFrame
      title="Temporadas"
      subtitle={business.name}
      action={
        <Pressable onPress={() => router.back()} style={{ paddingVertical: 8 }}>
          <Text style={{ fontWeight: '800' }}>Volver</Text>
        </Pressable>
      }
    >
      <View style={{ gap: 18 }}>
        <Text style={{ opacity: 0.68, lineHeight: 21 }}>
          Úsalo cuando tu negocio funciona distinto según la época del año. Por ejemplo: mayo a agosto sólo viernes, sábado y domingo. No tendrás que cambiarlo cada semana.
        </Text>

        <SectionHeading title="Temporadas guardadas" />
        {(operating.rules.seasonalSchedules ?? []).length === 0 &&
        (operating.rules.seasonalClosures ?? []).length === 0 ? (
          <Text style={{ opacity: 0.58 }}>Todavía no tienes reglas de temporada.</Text>
        ) : null}
        {(operating.rules.seasonalSchedules ?? []).map((season) => (
          <View key={season.id} style={{ borderWidth: 1, borderRadius: 14, padding: 12, gap: 5 }}>
            <Text style={{ fontWeight: '800' }}>{rangeLabel(season.startsOn, season.endsOn)} · horario especial</Text>
            <Text style={{ opacity: 0.68 }}>{scheduleSummary(season.weekly)}</Text>
            <Pressable disabled={saving} onPress={() => void removeSeason(season.id)} style={{ paddingVertical: 7 }}>
              <Text style={{ fontWeight: '800' }}>Eliminar esta temporada</Text>
            </Pressable>
          </View>
        ))}
        {(operating.rules.seasonalClosures ?? []).map((closure) => (
          <View key={closure.id} style={{ borderWidth: 1, borderRadius: 14, padding: 12, gap: 5 }}>
            <Text style={{ fontWeight: '800' }}>{rangeLabel(closure.startsOn, closure.endsOn)} · cerrado por temporada</Text>
            <Text style={{ opacity: 0.68 }}>Durante este periodo Palta mostrará “Cerrado por temporada”.</Text>
            <Pressable disabled={saving} onPress={() => void removeClosure(closure.id)} style={{ paddingVertical: 7 }}>
              <Text style={{ fontWeight: '800' }}>Eliminar cierre</Text>
            </Pressable>
          </View>
        ))}

        <SectionHeading
          title="Nueva temporada"
          subtitle="Elige meses. La regla se repite cada año hasta que la elimines."
        />
        <Text style={{ fontWeight: '800' }}>Desde</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
          {months.map(([value, label]) => (
            <Pressable
              key={`from-${value}`}
              onPress={() => setStartMonth(value)}
              style={{ borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8, opacity: startMonth === value ? 1 : 0.48 }}
            >
              <Text style={{ fontWeight: '700' }}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={{ fontWeight: '800' }}>Hasta</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
          {months.map(([value, label]) => (
            <Pressable
              key={`to-${value}`}
              onPress={() => setEndMonth(value)}
              style={{ borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8, opacity: endMonth === value ? 1 : 0.48 }}
            >
              <Text style={{ fontWeight: '700' }}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={{ fontWeight: '800' }}>Días de atención en esa temporada</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
          {weekdays.map(({ key, label }) => (
            <Pressable
              key={key}
              onPress={() => toggleDay(key)}
              style={{ borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 8, opacity: selectedDays.has(key) ? 1 : 0.42 }}
            >
              <Text style={{ fontWeight: '700' }}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ gap: 7 }}>
          <Text style={{ fontWeight: '800' }}>Horario para los días elegidos</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TextInput value={opensAt} onChangeText={setOpensAt} style={{ borderWidth: 1, borderRadius: 10, padding: 9, minWidth: 90 }} />
            <Text>–</Text>
            <TextInput value={closesAt} onChangeText={setClosesAt} style={{ borderWidth: 1, borderRadius: 10, padding: 9, minWidth: 90 }} />
          </View>
          <Text style={{ opacity: 0.58 }}>Vista previa: {preview}</Text>
        </View>

        <Pressable
          disabled={saving}
          onPress={() => void saveSpecialSeason()}
          style={{ borderWidth: 1, borderRadius: 12, padding: 13, opacity: saving ? 0.55 : 1 }}
        >
          <Text style={{ textAlign: 'center', fontWeight: '800' }}>Guardar horario de temporada</Text>
        </Pressable>
        <Pressable
          disabled={saving}
          onPress={() => void saveFullClosure()}
          style={{ borderWidth: 1, borderRadius: 12, padding: 13, opacity: saving ? 0.55 : 1 }}
        >
          <Text style={{ textAlign: 'center', fontWeight: '800' }}>Cerrar durante estos meses</Text>
        </Pressable>

        <Text style={{ opacity: 0.62, lineHeight: 20 }}>
          Las temporadas y el estado de apertura forman parte de la información básica del negocio. No son una función de pago.
        </Text>
        {message ? <Text style={{ opacity: 0.76, lineHeight: 20 }}>{message}</Text> : null}
      </View>
    </ScreenFrame>
  );
}
