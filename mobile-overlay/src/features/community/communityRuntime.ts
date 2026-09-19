import { mobileRuntime } from '../../services/paltaClient';
import { useCommunityPreview } from './communityRuntimePolicy';
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
import {
  acknowledgeSchoolFlowItem,
  defaultTrustScopeForCommunityKind,
  orderSchoolFlowItems,
  type SchoolFlowStage,
  type SchoolScope,
  type SchoolStructuredItem,
} from '../../../../src/community/communityExperience';
import type { CommunityTrustScope } from '../../../../src/community/trustScopePolicy';

export type { CommunityKind, CommunityMembershipState, SchoolFlowStage, SchoolScope };
export type CommunityCard = CommunityApiCard;
export type CommunityFeedItem = CommunityApiFeedItem;
export type CommunityTabData = CommunityApiTab;
export type CommunityComment = CommunityApiComment;

export type CommunityPostPurpose =
  | SchoolFlowStage
  | 'discussion'
  | 'album'
  | 'general';

export type CommunityPostSummary = CommunityApiPostSummary & {
  title?: string;
  purpose?: CommunityPostPurpose;
  requiresAcknowledgement?: boolean;
  acknowledged?: boolean;
  sensitive?: boolean;
};

export type CommunitySpaceData = Omit<CommunityApiSpace, 'posts'> & {
  kind?: CommunityKind;
  trustScope?: CommunityTrustScope;
  relationshipActive?: boolean;
  notificationsEnabled?: boolean;
  schoolScope?: SchoolScope;
  schoolItems?: SchoolStructuredItem[];
  posts: CommunityPostSummary[];
};

export type CommunityThreadData = Omit<CommunityApiThread, 'post'> & {
  post: CommunityPostSummary;
};

export interface CommunityRuntime {
  loadTab(): Promise<CommunityTabData>;
  loadSpace(spaceId: string): Promise<CommunitySpaceData>;
  loadPost(spaceId: string, postId: string): Promise<CommunityThreadData>;
  joinSpace(spaceId: string): Promise<void>;
  addComment(spaceId: string, postId: string, body: string): Promise<void>;
  reactToPost(spaceId: string, postId: string): Promise<void>;
  acknowledgePost(spaceId: string, postId: string): Promise<void>;
}

const previewData: CommunityTabData = {
  communities: [
    {
      id: 'school-1',
      name: 'Southern Cross School',
      kind: 'school',
      meta: 'Privado · Familias · 4º básico',
      unreadCount: 3,
      actionRequiredCount: 2,
    },
    {
      id: 'neighborhood-1',
      name: 'Lo Curro',
      kind: 'neighborhood',
      meta: 'Vecinos verificados',
      unreadCount: 2,
      actionRequiredCount: 0,
    },
    {
      id: 'church-1',
      name: 'Comunidad de la iglesia',
      kind: 'church',
      meta: 'Privado · Jóvenes y familias',
      unreadCount: 1,
      actionRequiredCount: 0,
    },
    {
      id: 'apartment-1',
      name: 'Comunidad del edificio',
      kind: 'apartment',
      meta: 'Privado · Residentes y administración',
      unreadCount: 0,
      actionRequiredCount: 1,
    },
  ],
  discover: [
    {
      id: 'activity-1',
      name: 'Actividades cerca de ti',
      kind: 'activity',
      meta: 'Panoramas y actividades locales',
      unreadCount: 0,
      actionRequiredCount: 0,
    },
    {
      id: 'interest-1',
      name: 'Lectura en español',
      kind: 'interest',
      meta: 'Grupo con aprobación · Santiago',
      unreadCount: 0,
      actionRequiredCount: 0,
    },
  ],
  feed: [
    {
      id: 'school-announcement',
      communityId: 'school-1',
      communityName: 'Southern Cross School',
      kind: 'school',
      author: 'Familias 4º básico',
      timeLabel: 'Hace 18 min',
      body: 'Salida pedagógica confirmada. La fecha y lo que hay que preparar quedan ordenados dentro del curso.',
      announcement: true,
      commentCount: 2,
      reactionCount: 4,
    },
    {
      id: 'school-supplies',
      communityId: 'school-1',
      communityName: 'Southern Cross School',
      kind: 'school',
      author: 'Familias 4º básico',
      timeLabel: 'Hace 35 min',
      body: 'Para mañana: cuaderno de ciencias y estuche. Puedes marcarlo como confirmado cuando esté listo.',
      announcement: false,
      commentCount: 1,
      reactionCount: 3,
    },
    {
      id: 'post-2',
      communityId: 'neighborhood-1',
      communityName: 'Lo Curro',
      kind: 'neighborhood',
      author: 'Vecinos del sector',
      timeLabel: 'Hace 1 h',
      body: 'Aviso: hay trabajos en la calle esta tarde. Si cambia el acceso, actualizamos este mismo hilo.',
      announcement: true,
      commentCount: 3,
      reactionCount: 8,
    },
    {
      id: 'post-3',
      communityId: 'church-1',
      communityName: 'Comunidad de la iglesia',
      kind: 'church',
      author: 'Grupo de jóvenes',
      timeLabel: 'Ayer',
      body: 'Después de la reunión tendremos un momento para compartir. Quien necesite coordinar transporte puede responder aquí.',
      announcement: false,
      commentCount: 5,
      reactionCount: 7,
    },
    {
      id: 'post-4',
      communityId: 'apartment-1',
      communityName: 'Comunidad del edificio',
      kind: 'apartment',
      author: 'Administración',
      timeLabel: 'Ayer',
      body: 'El mantenimiento del portón se realizará mañana por la mañana. Dejaremos aquí cualquier cambio de horario.',
      announcement: true,
      commentCount: 2,
      reactionCount: 3,
    },
  ],
};

const previewPosts: Record<string, CommunityPostSummary[]> = {
  'school-1': [
    {
      id: 'school-announcement',
      author: 'Familias 4º básico',
      timeLabel: 'Hace 18 min',
      title: 'Salida pedagógica confirmada',
      body: 'La salida quedó confirmada. En Palta dejamos la fecha, lo que hay que preparar y cualquier seguimiento en el mismo lugar.',
      commentCount: 2,
      reactionCount: 4,
      purpose: 'announcement',
      acknowledged: true,
    },
    {
      id: 'school-schedule',
      author: 'Familias 4º básico',
      timeLabel: 'Hoy',
      title: 'Reunión de apoderados',
      body: 'Martes 22 de septiembre · 18:30. Si cambia el horario, se actualiza esta misma referencia.',
      commentCount: 0,
      reactionCount: 1,
      purpose: 'schedule',
    },
    {
      id: 'school-supplies',
      author: 'Familias 4º básico',
      timeLabel: 'Hace 35 min',
      title: 'Preparar para mañana',
      body: 'Cuaderno de ciencias y estuche. Marca Confirmar cuando ya esté preparado.',
      commentCount: 1,
      reactionCount: 3,
      purpose: 'supplies',
      requiresAcknowledgement: true,
      acknowledged: false,
    },
    {
      id: 'school-child-notice',
      author: 'Información del curso',
      timeLabel: 'Hoy',
      title: 'Autorización pendiente',
      body: 'Hay una autorización relacionada con tu vínculo familiar que requiere revisión. Este aviso no se publica en el feed abierto.',
      commentCount: 0,
      reactionCount: 0,
      purpose: 'child_notice',
      requiresAcknowledgement: true,
      acknowledged: false,
      sensitive: true,
    },
    {
      id: 'school-discussion',
      author: 'Familias 4º básico',
      timeLabel: 'Ayer',
      title: 'Conversación del curso',
      body: 'Para conversación rápida puedes seguir usando WhatsApp. Aquí dejamos lo que conviene encontrar de nuevo después.',
      commentCount: 2,
      reactionCount: 2,
      purpose: 'discussion',
    },
  ],
  'neighborhood-1': [
    {
      id: 'post-2',
      author: 'Vecinos del sector',
      timeLabel: 'Hace 1 h',
      body: 'Aviso: hay trabajos en la calle esta tarde. Si cambia el acceso, actualizamos este mismo hilo.',
      commentCount: 1,
      reactionCount: 8,
      purpose: 'general',
    },
  ],
  'church-1': [
    {
      id: 'post-3',
      author: 'Grupo de jóvenes',
      timeLabel: 'Ayer',
      body: 'Después de la reunión tendremos un momento para compartir. Quien necesite coordinar transporte puede responder aquí.',
      commentCount: 1,
      reactionCount: 7,
      purpose: 'discussion',
    },
  ],
  'apartment-1': [
    {
      id: 'post-4',
      author: 'Administración',
      timeLabel: 'Ayer',
      body: 'El mantenimiento del portón se realizará mañana por la mañana. Dejaremos aquí cualquier cambio de horario.',
      commentCount: 1,
      reactionCount: 3,
      purpose: 'announcement',
      requiresAcknowledgement: true,
      acknowledged: false,
    },
  ],
  'activity-1': [],
  'interest-1': [],
};

const baseSchoolItems: SchoolStructuredItem[] = [
  {
    id: 'flow-announcement',
    postId: 'school-announcement',
    stage: 'announcement',
    title: 'Salida pedagógica confirmada',
    detail: 'Aviso principal del curso',
    status: 'done',
    actionRequired: false,
    sensitive: false,
  },
  {
    id: 'flow-schedule',
    postId: 'school-schedule',
    stage: 'schedule',
    title: 'Reunión de apoderados',
    detail: 'Martes 22 de septiembre · 18:30',
    status: 'pending',
    actionRequired: false,
    sensitive: false,
    dueLabel: '22 sep · 18:30',
  },
  {
    id: 'flow-supplies',
    postId: 'school-supplies',
    stage: 'supplies',
    title: 'Cuaderno de ciencias + estuche',
    detail: 'Preparar para mañana',
    status: 'pending',
    actionRequired: true,
    sensitive: false,
    dueLabel: 'Mañana',
  },
  {
    id: 'flow-child',
    postId: 'school-child-notice',
    stage: 'child_notice',
    title: 'Autorización pendiente',
    detail: 'Solo visible dentro de tu relación autorizada',
    status: 'pending',
    actionRequired: true,
    sensitive: true,
    dueLabel: 'Pendiente',
  },
];

const previewComments: Record<string, CommunityComment[]> = {
  'school-announcement': [
    {
      id: 'comment-1',
      author: 'Familias 4º básico',
      body: 'La información quedó confirmada esta tarde.',
      timeLabel: 'Hace 12 min',
    },
    {
      id: 'comment-2',
      author: 'Familias 4º básico',
      body: 'Gracias. Así queda fácil de encontrar.',
      timeLabel: 'Hace 8 min',
    },
  ],
  'school-supplies': [
    {
      id: 'comment-school-supplies',
      author: 'Familias 4º básico',
      body: 'Confirmado: ciencias y estuche.',
      timeLabel: 'Hace 20 min',
    },
  ],
  'school-discussion': [
    {
      id: 'comment-school-discussion-1',
      author: 'Familias 4º básico',
      body: 'Perfecto, lo dejamos aquí como referencia.',
      timeLabel: 'Ayer',
    },
    {
      id: 'comment-school-discussion-2',
      author: 'Familias 4º básico',
      body: 'Para coordinar rápido seguimos por WhatsApp.',
      timeLabel: 'Ayer',
    },
  ],
  'post-2': [
    {
      id: 'comment-3',
      author: 'Vecinos del sector',
      body: 'El acceso norte sigue abierto por ahora.',
      timeLabel: 'Hace 40 min',
    },
  ],
  'post-3': [
    {
      id: 'comment-4',
      author: 'Grupo de jóvenes',
      body: 'Hay dos cupos para coordinar transporte.',
      timeLabel: 'Ayer',
    },
  ],
  'post-4': [
    {
      id: 'comment-5',
      author: 'Administración',
      body: 'Confirmaremos el término de los trabajos en este hilo.',
      timeLabel: 'Ayer',
    },
  ],
};

const membershipOverrides = new Map<string, CommunityMembershipState>();
const reactionOverrides = new Map<string, number>();
const acknowledgementOverrides = new Set<string>();
const cardCache = new Map<string, CommunityCard>();

function rememberTab(data: CommunityTabData): CommunityTabData {
  for (const card of [...data.communities, ...data.discover]) cardCache.set(card.id, card);
  return data;
}

function cardFor(spaceId: string): CommunityCard | undefined {
  return [...previewData.communities, ...previewData.discover].find(
    (item) => item.id === spaceId,
  );
}

function postWithRuntimeState(post: CommunityPostSummary): CommunityPostSummary {
  const reactionCount = reactionOverrides.get(post.id) ?? post.reactionCount;
  if (!post.requiresAcknowledgement) return { ...post, reactionCount };
  return {
    ...post,
    reactionCount,
    acknowledged: Boolean(post.acknowledged || acknowledgementOverrides.has(post.id)),
  };
}

function postsFor(spaceId: string): CommunityPostSummary[] {
  return (previewPosts[spaceId] ?? []).map(postWithRuntimeState);
}

function schoolItemsFor(): SchoolStructuredItem[] {
  let items = orderSchoolFlowItems(baseSchoolItems);
  for (const postId of acknowledgementOverrides) {
    items = acknowledgeSchoolFlowItem(items, postId);
  }
  return items;
}

function previewMembership(spaceId: string): CommunityMembershipState {
  return (
    membershipOverrides.get(spaceId) ??
    (previewData.communities.some((item) => item.id === spaceId) ? 'active' : 'none')
  );
}

function previewSpace(spaceId: string): CommunitySpaceData {
  const card = cardFor(spaceId);
  if (!card) throw new Error('Community space not found');
  const membershipState = previewMembership(spaceId);
  const trustScope = defaultTrustScopeForCommunityKind(card.kind);
  const isPending = membershipState === 'pending';
  const isInviteOnly = membershipState === 'invite_required';
  const canJoin = membershipState === 'none' && !isInviteOnly;

  const base: CommunitySpaceData = {
    id: spaceId,
    name: card.name,
    subtitle: card.meta,
    membershipState,
    canJoin,
    joinLabel: isPending
      ? 'Solicitud enviada'
      : isInviteOnly
        ? 'Acceso por invitación'
        : trustScope === 'member_group'
          ? 'Solicita acceso a esta comunidad'
          : 'Únete a esta comunidad',
    joinDescription: isPending
      ? 'Te avisaremos cuando se apruebe. Mientras tanto no recibirás contenido privado ni notificaciones del grupo.'
      : isInviteOnly
        ? 'Este espacio solo se abre a relaciones verificadas o mediante invitación.'
        : trustScope === 'member_group'
          ? 'El acceso es privado. Tu solicitud debe respetar las reglas y la relación de esta comunidad.'
          : 'Al unirte podrás participar según las reglas de esta comunidad.',
    joinActionLabel: trustScope === 'member_group' ? 'Solicitar acceso' : 'Unirme',
    posts: membershipState === 'active' || trustScope === 'public_local' ? postsFor(spaceId) : [],
    kind: card.kind,
    trustScope,
    relationshipActive: membershipState === 'active',
    notificationsEnabled: membershipState === 'active',
  };

  if (spaceId === 'school-1') {
    return {
      ...base,
      schoolScope: 'class',
      schoolItems: membershipState === 'active' ? schoolItemsFor() : [],
    };
  }

  return base;
}

function enrichRemoteSpace(space: CommunityApiSpace): CommunitySpaceData {
  const remote = space as CommunitySpaceData;
  const cachedKind = remote.kind ?? cardCache.get(space.id)?.kind;
  if (!cachedKind) return remote;
  return {
    ...remote,
    kind: cachedKind,
    trustScope: remote.trustScope ?? defaultTrustScopeForCommunityKind(cachedKind),
  };
}

const previewRuntime: CommunityRuntime = {
  async loadTab() {
    return rememberTab(previewData);
  },
  async loadSpace(spaceId) {
    return previewSpace(spaceId);
  },
  async loadPost(spaceId, postId) {
    const card = cardFor(spaceId);
    const post = postsFor(spaceId).find((item) => item.id === postId);
    if (!card || !post) throw new Error('Community post not found');
    return {
      communityName: card.name,
      post,
      comments: previewComments[postId] ?? [],
      canComment: previewMembership(spaceId) === 'active',
    };
  },
  async joinSpace(spaceId) {
    const card = cardFor(spaceId);
    if (!card) throw new Error('Community space not found');
    membershipOverrides.set(
      spaceId,
      defaultTrustScopeForCommunityKind(card.kind) === 'member_group' ? 'pending' : 'active',
    );
  },
  async addComment(_spaceId, postId, body) {
    const list = previewComments[postId] ?? (previewComments[postId] = []);
    list.push({
      id: `comment-${Date.now()}`,
      author: 'Tú',
      body,
      timeLabel: 'Ahora',
    });
  },
  async reactToPost(_spaceId, postId) {
    const post = Object.values(previewPosts).flat().find((item) => item.id === postId);
    const original = post?.reactionCount ?? 0;
    reactionOverrides.set(postId, (reactionOverrides.get(postId) ?? original) + 1);
  },
  async acknowledgePost(spaceId, postId) {
    if (previewMembership(spaceId) !== 'active') {
      throw new Error('Active community membership required');
    }
    acknowledgementOverrides.add(postId);
  },
};


function client() {
  if (mobileRuntime.status !== 'ready') throw new Error(mobileRuntime.message);
  return mobileRuntime.client;
}

const sharedApiRuntime: CommunityRuntime = {
  async loadTab() {
    const data = useCommunityPreview() ? await previewRuntime.loadTab() : await client().getCommunityTab();
    return rememberTab(data);
  },
  async loadSpace(spaceId) {
    return useCommunityPreview()
      ? previewRuntime.loadSpace(spaceId)
      : enrichRemoteSpace(await client().getCommunitySpace(spaceId));
  },
  async loadPost(spaceId, postId) {
    return useCommunityPreview()
      ? previewRuntime.loadPost(spaceId, postId)
      : (await client().getCommunityPost(spaceId, postId)) as CommunityThreadData;
  },
  async joinSpace(spaceId) {
    return useCommunityPreview()
      ? previewRuntime.joinSpace(spaceId)
      : client().joinCommunitySpace(spaceId);
  },
  async addComment(spaceId, postId, body) {
    return useCommunityPreview()
      ? previewRuntime.addComment(spaceId, postId, body)
      : client().addCommunityComment(spaceId, postId, body);
  },
  async reactToPost(spaceId, postId) {
    return useCommunityPreview()
      ? previewRuntime.reactToPost(spaceId, postId)
      : client().reactToCommunityPost(spaceId, postId, 'helpful');
  },
  async acknowledgePost(spaceId, postId) {
    return useCommunityPreview()
      ? previewRuntime.acknowledgePost(spaceId, postId)
      : client().reactToCommunityPost(spaceId, postId, 'acknowledged');
  },
};

export const communityRuntime: CommunityRuntime = sharedApiRuntime;
