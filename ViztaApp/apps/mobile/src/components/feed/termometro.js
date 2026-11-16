/**
 * El termómetro del día: lo calcula NewsCron (tabla `termometro_diario`) con los
 * campos del catálogo de cada tarjeta, sin listas de palabras ni IA, y la app
 * lo lee de ExtractorW (`GET /api/termometro`). Acá solo se le da forma.
 *
 * Intensidad: 0–100 en escala fija, suma de seguimiento, amplitud y alto
 * impacto (0–33.3 cada uno). Las víctimas no entran a la intensidad; solo
 * acompañan a Violencia.
 *
 * Los demás indicadores son conteos de historias nuevas del día. Se comparan
 * contra su promedio solo cuando el servidor junta 7 días comparables
 * (`comparacion.disponible`); antes de eso se muestra el número y nada más.
 */
import { EXTRACTORW_URL } from '../../utils/servicios';
import { supabase } from '../../utils/supabase';

/** «2026-10-18»: el día en Guatemala de una fecha. */
export function diaGT(fecha) {
  return new Date(fecha).toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });
}

/** Los días desde hace `cuantos` días hasta hoy, del más viejo al más nuevo. */
export async function traerTermometro(pais = 'gt', cuantos = 35) {
  const { data } = await supabase.auth.getSession();
  // Público (PJ, 20-oct): con sesión se manda el token, sin sesión se pide igual.
  const token = data?.session?.access_token;
  const desde = diaGT(Date.now() - cuantos * 86400000);
  const res = await fetch(`${EXTRACTORW_URL}/api/termometro?pais=${encodeURIComponent(pais)}&desde=${desde}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 401 || res.status === 403) return [];
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) throw new Error(json?.error || `Error ${res.status}`);
  return (json.dias || []).map(formaDia);
}

const num = (v) => (v == null || !Number.isFinite(Number(v)) ? null : Number(v));

/** Un día del servidor, con nombres cortos y sin nulos sorpresa. */
export function formaDia(d) {
  const ind = d?.indicadores || {};
  const comp = d?.componentes || {};
  return {
    dia: d.fecha,
    parcial: !!d.parcial,
    datosParciales: !!d.datos_parciales,
    intensidad: num(d.intensidad),
    componentes: {
      seguimiento: num(comp.seguimiento),
      amplitud: num(comp.amplitud),
      altoImpacto: num(comp.alto_impacto),
      maxDesarrollos: num(comp.max_desarrollos_dia),
      historiasAltoImpacto: num(comp.historias_alto_impacto),
    },
    volumen: num(ind.volumen),
    nuevas: num(ind.nuevas),
    violencia: num(ind.violencia),
    gobierno: num(ind.gobierno_congreso),
    accidentes: num(ind.accidentes),
    clima: num(ind.clima),
    victimas: d.violencia_victimas || null,
    promedios: d.comparacion?.disponible ? d.comparacion.promedios || null : null,
    top: Array.isArray(d.top_historias) ? d.top_historias : [],
  };
}

/** 0–100 contra el promedio de 7 días: 50 = el promedio, 100 = el doble o más. Sin promedio, null. */
export function contraLoNormal(valor, promedio) {
  if (valor == null || promedio == null) return null;
  if (!promedio) return valor ? 100 : 50;
  return Math.max(0, Math.min(100, Math.round((valor / promedio) * 50)));
}

/** Color de la intensidad (escala fija): <30 verde, <50 amarillo, <70 naranja, rojo. */
export function colorIntensidad(p) {
  if (p == null) return 'rgba(28,43,34,0.12)';
  if (p < 30) return '#4C9A6A';
  if (p < 50) return '#C9B458';
  if (p < 70) return '#D98A3D';
  return '#C0453B';
}

/** Color de un indicador contra su promedio. El rojo, solo en violencia y accidentes (Morrow). */
export function colorDe(p, clave) {
  if (p == null) return 'rgba(28,43,34,0.12)';
  if (clave !== 'violencia' && clave !== 'accidentes') return '#5F6F66';
  if (p < 35) return '#4C9A6A';
  if (p < 55) return '#C9B458';
  if (p < 75) return '#D98A3D';
  return '#C0453B';
}

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/** Las víctimas del día como [número, palabra]: [[3, 'muertos'], [9, 'capturados']]. */
export function victimasDe(v) {
  if (!v) return [];
  const t = [
    ['muertos', 'muerto', 'muertos'],
    ['desaparecidos', 'desaparecido', 'desaparecidos'],
    ['heridos', 'herido', 'heridos'],
    ['capturados', 'capturado', 'capturados'],
  ];
  const out = t.filter(([k]) => v[k]).map(([k, uno, varios]) => [v[k], v[k] === 1 ? uno : varios]);
  if (v.victimas_sin_cifra) out.push([null, 'casos sin cifra']);
  return out;
}

/** Las víctimas del día, en palabras: «3 muertos, 9 capturados». */
export function fraseVictimas(v) {
  if (!v) return null;
  const partes = [
    v.muertos ? plural(v.muertos, 'muerto', 'muertos') : null,
    v.desaparecidos ? plural(v.desaparecidos, 'desaparecido', 'desaparecidos') : null,
    v.heridos ? plural(v.heridos, 'herido', 'heridos') : null,
    v.capturados ? plural(v.capturados, 'capturado', 'capturados') : null,
  ].filter(Boolean);
  if (v.victimas_sin_cifra) partes.push(partes.length ? 'y casos sin cifra' : 'casos sin cifra');
  return partes.length ? partes.join(', ').replace(', y casos', ' y casos') : null;
}

/** La frase literal de cada indicador, con el número detrás. */
export function frase(clave, d) {
  switch (clave) {
    case 'violencia': {
      const base = plural(d.violencia ?? 0, 'historia nueva de violencia', 'historias nuevas de violencia');
      const v = fraseVictimas(d.victimas);
      return v ? `${base}: ${v}` : base;
    }
    case 'gobierno':
      return `${plural(d.gobierno ?? 0, 'acto', 'actos')} del Ejecutivo, el Congreso o las municipalidades`;
    case 'accidentes':
      return `${plural(d.accidentes ?? 0, 'accidente, incendio o cierre', 'accidentes, incendios o cierres')}`;
    case 'clima':
      return `${plural(d.clima ?? 0, 'noticia', 'noticias')} de lluvias, sismos o deslaves`;
    case 'volumen':
      return d.nuevas != null && d.nuevas !== d.volumen
        ? `${plural(d.volumen ?? 0, 'noticia', 'noticias')}, ${d.nuevas} nuevas`
        : plural(d.volumen ?? 0, 'noticia', 'noticias');
    default:
      return '';
  }
}

/** Las tres partes de la intensidad, cada una con su cifra. */
export function frasesIntensidad(d) {
  const c = d.componentes;
  const top = d.top[0];
  const r = (x) => (x == null ? 0 : Math.round(x));
  return [
    ['Seguimiento', r(c.seguimiento), top ? `${top.titulo}: ${plural(c.maxDesarrollos ?? top.desarrollos_dia, 'vez', 'veces')} en el día` : 'Ninguna historia se siguió'],
    ['Amplitud', r(c.amplitud), plural(d.volumen ?? 0, 'historia', 'historias')],
    ['Alto impacto', r(c.altoImpacto), `${plural(c.historiasAltoImpacto ?? 0, 'historia', 'historias')} con 5 medios o más`],
  ];
}

export const MEDIDAS = [
  ['intensidad', 'Intensidad'],
  ['violencia', 'Violencia'],
  ['gobierno', 'Gobierno y Congreso'],
  ['accidentes', 'Accidentes y tráfico'],
  ['clima', 'Clima'],
  ['volumen', 'Volumen'],
];

/** Las 4 de la franja de arriba. */
export const EN_LA_FRANJA = ['intensidad', 'violencia', 'gobierno', 'volumen'];

const PROMEDIO = { volumen: 'volumen', violencia: 'violencia', gobierno: 'gobierno_congreso', accidentes: 'accidentes', clima: 'clima' };

/** El puntaje 0–100 de un indicador contra su promedio, o null si todavía no hay con qué comparar. */
export function puntosDe(clave, d) {
  if (clave === 'intensidad') return d.intensidad;
  return contraLoNormal(d[clave], d.promedios?.[PROMEDIO[clave]]);
}

/** El promedio de 7 días de un indicador, redondeado, si ya existe. */
export function normalDe(clave, d) {
  const p = d.promedios?.[PROMEDIO[clave]];
  return p == null ? null : Math.round(p);
}

/**
 * De qué se habla: las historias más seguidas del día, y cómo les fue contra
 * el día anterior (por cuántas veces se publicaron).
 */
export function deQueSeHabla(d, anterior) {
  const antes = new Map((anterior?.top || []).map((t) => [t.historia, t.desarrollos_dia]));
  return d.top.map((t) => {
    const a = antes.get(t.historia);
    const rumbo = a == null ? 'nueva' : t.desarrollos_dia > a ? 'sube' : t.desarrollos_dia < a ? 'baja' : 'igual';
    return { id: t.historia, titulo: t.titulo, veces: t.desarrollos_dia, medios: t.medios_dia, rumbo };
  });
}
