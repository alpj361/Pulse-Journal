/**
 * Cómo está el día: medidas contadas, no leídas por un modelo.
 *
 * Todo sale de las tarjetas de noticias de cada día (la última corrida de ese
 * día). Nada de IA: subcategoría y palabras del título, conteos y promedios.
 * Las listas de palabras son un primer corte; Morrow las ajusta.
 *
 * Escala: las medidas que cuentan cosas (intensidad, violencia, accidentes,
 * gobierno, volumen) valen 50 cuando el día está en su promedio de los días
 * anteriores, 100 cuando está al doble o más. Polarización y novedad ya son
 * porcentajes y se muestran como tales.
 */

const VIOLENCIA =
  /homicid|asesin|ataque|atac|armad|disparo|balacera|balead|muert[oa]s?\b|fallec|captur|extorsi|secuestr|femicid|agresi|violaci|cad[aá]ver|cuerpo|crimen|pandill|mara\b|herido de bala|robo|asalt/i;
const ACCIDENTES =
  /accidente|colisi|choque|volcad|vuelca|percance|atropell|derrape|salida de pista|incendio|derrumbe|deslizamiento|desliz|emergencia|inundaci|tr[aá]nsito|tr[aá]fico|[aá]rbol ca[ií]do|hundimiento|sismo|tormenta|lluvia/i;
const GOBIERNO =
  /congreso|diputad|iniciativa|bancada|pleno|ministr|gobierno|presidente|ar[eé]valo|ejecutivo|ministerio p[uú]blico|\bmp\b|fiscal|\bcc\b|corte de constitucionalidad|\bcsj\b|\btse\b|decreto|presupuesto|contralor|municipalidad|alcald/i;
const CUESTIONA = /cuestion|critic|denunci|rechaz|exig|reclam|acus|pol[eé]mic|protest|se[nñ]al/i;

const textoDe = (c) => `${c?.subcategoria || ''} ${c?.titulo || ''}`;
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const lista = (v) => (Array.isArray(v) ? v : []);

/** «2026-10-18»: el día en Guatemala de una fecha. */
export function diaGT(fecha) {
  return new Date(fecha).toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });
}

/** El día de una historia: su último movimiento (primera vez o última actualización). */
export function diaDeCard(card, respaldo) {
  const momentos = [card?.primera_vez, card?.ultima_actualizacion, respaldo]
    .filter(Boolean)
    .map((t) => new Date(t).getTime())
    .filter(Number.isFinite);
  return momentos.length ? diaGT(Math.max(...momentos)) : null;
}

const desarrollosDelDia = (card, dia) => lista(card?.desarrollos).filter((d) => d?.ts && diaGT(d.ts) === dia);

/**
 * Las medidas crudas de un día, a partir de sus tarjetas.
 * `cards` son las tarjetas de la última corrida de ese día cuyo día es ese.
 */
export function medirDia(cards, dia) {
  const n = cards.length;
  const violencia = cards.filter((c) => VIOLENCIA.test(textoDe(c)));
  const accidentes = cards.filter((c) => !VIOLENCIA.test(textoDe(c)) && ACCIDENTES.test(textoDe(c)));
  const gobierno = cards.filter((c) => GOBIERNO.test(textoDe(c)));
  const conOpinion = cards.filter(
    (c) => lista(c?.desarrollos).some((d) => d?.opinion === true) || CUESTIONA.test(c?.titulo || '')
  );
  const nuevas = cards.filter((c) => !c?.seguimiento);

  // La historia más fuerte del día: la que más se movió (desarrollos de ese
  // día) y, a igual movimiento, la que más medios cubren y más impacto tiene.
  const fuerza = (c) => desarrollosDelDia(c, dia).length * 10 + num(c?.fuentes?.independientes) * 3 + num(c?.impacto_score) / 10;
  const top = [...cards].sort((a, b) => fuerza(b) - fuerza(a))[0] || null;
  const devTop = top ? desarrollosDelDia(top, dia).length : 0;
  const mediosTop = top ? num(top?.fuentes?.independientes) : 0;

  return {
    dia,
    volumen: n,
    violencia: violencia.length,
    accidentes: accidentes.length,
    gobierno: gobierno.length,
    intensidad: devTop + mediosTop,
    polarizacion: n ? Math.round((conOpinion.length / n) * 100) : 0,
    novedad: n ? Math.round((nuevas.length / n) * 100) : 0,
    top: top ? { titulo: top.titulo, desarrollos: devTop, medios: mediosTop } : null,
  };
}

const CONTEOS = ['intensidad', 'violencia', 'accidentes', 'gobierno', 'volumen'];

/** 0–100 contra el promedio de los días anteriores: 50 = promedio, 100 = el doble o más. */
function escalar(valor, promedio) {
  if (!promedio) return valor ? 100 : 0;
  return Math.max(0, Math.min(100, Math.round((valor / promedio) * 50)));
}

/**
 * Cada día con sus puntajes. Cada día se compara contra los días anteriores
 * a él que haya (`base` dice cuántos), nunca contra sí mismo.
 */
export function puntuar(medidas) {
  const orden = [...medidas].sort((a, b) => (a.dia < b.dia ? -1 : 1));
  return orden.map((m, i) => {
    const antes = orden.slice(Math.max(0, i - 30), i);
    const puntos = {};
    for (const k of CONTEOS) {
      const prom = antes.length ? antes.reduce((s, x) => s + x[k], 0) / antes.length : 0;
      puntos[k] = antes.length ? escalar(m[k], prom) : null;
    }
    puntos.polarizacion = m.polarizacion;
    puntos.novedad = m.novedad;
    return { ...m, puntos, base: antes.length };
  });
}

/** Color de un puntaje, de verde a rojo. Sin puntaje, gris. */
export function colorDe(p) {
  if (p == null) return 'rgba(28,43,34,0.12)';
  if (p < 35) return '#4C9A6A';
  if (p < 55) return '#C9B458';
  if (p < 75) return '#D98A3D';
  return '#C0453B';
}

/** La frase literal de cada medida, con el número detrás. */
export function frase(clave, d) {
  switch (clave) {
    case 'intensidad':
      return d.top
        ? `${d.top.titulo}: ${d.top.desarrollos} ${d.top.desarrollos === 1 ? 'desarrollo' : 'desarrollos'}, ${d.top.medios} ${d.top.medios === 1 ? 'medio' : 'medios'}`
        : 'Sin una historia que destaque';
    case 'violencia':
      return `${d.violencia} de ${d.volumen} noticias son de violencia`;
    case 'accidentes':
      return `${d.accidentes} de ${d.volumen} son accidentes, tráfico o emergencias`;
    case 'gobierno':
      return `${d.gobierno} de ${d.volumen} tocan al Gobierno, el Congreso o las cortes`;
    case 'volumen':
      return `${d.volumen} noticias`;
    case 'polarizacion':
      return `${d.polarizacion}% con opinión o cuestionamientos`;
    case 'novedad':
      return d.novedad >= 100
        ? 'Todas son historias nuevas'
        : d.novedad <= 0
          ? 'Todas son seguimientos de días anteriores'
          : `${d.novedad}% son historias nuevas; el resto, seguimientos`;
    default:
      return '';
  }
}

export const MEDIDAS = [
  ['intensidad', 'Intensidad'],
  ['violencia', 'Violencia'],
  ['gobierno', 'Gobierno y Congreso'],
  ['volumen', 'Volumen'],
  ['accidentes', 'Accidentes y tráfico'],
  ['polarizacion', 'Polarización'],
  ['novedad', 'Novedad'],
];

/** Las 4 de la franja de arriba. */
export const EN_LA_FRANJA = ['intensidad', 'violencia', 'gobierno', 'volumen'];

/**
 * De qué se habla: las historias con más peso del día, con su % del total y
 * cómo les fue contra ayer.
 */
export function deQueSeHabla(cardsHoy, cardsAyer, cuantas = 5) {
  const peso = (c) => num(c?.impacto_score) * (1 + num(c?.fuentes?.independientes) / 5);
  const total = cardsHoy.reduce((s, c) => s + peso(c), 0) || 1;
  const totalAyer = cardsAyer.reduce((s, c) => s + peso(c), 0) || 1;
  const ayer = new Map(cardsAyer.map((c) => [c.id, peso(c) / totalAyer]));
  return [...cardsHoy]
    .sort((a, b) => peso(b) - peso(a))
    .slice(0, cuantas)
    .map((c) => {
      const parte = peso(c) / total;
      const antes = ayer.get(c.id);
      const rumbo = antes == null ? 'nueva' : parte > antes * 1.1 ? 'sube' : parte < antes * 0.9 ? 'baja' : 'igual';
      return { id: c.id, titulo: c.titulo, categoria: c.categoria, porcentaje: Math.round(parte * 100), rumbo };
    });
}
