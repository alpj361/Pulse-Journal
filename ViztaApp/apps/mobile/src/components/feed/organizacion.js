/** Búsqueda compartida por los registros y las secciones del Congreso. */
export const normalizar = (texto) => String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export function buscarRegistro(texto, consulta) {
  const base = normalizar(texto);
  return normalizar(consulta).trim().split(/\s+/).every((p) => base.includes(p));
}
export const anoDecreto = (d) => String(d.numero || '').match(/(20\d{2})$/)?.[1] || String(d.fecha || '').slice(0, 4);
export function fechaRegistro(fecha) {
  if (!fecha) return null;
  const [a, m, d] = String(fecha).slice(0, 10).split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' });
}
export function periodoDe(filas, campo = 'fecha') {
  const fechas = filas.map((f) => f[campo]).filter(Boolean).sort();
  if (!fechas.length) return null;
  const desde = fechaRegistro(fechas[0]);
  const hasta = fechaRegistro(fechas[fechas.length - 1]);
  return desde === hasta ? desde : `${desde} – ${hasta}`;
}
export function resultadoVotacion(v) {
  if (v.resultado === 'aprobada') return 'aprobada';
  if (['no_aprobada', 'rechazada', 'no aprobada'].includes(v.resultado)) return 'no_aprobada';
  return 'sin_resultado';
}
