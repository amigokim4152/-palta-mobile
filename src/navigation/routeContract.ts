import type { PrimarySurface } from './surfaces.js';

export type EntityRoute =
  | { kind: 'place'; id: string }
  | { kind: 'business'; id: string }
  | { kind: 'care'; id: string }
  | { kind: 'context'; id: string };

export interface ReturnState {
  surface: PrimarySurface;
  searchQuery?: string;
  filterKey?: string;
  scrollOffset?: number;
  mapViewportKey?: string;
  selectedEntityId?: string;
}

export function entityPath(route: EntityRoute): string {
  switch (route.kind) {
    case 'place': return `/place/${encodeURIComponent(route.id)}`;
    case 'business': return `/business/${encodeURIComponent(route.id)}`;
    case 'care': return `/care/${encodeURIComponent(route.id)}`;
    case 'context': return `/context/${encodeURIComponent(route.id)}`;
  }
}

export function shouldPreserveReturnState(from: PrimarySurface, to: EntityRoute): boolean {
  if (to.kind === 'care') return true;
  return from === 'neighborhood' || from === 'market' || from === 'play' || from === 'community';
}
