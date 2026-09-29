/**
 * Catálogo de campos del Codex para móvil.
 *
 * La fuente de verdad es el backend: `GET /api/codex/schema`, contrato 4.1.
 *
 * **Va con token, y eso cambia lo que devuelve.** Sin autenticación el endpoint
 * contesta el catálogo del sistema y nada más; con token agrega los campos y
 * presets que creó esta persona. Sin el header la app parece funcionar —hay
 * campos, hay presets— y simplemente nunca muestra lo propio, que es el peor
 * modo de fallar: silencioso y verosímil.
 *
 * **La caché lleva el id de la persona en la clave.** Con campos personales en
 * la respuesta, una caché global significa que cambiar de cuenta en el mismo
 * proceso muestra los campos de la anterior.
 *
 * **No hay presets escritos a mano acá.** La red de seguridad para trabajar sin
 * señal es el último schema que sí llegó, guardado en disco — no una copia
 * hardcodeada que envejece en silencio hasta contradecir al backend.
 *
 * Los presets son GUÍAS, no reglas: sirven para que no se inventen nombres
 * distintos para lo mismo. Nunca dictan cómo se interpreta un dato real.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { EXTRACTORW_URL } from './servicios';
import { tipoPorForma } from './formaCampo';

const SCHEMA_URL = `${EXTRACTORW_URL}/api/codex/schema`;
const DISCO = 'codex-schema';

export const FIELD_TYPES = [
  'texto', 'parrafo', 'numero', 'moneda', 'porcentaje',
  'fecha', 'rango', 'hora', 'booleano', 'dropdown',
  'tags', 'escala', 'ref', 'refs', 'id',
  'link', 'email', 'telefono', 'archivo', 'imagen',
  'geo', 'color', 'formula', 'eje', 'repetible',
];

// Núcleo mínimo por tipo — solo para no arrancar en blanco si el backend falla.
/**
 * Normaliza la respuesta 4.1 a algo indexado.
 *
 * El backend manda listas —167 campos, 11 presets— y la interfaz siempre
 * pregunta por clave o por tipo. Indexar una vez al recibir evita recorrer 167
 * elementos cada vez que un modal quiere saber cómo se llama un campo.
 *
 * `presets` se conserva tal como viene porque el backend mantiene esa forma por
 * compatibilidad y **ya trae `field_key` en cada entrada**; es la que consumen
 * hoy los modales. Se le suma `porKey` para poder ir de la clave al campo sin
 * buscar.
 */
function indexar(json) {
  const campos = Array.isArray(json.fields) ? json.fields : [];

  const porKey = new Map();
  // `storage_key` es dónde vivía el valor cuando los campos se guardaban por
  // label. El backend lo publica, así que la correspondencia legacy→canónica no
  // hay que adivinarla ni esperar a un backfill para poder leer datos viejos.
  const porStorage = new Map();

  for (const c of campos) {
    if (!c?.field_key) continue;
    porKey.set(c.field_key, c);
    if (c.storage_key) porStorage.set(String(c.storage_key).toLowerCase(), c);
  }

  const presetsPorTipo = new Map();
  for (const p of Array.isArray(json.presetDefinitions) ? json.presetDefinitions : []) {
    for (const t of p.item_types || []) {
      if (!presetsPorTipo.has(t)) presetsPorTipo.set(t, []);
      presetsPorTipo.get(t).push(p);
    }
  }

  const presentacion = new Map();
  for (const t of Array.isArray(json.typeDefinitions) ? json.typeDefinitions : []) {
    if (t?.tipo) presentacion.set(t.tipo, t);
  }

  return {
    version: json.version || '4.1',
    itemTypes: json.itemTypes || [],
    auxiliaryTypes: json.auxiliaryTypes || [],
    resourceTypes: json.resourceTypes || [],
    fieldTypes: json.fieldTypes?.length ? json.fieldTypes : FIELD_TYPES,
    tipoAlias: json.tipoAlias || {},
    presets: json.presets || {},
    campos,
    porKey,
    porStorage,
    presetsPorTipo,
    presentacion,
  };
}

/** Una caché por persona: `${userId}:${version}` no se puede armar antes de
 *  saber la versión, así que en memoria se indexa por usuario y la versión se
 *  usa para la copia en disco. */
const enMemoria = new Map();
const enVuelo = new Map();

async function token() {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  } catch {
    return null;
  }
}

export async function getCodexSchema(userId = 'anon') {
  if (enMemoria.has(userId)) return enMemoria.get(userId);
  if (enVuelo.has(userId)) return enVuelo.get(userId);

  const promesa = (async () => {
    const jwt = await token();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(SCHEMA_URL, {
        signal: controller.signal,
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : undefined,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      const schema = indexar(json);
      enMemoria.set(userId, schema);
      // La copia en disco es para la próxima vez que no haya red. Se guarda el
      // JSON crudo y no el indexado: los Map no sobreviven a JSON.stringify.
      AsyncStorage.setItem(`${DISCO}:${userId}:${schema.version}`, JSON.stringify(json)).catch(() => {});
      AsyncStorage.setItem(`${DISCO}:${userId}:ultima`, schema.version).catch(() => {});
      return schema;
    } catch (e) {
      console.warn('[codexSchema] backend no disponible:', e.message);
      const guardado = await ultimoEnDisco(userId);
      if (guardado) return guardado;
      // Sin red y sin copia previa: se devuelve un schema vacío en vez de uno
      // inventado. Un modal sin campos sugeridos es honesto; uno con campos que
      // el backend no conoce escribe datos que después nadie encuentra.
      const vacio = indexar({ version: 'sin-conexión' });
      enMemoria.set(userId, vacio);
      return vacio;
    } finally {
      enVuelo.delete(userId);
    }
  })();

  enVuelo.set(userId, promesa);
  return promesa;
}

async function ultimoEnDisco(userId) {
  try {
    const version = await AsyncStorage.getItem(`${DISCO}:${userId}:ultima`);
    if (!version) return null;
    const crudo = await AsyncStorage.getItem(`${DISCO}:${userId}:${version}`);
    if (!crudo) return null;
    const schema = indexar(JSON.parse(crudo));
    enMemoria.set(userId, schema);
    return schema;
  } catch {
    return null;
  }
}

/** Al cerrar sesión hay que soltar el schema: lleva campos de esa persona. */
export function olvidarSchema(userId) {
  if (userId) enMemoria.delete(userId);
  else enMemoria.clear();
}

/** La definición de un campo por su clave. */
export const campoPorKey = (key, schema) => schema?.porKey?.get(key) || null;

/** Los presets que aplican a un tipo, desde `presetDefinitions`. */
export const presetsDe = (tipo, schema) => schema?.presetsPorTipo?.get(tipo) || [];

/** Cómo se presenta un tipo: `item`, `source`, `post`… Viene de
 *  `typeDefinitions` y es lo que después distingue a Source de un Actor. */
export const presentacionDe = (tipo, schema) =>
  schema?.presentacion?.get(tipo)?.presentation || { card: 'item', createModal: 'item', detailModal: 'item' };

/** Tipo canónico del catálogo a partir del tipo que trae el item. */
export function canonicalTipo(tipo, schema) {
  if (!tipo) return null;
  const t = String(tipo).trim();

  // Los tipos que el contrato reconoce: oficiales y auxiliares. `Post` y
  // `Snippet` se resuelven igual que los demás —guardan su valor en `tipo`—
  // aunque después se presenten distinto.
  const conocidos = [...(schema?.itemTypes || []), ...(schema?.auxiliaryTypes || [])];
  const exacto = conocidos.find((k) => k.toLowerCase() === t.toLowerCase());
  if (exacto) return exacto;

  // `tipoAlias` traduce el vocabulario viejo: «Evidencia» era «Objeto»,
  // «Fuente» era «Source». Sin esto, los items importados antes del cambio de
  // nombre pierden su catálogo de campos.
  const alias = Object.entries(schema?.tipoAlias || {}).find(
    ([k]) => k.toLowerCase() === t.toLowerCase()
  );
  return alias ? alias[1] : null;
}

/**
 * Los campos sugeridos para un tipo.
 *
 * Devuelve las definiciones completas —con `field_key` y `storage_key`—, no
 * solo label y tipo. La versión anterior conservaba la clave que mandaba el
 * backend y la descartaba una función después, en `collectFields`, que después
 * emparejaba por label. La clave siempre estuvo ahí; solo faltaba no tirarla.
 */
export function presetFor(tipo, schema) {
  const canon = canonicalTipo(tipo, schema);
  if (!canon) return [];

  // Se prefiere el índice armado desde `fields` + `presetDefinitions`, que es
  // el contrato 4.1. `presets` es la forma de compatibilidad y queda de red por
  // si el backend todavía no publica los presets de este tipo.
  const desdeDefiniciones = [];
  const vistas = new Set();
  for (const preset of presetsDe(canon, schema)) {
    for (const key of preset.field_keys || []) {
      if (vistas.has(key)) continue;
      const campo = campoPorKey(key, schema);
      if (!campo) continue;
      vistas.add(key);
      desdeDefiniciones.push(normalizarCampo(campo));
    }
  }
  if (desdeDefiniciones.length) return desdeDefiniciones;

  const compat = schema?.presets?.[canon] || [];
  return compat.map(normalizarCampo);
}

/**
 * Alias semánticos: clave cruda de datos migrados → label del campo del
 * catálogo que representa el mismo concepto.
 *
 * **Por qué existen.** Antes de que el contrato 4.1 nombrara los campos del
 * sistema, los datos se guardaban con el nombre de columna crudo de la
 * importación — un Territorio migrado trae `lider`, no `"Quién controla"`. El
 * backend nunca corrió (ni va a correr) un backfill que renombre esa clave
 * dentro de `details`, así que sin este mapa el campo canónico aparece
 * siempre vacío y el dato viejo se ve pero no tiene con qué editor calzar.
 *
 * Es el mismo mapa que ya existe en ThePulse (`CodexItemModal.tsx`,
 * `FIELD_ALIASES`) — se replica acá porque el móvil resuelve sus campos con
 * su propio código, no comparte el de la web.
 *
 * Solo alias tipo-compatibles: `lider` es un `RefVal` crudo y «Quién
 * controla» es `type: 'ref'` — coinciden en forma. Un alias que apuntara a un
 * tipo incompatible (ej. un string libre hacia un campo `ref`) rompería el
 * picker en vez de arreglar nada.
 */
export const FIELD_ALIASES = {
  lider: 'Quién controla',            // Territorio — raw RefVal, preset 'ref'
  resultado: 'Resultado / desenlace', // Evento — raw string, preset 'parrafo'
  profesion: 'Profesión',             // Actor (raw sin tilde) — ambos 'texto'
};

/**
 * La forma que consumen los modales.
 *
 * `config` en el contrato 4.1 anida `options`, `poles` y `cols`; los editores
 * de `FieldInput` los esperan sueltos. Se aplanan acá, en el borde, para no
 * repartir el conocimiento del contrato por toda la interfaz.
 */
function normalizarCampo(c) {
  const config = c.config || {};
  return {
    field_key: c.field_key || null,
    storage_key: c.storage_key || c.label || null,
    label: c.label,
    type: c.field_type || c.type,
    readonly: Boolean(c.readonly),
    origin: c.origin || 'system',
    options: config.options || c.options,
    poles: config.poles || c.poles,
    cols: config.cols || c.cols,
  };
}

// ─── Lectura de valores ───────────────────────────────────────────────────────

/**
 * Convierte cualquier valor guardado a algo mostrable, sin descartar nada.
 *
 * El modal viejo hacía `if (typeof v === 'object') return false` y así se comía
 * refs, repetibles, geo, ejes y rangos — justo los campos que más trabajo
 * cuestan de llenar. Acá cada forma tiene su lectura.
 */
export function formatValue(value, type) {
  if (value === null || value === undefined || value === '') return null;

  if (type === 'booleano' || typeof value === 'boolean') return value ? 'Sí' : 'No';

  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    // repetible → array de filas (objetos); tags/refs → array de escalares
    if (typeof value[0] === 'object' && value[0] !== null) {
      return value
        .map((row) => Object.values(row).filter(Boolean).join(' · '))
        .filter(Boolean)
        .join('\n');
    }
    return value.filter((v) => v !== null && v !== '').join(', ');
  }

  if (typeof value === 'object') {
    // rango { desde, hasta } | geo { lat, lng } | eje { valor } | ref { name/id }
    const v = value;
    if (v.desde || v.hasta || v.from || v.to) {
      const a = v.desde ?? v.from ?? '?';
      const b = v.hasta ?? v.to ?? 'hoy';
      return `${a} → ${b}`;
    }
    if (v.lat != null && (v.lng != null || v.lon != null)) {
      const lng = v.lng ?? v.lon;
      return `${Number(v.lat).toFixed(4)}, ${Number(lng).toFixed(4)}`;
    }
    if (v.name || v.nombre || v.label) return String(v.name || v.nombre || v.label);
    if (v.value != null) return String(v.value);
    const entries = Object.entries(v).filter(([, x]) => x !== null && x !== '' && typeof x !== 'object');
    if (entries.length) return entries.map(([k, x]) => `${k}: ${x}`).join(' · ');
    return null;
  }

  return String(value);
}

// Claves internas que no son campos de investigación.
export const INTERNAL_KEYS = new Set([
  'id', 'user_id', 'created_at', 'updated_at', 'avatar', 'research',
  'research_last_updated', 'thumbnail_url', 'embedding', '_source',

  // Las fotos que se adjuntan a una nota desde el teléfono. Es una lista de
  // objetos {url, storage_path, ancho, alto}, no un campo de investigación: la
  // hoja de la nota las pinta como fotos y la ficha no tiene que escribirlas
  // como un renglón de texto.
  'usr_imagenes', 'usr_audios',

  // Plomería del análisis de posts en segundo plano. `analysis` ya lo pinta la
  // hoja del post con su propio diseño; el estado y el error son de la máquina,
  // no del post, y no tienen por qué ocupar un renglón de la ficha.
  'analysis', 'analysis_estado', 'analysis_error',

  // Legacy del contrato geográfico. El nivel de un territorio vive en
  // `geo.hierarchy.level` y la ficha ya lo muestra —«Departamento» con su
  // cheque— en la sección del mapa. Dejarlo acá lo escribía por segunda vez en
  // la misma pantalla, y encima en minúsculas y con nombre de columna.
  'boundary_type',

  // Plomería de la importación, no datos del item. `datasets` y `dataset_id`
  // son uuids crudos y `source` dice «dataset», que describe de dónde salió la
  // fila y no qué es el territorio. Ocupaban un renglón cada uno en la ficha
  // para no decirle nada a nadie.
  'dataset_id', 'datasets', 'source',

  // El resto de la misma plomería, que se escapaba: `dataset_visibility` dice
  // «public» —permiso de la fila, no del actor—, `actor_type` dice «person»
  // cuando la insignia de arriba ya dice ACTOR, y `original_type` es el nombre
  // del tipo antes de migrar. Entre los tres aparecían en más de mil fichas.
  'dataset_visibility', 'actor_type', 'original_type',

  // Contrato interno: la declaración de campos propios que el backend lee para
  // saber qué tipo tiene cada clave. Es esquema, no dato.
  '__cx_custom_fields__', 'flag',

  // La ruta interna de la portada de una nota. **`foto` no va acá**: es
  // `sys_actor_foto`, un campo del catálogo con tipo `imagen`, y esconder un
  // campo real del catálogo lo vuelve inaccesible para editarlo. Se muestra
  // como miniatura, no como URL.
  'portada_path',

  // Todo lo que trae un post capturado. La hoja del post lo pinta con su
  // propio diseño —video, carrusel, transcripción, métricas— y en la ficha del
  // Codex serían quince renglones de plomería: ids, banderas y URLs.
  'post_id', 'is_reel', 'is_twitter', 'video_url', 'images', 'extracted_images',
  'transcription', 'tweet_metrics', 'analysis_v1', 'author', 'author_name',
  'caption', 'permalink', 'media_type', 'shortcode', 'source_url',
]);

/**
 * Reúne todos los campos con dato de un item, en el orden del preset y con lo
 * que no está en el preset al final — para que nada quede invisible.
 */
export function collectFields(item, schema, tipoCanonico) {
  const raw = {
    ...(item?.details || {}),
    ...(item?.metadata?.details || {}),
    ...(item?.metadata || {}),
  };

  /**
   * Dónde está guardado el valor de un campo.
   *
   * Se busca por `field_key` primero y por `storage_key` —el label con el que
   * se guardaba antes— después. Las dos claves las publica el backend en la
   * misma definición, así que la correspondencia no se adivina.
   *
   * El orden importa y no es simétrico: si el backfill del backend ya corrió,
   * el valor está bajo la clave canónica y se encuentra en el primer intento;
   * si no corrió, se cae al label. Al revés, un item ya migrado que conservara
   * basura vieja bajo el label mostraría el dato viejo como si fuera el bueno.
   *
   * El último intento es `FIELD_ALIASES` al revés: alguna clave cruda de
   * `raw` cuyo alias apunta al label de este campo (ej. `lider` → «Quién
   * controla»). Va al final porque `field_key`/`storage_key` son la fuente de
   * verdad publicada por el backend; el alias es solo la red para el nombre
   * de columna que la migración dejó sin traducir.
   */
  const leer = (campo) => {
    if (campo.field_key && campo.field_key in raw) {
      return { clave: campo.field_key, valor: raw[campo.field_key] };
    }
    const legacy = campo.storage_key || campo.label;
    if (legacy) {
      const hallada = Object.keys(raw).find((k) => k.toLowerCase() === String(legacy).toLowerCase());
      if (hallada) return { clave: hallada, valor: raw[hallada] };
    }
    const aliasKey = Object.keys(raw).find(
      (k) => FIELD_ALIASES[k.toLowerCase()]?.toLowerCase() === String(campo.label).toLowerCase()
    );
    return aliasKey ? { clave: aliasKey, valor: raw[aliasKey] } : null;
  };

  // El tipo llega ya normalizado desde la pantalla: los items de wiki_items
  // guardan `subcategory: 'person'`, que el catálogo no conoce — quien llama
  // resuelve primero el alias a 'Actor'.
  const preset = presetFor(tipoCanonico || item?.tipo || item?.subcategory, schema);
  const usadas = new Set();
  const conDato = [];
  const sinDato = [];

  for (const f of preset) {
    const hallado = leer(f);
    if (hallado) usadas.add(hallado.clave);
    const shown = hallado ? formatValue(hallado.valor, f.type) : null;
    // `field_key` viaja hasta el consumidor: es lo que después permite escribir
    // por clave canónica sin volver a resolver nada.
    (shown ? conDato : sinDato).push({
      field_key: f.field_key,
      storage_key: f.storage_key,
      // Bajo qué clave de `details` se encontró el valor. El editor la usa para
      // saber exactamente qué claves mostró —y por lo tanto cuáles le toca
      // reescribir al guardar— sin volver a resolver nada por su cuenta.
      clave: hallado ? hallado.clave : null,
      label: f.label,
      type: f.type,
      value: shown,
      // El valor sin formatear. Los viewers del registro lo necesitan crudo: un
      // porcentaje dibuja una barra con el número, y recibir «25%» lo obligaría
      // a volver a parsear lo que alguien ya había parseado.
      crudo: hallado ? hallado.valor : null,
      readonly: f.readonly,
      options: f.options,
      poles: f.poles,
      cols: f.cols,
    });
  }

  /**
   * Campos que el item trae pero el preset no contempla.
   *
   * **Se busca su definición en el esquema antes de rendirse.** No estar en un
   * preset no significa ser desconocido: `createUserField` da de alta el campo
   * sin agregarlo a ningún preset, así que todo campo propio caía acá — y acá
   * se mostraba con su clave técnica por nombre (`usr_sintetico` en vez de
   * «Sintético») y como texto plano, aunque el esquema supiera que es un
   * booleano con su casilla.
   *
   * Con la definición a mano, un campo fuera del preset se ve exactamente igual
   * que uno de adentro: su label y su control. Lo único que cambia es el orden
   * en que aparece, que es lo que el preset decide de verdad.
   */
  const extra = [];
  for (const [k, v] of Object.entries(raw)) {
    if (usadas.has(k) || INTERNAL_KEYS.has(k.toLowerCase())) continue;
    // El texto de una nota como bloques (`details.documento`, `vizta.doc/1`).
    // La nota lo pinta como texto; en la ficha sería un objeto sin sentido.
    // Se mira el valor y no la clave: un campo de investigación puede
    // llamarse «Documento».
    if (v && typeof v === 'object' && v._type === 'vizta.doc') continue;

    const def = schema?.porKey?.get(k) || schema?.porStorage?.get(k.toLowerCase()) || null;
    // Sin definición, el tipo sale de la forma del valor: un vínculo guardado en
    // un campo suelto se lee como referencia, no como texto.
    const tipoExtra = def?.field_type || tipoPorForma(v);
    const shown = formatValue(v, tipoExtra);
    if (!shown) continue;

    extra.push({
      field_key: def?.field_key,
      storage_key: def?.storage_key,
      clave: k,
      label: def?.label || k,
      type: tipoExtra,
      value: shown,
      crudo: v,
      readonly: def?.readonly,
      options: def?.options,
      poles: def?.poles,
      cols: def?.cols,
      extra: true,
    });
  }

  return { conDato, sinDato, extra };
}
