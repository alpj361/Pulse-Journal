import { Tabs } from 'expo-router';
import { Newspaper, Settings } from 'lucide-react-native';
import { TouchableOpacity, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppBackground from '../../components/AppBackground';
import NavOrb from '../../components/NavOrb';

// ─── Medidas de la barra ───────────────────────────────────────────────────────
const PILL_HEIGHT = 64;
const ORB_SIZE = 68;
const ORB_OVERHANG = 24; // cuánto sobresale el orbe por encima de la píldora
const ORB_SLOT = 92; // hueco reservado en el centro de la píldora

const ACTIVE = '#1C2B22';
const INACTIVE = '#A5AB9F';

// ─── Custom Tab Bar ────────────────────────────────────────────────────────────
function CustomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();

  const routeFor = (name) => state.routes.find((r) => r.name === name);
  const isFocusedRoute = (route) => state.index === state.routes.indexOf(route);

  const navigateTo = (route) => {
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!isFocusedRoute(route) && !event.defaultPrevented) {
      navigation.navigate(route.name);
    }
  };

  const renderTab = (tab) => {
    const route = routeFor(tab.name);
    if (!route) return null;

    const isFocused = isFocusedRoute(route);
    const color = isFocused ? ACTIVE : INACTIVE;

    return (
      <TouchableOpacity
        key={tab.name}
        onPress={() => navigateTo(route)}
        activeOpacity={0.7}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 }}
      >
        <tab.Icon size={22} color={color} strokeWidth={isFocused ? 2.4 : 2} />
        <Text
          style={{
            fontSize: 11,
            fontWeight: isFocused ? '700' : '500',
            color,
            marginTop: 4,
            letterSpacing: -0.1,
          }}
        >
          {tab.label}
        </Text>
      </TouchableOpacity>
    );
  };

  // Orbit queda fuera de la barra pero sigue registrada abajo: la ruta existe
  // y se puede navegar por código, solo no tiene botón.
  const leftTabs = [{ name: 'index', label: 'Feed', Icon: Newspaper }];
  const rightTabs = [{ name: 'settings', label: 'Ajustes', Icon: Settings }];

  // El orbe central abre el Codex. No se oculta cuando no hay conexión: la
  // propia pantalla de Codex muestra su CTA de "Conecta Pulse Journal".
  const codexRoute = routeFor('codex');
  const codexFocused = codexRoute ? isFocusedRoute(codexRoute) : false;

  return (
    <View
      style={{
        backgroundColor: 'transparent',
        paddingTop: ORB_OVERHANG,
        paddingHorizontal: 16,
        paddingBottom: Math.max(insets.bottom, 14),
      }}
    >
      {/* Píldora flotante */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          height: PILL_HEIGHT,
          borderRadius: PILL_HEIGHT / 2,
          backgroundColor: '#FFFFFF',
          shadowColor: '#25332A',
          shadowOpacity: 0.1,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        }}
      >
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          {leftTabs.map(renderTab)}
        </View>
        <View style={{ width: ORB_SLOT }} />
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          {rightTabs.map(renderTab)}
        </View>
      </View>

      {/* Orbe central → Codex. box-none para no robarle los taps a la píldora. */}
      {codexRoute && (
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' }}
        >
          <NavOrb
            size={ORB_SIZE}
            focused={codexFocused}
            onPress={() => navigateTo(codexRoute)}
          />
        </View>
      )}
    </View>
  );
}

// ─── Layout ────────────────────────────────────────────────────────────────────
export default function TabsLayout() {
  return (
    // El fondo vive aquí, detrás de las pantallas y de la tab bar, para que no
    // haya costura entre el área de contenido y la barra flotante.
    <View style={{ flex: 1 }}>
      <AppBackground />
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: 'transparent' },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Feed' }} />
        <Tabs.Screen name="orbit" options={{ title: 'Orbit' }} />
        <Tabs.Screen name="codex" options={{ title: 'Codex' }} />
        <Tabs.Screen name="settings" options={{ title: 'Ajustes' }} />
      </Tabs>
    </View>
  );
}
