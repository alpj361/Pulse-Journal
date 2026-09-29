import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import python from 'highlight.js/lib/languages/python';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';

/**
 * Colores para los bloques de código.
 *
 * `highlight.js` con el núcleo y diez lenguajes, no el paquete entero: el
 * completo trae casi doscientos y pesa como la mitad de la app. Se colorea
 * **al salir del bloque**, no en cada tecla: mientras se escribe el código se
 * ve en un solo color, que es también lo que hace que escribir no se trabe.
 */

const LENGUAJES = { bash, css, go, java, javascript, json, markdown, python, sql, typescript, xml };
for (const [nombre, def] of Object.entries(LENGUAJES)) hljs.registerLanguage(nombre, def);

/** Cómo se lo llama y cómo se muestra. El primero de cada grupo es el que se guarda. */
export const LENGUAJES_A_MANO = [
  ['js', 'javascript'],
  ['ts', 'typescript'],
  ['python', 'python'],
  ['sql', 'sql'],
  ['json', 'json'],
  ['bash', 'bash'],
  ['html', 'xml'],
  ['css', 'css'],
  ['java', 'java'],
  ['go', 'go'],
  ['md', 'markdown'],
];

const ALIAS = {
  js: 'javascript',
  jsx: 'javascript',
  javascript: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  typescript: 'typescript',
  py: 'python',
  python: 'python',
  sql: 'sql',
  json: 'json',
  sh: 'bash',
  shell: 'bash',
  bash: 'bash',
  zsh: 'bash',
  html: 'xml',
  xml: 'xml',
  css: 'css',
  java: 'java',
  go: 'go',
  md: 'markdown',
  markdown: 'markdown',
};

export const lenguajeDe = (nombre) => ALIAS[String(nombre || '').toLowerCase()] || null;

// La paleta: pocos colores, apagados, sobre el papel de la nota.
const COLOR = {
  keyword: '#8A3FA0',
  built_in: '#8A3FA0',
  type: '#8A3FA0',
  literal: '#B5541C',
  number: '#B5541C',
  string: '#2F7D4F',
  regexp: '#2F7D4F',
  'template-variable': '#2F7D4F',
  comment: 'rgba(28,43,34,0.42)',
  doctag: 'rgba(28,43,34,0.42)',
  title: '#2D5EA8',
  'title.function': '#2D5EA8',
  'title.class': '#2D5EA8',
  attr: '#9A6A12',
  attribute: '#9A6A12',
  name: '#2D5EA8',
  tag: '#2D5EA8',
  meta: 'rgba(28,43,34,0.55)',
  variable: '#B5541C',
  symbol: '#B5541C',
  section: '#2D5EA8',
  bullet: '#B5541C',
  emphasis: null,
  strong: null,
};

const ENTIDADES = { '&lt;': '<', '&gt;': '>', '&amp;': '&', '&quot;': '"', '&#x27;': "'", '&#39;': "'" };
const decodificar = (t) => t.replace(/&(lt|gt|amp|quot|#x27|#39);/g, (m) => ENTIDADES[m]);

/** El color de un tramo por la clase más cercana que tenga color. */
function colorDe(clases) {
  for (let i = clases.length - 1; i >= 0; i--) {
    const c = clases[i]
      .split(/\s+/)
      .map((x) => x.replace(/^hljs-/, '').replace(/_+$/, ''))
      .find((x) => COLOR[x] !== undefined);
    if (c) return COLOR[c];
  }
  return null;
}

/**
 * El código partido en tramos con color: `[{ texto, color }]`. Juntos, los
 * tramos son el texto tal cual.
 */
export function resaltar(texto, lenguaje) {
  const t = String(texto ?? '');
  if (!t) return [];
  let html;
  try {
    const lang = lenguajeDe(lenguaje);
    html = lang ? hljs.highlight(t, { language: lang, ignoreIllegals: true }).value : hljs.highlightAuto(t, Object.keys(LENGUAJES)).value;
  } catch {
    return [{ texto: t, color: null }];
  }

  const salida = [];
  const pila = [];
  const re = /<span class="([^"]+)">|<\/span>|([^<]+)/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[1] !== undefined) pila.push(m[1]);
    else if (m[0] === '</span>') pila.pop();
    else {
      const trozo = decodificar(m[2]);
      const color = colorDe(pila);
      const ultimo = salida[salida.length - 1];
      if (ultimo && ultimo.color === color) ultimo.texto += trozo;
      else salida.push({ texto: trozo, color });
    }
  }
  // Si algo se perdió en el camino, mejor sin color que con texto distinto.
  return salida.map((x) => x.texto).join('') === t ? salida : [{ texto: t, color: null }];
}
