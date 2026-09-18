import { mobileRuntime } from '../../services/paltaClient';
import type {
  CommunityApiCard,
  CommunityApiComment,
  CommunityApiFeedItem,
  CommunityApiPostSummary,
  CommunityApiSpace,
  CommunityApiTab,
  CommunityApiThread,
  CommunityKind,
  CommunityMembershipState,
} from '../../../../src/api/paltaApiClient';

export type { CommunityKind, CommunityMembershipState };
export type CommunityCard = CommunityApiCard;
export type CommunityFeedItem = CommunityApiFeedItem;
export type CommunityTabData = CommunityApiTab;
export type CommunityPostSummary = CommunityApiPostSummary;
export type CommunitySpaceData = CommunityApiSpace;
export type CommunityComment = CommunityApiComment;
export type CommunityThreadData = CommunityApiThread;

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
    { id: 'neighborhood-1', name: 'Lo Curro', kind: 'neighborhood', meta: 'Vecindario', unreadCount: 2, actionRequiredCount: 0 },
    { id: 'church-1', name: 'Comunidad de la iglesia', kind: 'church', meta: 'Jóvenes y familias', unreadCount: 1, actionRequiredCount: 0 },
    { id: 'apartment-1', name: 'Comunidad del edificio', kind: 'apartment', meta: 'Residentes y administración', unreadCount: 0, actionRequiredCount: 1 },
  ],
  discover: [
    { id: 'activity-1', name: 'Actividades cerca de ti', kind: 'activity', meta: 'Panoramas y actividades locales', unreadCount: 0, actionRequiredCount: 0 },
    { id: 'interest-1', name: 'Lectura en español', kind: 'interest', meta: 'Grupo abierto · Santiago', unreadCount: 0, actionRequiredCount: 0 },
  ],
  feed: [
    { id: 'post-1', communityId: 'school-1', communityName: 'Southern Cross School', kind: 'school', author: 'Familias 4º básico', timeLabel: 'Hace 18 min', body: '¿Alguien sabe si mañana deben llevar el cuaderno de ciencias? Podemos dejar la confirmación aquí para que no se pierda entre mensajes.', announcement: false, commentCount: 6, reactionCount: 4 },
    { id: 'post-2', communityId: 'neighborhood-1', communityName: 'Lo Curro', kind: 'neighborhood', author: 'Vecinos del sector', timeLabel: 'Hace 1 h', body: 'Aviso: hay trabajos en la calle esta tarde. Si cambia el acceso, actualizamos este mismo hilo.', announcement: true, commentCount: 3, reactionCount: 8 },
    { id: 'post-3', communityId: 'church-1', communityName: 'Comunidad de la iglesia', kind: 'church', author: 'Grupo de jóvenes', timeLabel: 'Ayer', body: 'Después de la reunión tendremos un momento para compartir. Quien necesite coordinar transporte puede responder aquí.', announcement: false, commentCount: 5, reactionCount: 7 },
    { id: 'post-4', communityId: 'apartment-1', communityName: 'Comunidad del edificio', kind: 'apartment', author: 'Administración', timeLabel: 'Ayer', body: 'El mantenimiento del portón se realizará mañana por la mañana. Dejaremos aquí cualquier cambio de horario.', announcement: true, commentCount: 2, reactionCount: 3 },
  ],
};

const previewComments: Record<string, CommunityComment[]> = {
  'post-1': [{ id: 'comment-1', author: 'Carolina', body: 'Sí, ciencias y estuche. Lo confirmaron esta tarde.', timeLabel: 'Hace 12 min' }, { id: 'comment-2', author: 'Felipe', body: 'Gracias. Dejo esto aquí para que quede fácil de encontrar.', timeLabel: 'Hace 8 min' }],
  'post-2': [{ id: 'comment-3', author: 'María', body: 'El acceso norte sigue abierto por ahora.', timeLabel: 'Hace 40 min' }],
  'post-3': [{ id: 'comment-4', author: 'Daniel', body: 'Puedo llevar a dos personas.', timeLabel: 'Ayer' }],
  'post-4': [{ id: 'comment-5', author: 'Administración', body: 'Confirmaremos el término de los trabajos en este hilo.', timeLabel: 'Ayer' }],
};

const membershipOverrides = new Map<string, CommunityMembershipState>();
const reactionOverrides = new Map<string, number>();

function projectedFeed(): CommunityFeedItem[] {
  return previewData.feed.map((item) => ({
    ...item,
    commentCount: previewComments[item.id]?.length ?? item.commentCount,
    reactionCount: reactionOverrides.get(item.id) ?? item.reactionCount,
  }));
}

function cardFor(spaceId: string) { return [...previewData.communities, ...previewData.discover].find((item) => item.id === spaceId); }
function postsFor(spaceId: string): CommunityPostSummary[] { return projectedFeed().filter((item) => item.communityId === spaceId).map(({ id, author, timeLabel, body, commentCount, reactionCount }) => ({ id, author, timeLabel, body, commentCount, reactionCount })); }
const previewRuntime: CommunityRuntime = {
  async loadTab() { return { ...previewData, feed: projectedFeed() }; },
  async loadSpace(spaceId) { const card = cardFor(spaceId); if (!card) throw new Error('Community space not found'); const membershipState = membershipOverrides.get(spaceId) ?? (previewData.communities.some((item) => item.id === spaceId) ? 'active' : 'none'); return { id: spaceId, name: card.name, subtitle: card.meta, membershipState, canJoin: membershipState === 'none', joinLabel: membershipState === 'pending' ? 'Solicitud enviada' : 'Únete a esta comunidad', joinDescription: membershipState === 'pending' ? 'Te avisaremos cuando se apruebe.' : 'Al unirte podrás participar según las reglas de esta comunidad.', joinActionLabel: 'Unirme', posts: postsFor(spaceId) }; },
  async loadPost(spaceId, postId) { const card = cardFor(spaceId); const post = postsFor(spaceId).find((item) => item.id === postId); if (!card || !post) throw new Error('Community post not found'); return { communityName: card.name, post, comments: previewComments[postId] ?? [], canComment: (membershipOverrides.get(spaceId) ?? (previewData.communities.some((item) => item.id === spaceId) ? 'active' : 'none')) === 'active' }; },
  async joinSpace(spaceId) { membershipOverrides.set(spaceId, 'active'); },
  async addComment(_spaceId, postId, body) { const list = previewComments[postId] ?? (previewComments[postId] = []); list.push({ id: `comment-${Date.now()}`, author: 'Tú', body, timeLabel: 'Ahora' }); },
  async reactToPost(_spaceId, postId) { const original = previewData.feed.find((item) => item.id === postId)?.reactionCount ?? 0; reactionOverrides.set(postId, (reactionOverrides.get(postId) ?? original) + 1); },
};

function usePreview(): boolean { return !process.env.EXPO_PUBLIC_PALTA_API_BASE_URL; }
function client() { if (mobileRuntime.status !== 'ready') throw new Error(mobileRuntime.message); return mobileRuntime.client; }

const sharedApiRuntime: CommunityRuntime = {
  async loadTab() { return usePreview() ? previewRuntime.loadTab() : client().getCommunityTab(); },
  async loadSpace(spaceId) { return usePreview() ? previewRuntime.loadSpace(spaceId) : client().getCommunitySpace(spaceId); },
  async loadPost(spaceId, postId) { return usePreview() ? previewRuntime.loadPost(spaceId, postId) : client().getCommunityPost(spaceId, postId); },
  async joinSpace(spaceId) { return usePreview() ? previewRuntime.joinSpace(spaceId) : client().joinCommunitySpace(spaceId); },
  async addComment(spaceId, postId, body) { return usePreview() ? previewRuntime.addComment(spaceId, postId, body) : client().addCommunityComment(spaceId, postId, body); },
  async reactToPost(spaceId, postId) { return usePreview() ? previewRuntime.reactToPost(spaceId, postId) : client().reactToCommunityPost(spaceId, postId, 'helpful'); },
};

export const communityRuntime: CommunityRuntime = sharedApiRuntime;
