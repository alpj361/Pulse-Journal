import { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { Newspaper, Settings } from 'lucide-react-native';
import { Alert, TouchableOpacity, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppBackground from '../../components/AppBackground';
import NavOrb from '../../components/NavOrb';
import CreateSnippetSheet from '../../components/codex/CreateSnippetSheet';
import PostsSheet from '../../components/posts/PostsSheet';
import { usePulseConnectionStore } from '../../state/pulseConnectionStore';
import { EV, evento, identificar } from '../../utils/analitica';

// ─── Medidas de la barra ───────────────────────────────────────────────────────
const PILL_HEIGHT = 64;
const ORB_SIZE = 68;
const ORB_OVERHANG = 24; // cuánto sobresale el orbe por encima de la píldora
const ORB_SLOT = 92; // hueco reservado en el centro de la píldora

const ACTIVE = '#1C2B22';
const INACTIVE = '#A5AB9F';

// El Codex está oculto por ahora: `codex` sigue registrada abajo —igual que
// `orbit`, que también existe sin botón— así que la pantalla no se borra y
// `navigation.navigate('codex')` sigue funcionando desde código. Lo único que
// desapareció es la puerta de entrada.
//
// El orbe se queda, pero ya no lleva al Codex: abre una nota en blanco. Es el
// mismo gesto de antes —el botón grande del centro— con un destino más chico,
// y evita el agujero de 92px que quedaría en medio de la píldora si el orbe se
// hubiera ido con la ruta.

// ─── Custom Tab Bar ────────────────────────────────────────────────────────────
function CustomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const [escribiendo, setEscribiendo] = useState(false);
  const [viendoPosts, setViendoPosts] = useState(false);

  // Sin sesión no hay dónde guardar: el insert de `codex_universe_items` pide
  // `user_id`. El orbe igual se muestra —esconderlo dejaría un agujero en medio
  // de la píldora y haría que la app se vea distinta según el estado de la
  // cuenta— pero avisa antes de abrir la hoja. El aviso va primero y no después
  // de escribir: descubrir que no hay dónde guardar recién al tocar «guardar»
  // significa perder el párrafo que acabás de escribir.
  const conectado = usePulseConnectionStore((s) => s.isConnected);

  // Posts es solo para admins. Las cuentas nacidas en el teléfono
  // (`user_type: 'phone'`) ven espacios y notas, no la biblioteca de posts.
  // El rol ya viene en el perfil que guarda la sesión, así que no hace falta
  // llamar a `is_admin`: es el mismo dato y evita un viaje.
  const esAdmin = usePulseConnectionStore((s) => s.connectedUser?.role) === 'admin';
  const userId = usePulseConnectionStore((s) => s.connectedUser?.id);

  useEffect(() => {
    evento(EV.APP_ABIERTA, { admin: esAdmin, conectado });
    // Solo una vez por arranque: esto cuenta aperturas, no renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Solo el id. Ni correo ni nombre: para medir uso alcanza con saber que es
  // la misma persona, no quién es.
  useEffect(() => {
    if (userId) identificar(userId, { admin: esAdmin });
  }, [userId, esAdmin]);

  const abrirNota = () => {
    if (!conectado) {
      Alert.alert(
        'Conectá tu cuenta',
        'Las notas se guardan en tu cuenta. Podés conectarla desde Ajustes.'
      );
      return;
    }
    evento(EV.NOTA_ABIERTA);
    setEscribiendo(true);
  };

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

      {/* Orbe central → nota en blanco. box-none para no robarle los taps a la
          píldora. `focused` queda en false: el orbe ya no representa una
          pestaña donde se pueda estar parado, sino una acción. */}
      <View
        pointerEvents="box-none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center' }}
      >
        <NavOrb
          size={ORB_SIZE}
          focused={false}
          etiqueta="Nota nueva"
          onPress={abrirNota}
          // La palanca solo existe si hay a dónde ir: para quien no es admin el
          // orbe sigue siendo un botón, sin un gesto que no lleva a nada.
          onArriba={
            esAdmin && conectado
              ? () => {
                  evento(EV.POSTS_ABIERTOS);
                  setViendoPosts(true);
                }
              : undefined
          }
          etiquetaArriba="posts"
        />
      </View>

      {/* La hoja es un Modal, así que se dibuja sobre toda la app aunque viva
          en la barra. Colgarla de acá la deja disponible en cualquier pestaña,
          que es lo que corresponde a un botón que también está en todas. */}
      {escribiendo && (
        <CreateSnippetSheet
          onClose={() => setEscribiendo(false)}
          topInset={insets.top}
          bottomInset={insets.bottom}
        />
      )}

      {viendoPosts && (
        <PostsSheet
          onClose={() => setViendoPosts(false)}
          topInset={insets.top}
          bottomInset={insets.bottom}
        />
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
