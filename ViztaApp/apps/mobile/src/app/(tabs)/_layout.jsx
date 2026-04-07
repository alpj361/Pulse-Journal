import { Tabs, useRouter, usePathname } from 'expo-router';
import { Newspaper, BookOpen, Settings, Orbit } from 'lucide-react-native';
import { usePulseConnectionStore } from '../../state/pulseConnectionStore';
import { useRef, useEffect, useState } from 'react';
import { Animated, TouchableOpacity, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Custom Tab Bar ────────────────────────────────────────────────────────────
function CustomTabBar({ state, descriptors, navigation }) {
  const isConnected = usePulseConnectionStore((s) => s.isConnected);
  const insets = useSafeAreaInsets();
  const codexOpacity = useRef(new Animated.Value(isConnected ? 1 : 0)).current;
  const prevConnected = useRef(isConnected);
  const timerRef = useRef(null);
  const [codexVisible, setCodexVisible] = useState(isConnected);

  useEffect(() => {
    if (prevConnected.current === isConnected) return;
    prevConnected.current = isConnected;
    if (timerRef.current) clearTimeout(timerRef.current);

    if (isConnected) {
      setCodexVisible(true);
      codexOpacity.stopAnimation();
      Animated.timing(codexOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    } else {
      codexOpacity.stopAnimation();
      Animated.timing(codexOpacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
        timerRef.current = setTimeout(() => setCodexVisible(false), 50);
      });
    }
  }, [isConnected]);

  const TABS = [
    { name: 'index',    label: 'Feed',   Icon: Newspaper },
    { name: 'orbit',    label: 'Orbit',  Icon: Orbit },
    { name: 'codex',    label: 'Codex',  Icon: BookOpen,  codex: true },
    { name: 'settings', label: 'Ajustes', Icon: Settings },
  ];

  return (
    <View style={{
      flexDirection: 'row',
      backgroundColor: 'rgba(8, 10, 24, 0.95)',
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.08)',
      height: 60 + insets.bottom,
      paddingBottom: insets.bottom,
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {TABS.map((tab) => {
        // Skip codex entirely from layout when not visible
        if (tab.codex && !codexVisible) return null;

        const route = state.routes.find((r) => r.name === tab.name);
        if (!route) return null;

        const isFocused = state.index === state.routes.indexOf(route);
        const color = isFocused ? '#ffffff' : 'rgba(255,255,255,0.35)';

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const button = (
          <TouchableOpacity
            key={tab.name}
            onPress={onPress}
            activeOpacity={0.7}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 }}
          >
            <tab.Icon size={22} color={color} />
            <Text style={{ fontSize: 11, fontWeight: '600', color, marginTop: 3 }}>{tab.label}</Text>
          </TouchableOpacity>
        );

        if (tab.codex) {
          return (
            <Animated.View key={tab.name} style={{ flex: 1, opacity: codexOpacity }}>
              <TouchableOpacity
                onPress={onPress}
                activeOpacity={0.7}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 }}
              >
                <tab.Icon size={22} color={color} />
                <Text style={{ fontSize: 11, fontWeight: '600', color, marginTop: 3 }}>{tab.label}</Text>
              </TouchableOpacity>
            </Animated.View>
          );
        }

        return (
          <View key={tab.name} style={{ flex: 1 }}>
            {button}
          </View>
        );
      })}
    </View>
  );
}

// ─── Layout ────────────────────────────────────────────────────────────────────
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: 'Feed' }} />
      <Tabs.Screen name="orbit" options={{ title: 'Orbit' }} />
      <Tabs.Screen name="codex" options={{ title: 'Codex' }} />
      <Tabs.Screen name="settings" options={{ title: 'Ajustes' }} />
    </Tabs>
  );
}
