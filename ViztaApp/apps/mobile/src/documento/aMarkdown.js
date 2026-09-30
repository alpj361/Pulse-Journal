/**
 * `vizta.doc/1` → markdown, para `description`.
 *
 * `description` es lo que leen el indexador (`historia_partir`), el rastreo
 * (`codex_resolver_texto`), Vizta, la búsqueda y la web. Por eso el markdown
 * que sale de acá es el mismo que ya había: un renglón por bloque, títulos con
 * `#`, listas con `-` y `1.`, `---` para cualquier separador. Nada que esos
 * lectores no entiendan hoy.
 *
 * Lo que no tiene markdown se resuelve así:
 * - Subrayado y estilo `tarjeta`: se pierden en `description`; viven en el
 *   documento.
 * - Toggle: su título como renglón y lo de adentro debajo, abierto. Para
 *   buscar y rastrear importa el texto, no si estaba plegado.
 * - Página: su título como `#` y sus bloques a continuación, para que el
 *   indexador las vea como secciones. F3 revisa esto cuando las páginas
 *   partan la historia.
 * - Dibujo, datasheet y medios: no escriben nada; no tienen texto.
 */

import { escribirEnLinea } from './enLinea.js';

const MARCA_DE_ALINEACION = { izquierda: ':---', centro: ':---:', derecha: '---:' };

function tabla(b) {
  const fila = (f) => `| ${f.join(' | ')} |`;
  const salida = [];
  (b.filas || []).forEach((f, i) => {
    salida.push(fila(f));
    if (i === 0 && b.encabezado) {
      const n = f.length;
      const al = Array.from({ length: n }, (_, k) => MARCA_DE_ALINEACION[b.alineacion?.[k]] || '---');
      salida.push(fila(al));
    }
  });
  return salida.join('\n');
}

/**
 * Los números de las listas numeradas se cuentan, no se guardan: así los
 * cuenta Portable Text y así reordenar no deja un «1, 3, 2». Un renglón en
 * blanco no corta la cuenta; cualquier otro bloque, sí.
 *
 * Salvo `numero`: los modelos escriben «1. Tema» + párrafo + «2. Tema», y
 * ahí el párrafo corta la lista pero el 2 es a propósito. `desdeMarkdown`
 * guarda `numero` solo en el renglón donde la cuenta no daría lo escrito, y
 * desde ahí se sigue contando.
 */
export function contadorDeListas() {
  let niveles = [];
  // `escrito` lo pasa `desdeMarkdown`: la cuenta sigue desde lo escrito y
  // devuelve lo que habría dado, para saber si hace falta guardar `numero`.
  return (b, escrito) => {
    const nivel = b.level || 1;
    if (b._type === 'block' && b.listItem === 'number') {
      niveles = niveles.slice(0, nivel);
      const esperado = Number.isInteger(b.numero) ? b.numero : (niveles[nivel - 1] || 0) + 1;
      niveles[nivel - 1] = escrito ?? esperado;
      for (let k = 0; k < nivel - 1; k++) niveles[k] = niveles[k] || 0;
      return esperado;
    }
    if ((b._type === 'block' && b.listItem) || b._type === 'todo') {
      niveles = niveles.slice(0, nivel - 1);
      return null;
    }
    const vacio = b._type === 'block' && !(b.children || []).some((s) => s.text && s.text.trim());
    if (!vacio) niveles = [];
    return null;
  };
}

/**
 * `escribirEnLinea`, recordado por spans. El editor no modifica spans: cuando
 * cambia un bloque, cambia su lista de spans y el resto sigue siendo el mismo
 * objeto. Así, pasar a markdown una nota larga después de escribir en un
 * renglón cuesta ese renglón.
 */
const lineasRecordadas = new WeakMap();
function enLineaDe(children, markDefs) {
  if (!children) return escribirEnLinea(children, markDefs);
  const r = lineasRecordadas.get(children);
  if (r && r.defs === markDefs) return r.texto;
  const texto = escribirEnLinea(children, markDefs);
  lineasRecordadas.set(children, { defs: markDefs, texto });
  return texto;
}

function bloques(lista, doc, salida, visitadas) {
  const numero = contadorDeListas();

  for (const b of lista || []) {
    const n = numero(b);
    const sangria = '  '.repeat(Math.max(0, (b.level || 1) - 1));
    const enLinea = () => enLineaDe(b.children, b.markDefs);
    // Un salto dentro de un bloque —un renglón partido con Shift+Enter, o
    // lo que venga de la web— tiene que seguir dentro del mismo bloque al
    // releerlo: se le repite el prefijo o la sangría.
    const conPrefijo = (prefijo, continuacion) => prefijo + enLinea().split('\n').join(`\n${continuacion}`);
    const poner = (texto) => salida.push({ key: b._key, texto });

    switch (b._type) {
      case 'block': {
        if (b.listItem === 'number') poner(conPrefijo(`${sangria}${n}. `, `${sangria}   `));
        else if (b.listItem) poner(conPrefijo(`${sangria}- `, `${sangria}  `));
        else if (/^h[1-6]$/.test(b.style)) poner(`${'#'.repeat(Number(b.style[1]))} ${enLinea()}`);
        else if (b.style === 'cita') poner(conPrefijo('> ', '> '));
        else poner(enLinea());
        break;
      }
      case 'todo':
        poner(conPrefijo(`${sangria}- [${b.hecho ? 'x' : ' '}] `, `${sangria}  `));
        break;
      case 'toggle':
        poner(enLinea());
        bloques(b.bloques, doc, salida, visitadas);
        break;
      case 'separador':
        poner('---');
        break;
      case 'codigo':
        poner([`\`\`\`${b.lenguaje || ''}`, ...(b.texto ? [b.texto] : []), '```'].join('\n'));
        break;
      case 'formula':
        poner(`$$${b.latex || ''}$$`);
        break;
      case 'tabla':
        if (b.filas?.length) poner(tabla(b));
        break;
      case 'pagina': {
        // Una página que se contiene a sí misma daría una vuelta infinita.
        const p = doc.paginas.find((x) => x._key === b.pagina);
        if (!p || visitadas.has(p._key)) break;
        visitadas.add(p._key);
        if (p.titulo) poner(`# ${p.titulo}`);
        bloques(p.bloques, doc, salida, visitadas);
        break;
      }
      default:
        break;
    }
  }
}

/**
 * El markdown de cada bloque, en orden: `[{ key, texto }]`. Es lo que manda
 * el rastreo a la base —el renglón tal como queda en `description`, con sus
 * marcas y su número de lista— para que las reglas vean lo mismo que ve el
 * indexador. Los bloques que no escriben nada no aparecen.
 */
export function renglonesPorBloque(doc) {
  const raiz = doc?.paginas?.[0];
  if (!raiz) return [];
  const salida = [];
  bloques(raiz.bloques, doc, salida, new Set([raiz._key]));
  return salida;
}

/** El documento como markdown. La primera página es la raíz; las otras se alcanzan por sus bloques «página». */
export function aMarkdown(doc) {
  return renglonesPorBloque(doc)
    .map((r) => r.texto)
    .join('\n');
}
