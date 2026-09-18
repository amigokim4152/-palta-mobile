export const BOOK_LIBRARY_DISCOVERY_CONTRACT = 'palta-book-library-discovery-v1' as const;

export type BookAccess = {
  access_id?: string;
  work_id?: string;
  edition_id?: string;
  provider_type?: string;
  provider_id?: string;
  access_type?: string;
  availability?: string;
  action_url?: string;
  publication_state?: string;
  [key: string]: unknown;
};

export type BookDiscoveryCard = {
  work_id: string;
  title: string | null;
  subtitle?: string | null;
  creators: string[];
  subjects: string[];
  score: number;
  reason_codes: string[];
  best_access: BookAccess | null;
  access_count: number;
};

export type LibraryEventCard = {
  event_id: string;
  title: string | null;
  starts_at: string;
  ends_at: string | null;
  is_free: boolean | null;
  registration_required: boolean | null;
};

export type NearbyLibraryCard = {
  record_id: string | null;
  name: string | null;
  facility_type: string | null;
  address?: string | null;
  comuna_code?: string | null;
  distance_km: number | null;
  reason_codes: string[];
  holding_status: 'available' | 'on_loan' | 'reference_only' | 'unavailable' | 'unknown';
  holding_observation_count?: number;
  holding_observed_at?: string | null;
  holding_call_number?: string | null;
  holding_availability_url?: string | null;
  upcoming_event_count: number;
  upcoming_events: LibraryEventCard[];
};

export type PhysicalCatalogSearch = {
  source_id: string;
  provider_type: 'physical_library_catalog';
  interaction_mode: 'user_facing_search';
  machine_api: false;
  automation_allowed: false;
  url: string;
  work_id: string;
  query_basis: 'isbn13' | 'title';
  private_location_embedded: false;
};

export type BookLibraryDiscoveryV1 = {
  contract: typeof BOOK_LIBRARY_DISCOVERY_CONTRACT;
  books: BookDiscoveryCard[];
  nearby_libraries: NearbyLibraryCard[];
  physical_catalog_search: PhysicalCatalogSearch | null;
  privacy: {
    private_context_persisted: false;
    private_context_echoed: false;
    private_location_embedded_in_catalog_link: false;
  };
  limitations: {
    library_holding_status: string;
    reading_level: 'not_inferred_without_explicit_metadata';
    library_events: 'projected_from_existing_approved_event_core_records_only';
  };
};

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${label} must be string[]`);
  }
  return value as string[];
}

function eventCard(value: unknown, index: number): LibraryEventCard {
  const row = object(value, `nearby_libraries[].upcoming_events[${index}]`);
  if (typeof row.event_id !== 'string' || typeof row.starts_at !== 'string') {
    throw new Error('Library event is missing event_id or starts_at');
  }
  if (row.title !== null && typeof row.title !== 'string') {
    throw new Error('Library event title must be string|null');
  }
  if (row.ends_at !== null && typeof row.ends_at !== 'string') {
    throw new Error('Library event ends_at must be string|null');
  }
  if (row.is_free !== null && typeof row.is_free !== 'boolean') {
    throw new Error('Library event is_free must be boolean|null');
  }
  if (row.registration_required !== null && typeof row.registration_required !== 'boolean') {
    throw new Error('Library event registration_required must be boolean|null');
  }
  return row as LibraryEventCard;
}

function libraryCard(value: unknown): NearbyLibraryCard {
  const row = object(value, 'nearby_libraries[]');
  const allowedHolding = new Set(['available', 'on_loan', 'reference_only', 'unavailable', 'unknown']);
  if (row.record_id !== null && typeof row.record_id !== 'string') {
    throw new Error('Library record_id must be string|null');
  }
  if (row.name !== null && typeof row.name !== 'string') {
    throw new Error('Library name must be string|null');
  }
  if (row.distance_km !== null && typeof row.distance_km !== 'number') {
    throw new Error('Library distance_km must be number|null');
  }
  if (typeof row.holding_status !== 'string' || !allowedHolding.has(row.holding_status)) {
    throw new Error('Library holding_status is invalid');
  }
  if (typeof row.upcoming_event_count !== 'number' || !Number.isInteger(row.upcoming_event_count)) {
    throw new Error('Library upcoming_event_count must be an integer');
  }
  if (!Array.isArray(row.upcoming_events)) {
    throw new Error('Library upcoming_events must be an array');
  }
  const upcoming = row.upcoming_events.map(eventCard);
  if (row.upcoming_event_count < upcoming.length) {
    throw new Error('Library upcoming_event_count cannot be less than projected events');
  }
  const ids = new Set(upcoming.map((event) => event.event_id));
  if (ids.size !== upcoming.length) {
    throw new Error('Library upcoming_events contains duplicate event_id');
  }
  stringArray(row.reason_codes, 'Library reason_codes');
  return { ...row, upcoming_events: upcoming } as NearbyLibraryCard;
}

function bookCard(value: unknown): BookDiscoveryCard {
  const row = object(value, 'books[]');
  if (typeof row.work_id !== 'string' || row.work_id.length === 0) {
    throw new Error('Book work_id is required');
  }
  if (row.title !== null && typeof row.title !== 'string') {
    throw new Error('Book title must be string|null');
  }
  if (typeof row.score !== 'number' || typeof row.access_count !== 'number') {
    throw new Error('Book score/access_count is invalid');
  }
  stringArray(row.creators, 'Book creators');
  stringArray(row.subjects, 'Book subjects');
  stringArray(row.reason_codes, 'Book reason_codes');
  if (row.best_access !== null) object(row.best_access, 'Book best_access');
  return row as BookDiscoveryCard;
}

export function parseBookLibraryDiscoveryV1(value: unknown): BookLibraryDiscoveryV1 {
  const payload = object(value, 'Book Library discovery');
  if (payload.contract !== BOOK_LIBRARY_DISCOVERY_CONTRACT) {
    throw new Error('Book Library discovery contract mismatch');
  }
  if (!Array.isArray(payload.books) || !Array.isArray(payload.nearby_libraries)) {
    throw new Error('Book Library discovery is missing books/libraries arrays');
  }

  const privacy = object(payload.privacy, 'Book Library privacy');
  if (
    privacy.private_context_persisted !== false ||
    privacy.private_context_echoed !== false ||
    privacy.private_location_embedded_in_catalog_link !== false
  ) {
    throw new Error('Book Library discovery violated privacy invariants');
  }

  const limitations = object(payload.limitations, 'Book Library limitations');
  if (limitations.reading_level !== 'not_inferred_without_explicit_metadata') {
    throw new Error('Book Library reading-level invariant mismatch');
  }
  if (limitations.library_events !== 'projected_from_existing_approved_event_core_records_only') {
    throw new Error('Book Library event-source invariant mismatch');
  }

  let physicalCatalogSearch: PhysicalCatalogSearch | null = null;
  if (payload.physical_catalog_search !== null) {
    const search = object(payload.physical_catalog_search, 'physical_catalog_search');
    if (
      search.provider_type !== 'physical_library_catalog' ||
      search.interaction_mode !== 'user_facing_search' ||
      search.machine_api !== false ||
      search.automation_allowed !== false ||
      search.private_location_embedded !== false ||
      typeof search.url !== 'string' ||
      typeof search.work_id !== 'string' ||
      (search.query_basis !== 'isbn13' && search.query_basis !== 'title')
    ) {
      throw new Error('Physical catalog search violated contract');
    }
    physicalCatalogSearch = search as unknown as PhysicalCatalogSearch;
  }

  return {
    ...(payload as unknown as BookLibraryDiscoveryV1),
    books: payload.books.map(bookCard),
    nearby_libraries: payload.nearby_libraries.map(libraryCard),
    physical_catalog_search: physicalCatalogSearch,
  };
}
