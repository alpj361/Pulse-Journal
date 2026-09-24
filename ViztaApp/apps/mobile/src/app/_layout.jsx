
import { useFonts } from 'expo-font';
import { useAuth } from '@/utils/auth/useAuth';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
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
      </GestureHandlerRootView>
    </PersistQueryClientProvider>
  );
}
