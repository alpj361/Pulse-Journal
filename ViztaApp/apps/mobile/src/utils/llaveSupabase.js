/**
 * Llave pública de Supabase para el cliente (app, web, scripts).
 *
 * La anon JWT (`eyJ…`) ya no sirve: el proyecto la apagó. La publishable
 * (`sb_publishable_…`) es pública por diseño y no es un JWT, así que no va
 * en `Authorization: Bearer`. supabase-js la manda en `apikey`; la sesión
 * del usuario, si hay, va aparte como Bearer.
 *
 * Si EAS o el entorno todavía tienen `EXPO_PUBLIC_SUPABASE_ANON_KEY` con el
 * JWT viejo, se ignora. Solo se acepta esa variable si ya trae una
 * publishable (por si alguien cambió el valor y no el nombre).
 */

export const SUPABASE_URL_POR_DEFECTO = 'https://qqshdccpmypelhmyqnut.supabase.co';

export const LLAVE_PUBLICA_POR_DEFECTO = 'sb_publishable_udtWTMScjha3-Q7D5QsB1A_KhZt3b3l';

export function esLlavePublishable(valor) {
  return typeof valor === 'string' && valor.startsWith('sb_publishable_');
}

export function resolverUrl(env = process.env) {
  return env.EXPO_PUBLIC_SUPABASE_URL || SUPABASE_URL_POR_DEFECTO;
}

export function resolverLlavePublica(env = process.env) {
  const candidatas = [
    env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  ];
  for (const candidata of candidatas) {
    if (esLlavePublishable(candidata)) return candidata;
  }
  return LLAVE_PUBLICA_POR_DEFECTO;
}
