/**
 * Qué se votó en cada votación del pleno, y cuáles van juntas.
 *
 * El registro trae una fila por cada vez que el pleno vota: el orden del día,
 * el acta, la urgencia nacional, cada artículo y cada enmienda de una ley. Una
 * sola ley aprobada son quince o veinte filas, y leídas en fila parecen veinte
 * cosas distintas. Acá cada votación recibe su tipo y las de una misma ley se
 * juntan bajo la que la decide (el debate), con el resto plegado.
 *
 * Sale del texto del asunto, que el Congreso escribe siempre con las mismas
 * fórmulas («Aprobación del Artículo 3 del Proyecto de Decreto Que Dispone
 * Aprobar la Iniciativa de Ley 6852»), y del número de iniciativa del registro.
 */

const plano = (t) =>
  String(t || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Los tipos, en el orden en que se muestran dentro de un día. */
export const TIPOS_VOTACION = {
  ley: { nombre: 'Leyes', rotulo: 'LEY' },
  eleccion: { nombre: 'Elecciones', rotulo: 'ELECCIÓN' },
  acuerdo: { nombre: 'Acuerdos y resoluciones', rotulo: 'ACUERDO' },
  tramite: { nombre: 'Trámite de la sesión', rotulo: 'TRÁMITE DE LA SESIÓN' },
};
const ORDEN = Object.keys(TIPOS_VOTACION);

/** El número de la iniciativa: del registro o, si falta, del asunto («urgencia nacional 6852»). */
export function iniciativaDe(v) {
  if (v?.iniciativa_numero) return Number(v.iniciativa_numero);
  const m = plano(v?.asunto).match(/(?:iniciativa de ley|urgencia nacional)\s+(\d{4})/);
  return m ? Number(m[1]) : null;
}

// La votación que aprueba la ley; lo demás (artículos, enmiendas, preámbulo,
// redacción final, la urgencia) son pasos de esa misma ley.
const DEBATE = /\b(unico|primer|segundo|tercer) debate\b/;
const TRAMITE = /orden del dia|\bactas? de (la )?sesion|actas de sesiones|uso de la palabra|mocion privilegiada/;

/**
 * El tipo de una votación y, si es de una ley, si es la que la decide.
 * Devuelve { tipo, decide }.
 */
export function tipoVotacion(v) {
  const a = plano(v?.asunto);
  const numero = iniciativaDe(v);
  if (/^eleccion\b|\beleccion de (la )?(junta directiva|planilla)/.test(a)) return { tipo: 'eleccion', decide: true };
  // La urgencia nacional de una ley con número es un paso de esa ley; sin
  // número, es trámite de la sesión.
  if (numero) return { tipo: 'ley', decide: DEBATE.test(a) };
  if (TRAMITE.test(a)) return { tipo: 'tramite', decide: false };
  if (v?.decreto || /\bveto\b|objeciones/.test(a)) return { tipo: 'ley', decide: true };
  return { tipo: 'acuerdo', decide: true };
}

/** El cargo de una elección: lo que va después de «como» («Jefe de la Contraloría…»). */
function cargoDe(v) {
  const m = plano(v?.asunto).match(/\bcomo (.+)$/);
  return m ? m[1] : null;
}

/**
 * El asunto sin la fórmula que repite la ley: «Artículo 3», «Enmienda por
 * sustitución total al artículo 4», «Redacción final». Para los pasos plegados
 * bajo su ley, donde la ley ya está nombrada arriba.
 */
export function pasoCorto(asunto) {
  const s = String(asunto || '')
    .replace(/\s*(del|al)?\s*Proyecto de Decreto Que Dispone Aprobar la Iniciativa de Ley[\s\d-]*$/i, '')
    .replace(/\s*del Proyecto de Decreto.*$/i, '')
    .replace(/^Aprobaci[oó]n (de la |del |de )?/i, '')
    .trim();
  if (!s) return legible(asunto);
  // En único debate se aprueba lo que se declaró de urgencia nacional: ese es
  // el término del Congreso, y es el que se usa.
  if (/^en [uú]nico debate$/i.test(s)) return 'Urgencia nacional';
  if (/^en (primer|segundo|tercer) debate$/i.test(s)) return legible(s.replace(/^en /i, ''));
  if (/^moci[oó]n privilegiada.*urgencia nacional/i.test(s)) return 'Moción de urgencia nacional';
  return legible(s);
}

/**
 * El Congreso escribe los asuntos con Cada Palabra En Mayúscula. En los de
 * leyes y de trámite no hay nombres propios: se pasan a oración, con los
 * números romanos de títulos y capítulos en mayúscula.
 */
export function legible(asunto) {
  const base = String(asunto || '').trim().toLowerCase()
    .replace(/\b(t[ií]tulo|cap[ií]tulo) ([ivxl]+)\b/g, (_, que, n) => `${que} ${n.toUpperCase()}`);
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/** El registro guarda «Iniciativa que dispone aprobar Ley de…»: queda «Ley de…». */
export function nombreDeLey(titulo) {
  const s = String(titulo || '').trim().replace(/\.$/, '');
  const sin = s.replace(/^iniciativa que (dispone aprobar|propone|dispone)\s+/i, '');
  return sin ? sin.charAt(0).toUpperCase() + sin.slice(1) : null;
}

/**
 * Las votaciones juntas: un grupo por ley y día, uno por elección de un mismo
 * cargo, uno con todo el trámite del día y uno por cada votación suelta. Cada
 * grupo (el de trámite no tiene principal: todo va plegado):
 * { clave, tipo, fecha, iniciativa, principal, pasos }.
 *
 * La principal de una ley es la del debate; si ese día no hubo debate (solo
 * artículos o redacción final), la última que se votó. En una elección, la
 * que ganó, y los demás candidatos van plegados. Los grupos salen por fecha,
 * de la más nueva, y dentro del día: leyes, elecciones, acuerdos, trámite.
 */
export function agruparVotaciones(votaciones = []) {
  const grupos = new Map();
  for (const v of votaciones) {
    const { tipo, decide } = tipoVotacion(v);
    const numero = tipo === 'ley' ? iniciativaDe(v) : null;
    const cargo = tipo === 'eleccion' ? cargoDe(v) : null;
    // El trámite de un día va junto: el orden del día, las actas y las
    // mociones de una sesión son una sola cosa para quien lee.
    const clave = numero ? `${v.fecha}|ley|${numero}` : cargo ? `${v.fecha}|eleccion|${cargo}`
      : tipo === 'tramite' ? `${v.fecha}|tramite` : `${v.fecha}|${v.id}`;
    if (!grupos.has(clave)) grupos.set(clave, { clave, tipo, fecha: v.fecha, iniciativa: numero, todas: [], decisivas: [] });
    const g = grupos.get(clave);
    g.todas.push(v);
    if (decide) g.decisivas.push(v);
  }
  const out = [...grupos.values()].map(({ todas, decisivas, ...g }) => {
    let principal;
    if (g.tipo === 'tramite') return { ...g, principal: null, pasos: todas };
    if (g.tipo === 'eleccion') principal = todas.find((v) => v.resultado === 'aprobada') || todas[0];
    else principal = decisivas[0] || todas[todas.length - 1];
    const pasos = todas.filter((v) => v !== principal);
    if (g.tipo === 'ley') pasos.sort((a, b) => compararPasos(ordenDelPaso(a.asunto), ordenDelPaso(b.asunto)));
    return { ...g, principal, pasos };
  });
  return out.sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')) || ORDEN.indexOf(a.tipo) - ORDEN.indexOf(b.tipo));
}

/**
 * En qué lugar del trámite de una ley va un paso. El registro no guarda el
 * orden en que se votó (todas llegan con la misma hora), así que se ordena como
 * se discute una ley: urgencia, debate, preámbulo, cada artículo con su
 * enmienda antes, los títulos o capítulos después de sus artículos y al final
 * la redacción final. Devuelve [etapa, artículo, sub].
 */
export function ordenDelPaso(asunto) {
  const a = plano(asunto);
  if (/urgencia nacional|mocion privilegiada/.test(a)) return [0, 0, 0];
  if (DEBATE.test(a)) return [1, 0, 0];
  if (/preambulo/.test(a)) return [2, 0, 0];
  if (/redaccion final/.test(a)) return [9, 0, 0];
  const hasta = a.match(/articulos \d+ al (\d+)/);
  if (hasta) return [3, Number(hasta[1]), 2];
  const articulo = a.match(/articulo (\d+)/);
  if (articulo) return [3, Number(articulo[1]), /^aprobacion de enmienda|^enmienda/.test(a) ? 0 : 1];
  return [3, 999, 0];
}
const compararPasos = (x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2];

/** ¿El grupo entra en el filtro? Los filtros son tipos: ninguno vale más que otro. */
export const enFiltro = (grupo, filtro) => filtro === 'todas' || grupo.tipo === filtro;

/** Cómo se nombra lo plegado de un grupo. */
export function nombrePasos(grupo) {
  const n = grupo.pasos.length;
  if (!n) return null;
  if (grupo.tipo === 'eleccion') return n === 1 ? 'otro candidato' : `otros ${n} candidatos`;
  if (grupo.tipo === 'tramite') return n === 1 ? 'una votación' : `${n} votaciones`;
  if (grupo.tipo === 'ley') return n === 1 ? 'una votación más de esta ley' : `${n} votaciones más de esta ley`;
  return n === 1 ? 'una votación más' : `${n} votaciones más`;
}
