import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from './supabase';

/**
 * Avisos de lo que termina mientras no estás mirando: un post que se terminó de
 * traer, un análisis que ya está.
 *
 * Los manda el servidor cuando termina el trabajo, no el teléfono: ese es el
 * punto. El post se trae y se analiza allá, así que el aviso llega igual con la
 * app cerrada.
 *
 * **El permiso se pide en el momento en que sirve**, no al abrir la app: la
 * primera vez que se trae un post o se toca el ojo, que es cuando hay algo por
 * lo que valga la pena que te avisen.
 */

/** Los avisos que la app ya muestra por su cuenta cuando está abierta. */
const DE_POSTS = new Set(['post_listo', 'post_fallo', 'analisis_listo', 'analisis_fallo']);

export const esAvisoDePost = (datos) => DE_POSTS.has(datos?.type);

/**
 * Con la app abierta, un post que termina ya se ve terminar en la pantalla: un
 * cartel arriba diciendo lo mismo sería ruido. El resto se muestra como siempre.
 */
export function prepararNotificaciones() {
  Notifications.setNotificationHandler({
    handleNotification: async (aviso) => {
      const callado = esAvisoDePost(aviso?.request?.content?.data);
      return {
        shouldShowBanner: !callado,
        shouldShowList: !callado,
        shouldPlaySound: !callado,
        shouldSetBadge: false,
      };
    },
  });
}

let registrando = null;

/**
 * Pedir permiso si todavía no se preguntó, y dejarle al servidor a dónde avisar.
 *
 * No lanza y no insiste: si la persona dijo que no, no se vuelve a preguntar
 * —el sistema tampoco dejaría—, y todo sigue funcionando sin avisos. En el
 * simulador no hay a dónde avisar y no hace nada.
 */
export function registrarAvisos() {
  if (registrando) return registrando;
  registrando = (async () => {
    try {
      if (!Device.isDevice || Platform.OS === 'web') return null;

      let { status } = await Notifications.getPermissionsAsync();
      if (status === 'undetermined') ({ status } = await Notifications.requestPermissionsAsync());
      if (status !== 'granted') return null;

      const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
      const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
      if (!token) return null;

      const { data: sesion } = await supabase.auth.getSession();
      const userId = sesion?.session?.user?.id;
      if (!userId) return null;
      await supabase.from('profiles').update({ push_token: token }).eq('id', userId);
      return token;
    } catch {
      return null;
    } finally {
      // Se puede volver a intentar más tarde: el token cambia al reinstalar.
      setTimeout(() => {
        registrando = null;
      }, 60000);
    }
  })();
  return registrando;
}

/**
 * Escuchar el toque sobre un aviso de post. `alAbrir(postId)` lo recibe también
 * si la app arrancó por ese toque.
 */
export function alTocarAvisoDePost(alAbrir) {
  const atender = (respuesta) => {
    const datos = respuesta?.notification?.request?.content?.data;
    if (esAvisoDePost(datos)) alAbrir(datos.post_id || null);
  };
  Notifications.getLastNotificationResponseAsync().then((r) => r && atender(r)).catch(() => {});
  const sub = Notifications.addNotificationResponseReceivedListener(atender);
  return () => sub.remove();
}
