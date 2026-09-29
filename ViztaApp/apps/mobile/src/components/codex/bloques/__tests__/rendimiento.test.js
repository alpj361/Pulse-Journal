/**
 * Cuánto cuesta el editor en JS, sin pintar: abrir una nota de 5.000
 * palabras y escribir una tecla en ella. Las metas de la F1 son < 300 ms para
 * abrir y < 16 ms por tecla en el teléfono; acá corre en Node, que es más
 * rápido que Hermes, así que lo que importa es el orden de magnitud y que no
 * crezca con el largo de la nota.
 *
 *   MEDIR=1 npx jest rendimiento
 */
import { aMarkdown, desdeMarkdown, renglonesPorBloque } from '../../../../documento';
import { aDocumento, conTexto, textoDe } from '../../../../documento/editor';
import { construirIndice } from '../../menciones';
import { anotar, armarPedido, memoriaNueva, piezas, tramosDeBloque } from '../rastreo';
import { crearEditor } from '../store';

const medir = process.env.MEDIR ? describe : describe.skip;

// Un Codex como el de verdad: ~1.300 fichas con nombres de dos o tres palabras.
const SILABAS = ['ra', 'mon', 'te', 'ga', 'lo', 'ber', 'nar', 'do', 'cas', 'ti', 'llo', 'mar', 'que', 'ze', 'pe', 'rez', 'lu', 'is', 'an', 'na'];
let semilla = 7;
const azar = () => {
  semilla = (semilla * 16807) % 2147483647;
  return semilla / 2147483647;
};
const palabra = (n = 2 + Math.floor(azar() * 2)) =>
  Array.from({ length: n }, () => SILABAS[Math.floor(azar() * SILABAS.length)]).join('');
const nombre = () => {
  const p = palabra();
  return p[0].toUpperCase() + p.slice(1);
};
const ITEMS = Array.from({ length: 1300 }, (_, i) => ({
  id: `i${i}`,
  name: Array.from({ length: 2 + (i % 2) }, nombre).join(' '),
  tipo: 'Actor',
  aliases: [],
}));
const INDICE = construirIndice(ITEMS);
INDICE.porId = new Map(ITEMS.map((i) => [i.id, i]));

/** Una nota de ~5.000 palabras, con títulos, listas, formato y nombres del Codex. */
function notaLarga() {
  const renglones = [];
  let palabras = 0;
  while (palabras < 5700) {
    const r = azar();
    const frase = Array.from({ length: 8 + Math.floor(azar() * 10) }, (_, i) =>
      i === 3 ? ITEMS[Math.floor(azar() * ITEMS.length)].name : i === 6 ? `**${palabra()}**` : palabra(),
    ).join(' ');
    palabras += frase.split(' ').length;
    if (r < 0.08) renglones.push(`## ${frase.slice(0, 40)}`);
    else if (r < 0.3) renglones.push(`- ${frase}`);
    else if (r < 0.4) renglones.push('');
    else renglones.push(frase);
  }
  return renglones.join('\n');
}

const pintarBloque = (b, memoria) => {
  const tramos = tramosDeBloque(b, INDICE);
  const { tramos: anotados } = anotar(tramos, null, memoria, { fallo: true, porId: INDICE.porId });
  return piezas(b.children, anotados);
};

const ms = (f) => {
  const t = performance.now();
  const r = f();
  return [performance.now() - t, r];
};

medir('rendimiento del editor', () => {
  const md = notaLarga();

  test('abrir y escribir', () => {
    // Calentar: la primera vuelta paga el JIT.
    crearEditor(desdeMarkdown(md));

    const [abrir, editor] = ms(() => {
      const e = crearEditor(desdeMarkdown(md));
      const { estado } = e.getState();
      // Lo que se pinta al abrir: los primeros bloques.
      for (const k of estado.orden.slice(0, 40)) if (conTexto(estado.porKey[k])) pintarBloque(estado.porKey[k], memoriaNueva());
      return e;
    });

    const { estado } = editor.getState();
    const bloques = estado.orden.length;
    const k = estado.orden.find((x, i) => i > bloques / 2 && conTexto(estado.porKey[x]) && textoDe(estado.porKey[x].children).length > 20);
    const memoria = memoriaNueva();
    const tiempos = [];
    for (let i = 0; i < 300; i++) {
      const [t] = ms(() => {
        const antes = textoDe(editor.getState().estado.porKey[k].children);
        editor.getState().seleccionar(k, antes.length);
        editor.getState().escribir(k, `${antes}x`);
        pintarBloque(editor.getState().estado.porKey[k], memoria);
      });
      tiempos.push(t);
    }
    tiempos.sort((a, b) => a - b);

    // Lo que corre una vez, después de dejar de escribir. La primera vez que
    // se abre la nota recorre todo; después, solo lo que cambió.
    const [emitir] = ms(() => aMarkdown(editor.getState().documento()));
    const preparar = () => {
      const e = editor.getState().estado;
      const conNombres = new Set(e.orden.filter((x) => conTexto(e.porKey[x]) && tramosDeBloque(e.porKey[x], INDICE).some((t) => t.item)));
      return armarPedido(renglonesPorBloque(aDocumento(e)), conNombres, new Map());
    };
    const [prepararFrio] = ms(preparar);
    const antes = textoDe(editor.getState().estado.porKey[k].children);
    editor.getState().escribir(k, `${antes}y`);
    const [prepararCaliente] = ms(preparar);

    const r = (x) => Math.round(x * 100) / 100;
    console.log(
      [
        `palabras: ${md.split(/\s+/).length}, bloques: ${bloques}`,
        `abrir (leer + estado + pintar 40 bloques): ${r(abrir)} ms`,
        `tecla: mediana ${r(tiempos[150])} ms · p95 ${r(tiempos[285])} ms · peor ${r(tiempos[299])} ms`,
        `al dejar de escribir: markdown ${r(emitir)} ms · pedido del rastreo ${r(prepararCaliente)} ms (al abrir: ${r(prepararFrio)} ms)`,
      ].join('\n'),
    );
    expect(abrir).toBeLessThan(300);
    expect(tiempos[285]).toBeLessThan(16);
  });
});
