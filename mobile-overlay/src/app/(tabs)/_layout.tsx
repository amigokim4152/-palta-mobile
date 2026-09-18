import { Tabs } from 'expo-router';

import { PaltaTabIcon } from '../../components/navigation/PaltaTabIcon';
import { useLocalization } from '../../providers/LocalizationProvider';
import { paltaTheme } from '../../theme/paltaTheme';

export default function TabLayout() {
  const { t } = useLocalization();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: paltaTheme.color.brandPrimary,
        tabBarInactiveTintColor: paltaTheme.color.textMuted,
        tabBarStyle: {
          backgroundColor: paltaTheme.color.surface,
          borderTopColor: paltaTheme.color.divider,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen name="index" options={{ href: null }} />

      <Tabs.Screen
        name="home"
        options={{
          title: t('nav.home'),
          tabBarIcon: ({ color, size, focused }) => (
            <PaltaTabIcon
              icon="home"
              color={color}
              size={size}
              focused={focused}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="businesses"
        options={{
          title: t('nav.businesses'),
          tabBarIcon: ({ color, size, focused }) => (
            <PaltaTabIcon
              icon="business"
              color={color}
              size={size}
              focused={focused}
            />
          ),
        }}
      />

      <Tabs.Screen name="neighborhood" options={{ href: null }} />

      <Tabs.Screen
        name="community"
        options={{
          title: t('nav.community'),
          tabBarIcon: ({ color, size, focused }) => (
            <PaltaTabIcon
              icon="community"
              color={color}
              size={size}
              focused={focused}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="market"
        options={{
          title: t('nav.market'),
          tabBarIcon: ({ color, size, focused }) => (
            <PaltaTabIcon
              icon="market"
              color={color}
              size={size}
              focused={focused}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="play"
        options={{
          title: t('nav.play'),
          tabBarIcon: ({ color, size, focused }) => (
            <PaltaTabIcon
              icon="play"
              color={color}
              size={size}
              focused={focused}
            />
          ),
        }}
      />
    </Tabs>
  );
}
