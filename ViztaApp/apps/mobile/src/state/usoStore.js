import { create } from 'zustand';
import { supabase } from '../utils/supabase';

/**
 * Cuánto llevás usado de lo que tu plan permite.
 *
 * Tres áreas y nada más —posts, espacios, almacenamiento—, que es lo que la
 * base resuelve en `get_my_usage`. Cada una trae lo usado, su tope y el
 * porcentaje. Un área sin tope viene en null, y se muestra el número pelado
 * en vez de una barra que nunca se llena. Los admins tienen los mismos topes.
 *
 * Sirve para dos cosas distintas: mostrar la pantalla de uso, y frenar antes de
 * crear algo que no va a entrar. Por eso el dato se refresca solo cuando está
 * viejo: preguntar en cada tecla sería un viaje por cada foto que se agrega.
 */

const VIGENCIA_MS = 60 * 1000;

export const useUsoStore = create((set, get) => ({
  uso: null, // { admin, areas: [{ clave, usado, limite, porcentaje }] }
  cargando: false,
  pedidoEn: 0,

  refrescar: async ({ forzar = false } = {}) => {
    if (!forzar && get().uso && Date.now() - get().pedidoEn < VIGENCIA_MS) return get().uso;

    const { data: sesion } = await supabase.auth.getSession();
    if (!sesion?.session) {
      set({ uso: null });
      return null;
    }

    set({ cargando: true, pedidoEn: Date.now() });
    const { data, error } = await supabase.rpc('get_my_usage');
    if (error) {
      // Se conserva lo último que se supo: sin dato, frenar sería peor que dejar pasar.
      console.warn('[uso] no se pudo leer:', error.message);
      set({ cargando: false });
      return get().uso;
    }
    set({ uso: data || null, cargando: false });
    return data;
  },
}));

export const refrescarUso = (opciones) => useUsoStore.getState().refrescar(opciones);

/** El área pedida, tal como la devolvió la base. */
export function areaDeUso(uso, clave) {
  return (uso?.areas || []).find((a) => a.clave === clave) || null;
}

const SIN_CUPO = {
  espacios: 'Llegaste al máximo de espacios de tu plan.',
  almacenamiento: 'Te quedaste sin espacio de almacenamiento.',
  posts: 'Llegaste al límite de posts de tu plan.',
};

/**
 * Frenar antes de crear algo que no entra.
 *
 * Lanza con un mensaje que se puede mostrar tal cual. Si no se pudo leer el
 * uso, deja pasar: quedarse sin conexión no es lo mismo que quedarse sin cupo,
 * y el servidor igual tiene la última palabra en lo que cuesta dinero.
 */
export async function asegurarCupo(clave, extra = 1) {
  const uso = await refrescarUso();
  // Los admins también tienen límites: se revisa igual para todos.
  if (!uso) return true;

  const area = areaDeUso(uso, clave);
  if (!area || area.limite == null) return true;

  if (Number(area.usado) + Number(extra) > Number(area.limite)) {
    throw new Error(SIN_CUPO[clave] || 'Llegaste al límite de tu plan.');
  }
  return true;
}
