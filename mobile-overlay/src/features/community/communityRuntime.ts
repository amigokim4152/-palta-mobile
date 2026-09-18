export type CommunityKind = 'school' | 'church' | 'neighborhood' | 'interest' | 'activity' | 'apartment';
export type CommunityMembershipState = 'active' | 'pending' | 'none' | 'invite_required';

export type CommunityCard = { id: string; name: string; kind: CommunityKind; meta: string; unreadCount: number; actionRequiredCount: number };
export type CommunityFeedItem = { id: string; communityId: string; communityName: string; kind: CommunityKind; author: string; timeLabel: string; body: string; announcement: boolean; commentCount: number; reactionCount: number };
export type CommunityTabData = { communities: CommunityCard[]; discover: CommunityCard[]; feed: CommunityFeedItem[] };
export type CommunityPostSummary = { id: string; author: string; timeLabel: string; body: string; commentCount: number; reactionCount: number };
export type CommunitySpaceData = { id: string; name: string; subtitle: string; membershipState: CommunityMembershipState; canJoin: boolean; joinLabel: string; joinDescription: string; joinActionLabel: string; posts: CommunityPostSummary[] };
export type CommunityComment = { id: string; author: string; body: string; timeLabel: string };
export type CommunityThreadData = { communityName: string; post: CommunityPostSummary; comments: CommunityComment[]; canComment: boolean };

export interface CommunityRuntime {
  loadTab(): Promise<CommunityTabData>;
  loadSpace(spaceId: string): Promise<CommunitySpaceData>;
  loadPost(spaceId: string, postId: string): Promise<CommunityThreadData>;
  joinSpace(spaceId: string): Promise<void>;
  addComment(spaceId: string, postId: string, body: string): Promise<void>;
  reactToPost(spaceId: string, postId: string): Promise<void>;
}

const previewData: CommunityTabData = {
  communities: [
    { id: 'school-1', name: 'Southern Cross School', kind: 'school', meta: 'Familias · 4º básico', unreadCount: 3, actionRequiredCount: 1 },
    { id: 'church-1', name: 'Comunidad de la iglesia', kind: 'church', meta: 'Jóvenes y familias', unreadCount: 1, actionRequiredCount: 0 },
    { id: 'neighborhood-1', name: 'Lo Curro', kind: 'neighborhood', meta: 'Vecindario', unreadCount: 2, actionRequiredCount: 0 },
  ],
  discover: [{ id: 'discover-1', name: 'Actividades cerca de ti', kind: 'activity', meta: 'Vitacura y alrededores', unreadCount: 0, actionRequiredCount: 0 }],
  feed: [
    { id: 'post-1', communityId: 'school-1', communityName: 'Southern Cross School', kind: 'school', author: 'Familias 4º básico', timeLabel: 'Hace 18 min', body: '¿Alguien sabe si mañana deben llevar el cuaderno de ciencias? Podemos dejar la confirmación aquí para que no se pierda entre mensajes.', announcement: false, commentCount: 6, reactionCount: 4 },
    { id: 'post-2', communityId: 'neighborhood-1', communityName: 'Lo Curro', kind: 'neighborhood', author: 'Vecinos del sector', timeLabel: 'Hace 1 h', body: 'Aviso: hay trabajos en la calle esta tarde. Si cambia el acceso, actualizamos este mismo hilo.', announcement: true, commentCount: 3, reactionCount: 8 },
    { id: 'post-3', communityId: 'church-1', communityName: 'Comunidad de la iglesia', kind: 'church', author: 'Grupo de jóvenes', timeLabel: 'Ayer', body: 'Después de la reunión tendremos un momento para compartir. Quien necesite coordinar transporte puede responder aquí.', announcement: false, commentCount: 5, reactionCount: 7 },
  ],
};

const previewComments: Record<string, CommunityComment[]> = {
  'post-1': [
    { id: 'comment-1', author: 'Carolina', body: 'Sí, ciencias y estuche. Lo confirmaron esta tarde.', timeLabel: 'Hace 12 min' },
    { id: 'comment-2', author: 'Felipe', body: 'Gracias. Dejo esto aquí para que quede fácil de encontrar.', timeLabel: 'Hace 8 min' },
  ],
  'post-2': [{ id: 'comment-3', author: 'María', body: 'El acceso norte sigue abierto por ahora.', timeLabel: 'Hace 40 min' }],
  'post-3': [{ id: 'comment-4', author: 'Daniel', body: 'Puedo llevar a dos personas.', timeLabel: 'Ayer' }],
};

const membershipOverrides = new Map<string, CommunityMembershipState>();
const reactionOverrides = new Map<string, number>();
function cardFor(spaceId: string) { return [...previewData.communities, ...previewData.discover].find((item) => item.id === spaceId); }
function postsFor(spaceId: string): CommunityPostSummary[] { return previewData.feed.filter((item) => item.communityId === spaceId).map(({ id, author, timeLabel, body, commentCount, reactionCount }) => ({ id, author, timeLabel, body, commentCount: previewComments[id]?.length ?? commentCount, reactionCount: reactionOverrides.get(id) ?? reactionCount })); }

const previewRuntime: CommunityRuntime = {
  async loadTab() { return previewData; },
  async loadSpace(spaceId) { const card = cardFor(spaceId); if (!card) throw new Error('Community space not found'); const membershipState = membershipOverrides.get(spaceId) ?? (previewData.communities.some((item) => item.id === spaceId) ? 'active' : 'none'); return { id: spaceId, name: card.name, subtitle: card.meta, membershipState, canJoin: membershipState === 'none', joinLabel: membershipState === 'pending' ? 'Solicitud enviada' : 'Únete a esta comunidad', joinDescription: membershipState === 'pending' ? 'Te avisaremos cuando se apruebe.' : 'Al unirte podrás participar según las reglas de esta comunidad.', joinActionLabel: 'Unirme', posts: postsFor(spaceId) }; },
  async loadPost(spaceId, postId) { const card = cardFor(spaceId); const post = postsFor(spaceId).find((item) => item.id === postId); if (!card || !post) throw new Error('Community post not found'); return { communityName: card.name, post, comments: previewComments[postId] ?? [], canComment: (membershipOverrides.get(spaceId) ?? (previewData.communities.some((item) => item.id === spaceId) ? 'active' : 'none')) === 'active' }; },
  async joinSpace(spaceId) { membershipOverrides.set(spaceId, 'active'); },
  async addComment(_spaceId, postId, body) { const list = previewComments[postId] ?? (previewComments[postId] = []); list.push({ id: `comment-${Date.now()}`, author: 'Tú', body, timeLabel: 'Ahora' }); },
  async reactToPost(_spaceId, postId) { const original = previewData.feed.find((item) => item.id === postId)?.reactionCount ?? 0; reactionOverrides.set(postId, (reactionOverrides.get(postId) ?? original) + 1); },
};

// Community uses the same canonical runtime base URL as Home, Care, Local and other Palta modules.
// Preview data is allowed only when no API base URL is configured; a configured but failing API must surface an error.
const baseUrl = () => process.env.EXPO_PUBLIC_PALTA_API_BASE_URL?.replace(/\/$/, '');
async function request<T>(path: string, init?: RequestInit): Promise<T> { const base = baseUrl(); if (!base) throw new Error('Community API not configured'); const response = await fetch(`${base}${path}`, { headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }, ...init }); if (!response.ok) throw new Error(`Community API ${response.status}`); return (response.status === 204 ? undefined : await response.json()) as T; }

const httpRuntime: CommunityRuntime = {
  async loadTab() { return baseUrl() ? request<CommunityTabData>('/v1/community/tab') : previewRuntime.loadTab(); },
  async loadSpace(spaceId) { return baseUrl() ? request<CommunitySpaceData>(`/v1/community/spaces/${encodeURIComponent(spaceId)}`) : previewRuntime.loadSpace(spaceId); },
  async loadPost(spaceId, postId) { return baseUrl() ? request<CommunityThreadData>(`/v1/community/spaces/${encodeURIComponent(spaceId)}/posts/${encodeURIComponent(postId)}`) : previewRuntime.loadPost(spaceId, postId); },
  async joinSpace(spaceId) { return baseUrl() ? request<void>(`/v1/community/spaces/${encodeURIComponent(spaceId)}/join`, { method: 'POST' }) : previewRuntime.joinSpace(spaceId); },
  async addComment(spaceId, postId, body) { return baseUrl() ? request<void>(`/v1/community/spaces/${encodeURIComponent(spaceId)}/posts/${encodeURIComponent(postId)}/comments`, { method: 'POST', body: JSON.stringify({ body }) }) : previewRuntime.addComment(spaceId, postId, body); },
  async reactToPost(spaceId, postId) { return baseUrl() ? request<void>(`/v1/community/spaces/${encodeURIComponent(spaceId)}/posts/${encodeURIComponent(postId)}/reactions`, { method: 'POST', body: JSON.stringify({ reactionKey: 'helpful' }) }) : previewRuntime.reactToPost(spaceId, postId); },
};

export const communityRuntime: CommunityRuntime = httpRuntime;
