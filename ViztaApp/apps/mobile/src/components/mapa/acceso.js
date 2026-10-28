/**
 * Quién ve el mapa: por ahora solo alfa y admin (beta todavía no).
 *
 * Alfa se marca de dos formas en `profiles`: el rol `alfa` o el tipo de cuenta
 * `Alpha` (hay cuentas con rol `user` y tipo `Alpha`). Cuentan las dos.
 */
export function puedeVerMapa(usuario) {
  if (!usuario?.id) return false;
  const roles = [usuario.role, ...(usuario.roles || [])].filter(Boolean).map((r) => String(r).toLowerCase());
  if (roles.some((r) => ['admin', 'alfa', 'alpha'].includes(r))) return true;
  return /^(alfa|alpha)$/i.test(String(usuario.user_type || ''));
}
