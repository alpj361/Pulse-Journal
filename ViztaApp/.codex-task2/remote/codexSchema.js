/**
 * codexSchema.js — Fuente de verdad del esquema del Codex (backend).
 *
 * FILOSOFÍA (definida con el PM):
 *  - Los PRESETS son GUÍAS, no reglas. Su rol es (1) darle al modelo un vocabulario
 *    consistente de labels para que no alucine "Sesgo" en un perfil y "Posición" en
 *    otro, y (2) facilitarle al humano elegir/llenar campos. NO dictan cómo se
 *    interpreta un dato real.
 *  - Los FIELD TYPES son los que tienen SHAPE. El shape del dato manda.
 *  - El modelo decide el tipo según la realidad: si un "Partido" existe como item del
 *    Codex → ref con UUID real; si no → string. El backend valida/normaliza el shape
 *    antes de guardar para que nunca entre basura a la DB.
 *
 * Este módulo será, en Fase 3, servido al frontend vía GET /api/codex/schema para
 * eliminar la duplicación del catálogo (hoy vive también en ThePulse/CodexPage.tsx).
 */

// Los 25 tipos de dato base. Estos SÍ son normativos: definen el shape del valor.
// (Los presets, en cambio, son solo guías de vocabulario — ver cabecera.)
const CODEX_FIELD_TYPES = [
  'texto', 'parrafo', 'numero', 'moneda', 'porcentaje',
  'fecha', 'rango', 'hora', 'booleano', 'dropdown',
  'tags', 'escala', 'ref', 'refs', 'id',
  'link', 'email', 'telefono', 'archivo', 'imagen',
  'geo', 'color', 'formula', 'eje', 'repetible',
];

// Taxonomía normativa del contrato. Los auxiliares siguen persistidos en la
// columna tipo, pero no se presentan ni se cuentan como items oficiales.
// Simulacion es un recurso operativo y por eso no vive en codex_universe_items.
const UNIVERSE_ITEM_TYPES = Object.freeze([
  'Actor', 'Entidad', 'Territorio', 'Evento',
  'Historia', 'Objeto', 'Artefacto', 'Source',
]);
const AUXILIARY_CONTENT_TYPES = Object.freeze(['Post', 'Snippet']);
const RESOURCE_TYPES = Object.freeze(['Simulacion']);
const STORAGE_TYPES = Object.freeze([
  ...UNIVERSE_ITEM_TYPES,
  ...AUXILIARY_CONTENT_TYPES,
]);

const TYPE_PRESENTATION = Object.freeze({
  Source: Object.freeze({
    card: 'source',
    createModal: 'source',
    detailModal: 'source',
    primaryAction: 'cite',
  }),
  Post: Object.freeze({ card: 'post', createModal: null, detailModal: 'post' }),
  Snippet: Object.freeze({ card: 'snippet', createModal: 'snippet', detailModal: 'snippet' }),
  Simulacion: Object.freeze({
    card: 'simulation',
    createModal: 'simulation',
    detailModal: 'simulation',
    primaryAction: 'run',
  }),
});

function getTypeDefinition(rawTipo) {
  if (!rawTipo || typeof rawTipo !== 'string') return null;
  const requested = rawTipo.trim().toLowerCase();
  const storageType = STORAGE_TYPES.find((tipo) => tipo.toLowerCase() === requested);
  const resourceType = RESOURCE_TYPES.find((tipo) => tipo.toLowerCase() === requested);
  const tipo = storageType || resourceType;
  if (!tipo) return null;
  const typeClass = UNIVERSE_ITEM_TYPES.includes(tipo)
    ? 'official_item'
    : AUXILIARY_CONTENT_TYPES.includes(tipo)
      ? 'auxiliary'
      : 'resource';
  return {
    tipo,
    typeClass,
    isOfficialItem: typeClass === 'official_item',
    storedInTipo: Boolean(storageType),
    presentation: TYPE_PRESENTATION[tipo] || {
      card: 'item',
      createModal: 'item',
      detailModal: 'item',
    },
  };
}

// ─── Catálogo de presets por tipo de item (portado de ThePulse/CodexPage.tsx) ───
const CODEX_PRESETS = {
  Actor: [
    { label: 'Rol / función', type: 'texto' },
    { label: 'Afiliación', type: 'ref' },
    { label: 'Estado', type: 'dropdown', options: ['Activo', 'Inactivo', 'Retirado', 'Fallecido'] },
    { label: 'Fecha clave', type: 'fecha' },
    { label: 'Nivel de relevancia', type: 'escala' },
    { label: 'Identificador', type: 'id' },
    { label: 'Cargo', type: 'texto' },
    { label: 'Partido', type: 'ref' },
    { label: 'Nacionalidad', type: 'dropdown', options: ['Guatemala', 'México', 'EE.UU.', 'España', 'Otra'] },
    { label: 'Patrimonio declarado', type: 'parrafo' },
    { label: 'Situación legal', type: 'parrafo' },
    // Es un espectro, no prosa. Poles Izquierda/Derecha en vez del viejo
    // Oposición/Oficialismo, que era un eje conceptualmente malo: mide relación
    // con el gobierno de turno, no ideología — dos actores ideológicamente
    // opuestos caían ambos en "Oficialismo".
    { label: 'Sesgo / posición', type: 'eje', poles: ['Izquierda', 'Derecha'] },
    { label: 'Dirección', type: 'geo' },
    { label: 'Profesión', type: 'texto' },
    { label: 'Fecha de nacimiento', type: 'fecha' },
    { label: 'Lugar de residencia', type: 'ref' },
    { label: 'Periodo activo', type: 'rango' },
    { label: 'Vínculos familiares', type: 'refs' },
    { label: 'Eje económico', type: 'eje', poles: ['Estatista', 'Mercado'] },
    { label: 'Eje social', type: 'eje', poles: ['Conservador', 'Progresista'] },
    { label: 'Confiabilidad como fuente', type: 'escala' },
    { label: 'Idiomas', type: 'tags' },
    { label: 'Foto', type: 'imagen' },
    { label: 'Email', type: 'email' },
    { label: 'Teléfono', type: 'telefono' },
  ],
  Entidad: [
    { label: 'Tipo', type: 'dropdown', options: ['Pública', 'Privada', 'Mixta', 'Internacional', 'Informal'] },
    { label: 'Ámbito o sector', type: 'dropdown', options: ['Político', 'Económico', 'Judicial', 'Social', 'Militar', 'Religioso'] },
    { label: 'Estado', type: 'dropdown', options: ['Vigente', 'Disuelta', 'Intervenida', 'Suspendida'] },
    { label: 'Representante', type: 'ref' },
    { label: 'Cargos', type: 'repetible', cols: ['Cargo', 'Período', 'Institución'] },
    { label: 'Jurisdicción / alcance', type: 'texto' },
    { label: 'Capital / presupuesto', type: 'moneda' },
    { label: 'Sanciones', type: 'parrafo' },
    { label: 'Contratos', type: 'refs' },
    { label: 'Beneficiario final', type: 'ref' },
    { label: 'Sitio web', type: 'link' },
    { label: 'Fecha de fundación', type: 'fecha' },
    { label: 'Casa matriz', type: 'ref' },
    { label: 'Tamaño (miembros)', type: 'numero' },
    { label: 'Industria', type: 'dropdown', options: ['Servicios', 'Industria', 'Comercio', 'Tecnología', 'Finanzas', 'Agro'] },
    { label: 'Competidores', type: 'refs' },
    { label: 'Vigencia', type: 'rango' },
    { label: 'Cumplimiento', type: 'porcentaje' },
    { label: 'Reputación', type: 'escala' },
    { label: 'Posición sectorial', type: 'parrafo' },
    { label: 'Dirección', type: 'geo' },
    { label: 'Logo / símbolo', type: 'imagen' },
    { label: 'Email institucional', type: 'email' },
    { label: 'Teléfono', type: 'telefono' },
  ],
  Artefacto: [
    { label: 'Tipo', type: 'dropdown', options: ['Sistema', 'Herramienta', 'Software', 'Método', 'Estrategia', 'Infraestructura'] },
    { label: 'Propósito / función', type: 'parrafo' },
    { label: 'Autor o dueño', type: 'ref' },
    { label: 'Estado', type: 'dropdown', options: ['Activo', 'Obsoleto', 'En desarrollo'] },
    { label: 'Referencia o enlace', type: 'link' },
    { label: 'Proveedor', type: 'ref' },
    { label: 'Datos que procesa', type: 'parrafo' },
    { label: 'Vulnerabilidades', type: 'parrafo' },
    { label: 'Costo', type: 'moneda' },
    { label: 'Versión', type: 'texto' },
    { label: 'Fecha de adquisición', type: 'fecha' },
    { label: 'Acceso', type: 'dropdown', options: ['Público', 'Restringido'] },
    { label: 'Efectividad', type: 'escala' },
    { label: 'Riesgo asociado', type: 'eje', poles: ['Bajo', 'Alto'] },
    { label: 'Vigencia', type: 'rango' },
    { label: 'Presupuesto', type: 'moneda' },
    { label: 'Documentación', type: 'archivo' },
  ],
  Evento: [
    { label: 'Periodo', type: 'rango' },
    { label: 'Lugar', type: 'ref' },
    { label: 'Categoría', type: 'dropdown', options: ['Político', 'Legal', 'Crisis', 'Económico', 'Social'] },
    { label: 'Estado', type: 'dropdown', options: ['Ocurrido', 'Pendiente', 'En curso'] },
    { label: 'Resultado / desenlace', type: 'parrafo' },
    { label: 'Hora / duración', type: 'hora' },
    { label: 'Involucrados', type: 'refs' },
    { label: 'Fuente', type: 'ref' },
    { label: 'Monto involucrado', type: 'moneda' },
    { label: 'Identificador', type: 'id' },
    { label: 'Impacto', type: 'escala' },
    { label: 'Cobertura mediática', type: 'porcentaje' },
    { label: 'Capa narrativa', type: 'dropdown', options: ['Principal', 'Secundaria', 'Contexto'] },
    { label: 'Antecedente', type: 'ref' },
    { label: 'Consecuencia', type: 'ref' },
    { label: 'Geolocalización', type: 'geo' },
    { label: 'Adjuntos', type: 'archivo' },
  ],
  Objeto: [
    { label: 'Tipo', type: 'dropdown', options: ['Documento', 'Audio', 'Video', 'Foto', 'Dato', 'Objeto físico'] },
    { label: 'Origen', type: 'ref' },
    { label: 'Fecha', type: 'fecha' },
    { label: 'Estado de verificación', type: 'dropdown', options: ['Verificado', 'Sin verificar', 'Desmentido'] },
    { label: 'Archivo', type: 'archivo' },
    // Era 'texto' — chocaba con la 'Fuente' ref de Evento. Unificado a ref: si la
    // fuente existe en el Codex se referencia, si no se escribe como texto (el
    // fallback ref→texto ya existe en normalizeDetails y en el render).
    { label: 'Fuente', type: 'ref' },
    { label: 'Cadena de custodia', type: 'parrafo' },
    { label: 'Confidencialidad', type: 'dropdown', options: ['Público', 'Reservado', 'Filtrado'] },
    { label: 'Fecha del contenido', type: 'fecha' },
    { label: 'Hash / identificador', type: 'id' },
    { label: 'Transcripción', type: 'parrafo' },
    { label: 'URL original', type: 'link' },
    { label: 'Significancia', type: 'escala' },
    { label: 'Aparece en', type: 'refs' },
    { label: 'Autoría', type: 'ref' },
    { label: 'Vista previa', type: 'imagen' },
  ],
  Territorio: [
    { label: 'Tipo / escala', type: 'dropdown', options: ['País', 'Departamento', 'Municipio', 'Zona', 'Lugar'] },
    { label: 'Ámbito', type: 'texto' },
    { label: 'Referencia geográfica', type: 'geo' },
    { label: 'País', type: 'dropdown', options: ['Guatemala', 'México', 'El Salvador', 'Honduras', 'Belice'] },
    { label: 'Tipo de control', type: 'dropdown', options: ['Político', 'Criminal', 'Económico', 'Militar'] },
    { label: 'Quién controla', type: 'ref' },
    { label: 'Departamento', type: 'texto' },
    { label: 'Municipio', type: 'texto' },
    { label: 'Población', type: 'numero' },
    { label: 'Coordenadas GPS', type: 'geo' },
    { label: 'Mapa / GeoJSON', type: 'archivo' },
    { label: 'Vigencia del control', type: 'rango' },
    { label: 'Nivel de cobertura', type: 'porcentaje' },
    { label: 'Densidad de actividad', type: 'escala' },
    { label: 'Imagen / satélite', type: 'imagen' },
  ],
  Historia: [
    { label: 'Tipo de marco', type: 'dropdown', options: ['Ley', 'Sistema', 'Antecedente', 'Narrativa', 'Concepto'] },
    { label: 'Periodo', type: 'rango' },
    { label: 'Fuentes', type: 'parrafo' },
    { label: 'Relevancia', type: 'parrafo' },
    { label: 'Marco asociado', type: 'ref' },
    { label: 'Antecedente narrativo', type: 'parrafo' },
    { label: 'Línea de tiempo asociada', type: 'ref' },
    { label: 'Términos clave', type: 'tags' },
    { label: 'Resumen', type: 'parrafo' },
    // Era 'booleano' — chocaba con la 'Vigencia' rango de Entidad/Artefacto.
    // Un label = un tipo en todo el catálogo. El rango además dice más: cuándo
    // entró en vigor y hasta cuándo (to abierto = sigue vigente).
    { label: 'Vigencia', type: 'rango' },
    { label: 'Posición ideológica', type: 'eje', poles: ['Izquierda', 'Derecha'] },
    { label: 'Importancia', type: 'escala' },
    { label: 'Documento fuente', type: 'archivo' },
    { label: 'Enlace oficial', type: 'link' },
  ],
  Source: [
    { field_key: 'sys_source_kind', label: 'Tipo de fuente', type: 'dropdown', options: ['Persona', 'Web', 'Archivo', 'Libro', 'Documento', 'Dataset', 'Entrevista', 'Publicación', 'Otra'] },
    { field_key: 'sys_source_represented_item', label: 'Item representado', type: 'ref' },
    { field_key: 'sys_source_authors', label: 'Autores', type: 'refs' },
    { field_key: 'sys_source_publisher', label: 'Editorial / medio', type: 'ref' },
    { field_key: 'sys_source_published_at', label: 'Fecha de publicación', type: 'fecha' },
    { field_key: 'sys_source_accessed_at', label: 'Fecha de consulta', type: 'fecha' },
    { field_key: 'sys_source_url', label: 'URL de la fuente', type: 'link' },
    { field_key: 'sys_source_file', label: 'Archivo del Codex', type: 'archivo' },
    { field_key: 'sys_source_identifier', label: 'ISBN / DOI / identificador', type: 'id' },
    { field_key: 'sys_source_languages', label: 'Idiomas de la fuente', type: 'tags' },
    { field_key: 'sys_source_citation', label: 'Cita sugerida', type: 'parrafo' },
    { field_key: 'sys_source_citation_style', label: 'Estilo de cita', type: 'dropdown', options: ['APA', 'MLA', 'Chicago', 'Institucional', 'Personalizado'] },
    { field_key: 'sys_source_locator', label: 'Página / sección / localizador', type: 'texto' },
    { field_key: 'sys_source_excerpt', label: 'Fragmento relevante', type: 'parrafo' },
    { field_key: 'sys_source_verification_status', label: 'Estado de verificación', type: 'dropdown', options: ['Verificada', 'Parcial', 'Pendiente', 'Descartada'] },
    { field_key: 'sys_source_reliability', label: 'Confiabilidad', type: 'escala' },
    { field_key: 'sys_source_confidentiality', label: 'Confidencialidad de la fuente', type: 'dropdown', options: ['Pública', 'Reservada', 'Confidencial', 'Anónima'] },
    { field_key: 'sys_source_notes', label: 'Notas de la fuente', type: 'parrafo' },
  ],
  // ── Informales ────────────────────────────────────────────────────────────
  // Snippet: párrafo libre + clasificación; el resto son campos opt-in.
  Snippet: [
    { label: 'Contenido', type: 'parrafo' },
    { label: 'Clasificación', type: 'tags' },
    // Renombrado desde 'Fuente' (que es ref en Evento/Objeto): acá el dato es
    // genuinamente una URL, así que en vez de forzarle el tipo ajeno se le da un
    // label propio y preciso. Precedente: "Enlace oficial" en Historia.
    { label: 'Enlace de origen', type: 'link' },
    { label: 'Fecha de captura', type: 'fecha' },
  ],
  // Post: ficha de solo lectura (transcripción + título + autor). Solo el nombre se edita.
  Post: [
    { label: 'Título del post', type: 'texto', readonly: true },
    { label: 'Autor', type: 'texto', readonly: true },
    { label: 'Transcripción', type: 'parrafo', readonly: true },
  ],
};

// Campos oficiales que pertenecen a una modalidad del item, no al preset base.
// Perfil sigue siendo Actor en almacenamiento; estos campos solo aparecen al
// aplicar sys_profile_actor o consultar un Actor con is_profile=true.
const CODEX_EXTRA_FIELDS = {
  Actor: [
    { field_key: 'sys_actor_profile_target', label: '¿A quién representa?', type: 'texto' },
    { field_key: 'sys_actor_profile_goal', label: '¿Qué quieres entender?', type: 'parrafo' },
    { field_key: 'sys_actor_profile_known', label: '¿Qué sabes de este perfil?', type: 'parrafo' },
    { field_key: 'sys_actor_profile_age_min', label: 'Edad mínima aproximada', type: 'numero' },
    { field_key: 'sys_actor_profile_age_max', label: 'Edad máxima aproximada', type: 'numero' },
    { field_key: 'sys_actor_profile_territories', label: 'Territorios relacionados', type: 'refs' },
    { field_key: 'sys_actor_profile_motivations', label: 'Motivaciones', type: 'tags' },
    { field_key: 'sys_actor_profile_concerns', label: 'Preocupaciones', type: 'tags' },
    { field_key: 'sys_actor_profile_habits', label: 'Hábitos', type: 'tags' },
    { field_key: 'sys_actor_profile_needs', label: 'Necesidades', type: 'tags' },
    { field_key: 'sys_actor_profile_sources', label: 'Fuentes que sustentan el perfil', type: 'refs' },
    { field_key: 'sys_actor_profile_assumptions', label: 'Supuestos', type: 'repetible', cols: ['Supuesto', 'Base', 'Confianza'] },
    { field_key: 'sys_actor_profile_uncertainties', label: 'Incertidumbres', type: 'repetible', cols: ['Incertidumbre', 'Impacto'] },
    { field_key: 'sys_actor_profile_reviewed_at', label: 'Fecha de revisión', type: 'fecha' },
  ],
};

// Identidad normativa de campos v4. El label sigue siendo presentación y puede
// localizarse; field_key es la clave estable que usan API, MCP y migraciones.
// Se añade programáticamente para mantener legible el catálogo.
function slugFieldPart(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 72);
}

function systemFieldKey(tipo, label) {
  return `sys_${slugFieldPart(tipo)}_${slugFieldPart(label)}`;
}

for (const [tipo, fields] of Object.entries(CODEX_PRESETS)) {
  for (const field of fields) {
    field.field_key = field.field_key || systemFieldKey(tipo, field.label);
  }
}
for (const [tipo, fields] of Object.entries(CODEX_EXTRA_FIELDS)) {
  for (const field of fields) {
    field.field_key = field.field_key || systemFieldKey(tipo, field.label);
  }
}

const CODEX_SPECIAL_PRESETS = Object.freeze([
  Object.freeze({
    preset_key: 'sys_profile_actor',
    label: 'Actor · Perfil',
    description: 'Representa un tipo de persona o grupo; no corresponde a una persona real.',
    item_types: ['Actor'],
    field_keys: CODEX_EXTRA_FIELDS.Actor.map((field) => field.field_key),
    applies_when: Object.freeze({ is_profile: true }),
  }),
]);

// Tipos legacy → tipo canónico del catálogo
const PRESET_TIPO_ALIAS = { Evidencia: 'Objeto', Biblioteca: 'Historia', Fuente: 'Source' };
const resolvePresetTipo = (tipo) => PRESET_TIPO_ALIAS[tipo] || tipo;

function getFieldsForTipo(tipo) {
  const canon = resolvePresetTipo(tipo);
  return [...(CODEX_PRESETS[canon] || []), ...(CODEX_EXTRA_FIELDS[canon] || [])];
}

// ─── Normalización de tipo al escribir ──────────────────────────────────────
// La DB tiene CHECK constraints estrictos:
//   tipo pertenece a STORAGE_TYPES (items oficiales + auxiliares persistidos)
// Un valor fuera de esa lista hace fallar TODO el insert con un error de Postgres
// que no le dice nada útil a quien llama. Estos mapas absorben las variantes
// razonables (español/inglés, minúsculas, sinónimos) en vez de rechazar.
// Alias de compatibilidad: los consumidores nuevos deben usar STORAGE_TYPES.
const TIPOS_VALIDOS = STORAGE_TYPES;

const TIPO_ALIAS = {
  // → Actor (personas)
  persona: 'Actor', personas: 'Actor', person: 'Actor', people: 'Actor', actor: 'Actor',
  individuo: 'Actor', funcionario: 'Actor', politico: 'Actor', 'político': 'Actor',
  // → Entidad (organizaciones)
  organizacion: 'Entidad', 'organización': 'Entidad', organization: 'Entidad', org: 'Entidad',
  empresa: 'Entidad', institucion: 'Entidad', 'institución': 'Entidad', partido: 'Entidad',
  entidad: 'Entidad', company: 'Entidad',
  // → Territorio (lugares)
  lugar: 'Territorio', lugares: 'Territorio', place: 'Territorio', location: 'Territorio',
  territorio: 'Territorio', geografia: 'Territorio', 'geografía': 'Territorio',
  municipio: 'Territorio', departamento: 'Territorio', pais: 'Territorio', 'país': 'Territorio',
  // → Historia (narrativas, marcos, conceptos)
  concepto: 'Historia', concept: 'Historia', tema: 'Historia', narrativa: 'Historia',
  historia: 'Historia', marco: 'Historia', ley: 'Historia', caso: 'Historia',
  // → Evento
  evento: 'Evento', event: 'Evento', suceso: 'Evento', hecho: 'Evento',
  // → Objeto (cosas, evidencia)
  objeto: 'Objeto', object: 'Objeto', evidencia: 'Objeto', documento: 'Objeto',
  expediente: 'Objeto', prueba: 'Objeto',
  // → Artefacto (creaciones digitales)
  artefacto: 'Artefacto', artifact: 'Artefacto', herramienta: 'Artefacto', sistema: 'Artefacto',
  // → Source (origen consultable/citable de información)
  source: 'Source', sources: 'Source', fuente: 'Source', fuentes: 'Source',
  cita: 'Source', citacion: 'Source', 'citación': 'Source',
  // → informales
  snippet: 'Snippet', nota: 'Snippet', fragmento: 'Snippet',
  post: 'Post', publicacion: 'Post', 'publicación': 'Post', tweet: 'Post',
};

/**
 * Normaliza el tipo de un universe_item al valor que acepta la constraint.
 * @returns {{ tipo: string|null, corregido: boolean }} tipo=null si no se pudo mapear.
 */
function normalizeTipo(raw) {
  if (!raw || typeof raw !== 'string') return { tipo: null, corregido: false };
  const t = raw.trim();
  if (TIPOS_VALIDOS.includes(t)) return { tipo: t, corregido: false };
  // Capitalización distinta ("actor", "ACTOR") → canónico
  const porCase = TIPOS_VALIDOS.find((v) => v.toLowerCase() === t.toLowerCase());
  if (porCase) return { tipo: porCase, corregido: true };
  const alias = TIPO_ALIAS[t.toLowerCase()];
  return alias ? { tipo: alias, corregido: true } : { tipo: null, corregido: false };
}

// Índice label→field por tipo (cacheado)
const _presetMapCache = {};
function getPresetMap(tipo) {
  const canon = resolvePresetTipo(tipo);
  if (_presetMapCache[canon]) return _presetMapCache[canon];
  const map = new Map();
  for (const f of getFieldsForTipo(canon)) {
    map.set(f.label, f);
    map.set(f.field_key, f);
  }
  _presetMapCache[canon] = map;
  return map;
}

// ─── Helpers de shape ───────────────────────────────────────────────────────
const onlyDigits = (s) => String(s).replace(/[^\d]/g, '');
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const isRefObj = (v) => v && typeof v === 'object' && !Array.isArray(v) && 'id' in v && 'name' in v && 'tipo' in v;

function detectCurrency(s) {
  const t = String(s).toLowerCase();
  if (/usd|\$|d[oó]lar/.test(t)) return 'USD';
  if (/eur|€/.test(t)) return 'EUR';
  return 'GTQ'; // default contexto Guatemala
}

// ─── Coacción por tipo (no destructiva: si no puede, deja el valor tal cual) ──
function coerceMoneda(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if ('amount' in value) return { amount: onlyDigits(value.amount) || String(value.amount), cur: value.cur || 'GTQ' };
    return value;
  }
  if (typeof value === 'number') return { amount: String(Math.round(value)), cur: 'GTQ' };
  if (typeof value === 'string') {
    const s = value.trim();
    const cleaned = s.replace(/(gtq|usd|eur|q|\$|€)/gi, '').trim();
    // Solo coaccionar si es "mayormente numérico" (dígitos + separadores). Evita
    // corromper montos cualitativos ("1.2 millones", "no declarado") → se dejan texto.
    if (/^[\d.,\s]+$/.test(cleaned) && /\d/.test(cleaned)) {
      return { amount: onlyDigits(cleaned), cur: detectCurrency(s) };
    }
    return s;
  }
  return value;
}

function coerceEje(value, field) {
  if (value && typeof value === 'object' && !Array.isArray(value) && typeof value.value === 'number') {
    return { value: clamp(Math.round(value.value), -100, 100), poles: value.poles || field.poles };
  }
  if (typeof value === 'number') return { value: clamp(Math.round(value), -100, 100), poles: field.poles };
  return value; // string → dejar (el frontend lo pinta seguro en modo lectura)
}

function coerceIntRange(value, lo, hi) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (Number.isFinite(n)) return clamp(Math.round(n), lo, hi);
  return value;
}

// porcentaje se GUARDA como decimal 0..1 (0.25 = 25%) — así lo lee el frontend
// (CxControl: muestra ×100, guarda ÷100). Si el modelo escribe el entero (25),
// se convierte. OJO: NO redondear a entero aquí — destruiría el dato (0.25 → 0).
function coercePorcentaje(value) {
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace('%', '').trim());
  if (!Number.isFinite(n)) return value;
  if (n > 1) return clamp(n / 100, 0, 1);  // el modelo escribió "25" en vez de 0.25
  return clamp(n, 0, 1);
}

function coerceNumero(value) {
  if (typeof value === 'number') return value;
  const n = parseFloat(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : value;
}

function coerceBool(value) {
  if (typeof value === 'boolean') return value;
  const t = String(value).toLowerCase().trim();
  if (['true', 'sí', 'si', 'yes', '1', 'vigente'].includes(t)) return true;
  if (['false', 'no', '0'].includes(t)) return false;
  return value;
}

function coerceTags(value) {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') return value.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  return value;
}

// ref-capaz con string → intenta upgrade a { id, name, tipo } vía lookup en el Codex.
// Si no hay match, deja el string (P4 — flujo normal: string por defecto, ref si matchea).
async function coerceRef(value, field, resolveRef) {
  if (isRefObj(value)) return value;
  if (typeof value === 'string' && value.trim() && resolveRef) {
    const hit = await Promise.resolve(resolveRef(value.trim(), field)).catch(() => null);
    if (hit && hit.id) return { id: hit.id, name: hit.name || value.trim(), tipo: hit.tipo || 'Actor' };
  }
  return typeof value === 'string' ? value.trim() : value;
}

async function coerceRefs(value, field, resolveRef) {
  let arr = value;
  if (typeof value === 'string') arr = value.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  if (!Array.isArray(arr)) return value;
  const out = [];
  for (const el of arr) {
    if (isRefObj(el)) { out.push(el); continue; }
    out.push(await coerceRef(el, field, resolveRef));
  }
  return out;
}

async function coerceValue(field, value, resolveRef) {
  if (value === null || value === undefined) return value;
  switch (field.type) {
    case 'ref': return coerceRef(value, field, resolveRef);
    case 'refs': return coerceRefs(value, field, resolveRef);
    case 'moneda': return coerceMoneda(value);
    case 'eje': return coerceEje(value, field);
    case 'escala': return coerceIntRange(value, 1, 5);
    case 'porcentaje': return coercePorcentaje(value);
    case 'numero': return coerceNumero(value);
    case 'booleano': return coerceBool(value);
    case 'tags': return coerceTags(value);
    // texto/parrafo/dropdown/fecha/rango/geo/link/email/… → se dejan tal cual;
    // el frontend ya renderiza el shape real de forma tolerante.
    default: return value;
  }
}

/**
 * Normaliza el objeto `details` que manda el modelo antes de guardarlo.
 * @param {object} details  — delta de details enviado por el modelo
 * @param {string} tipo     — tipo del item (Actor, Entidad, …)
 * @param {object} opts
 * @param {Function} [opts.resolveRef] — async (name, fieldDef) => {id,name,tipo}|null
 * @returns {Promise<object>} details normalizado (nuevo objeto; no muta el input)
 */
async function normalizeDetails(details, tipo, opts = {}) {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return details;
  const presetByLabel = getPresetMap(tipo);
  const resolveRef = opts.resolveRef;

  // Campos que el modelo creó fuera del preset. Declaran su propio tipo en
  // __cx_custom_fields__ [{label, type}] — el mismo mecanismo que usa el frontend.
  // Se validan con las MISMAS reglas de shape que los del preset: un campo creado
  // no es un campo de segunda, solo no estaba en la guía de vocabulario.
  const custom = new Map();
  const declarados = details.__cx_custom_fields__;
  if (Array.isArray(declarados)) {
    for (const cf of declarados) {
      if (cf && typeof cf.label === 'string' && typeof cf.type === 'string') {
        custom.set(cf.label, { label: cf.label, type: cf.type });
      }
    }
  }

  const out = {};
  for (const [key, value] of Object.entries(details)) {
    // flag fue retirado en v4. Las demás keys internas siguen siendo legacy.
    if (key === 'flag') continue;
    if (key === 'datasets' || key.startsWith('__')) { out[key] = value; continue; }
    // El preset tiene prioridad sobre una declaración custom con el mismo label.
    const field = presetByLabel.get(key) || custom.get(key);
    if (!field) { out[key] = value; continue; }
    try {
      out[key] = await coerceValue(field, value, resolveRef);
    } catch (_e) {
      out[key] = value; // ante cualquier fallo, no perder el dato
    }
  }
  return out;
}

// ─── Generación del prompt desde el schema ──────────────────────────────────
// El prompt de Vizta NO debe hardcodear qué label es de qué tipo: esa tabla se
// genera aquí desde CODEX_PRESETS. Antes vivía a mano en prompts.js y se
// desincronizaba del catálogo (ej. "Sesgo / posición" era eje en el prompt y
// parrafo en el schema → Vizta escribía un objeto donde el modal esperaba prosa).
//
// Aquí solo se declara la SEMÁNTICA de cada tipo (shape + regla). Qué campos usan
// cada tipo se deriva del catálogo, así no puede volver a desincronizarse.
const FIELD_TYPE_SPEC = {
  moneda: { shape: '{ amount: "2500000", cur: "GTQ" }', rule: 'amount SOLO dígitos (se permiten separadores de miles); cur = código ISO (GTQ, USD, EUR…).' },
  porcentaje: { shape: '0.25', rule: 'DECIMAL, nunca entero. 25% → 0.25 · 7% → 0.07 · 100% → 1. NUNCA escribas 25.' },
  eje: { shape: '{ value: 60 }', rule: 'value = entero -100..100. Los polos viven en la definición del campo y no se duplican en cada valor.' },
  rango: { shape: '{ from: "2020-01-01", to: "2023-12-31" }', rule: 'fechas ISO YYYY-MM-DD. Con granularidad parcial usa gran: { from:"2020", to:"2023", gran:"YYYY" } — gran ∈ "DD"|"MM"|"YYYY"|"decada"|"siglo".' },
  ref: { shape: '{ id: "UUID_REAL" }', rule: 'SOLO UUID real de una búsqueda previa. El servidor hidrata name y tipo al leer.' },
  refs: { shape: '[{ id }, ...]', rule: 'misma regla que ref, en lista.' },
  repetible: { shape: '{ rows: [["v1","v2","v3"], ...] }', rule: 'una fila por registro. Todas las filas llevan las columnas en el MISMO orden. Si el campo está en la guía, usá el orden que se indica ahí; si lo creás vos, definí el orden en la primera fila y respetalo en el resto.' },
  escala: { shape: '4', rule: 'entero 1-5.' },
  booleano: { shape: 'true', rule: 'boolean.' },
  numero: { shape: '1500000', rule: 'SOLO dígitos, nunca unidades ni texto ("45", jamás "45 años").' },
  tags: { shape: '["tag1","tag2"]', rule: 'una sola palabra por tag, nunca frases.' },
  dropdown: { shape: '"Activo"', rule: 'EXACTAMENTE una de las options del preset, nunca texto libre.' },
  geo: { shape: '{ lat: 14.6349, lng: -90.5069 }', rule: 'coordenadas dentro de details. NUNCA escribas la columna geo de nivel superior del item (esa la maneja el mapa).' },
  fecha: { shape: '"2024-03-15"', rule: 'ISO YYYY-MM-DD.' },
  hora: { shape: '"14:30"', rule: '24h, HH:MM.' },
  email: { shape: '"correo@dominio.gt"', rule: 'un solo email válido, nada más.' },
  link: { shape: '"https://…"', rule: 'una sola URL válida; NO mezcles varios datos en un campo.' },
  archivo: { shape: '{ id }', rule: 'referencia al item real del Codex; una URL externa usa link.' },
  imagen: { shape: '{ id }', rule: 'referencia al item real del Codex; una URL externa usa link.' },
};

// Tipos que se sirven como string plano — se agrupan en una sola línea del prompt.
const PLAIN_STRING_TYPES = ['texto', 'parrafo', 'telefono', 'id'];
const PROMPT_TYPE_ORDER = [
  'moneda', 'porcentaje', 'eje', 'rango', 'ref', 'refs', 'repetible', 'escala',
  'booleano', 'numero', 'tags', 'dropdown', 'geo', 'fecha', 'hora', 'email', 'link', 'archivo', 'imagen',
];
const TIPO_ORDER = UNIVERSE_ITEM_TYPES;

// Campos del catálogo que usan un tipo dado (dedup por label, primer match gana).
function fieldsUsingType(type) {
  const seen = new Map();
  for (const fields of [...Object.values(CODEX_PRESETS), ...Object.values(CODEX_EXTRA_FIELDS)]) {
    for (const f of fields) {
      if (f.type === type && !seen.has(f.label)) seen.set(f.label, f);
    }
  }
  return [...seen.values()];
}

function buildShapeTable() {
  const lines = [];
  for (const type of PROMPT_TYPE_ORDER) {
    const spec = FIELD_TYPE_SPEC[type];
    if (!spec) continue;
    const fields = fieldsUsingType(type);
    let campos = '';
    if (fields.length) {
      const rendered = fields.map((f) => {
        if (type === 'eje' && f.poles) return `${f.field_key} ("${f.label}": ${f.poles[0]}↔${f.poles[1]})`;
        if (type === 'repetible' && f.cols) return `${f.field_key} ("${f.label}": [${f.cols.join(', ')}])`;
        return `${f.field_key} ("${f.label}")`;
      });
      campos = ` — Campos: ${rendered.join(' · ')}`;
    }
    lines.push(`- ${type.padEnd(10)} → ${spec.shape}  ← ${spec.rule}${campos}`);
  }
  lines.push(`- ${PLAIN_STRING_TYPES.join(' / ')} → string`);
  lines.push('- color / formula → NUNCA escribas estos campos (los maneja el usuario / el frontend)');
  return lines.join('\n');
}

function buildCanonicalLabels() {
  return TIPO_ORDER
    .filter((t) => CODEX_PRESETS[t])
    .map((t) => `- ${t}: ${getFieldsForTipo(t).map((f) => `${f.field_key}="${f.label}"`).join(' | ')}`)
    .join('\n');
}

// Regla genérica de higiene de datos. Deliberadamente NO enumera campos: aplica a
// cualquier campo del catálogo y a los que el modelo cree. El servidor no
// autocorrige esto — se enseña el criterio, no se parchea caso por caso.
const REGLA_UN_CAMPO_UN_DATO = `### UN CAMPO = UN DATO

Cada campo tiene UN significado. No acumules varios hechos en uno solo — sobre todo
en los de texto, que no tienen shape que te frene:

  ✗ "Cargo": "Magistrada Titular CC — período 2026-2031"
  ✓ "Cargo": "Magistrada Titular CC"
    "Periodo activo": { "from": "2026", "to": "2031", "gran": "YYYY" }

  ✗ "Rol / función": "Diputado / Jefe de bloque / Secretario General (desde mayo 2025)"
  ✓ un campo repetible con una fila por cargo (ver "Podés crear campos" abajo)

Criterios que aplican a CUALQUIER campo, esté o no en la guía de labels:
- **Fechas, periodos y vigencias nunca van dentro de un campo de texto.** Van en el
  campo de tipo fecha o rango que corresponda.
- **Si un campo de texto corto se te va de una línea, estás mezclando datos.** Separalos.
- **Si tenés información que no encaja en ningún campo, no la metas a presión en el
  más parecido** — creá el campo que corresponde.
- Un campo vacío es mejor que un campo con el dato equivocado adentro: el vacío se
  llena después, el dato mal ubicado no se encuentra nunca.

### ATRIBUTO vs PROGRESIÓN — la distinción que más se rompe

Un item del Codex tiene dos clases de información y NO se mezclan:

**Atributos** (van en "details") — lo que la persona/entidad ES, de forma estable:
cargo, partido, profesión, nacionalidad, sesgo. Si mañana sigue siendo cierto sin
tener que explicar cuándo pasó, es un atributo.

**Progresiones** (van en su propia línea de tiempo, NO en details) — lo que hizo o
le pasó, en un momento puntual: designó a alguien, fue acusado, se pronunció,
renunció, le retiraron la inmunidad. Si necesita una fecha para tener sentido, es
una progresión.

  ✗ "Situación legal": "En 2023 el MP pidió retirarle la inmunidad por el caso USAC;
     en mayo 2026 designó a un nuevo Fiscal General; se pronunció el 20/07/2026..."
  ✓ "Cargo": "Presidente de la República"
    "Partido": ref al Movimiento Semilla
    + tres progresiones, una por hecho, cada una con su fecha

**La prueba:** si el dato lleva una fecha adentro, o narra algo que pasó, no va en
details — va como progresión. Los campos de texto de un actor describen a la
persona, no su historial.

Para escribirlas: codex action="add_progresion" con item_id + progresion
{ titulo, fecha, tipo, descripcion?, ref_id?, fuente? }. Una llamada por hecho —
no metas tres sucesos en un mismo titulo. Para leerlas: action="get_progresiones".

Si el hecho ya existe (o merece existir) como Evento o Snippet del Codex, creálo y
pasá su UUID en ref_id: la progresión queda apuntando al item que la documenta. Si
todavía no existe, la progresión funciona igual sin ref_id — no inventes un UUID.

### PODÉS CREAR CAMPOS

Los campos de abajo son una **guía de vocabulario, no una lista cerrada**. Antes de
crear otro, usa codex action="resolve_field" con label, tipo y field_type. Si no hay
coincidencia real, usa action="create_field" declarando field_key, field_label,
field_type y field_reason. Después escribe su valor en "fields" usando el field_key
aceptado por el servidor. No escribas definiciones dentro de details.

Antes de crear uno, fijate si algún label existente ya cubre el dato: crear "Puesto"
cuando ya existe "Cargo" fragmenta la base y rompe las agregaciones. Crear un campo es
correcto cuando el dato es genuinamente otro, no cuando te falta buscar bien.`;

/** Bloque completo de "CAMPOS ESTRUCTURADOS EN DETAILS" para el system prompt. */
function buildDetailsPromptSection() {
  return `Cuando crees o actualices un item del Codex, usa preferentemente "fields" con **field_key estable** y el shape correcto para cada field_type. "details" existe solo para compatibilidad legacy.

Lo que NO debés hacer es escribir una variante de un label que ya existe — "Puesto" cuando existe "Cargo", o la key en inglés. Eso fragmenta la base y rompe las agregaciones. Crear un campo NUEVO sí está permitido cuando el dato es genuinamente otro: ver "PODÉS CREAR CAMPOS" al final. Y nunca uses texto plano donde va un shape estructurado.

El frontend lee estos shapes LITERALMENTE: un shape mal escrito (o texto plano donde va estructura) rompe el control del modal. Respeta el tipo de cada campo:

${buildShapeTable()}

Campos canónicos por tipo. En v4 usa field_key como key; el label es presentación:
${buildCanonicalLabels()}

Regla de ref/refs/archivo/imagen: SOLO usa { id } si ya tienes el UUID real de una búsqueda previa con search_universe. NUNCA inventes UUIDs. El servidor hidrata nombre y tipo al leer.

${REGLA_UN_CAMPO_UN_DATO}`;
}

// Versión del schema. Súbela cuando cambie el catálogo para invalidar el caché
// del frontend (que lo consume vía GET /api/codex/schema).
// v4: field_key estable, catálogos personales, presets aplicables y validación
// estricta para escrituras v4. Los labels legacy siguen legibles durante el corte.
// v4.1: taxonomía separada, Source oficial y recursos operativos explícitos.
const SCHEMA_VERSION = '4.1';

module.exports = {
  SCHEMA_VERSION,
  CODEX_FIELD_TYPES,
  CODEX_PRESETS,
  CODEX_EXTRA_FIELDS,
  CODEX_SPECIAL_PRESETS,
  PRESET_TIPO_ALIAS,
  UNIVERSE_ITEM_TYPES,
  AUXILIARY_CONTENT_TYPES,
  RESOURCE_TYPES,
  STORAGE_TYPES,
  TYPE_PRESENTATION,
  TIPOS_VALIDOS,
  getTypeDefinition,
  resolvePresetTipo,
  slugFieldPart,
  systemFieldKey,
  getFieldsForTipo,
  getPresetMap,
  normalizeDetails,
  normalizeTipo,
  buildDetailsPromptSection,
};
