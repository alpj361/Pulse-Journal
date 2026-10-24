/** Convierte las unidades explícitas del monitor sin cambiar el valor. */
export function monto(cantidad, unidad) {
  if (cantidad == null || String(cantidad).trim() === '') return null;
  let n = Number(cantidad);
  if (!Number.isFinite(n)) return null;
  let u = String(unidad || '').trim();
  if (/^(q|gtq|quetzales(?:\s*\(q\))?)$/i.test(u)) u = 'Q';
  else if (/^(?:millones?|miles?) de (?:q|quetzales|gtq)$/i.test(u)) {
    n *= u.toLowerCase().startsWith('millon') ? 1e6 : 1e3;
    u = 'Q';
  }
  const con = (texto) => !u ? texto : u === '%' ? `${texto}%` : ['Q', 'US$', '$', '€'].includes(u) ? `${u}${texto}` : `${texto} ${u}`;
  const numero = (valor) => valor.toLocaleString('es-GT', { maximumFractionDigits: 3 });
  if (Math.abs(n) >= 1e9) return con(`${numero(n / 1e9)} mil millones`);
  if (Math.abs(n) >= 1e6) return con(`${numero(n / 1e6)} millones`);
  return con(numero(n));
}
