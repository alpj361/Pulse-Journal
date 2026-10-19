/**
 * Intensidad = cuánto pesó el día. Escala fija de 0 a 100, no contra los días
 * anteriores: un día pesado es pesado aunque la semana también lo haya sido.
 *
 * Cuatro componentes de 0 a 25, todos contados del texto y los datos de las
 * tarjetas, sin IA (definición del 19-oct-2026, a revisar con el Manager y
 * Morrow; ver oficina/Claude Work/2026-10-19-intensidad-definicion-y-prueba.md):
 *
 *  1. Seguimiento: cuántas veces volvió a publicarse la historia más seguida
 *     ese día (desarrollos fechados ese día).
 *  2. Amplitud: cuántas historias distintas tuvo el día.
 *  3. Alto impacto: cuántas historias publicaron 5 medios distintos o más ese
 *     día. No el puntaje de impacto del modelo, que es subjetivo.
 *  4. Gravedad: las cifras que dice el texto (muertos, desaparecidos, heridos,
 *     capturados). Reglas:
 *       · las víctimas cuentan el día del hecho, no cada día que se mencionan;
 *       · las cifras acumuladas («en 2026», «en lo que va del año») no cuentan;
 *       · cada historia aporta una vez por tipo (la cifra más alta que diga).
 */

const lista = (v) => (Array.isArray(v) ? v : []);

export function diaGT(fecha) {
  return new Date(fecha).toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });
}

/** Interpola una escala por tramos: [[valor, puntos], …] en orden. */
function tramo(valor, cortes) {
  if (valor <= 0) return 0;
  let antes = [0, 0];
  for (const [v, p] of cortes) {
    if (valor <= v) return Math.round(antes[1] + ((valor - antes[0]) / (v - antes[0])) * (p - antes[1]));
    antes = [v, p];
  }
  return cortes[cortes.length - 1][1];
}

const ESCALA = {
  seguimiento: [[5, 10], [15, 20], [25, 25]],
  amplitud: [[15, 10], [25, 20], [35, 25]],
  altoImpacto: [[1, 8], [3, 18], [5, 25]],
};
const PESO = { muertos: 2.5, desaparecidos: 1.5, heridos: 0.8, capturados: 0.3 };

/** Color de la intensidad (escala fija): <30 verde, <50 amarillo, <70 naranja, rojo. */
export function colorIntensidad(p) {
  if (p == null) return 'rgba(28,43,34,0.12)';
  if (p < 30) return '#4C9A6A';
  if (p < 50) return '#C9B458';
  if (p < 70) return '#D98A3D';
  return '#C0453B';
}

// ─── Cifras del texto ────────────────────────────────────────────────────────

const PALABRAS_NUM = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, quince: 15, veinte: 20, doble: 2, triple: 3,
};
const TIPOS = {
  muertos: /muert|fallec|asesin|sin vida|cad[aá]ver|cuerpos?\b|v[ií]ctimas? mortal|mata\b|matan\b/i,
  desaparecidos: /desaparec/i,
  heridos: /herid|lesionad|trasladad[oa]s? a|atendid/i,
  capturados: /captur|detenid|aprehendid|arrestad/i,
};
const ACUMULADO = /en (el )?20\d\d|en lo que va|en el a[ñn]o|durante (el )?(20\d\d|a[ñn]o)|en total este a[ñn]o|acumulad/i;

// Un número seguido de esto no cuenta víctimas: «21 años», «km 17», «zona 5».
const NO_ES_CUENTA = /^(a[ñn]os?|km|kil[oó]metros?|zona|calle|avenida|metros?|horas?|minutos?|d[ií]as?|%|por|millones?|mil|quetzales|q)$/i;
const limpia = (w) => String(w || '').replace(/[^\wáéíóúñ%]/gi, '');

/** El número de la palabra j, si cuenta personas (no una edad, un km, una zona). */
function cuentaEn(palabras, j) {
  const n = numeroDe(limpia(palabras[j]));
  if (n == null || n >= 1000) return null;
  if (NO_ES_CUENTA.test(limpia(palabras[j + 1]))) return null;
  if (/^(km|zona|kil[oó]metro|calle|avenida|ruta|de)$/i.test(limpia(palabras[j - 1])) && /^\d+$/.test(limpia(palabras[j]))) return null;
  return n;
}

const numeroDe = (palabra) => {
  const p = String(palabra).toLowerCase();
  if (/^\d+$/.test(p)) return Number(p);
  return PALABRAS_NUM[p] ?? null;
};

/**
 * Las cifras de víctimas de un texto: por tipo, la más alta que se lea. Una
 * mención sin número («asesinan a…», «capturan a…») cuenta 1. Las oraciones
 * con cifras acumuladas no cuentan.
 */
export function cifrasDe(texto) {
  const out = { muertos: 0, desaparecidos: 0, heridos: 0, capturados: 0 };
  const oraciones = String(texto || '').split(/(?<=[.;])\s+/);
  for (const o of oraciones) {
    if (ACUMULADO.test(o)) continue;
    const palabras = o.split(/[\s,]+/);
    for (const [tipo, re] of Object.entries(TIPOS)) {
      let visto = false;
      let mayor = 0;
      palabras.forEach((w, i) => {
        if (!re.test(w)) return;
        visto = true;
        // Un número hasta 3 palabras antes: «dos muertos», «22 personas fallecidas».
        for (let j = Math.max(0, i - 3); j < i; j++) {
          const n = cuentaEn(palabras, j);
          if (n != null) mayor = Math.max(mayor, n);
        }
        // Con un verbo, el número va después: «capturan a dos personas».
        if (/^(captur(an|aron|a)\b|detien|aprehend|asesinan|matan)/i.test(w)) {
          for (let j = i + 1; j <= Math.min(palabras.length - 1, i + 3); j++) {
            const n = cuentaEn(palabras, j);
            if (n != null) {
              mayor = Math.max(mayor, n);
              break;
            }
          }
        }
      });
      if (visto) out[tipo] = Math.max(out[tipo], mayor || 1);
    }
  }
  return out;
}

// ─── El día ──────────────────────────────────────────────────────────────────

const desarrollosDelDia = (h, dia) => lista(h?.desarrollos).filter((d) => d?.ts && diaGT(d.ts) === dia);

/** ¿La historia tuvo algo ese día? Por sus desarrollos o, si no trae, por cuándo apareció. */
function activaEl(h, dia) {
  if (desarrollosDelDia(h, dia).length) return true;
  if (lista(h?.desarrollos).length) return false;
  const momentos = [h?.primera_vez, h?.ultima_actualizacion].filter(Boolean);
  return momentos.some((t) => diaGT(t) === dia);
}

/** El día del hecho: la fecha del hecho si la trae, si no cuándo apareció. */
function diaDelHecho(h) {
  if (h?.fecha_evento_ts && h?.fecha_evento_base !== 'no_verificada') return diaGT(h.fecha_evento_ts);
  const d = lista(h?.desarrollos).map((x) => x.ts).filter(Boolean).sort()[0];
  return diaGT(d || h?.primera_vez || Date.now());
}

const mediosDelDia = (h, dia) => {
  const dev = desarrollosDelDia(h, dia);
  if (dev.length) return new Set(dev.map((x) => x.fuente || lista(x.fuentes)[0]).filter(Boolean)).size;
  return Number(h?.fuentes?.independientes) || 0;
};

/**
 * La intensidad de un día a partir de todas las historias conocidas (la
 * versión más nueva de cada una, con todo su recorrido).
 */
export function intensidadDelDia(historias, dia) {
  const delDia = historias.filter((h) => activaEl(h, dia));

  let top = null;
  for (const h of delDia) {
    const n = desarrollosDelDia(h, dia).length;
    if (n && (!top || n > top.veces)) top = { titulo: h.titulo, veces: n };
  }
  const grandes = delDia.filter((h) => mediosDelDia(h, dia) >= 5);

  const victimas = { muertos: 0, desaparecidos: 0, heridos: 0, capturados: 0 };
  for (const h of historias) {
    if (diaDelHecho(h) !== dia) continue;
    const c = cifrasDe([h.titulo, h.resumen, h.datos_relevantes].filter(Boolean).join('. '));
    for (const k of Object.keys(victimas)) victimas[k] += c[k];
  }
  const pesoVictimas = Object.entries(victimas).reduce((s, [k, n]) => s + n * PESO[k], 0);

  const partes = {
    seguimiento: tramo(top?.veces || 0, ESCALA.seguimiento),
    amplitud: tramo(delDia.length, ESCALA.amplitud),
    altoImpacto: tramo(grandes.length, ESCALA.altoImpacto),
    gravedad: Math.min(25, Math.round(pesoVictimas)),
  };
  return {
    puntos: partes.seguimiento + partes.amplitud + partes.altoImpacto + partes.gravedad,
    partes,
    datos: { top, historias: delDia.length, grandes: grandes.length, victimas },
  };
}

/** Las frases literales de cada componente. */
export function frasesIntensidad(i) {
  const v = i.datos.victimas;
  const cifras = [
    v.muertos && `${v.muertos} ${v.muertos === 1 ? 'muerto' : 'muertos'}`,
    v.desaparecidos && `${v.desaparecidos} ${v.desaparecidos === 1 ? 'desaparecido' : 'desaparecidos'}`,
    v.heridos && `${v.heridos} ${v.heridos === 1 ? 'herido' : 'heridos'}`,
    v.capturados && `${v.capturados} ${v.capturados === 1 ? 'capturado' : 'capturados'}`,
  ].filter(Boolean);
  return [
    ['Seguimiento', i.partes.seguimiento, i.datos.top ? `${i.datos.top.titulo}: ${i.datos.top.veces} veces en el día` : 'Ninguna historia se siguió ese día'],
    ['Amplitud', i.partes.amplitud, `${i.datos.historias} historias distintas`],
    ['Alto impacto', i.partes.altoImpacto, `${i.datos.grandes} ${i.datos.grandes === 1 ? 'historia' : 'historias'} con 5 medios o más`],
    ['Gravedad', i.partes.gravedad, cifras.length ? cifras.join(', ') : 'Sin víctimas reportadas en cifras'],
  ];
}
