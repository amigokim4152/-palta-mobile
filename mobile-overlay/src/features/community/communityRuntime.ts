export type CommunityKind = 'school' | 'church' | 'neighborhood' | 'interest' | 'activity' | 'apartment';

export type CommunityCard = {
  id: string;
  name: string;
  kind: CommunityKind;
  meta: string;
  unreadCount: number;
  actionRequiredCount: number;
};

export type CommunityFeedItem = {
  id: string;
  communityId: string;
  communityName: string;
  kind: CommunityKind;
  author: string;
  timeLabel: string;
  body: string;
  announcement: boolean;
  commentCount: number;
  reactionCount: number;
};

export type CommunityTabData = {
  communities: CommunityCard[];
  discover: CommunityCard[];
  feed: CommunityFeedItem[];
};

export interface CommunityRuntime {
  loadTab(): Promise<CommunityTabData>;
}

const previewData: CommunityTabData = {
  communities: [
    { id: 'school-1', name: 'Southern Cross School', kind: 'school', meta: 'Familias · 4º básico', unreadCount: 3, actionRequiredCount: 1 },
    { id: 'church-1', name: 'Comunidad de la iglesia', kind: 'church', meta: 'Jóvenes y familias', unreadCount: 1, actionRequiredCount: 0 },
    { id: 'neighborhood-1', name: 'Lo Curro', kind: 'neighborhood', meta: 'Vecindario', unreadCount: 2, actionRequiredCount: 0 },
  ],
  discover: [
    { id: 'discover-1', name: 'Actividades cerca de ti', kind: 'activity', meta: 'Vitacura y alrededores', unreadCount: 0, actionRequiredCount: 0 },
  ],
  feed: [
    { id: 'post-1', communityId: 'school-1', communityName: 'Southern Cross School', kind: 'school', author: 'Familias 4º básico', timeLabel: 'Hace 18 min', body: '¿Alguien sabe si mañana deben llevar el cuaderno de ciencias? Podemos dejar la confirmación aquí para que no se pierda entre mensajes.', announcement: false, commentCount: 6, reactionCount: 4 },
    { id: 'post-2', communityId: 'neighborhood-1', communityName: 'Lo Curro', kind: 'neighborhood', author: 'Vecinos del sector', timeLabel: 'Hace 1 h', body: 'Aviso: hay trabajos en la calle esta tarde. Si cambia el acceso, actualizamos este mismo hilo.', announcement: true, commentCount: 3, reactionCount: 8 },
    { id: 'post-3', communityId: 'church-1', communityName: 'Comunidad de la iglesia', kind: 'church', author: 'Grupo de jóvenes', timeLabel: 'Ayer', body: 'Después de la reunión tendremos un momento para compartir. Quien necesite coordinar transporte puede responder aquí.', announcement: false, commentCount: 5, reactionCount: 7 },
  ],
};

const previewRuntime: CommunityRuntime = {
  async loadTab() {
    return previewData;
  },
};

const httpRuntime: CommunityRuntime = {
  async loadTab() {
    const baseUrl = process.env.EXPO_PUBLIC_PALTA_API_URL;
    if (!baseUrl) return previewRuntime.loadTab();
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/community/tab`);
    if (!response.ok) throw new Error(`Community API ${response.status}`);
    return (await response.json()) as CommunityTabData;
  },
};

export const communityRuntime: CommunityRuntime = httpRuntime;
