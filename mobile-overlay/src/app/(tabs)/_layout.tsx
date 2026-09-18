import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { paltaTheme } from '../../theme/paltaTheme';

function TabIndicator({ focused }: { focused: boolean }) {
  return (
    <View
      style={{
        width: focused ? 24 : 6,
        height: 3,
        borderRadius: paltaTheme.radius.pill,
        backgroundColor: focused
          ? paltaTheme.color.brandPrimary
          : paltaTheme.color.divider,
      }}
    />
  );
}

export default function TabLayout() {
  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: paltaTheme.color.brandPrimary,
        tabBarInactiveTintColor: paltaTheme.color.textMuted,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          height: 66,
          paddingTop: 7,
          paddingBottom: 7,
          borderTopWidth: 1,
          borderTopColor: paltaTheme.color.divider,
          backgroundColor: paltaTheme.color.surface,
          shadowOpacity: 0,
          elevation: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          lineHeight: 14,
          fontWeight: '700',
        },
        tabBarItemStyle: {
          minHeight: paltaTheme.touch.minimum,
        },
        tabBarIconStyle: {
          height: 8,
          marginBottom: 1,
        },
        tabBarIcon: ({ focused }) => <TabIndicator focused={focused} />,
      }}
    >
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="home" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="neighborhood" options={{ title: 'Negocios' }} />
      <Tabs.Screen name="community" options={{ title: 'Comunidad' }} />
      <Tabs.Screen name="market" options={{ title: 'Mercado' }} />
      <Tabs.Screen name="play" options={{ title: 'Panoramas' }} />
    </Tabs>
  );
}
