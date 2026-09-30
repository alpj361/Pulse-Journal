/**
 * LaTeX → SVG para las fórmulas de las notas (editor de bloques, STA-200).
 *
 *   POST /api/latex/svg   { latex, display = true }
 *   → { success, svg, ancho, alto }   (ancho y alto en puntos)
 *
 * La app pide el SVG una sola vez, al terminar de escribir la fórmula, y lo
 * guarda en el bloque: después se ve sin conexión y sin esperar. Se hace acá
 * y no en el teléfono porque MathJax pesa varios megas y no hay WebView.
 *
 * El SVG de MathJax viene medido en `ex` y pinta en `currentColor`. Se pasa
 * a puntos (react-native-svg no entiende `ex`) y se deja `currentColor`, que
 * la app llena con la tinta de la nota.
 *
 * Requiere: `npm i mathjax-full@3` y montar el router en `/api`:
 *   app.use('/api', require('./routes/latex'));
 */

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { mathjax } = require('mathjax-full/js/mathjax.js');
const { TeX } = require('mathjax-full/js/input/tex.js');
const { SVG } = require('mathjax-full/js/output/svg.js');
const { liteAdaptor } = require('mathjax-full/js/adaptors/liteAdaptor.js');
const { RegisterHTMLHandler } = require('mathjax-full/js/handlers/html.js');
const { AllPackages } = require('mathjax-full/js/input/tex/AllPackages.js');

const router = express.Router();

// Un documento de MathJax para todo el proceso: armarlo cuesta; convertir, no.
const adaptador = liteAdaptor();
RegisterHTMLHandler(adaptador);
const documento = mathjax.document('', {
  InputJax: new TeX({ packages: AllPackages.filter((p) => p !== 'bussproofs') }),
  // Sin caché de glifos compartida: cada SVG se sostiene solo, que es lo que
  // hace falta para guardarlo en el bloque.
  OutputJax: new SVG({ fontCache: 'none' }),
});

// Un `ex` del cuerpo de la nota (15 pt de monoespaciada) mide unos 7 pt.
const PUNTOS_POR_EX = 7.2;
const TOPE = 4000;

const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false } })
    : null;

/** Solo quien tiene sesión en la app. */
async function conSesion(req, res, next) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token || !supabase) return res.status(401).json({ success: false, message: 'Sin sesión' });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return res.status(401).json({ success: false, message: 'Sin sesión' });
  req.usuario = data.user;
  return next();
}

/** Convierte y mide. Exportada para probarla sin levantar el servidor. */
function latexASvg(latex, display = true) {
  const nodo = documento.convert(latex, { display });
  let svg = adaptador.innerHTML(nodo);

  // Un error de sintaxis de TeX no lanza: vuelve un SVG con el mensaje en
  // rojo. Se detecta para decírselo a la app en vez de guardar eso.
  if (/data-mjx-error=/.test(svg)) {
    const m = /data-mjx-error="([^"]*)"/.exec(svg);
    const e = new Error(m ? m[1] : 'La fórmula tiene un error');
    e.tex = true;
    throw e;
  }

  const ex = (nombre) => {
    const m = new RegExp(`${nombre}="([\\d.]+)ex"`).exec(svg);
    return m ? Number(m[1]) * PUNTOS_POR_EX : null;
  };
  const ancho = ex('width');
  const alto = ex('height');
  if (ancho) svg = svg.replace(/width="[\d.]+ex"/, `width="${ancho.toFixed(2)}"`);
  if (alto) svg = svg.replace(/height="[\d.]+ex"/, `height="${alto.toFixed(2)}"`);
  // El alineado vertical en `ex` tampoco lo entiende react-native-svg.
  svg = svg.replace(/\sstyle="vertical-align:[^"]*"/, '');
  return { svg, ancho: ancho ? Number(ancho.toFixed(2)) : null, alto: alto ? Number(alto.toFixed(2)) : null };
}

router.post('/latex/svg', conSesion, (req, res) => {
  const latex = String(req.body?.latex || '').trim();
  const display = req.body?.display !== false;
  if (!latex) return res.status(400).json({ success: false, message: 'Falta la fórmula' });
  if (latex.length > TOPE) return res.status(413).json({ success: false, message: 'La fórmula es demasiado larga' });
  try {
    return res.json({ success: true, ...latexASvg(latex, display) });
  } catch (e) {
    return res.status(e.tex ? 422 : 500).json({ success: false, message: e.message || 'No se pudo dibujar la fórmula' });
  }
});

module.exports = router;
module.exports.latexASvg = latexASvg;
