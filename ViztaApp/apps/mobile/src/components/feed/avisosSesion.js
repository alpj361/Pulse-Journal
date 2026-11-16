import { supabase } from '../../utils/supabase';

/**
 * Los avisos de una sesión del pleno, como los da la base
 * (`pc_congreso_sesiones_view`): los automáticos (sin acta, sin votaciones,
 * solo prensa) y el editorial que escribe una persona o un agente (sin
 * quórum, suspendida…). La app no los deduce: solo los muestra.
 *
 * Cada aviso: { tipo, pill, texto, clase }. El editorial va primero y manda
 * sobre el automático del mismo tipo. La base ya quita el editorial vencido
 * (`aviso_hasta`); acá se vuelve a mirar por si la fila vino de caché.
 */
export function avisosDe(fila, ahora = new Date()) {
  const lista = [];
  const ed = fila?.aviso_editorial;
  if (ed?.pill && !(ed.hasta && new Date(ed.hasta) <= ahora)) lista.push(ed);
  for (const a of fila?.avisos_automaticos || []) {
    if (a?.pill && !lista.some((x) => x.tipo === a.tipo)) lista.push(a);
  }
  return lista;
}

/** «ordinaria · sesión 54» → «54». */
export const numeroDeSesion = (sesion) => (String(sesion || '').match(/sesi[oó]n\s*(\d+)\s*$/i) || [])[1] || null;

export const claveSesion = (fecha, numero) => (fecha && numero ? `${String(fecha).slice(0, 10)}|${numero}` : null);

/** Todas las sesiones con algún aviso, por fecha y número. */
export async function traerAvisosSesiones() {
  const { data, error } = await supabase.from('pc_congreso_sesiones_view').select('fecha, numero, avisos_automaticos, aviso_editorial');
  if (error) throw error;
  const porSesion = new Map();
  for (const fila of data || []) {
    const avisos = avisosDe(fila);
    const clave = claveSesion(fila.fecha, fila.numero);
    if (clave && avisos.length && !porSesion.has(clave)) porSesion.set(clave, avisos);
  }
  return porSesion;
}
