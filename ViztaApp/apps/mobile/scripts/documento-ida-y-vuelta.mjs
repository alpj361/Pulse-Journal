#!/usr/bin/env node
/**
 * Ida y vuelta con las notas reales: markdown → vizta.doc/1 → markdown.
 *
 * Dice cuántas notas vuelven idénticas, cuántas cambian y por qué. Es la
 * prueba de que pasar una nota al editor de bloques no le cambia la
 * `description` que leen el indexador, el rastreo y la web.
 *
 * Solo lee. Las notas son `codex_universe_items` con `tipo = 'Snippet'`.
 *
 *   # Desde la base (las claves van por el entorno, nunca en el repo):
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/documento-ida-y-vuelta.mjs
 *
 *   # Desde un volcado [{ id, description }]:
 *   node scripts/documento-ida-y-vuelta.mjs --archivo notas.json
 *
 *   --detalle   muestra hasta 3 renglones de ejemplo por motivo
 *   --json      el resultado como JSON, para guardarlo o compararlo
 *
 * Requiere Node 22 o más nuevo: importa `src/documento` tal cual, sin
 * compilar.
 */

import { readFileSync } from 'node:fs';
import { desdeMarkdown, aMarkdown, aTextoPlano, validar } from '../src/documento/index.js';

const args = process.argv.slice(2);
const opcion = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
};

async function leerNotas() {
  const archivo = opcion('--archivo');
  if (archivo) return JSON.parse(readFileSync(archivo, 'utf8'));

  const url = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const llave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !llave) {
    console.error('Falta --archivo, o SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno.');
    process.exit(1);
  }
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(url, llave, { auth: { persistSession: false } });
  const notas = [];
  // De a mil: es el tope de una consulta de PostgREST.
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase
      .from('codex_universe_items')
      .select('id, description')
      .eq('tipo', 'Snippet')
      .order('id')
      .range(desde, desde + 999);
    if (error) throw error;
    notas.push(...data);
    if (data.length < 1000) break;
  }
  return notas;
}

// ── Diferencias por renglón ─────────────────────────────────────────────────

/** Diff de renglones por subsecuencia común más larga. Las notas tienen cientos de renglones, no millones. */
function diff(a, b) {
  const n = a.length;
  const m = b.length;
  const lcs = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);

  // Se agrupan en tramos de quitados + agregados, para emparejar un renglón
  // viejo con su versión nueva.
  const tramos = [];
  let actual = null;
  let i = 0;
  let j = 0;
  const cerrar = () => {
    if (actual) tramos.push(actual);
    actual = null;
  };
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      cerrar();
      i++;
      j++;
    } else if (j < m && (i === n || lcs[i][j + 1] >= lcs[i + 1][j])) {
      (actual ||= { antes: [], despues: [] }).despues.push(b[j++]);
    } else {
      (actual ||= { antes: [], despues: [] }).antes.push(a[i++]);
    }
  }
  cerrar();
  return tramos;
}

const esFila = (l) => /^\s*\|.*\|\s*$/.test(l);

/** Por qué cambió un renglón. El orden importa: el primer motivo que calza gana. */
function motivo(antes, despues) {
  if (antes === undefined) return esFila(despues) ? 'tabla: se agregó la fila de encabezado' : 'renglón agregado';
  if (despues === undefined) {
    if (/^\s*```/.test(antes)) return 'código: cerca de cierre';
    return esFila(antes) ? 'tabla: fila quitada' : 'renglón quitado';
  }
  const guiones = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
  if (guiones.test(antes) && guiones.test(despues)) return 'tabla: fila de guiones del encabezado';
  if (esFila(antes) && esFila(despues)) {
    const sin = (l) => l.replace(/\s+/g, '');
    return sin(antes) === sin(despues) ? 'tabla: espacios entre celdas' : 'tabla: otro cambio';
  }
  if (/^\s*(\*{3,}|_{3,}|-{4,})\s*$/.test(antes) && despues === '---') return 'separador escrito como ---';
  if (/^\s*[*+][ \t]/.test(antes) && /^\s*-[ \t]/.test(despues)) return 'viñeta con * o + escrita con -';
  if (/^\s*\d+[.)]/.test(antes) && /^\s*\d+\./.test(despues)) {
    const resto = (l) => l.replace(/^\s*\d+[.)]\s*/, '');
    if (resto(antes) === resto(despues)) return 'numeración recontada';
  }
  if (/^\s*([-*+]|\d+[.)])[ \t]{2,}/.test(antes)) return 'espacios de más después de la viñeta';
  if (/^\s*>/.test(antes) && /^> /.test(despues)) return 'cita: espacio después de >';
  if (antes.replace(/(?<!\*)\*(?!\*)/g, '_') === despues) return 'cursiva con * escrita con _';
  if (antes.replace(/__/g, '**') === despues) return 'negrita con __ escrita con **';
  if (/^\s+#/.test(antes)) return 'título con sangría';
  if (antes.trim() === despues.trim()) return 'espacios al principio o al final';
  return 'otro';
}

/** El documento sin `_key`, para comparar dos lecturas. */
const sinClaves = (doc) => JSON.stringify(doc, (k, v) => (k === '_key' ? undefined : v));

// ── Principal ───────────────────────────────────────────────────────────────

const notas = await leerNotas();
const motivos = new Map();
const resultado = {
  notas: notas.length,
  vacias: 0,
  identicas: 0,
  cambian: 0,
  invalidas: [],
  inestables: [],
  pierden: [],
  textoPlanoDesalineado: [],
  bloques: 0,
  ms: 0,
};

const t0 = performance.now();
for (const { id, description } of notas) {
  const md = description || '';
  if (!md) resultado.vacias++;

  const doc = desdeMarkdown(md);
  resultado.bloques += doc.paginas[0].bloques.length;

  const v = validar(doc);
  if (!v.ok) resultado.invalidas.push({ id, errores: v.errores.slice(0, 3) });

  const vuelta = aMarkdown(doc);

  // Lo que cambie en el markdown tiene que ser solo de escritura: releído,
  // tiene que dar el mismo documento —mismo texto, mismas marcas, mismos
  // bloques— salvo las claves, que son nuevas en cada lectura.
  if (sinClaves(desdeMarkdown(vuelta)) !== sinClaves(doc)) resultado.pierden.push(id);

  // La segunda vuelta tiene que ser un punto fijo: si no, cada guardado
  // movería la nota un poco más.
  if (aMarkdown(desdeMarkdown(vuelta)) !== vuelta) resultado.inestables.push(id);

  // El mapa del rastreo tiene que cubrir el texto plano exacto.
  const { texto, mapa } = aTextoPlano(doc);
  const ultimo = mapa[mapa.length - 1];
  if (mapa.length && ultimo.hasta !== texto.length) resultado.textoPlanoDesalineado.push(id);

  if (vuelta === md) {
    resultado.identicas++;
    continue;
  }
  resultado.cambian++;

  const vistos = new Set();
  for (const t of diff(md.split('\n'), vuelta.split('\n'))) {
    const largo = Math.max(t.antes.length, t.despues.length);
    for (let k = 0; k < largo; k++) {
      const m = motivo(t.antes[k], t.despues[k]);
      const e = motivos.get(m) || { notas: 0, renglones: 0, ejemplos: [] };
      e.renglones++;
      if (!vistos.has(m)) {
        e.notas++;
        vistos.add(m);
      }
      if (e.ejemplos.length < 3) e.ejemplos.push({ id, antes: t.antes[k], despues: t.despues[k] });
      motivos.set(m, e);
    }
  }
}
resultado.ms = Math.round(performance.now() - t0);

const porMotivo = [...motivos.entries()].sort((a, b) => b[1].notas - a[1].notas);

if (args.includes('--json')) {
  console.log(JSON.stringify({ ...resultado, motivos: Object.fromEntries(porMotivo) }, null, 2));
} else {
  const r = resultado;
  console.log(`Notas: ${r.notas} (${r.vacias} vacías) · ${r.bloques} bloques · ${r.ms} ms en total`);
  console.log(`Idénticas: ${r.identicas} · Cambian: ${r.cambian}`);
  console.log(`Pierden algo al releerse: ${r.pierden.length} · Documentos inválidos: ${r.invalidas.length} · Segunda vuelta distinta: ${r.inestables.length} · Mapa desalineado: ${r.textoPlanoDesalineado.length}`);
  if (porMotivo.length) {
    console.log('\nPor qué cambian (notas · renglones):');
    for (const [m, e] of porMotivo) {
      console.log(`  ${String(e.notas).padStart(3)} · ${String(e.renglones).padStart(4)}  ${m}`);
      if (args.includes('--detalle')) {
        for (const x of e.ejemplos) {
          console.log(`        ${x.id}`);
          console.log(`        - ${JSON.stringify(x.antes ?? null)}`);
          console.log(`        + ${JSON.stringify(x.despues ?? null)}`);
        }
      }
    }
  }
  for (const x of r.invalidas) console.log(`Inválido ${x.id}: ${x.errores.join('; ')}`);
  for (const id of r.inestables) console.log(`Inestable ${id}`);
  for (const id of r.pierden) console.log(`Pierde algo ${id}`);
}
