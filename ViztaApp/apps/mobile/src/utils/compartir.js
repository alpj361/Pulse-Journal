import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';
import { EXTRACTORW_URL } from './servicios';

/**
 * Dejarle a la hoja de «Compartir» con qué mandar un post.
 *
 * La hoja corre dentro de Instagram o de X y no tiene la sesión de la persona.
 * Lo que sí puede leer es un casillero del llavero que comparte con la app. Acá
 * se le deja ahí una **llave que solo sirve para mandar un post** —no la
 * sesión—, pedida al servidor. Ver `plugins/compartir` (la extensión) y
 * `services/llaveCompartir` en ExtractorW.
 *
 * Los nombres de abajo tienen que coincidir con los del plugin.
 */
const EQUIPO = '4THD987397';
const GRUPO = `${EQUIPO}.com.standatpd.vizta.compartido`;
const OPCIONES = {
  keychainService: 'vizta.compartir',
  accessGroup: GRUPO,
  // Que se pueda leer con el teléfono bloqueado después del primer desbloqueo:
  // se comparte desde otra app, no desde Vizta.
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};
const CLAVE = 'llave';
// De quién es la llave guardada: si entra otra cuenta, se pide una nueva.
const CLAVE_DUENO = 'dueno';

let enCurso = null;

/**
 * Con sesión: asegura que la llave esté guardada. Sin sesión: la borra, para
 * que compartir no siga mandando posts a una cuenta de la que se salió.
 *
 * No lanza: si no se puede, la hoja dice «Abrí Vizta para conectar tu cuenta»
 * y todo lo demás sigue igual.
 */
export function prepararCompartir(conectado) {
  if (Platform.OS !== 'ios') return Promise.resolve(false);
  if (enCurso) return enCurso;
  enCurso = (async () => {
    try {
      if (!conectado) {
        await SecureStore.deleteItemAsync(CLAVE, OPCIONES);
        await SecureStore.deleteItemAsync(CLAVE_DUENO, OPCIONES);
        return false;
      }
      const { data: sesion } = await supabase.auth.getSession();
      const token = sesion?.session?.access_token;
      const userId = sesion?.session?.user?.id;
      if (!token || !userId) return false;

      const [llave, dueno] = await Promise.all([
        SecureStore.getItemAsync(CLAVE, OPCIONES),
        SecureStore.getItemAsync(CLAVE_DUENO, OPCIONES),
      ]);
      if (llave && dueno === userId) return true;

      const res = await fetch(`${EXTRACTORW_URL}/api/agregar-post/llave`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.llave) return false;
      await SecureStore.setItemAsync(CLAVE, json.llave, OPCIONES);
      await SecureStore.setItemAsync(CLAVE_DUENO, userId, OPCIONES);
      return true;
    } catch {
      return false;
    } finally {
      enCurso = null;
    }
  })();
  return enCurso;
}
