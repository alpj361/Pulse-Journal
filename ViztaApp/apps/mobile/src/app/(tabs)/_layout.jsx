import { Tabs } from 'expo-router';
import { Newspaper, BookOpen, Settings, Orbit } from 'lucide-react-native';
import { usePulseConnectionStore } from '../../state/pulseConnectionStore';

export default function TabsLayout() {
  const isConnected = usePulseConnectionStore((s) => s.isConnected);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(8, 10, 24, 0.95)',
          borderTopColor: 'rgba(255,255,255,0.08)',
          borderTopWidth: 1,
          height: 80,
          paddingBottom: 16,
        },
        tabBarActiveTintColor: '#ffffff',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.35)',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color }) => <Newspaper size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="orbit"
        options={{
          title: 'Orbit',
          tabBarIcon: ({ color }) => <Orbit size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="codex"
        options={{
          title: 'Codex',
          tabBarIcon: ({ color }) => <BookOpen size={22} color={color} />,
          tabBarButton: isConnected ? undefined : () => null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color }) => <Settings size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
