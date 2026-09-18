import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

export type PaltaTabIconKey =
  | 'home'
  | 'business'
  | 'community'
  | 'market'
  | 'play';

const ICONS = {
  home: {
    active: 'home',
    inactive: 'home-outline',
  },
  business: {
    active: 'storefront',
    inactive: 'storefront-outline',
  },
  community: {
    active: 'people',
    inactive: 'people-outline',
  },
  market: {
    active: 'bag-handle',
    inactive: 'bag-handle-outline',
  },
  play: {
    active: 'compass',
    inactive: 'compass-outline',
  },
} as const;

export function PaltaTabIcon({
  icon,
  focused,
  color,
  size,
}: {
  icon: PaltaTabIconKey;
  focused: boolean;
  color: ComponentProps<typeof Ionicons>['color'];
  size: number;
}) {
  const definition = ICONS[icon];

  return (
    <Ionicons
      name={focused ? definition.active : definition.inactive}
      color={color}
      size={size}
    />
  );
}
