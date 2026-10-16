import { useCapacidadesStore } from '../state/capacidadesStore';
import { usePulseConnectionStore } from '../state/pulseConnectionStore';

/**
 * Puerta Beta de Congreso y CC.
 *
 * No había un gate de Beta en la app: Codex pide sesión, Posts mira
 * `get_my_capabilities().posts`, y el admin se lee de `profiles.role`.
 * Congreso y CC no encajan en ninguno de esos, así que este archivo es la
 * única puerta. Sin migración: usa lo que ya existe en el perfil y el plan.
 *
 * Una cuenta entra si:
 *  · `profiles.role` o `profiles.roles` trae `admin`, `beta` o `alpha`
 *  · o el plan resuelto por `get_my_capabilities` es `alpha` (plan Alfa)
 *
 * Para abrirla a alguien: agregar `beta` a `profiles.roles`. Los usuarios
 * regulares autenticados siguen viendo solo las noticias.
 *
 * En desarrollo local, `EXPO_PUBLIC_BETA_PREVIEW=1` salta la puerta para
 * revisar la UI. No existe en producción.
 */
const ROLES_BETA = new Set(['admin', 'beta', 'alpha']);

export function cuentaEsBeta(usuario, capacidades) {
  if (!usuario) return false;
  const roles = [usuario.role, ...(Array.isArray(usuario.roles) ? usuario.roles : [])];
  if (roles.some((rol) => ROLES_BETA.has(String(rol || '').toLowerCase()))) return true;
  return capacidades?.plan?.key === 'alpha';
}

export function previewBetaActivo() {
  return typeof __DEV__ !== 'undefined' && __DEV__ && process.env.EXPO_PUBLIC_BETA_PREVIEW === '1';
}

export function useEsBeta() {
  const autenticado = usePulseConnectionStore((s) => s.isConnected);
  const usuario = usePulseConnectionStore((s) => s.connectedUser);
  const capacidades = useCapacidadesStore((s) => s.capacidades);
  const preview = previewBetaActivo();

  return {
    autenticado: !!autenticado && !!usuario,
    esBeta: preview || cuentaEsBeta(usuario, capacidades),
    preview,
  };
}
