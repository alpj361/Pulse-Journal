
import { useAuth } from '@/utils/auth/useAuth';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useNotifications } from '@/utils/useNotifications';
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
  useNotifications();

  console.log('[RootLayout] render — isReady:', isReady);

  useEffect(() => {
    console.log('[RootLayout] MOUNTED');
    initiate();
    return () => {
      console.log('[RootLayout] UNMOUNTED ← this should never happen during logout!');
    };
  }, [initiate]);

  useEffect(() => {
    if (isReady) {
      console.log('[RootLayout] isReady=true → hiding splash');
      SplashScreen.hideAsync();
    }
  }, [isReady]);

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
