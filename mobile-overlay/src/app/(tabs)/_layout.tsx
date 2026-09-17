import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="home" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="businesses" options={{ title: 'Negocios' }} />
      <Tabs.Screen name="neighborhood" options={{ title: 'Barrio' }} />
      <Tabs.Screen name="community" options={{ title: 'Comunidad' }} />
      <Tabs.Screen name="market" options={{ title: 'Mercado' }} />
      <Tabs.Screen name="play" options={{ title: 'Panoramas' }} />
    </Tabs>
  );
}
