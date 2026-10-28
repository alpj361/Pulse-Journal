
import { useFonts } from 'expo-font';
import { useAuth } from '@/utils/auth/useAuth';
import { Stack, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { solicitudesOAuth } from '../components/colaboradores/api';
import { puedeColaborar } from '../components/colaboradores/piezas';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNotifications } from '@/utils/useNotifications';
import { usePulseConnectionStore } from '../state/pulseConnectionStore';
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      // `gcTime` es el nombre nuevo de `cacheTime` en v5; con el viejo, el
      // caché se tiraba a los cinco minutos por defecto y cada vuelta a una
      // pantalla era una consulta nueva.
      gcTime: 1000 * 60 * 60 * 24,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * El caché sobrevive al cierre de la app.
 *
 * Sin esto, abrir Vizta era volver a pedirlo todo: el mapa solo son 1.4 MB de
 * territorios, y hasta que llegan la pantalla está vacía. Con el caché en
 * disco, lo último que se vio se dibuja de inmediato y la consulta corre por
 * detrás para actualizarlo — la diferencia entre esperar y ver.
 *
 * Se guardan solo las consultas que valen la pena conservar: las del mapa y el
 * catálogo, que son grandes y cambian poco. Lo demás sigue viviendo en memoria,
 * porque persistir una lista que cambia cada minuto es escribir en disco para
 * nada.
 */
const persistidor = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'vizta-query',
  // Escribir un megabyte a cada cambio de estado ahogaría al hilo de JS; con la
  // espera, una ráfaga de consultas se guarda una sola vez.
  throttleTime: 2000,
});

const PERSISTIBLES = ['mapa-territorios', 'mapa-catalogo', 'mapa-fronteras-pais', 'mapa-notas-ubicadas'];

const persistencia = {
  persister: persistidor,
  maxAge: 1000 * 60 * 60 * 24 * 7,
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => PERSISTIBLES.includes(query.queryKey?.[0]),
  },
};

/** Las solicitudes ya abiertas, por enlace o solas: cada una se abre una vez. */
const solicitudesAbiertas = new Set();

/**
 * El enlace de la página donde un agente pide conectarse
 * (`com.standatpd.vizta://mcp-authorize?req=…&code=…`) abre la pantalla para
 * autorizarlo, con la app abierta o cerrada. El enrutador no lo toma solo con
 * este esquema, así que se escucha acá.
 */
function AbrirAutorizacion() {
  const router = useRouter();
  const url = Linking.useURL();
  const ultimo = useRef(null);
  useEffect(() => {
    if (!url || url === ultimo.current) return;
    const { hostname, path, queryParams } = Linking.parse(url);
    const destino = String(path || hostname || '').replace(/^\/+/, '');
    if (destino !== 'mcp-authorize') return;
    const req = queryParams?.req || null;
    const code = queryParams?.code || null;
    if (!req && !code) return;
    ultimo.current = url;
    if (req) solicitudesAbiertas.add(req);
    router.push({ pathname: '/mcp-authorize', params: { ...(req ? { req } : {}), ...(code ? { code } : {}) } });
  }, [url, router]);
  return null;
}

/**
 * Cuando un agente pide conectarse desde ChatGPT o Claude, la solicitud aparece
 * acá sola, estés donde estés en la app: se mira cada pocos segundos mientras
 * la app está abierta (solo alfa, beta y admin, que son quienes conectan
 * agentes). Una solicitud se abre una vez; si la cerrás, no vuelve a saltar.
 */
function EsperarAutorizacion() {
  const router = useRouter();
  const usuario = usePulseConnectionStore((s) => s.connectedUser);
  const puede = puedeColaborar(usuario);
  const [activa, setActiva] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (e) => setActiva(e === 'active'));
    return () => sub.remove();
  }, []);
  const consulta = useQuery({
    queryKey: ['mcp-solicitudes'],
    queryFn: solicitudesOAuth,
    enabled: puede && activa,
    refetchInterval: 5000,
    retry: false,
  });
  useEffect(() => {
    const nueva = (consulta.data || []).find((s) => s?.req_id && !solicitudesAbiertas.has(s.req_id));
    if (!nueva) return;
    solicitudesAbiertas.add(nueva.req_id);
    router.push({ pathname: '/mcp-authorize', params: { req: nueva.req_id } });
  }, [consulta.data, router]);
  return null;
}

export default function RootLayout() {
  const { initiate, isReady } = useAuth();

  // La serif editorial, desde el bundle. Si por lo que sea no carga, `fontError`
  // deja seguir igual: la app cae a la fuente del sistema y se ve peor, pero se
  // ve. Bloquear el arranque por una tipografía sería desproporcionado.
  const [fuentesListas, fuentesError] = useFonts({
    InstrumentSerif: require('../../assets/fonts/InstrumentSerif-Regular.ttf'),
  });
  const { initSessionSync } = usePulseConnectionStore();
  useNotifications();

  console.log('[RootLayout] render — isReady:', isReady);

  useEffect(() => {
    console.log('[RootLayout] MOUNTED');
    initiate();
    // Sincronizar estado de Zustand con sesión real de Supabase
    const unsubscribe = initSessionSync();
    return () => {
      console.log('[RootLayout] UNMOUNTED ← this should never happen during logout!');
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [initiate]);

  useEffect(() => {
    if (isReady && (fuentesListas || fuentesError)) {
      console.log('[RootLayout] isReady=true → hiding splash');
      SplashScreen.hideAsync();
    }
    // Sin las fuentes en las dependencias, el splash se quedaría puesto: el
    // efecto corre antes de que carguen y no volvería a correr al terminar.
  }, [isReady, fuentesListas, fuentesError]);

  if (!isReady) {
    console.log('[RootLayout] not ready, returning null');
    return null;
  }

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistencia}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }} initialRouteName="(tabs)">
          <Stack.Screen name="(tabs)" />
        </Stack>
        <AbrirAutorizacion />
        <EsperarAutorizacion />
      </GestureHandlerRootView>
    </PersistQueryClientProvider>
  );
}
