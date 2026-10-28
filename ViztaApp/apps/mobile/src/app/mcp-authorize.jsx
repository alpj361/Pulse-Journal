import { View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AutorizarConexion from '../components/colaboradores/AutorizarConexion';

/**
 * Adonde llega el enlace de la página de autorización de un agente
 * (`com.standatpd.vizta://mcp-authorize?req=…&code=…`): se autoriza o se
 * rechaza sin pasar por la web.
 */
export default function AutorizarMcp() {
  const { req, code } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cerrar = () => (router.canGoBack() ? router.back() : router.replace('/'));
  return (
    <View style={{ flex: 1, backgroundColor: '#F3F2EC' }}>
      <Stack.Screen options={{ presentation: 'fullScreenModal', headerShown: false }} />
      <AutorizarConexion
        req={typeof req === 'string' ? req : null}
        codigo={typeof code === 'string' ? code : null}
        topInset={insets.top}
        bottomInset={insets.bottom}
        onCerrar={cerrar}
        onEntrar={() => router.replace('/settings')}
      />
    </View>
  );
}
