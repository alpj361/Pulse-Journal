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
  const estado = ['sin_pedir', 'en_curso', 'listo', 'fallido'].includes(json?.estado) ? json.estado : 'sin_pedir';
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
  gasto: 'gasto', asignacion: 'asignación', fondo: 'fondo', impuesto: 'impuesto',
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

  agregar('problema', lista(datos('problema')).map((d) => ({
    texto: texto(d.texto), etiqueta: d.tipo === 'dato' ? 'dato' : null,
    nota: d.tipo === 'dato' ? (texto(d.fuente_declarada) ? `fuente: ${d.fuente_declarada}` : 'sin fuente') : null,
  })).filter((d) => d.texto));
  agregar('que_hace', lista(datos('que_hace')).map((d) => ({
    texto: texto(d.que), etiqueta: ACCIONES[d.accion] || null, nota: [texto(d.quien), articulosDe(d.articulos)].filter(Boolean).join(' · ') || null,
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
  agregar('dinero', lista(datos('dinero')).map((d) => ({
    texto: texto(d.concepto), etiqueta: DINERO[d.tipo] || null, cifra: texto(d.monto),
    nota: texto(d.fuente_declarada) ? `sale de: ${d.fuente_declarada}` : 'no dice de dónde sale',
  })).filter((d) => d.texto));
  agregar('para_revisar', lista(datos('para_revisar')).map((d) => ({
    texto: texto(d.que), etiqueta: REVISAR[d.tipo] || null, nota: articulosDe(d.articulos),
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

