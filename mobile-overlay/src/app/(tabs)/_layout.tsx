import { Tabs } from 'expo-router';
import { useLocalization } from '../../providers/LocalizationProvider';

export default function TabLayout() {
  const { t } = useLocalization();

  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="home" options={{ title: t('nav.home') }} />
      <Tabs.Screen name="businesses" options={{ title: t('nav.businesses') }} />
      <Tabs.Screen name="neighborhood" options={{ href: null }} />
      <Tabs.Screen name="community" options={{ title: t('nav.community') }} />
      <Tabs.Screen name="market" options={{ title: t('nav.market') }} />
      <Tabs.Screen name="play" options={{ title: t('nav.play') }} />
    </Tabs>
  );
}
