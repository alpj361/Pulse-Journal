/**
 * Catálogo de campos del Codex para móvil.
 *
 * La fuente de verdad es el backend (`GET /api/codex/schema`, cacheado 5 min
 * server-side, sin auth) — el mismo que consume ThePulse. Acá se cachea a nivel
 * de módulo: una sola request por sesión, compartida por todos los modales.
 *
 * Los presets son GUÍAS, no reglas. Sirven para que el modelo no invente
 * nombres distintos para lo mismo y para que el humano llene rápido. Un preset
 * nunca dicta cómo se interpreta un dato real: manda la forma del dato.
 *
 * El fallback local es una red de seguridad para que la app no rompa sin red.
 * No pretende estar sincronizado con el backend.
 */

const SCHEMA_URL = 'https://server.standatpd.com/api/codex/schema';

export const FIELD_TYPES = [
  'texto', 'parrafo', 'numero', 'moneda', 'porcentaje',
  'fecha', 'rango', 'hora', 'booleano', 'dropdown',
  'tags', 'escala', 'ref', 'refs', 'id',
  'link', 'email', 'telefono', 'archivo', 'imagen',
  'geo', 'color', 'formula', 'eje', 'repetible',
];

// Núcleo mínimo por tipo — solo para no arrancar en blanco si el backend falla.
const FALLBACK_PRESETS = {
  Actor: [
    { label: 'Rol / función', type: 'texto' },
    { label: 'Cargo', type: 'texto' },
    { label: 'Afiliación', type: 'ref' },
    { label: 'Estado', type: 'dropdown', options: ['Activo', 'Inactivo', 'Retirado', 'Fallecido'] },
    { label: 'Situación legal', type: 'parrafo' },
  ],
  Entidad: [
    { label: 'Tipo', type: 'dropdown', options: ['Pública', 'Privada', 'Mixta', 'Internacional', 'Informal'] },
    { label: 'Representante', type: 'ref' },
    { label: 'Estado', type: 'dropdown', options: ['Vigente', 'Disuelta', 'Intervenida', 'Suspendida'] },
  ],
  Territorio: [
    { label: 'Tipo / escala', type: 'dropdown', options: ['País', 'Departamento', 'Municipio', 'Zona', 'Lugar'] },
    { label: 'Departamento', type: 'texto' },
    { label: 'Municipio', type: 'texto' },
  ],
  Evento: [
    { label: 'Periodo', type: 'rango' },
    { label: 'Lugar', type: 'ref' },
    { label: 'Resultado / desenlace', type: 'parrafo' },
  ],
  Historia: [
    { label: 'Tipo de marco', type: 'dropdown', options: ['Ley', 'Sistema', 'Antecedente', 'Narrativa', 'Concepto'] },
    { label: 'Resumen', type: 'parrafo' },
  ],
  Objeto: [
    { label: 'Tipo', type: 'dropdown', options: ['Documento', 'Audio', 'Video', 'Foto', 'Dato', 'Objeto físico'] },
    { label: 'Estado de verificación', type: 'dropdown', options: ['Verificado', 'Sin verificar', 'Desmentido'] },
  ],
  Artefacto: [
    { label: 'Tipo', type: 'dropdown', options: ['Sistema', 'Herramienta', 'Software', 'Método', 'Estrategia', 'Infraestructura'] },
    { label: 'Propósito / función', type: 'parrafo' },
  ],
  Snippet: [
    { label: 'Contenido', type: 'parrafo' },
    { label: 'Fuente', type: 'link' },
  ],
  Post: [
    { label: 'Título del post', type: 'texto', readonly: true },
    { label: 'Autor', type: 'texto', readonly: true },
    { label: 'Transcripción', type: 'parrafo', readonly: true },
  ],
};

const FALLBACK_ALIAS = { Evidencia: 'Objeto', Biblioteca: 'Historia', Fuente: 'Objeto' };

const FALLBACK_SCHEMA = {
  version: 'fallback',
  fieldTypes: FIELD_TYPES,
  presets: FALLBACK_PRESETS,
  tipoAlias: FALLBACK_ALIAS,
};

let cached = null;
let inflight = null;

export async function getCodexSchema() {
  if (cached) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(SCHEMA_URL, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      cached = {
        version: json.version || 'remoto',
        fieldTypes: json.fieldTypes?.length ? json.fieldTypes : FIELD_TYPES,
        presets: json.presets || FALLBACK_PRESETS,
        tipoAlias: json.tipoAlias || FALLBACK_ALIAS,
      };
    } catch (e) {
      console.warn('[codexSchema] backend no disponible, usando fallback:', e.message);
      cached = FALLBACK_SCHEMA;
    } finally {
      inflight = null;
    }
    return cached;
  })();

  return inflight;
}

/** Tipo canónico del catálogo a partir del tipo que trae el item. */
export function canonicalTipo(tipo, schema) {
  if (!tipo) return null;
  const alias = schema?.tipoAlias || FALLBACK_ALIAS;
  const presets = schema?.presets || FALLBACK_PRESETS;
  const t = String(tipo).trim();
  const exact = Object.keys(presets).find((k) => k.toLowerCase() === t.toLowerCase());
  if (exact) return exact;
  const aliased = Object.entries(alias).find(([k]) => k.toLowerCase() === t.toLowerCase());
  return aliased ? aliased[1] : null;
}

export function presetFor(tipo, schema) {
  const canon = canonicalTipo(tipo, schema);
  if (!canon) return [];
  return (schema?.presets || FALLBACK_PRESETS)[canon] || [];
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

  // El tipo llega ya normalizado desde la pantalla: los items de wiki_items
  // guardan `subcategory: 'person'`, que el catálogo no conoce — quien llama
  // resuelve primero el alias a 'Actor'.
  const preset = presetFor(tipoCanonico || item?.tipo || item?.subcategory, schema);
  const usadas = new Set();
  const conDato = [];
  const sinDato = [];

  for (const f of preset) {
    const key = Object.keys(raw).find((k) => k.toLowerCase() === f.label.toLowerCase());
    if (key) usadas.add(key);
    const shown = key ? formatValue(raw[key], f.type) : null;
    (shown ? conDato : sinDato).push({ label: f.label, type: f.type, value: shown, readonly: f.readonly });
  }

  // Campos que el item trae pero el preset no contempla — se muestran igual.
  const extra = [];
  for (const [k, v] of Object.entries(raw)) {
    if (usadas.has(k) || INTERNAL_KEYS.has(k.toLowerCase())) continue;
    const shown = formatValue(v);
    if (shown) extra.push({ label: k, type: 'texto', value: shown, extra: true });
  }

  return { conDato, sinDato, extra };
}
