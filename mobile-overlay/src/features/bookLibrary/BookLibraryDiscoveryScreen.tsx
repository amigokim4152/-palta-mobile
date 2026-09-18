import { useCallback, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking, Pressable, Text, TextInput, View } from 'react-native';
import type {
  BookDiscoveryCard,
  NearbyLibraryCard,
} from '../../../../src/bookLibrary/discoveryContract';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../components/AsyncStateBlock';
import { HomeCandidateCard } from '../../components/HomeCandidateCard';
import { ScreenFrame } from '../../components/ScreenFrame';
import { SectionHeading } from '../../components/common/SectionHeading';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { mobileRuntime } from '../../services/paltaClient';

function accessLabel(book: BookDiscoveryCard): string | undefined {
  const access = book.best_access;
  if (!access) return undefined;
  const provider = String(access.provider_type ?? '');
  const kind = String(access.access_type ?? '');
  if (provider === 'national_library_digital') return 'Acceso digital público';
  if (provider === 'bp_digital') return kind === 'borrow' ? 'Préstamo digital' : 'Biblioteca Pública Digital';
  if (provider === 'physical_library') return kind === 'reserve' ? 'Reserva en biblioteca' : 'Biblioteca cercana';
  if (provider === 'memoria_chilena') return 'Archivo digital gratuito';
  if (provider === 'bookstore') return 'Comprar en librería';
  return 'Ver acceso';
}

function holdingLabel(status: NearbyLibraryCard['holding_status']): string {
  if (status === 'available') return 'Ejemplar disponible';
  if (status === 'on_loan') return 'Prestado';
  if (status === 'reference_only') return 'Consulta en sala';
  if (status === 'unavailable') return 'No disponible';
  return 'Disponibilidad por confirmar';
}

function distanceLabel(distanceKm: number | null): string | undefined {
  if (distanceKm === null) return undefined;
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
  return `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km`;
}

function eventTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('es-CL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isOfficialCatalogUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'www.bibliotecaspublicas.gob.cl';
  } catch {
    return false;
  }
}

function LibraryCard({ library }: { library: NearbyLibraryCard }) {
  const distance = distanceLabel(library.distance_km);
  return (
    <View style={{ paddingVertical: 16, borderBottomWidth: 1, gap: 7 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <Text allowFontScaling style={{ flex: 1, fontSize: 18, fontWeight: '700' }}>
          {library.name ?? 'Biblioteca'}
        </Text>
        {distance ? (
          <Text allowFontScaling style={{ fontSize: 13, opacity: 0.62 }}>
            {distance}
          </Text>
        ) : null}
      </View>
      {library.address ? (
        <Text allowFontScaling style={{ opacity: 0.72 }}>
          {library.address}
        </Text>
      ) : null}
      <Text allowFontScaling style={{ fontWeight: '600' }}>
        {holdingLabel(library.holding_status)}
      </Text>
      {library.holding_call_number ? (
        <Text allowFontScaling style={{ fontSize: 13, opacity: 0.65 }}>
          Ubicación: {library.holding_call_number}
        </Text>
      ) : null}

      {library.upcoming_events.length > 0 ? (
        <View style={{ marginTop: 6, gap: 8 }}>
          <Text allowFontScaling style={{ fontSize: 12, fontWeight: '800', opacity: 0.58 }}>
            PRÓXIMAS ACTIVIDADES
          </Text>
          {library.upcoming_events.map((event) => (
            <View key={event.event_id} style={{ gap: 2 }}>
              <Text allowFontScaling style={{ fontWeight: '650' }}>
                {event.title ?? 'Actividad'}
              </Text>
              <Text allowFontScaling style={{ fontSize: 13, opacity: 0.68 }}>
                {eventTime(event.starts_at)}
                {event.is_free === true ? ' · Gratis' : ''}
                {event.registration_required === true ? ' · Inscripción' : ''}
              </Text>
            </View>
          ))}
          {library.upcoming_event_count > library.upcoming_events.length ? (
            <Text allowFontScaling style={{ fontSize: 13, opacity: 0.65 }}>
              +{library.upcoming_event_count - library.upcoming_events.length} actividades más
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function BookLibraryDiscoveryScreen() {
  const params = useLocalSearchParams<{ q?: string; workId?: string }>();
  const initialQuery = typeof params.q === 'string' ? params.q : '';
  const workId = typeof params.workId === 'string' ? params.workId : undefined;
  const [draft, setDraft] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery);

  const load = useCallback(async () => {
    if (mobileRuntime.status !== 'ready') throw new Error(mobileRuntime.message);
    return mobileRuntime.client.getBookLibraryDiscovery({
      ...(workId ? { workId } : {}),
      ...(submittedQuery.trim() ? { query: submittedQuery.trim() } : {}),
    });
  }, [submittedQuery, workId]);

  const { state, refresh } = useAsyncResource(load, {
    isEmpty: (data) => data.books.length === 0 && data.nearby_libraries.length === 0,
  });

  const selectedTitle = useMemo(() => {
    if (!workId) return undefined;
    return state.data?.books.find((book) => book.work_id === workId)?.title ?? undefined;
  }, [state.data?.books, workId]);

  const submit = () => {
    const query = draft.trim();
    setSubmittedQuery(query);
    router.setParams({ q: query || undefined, workId: undefined });
  };

  const openPhysicalCatalog = async () => {
    const url = state.data?.physical_catalog_search?.url;
    if (!url || !isOfficialCatalogUrl(url)) return;
    await Linking.openURL(url);
  };

  return (
    <ScreenFrame
      title="Libros y bibliotecas"
      subtitle={selectedTitle ? `Dónde encontrar “${selectedTitle}”` : 'Lee gratis primero. Encuentra después la biblioteca o librería que te sirve.'}
    >
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={submit}
          returnKeyType="search"
          placeholder="Título, autor o ISBN"
          accessibilityLabel="Buscar libros"
          style={{
            flex: 1,
            minHeight: 46,
            borderWidth: 1,
            borderRadius: 12,
            paddingHorizontal: 14,
          }}
        />
        <Pressable
          onPress={submit}
          accessibilityRole="button"
          style={{ justifyContent: 'center', paddingHorizontal: 16, borderWidth: 1, borderRadius: 12 }}
        >
          <Text allowFontScaling style={{ fontWeight: '800' }}>Buscar</Text>
        </Pressable>
      </View>

      {state.status === 'loading' && !state.data ? (
        <LoadingState label="Buscando acceso y bibliotecas…" />
      ) : null}
      {state.status === 'error' && !state.data ? (
        <ErrorState message={state.message} onRetry={() => void refresh()} />
      ) : null}
      {state.status === 'empty' ? (
        <EmptyState
          title="No encontramos resultados por ahora"
          body="Puedes probar otro título, autor o ISBN. Palta no inventa disponibilidad cuando la fuente no la confirma."
        />
      ) : null}

      {state.data?.books.length ? (
        <View>
          <SectionHeading
            title={submittedQuery ? 'Libros encontrados' : 'Para leer'}
            subtitle="El acceso público o gratuito aparece antes que la compra."
          />
          {state.data.books.map((book) => (
            <HomeCandidateCard
              key={book.work_id}
              eyebrow="LIBRO"
              title={book.title ?? 'Libro'}
              body={[
                book.creators.join(', '),
                accessLabel(book),
              ].filter(Boolean).join(' · ')}
              actionLabel="Ver bibliotecas y accesos"
              onPress={() => router.push(`/books?workId=${encodeURIComponent(book.work_id)}`)}
            />
          ))}
        </View>
      ) : null}

      {state.data?.physical_catalog_search ? (
        <Pressable
          onPress={() => void openPhysicalCatalog()}
          accessibilityRole="link"
          style={{ marginVertical: 14, paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1 }}
        >
          <Text allowFontScaling style={{ fontSize: 16, fontWeight: '800' }}>
            Buscar ejemplares en el catálogo oficial SNBP
          </Text>
          <Text allowFontScaling style={{ marginTop: 4, opacity: 0.65 }}>
            Abre la búsqueda oficial. Palta no envía tu ubicación privada en este enlace.
          </Text>
        </Pressable>
      ) : null}

      {state.data?.nearby_libraries.length ? (
        <View style={{ marginTop: 8 }}>
          <SectionHeading
            title="Bibliotecas cerca de ti"
            subtitle="La cercanía no significa que el libro esté disponible: solo mostramos existencia o préstamo cuando hay una fuente autorizada que lo confirma."
          />
          {state.data.nearby_libraries.map((library) => (
            <LibraryCard key={library.record_id ?? `${library.name}-${library.distance_km}`} library={library} />
          ))}
        </View>
      ) : null}

      {state.status === 'error' && state.data ? (
        <ErrorState message={state.message} onRetry={() => void refresh()} />
      ) : null}
    </ScreenFrame>
  );
}
