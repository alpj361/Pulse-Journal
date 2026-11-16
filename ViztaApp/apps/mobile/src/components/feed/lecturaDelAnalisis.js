import { supabase } from '../../utils/supabase';
import { EXTRACTORW_URL } from '../../utils/servicios';

/**
 * El análisis de una iniciativa (STA-337/338).
 *
 * Lo hace el endpoint general de análisis con el perfil `iniciativa`, y lo pide
 * cada persona con su botón (PJ, 12-nov-2026): no se programa. Se corre una vez
 * (lo paga el sistema) y queda en caché; quien llega después lo recibe al
 * instante, y su pedido queda registrado como suyo.
 *
 *  - GET  /api/general-analysis/objeto/iniciativa/:n/mio → sin_pedir | en_curso | listo | fallido
 *  - POST /api/general-analysis/objeto/iniciativa/:n     → sirve la caché o lanza el análisis
 *
 * Contrato: ExtractorW docs/contracts/general-analysis-perfiles.md.
 */

async function pedirAlServidor(numero, method) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token || !numero) return null;
  const ruta = `${EXTRACTORW_URL}/api/general-analysis/objeto/iniciativa/${encodeURIComponent(numero)}${method === 'GET' ? '/mio' : ''}`;
  const res = await fetch(ruta, { method, headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404 || res.status === 401 || res.status === 403) return null;
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) throw new Error(json?.code || `http_${res.status}`);
  return leerEstado(json);
}

/** Lo que la tarjeta necesita del servidor: en qué está y, si ya está, el análisis leído. */
export function leerEstado(json) {
  let estado = ['sin_pedir', 'en_curso', 'listo', 'fallido'].includes(json?.estado) ? json.estado : 'sin_pedir';
  // Un pedido de una versión anterior del análisis llega como «fallido» sin código de error:
  // no falló, quedó viejo. Se ofrece «analizar» de nuevo, no «no se pudo analizar».
  if (estado === 'fallido' && !json?.error_code) estado = 'sin_pedir';
  const analisis = estado === 'listo' ? leerAnalisis(json.result) : null;
  // Listo pero sin nada que mostrar se trata como fallido: la tarjeta no ofrece algo vacío.
  return { estado: estado === 'listo' && !analisis ? 'fallido' : estado, cache: !!json?.cache, analisis };
}

/** El estado de la iniciativa para esta persona; `null` si no hay sesión o el servicio no la reconoce. */
export const estadoDelAnalisis = (numero) => pedirAlServidor(numero, 'GET');
/** El botón: devuelve el estado tras pedirlo (listo de la caché, o en curso). */
export const pedirAnalisis = (numero) => pedirAlServidor(numero, 'POST');

/** Lo que se va diciendo mientras se analiza: lo que el análisis hace, en orden. */
export const PASOS_ANALISIS = ['Leyendo la iniciativa…', 'Viendo qué hace…', 'Buscando a quién toca…', 'Revisando lo que deja abierto…', 'Armando las preguntas…'];
/** La caché también se espera: la persona pidió un análisis y lo ve hacerse. */
export const esperaDeCache = (azar = Math.random) => 5000 + Math.round(azar() * 3000);

// Los nombres de las cosas, sin calificar: lo que el texto hace o deja, no si está bien.
export const ACCIONES = {
  crea: 'crea', prohibe: 'prohíbe', obliga: 'obliga', faculta: 'faculta',
  sanciona: 'sanciona', modifica: 'modifica', deroga: 'deroga', otro: 'además',
};
export const EFECTOS = {
  beneficio: 'recibe', carga: 'asume un costo', obligacion: 'queda obligado',
  restriccion: 'deja de poder', poder: 'gana decisión',
};
export const OPERACIONES = { reforma: 'reforma', adiciona: 'adiciona', deroga: 'deroga' };
export const REVISAR = {
  contradiccion_interna: 'contradicción interna',
  termino_sin_definir: 'término sin definir',
  remite_a_reglamento: 'queda para un reglamento',
  sin_responsable: 'sin responsable',
  sin_consecuencia: 'sin consecuencia',
  choque_con_otra_norma: 'se cruza con otra norma',
};
export const DINERO = {
  gasto: 'gasto', asignacion: 'asignación', transferencia: 'transferencia', fondo: 'fondo', impuesto: 'impuesto',
  tasa: 'tasa', exencion: 'exención', multa: 'multa', otro: 'dinero',
};

const lista = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []);
const texto = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** «art. 4» o «arts. 2, 5 y 7»; nada si no se ubicó. */
export function articulosDe(nums) {
  const n = (Array.isArray(nums) ? nums : []).map((x) => String(x).trim()).filter(Boolean);
  if (!n.length) return null;
  if (n.length === 1) return `art. ${n[0]}`;
  return `arts. ${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}`;
}

/**
 * El resultado del endpoint, en lo que la pantalla dibuja. Una sección sin
 * datos queda afuera; las citas van con su sección.
 */
export function leerAnalisis(result) {
  if (!result || !Array.isArray(result.sections)) return null;
  const por = Object.fromEntries(result.sections.map((s) => [s.key, s]));
  const citas = (key) => (por[key]?.evidence || []).map((e) => texto(e?.quote)).filter(Boolean).slice(0, 3);
  const datos = (key) => por[key]?.data ?? null;
  const secciones = [];
  const agregar = (key, items) => { if (items.length) secciones.push({ key, titulo: por[key]?.title || key, items, citas: citas(key) }); };

  // Un monto que también está en «Dinero» va solo allá: no se repite como dato del problema.
  const montos = new Set(lista(datos('dinero')).map(partida).filter(Boolean)
    .filter((p) => (p.unidad === 'quetzales' || p.unidad === 'dolares') && typeof p.cantidad === 'number').map((p) => p.cantidad));
  agregar('problema', lista(datos('problema')).map((d) => {
    const t = texto(d.texto);
    if (!t) return null;
    const dato = d.tipo === 'dato';
    const cifraDato = dato ? cifraDelDato(d) : null;
    if (cifraDato && (cifraDato.unidad === 'quetzales' || cifraDato.unidad === 'dolares') && montos.has(cifraDato.valor)) return null;
    return { texto: t, tipo: dato ? 'dato' : 'planteamiento', cifraDato, fuente: dato ? texto(d.fuente_declarada) : null };
  }).filter(Boolean));
  agregar('que_hace', lista(datos('que_hace')).map((d) => ({
    texto: texto(d.que), accion: ACCIONES[d.accion] ? d.accion : 'otro', etiqueta: ACCIONES[d.accion] || null, quien: texto(d.quien), nota: articulosDe(d.articulos),
  })).filter((d) => d.texto));
  agregar('cambios_ley_vigente', lista(datos('cambios_ley_vigente')).map((d) => ({
    texto: `${OPERACIONES[d.operacion] || 'toca'} el artículo ${d.articulo} de ${texto(d.ley) || 'una ley'}`,
    etiqueta: OPERACIONES[d.operacion] || null,
    nota: texto(d.decreto),
    propuesto: texto(d.texto_propuesto),
    ley: { decreto: texto(d.decreto), articulo: texto(d.articulo), nombre: texto(d.ley) },
  })).filter((d) => d.ley.articulo));
  agregar('quien_gana_quien_asume', lista(datos('quien_gana_quien_asume')).map((d) => ({
    texto: texto(d.como), titulo: texto(d.grupo), etiqueta: EFECTOS[d.efecto] || null, efecto: d.efecto, nota: articulosDe(d.articulos),
  })).filter((d) => d.texto && d.titulo));
  agregar('dinero', lista(datos('dinero')).map(partida).filter(Boolean));
  agregar('para_revisar', lista(datos('para_revisar')).map((d) => ({
    texto: texto(d.que), tipo: REVISAR[d.tipo] ? d.tipo : 'otro', etiqueta: REVISAR[d.tipo] || null, nota: articulosDe(d.articulos),
  })).filter((d) => d.texto));

  const preguntas = lista(datos('preguntas')).map((d) => texto(d.pregunta)).filter(Boolean).slice(0, 3);
  const frase = texto(datos('en_una_frase'));
  if (!frase && !secciones.length && !preguntas.length) return null;
  return {
    frase,
    secciones,
    preguntas,
    // Solo la línea que pone el núcleo cuando el texto vino de OCR; lo que el modelo diga del texto no cuenta.
    escaneo: (result.limitations || []).some((l) => /^Texto obtenido por OCR/.test(String(l))),
  };
}

// ─── Dinero ────────────────────────────────────────────────────────────────────

const conComas = (n) => {
  const [ent, dec] = String(Math.round(n * 100) / 100).split('.');
  return ent.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (dec ? `.${dec}` : '');
};
const corto = (n) => (n >= 1e6 ? `${conComas(Math.round((n / 1e6) * 10) / 10)} millones` : conComas(n));

/** La cifra como se lee: «Q500 millones», «Q1,000 al mes», «0.03 %», «10 salarios mínimos». */
export function formatoCifra(cantidad, unidad, periodo) {
  if (typeof cantidad !== 'number' || !Number.isFinite(cantidad)) return null;
  const base = unidad === 'quetzales' ? `Q${corto(cantidad)}`
    : unidad === 'dolares' ? `US$${corto(cantidad)}`
    : unidad === 'porcentaje' ? `${conComas(cantidad)} %`
    : unidad === 'salarios_minimos' ? `${conComas(cantidad)} ${cantidad === 1 ? 'salario mínimo' : 'salarios mínimos'}`
    : conComas(cantidad);
  return base + (periodo === 'mensual' ? ' al mes' : periodo === 'anual' ? ' al año' : '');
}

/** Los análisis de antes traen el monto en texto: se saca la cifra de ahí. */
export function cifraDeTexto(monto) {
  const t = String(monto || '');
  const periodo = /mensual|al mes|cada mes/i.test(t) ? 'mensual' : /anual|al año|cada año/i.test(t) ? 'anual' : null;
  const q = t.match(/Q\s?([\d,]+(?:\.\d+)?)/);
  if (q) return { cantidad: Number(q[1].replace(/,/g, '')), unidad: 'quetzales', periodo };
  const usd = t.match(/(?:US\$|\$)\s?([\d,]+(?:\.\d+)?)/);
  if (usd) return { cantidad: Number(usd[1].replace(/,/g, '')), unidad: 'dolares', periodo };
  const pct = [...t.matchAll(/(\d+(?:\.\d+)?)\s?%/g)].map((m) => Number(m[1]));
  if (pct.length === 1) return { cantidad: pct[0], unidad: 'porcentaje', periodo };
  return null;
}

const vacio = (v) => !texto(v) || /^(no se|no dice|no indica|sin )/i.test(String(v).trim());

/** Una partida de dinero, con la cifra lista para mostrar; las que solo dicen «no hay» no van. */
function partida(d) {
  const concepto = texto(d.concepto);
  if (!concepto || /^no se (advierte|encontr|establec|indica)/i.test(concepto)) return null;
  const cifra = typeof d.cantidad === 'number' ? { cantidad: d.cantidad, unidad: d.unidad, periodo: d.periodo } : cifraDeTexto(d.monto);
  const reparto = lista(d.reparto).filter((r) => texto(r.parte) && typeof r.porcentaje === 'number' && r.porcentaje >= 0);
  const de = d.de !== undefined ? d.de : d.fuente_declarada;
  return {
    texto: concepto,
    tipo: d.tipo,
    etiqueta: DINERO[d.tipo] || null,
    cifra: cifra ? formatoCifra(cifra.cantidad, cifra.unidad, cifra.periodo) : null,
    cantidad: cifra?.cantidad ?? null,
    unidad: cifra?.unidad ?? null,
    periodo: cifra?.periodo ?? null,
    base: texto(d.base),
    de: vacio(de) ? null : texto(de),
    para: texto(d.para),
    reparto: reparto.length >= 2 ? reparto : null,
    nota: articulosDe(d.articulos),
  };
}

/**
 * La cifra principal de un dato del problema. Los análisis nuevos la traen
 * aparte; los de antes, dentro del texto: se toma el primer porcentaje o monto.
 */
export function cifraDelDato(d) {
  const c = d?.cifra;
  // Un año no es una cifra que se dibuje: «2026» no se mide ni se compara.
  const esAnio = (v, u) => (!u || u === 'otra') && Number.isInteger(v) && v >= 1900 && v <= 2100;
  if (c && typeof c.valor === 'number' && Number.isFinite(c.valor)) return esAnio(c.valor, c.unidad) ? null : { valor: c.valor, unidad: c.unidad || 'otra', etiqueta: texto(c.etiqueta) };
  const t = String(d?.texto || '');
  const pct = t.match(/(\d+(?:[.,]\d+)?)\s?%/);
  if (pct) return { valor: Number(pct[1].replace(',', '.')), unidad: 'porcentaje', etiqueta: null };
  const q = t.match(/Q\s?([\d,]+(?:\.\d+)?)/);
  if (q) return { valor: Number(q[1].replace(/,/g, '')), unidad: 'quetzales', etiqueta: null };
  return null;
}

/** El número como se lee en un dato: «68 %», «Q2.5 millones», «1,200». */
export function cifraLegible({ valor, unidad }) {
  if (unidad === 'porcentaje') return `${conComas(valor)} %`;
  if (unidad === 'quetzales') return `Q${corto(valor)}`;
  if (unidad === 'dolares') return `US$${corto(valor)}`;
  return corto(valor);
}

/** Un porcentaje dicho en cosas: «0.03 de cada 100». */
export function deCadaCien(valor) {
  if (typeof valor !== 'number' || valor < 0 || valor > 100) return null;
  return `${conComas(valor)} de cada 100`;
}

/** Para comparar montos en barras: los de quetzales del mismo período que el mayor. */
export function comparables(items) {
  const q = items.filter((i) => i.unidad === 'quetzales' && i.cantidad > 0);
  if (q.length < 2) return [];
  const mayor = q.reduce((a, b) => (b.cantidad > a.cantidad ? b : a));
  const mismos = q.filter((i) => i.periodo === mayor.periodo);
  return mismos.length >= 2 ? mismos.map((i) => ({ ...i, proporcion: i.cantidad / mayor.cantidad })) : [];
}

/** «Decreto 40-2022» o «40-2022» → «40-2022», como en `normas.decreto`. */
const claveDecreto = (d) => String(d || '').replace(/^decreto\s+(n[úu]mero\s+)?/i, '').replace(/\s+/g, '').toLowerCase();

/**
 * El artículo como está hoy, para ponerlo al lado del propuesto. Sale de la
 * base de leyes, no del análisis: el modelo nunca escribe el texto vigente.
 */
export async function traerVigente({ decreto, articulo }) {
  const clave = claveDecreto(decreto);
  if (!clave || !articulo) return null;
  const { data: normas, error } = await supabase.from('normas').select('id, titulo, decreto').ilike('decreto', `%${clave}%`).limit(5);
  if (error) throw error;
  const norma = (normas || []).find((n) => claveDecreto(n.decreto) === clave);
  if (!norma) return null;
  const { data: filas, error: e } = await supabase
    .from('articulos')
    .select('numero_articulo, texto, derogado')
    .eq('norma_id', norma.id)
    .eq('excluido_busqueda', false)
    .ilike('numero_articulo', String(articulo).trim())
    .limit(1);
  if (e) throw e;
  const fila = filas?.[0];
  return fila ? { ley: norma.titulo, texto: fila.texto, derogado: !!fila.derogado } : null;
}

