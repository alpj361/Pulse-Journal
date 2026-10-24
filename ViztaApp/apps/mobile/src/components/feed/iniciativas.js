import { AVANCE } from './congreso';

/**
 * Las cuentas de la lista de iniciativas: en qué etapa va cada una, cuáles
 * encuentra una búsqueda y qué números de página se muestran. Sin pantallas,
 * para poder probarlas solas.
 */

/** Lo que dice el registro del Congreso, en las etapas de las notas. */
const DEL_REGISTRO = {
  presentada: 'iniciativa_presentada',
  conocio_pleno: 'iniciativa_presentada',
  en_comision: 'en_comision',
  dictamen: 'dictamen',
  dictamen_favorable: 'dictamen',
  aprobada: 'aprobado',
  aprobado: 'aprobado',
  iniciativa_presentada: 'iniciativa_presentada',
  primer_debate: 'primer_debate',
  segundo_debate: 'segundo_debate',
  tercer_debate: 'tercer_debate',
};

export const etapaDelRegistro = (estado) => DEL_REGISTRO[estado] || null;

/**
 * La etapa más avanzada que se sabe de una iniciativa.
 *
 * El registro casi siempre se queda en «conoció el pleno»: es lo único que
 * publica. Lo que pasa después —la comisión, el dictamen, los debates— lo
 * cuentan las notas del Congreso, que el monitor ya marcó con su etapa. Se
 * queda la más avanzada de todas, venga de donde venga.
 */
export function etapaDe(ini, pasosDeNotas = []) {
  const candidatas = [
    etapaDelRegistro(ini.estado_actual),
    ini.decreto_resultante ? 'aprobado' : null,
    ...(ini.eventos_timeline || []).map((e) => etapaDelRegistro(e.tipo)),
    ...pasosDeNotas.map((p) => etapaDelRegistro(p.stage || p.etapa)),
  ].filter((e) => AVANCE[e]);
  if (!candidatas.length) return null;
  return candidatas.reduce((a, b) => (AVANCE[b] > AVANCE[a] ? b : a));
}

/** Las paradas del filtro, que son las del camino que dibuja la app. */
export const ETAPAS = [
  ['presentada', 'presentada'],
  ['comision', 'comisión'],
  ['dictamen', 'dictamen'],
  ['debate', 'debate'],
  ['aprobada', 'aprobada'],
];

const PARADA = {
  iniciativa_presentada: 'presentada',
  en_comision: 'comision',
  dictamen: 'dictamen',
  primer_debate: 'debate',
  segundo_debate: 'debate',
  tercer_debate: 'debate',
  aprobado: 'aprobada',
};

export const paradaDe = (etapa) => PARADA[etapa] || null;

const plano = (t) =>
  String(t || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/**
 * Si una iniciativa responde a lo que se escribió. Un número busca en el
 * número («68» encuentra la 6869); las palabras, en el título, todas y sin
 * importar tildes ni el orden.
 */
export function coincide(ini, texto) {
  const q = plano(texto).trim();
  if (!q) return true;
  const titulo = plano(`${ini.numero || ''} ${ini.titulo || ''}`);
  if (/^\d+$/.test(q)) return String(ini.numero ?? '').includes(q) || titulo.includes(q);
  return q.split(/\s+/).every((palabra) => titulo.includes(palabra));
}

/**
 * Los números del paginado que caben en una línea de teléfono: la primera, la
 * última, la actual y sus vecinas; lo demás, un «…».
 */
export function paginasVisibles(actual, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const cerca = [actual - 1, actual, actual + 1].filter((p) => p > 1 && p < total);
  if (actual <= 3) cerca.push(2, 3, 4);
  if (actual >= total - 2) cerca.push(total - 3, total - 2, total - 1);
  const numeros = [...new Set([1, ...cerca, total])].sort((a, b) => a - b);
  const salida = [];
  numeros.forEach((p, i) => {
    if (i && p - numeros[i - 1] > 1) salida.push('…');
    salida.push(p);
  });
  return salida;
}

/** Los enlaces se muestran por su función; una noticia no es el documento. */
export function enlaceDe(ini, notas = []) {
  const web = (url) => typeof url === 'string' && /^https?:\/\//i.test(url.trim()) ? url.trim() : null;
  const candidatos = [
    [ini.url_pdf, 'documento de la iniciativa', 'PDF'],
    [ini.url_ficha, 'ficha en el Congreso', 'ficha'],
    ...notas.map((n) => [n.iniciativa_url, 'ficha en el Congreso', 'ficha']),
    [ini.fuente_presentacion_url, 'nota de presentación', 'fuente'],
    ...(ini.eventos_timeline || []).map((e) => [e.fuente_url, 'fuente del recorrido', 'fuente']),
    ...notas.map((n) => [n.url, 'nota del Congreso', 'fuente']),
  ];
  for (const [url, titulo, tipo] of candidatos) {
    const destino = web(url);
    if (destino) return { url: destino, titulo, tipo };
  }
  return null;
}

export const ROTULOS_ETAPA = {
  iniciativa_presentada: 'PRESENTADA', en_comision: 'EN COMISIÓN', dictamen: 'DICTAMEN',
  primer_debate: 'PRIMER DEBATE', segundo_debate: 'SEGUNDO DEBATE', tercer_debate: 'TERCER DEBATE', aprobado: 'APROBADA',
};
