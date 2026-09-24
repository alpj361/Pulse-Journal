import { create } from 'zustand';
import { AppState } from 'react-native';
import { supabase } from '../utils/supabase';

/**
 * Qué puede hacer esta persona: su plan, sus límites, su saldo.
 *
 * Lo decide la base (`get_my_capabilities`), no la app: el mismo dato que usa
 * el servidor para dejar pasar o no un gasto. La app solo lo muestra y esconde
 * lo que no está disponible, porque una pantalla escondida no es un permiso.
 *
 * Se vuelve a pedir al entrar, al volver del segundo plano y después de
 * comprar: el plan puede haber cambiado desde la tienda sin que la app se
 * entere.
 */
export const useCapacidadesStore = create((set, get) => ({
  capacidades: null, // { plan, limits, features, admin, creditos, suscripcion, posts }
  cargando: false,
  pedidoEn: 0,

  refrescar: async ({ forzar = false } = {}) => {
    // Sin sesión no hay capacidades: `get_my_capabilities` mira `auth.uid()`.
    const { data: sesion } = await supabase.auth.getSession();
    if (!sesion?.session) {
      set({ capacidades: null, cargando: false });
      return null;
    }

    // Un refresco por segundo alcanza: esto lo llaman varias pantallas al montar.
    if (!forzar && Date.now() - get().pedidoEn < 1000) return get().capacidades;
    set({ cargando: true, pedidoEn: Date.now() });

    const { data, error } = await supabase.rpc('get_my_capabilities');
    if (error) {
      // Se conserva lo último que se supo: quedarse sin capacidades escondería
      // Posts a quien sí lo tiene solo porque falló una consulta.
      console.warn('[capacidades] no se pudieron leer:', error.message);
      set({ cargando: false });
      return get().capacidades;
    }

    set({ capacidades: data || null, cargando: false });
    return data;
  },
}));

/** Pedirlas de nuevo después de comprar, de entrar o de volver a la app. */
export const refrescarCapacidades = (opciones) => useCapacidadesStore.getState().refrescar(opciones);

AppState.addEventListener('change', (estado) => {
  if (estado === 'active') refrescarCapacidades();
});
