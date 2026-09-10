
import { useFonts } from 'expo-font';
import { useAuth } from '@/utils/auth/useAuth';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useNotifications } from '@/utils/useNotifications';
import { usePulseConnectionStore } from '../state/pulseConnectionStore';
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      cacheTime: 1000 * 60 * 30, // 30 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

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
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }} initialRouteName="(tabs)">
          <Stack.Screen name="(tabs)" />
        </Stack>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
