import { Tabs } from 'expo-router';
import { paltaTheme } from '../../theme/paltaTheme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: paltaTheme.color.brandPrimary,
        tabBarInactiveTintColor: paltaTheme.color.textMuted,
        tabBarStyle: {
          backgroundColor: paltaTheme.color.surface,
          borderTopColor: paltaTheme.color.divider,
          minHeight: 62,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="home" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="neighborhood" options={{ title: 'Barrio' }} />
      <Tabs.Screen name="community" options={{ title: 'Comunidad' }} />
      <Tabs.Screen name="market" options={{ title: 'Mercado' }} />
      <Tabs.Screen name="play" options={{ title: 'Panoramas' }} />
    </Tabs>
  );
}
