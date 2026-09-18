export type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export type HomeApiItem = { id: string; kind: 'action' | 'status' | 'alert' | 'useful_today' | 'content'; title: string; body?: string; source_domain: string; delivery: 'home' | 'home_notify' | 'urgent'; care_track_id?: string; related_entity_id?: string };
export type HomeApiResponse = { generated_at?: string; items: HomeApiItem[] };
export type LocalSearchItem = { entity_id: string; entity_type: 'place' | 'business' | 'public_service' | 'event'; name: string; category_key?: string; distance_m?: number; verification_status?: string; location: { lat: number; lng: number } };
export type BusinessApiDetail = { id: string; name: string; category_key?: string; verification_status: 'unverified' | 'claimed' | 'verified' | 'suspended'; opening_status?: string; location?: { lat: number; lng: number }; contact?: { phone?: string; whatsapp?: string } };
export type CareApiTrack = { id: string; intent_key: string; state: 'discover' | 'prepare' | 'act' | 'wait' | 'result' | 'follow_up' | 'outcome' | 'cancelled'; waiting_for?: string; expected_at?: string };

export type CommunityKind = 'school' | 'church' | 'neighborhood' | 'interest' | 'activity' | 'apartment';
export type CommunityMembershipState = 'active' | 'pending' | 'none' | 'invite_required';
export type CommunityMembershipRoleKey = 'member' | 'guardian' | 'student' | 'teacher' | 'staff' | 'leader' | 'admin';
export type CommunityMembershipDecision = 'approve' | 'reject' | 'end';
export type CommunityApiCard = { id: string; name: string; kind: CommunityKind; meta: string; unreadCount: number; actionRequiredCount: number };
export type CommunityApiFeedItem = { id: string; communityId: string; communityName: string; kind: CommunityKind; author: string; timeLabel: string; body: string; announcement: boolean; commentCount: number; reactionCount: number };
export type CommunityApiTab = { communities: CommunityApiCard[]; discover: CommunityApiCard[]; feed: CommunityApiFeedItem[] };
export type CommunityApiPostSummary = { id: string; author: string; timeLabel: string; body: string; commentCount: number; reactionCount: number };
export type CommunityApiSpace = { id: string; name: string; subtitle: string; membershipState: CommunityMembershipState; roleKey?: CommunityMembershipRoleKey; canJoin: boolean; joinLabel: string; joinDescription: string; joinActionLabel: string; posts: CommunityApiPostSummary[] };
export type CommunityApiComment = { id: string; author: string; body: string; timeLabel: string };
export type CommunityApiThread = { communityName: string; post: CommunityApiPostSummary; comments: CommunityApiComment[]; canComment: boolean };
export type CommunityApiPendingMembership = { membershipId: string; memberLabel: string; requestedRoleKey: CommunityMembershipRoleKey; requestedAt?: string };
export type CommunityApiActiveMembership = { membershipId: string; memberLabel: string; roleKey: CommunityMembershipRoleKey; effectiveFrom?: string; isSelf?: boolean };
export type CommunityApiMembershipManagement = { currentRoleKey: CommunityMembershipRoleKey; pending: CommunityApiPendingMembership[]; active: CommunityApiActiveMembership[] };

export type PaltaApiClientOptions = { baseUrl: string; fetch: FetchLike; getAccessToken?: () => Promise<string | null> };
function joinUrl(baseUrl: string, path: string): string { return `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`; }
function expectObject(value: unknown, label: string): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} returned a non-object payload`); return value as Record<string, unknown>; }
function expectArray(value: unknown, label: string): unknown[] { if (!Array.isArray(value)) throw new Error(`${label} returned a non-array payload`); return value; }

export class PaltaApiError extends Error { constructor(message: string, readonly status: number) { super(message); this.name = 'PaltaApiError'; } }

export class PaltaApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly getAccessToken: (() => Promise<string | null>) | undefined;
  constructor(options: PaltaApiClientOptions) { this.baseUrl = options.baseUrl; this.fetchImpl = options.fetch; this.getAccessToken = options.getAccessToken; }

  private async request(path: string, init?: { method?: string; body?: unknown; headers?: Record<string, string> }): Promise<unknown> {
    const token = this.getAccessToken ? await this.getAccessToken() : null;
    const headers: Record<string, string> = { Accept: 'application/json', ...(init?.headers ?? {}) };
    if (init?.body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    const requestInit: { method?: string; headers: Record<string, string>; body?: string } = { headers };
    if (init?.method) requestInit.method = init.method;
    if (init?.body !== undefined) requestInit.body = JSON.stringify(init.body);
    const response = await this.fetchImpl(joinUrl(this.baseUrl, path), requestInit);
    if (!response.ok) throw new PaltaApiError(`Palta API request failed: ${response.status}`, response.status);
    if (response.status === 204) return undefined;
    return response.json();
  }

  async getHome(locale = 'es-CL'): Promise<HomeApiResponse> { const payload = expectObject(await this.request(`/v1/home?locale=${encodeURIComponent(locale)}`), 'GET /v1/home'); if (!Array.isArray(payload.items)) throw new Error('GET /v1/home payload missing items[]'); return payload as HomeApiResponse; }
  async searchLocal(input: { latitude: number; longitude: number; radiusM?: number; query?: string }): Promise<LocalSearchItem[]> { const params = new URLSearchParams({ lat: String(input.latitude), lng: String(input.longitude), radius_m: String(input.radiusM ?? 5000) }); if (input.query) params.set('q', input.query); const payload = expectObject(await this.request(`/v1/local/search?${params.toString()}`), 'GET /v1/local/search'); if (!Array.isArray(payload.items)) throw new Error('GET /v1/local/search payload missing items[]'); return payload.items as LocalSearchItem[]; }
  async getBusiness(businessId: string): Promise<BusinessApiDetail> { const result = expectObject(await this.request(`/v1/business/${encodeURIComponent(businessId)}`), 'GET /v1/business/{id}'); if (typeof result.id !== 'string' || typeof result.name !== 'string') throw new Error('GET /v1/business/{id} returned invalid business'); return result as BusinessApiDetail; }
  async getCare(careTrackId: string): Promise<CareApiTrack> { const result = expectObject(await this.request(`/v1/care/${encodeURIComponent(careTrackId)}`), 'GET /v1/care/{id}'); if (typeof result.id !== 'string' || typeof result.intent_key !== 'string' || typeof result.state !== 'string') throw new Error('GET /v1/care/{id} returned invalid Care track'); return result as CareApiTrack; }
  async createCare(input: { intentKey: string; subjectEntityId?: string; actionType?: string; payload?: Record<string, unknown>; idempotencyKey?: string }): Promise<CareApiTrack> { const body: Record<string, unknown> = { intent_key: input.intentKey, payload: input.payload ?? {} }; if (input.subjectEntityId) body.subject_entity_id = input.subjectEntityId; if (input.actionType) body.action_type = input.actionType; const result = expectObject(await this.request('/v1/care', { method: 'POST', body, ...(input.idempotencyKey ? { headers: { 'Idempotency-Key': input.idempotencyKey } } : {}) }), 'POST /v1/care'); if (typeof result.id !== 'string' || typeof result.state !== 'string') throw new Error('POST /v1/care returned invalid Care track'); return result as CareApiTrack; }

  async getCommunityTab(): Promise<CommunityApiTab> { const result = expectObject(await this.request('/v1/community/tab'), 'GET /v1/community/tab'); expectArray(result.communities, 'GET /v1/community/tab communities'); expectArray(result.discover, 'GET /v1/community/tab discover'); expectArray(result.feed, 'GET /v1/community/tab feed'); return result as CommunityApiTab; }
  async getCommunitySpace(spaceId: string): Promise<CommunityApiSpace> { const result = expectObject(await this.request(`/v1/community/spaces/${encodeURIComponent(spaceId)}`), 'GET /v1/community/spaces/{id}'); if (typeof result.id !== 'string' || typeof result.name !== 'string' || !Array.isArray(result.posts)) throw new Error('GET /v1/community/spaces/{id} returned invalid space'); return result as CommunityApiSpace; }
  async getCommunityPost(spaceId: string, postId: string): Promise<CommunityApiThread> { const result = expectObject(await this.request(`/v1/community/spaces/${encodeURIComponent(spaceId)}/posts/${encodeURIComponent(postId)}`), 'GET /v1/community/spaces/{id}/posts/{postId}'); expectObject(result.post, 'Community thread post'); expectArray(result.comments, 'Community thread comments'); return result as CommunityApiThread; }
  async joinCommunitySpace(spaceId: string): Promise<void> { await this.request(`/v1/community/spaces/${encodeURIComponent(spaceId)}/join`, { method: 'POST' }); }
  async getCommunityMembershipManagement(spaceId: string): Promise<CommunityApiMembershipManagement> { const result = expectObject(await this.request(`/v1/community/spaces/${encodeURIComponent(spaceId)}/memberships`), 'GET /v1/community/spaces/{id}/memberships'); expectArray(result.pending, 'Community pending memberships'); expectArray(result.active, 'Community active memberships'); if (typeof result.currentRoleKey !== 'string') throw new Error('Community membership management missing currentRoleKey'); return result as CommunityApiMembershipManagement; }
  async updateCommunityMembership(input: { spaceId: string; membershipId: string; action: CommunityMembershipDecision; roleKey?: CommunityMembershipRoleKey }): Promise<void> { await this.request(`/v1/community/spaces/${encodeURIComponent(input.spaceId)}/memberships/${encodeURIComponent(input.membershipId)}`, { method: 'PATCH', body: { action: input.action, ...(input.roleKey ? { roleKey: input.roleKey } : {}) } }); }
  async addCommunityComment(spaceId: string, postId: string, body: string): Promise<void> { await this.request(`/v1/community/spaces/${encodeURIComponent(spaceId)}/posts/${encodeURIComponent(postId)}/comments`, { method: 'POST', body: { body } }); }
  async reactToCommunityPost(spaceId: string, postId: string, reactionKey: string): Promise<void> { await this.request(`/v1/community/spaces/${encodeURIComponent(spaceId)}/posts/${encodeURIComponent(postId)}/reactions`, { method: 'POST', body: { reactionKey } }); }
}
