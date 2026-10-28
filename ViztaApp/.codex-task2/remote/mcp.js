const axios = require('axios');
const { processNitterContext } = require('./nitterContext');
const { processNitterProfile } = require('./nitterProfile'); // ✅ AGREGADO: Importar función completa con sentimiento
const {
  getUserProjects,
  getUserCodex,
  getProjectDecisions,
  searchUserCodex,
  getUserStats,
  saveNitterProfileTweets,
  getLatestTrends,
  getTrendingTweets
} = require('./supabaseData');
const {
  normalizeDetails,
  normalizeTipo,
  TIPOS_VALIDOS,
  STORAGE_TYPES,
  UNIVERSE_ITEM_TYPES,
  AUXILIARY_CONTENT_TYPES,
} = require('./codexSchema');
const {
  getMergedSchema,
  resolveField,
  createUserField,
  updateUserField,
  deactivateUserField,
  createUserPreset,
  updateUserPreset,
  deactivateUserPreset,
  prepareFieldPatch,
  applyPresetKeys,
  resolveItemFields,
} = require('./codexContractV4');
const {
  listSources,
  getSource,
  createSource,
  updateSource,
  citeSource,
  listProfiles,
  getProfile,
  createProfile,
  updateProfile,
} = require('./codexResourceService');
const { normalizeTerritoryGeo, summarizeTerritoryGeo } = require('./territoryGeo');
const territoryService = require('./territoryService');

// resolveRef: dado el nombre de una entidad ref-capaz (ej. un partido), busca si
// ya existe como item del Codex del usuario. Match exacto case-insensitive por
// name o alias. Devuelve { id, name, tipo } o null. Alimenta el upgrade string→ref
// de normalizeDetails (Fase 1 — Motor de data masiva / update codex).
function makeRefResolver(supabase, userId) {
  return async (name) => {
    if (!name || !supabase || !userId) return null;
    const { data } = await supabase
      .from('codex_universe_items')
      .select('id, name, tipo')
      .eq('user_id', userId)
      .ilike('name', name)
      .limit(1);
    if (data && data[0]) return { id: data[0].id, name: data[0].name, tipo: data[0].tipo };
    // fallback: buscar en aliases (contains)
    const { data: byAlias } = await supabase
      .from('codex_universe_items')
      .select('id, name, tipo')
      .eq('user_id', userId)
      .contains('aliases', [name])
      .limit(1);
    return byAlias && byAlias[0] ? { id: byAlias[0].id, name: byAlias[0].name, tipo: byAlias[0].tipo } : null;
  };
}

// Importar fetch para Node.js
let fetch;
try {
  fetch = require('node-fetch');
} catch (error) {
  // Fallback para Node.js 18+ que tiene fetch nativo
  fetch = global.fetch;
}

// ===================================================================
// MCP SERVICE - Micro Command Processor
// Orquestador central de herramientas para agentes IA
// ===================================================================

// Configuración de servicios externos
function getExtractorTUrl() {
  // Verificar variables de entorno específicas primero
  if (process.env.EXTRACTOR_T_URL) {
    return process.env.EXTRACTOR_T_URL;
  }

  // Detectar entorno automáticamente
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    // PRODUCCIÓN: Usar URL externa
    return process.env.EXTRACTORT_URL || 'https://api.standatpd.com';
  } else {
    // DESARROLLO: Usar contenedor local con IP del host
    return process.env.EXTRACTORT_LOCAL_URL || 'http://127.0.0.1:8000';
  }
}

const EXTRACTOR_T_URL = getExtractorTUrl();

// Log de configuración
console.log(`🔗 ExtractorT URL configurada (MCP): ${EXTRACTOR_T_URL}`);

/**
 * Mejora la expansión de términos usando Perplexity para contexto adicional
 * @param {string} originalQuery - Query original del usuario
 * @param {boolean} usePerplexity - Si usar Perplexity para mejorar la expansión
 * @returns {Promise<string>} - Query expandido con contexto de Perplexity
 */
async function enhanceSearchTermsWithPerplexity(originalQuery, usePerplexity = false) {
  try {
    if (!usePerplexity) {
      return expandSearchTerms(originalQuery);
    }

    console.log(`🔍 Mejorando expansión de términos con Perplexity: "${originalQuery}"`);

    const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

    if (!PERPLEXITY_API_KEY) {
      console.log('⚠️ PERPLEXITY_API_KEY no disponible, usando expansión básica');
      return expandSearchTerms(originalQuery);
    }

    // Obtener fecha actual
    const now = new Date();
    const currentMonth = now.toLocaleString('es-ES', { month: 'long' });
    const currentYear = now.getFullYear();

    const enhancementPrompt = `Analiza la consulta "${originalQuery}" y sugiere términos de búsqueda optimizados para Twitter/X en Guatemala.

**FECHA ACTUAL: ${currentDate}**
**CONTEXTO TEMPORAL: ${currentMonth} ${currentYear}, Guatemala**
**OBJETIVO: Optimizar búsqueda para obtener tweets RECIENTES y relevantes**

⚠️ FILTRO TEMPORAL CRÍTICO:
- SOLO incluye hashtags y términos que estén siendo usados en ${currentMonth} ${currentYear}
- Agrega modificadores temporales como "2025", "${currentMonth}", "actual", "ahora"
- Incluye hashtags que probablemente estén trending HOY

INSTRUCCIONES:
1. Si es sobre una persona, incluye variaciones de su nombre, apodos, cargos Y su estado ACTUAL en ${currentYear}
2. Si es sobre eventos, incluye hashtags probables CON fechas de ${currentMonth} ${currentYear}
3. Si es sobre temas políticos, incluye instituciones y términos oficiales CON contexto de ${currentYear}
4. Si es sobre deportes, incluye equipos, competencias y hashtags deportivos de la temporada ${currentYear}
5. Incluye términos en español que usan los guatemaltecos ACTUALMENTE
6. Considera abreviaciones comunes (GT, Guate, Chapin) con contexto temporal
7. Incluye hashtags que probablemente estén trending en ${currentMonth} ${currentYear}
8. AGREGA SIEMPRE modificadores temporales: "2025", "${currentMonth}", "actual", "reciente"

EJEMPLOS ACTUALIZADOS:
- "marcha del orgullo" → "Orgullo2025 OR MarchadelOrgullo OR Pride OR LGBTI OR diversidad OR #OrguIIoGt OR Orgullo${currentMonth} OR Pride2025 OR OrgulloActual"
- "presidente guatemala" → "BernardoArevalo OR presidente OR GobiernoGt OR CasaPresidencial OR PresidenciaGt OR Arevalo2025 OR GobiernoActual OR Presidente${currentMonth}"

Responde SOLO con los términos de búsqueda optimizados separados por "OR", sin explicaciones.`;

    const payload = {
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: `Eres un experto en optimización de búsquedas en redes sociales para Guatemala. 

Tu trabajo es convertir consultas generales en términos de búsqueda específicos que capturen las conversaciones reales de los guatemaltecos en Twitter/X.

Características:
- Conoces los apodos y nombres comunes usados en Guatemala
- Identificas hashtags que probablemente estén trending
- Incluyes variaciones de nombres oficiales vs populares
- Consideras el contexto temporal actual
- Usas operadores OR para máxima cobertura

FECHA ACTUAL: ${currentMonth} ${currentYear}
CONTEXTO: Guatemala`
        },
        {
          role: 'user',
          content: enhancementPrompt
        }
      ],
      temperature: 0.2,
      max_tokens: 200
    };

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const data = await response.json();
      if (data.choices && data.choices[0] && data.choices[0].message) {
        const enhancedTerms = data.choices[0].message.content.trim();
        console.log(`🚀 Términos mejorados con Perplexity: "${enhancedTerms}"`);
        return enhancedTerms;
      }
    }

    console.log('⚠️ Error con Perplexity, usando expansión básica');
    return expandSearchTerms(originalQuery);

  } catch (error) {
    console.error('❌ Error mejorando términos con Perplexity:', error);
    return expandSearchTerms(originalQuery);
  }
}

/**
 * Expansión inteligente de términos de búsqueda para Twitter
 * Convierte consultas generales en búsquedas estratégicas específicas
 */
function expandSearchTerms(originalQuery) {
  const query = originalQuery.toLowerCase().trim();

  // Diccionario de TÉRMINOS REALES que la gente usa en redes sociales guatemaltecas
  const expansions = {
    // Eventos y marchas - TÉRMINOS REALES
    'marcha del orgullo': 'orgullo OR "marcha del orgullo" OR pride OR lgbt OR diversidad OR #orgullogt OR marcha',
    'orgullo': 'orgullo OR "marcha del orgullo" OR pride OR lgbt OR diversidad OR #orgullogt',
    'pride': 'pride OR orgullo OR lgbt OR "marcha del orgullo" OR diversidad',

    // Política - TÉRMINOS REALES
    'elecciones': 'elecciones OR tse OR voto OR candidatos OR electoral OR votacion',
    'presidente': 'presidente OR "bernardo arevalo" OR gobierno OR presidencia',
    'gobierno': 'gobierno OR presidente OR "bernardo arevalo" OR presidencia OR ejecutivo',
    'congreso': 'congreso OR diputados OR legislativo OR plenaria OR bancada',

    // Economía - TÉRMINOS REALES
    'economia': 'economia OR inflacion OR empleo OR precios OR quetzal OR guatemala',
    'inflacion': 'inflacion OR precios OR carestia OR caro OR economia',
    'empleo': 'empleo OR trabajo OR desempleo OR oportunidades',

    // Deportes - TÉRMINOS REALES
    'futbol': 'futbol OR seleccion OR guatemala OR liga OR deporte',
    'seleccion': 'seleccion OR futbol OR guatemala OR bicolor OR deportes',

    // Seguridad - TÉRMINOS REALES
    'seguridad': 'seguridad OR violencia OR delincuencia OR pnc OR crimenes',
    'violencia': 'violencia OR delincuencia OR inseguridad OR crimenes OR seguridad',

    // Educación - TÉRMINOS REALES
    'educacion': 'educacion OR estudiantes OR maestros OR escuelas OR universidad',
    'universidad': 'universidad OR usac OR estudiantes OR educacion',

    // Salud - TÉRMINOS REALES
    'salud': 'salud OR hospitales OR medicos OR medicina OR enfermedad',
    'covid': 'covid OR coronavirus OR pandemia OR vacuna OR salud',

    // Cultura - TÉRMINOS REALES
    'cultura': 'cultura OR tradiciones OR guatemala OR arte OR festival',
    'musica': 'musica OR artista OR concierto OR cantante OR guatemala',

    // Minería - TÉRMINOS REALES
    'mineria': 'mineria OR mina OR minera OR extraccion OR "san rafael" OR resistencia',
    'mina': 'mina OR mineria OR minera OR extraccion OR resistencia',

    // Protestas - TÉRMINOS REALES  
    'protesta': 'protesta OR manifestacion OR marcha OR resistencia OR derecho',
    'manifestacion': 'manifestacion OR protesta OR marcha OR derecho OR resistencia',

    // Lugares específicos - TÉRMINOS REALES
    'izabal': 'izabal OR "puerto barrios" OR caribe OR guatemala',
    'antigua': 'antigua OR guatemala OR turismo OR colonial',
    'xela': 'xela OR quetzaltenango OR guatemala OR altiplano'
  };

  // Buscar coincidencias exactas primero
  for (const [key, expansion] of Object.entries(expansions)) {
    if (query.includes(key)) {
      console.log(`🎯 Expansión REAL encontrada: "${key}" → "${expansion}"`);
      return expansion;
    }
  }

  // Búsquedas por palabras clave con TÉRMINOS REALES
  const keywords = [
    // Política REAL
    { keys: ['bernardo', 'arevalo'], expansion: '"bernardo arevalo" OR presidente OR gobierno OR arevalo' },
    { keys: ['giammattei'], expansion: 'giammattei OR "alejandro giammattei" OR expresidente' },
    { keys: ['tse'], expansion: 'tse OR tribunal OR electoral OR elecciones OR voto' },
    { keys: ['mp', 'ministerio publico'], expansion: 'mp OR "ministerio publico" OR fiscalia OR justicia' },

    // Eventos REALES
    { keys: ['cervantino'], expansion: 'cervantino OR festival OR cultura OR antigua' },
    { keys: ['independencia'], expansion: 'independencia OR guatemala OR septiembre OR patria' },
    { keys: ['navidad'], expansion: 'navidad OR posadas OR diciembre OR fiestas' },

    // Ubicaciones REALES
    { keys: ['zona viva'], expansion: '"zona viva" OR zona10 OR guatemala OR restaurantes' },
    { keys: ['lago atitlan'], expansion: 'atitlan OR lago OR solola OR turismo' },

    // País
    { keys: ['guatemala'], expansion: 'guatemala OR guate OR chapin OR gt' },
    { keys: ['chapin'], expansion: 'chapin OR guatemala OR guate OR guatemalteco' },
  ];

  // Buscar palabras clave
  for (const keywordObj of keywords) {
    if (keywordObj.keys.some(keyword => query.includes(keyword))) {
      console.log(`🔍 Palabra clave REAL encontrada: ${keywordObj.keys.join('/')} → "${keywordObj.expansion}"`);
      return keywordObj.expansion;
    }
  }

  // FALLBACK INTELIGENTE: Solo agregar términos que realmente se usan
  // Si la query original ya tiene OR, no modificar
  if (originalQuery.includes(' OR ')) {
    console.log(`✅ Query ya optimizada con OR: "${originalQuery}"`);
    return originalQuery;
  }

  // Limpiar términos problemáticos antes de expandir
  let cleanedQuery = originalQuery;
  const problematicTerms = ['GT', 'game', 'gaming', 'gamer'];

  problematicTerms.forEach(term => {
    if (cleanedQuery.includes(term) && !cleanedQuery.toLowerCase().includes('guatemala')) {
      cleanedQuery = cleanedQuery.replace(new RegExp(`\\b${term}\\b`, 'gi'), '');
      console.log(`🧹 Removido término problemático: "${term}" → "${cleanedQuery}"`);
    }
  });

  // Para queries simples, agregar solo variaciones lógicas
  const words = cleanedQuery.split(' ').filter(word => word.length > 2);
  if (words.length === 1) {
    const word = words[0].toLowerCase();
    // Solo agregar "guatemala" si no es obvio que ya es guatemalteco
    const needsContext = !['guatemala', 'guate', 'chapin', 'gt'].some(geoTerm =>
      cleanedQuery.toLowerCase().includes(geoTerm)
    );

    if (needsContext) {
      const contextualQuery = `${cleanedQuery} OR ${cleanedQuery} guatemala`;
      console.log(`📍 Agregando contexto guatemalteco: "${cleanedQuery}" → "${contextualQuery}"`);
      return contextualQuery;
    }
  }

  // Si no necesita expansión, usar query limpia
  console.log(`✅ Query final: "${cleanedQuery}"`);
  // NUEVO: Para consultas con múltiples términos (>1 palabra) sin operadores OR,
  // convertir la búsqueda a un formato "palabra OR palabra" para imitar el
  // comportamiento palabra-por-palabra usado en la rutina de trending. Esto
  // incrementa la cobertura cuando el usuario envía frases largas.

  const tokens = cleanedQuery.split(/\s+/).filter(w => w.length > 2 && !w.startsWith('#'));

  if (tokens.length > 1 && !cleanedQuery.includes(' OR ')) {
    const orQuery = tokens.join(' OR ');
    const finalOrQuery = `${orQuery} Guatemala`;
    console.log(`🔀 Query convertida a formato OR palabra-por-palabra: "${finalOrQuery}"`);
    return finalOrQuery.trim();
  }

  return cleanedQuery.trim() || originalQuery;
}

/**
 * Optimiza límites de tweets basado en el tipo de consulta
 */
function optimizeTweetLimit(query, requestedLimit = 10) {
  const query_lower = query.toLowerCase();

  // Para análisis de sentimiento o temas controversiales, usar más tweets
  const needMoreTweets = [
    'sentimiento', 'opinion', 'que dicen', 'que piensan', 'reaccion',
    'politica', 'elecciones', 'gobierno', 'presidente', 'congreso',
    'protestas', 'marchas', 'manifestacion', 'crisis'
  ];

  if (needMoreTweets.some(term => query_lower.includes(term))) {
    return Math.max(requestedLimit, 20); // Mínimo 20 tweets para análisis completo
  }

  // Para consultas específicas, 15 tweets es suficiente
  return Math.max(requestedLimit, 15);
}

// ===================================================================
// VIZTA TOOLS v2.0 - Simplified Tool Structure
// Only 2 main tools: codex (user data + wiki) and search (Perplexity + Exa)
// ===================================================================

const AVAILABLE_TOOLS = {
  // ===================================================================
  // TOOL 1: CODEX - Unified access to user's Codex and Wiki
  // ===================================================================
  codex: {
    name: 'codex',
    description: 'Accede al Codex del usuario: ocho items oficiales (Actor, Entidad, Territorio, Evento, Historia, Objeto, Artefacto y Source), contenido auxiliar (Post y Snippet), campos/presets personales, citas y Perfiles (Actor con is_profile=true).',
    parameters: {
      action: {
        type: 'string',
        required: true,
        enum: [
          'search', 'get_items',
          'search_universe', 'get_universe_item', 'get_relations',
          'filter_universe', 'list_by_dataset', 'lookup_by_names', 'reconcile_dataset',
          'get_schema', 'resolve_field',
          'create_field', 'update_field', 'deactivate_field',
          'create_preset', 'update_preset', 'deactivate_preset',
          'search_sources', 'get_source', 'create_source', 'update_source', 'cite_source',
          'search_profiles', 'get_profile', 'create_profile', 'update_profile',
          'create_universe_item', 'update_universe_item',
          'add_relation', 'delete_relation', 'create_note',
          'add_progresion', 'get_progresiones', 'delete_progresion'
        ],
        description: "Acción a realizar. READ: search, get_items, search_universe, get_universe_item, get_relations, get_progresiones. BULK READ (devuelve solo id+name+tipo+tags+campos clave — no detalle completo, para no explotar contexto): filter_universe (filtrar por tipo/tags/details), list_by_dataset (todos los items de un dataset), lookup_by_names (buscar por lista exacta de nombres). AGREGACIÓN/RECONCILIACIÓN: reconcile_dataset (responde '¿están todos los X del dataset mapeados?' — hace el JOIN dataset↔codex y devuelve conteos, faltantes y facetas en UNA llamada). WRITE: create_universe_item, update_universe_item, add_relation, delete_relation, create_note (guarda texto libre como Snippet), add_progresion / delete_progresion (línea de tiempo del item: qué hizo o qué le pasó, con fecha — NO va en details)"
      },
      query: {
        type: 'string',
        required: false,
        description: 'Término de búsqueda (para search, search_universe)'
      },
      item_ids: {
        type: 'array',
        required: false,
        description: 'IDs específicos de items del Codex (para get_items)',
        items: { type: 'string' }
      },
      item_id: {
        type: 'string',
        required: false,
        description: 'UUID del item del universo (para get_universe_item, update_universe_item)'
      },
      relation_id: {
        type: 'string',
        required: false,
        description: 'UUID de la relación (para delete_relation)'
      },
      tipo: {
        type: 'string',
        required: false,
        enum: [...STORAGE_TYPES],
        description: 'Filtrar por tipo persistido. Incluye items oficiales y contenido auxiliar.'
      },
      name: {
        type: 'string',
        required: false,
        description: 'Nombre del item (para create_universe_item)'
      },
      description: {
        type: 'string',
        required: false,
        description: 'Descripción del item'
      },
      content: {
        type: 'string',
        required: false,
        description: 'Texto/cuerpo de la nota o snippet a guardar (para create_note)'
      },
      field_key: { type: 'string', required: false, description: 'Clave estable de catálogo. Resolver antes con action=resolve_field.' },
      field_label: { type: 'string', required: false, description: 'Label visible del campo; no se usa como identidad.' },
      field_type: { type: 'string', required: false, enum: ['texto','parrafo','numero','moneda','porcentaje','fecha','rango','hora','booleano','dropdown','tags','escala','ref','refs','id','link','email','telefono','archivo','imagen','geo','color','formula','eje','repetible'], description: 'Tipo normativo del campo.' },
      field_reason: { type: 'string', required: false, description: 'Motivo obligatorio al crear un campo desde el agente.' },
      item_types: { type: 'array', required: false, items: { type: 'string' }, description: 'Tipos del Codex donde aplica el campo o preset.' },
      config: { type: 'object', required: false, description: 'Configuración tipada: options, poles o cols según field_type.' },
      fields: { type: 'object', required: false, description: 'Valores keyed por field_key. El backend valida estrictamente el shape; si falla, corrige el payload y reintenta.' },
      preset_key: { type: 'string', required: false, description: 'Clave del preset personalizado a crear.' },
      preset_keys: { type: 'array', required: false, items: { type: 'string' }, description: 'Presets aplicados al item. Un item puede tener varios.' },
      field_keys: { type: 'array', required: false, items: { type: 'string' }, description: 'Campos incluidos al crear o actualizar un preset.' },
      target: { type: 'string', required: false, description: 'Para Perfil: tipo de persona o grupo que representa.' },
      goal: { type: 'string', required: false, description: 'Para Perfil: qué se quiere entender.' },
      known: { type: 'string', required: false, description: 'Para Perfil: evidencia o conocimiento disponible.' },
      offset: { type: 'integer', required: false, description: 'Offset de paginación para search_sources/search_profiles.' },
      // ── Progresiones: línea de tiempo del item (add_progresion / get_progresiones / delete_progresion) ──
      progresion: {
        type: 'object',
        required: false,
        description: 'Entrada de la línea de tiempo del item (para add_progresion). Shape: { titulo, fecha?, descripcion?, tipo?, ref_id?, fuente? }.\n' +
          '  titulo      — qué pasó, en una línea y en pasado. Ej: "Designado Fiscal General del MP".\n' +
          '  fecha       — "2026-05-05" o parcial "2026-05" / "2026". Ponela siempre que la sepas: sin fecha la progresión no ordena.\n' +
          '  descripcion — contexto adicional, opcional.\n' +
          '  tipo        — accion (lo hizo él) | suceso (le pasó) | declaracion (lo dijo) | nombramiento (cambio de cargo) | legal (proceso judicial) | otro.\n' +
          '  ref_id      — UUID del Evento/Snippet/Objeto que documenta esto, si existe. Opcional: la progresión puede existir sin él.\n' +
          '  fuente      — medio o URL de donde salió el dato.',
      },
      progresion_id: { type: 'string', required: false, description: 'UUID de la progresión (para delete_progresion).' },
      tags: {
        type: 'array',
        required: false,
        items: { type: 'string' },
        description: 'Etiquetas del item'
      },
      aliases: {
        type: 'array',
        required: false,
        items: { type: 'string' },
        description: 'Alias/nombres alternativos del item'
      },
      details: {
        type: 'object',
        required: false,
        description: 'LEGACY DE SOLO COMPATIBILIDAD. El agente NO debe enviar details. Usa fields keyed por field_key; primero action=resolve_field y, si no existe, action=create_field declarando field_key, field_label, field_type y field_reason.'
      },
      geo: {
        type: 'object',
        required: false,
        description: 'Contrato geográfico v2. Solo frontier admite hierarchy.level (entero 1..6) y postal_codes. area/route no admiten jerarquía ni códigos postales. location representa un POI y su frontier_membership se resuelve automáticamente por coordenadas. La jerarquía numérica es autoritativa; los nombres locales son etiquetas del perfil del país.'
      },
      subject_id: {
        type: 'string',
        required: false,
        description: 'UUID del item sujeto de la relación (para add_relation)'
      },
      object_id: {
        type: 'string',
        required: false,
        description: 'UUID del item objeto de la relación (para add_relation)'
      },
      verb: {
        type: 'string',
        required: false,
        description: 'Verbo de la relación (ej: "dirige", "es aliado de", "financia") (para add_relation)'
      },
      note: {
        type: 'string',
        required: false,
        description: 'Nota adicional sobre la relación'
      },
      date: {
        type: 'string',
        required: false,
        description: 'Fecha de la relación (formato YYYY-MM-DD)'
      },
      dataset_id: {
        type: 'string',
        required: false,
        description: 'ID del dataset (para search_universe, list_by_dataset). Filtra items vinculados a ese dataset.'
      },
      names: {
        type: 'array',
        required: false,
        items: { type: 'string' },
        description: 'Lista de nombres exactos (o aproximados) a buscar en el Codex (para lookup_by_names). Devuelve solo id+name+tipo+campos clave por cada match encontrado.'
      },
      filter_details: {
        type: 'object',
        required: false,
        description: 'Filtrar por campos dentro de details (para filter_universe). Ej: { "Partido": "UNE" } o { "Distrito": "Guatemala" }. Solo filtra por igualdad exacta de un campo.'
      },
      page: {
        type: 'integer',
        required: false,
        default: 1,
        description: 'Página de resultados (para list_by_dataset, base 1). Cada página devuelve hasta 50 items.'
      },
      limit: {
        type: 'integer',
        required: false,
        default: 10,
        min: 1,
        max: 200,
        description: 'Número máximo de resultados. Para bulk (filter_universe, list_by_dataset, lookup_by_names) el default es 50 y el máximo 200 — pero devuelven solo campos básicos para no explotar contexto.'
      }
    },
    service_endpoint: 'internal',
    service_url: 'internal',
    category: 'user_data',
    usage_credits: 1,
    features: [
      'Búsqueda unificada en Codex y Universo investigativo',
      `Acceso a ${UNIVERSE_ITEM_TYPES.length} tipos oficiales y ${AUXILIARY_CONTENT_TYPES.length} auxiliares persistidos`,
      'Lectura de detalles, menciones y relaciones de cada item',
      'Creación y actualización de items del universo',
      'Gestión de relaciones entre items (add/delete)',
      'Acceso a documentos, transcripciones y Wiki legacy'
    ]
  },

  // ===================================================================
  // TOOL: DATA_OPS - Motor de data masiva (operaciones POR REFERENCIA)
  // ===================================================================
  data_ops: {
    name: 'data_ops',
    description: 'Motor de operaciones sobre MUCHOS items a la vez SIN cargar la data al contexto. LEY: operas por REFERENCIA (describes la fuente, el servidor resuelve los ids y hace el trabajo) — NUNCA traes los items completos. Úsalo para: MOVER/ASIGNAR items a un espacio o proyecto, CONTAR/agrupar, y BUSCAR/filtrar devolviendo solo ids+campos mínimos. NO uses search_universe para operar sobre listas grandes — usa data_ops. La fuente se describe con source_dataset_id / source_tipo / source_tags / source_filter (no necesitas traer los items antes).',
    parameters: {
      operation: {
        type: 'string', required: true,
        enum: ['assign', 'count', 'find'],
        description: 'assign = mover/asignar items de la fuente a un target (espacio o proyecto), devuelve solo el count. count = agregar/agrupar la fuente, devuelve solo números. find = filtrar la fuente, devuelve solo ids + campos mínimos (capado).'
      },
      // ── Fuente (por referencia — describe QUÉ, no trae la data) ──
      source_dataset_id: { type: 'string', required: false, description: 'UUID del dataset del que provienen los items (ej. el dataset "Congreso de Guatemala"). Resuelve todos los items vinculados a ese dataset.' },
      source_tipo: { type: 'string', required: false, enum: [...STORAGE_TYPES], description: 'Filtrar la fuente por tipo persistido.' },
      source_tags: { type: 'array', required: false, items: { type: 'string' }, description: 'Filtrar la fuente por tags (debe contener todos).' },
      source_filter: { type: 'object', required: false, description: 'Filtrar la fuente por campos de details, ej: {"Partido":"UNE"} o {"Distrito":"Huehuetenango"}. Igualdad/substring case-insensitive.' },
      source_ids: { type: 'array', required: false, items: { type: 'string' }, description: 'Lista explícita de ids del codex (si ya los tienes). Alternativa a describir la fuente por filtros.' },
      // ── Destino (solo para assign) ──
      target_space: { type: 'string', required: false, description: 'Espacio destino (free_canvas): su id o nombre (ej. "Caso USAC"). Para operation=assign.' },
      target_project: { type: 'string', required: false, description: 'Proyecto destino: su id o nombre. Para operation=assign.' },
      // ── Agregación (solo para count) ──
      group_by: { type: 'string', required: false, description: 'Campo por el que agrupar el conteo (para operation=count). Puede ser "tipo" o un campo de details como "Partido", "Distrito", "Estado".' },
      // ── Límite (solo para find) ──
      limit: { type: 'integer', required: false, default: 50, min: 1, max: 500, description: 'Máximo de resultados para find (default 50, máx 500). Devuelve solo ids + campos mínimos.' }
    },
    service_endpoint: 'internal',
    service_url: 'internal',
    category: 'user_data',
    usage_credits: 1,
    features: [
      'Operaciones masivas por referencia (no cargan data al contexto)',
      'assign: mover items a espacios/proyectos server-side',
      'count: agregación/facetas sin traer items',
      'find: filtrado devolviendo solo ids + campos mínimos'
    ]
  },

  // ===================================================================
  // TOOL: SIMULAR — simulación multiagente "Oasis compartido"
  // El servidor lleva el estado (personas, red, propagación); TÚ eres el
  // cerebro de cada persona. Ver server/services/simulacion.js.
  // ===================================================================
  simular: {
    name: 'simular',
    description: 'Simulación multiagente persistente y reproducible. Puede usar Actores, Perfiles (Actor con is_profile=true), Sources y personas sintéticas. El servidor congela snapshots, genera una cola determinista por seed y avanza cada lote de forma atómica e idempotente. En cada respuesta interpreta SOLO las personas de turno; usa el turn_token devuelto al llamar actuar. Al completar, pide reporte y guarda el análisis.',
    parameters: {
      operation: {
        type: 'string', required: true,
        enum: ['crear', 'actuar', 'reporte', 'estado', 'listar', 'obtener', 'guardar_analisis', 'archivar', 'cancelar'],
        description: 'crear/actuar/reporte/estado operan el motor. listar/obtener consultan ejecuciones persistidas. guardar_analisis conserva la interpretación final. archivar/cancelar cambian su estado.'
      },
      titulo: { type: 'string', required: false, description: 'Título legible. Si se omite, se deriva del escenario.' },
      escenario: { type: 'string', required: false, description: 'Hecho o situación concreta a la que reaccionan las personas. Requerido para crear.' },
      personas: {
        type: 'array', required: false,
        description: 'Participantes Codex y/o sintéticos. Ej: [{"fuente":"codex","ids":["uuid"]},{"fuente":"sintetica","n":30,"perfil":"votantes urbanos","etiqueta":"Votante"}]. Los Actores con is_profile=true se leen como Perfiles.',
        items: { type: 'object' }
      },
      turnos: { type: 'integer', required: false, default: 20, min: 1, max: 200, description: 'Turnos totales. Default 20.' },
      batch: { type: 'integer', required: false, default: 1, min: 1, max: 10, description: 'Personas por llamada. Default 1.' },
      seed: { type: 'string', required: false, description: 'Semilla reproducible. Con los mismos snapshots, config y seed se obtiene la misma cola.' },
      source_ids: { type: 'array', required: false, items: { type: 'string' }, description: 'Sources oficiales que fundamentan la simulación. También se adjuntan las Sources vinculadas a Perfiles participantes.' },
      context_item_ids: { type: 'array', required: false, items: { type: 'string' }, description: 'Items adicionales del Codex usados como contexto trazable.' },
      parent_simulation_id: { type: 'string', required: false, description: 'UUID de una simulación propia anterior para variantes o nuevas corridas.' },
      sim_id: { type: 'string', required: false, description: 'UUID requerido para actuar/reporte/estado/obtener/guardar_analisis/archivar/cancelar.' },
      turn_token: { type: 'string', required: false, description: 'Token del lote pendiente. En actuar permite avance idempotente y evita duplicar eventos.' },
      acciones: {
        type: 'array', required: false,
        description: 'Exactamente una acción por persona del lote: [{"persona_id":"p3","tipo":"publicar","texto":"..."}]. tipo: publicar | responder | amplificar | callar | otra. Para responder/amplificar, "a" usa el id lógico evt_N.',
        items: { type: 'object' }
      },
      analisis: { type: 'string', required: false, description: 'Interpretación final para guardar_analisis; separa evidencia simulada e inferencia.' },
      status: { type: 'string', required: false, enum: ['active', 'completed', 'failed', 'cancelled', 'archived'], description: 'Filtro para listar.' },
      limit: { type: 'integer', required: false, default: 50, min: 1, max: 100, description: 'Límite para listar.' }
    },
    service_endpoint: 'internal',
    service_url: 'internal',
    category: 'user_data',
    usage_credits: 1,
    features: [
      'Personas del Codex, sintéticas, o mezcla',
      'Perfiles y Sources con snapshots inmutables por ejecución',
      'Red por relaciones reales del Codex; si no hay, por afinidad',
      'Cola reproducible por seed y avance atómico con turn_token',
      'Persistencia consultable para la futura página de Simulaciones',
      'Métricas estructuradas de propagación y silencios'
    ]
  },

  // ===================================================================
  // TOOL: MAPA - Fronteras, Territorios (geo), Canvas/Lienzo y vínculos
  // ===================================================================
  mapa: {
    name: 'mapa',
    description: 'Acceso geográfico por usuario. frontier es el único modelo con jerarquía territorial 1..6 y códigos postales; area es un polígono temático sin jerarquía; location es un POI autocolgable a la frontier más profunda que cubra sus coordenadas; route es un recorrido. Los niveles son numéricos y sus nombres se resuelven por perfil de país.',
    parameters: {
      action: {
        type: 'string', required: true,
        enum: ['read_boundaries', 'read_territorios', 'read_poi_membership', 'read_canvas', 'create_territory', 'create_from_boundary', 'create_from_place', 'create_from_postal_code', 'attach_postal_code', 'update_territory_geo', 'link_canonical_boundary', 'draw', 'link_item'],
        description: 'READ: read_boundaries, read_territorios, read_poi_membership, read_canvas. WRITE: create_territory, create_from_boundary, create_from_place, create_from_postal_code, attach_postal_code, update_territory_geo, link_canonical_boundary, draw, link_item.'
      },
      level: {
        type: 'string', required: false,
        enum: ['pais', 'departamento', 'municipio', 'zona', 'distrito', 'region', 'provincia', 'estado', 'point', 'place'],
        description: 'Filtro legacy por designación textual. No determina la jerarquía; usa hierarchy_level para el contrato actual.'
      },
      hierarchy_level: { type: 'number', required: false, description: 'Nivel jerárquico autoritativo para frontier: entero 1..6. Los niveles 5 y 6 pueden omitirse.' },
      name: {
        type: 'string', required: false,
        description: 'Filtro por nombre (read_boundaries, read_territorios). Match parcial case-insensitive, ej: "Jutiapa".'
      },
      parent_id: {
        type: 'string', required: false,
        description: 'boundary_id del departamento padre para listar sus municipios (read_boundaries y read_territorios), ej: "dept_guatemala". En read_territorios devuelve los municipios-territorio de ese departamento.'
      },
      include_geometry: {
        type: 'boolean', required: false,
        description: 'Si true, incluye la geometría completa GeoJSON (read_boundaries/read_territorios). Default false (solo centroide + metadatos) para ahorrar tokens. Ponlo true cuando vayas a crear un territorio con esa geometría.'
      },
      spatial_role: { type: 'string', required: false, enum: ['frontier', 'area', 'location', 'route'], description: 'Significado territorial. frontier=límite; area=cobertura; location=pin/POI; route=recorrido.' },
      geo: { type: 'object', required: false, description: 'Contrato geo v2 para create_territory/update_territory_geo. Debe incluir geometry y spatial_role; source/curation se completan con defaults seguros.' },
      description: { type: 'string', required: false, description: 'Descripción del Territorio a crear.' },
      tags: { type: 'array', required: false, items: { type: 'string' }, description: 'Etiquetas del Territorio a crear.' },
      boundary_id: { type: 'string', required: false, description: 'ID de map_boundaries para create_from_boundary.' },
      adopt_geometry: { type: 'boolean', required: false, description: 'Para link_canonical_boundary: true adopta el polígono canónico; false conserva el shape del usuario y solo crea el vínculo verificado. Default false.' },
      lugar_id: { type: 'string', required: false, description: 'ID de map_lugares para create_from_place.' },
      external_id: { type: 'string', required: false, description: 'ID externo del resultado de Maps para create_from_place.' },
      provider: { type: 'string', required: false, description: 'Proveedor del POI externo, ej. apple_maps.' },
      lat: { type: 'number', required: false, description: 'Latitud para create_from_place sin lugar_id.' },
      lng: { type: 'number', required: false, description: 'Longitud para create_from_place sin lugar_id.' },
      category: { type: 'string', required: false, description: 'Categoría del POI convertido en Territorio.' },
      subtype: { type: 'string', required: false, description: 'Subtipo del POI convertido en Territorio.' },
      address: { type: 'string', required: false, description: 'Dirección del POI convertido en Territorio.' },
      phone: { type: 'string', required: false, description: 'Teléfono del POI convertido en Territorio.' },
      website: { type: 'string', required: false, description: 'Sitio web del POI convertido en Territorio.' },
      country_code: { type: 'string', required: false, description: 'Código ISO alpha-2 del país, requerido para resolver códigos postales.' },
      postal_code: { type: 'string', required: false, description: 'Código postal de una frontier o pista de dirección para un POI.' },
      postal_system: { type: 'string', required: false, description: 'Sistema postal, por ejemplo USPS_ZIP, US_CENSUS_ZCTA o GT_POSTAL.' },
      postal_relation: { type: 'string', required: false, enum: ['corresponds_to', 'contains', 'within', 'overlaps', 'delivery'], description: 'Relación entre la frontier y el código postal.' },
      // ── draw (lienzo) ──
      tool: {
        type: 'string', required: false,
        enum: ['brush', 'spray', 'line', 'rect', 'circle'],
        description: 'Tipo de trazo a dibujar (draw).'
      },
      coords: {
        type: 'array', required: false,
        items: { type: 'array', items: { type: 'number' } },
        description: 'Coordenadas del trazo como [[lat,lng], ...] (draw). brush/spray/line = ruta de puntos; rect = 2 esquinas; circle = 1 punto centro (usar radius_m).'
      },
      color: { type: 'string', required: false, description: 'Color hex del trazo, ej: "#e11d48" (draw). Default "#2563eb".' },
      size: { type: 'integer', required: false, description: 'Grosor del trazo en px (draw). Default 4.' },
      opacity: { type: 'number', required: false, description: 'Opacidad 0-1 (draw). Default 0.9.' },
      radius_m: { type: 'number', required: false, description: 'Radio en metros para circle (draw).' },
      // ── link_item ──
      target_id: { type: 'string', required: false, description: 'UUID del item destino que recibirá la referencia (link_item), normalmente un Territorio.' },
      item_id: { type: 'string', required: false, description: 'UUID del item del Codex para lectura, actualización, vínculo o código postal.' },
      key: { type: 'string', required: false, description: 'Etiqueta del vínculo, se usa como label en el tooltip del mapa, ej: "lider", "secretario", "candidato" (link_item).' },
      limit: { type: 'integer', required: false, default: 50, min: 1, max: 400, description: 'Máximo de resultados (read_*).' }
    },
    service_endpoint: 'internal',
    service_url: 'internal',
    category: 'user_data',
    usage_credits: 1,
    features: [
      'Lectura de fronteras administrativas (22 deptos, 343 munis, 21 zonas)',
      'Lectura de territorios del Codex con geometría y actores vinculados',
      'Lectura y escritura del lienzo de dibujo (canvasmap)',
      'Vinculación de items del Codex a territorios (aparecen en hover por nivel)'
    ]
  },

  // ===================================================================
  // TOOL: PLACES - Lugares/POIs: búsqueda Apple Maps + DB (map_lugares)
  // ===================================================================
  places: {
    name: 'places',
    description: 'Catálogo global de lugares/POIs. search busca en Apple Maps; read consulta map_lugares. save modifica el catálogo compartido y está reservado para administración. Para conservar un lugar como elemento personal usa mapa.create_from_place.',
    parameters: {
      action: {
        type: 'string', required: true,
        enum: ['search', 'read', 'save'],
        description: 'search = Apple Maps; read = catálogo global; save = curación administrativa del catálogo. Para el Codex del usuario: mapa.create_from_place.'
      },
      query: { type: 'string', required: false, description: 'Término de búsqueda (search, read), ej: "café en zona 10", "Oakland Mall", "hospital".' },
      lat: { type: 'number', required: false, description: 'Latitud del centro para sesgar la búsqueda (search). Default Ciudad de Guatemala.' },
      lng: { type: 'number', required: false, description: 'Longitud del centro para sesgar la búsqueda (search). Default Ciudad de Guatemala.' },
      category: { type: 'string', required: false, description: 'Filtro/valor de categoría del POI (read, save), ej: "tourism", "restaurant", "hospital".' },
      scope: { type: 'string', required: false, enum: ['ciudad', 'pais'], description: 'Ámbito del POI (read filtra, save asigna). Default "ciudad".' },
      // ── save ──
      name: { type: 'string', required: false, description: 'Nombre del lugar (save).' },
      lugar_id: { type: 'string', required: false, description: 'ID del POI (save). Si guardas un resultado de search, pasa su apple_id. Si se omite, se genera uno.' },
      subtype: { type: 'string', required: false, description: 'Subtipo específico del POI (save), ej: "motel", "private_guest_room".' },
      address: { type: 'string', required: false, description: 'Dirección del lugar (save).' },
      phone: { type: 'string', required: false, description: 'Teléfono (save).' },
      website: { type: 'string', required: false, description: 'Sitio web o red social (save).' },
      limit: { type: 'integer', required: false, default: 15, min: 1, max: 50, description: 'Máximo de resultados (search, read).' }
    },
    service_endpoint: 'internal',
    service_url: 'internal',
    category: 'user_data',
    usage_credits: 1,
    features: [
      'Búsqueda de lugares/POIs actualizados con Apple Maps (Guatemala)',
      'Lectura de POIs guardados en la base de datos (map_lugares)',
      'Guardado de nuevos POIs en la base de datos'
    ]
  },

  // ===================================================================
  // TOOL: WORKSPACE - Proyectos, Espacios (free_canvases) y Decisiones
  // ===================================================================
  workspace: {
    name: 'workspace',
    description: 'Gestiona el workspace del usuario: Proyectos, Espacios (lienzos de nodos donde agrupa y conecta actores) y Decisiones. Los espacios son MEMORIA DE TRABAJO: además de leerlos, se pueden buscar, relacionar entre sí y consultar su mapa sin volcarlos al contexto. El índice es literal y determinista — la interpretación la ponés vos.',
    parameters: {
      action: {
        type: 'string', required: true,
        enum: ['list_projects', 'create_project', 'list_spaces', 'create_space', 'read_space', 'add_note_to_space', 'add_item_to_space', 'list_decisions', 'create_decision', 'search_spaces', 'related_spaces', 'space_context', 'item_spaces'],
        description: 'READ: list_projects, list_spaces, list_decisions.\n' +
          '  space_context — de qué trata un espacio: sus items, cómo están conectados y las notas, SIN volcar el contenido completo. Empezá SIEMPRE por acá; read_space solo si de verdad necesitás el texto de cada ficha (puede ser enorme: un espacio de 160 items son ~240k caracteres).\n' +
          '  search_spaces — encontrar en qué espacio quedó algo. La búsqueda es LITERAL sobre el nombre del espacio, los nombres de sus actores, las etiquetas de las conexiones y las notas: usá nombres propios y términos concretos ("Consuelo Porras", "contralor"), no preguntas ("¿quién se postula?"). Devuelve el fragmento que coincidió para que juzgues vos si sirve; si no encuentra, reformulá con otro término o usá list_spaces.\n' +
          '  related_spaces — qué otros espacios tocan lo mismo. via="items" es la relación DURA (comparten actores concretos del Codex, es un hecho); via="terminos" es débil (solo comparten vocabulario en nombre/notas/etiquetas) — tratala como pista, no como conclusión.\n' +
          '  item_spaces — la pregunta inversa: en qué espacios del usuario aparece este actor. Pasá "item_id".\n' +
          'WRITE: create_project, create_space, add_note_to_space, add_item_to_space, create_decision.'
      },
      name: { type: 'string', required: false, description: 'Nombre (proyecto, espacio o decisión según la acción)' },
      space: { type: 'string', required: false, description: 'Nombre o ID del espacio (para read/add)' },
      project: { type: 'string', required: false, description: 'Nombre o ID del proyecto (para espacios/decisiones)' },
      title: { type: 'string', required: false, description: 'Título de la decisión (create_decision)' },
      description: { type: 'string', required: false, description: 'Descripción (proyecto o decisión)' },
      content: { type: 'string', required: false, description: 'Texto de la nota (add_note_to_space)' },
      item_id: { type: 'string', required: false, description: 'ID de un item del Codex/Universo (add_item_to_space)' },
      item_ids: { type: 'array', required: false, items: { type: 'string' }, description: 'IDs de varios items para agregar al espacio EN UNA sola llamada (add_item_to_space). Preferir esto sobre múltiples llamadas.' },
      color: { type: 'string', required: false, description: 'Color de la nota (yellow, green, blue, etc.)' },
      decision_type: { type: 'string', required: false, description: 'Tipo de decisión (enfoque, alcance, etc.)' },
      rationale: { type: 'string', required: false, description: 'Justificación de la decisión' },
      urgency: { type: 'string', required: false, description: 'low, medium, high' },
      tags: { type: 'array', required: false, items: { type: 'string' }, description: 'Etiquetas' },
      query: { type: 'string', required: false, description: 'Qué buscar, en lenguaje natural (search_spaces). Ej: "lo del contralor", "casos de corrupción municipal".' },
      limit: { type: 'integer', required: false, default: 5, min: 1, max: 20, description: 'Máximo de espacios a devolver (search_spaces, related_spaces).' }
    },
    service_endpoint: 'internal', service_url: 'internal', category: 'user_data', usage_credits: 1,
    features: ['Crear proyectos, espacios y decisiones', 'Buscar espacios por sentido y relacionarlos entre sí', 'Leer el mapa de un espacio sin volcar su contenido']
  },

  // ===================================================================
  // TOOL: CODEX_LIST_ITEMS - List codex_items with filters
  // ===================================================================
  codex_list_items: {
    name: 'codex_list_items',
    description: 'Lista items del Codex del usuario con filtros. Devuelve documentos, audios, videos, links guardados. Úsalo para buscar items por tipo, etiqueta, proyecto o texto libre.',
    parameters: {
      query: { type: 'string', required: false, description: 'Búsqueda de texto libre en título/descripción' },
      tipo: { type: 'string', required: false, description: 'Filtrar por tipo: documento, audio, video, enlace, pdf, excel, imagen, grabacion' },
      tags: { type: 'array', required: false, items: { type: 'string' }, description: 'Filtrar por etiquetas' },
      project_id: { type: 'string', required: false, description: 'UUID del proyecto para filtrar' },
      limit: { type: 'integer', required: false, default: 20, min: 1, max: 100, description: 'Máximo de resultados' }
    },
    service_endpoint: 'internal', service_url: 'internal', category: 'user_data', usage_credits: 1,
    features: ['Filtrado por tipo, tags, proyecto', 'Búsqueda fulltext en título y descripción']
  },

  // ===================================================================
  // TOOL: CODEX_UPDATE_ITEM - Update a codex_item (title, desc, tags)
  // ===================================================================
  codex_update_item: {
    name: 'codex_update_item',
    description: 'Actualiza un item del Codex: título, descripción, etiquetas, proyecto. Para renombrar, editar metadata de documentos/links/grabaciones guardadas.',
    parameters: {
      item_id: { type: 'string', required: true, description: 'UUID del codex_item a actualizar' },
      titulo: { type: 'string', required: false, description: 'Nuevo título' },
      descripcion: { type: 'string', required: false, description: 'Nueva descripción' },
      etiquetas: { type: 'array', required: false, items: { type: 'string' }, description: 'Nuevas etiquetas (reemplaza las actuales)' },
      proyecto: { type: 'string', required: false, description: 'Nombre del proyecto' }
    },
    service_endpoint: 'internal', service_url: 'internal', category: 'user_data', usage_credits: 1,
    features: ['Renombrar items', 'Editar etiquetas', 'Reasignar proyecto']
  },

  // ===================================================================
  // TOOL: CODEX_BULK_UPDATE - Apply changes to multiple items at once
  // ===================================================================
  codex_bulk_update: {
    name: 'codex_bulk_update',
    description: 'Aplica cambios a múltiples items del Codex o Universo a la vez. Puede renombrar, agregar etiquetas, o añadir/actualizar campos personalizados en lote.',
    parameters: {
      item_ids: { type: 'array', required: true, items: { type: 'string' }, description: 'Lista de UUIDs de items a actualizar' },
      item_type: { type: 'string', required: true, enum: ['codex_item', 'universe_item'], description: 'Tipo de item: codex_item o universe_item' },
      updates: {
        type: 'object', required: true,
        description: 'Objeto con los campos a actualizar. Para codex_item: {titulo, descripcion, etiquetas}. Para universe_item: {name, description, tags, fields}, donde fields usa field_key y validación v4.'
      }
    },
    service_endpoint: 'internal', service_url: 'internal', category: 'user_data', usage_credits: 2,
    features: ['Actualización masiva de items', 'Soporta codex_items y universe_items', 'Campos personalizados en lote']
  },

  // ===================================================================
  // TOOL: CODEX_CREATE_ITEM - Create a new codex_item
  // ===================================================================
  codex_create_item: {
    name: 'codex_create_item',
    description: 'Crea un nuevo item en el Codex del usuario (documento, enlace, nota, etc.). Úsalo para añadir nuevas entradas al Codex de forma programática.',
    parameters: {
      tipo: { type: 'string', required: true, description: 'Tipo del item: documento, enlace, nota, audio, video, pdf, imagen, grabacion' },
      titulo: { type: 'string', required: true, description: 'Título del nuevo item' },
      descripcion: { type: 'string', required: false, description: 'Descripción del item' },
      etiquetas: { type: 'array', required: false, items: { type: 'string' }, description: 'Etiquetas para clasificar el item' },
      proyecto: { type: 'string', required: false, description: 'Nombre del proyecto al que pertenece' },
      url: { type: 'string', required: false, description: 'URL del recurso (para tipo enlace)' },
      content: { type: 'string', required: false, description: 'Contenido textual del item (para notas/documentos)' }
    },
    service_endpoint: 'internal', service_url: 'internal', category: 'user_data', usage_credits: 1,
    features: ['Crear items de cualquier tipo', 'Soporte para todos los campos del Codex']
  },

  // ===================================================================
  // TOOL: CODEX_DELETE_ITEM - Delete a codex_item
  // ===================================================================
  codex_delete_item: {
    name: 'codex_delete_item',
    description: 'Elimina un item del Codex del usuario por su ID. Operación irreversible — el agente debe confirmar antes de ejecutar.',
    parameters: {
      item_id: { type: 'string', required: true, description: 'UUID del codex_item a eliminar' }
    },
    service_endpoint: 'internal', service_url: 'internal', category: 'user_data', usage_credits: 1,
    features: ['Eliminar items del Codex', 'Verificación de ownership antes de borrar']
  },

  // ===================================================================
  // TOOL: CODEX_CREATE_UNIVERSE_ITEM - Create a new universe item
  // ===================================================================
  codex_create_universe_item: {
    name: 'codex_create_universe_item',
    description: 'Crea un nuevo item en el Universo del Codex (actor, entidad, territorio, evento, etc.).',
    parameters: {
      // OJO: estos son los ÚNICOS valores que acepta la constraint de la DB.
      // Antes esta descripción decía "persona, organizacion, lugar, concepto, evento"
      // — ninguno válido — y todo insert fallaba con un error de Postgres.
      tipo: {
        type: 'string', required: true,
        enum: [...STORAGE_TYPES],
        description: 'Tipo persistido. Source es una fuente citable oficial. Post y Snippet son contenido auxiliar identificado en tipo.'
      },
      name: { type: 'string', required: true, description: 'Nombre del item del universo' },
      description: { type: 'string', required: false, description: 'Descripción del item' },
      tags: { type: 'array', required: false, items: { type: 'string' }, description: 'Etiquetas' },
      aliases: { type: 'array', required: false, items: { type: 'string' }, description: 'Nombres alternativos o alias' },
      fields: { type: 'object', required: false, description: 'Valores keyed por field_key del contrato v4; se validan estrictamente.' },
      preset_keys: { type: 'array', required: false, items: { type: 'string' }, description: 'Claves de presets aplicados al item.' }
    },
    service_endpoint: 'internal', service_url: 'internal', category: 'user_data', usage_credits: 1,
    features: ['Crear actores y entidades en el Universo', 'Soporte para aliases y detalles extras']
  },

  // ===================================================================
  // TOOL: CODEX_DELETE_UNIVERSE_ITEM - Delete a universe item
  // ===================================================================
  codex_delete_universe_item: {
    name: 'codex_delete_universe_item',
    description: 'Elimina un item del Universo del Codex por su ID. Operación irreversible.',
    parameters: {
      universe_item_id: { type: 'string', required: true, description: 'UUID del universe_item a eliminar' }
    },
    service_endpoint: 'internal', service_url: 'internal', category: 'user_data', usage_credits: 1,
    features: ['Eliminar items del Universo', 'Verificación de ownership']
  },

  // ===================================================================
  // TOOL: CODEX_BULK_DELETE - Delete multiple items at once
  // ===================================================================
  codex_bulk_delete: {
    name: 'codex_bulk_delete',
    description: 'Elimina múltiples items del Codex o del Universo a la vez. Operación irreversible.',
    parameters: {
      item_ids: { type: 'array', required: true, items: { type: 'string' }, description: 'Lista de UUIDs a eliminar' },
      item_type: { type: 'string', required: true, enum: ['codex_item', 'universe_item'], description: 'Tipo de item: codex_item o universe_item' }
    },
    service_endpoint: 'internal', service_url: 'internal', category: 'user_data', usage_credits: 2,
    features: ['Eliminación masiva', 'Soporta codex_items y universe_items', 'Verificación de ownership']
  },

  // ===================================================================
  // TOOL 3: POLITICAL_CONTEXT - Local DB context (no external calls)
  // ===================================================================
  political_context: {
    name: 'political_context',
    description: 'Accede al contexto político/noticioso local: news cards recientes, tendencias actuales (trending topics) y tweets con mayor engagement. NO hace búsquedas externas — lee directamente de la base de datos interna. Úsalo para preguntas sobre qué está pasando ahora, qué está trending, qué dicen los medios, contexto político actual.',
    parameters: {
      query: {
        type: 'string',
        required: false,
        description: 'Filtro opcional por tema/keyword. Si se omite, devuelve todo el contexto reciente.'
      },
      limit: {
        type: 'integer',
        required: false,
        default: 15,
        min: 5,
        max: 50,
        description: 'Número máximo de tweets a incluir'
      },
      hours_back: {
        type: 'integer',
        required: false,
        default: 48,
        min: 1,
        max: 168,
        description: 'Horas hacia atrás para buscar tweets (default: 48h)'
      }
    },
    service_endpoint: 'internal',
    service_url: 'internal',
    category: 'context',
    usage_credits: 1,
    features: [
      'News cards recientes (últimas 24h)',
      'Tendencias actuales (trending topics del snapshot más reciente)',
      'Tweets con mayor engagement (likes/retweets)',
      'Sin llamadas externas — datos locales Supabase',
      'Filtrado opcional por topic/keyword'
    ]
  },

  // ===================================================================
  // TOOL 2: SEARCH - Web search with Perplexity and Exa
  // ===================================================================
  search: {
    name: 'search',
    description: 'Búsqueda web inteligente usando Perplexity AI y/o Exa para obtener información actualizada sobre cualquier tema. Usa esto para preguntas sobre eventos actuales, noticias, datos que no estén en el Codex del usuario.',
    parameters: {
      query: {
        type: 'string',
        required: true,
        description: 'Consulta de búsqueda web'
      },
      provider: {
        type: 'string',
        required: false,
        enum: ['perplexity', 'exa', 'both'],
        default: 'both',
        description: 'Proveedor de búsqueda: perplexity (resumen AI), exa (enlaces directos), both (ambos en paralelo)'
      },
      location: {
        type: 'string',
        required: false,
        default: 'Guatemala',
        description: 'Contexto geográfico para la búsqueda'
      },
      num_results: {
        type: 'integer',
        required: false,
        default: 10,
        min: 1,
        max: 20,
        description: 'Número máximo de resultados'
      }
    },
    service_endpoint: 'internal',
    service_url: 'internal',
    category: 'web_research',
    usage_credits: 2,
    features: [
      'Búsqueda paralela Perplexity + Exa',
      'Información actualizada en tiempo real',
      'Contexto guatemalteco especializado',
      'Deduplicación automática de resultados',
      'Resumen AI de hallazgos'
    ]
  },

  legal_search: {
    name: 'legal_search',
    description: 'Busca artículos en la biblioteca legal de Guatemala (códigos, leyes, convenios y tratados ratificados). Devuelve el texto del artículo con su norma, decreto y ubicación (libro › título › capítulo). Úsalo para preguntas sobre qué dice la ley, sanciones, plazos, requisitos legales o para citar un artículo concreto. Si se pide un artículo por número (ej. "artículo 82 del Código de Trabajo") hace un match exacto; si no, busca por significado.',
    parameters: {
      query: {
        type: 'string',
        required: true,
        description: 'Consulta legal en lenguaje natural, o referencia directa a un artículo (ej. "sanciones por lavado de dinero", "artículo 82 del Código de Trabajo")'
      },
      limit: {
        type: 'integer',
        required: false,
        default: 5,
        min: 1,
        max: 10,
        description: 'Número máximo de artículos a devolver'
      },
      area: {
        type: 'string',
        required: false,
        enum: ['laboral', 'civil', 'penal', 'constitucional', 'administrativo', 'municipal',
               'electoral', 'derechos_humanos', 'mercantil', 'tributario', 'financiero', 'otro'],
        description: 'Filtra por rama del derecho. Omítelo salvo que la consulta sea explícitamente de un área.'
      }
    },
    service_endpoint: 'internal',
    service_url: 'internal',
    category: 'legal',
    usage_credits: 1,
    features: [
      'Búsqueda semántica sobre artículos indexados (embeddings 3072 dims)',
      'Match exacto cuando se pide un artículo por número',
      'Boost por coincidencia de palabras clave',
      'Filtrado opcional por rama del derecho',
      'Devuelve norma, decreto y ubicación estructural del artículo'
    ]
  },

  // ===================================================================
  // DATASET TOOLS (1-9): Write/Read operations for agentic datasets
  // ===================================================================
  dataset_create: {
    name: 'dataset_create',
    description: 'Crea un nuevo dataset (privado o público) con datos opcionales. Infiere el schema automáticamente.',
    parameters: {
      name: { type: 'string', required: true, description: 'Nombre del dataset' },
      description: { type: 'string', required: false, description: 'Descripción del dataset' },
      visibility: { type: 'string', required: false, enum: ['private', 'public'], default: 'private' },
      source: { type: 'string', required: false, default: 'api', description: 'Fuente de los datos' },
      data: { type: 'array', required: false, default: [], description: 'Filas iniciales del dataset' },
      auto_infer_schema: { type: 'boolean', required: false, default: true },
      tags: { type: 'array', required: false, default: [], items: { type: 'string' } },
      project_id: { type: 'string', required: false, description: 'ID del proyecto asociado' }
    },
    service_endpoint: 'internal', service_url: 'internal', category: 'datasets', usage_credits: 1,
    features: ['Inferencia automática de schema', 'Soporte privado/público', 'Tags y metadata']
  },

  dataset_append_rows: {
    name: 'dataset_append_rows',
    description: 'Agrega nuevas filas a un dataset existente. Actualiza row_count y size_bytes.',
    parameters: {
      dataset_id: { type: 'string', required: true },
      visibility: { type: 'string', required: false, enum: ['private', 'public'], default: 'private' },
      rows: { type: 'array', required: true, description: 'Filas a agregar' }
    },
    service_endpoint: 'internal', service_url: 'internal', category: 'datasets', usage_credits: 1,
    features: ['Append incremental', 'Actualización atómica de metadata']
  },

  dataset_bulk_insert: {
    name: 'dataset_bulk_insert',
    description: 'Inserta miles de filas en un dataset usando batches paralelos (Promise.allSettled). Óptimo para grandes volúmenes.',
    parameters: {
      dataset_id: { type: 'string', required: true },
      visibility: { type: 'string', required: false, default: 'private' },
      rows: { type: 'array', required: true, description: 'Filas a insertar (100-10000)' },
      batch_size: { type: 'integer', required: false, default: 100 }
    },
    service_endpoint: 'internal', service_url: 'internal', category: 'datasets', usage_credits: 2,
    features: ['Batches paralelos', 'Stats por batch', 'Manejo de errores parciales']
  },

  dataset_upsert_rows: {
    name: 'dataset_upsert_rows',
    description: 'Inserta o actualiza filas basado en una columna de match. Evita duplicados en pipelines re-ejecutables.',
    parameters: {
      dataset_id: { type: 'string', required: true },
      visibility: { type: 'string', required: false, default: 'private' },
      rows: { type: 'array', required: true },
      match_column: { type: 'string', required: true, description: 'Columna usada como clave para upsert (ej: id, url)' }
    },
    service_endpoint: 'internal', service_url: 'internal', category: 'datasets', usage_credits: 1,
    features: ['Upsert por columna', 'Insert + Update diferenciado', 'Idempotente']
  },

  dataset_update_rows: {
    name: 'dataset_update_rows',
    description: 'Actualiza filas existentes en un dataset que coincidan con los filtros dados. Usar para modificar, cambiar o editar datos en un dataset.',
    parameters: {
      dataset_id: { type: 'string', required: true },
      filters: { type: 'object', required: true, description: 'Filtros para encontrar las filas a actualizar: {columna: valor}' },
      updates: { type: 'object', required: true, description: 'Campos a actualizar con sus nuevos valores: {columna: nuevo_valor}' }
    },
    service_endpoint: 'internal', service_url: 'internal', category: 'datasets', usage_credits: 1,
    features: ['Actualización selectiva', 'Filtro por columna', 'Actualización masiva']
  },

  dataset_list: {
    name: 'dataset_list',
    description: 'Lista los datasets del usuario (privados y/o públicos) con búsqueda y filtros.',
    parameters: {
      visibility: { type: 'string', required: false, enum: ['private', 'public', 'all'], default: 'all' },
      search: { type: 'string', required: false, description: 'Búsqueda por nombre/descripción/tags' },
      project_id: { type: 'string', required: false },
      tags: { type: 'array', required: false, items: { type: 'string' } },
      limit: { type: 'integer', required: false, default: 20 }
    },
    service_endpoint: 'internal', service_url: 'internal', category: 'datasets', usage_credits: 1,
    features: ['Filtrado por visibilidad', 'Búsqueda full-text', 'Filtro por proyecto/tags']
  },

  dataset_get: {
    name: 'dataset_get',
    description: 'Obtiene un dataset completo con sus datos. Soporta paginación y proyección de columnas.',
    parameters: {
      dataset_id: { type: 'string', required: true },
      visibility: { type: 'string', required: false, default: 'private' },
      limit: { type: 'integer', required: false, default: 100 },
      offset: { type: 'integer', required: false, default: 0 },
      columns: { type: 'array', required: false, items: { type: 'string' }, description: 'Columnas a retornar (proyección)' }
    },
    service_endpoint: 'internal', service_url: 'internal', category: 'datasets', usage_credits: 1,
    features: ['Paginación', 'Proyección de columnas', 'Metadata completa']
  },

  dataset_query: {
    name: 'dataset_query',
    description: 'Filtra, ordena y pagina los datos de un dataset. Soporta múltiples operadores de filtro.',
    parameters: {
      dataset_id: { type: 'string', required: true },
      visibility: { type: 'string', required: false, default: 'private' },
      filters: { type: 'array', required: false, default: [], description: 'Filtros: [{field, operator, value}]. Operadores: eq,neq,gt,gte,lt,lte,contains,starts_with,ends_with,regex' },
      columns: { type: 'array', required: false, items: { type: 'string' } },
      limit: { type: 'integer', required: false, default: 50 },
      offset: { type: 'integer', required: false, default: 0 },
      order_by: { type: 'string', required: false },
      order_dir: { type: 'string', required: false, enum: ['asc', 'desc'], default: 'asc' }
    },
    service_endpoint: 'internal', service_url: 'internal', category: 'datasets', usage_credits: 1,
    features: ['Filtros avanzados', 'Ordenamiento', 'Proyección de columnas', 'Paginación']
  },

  dataset_bulk_query: {
    name: 'dataset_bulk_query',
    description: 'Consulta múltiples datasets en paralelo (Promise.all). Ideal para dashboards y análisis cruzados.',
    parameters: {
      queries: { type: 'array', required: true, description: 'Array de queries: [{dataset_id, filters, columns, limit, offset, visibility}]' },
      parallel: { type: 'boolean', required: false, default: true, description: 'true=paralelo (Promise.allSettled), false=secuencial' }
    },
    service_endpoint: 'internal', service_url: 'internal', category: 'datasets', usage_credits: 2,
    features: ['Consultas paralelas', 'Manejo de errores por query', 'Resultados indexados']
  },

  dataset_delete_rows: {
    name: 'dataset_delete_rows',
    description: 'Elimina filas de un dataset que coincidan con un filtro. Requiere filtro explícito para evitar borrado accidental.',
    parameters: {
      dataset_id: { type: 'string', required: true },
      visibility: { type: 'string', required: false, default: 'private' },
      filter: { type: 'object', required: true, description: 'Filtro requerido: {field, operator, value}' }
    },
    service_endpoint: 'internal', service_url: 'internal', category: 'datasets', usage_credits: 1,
    features: ['Borrado selectivo', 'Filtro obligatorio', 'Actualización de metadata']
  },

  dataset_list_rows: {
    name: 'dataset_list_rows',
    description: 'Lee filas canónicas de un conjunto de datos con identidad estable, revisión y estado del vínculo con Codex. Usa esta herramienta cuando después necesites editar o alinear filas; dataset_get conserva el formato histórico.',
    parameters: {
      dataset_id: { type: 'string', required: true, description: 'UUID real del conjunto, obtenido con dataset_list' },
      limit: { type: 'integer', required: false, default: 100, min: 1, max: 500 },
      offset: { type: 'integer', required: false, default: 0, min: 0 }
    },
    service_endpoint: 'internal', service_url: 'internal', category: 'datasets', usage_credits: 1,
    features: ['UUID estable por fila', 'Revisión optimista', 'Estado del vínculo con Codex']
  },

  dataset_preview_codex_alignment: {
    name: 'dataset_preview_codex_alignment',
    description: 'PASO 1 obligatorio y de solo lectura para conectar un conjunto con Codex. Compara cada fila con ítems del mismo usuario, detecta coincidencias exactas, alias, casos ambiguos y posibles ítems nuevos. Devuelve preview_token. Muestra el resultado al usuario antes de llamar dataset_apply_codex_alignment.',
    parameters: {
      dataset_id: { type: 'string', required: true, description: 'UUID real del conjunto' },
      item_type: { type: 'string', required: true, enum: ['Actor', 'Entidad', 'Territorio', 'Evento', 'Historia', 'Objeto', 'Artefacto', 'Source'], description: 'Tipo oficial de Codex que representa cada fila' },
      match_column: { type: 'string', required: true, description: 'Columna que identifica la fila, normalmente Nombre' },
      match_type: { type: 'string', required: false, enum: ['name', 'alias', 'id'], default: 'name' },
      bindings: {
        type: 'array', required: false, default: [],
        description: 'Asignaciones propuestas. field usa una field_key del catálogo; details admite una clave libre elegida por el usuario.',
        items: {
          type: 'object',
          properties: {
            column_key: { type: 'string' },
            target_kind: { type: 'string', enum: ['field', 'details'] },
            target_key: { type: 'string' },
            direction: { type: 'string', enum: ['both', 'dataset_to_codex', 'codex_to_dataset'], default: 'both' },
            empty_policy: { type: 'string', enum: ['ignore_empty', 'propagate_empty', 'confirm_clear'], default: 'ignore_empty' }
          },
          required: ['column_key', 'target_kind', 'target_key'],
          additionalProperties: false
        }
      }
    },
    service_endpoint: 'internal', service_url: 'internal', category: 'datasets', usage_credits: 1,
    features: ['Solo lectura', 'Coincidencias por usuario', 'No crea ítems automáticamente', 'Devuelve confirmación revisable']
  },

  dataset_apply_codex_alignment: {
    name: 'dataset_apply_codex_alignment',
    description: 'PASO 2 para conectar filas con Codex. Llámala únicamente después de enseñar la vista previa y recibir aprobación explícita. Requiere el mismo item_type, match_column, match_type y bindings usados en preview, además del preview_token y una decisión por fila. track solo vincula; sync activa propagación bidireccional para campos aprobados.',
    parameters: {
      dataset_id: { type: 'string', required: true },
      preview_token: { type: 'string', required: true, description: 'Token devuelto por la vista previa más reciente' },
      confirmed: { type: 'boolean', required: true, description: 'Debe ser true solo tras aprobación explícita del usuario' },
      item_type: { type: 'string', required: true, enum: ['Actor', 'Entidad', 'Territorio', 'Evento', 'Historia', 'Objeto', 'Artefacto', 'Source'] },
      match_column: { type: 'string', required: true },
      match_type: { type: 'string', required: false, enum: ['name', 'alias', 'id'], default: 'name' },
      connection_mode: { type: 'string', required: false, enum: ['track', 'sync'], default: 'track' },
      accept_exact: { type: 'boolean', required: false, default: false, description: 'Permite aceptar candidatos exactos indicados con action=link sin reenviar su UUID' },
      allow_create: { type: 'boolean', required: false, default: false, description: 'Debe ser true si alguna decisión usa action=create' },
      operation_id: { type: 'string', required: false, description: 'UUID de idempotencia. Si reintentas una llamada, reutiliza el operation_id devuelto.' },
      bindings: {
        type: 'array', required: true,
        description: 'La lista completa de asignaciones revisadas en preview; envía [] si el usuario confirmó que no habrá campos sincronizados.',
        items: {
          type: 'object',
          properties: {
            column_key: { type: 'string' },
            target_kind: { type: 'string', enum: ['field', 'details'] },
            target_key: { type: 'string' },
            direction: { type: 'string', enum: ['both', 'dataset_to_codex', 'codex_to_dataset'], default: 'both' },
            empty_policy: { type: 'string', enum: ['ignore_empty', 'propagate_empty', 'confirm_clear'], default: 'ignore_empty' }
          },
          required: ['column_key', 'target_kind', 'target_key'],
          additionalProperties: false
        }
      },
      decisions: {
        type: 'array', required: true,
        description: 'Decisiones explícitas: link con codex_item_id real, create con nombre, o skip.',
        items: {
          type: 'object',
          properties: {
            row_id: { type: 'string' },
            action: { type: 'string', enum: ['link', 'create', 'skip'] },
            codex_item_id: { type: 'string' },
            name: { type: 'string' }
          },
          required: ['row_id', 'action'],
          additionalProperties: false
        }
      }
    },
    service_endpoint: 'internal', service_url: 'internal', category: 'datasets', usage_credits: 1,
    features: ['Confirmación obligatoria', 'Idempotencia', 'Vínculo o creación explícitos', 'Modos seguimiento y sincronización']
  },

  dataset_update_row: {
    name: 'dataset_update_row',
    description: 'Edita una fila canónica. Envía expected_revision obtenida con dataset_list_rows para detectar ediciones concurrentes. En modo sync, solo propaga a Codex las columnas vinculadas y aprobadas.',
    parameters: {
      dataset_id: { type: 'string', required: true },
      row_id: { type: 'string', required: true },
      updates: { type: 'object', required: true, description: 'Pares columna: valor que se modificarán' },
      expected_revision: { type: 'integer', required: true, min: 1 },
      operation_id: { type: 'string', required: false, description: 'UUID opcional de idempotencia/auditoría' }
    },
    service_endpoint: 'internal', service_url: 'internal', category: 'datasets', usage_credits: 1,
    features: ['Control de concurrencia', 'Sincronización limitada a campos aprobados', 'Auditoría']
  },

  dataset_bind_column: {
    name: 'dataset_bind_column',
    description: 'Aprueba o reemplaza la asignación de una columna a un campo de Codex. Úsala solo después de explicar la asignación al usuario. Para campos oficiales usa target_kind=field y una field_key del catálogo; para información libre aprobada usa target_kind=details.',
    parameters: {
      dataset_id: { type: 'string', required: true },
      confirmed: { type: 'boolean', required: true, description: 'Debe ser true tras aprobación explícita' },
      column_key: { type: 'string', required: true },
      target_kind: { type: 'string', required: true, enum: ['field', 'details'] },
      target_key: { type: 'string', required: true },
      direction: { type: 'string', required: false, enum: ['both', 'dataset_to_codex', 'codex_to_dataset'], default: 'both' },
      empty_policy: { type: 'string', required: false, enum: ['ignore_empty', 'propagate_empty', 'confirm_clear'], default: 'ignore_empty' }
    },
    service_endpoint: 'internal', service_url: 'internal', category: 'datasets', usage_credits: 1,
    features: ['Catálogo de campos', 'Detalles personalizados', 'Dirección y vacíos configurables']
  },

  dataset_unbind_column: {
    name: 'dataset_unbind_column',
    description: 'Desactiva una asignación de columna sin borrar su historial. Requiere confirmación explícita.',
    parameters: {
      dataset_id: { type: 'string', required: true },
      binding_id: { type: 'string', required: false },
      column_key: { type: 'string', required: false, description: 'Alternativa a binding_id' },
      confirmed: { type: 'boolean', required: true }
    },
    service_endpoint: 'internal', service_url: 'internal', category: 'datasets', usage_credits: 1,
    features: ['Desactivación reversible', 'Historial preservado']
  },

  dataset_detach_row: {
    name: 'dataset_detach_row',
    description: 'Separa una fila de su ítem de Codex sin borrar ninguno de los dos. Requiere confirmación explícita.',
    parameters: {
      dataset_id: { type: 'string', required: true },
      row_id: { type: 'string', required: true },
      confirmed: { type: 'boolean', required: true }
    },
    service_endpoint: 'internal', service_url: 'internal', category: 'datasets', usage_credits: 1,
    features: ['No elimina datos', 'Vínculo auditable']
  },

  dataset_sync_row: {
    name: 'dataset_sync_row',
    description: 'Reintenta la propagación de una fila vinculada hacia Codex usando únicamente asignaciones previamente aprobadas. No crea vínculos ni campos.',
    parameters: {
      dataset_id: { type: 'string', required: true },
      row_id: { type: 'string', required: true },
      operation_id: { type: 'string', required: false }
    },
    service_endpoint: 'internal', service_url: 'internal', category: 'datasets', usage_credits: 1,
    features: ['Reintento acotado', 'Sin creación implícita', 'Respeta asignaciones']
  },

  dataset_sync_status: {
    name: 'dataset_sync_status',
    description: 'Resume el estado de conexión de un conjunto: tipo de Codex, modo, filas vinculadas, asignaciones activas y conflictos pendientes.',
    parameters: {
      dataset_id: { type: 'string', required: true }
    },
    service_endpoint: 'internal', service_url: 'internal', category: 'datasets', usage_credits: 1,
    features: ['Estado resumido', 'Conteo de conflictos', 'Última sincronización']
  },

  dataset_list_sync_events: {
    name: 'dataset_list_sync_events',
    description: 'Lista el historial auditable de sincronización de un conjunto. Puede filtrarse por estado.',
    parameters: {
      dataset_id: { type: 'string', required: true },
      statuses: { type: 'array', required: false, items: { type: 'string', enum: ['pending', 'applied', 'skipped', 'conflict', 'failed'] } },
      limit: { type: 'integer', required: false, default: 50, min: 1, max: 200 }
    },
    service_endpoint: 'internal', service_url: 'internal', category: 'datasets', usage_credits: 1,
    features: ['Auditoría', 'Valores anterior y nuevo', 'Filtro por estado']
  },

  dataset_list_conflicts: {
    name: 'dataset_list_conflicts',
    description: 'Lista conflictos y fallos pendientes del vínculo Dataset ↔ Codex, por ejemplo un vaciado que exige confirmación.',
    parameters: {
      dataset_id: { type: 'string', required: true },
      limit: { type: 'integer', required: false, default: 50, min: 1, max: 200 }
    },
    service_endpoint: 'internal', service_url: 'internal', category: 'datasets', usage_credits: 1,
    features: ['Conflictos explícitos', 'Sin resolución automática']
  },

  // ===================================================================
  // SEARCH TOOLS (10-12): Parallel & bulk search operations
  // ===================================================================
  search_parallel: {
    name: 'search_parallel',
    description: 'Busca una consulta en múltiples fuentes en paralelo (nitter, perplexity, trends). Consolida resultados con atribución de fuente.',
    parameters: {
      query: { type: 'string', required: true, description: 'Consulta de búsqueda' },
      sources: { type: 'array', required: false, default: ['nitter', 'perplexity'], items: { type: 'string', enum: ['nitter', 'perplexity', 'trends'] } },
      location: { type: 'string', required: false, default: 'guatemala' },
      limit_per_source: { type: 'integer', required: false, default: 10, min: 1, max: 50 }
    },
    service_endpoint: 'internal', service_url: 'internal', category: 'search', usage_credits: 2,
    features: ['Búsqueda paralela multi-fuente', 'Atribución por fuente', 'Consolidación automática']
  },

  search_bulk: {
    name: 'search_bulk',
    description: 'Ejecuta múltiples consultas en paralelo sobre una o más fuentes. Ideal para investigar varios términos a la vez. Puede guardar resultados en un dataset automáticamente.',
    parameters: {
      queries: { type: 'array', required: true, items: { type: 'string' }, description: 'Lista de consultas a buscar' },
      source: { type: 'string', required: false, default: 'nitter', description: 'nitter | perplexity | both | array de fuentes' },
      location: { type: 'string', required: false, default: 'guatemala' },
      limit_per_query: { type: 'integer', required: false, default: 10 },
      save_to_dataset: { type: 'string', required: false, description: 'dataset_id donde guardar los resultados' },
      save_visibility: { type: 'string', required: false, default: 'private' }
    },
    service_endpoint: 'internal', service_url: 'internal', category: 'search', usage_credits: 3,
    features: ['Múltiples queries paralelas', 'Multi-fuente', 'Auto-guardado en dataset', 'Stats por query']
  },

  search_and_save_dataset: {
    name: 'search_and_save_dataset',
    description: 'Pipeline completo: busca en múltiples fuentes en paralelo y crea un dataset con los resultados automáticamente. Un solo tool call para buscar + guardar.',
    parameters: {
      query: { type: 'string', required: true },
      sources: { type: 'array', required: false, default: ['nitter', 'perplexity'] },
      dataset_name: { type: 'string', required: true, description: 'Nombre para el nuevo dataset' },
      description: { type: 'string', required: false },
      visibility: { type: 'string', required: false, default: 'private' },
      tags: { type: 'array', required: false, default: [] },
      location: { type: 'string', required: false, default: 'guatemala' },
      limit_per_source: { type: 'integer', required: false, default: 20 },
      project_id: { type: 'string', required: false }
    },
    service_endpoint: 'internal', service_url: 'internal', category: 'search', usage_credits: 3,
    features: ['Búsqueda + Dataset en un paso', 'Multi-fuente paralelo', 'Schema auto-inferido', 'Listo para análisis']
  }
};

/**
 * Lista todas las herramientas disponibles en el MCP Server
 * @returns {Array} Array de herramientas con su información
 */
async function listAvailableTools() {
  try {
    const tools = Object.values(AVAILABLE_TOOLS).map(tool => ({
      name: tool.name,
      description: tool.description,
      category: tool.category,
      parameters: tool.parameters,
      usage_credits: tool.usage_credits
    }));

    console.log(`📋 Listando ${tools.length} herramientas MCP disponibles`);
    return tools;
  } catch (error) {
    console.error('❌ Error listando herramientas MCP:', error);
    throw error;
  }
}

/**
 * Obtiene información detallada de una herramienta específica
 * @param {string} toolName - Nombre de la herramienta
 * @returns {Object|null} Información de la herramienta o null si no existe
 */
async function getToolInfo(toolName) {
  try {
    const tool = AVAILABLE_TOOLS[toolName];

    if (!tool) {
      console.log(`⚠️ Herramienta '${toolName}' no encontrada`);
      return null;
    }

    console.log(`📖 Obteniendo información de herramienta: ${toolName}`);
    return {
      name: tool.name,
      description: tool.description,
      category: tool.category,
      parameters: tool.parameters,
      usage_credits: tool.usage_credits,
      service_info: {
        endpoint: tool.service_endpoint,
        url: tool.service_url
      }
    };
  } catch (error) {
    console.error(`❌ Error obteniendo info de herramienta ${toolName}:`, error);
    throw error;
  }
}

/**
 * Mode-based tool filtering
 * Defines which tools are available for each mode
 * SIMPLIFIED: Only 2 tools now - codex and search
 */
const TOOL_MODE_ACCESS = {
  // Chat Mode: All tools available
  chat: new Set(['codex', 'search', 'political_context', 'mapa', 'places']),

  // Agentic Mode: All tools available (including write tools)
  agentic: new Set([
    'codex', 'search', 'political_context', 'workspace', 'mapa', 'places', 'data_ops', 'simular',
    'codex_list_items', 'codex_update_item', 'codex_bulk_update',
    'codex_create_item', 'codex_delete_item',
    'codex_create_universe_item', 'codex_delete_universe_item', 'codex_bulk_delete',
    // Dataset tools
    'dataset_create', 'dataset_append_rows', 'dataset_bulk_insert', 'dataset_upsert_rows',
    'dataset_list', 'dataset_get', 'dataset_query', 'dataset_bulk_query', 'dataset_update_rows', 'dataset_delete_rows',
    'dataset_list_rows', 'dataset_preview_codex_alignment', 'dataset_apply_codex_alignment',
    'dataset_update_row', 'dataset_bind_column', 'dataset_unbind_column', 'dataset_detach_row',
    'dataset_sync_row', 'dataset_sync_status', 'dataset_list_sync_events', 'dataset_list_conflicts',
    // Search tools (parallel + bulk)
    'search_parallel', 'search_bulk', 'search_and_save_dataset',
    // Búsqueda legal (normas + articulos). Entra por 'agentic' y de ahí la hereda
    // el modo 'mcp', que es el que ven los clientes externos.
    'legal_search'
  ])
};

// Modo MCP: lo que ven los clientes EXTERNOS (Claude, ChatGPT) vía mcp.standatpd.com.
// Parte de 'agentic' y solo quita el borrado masivo:
//   - 'codex_bulk_delete' → destructivo sin confirmación intermedia. Los deletes
//     uno-a-uno se quedan (el daño es acotado y reversible de a poco).
//
// 'search' SÍ se expone. Se intentó quitarlo (razonando que el cliente externo trae
// su propio buscador web), pero fue un error: search usa Perplexity+Exa y FUNCIONA,
// mientras que las alternativas están rotas — search_parallel/search_bulk dependen
// de PARALLEL_API_KEY (no configurada) y de un módulo ./nitter inexistente. Quitarlo
// dejaba al cliente sin ninguna búsqueda operativa. No volver a excluirlo sin antes
// verificar que los sustitutos realmente responden.
TOOL_MODE_ACCESS.mcp = new Set(
  [...TOOL_MODE_ACCESS.agentic].filter(t => !['codex_bulk_delete'].includes(t))
);

/**
 * Check if a tool is allowed for the given mode
 * @param {string} toolName - Tool name to check
 * @param {string} mode - Current mode ('chat' | 'agentic')
 * @returns {boolean} Whether the tool is allowed
 */
function isToolAllowedForMode(toolName, mode = 'chat') {
  // Default to chat mode if mode is invalid
  const normalizedMode = TOOL_MODE_ACCESS[mode] ? mode : 'chat';
  const allowedTools = TOOL_MODE_ACCESS[normalizedMode];

  return allowedTools.has(toolName);
}

/**
 * Get available tools for a specific mode
 * @param {string} mode - Mode to get tools for ('chat' | 'agentic')
 * @returns {Array} Array of available tool names
 */
function getToolsForMode(mode = 'chat') {
  const normalizedMode = TOOL_MODE_ACCESS[mode] ? mode : 'chat';
  return Array.from(TOOL_MODE_ACCESS[normalizedMode]);
}

/**
 * Ejecuta una herramienta específica del MCP Server con validación de modo
 * SIMPLIFIED: Only 2 tools - codex and search
 * @param {string} toolName - Nombre de la herramienta
 * @param {Object} parameters - Parámetros para la herramienta
 * @param {Object} user - Información del usuario autenticado
 * @param {string} mode - Modo actual ('chat' | 'agentic')
 * @returns {Object} Resultado de la ejecución
 */
async function executeTool(toolName, parameters = {}, user = null, mode = 'chat') {
  try {
    console.log(`🔧 [MCP v2.0] Ejecutando herramienta: ${toolName} en modo ${mode}`);

    // Validar que la herramienta existe
    if (!AVAILABLE_TOOLS[toolName]) {
      throw new Error(`Herramienta '${toolName}' no encontrada. Herramientas disponibles: ${Object.keys(AVAILABLE_TOOLS).join(', ')}`)
    }

    // Validar que la herramienta está permitida para el modo actual
    if (!isToolAllowedForMode(toolName, mode)) {
      const allowedTools = getToolsForMode(mode);
      throw new Error(`Herramienta '${toolName}' no permitida en modo ${mode}. Herramientas permitidas: ${allowedTools.join(', ')}`);
    }

    // ===================================================================
    // SIMPLIFIED TOOL EXECUTION - Only 2 tools
    // ===================================================================
    switch (toolName) {
      // ===================================================================
      // TOOL 1: CODEX - Unified Codex + Wiki access
      // ===================================================================
      case 'codex': {
        const action = parameters.action || 'search';
        const query = parameters.query;
        const itemIds = parameters.item_ids || [];
        const subcategory = parameters.subcategory;
        const limit = parameters.limit || 10;

        console.log(`📚 [CODEX] Action: ${action}, Query: "${query || 'N/A'}", Subcategory: ${subcategory || 'all'}`);

        switch (action) {
          case 'get_schema': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            const schema = await getMergedSchema(supabase, user.id, parameters.tipo || null);
            return { success: true, action, schema };
          }

          case 'resolve_field': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            const resolution = await resolveField(supabase, user.id, {
              tipo: parameters.tipo,
              field_key: parameters.field_key,
              label: parameters.field_label || parameters.name,
              field_type: parameters.field_type,
            });
            return { success: true, action, ...resolution };
          }

          case 'create_field': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            const field = await createUserField(supabase, user.id, {
              field_key: parameters.field_key,
              label: parameters.field_label || parameters.name,
              field_type: parameters.field_type,
              reason: parameters.field_reason,
              item_types: parameters.item_types || (parameters.tipo ? [parameters.tipo] : []),
              config: parameters.config,
            }, 'agent');
            return { success: true, action, field, formatted_response: `✓ Campo creado: ${field.label} (${field.field_key})` };
          }

          case 'create_preset': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            const preset = await createUserPreset(supabase, user.id, {
              preset_key: parameters.preset_key,
              label: parameters.name,
              description: parameters.description,
              item_types: parameters.item_types || (parameters.tipo ? [parameters.tipo] : []),
              field_keys: parameters.field_keys,
            });
            return { success: true, action, preset, formatted_response: `✓ Preset creado: ${preset.label} (${preset.preset_key})` };
          }

          case 'update_field': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            if (!parameters.field_key) return { success: false, error: 'field_key es requerido' };
            const field = await updateUserField(supabase, user.id, parameters.field_key, {
              label: parameters.field_label || parameters.name,
              field_type: parameters.field_type,
              reason: parameters.field_reason,
              item_types: parameters.item_types,
              config: parameters.config,
            });
            return { success: true, action, field, formatted_response: `✓ Campo actualizado: ${field.label} (${field.field_key})` };
          }

          case 'deactivate_field': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            if (!parameters.field_key) return { success: false, error: 'field_key es requerido' };
            const field = await deactivateUserField(supabase, user.id, parameters.field_key);
            return { success: true, action, field, formatted_response: `✓ Campo desactivado sin borrar valores históricos: ${field.field_key}` };
          }

          case 'update_preset': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            if (!parameters.preset_key) return { success: false, error: 'preset_key es requerido' };
            const preset = await updateUserPreset(supabase, user.id, parameters.preset_key, {
              label: parameters.name,
              description: parameters.description,
              item_types: parameters.item_types,
              field_keys: parameters.field_keys,
            });
            return { success: true, action, preset, formatted_response: `✓ Preset actualizado: ${preset.label} (${preset.preset_key})` };
          }

          case 'deactivate_preset': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            if (!parameters.preset_key) return { success: false, error: 'preset_key es requerido' };
            const preset = await deactivateUserPreset(supabase, user.id, parameters.preset_key);
            return { success: true, action, preset, formatted_response: `✓ Preset desactivado; los items conservan su snapshot: ${preset.preset_key}` };
          }

          case 'search_sources': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            const result = await listSources(supabase, user.id, parameters);
            return { success: true, action, ...result, formatted_response: `✓ ${result.count} Sources encontradas` };
          }

          case 'get_source': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            if (!parameters.item_id) return { success: false, error: 'item_id es requerido' };
            return { success: true, action, source: await getSource(supabase, user.id, parameters.item_id) };
          }

          case 'create_source': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            const item = await createSource(supabase, user.id, parameters);
            return { success: true, action, item, formatted_response: `✓ Source creada: ${item.name} (${item.id})` };
          }

          case 'update_source': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            if (!parameters.item_id) return { success: false, error: 'item_id es requerido' };
            const item = await updateSource(supabase, user.id, parameters.item_id, parameters);
            return { success: true, action, item, formatted_response: `✓ Source actualizada: ${item.name}` };
          }

          case 'cite_source': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            if (!parameters.item_id) return { success: false, error: 'item_id debe ser el UUID de Source' };
            const citation = await citeSource(supabase, user.id, parameters.item_id, parameters);
            return { success: true, action, ...citation, formatted_response: `✓ ${citation.subject.name} cita ${citation.source.name}` };
          }

          case 'search_profiles': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            const result = await listProfiles(supabase, user.id, parameters);
            return { success: true, action, ...result, formatted_response: `✓ ${result.count} Perfiles encontrados` };
          }

          case 'get_profile': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            if (!parameters.item_id) return { success: false, error: 'item_id es requerido' };
            return { success: true, action, profile: await getProfile(supabase, user.id, parameters.item_id) };
          }

          case 'create_profile': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            const item = await createProfile(supabase, user.id, parameters);
            return { success: true, action, item, formatted_response: `✓ Perfil creado como Actor: ${item.name} (${item.id})` };
          }

          case 'update_profile': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            if (!parameters.item_id) return { success: false, error: 'item_id es requerido' };
            const item = await updateProfile(supabase, user.id, parameters.item_id, parameters);
            return { success: true, action, item, formatted_response: `✓ Perfil actualizado: ${item.name}` };
          }

          case 'search': {
            // If query is a full sentence/question (not a search keyword), list all items
            const questionWords = /^(dime|qué|que|cuál|cuales|muéstrame|muestrame|dame|hay|tienes|tengo|ver|listar|lista|mostrar|show|what|list)/i;
            const isFullSentence = query && query.trim().split(/\s+/).length > 3;
            const isListingRequest = query && (questionWords.test(query.trim()) || /codex/i.test(query));
            const effectiveQuery = (isFullSentence && isListingRequest) ? null : query;
            console.log(`📚 [CODEX] Action: search, Query: "${query}", Subcategory: ${subcategory || 'all'}`);
            console.log(`📚 [CODEX] Effective query: ${effectiveQuery === null ? 'NULL (listing all)' : `"${effectiveQuery}"`}`);
            const docResult = await executeUserCodex(
              null, // projectId
              effectiveQuery,
              limit,
              null, // type
              null, // tags
              user
            );
            // El "codex" para el usuario incluye TODO: además de documentos, busca también en el
            // Universo Investigativo (posts, tweets, actores, entidades, eventos, snippets), para
            // que una búsqueda simple ("localiza el post de X") encuentre el item aunque el modelo
            // no haya elegido search_universe.
            if (query && user?.id) {
              try {
                const supabaseU = require('../utils/supabase');
                const uni = await searchUniverseByTerms(supabaseU, user.id, query, 8);
                if (uni.items && uni.items.length > 0 && docResult && typeof docResult === 'object') {
                  const uniText = `\n\nUNIVERSO INVESTIGATIVO (${uni.items.length} item(s) — posts, actores, eventos, snippets):\n` +
                    uni.items.map(i => `- [${i.tipo}] ${i.name}${i.description ? ': ' + String(i.description).slice(0, 180) : ''} (ID: ${i.id})`).join('\n');
                  docResult.formatted_response = (docResult.formatted_response || '') + uniText;
                  docResult.analysis_result = (docResult.analysis_result || '') + uniText;
                  docResult.universe_items = uni.items;
                  console.log(`📚 [CODEX] search incluyó ${uni.items.length} item(s) del Universo (términos: ${uni.terms.join(',')})`);
                }
              } catch (uErr) {
                console.warn('📚 [CODEX] búsqueda en universo dentro de search falló:', uErr.message);
              }
            }
            return docResult;
          }

          case 'get_items':
            // Use existing executeUserCodexSpecific for specific items
            return await executeUserCodexSpecific(itemIds, user);

          // ── UNIVERSE: READ ───────────────────────────────────────────────
          case 'search_universe': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };

            // ── AUTO-FALLTHROUGH (B): si hay dataset_id, el usuario quiere TODOS
            // los items de ese dataset, no una búsqueda de texto dentro. El text
            // search dentro de un dataset (ej: query="diputado") no tiene sentido
            // y trunca. Redirigimos a la lista completa compacta — sin depender
            // de que el modelo elija list_by_dataset.
            if (parameters.dataset_id) {
              const dsId = parameters.dataset_id;
              const page = Math.max(1, parameters.page || 1);
              const pageSize = 200; // dump completo en un shot (compacto)
              const offset = (page - 1) * pageSize;

              let fq = supabase
                .from('codex_universe_items')
                .select('id, name, tipo, tags, details', { count: 'exact' })
                .eq('user_id', user.id)
                .contains('details', { datasets: [dsId] });
              if (parameters.tipo) fq = fq.ilike('tipo', parameters.tipo);

              const { data: dsItems, error: dsErr, count: dsTotal } = await fq
                .order('name', { ascending: true })
                .range(offset, offset + pageSize - 1);

              if (dsErr) return { success: false, error: dsErr.message };

              const summary = (dsItems || []).map(it => ({
                id: it.id,
                name: it.name,
                tipo: it.tipo,
                cargo: it.details?.Cargo || it.details?.['Rol / función'] || null,
                partido: it.details?.Partido || null,
                distrito: it.details?.Distrito || null,
              }));
              const totalPages = Math.ceil((dsTotal || 0) / pageSize);
              console.log(`📦 [CODEX] search_universe con dataset_id → fallthrough a lista completa: ${summary.length}/${dsTotal} items (page ${page}/${totalPages})`);

              return {
                success: true,
                action: 'search_universe',
                mode: 'dataset_full_list',
                dataset_id: dsId,
                total_items: dsTotal || 0,
                returned: summary.length,
                page,
                total_pages: totalPages,
                has_more: page < totalPages,
                items: summary,
                formatted_response: `Todos los items del dataset (${dsTotal} totales, mostrando ${summary.length}):\n${summary.slice(0, 60).map(i => `- ${i.name}${i.partido ? ' (' + i.partido + ')' : ''}${i.distrito ? ' — ' + i.distrito : ''}`).join('\n')}${summary.length > 60 ? `\n... y ${summary.length - 60} más en items[].` : ''}${page < totalPages ? `\n\nHay más — usa page=${page + 1}.` : ''}`,
                metadata: { service: 'codex_universe', timestamp: new Date().toISOString() }
              };
            }

            let uq = supabase
              .from('codex_universe_items')
              .select('id, tipo, name, description, tags, aliases, details, created_at, updated_at')
              .eq('user_id', user.id);

            // Tokeniza la consulta en términos significativos para hacer match flexible:
            // no exige que la frase completa sea un substring contiguo (eso fallaba con
            // posts/items cuyas palabras no son contiguas, ej: "Edgar Ortiz victoria silenciosa").
            const STOPWORDS_U = new Set(['del','los','las','una','uno','que','con','por','para','sobre','este','esta','sus','the','and','dame','dime','busca','buscar','localiza','encuentra','post','codex','códex']);
            const qTerms = query
              ? [...new Set(query.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9ñ]+/).filter(t => t.length >= 3 && !STOPWORDS_U.has(t)))].slice(0, 8)
              : [];

            if (query) {
              if (qTerms.length > 0) {
                const ors = [];
                for (const t of qTerms) {
                  const esc = t.replace(/[%,().]/g, ' ');
                  ors.push(`name.ilike.%${esc}%`);
                  ors.push(`description.ilike.%${esc}%`);
                }
                uq = uq.or(ors.join(','));
              } else {
                uq = uq.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
              }
            }
            if (parameters.tipo) {
              // Case-insensitive match (DB stores "Actor", LLM may send "actor")
              uq = uq.ilike('tipo', parameters.tipo);
            }
            // Filter by dataset_id: busca en details.datasets (nuevo formato) OR tag legacy
            if (parameters.dataset_id) {
              // Nuevo formato: details.datasets contiene el ID
              uq = uq.contains('details', { datasets: [parameters.dataset_id] });
              console.log(`📦 [CODEX] Filtrando por dataset_id="${parameters.dataset_id}" → details.datasets`);
            } else if (parameters.tags && Array.isArray(parameters.tags) && parameters.tags.length > 0) {
              // Filter by tags array (e.g. ["dataset:nomina-fiscal"])
              uq = uq.contains('tags', parameters.tags);
            }

            // Trae un conjunto más amplio cuando hay términos, para re-rankear por relevancia.
            const fetchLimit = qTerms.length > 0 ? Math.min(limit * 4, 40) : limit;

            // Count total disponible para detectar si hay más de lo que vamos a devolver
            let cq = supabase.from('codex_universe_items')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', user.id);
            if (parameters.tipo) cq = cq.ilike('tipo', parameters.tipo);
            if (parameters.dataset_id) {
              cq = cq.contains('details', { datasets: [parameters.dataset_id] });
            } else if (parameters.tags && Array.isArray(parameters.tags) && parameters.tags.length > 0) {
              cq = cq.contains('tags', parameters.tags);
            }
            if (query && qTerms.length > 0) {
              const cqOrs = [];
              for (const t of qTerms) {
                const esc = t.replace(/[%,().]/g, ' ');
                cqOrs.push(`name.ilike.%${esc}%`);
                cqOrs.push(`description.ilike.%${esc}%`);
              }
              cq = cq.or(cqOrs.join(','));
            } else if (query) {
              cq = cq.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
            }

            const [{ data: uItems, error: uErr }, { count: totalAvailable }] = await Promise.all([
              uq.order('updated_at', { ascending: false }).limit(fetchLimit),
              cq
            ]);

            if (uErr) return { success: false, error: uErr.message };

            // Re-ranking por cobertura de términos (name pesa más que description).
            let finalItems = uItems || [];
            if (qTerms.length > 0 && finalItems.length > 0) {
              const score = (it) => {
                const name = (it.name || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
                const desc = (it.description || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
                let s = 0;
                for (const t of qTerms) {
                  if (name.includes(t)) s += 2;
                  else if (desc.includes(t)) s += 1;
                }
                return s;
              };
              finalItems = finalItems
                .map(it => ({ it, s: score(it) }))
                .sort((a, b) => b.s - a.s || (new Date(b.it.updated_at) - new Date(a.it.updated_at)))
                .slice(0, limit)
                .map(x => x.it);
            }

            // ── BULK HINT: si hay más resultados de los que se devuelven, avisar al modelo ──
            const BULK_THRESHOLD = 15; // si hay más de esto, sugerir acción bulk
            let bulkHint = null;
            if (totalAvailable > BULK_THRESHOLD && totalAvailable > finalItems.length) {
              if (parameters.dataset_id) {
                bulkHint = `AVISO: Solo se devuelven ${finalItems.length} de ${totalAvailable} items disponibles. Para obtener TODOS usa action='list_by_dataset' con dataset_id='${parameters.dataset_id}' (devuelve 50 por página, compacto). Esta es una búsqueda parcial.`;
              } else {
                const filterSuggestion = parameters.tipo
                  ? `action='filter_universe' con tipo='${parameters.tipo}'${parameters.tags?.length ? ` y tags=${JSON.stringify(parameters.tags)}` : ''}`
                  : `action='filter_universe' con tipo y/o tags para acotar`;
                bulkHint = `AVISO: Solo se devuelven ${finalItems.length} de ${totalAvailable} items disponibles. Para obtener todos usa ${filterSuggestion} (devuelve hasta 200, compacto). Esta es una búsqueda parcial.`;
              }
              console.log(`📦 [CODEX] bulk_hint activado: ${finalItems.length}/${totalAvailable} items`);
            }

            // Also search for related datasets (public + private)
            let relatedDatasets = [];
            if (query) {
              try {
                const [pubDs, privDs] = await Promise.all([
                  supabase.from('public_datasets')
                    .select('id, name, description, row_count, tags, schema_definition')
                    .eq('owner_id', user.id)
                    .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
                    .limit(5),
                  supabase.from('private_datasets')
                    .select('id, name, description, row_count, tags, schema_definition')
                    .eq('owner_id', user.id)
                    .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
                    .limit(5)
                ]);
                relatedDatasets = [...(pubDs.data || []), ...(privDs.data || [])];
              } catch (dsErr) {
                console.warn('[CODEX] ⚠️ Error searching related datasets:', dsErr.message);
              }
            }

            // Build formatted response including both universe items and datasets
            let formattedParts = [];
            if (bulkHint) {
              // Ponerlo al frente y de forma imperativa para que GLM lo obedezca
              formattedParts.push(`⚠️ ACCIÓN REQUERIDA: ${bulkHint}\nNO hagas más search_universe — usa la acción indicada arriba en tu próxima llamada.`);
            }
            if (finalItems.length > 0) {
              formattedParts.push(`Muestra parcial (${finalItems.length} de ${totalAvailable || finalItems.length} totales):\n${finalItems.slice(0, 8).map(i => `- [${i.tipo}] ${i.name}${i.description ? ': ' + i.description.slice(0, 100) : ''}`).join('\n')}`);
            }
            if (relatedDatasets.length > 0) {
              formattedParts.push(`Datasets relacionados:\n${relatedDatasets.map(d => `- "${d.name}" (${d.row_count} filas)${d.description ? ': ' + d.description : ''} [ID: ${d.id}]`).join('\n')}\nPuedes usar el tool "datasets" con action=get y dataset_id para ver los datos completos.`);
            }

            return {
              success: true,
              action: 'search_universe',
              query,
              tipo: parameters.tipo || 'all',
              total_available: totalAvailable || finalItems.length,
              total_returned: finalItems.length,
              is_partial: totalAvailable > finalItems.length,
              bulk_hint: bulkHint,
              items: finalItems,
              related_datasets: relatedDatasets,
              formatted_response: formattedParts.length > 0
                ? formattedParts.join('\n\n')
                : `No encontré items que coincidan con "${query || 'todos'}" en el universo.`,
              metadata: { service: 'codex_universe', timestamp: new Date().toISOString() }
            };
          }

          case 'get_universe_item': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            if (!parameters.item_id) return { success: false, error: 'item_id es requerido' };

            const [itemRes, relsRes] = await Promise.all([
              supabase
                .from('codex_universe_items')
                .select('*')
                .eq('id', parameters.item_id)
                .eq('user_id', user.id)
                .single(),
              supabase
                .from('codex_relations')
                .select('id, subject_id, verb, object_id, note, date, created_at')
                .eq('user_id', user.id)
                .or(`subject_id.eq.${parameters.item_id},object_id.eq.${parameters.item_id}`)
            ]);

            if (itemRes.error) return { success: false, error: itemRes.error.message };
            const item = itemRes.data;
            const rels = relsRes.data || [];

            // Fetch names of related items
            const relatedIds = [...new Set(rels.map(r => r.subject_id === parameters.item_id ? r.object_id : r.subject_id))];
            let relatedNames = {};
            if (relatedIds.length > 0) {
              const { data: relItems } = await supabase
                .from('codex_universe_items')
                .select('id, name, tipo')
                .in('id', relatedIds);
              (relItems || []).forEach(r => { relatedNames[r.id] = `[${r.tipo}] ${r.name}`; });
            }

            const relsFormatted = rels.map(r => {
              const isSubject = r.subject_id === parameters.item_id;
              const otherId = isSubject ? r.object_id : r.subject_id;
              return {
                id: r.id,
                direction: isSubject ? 'outgoing' : 'incoming',
                verb: r.verb,
                other_item_id: otherId,
                other_item_name: relatedNames[otherId] || otherId,
                note: r.note,
                date: r.date
              };
            });

            const detailsText = item.details && Object.keys(item.details).length > 0
              ? '\nDetalles: ' + Object.entries(item.details)
                  .filter(([k]) => k !== 'flag')
                  .map(([k, v]) => {
                    if (v && typeof v === 'object' && !Array.isArray(v)) {
                      if ('amount' in v) return `${k}: ${v.amount} ${v.cur}`;
                      if ('from' in v)   return `${k}: ${v.from} → ${v.to}`;
                      if ('value' in v)  return `${k}: ${v.value} [${(v.poles||[]).join('/')}]`;
                      if ('name' in v)   return `${k}: ${v.name} (${v.tipo})`;
                      return `${k}: ${JSON.stringify(v)}`;
                    }
                    if (Array.isArray(v)) return `${k}: ${v.map(i => i?.name || i).join(', ')}`;
                    return `${k}: ${v}`;
                  }).join(', ')
              : '';
            const mentionsText = (item.mentions || []).length > 0
              ? `\nMenciones: ${item.mentions.length} registradas (última: ${item.mentions[item.mentions.length - 1]?.fuente || 'desconocida'})`
              : '';
            const relsText = relsFormatted.length > 0
              ? `\nRelaciones:\n${relsFormatted.map(r => `  - ${r.direction === 'outgoing' ? item.name + ' → ' + r.verb + ' → ' + r.other_item_name : r.other_item_name + ' → ' + r.verb + ' → ' + item.name}`).join('\n')}`
              : '\nSin relaciones.';

            const resolved = await resolveItemFields(supabase, user.id, item);

            return {
              success: true,
              action: 'get_universe_item',
              item: {
                ...item,
                resolved_fields: resolved.fields,
                relations: relsFormatted
              },
              formatted_response: `[${item.tipo}] ${item.name}\n${item.description || 'Sin descripción'}${detailsText}${mentionsText}${relsText}`,
              metadata: { service: 'codex_universe', timestamp: new Date().toISOString() }
            };
          }

          case 'get_relations': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };

            let rq = supabase
              .from('codex_relations')
              .select('id, subject_id, verb, object_id, note, date, created_at')
              .eq('user_id', user.id);

            if (parameters.item_id) {
              rq = rq.or(`subject_id.eq.${parameters.item_id},object_id.eq.${parameters.item_id}`);
            }

            const { data: rels, error: relErr } = await rq
              .order('created_at', { ascending: false })
              .limit(limit);

            if (relErr) return { success: false, error: relErr.message };

            // Fetch names for all subjects and objects
            const allIds = [...new Set((rels || []).flatMap(r => [r.subject_id, r.object_id]))];
            let names = {};
            if (allIds.length > 0) {
              const { data: nameItems } = await supabase
                .from('codex_universe_items')
                .select('id, name, tipo')
                .in('id', allIds);
              (nameItems || []).forEach(i => { names[i.id] = `[${i.tipo}] ${i.name}`; });
            }

            const relsFormatted = (rels || []).map(r => ({
              id: r.id,
              subject: names[r.subject_id] || r.subject_id,
              verb: r.verb,
              object: names[r.object_id] || r.object_id,
              note: r.note,
              date: r.date
            }));

            return {
              success: true,
              action: 'get_relations',
              total: relsFormatted.length,
              relations: relsFormatted,
              formatted_response: relsFormatted.length > 0
                ? `${relsFormatted.length} relaciones:\n${relsFormatted.map(r => `- ${r.subject} → ${r.verb} → ${r.object}${r.note ? ' (' + r.note + ')' : ''}`).join('\n')}`
                : 'No hay relaciones registradas.',
              metadata: { service: 'codex_universe', timestamp: new Date().toISOString() }
            };
          }

          // ── UNIVERSE: WRITE ──────────────────────────────────────────────
          case 'create_universe_item': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            if (!parameters.tipo) return { success: false, error: 'tipo es requerido' };
            if (!parameters.name) return { success: false, error: 'name es requerido' };

            // Acepta variantes razonables ("persona"→Actor, "organizacion"→Entidad)
            // en vez de rechazarlas: el error crudo de constraint no le sirve a nadie.
            const { tipo: tipoCanon, corregido: tipoCorregido } = normalizeTipo(parameters.tipo);
            if (!tipoCanon) {
              return { success: false, error: `tipo inválido: "${parameters.tipo}". Debe ser uno de: ${TIPOS_VALIDOS.join(', ')}. (Actor = persona · Entidad = organización · Territorio = lugar · Historia = concepto/narrativa)` };
            }
            if (tipoCorregido) console.log(`🔧 [CODEX] tipo normalizado: "${parameters.tipo}" → "${tipoCanon}"`);

            if (parameters.details && Object.keys(parameters.details).length) {
              return { success: false, error: 'details es legacy. Usa fields keyed por field_key; ejecuta resolve_field antes de escribir.' };
            }
            if (tipoCanon === 'Source') {
              const item = await createSource(supabase, user.id, parameters);
              return { success: true, action: 'create_universe_item', item, formatted_response: `✓ Source creada: ${item.name} (${item.id})` };
            }
            const prepared = await prepareFieldPatch(supabase, user.id, tipoCanon, parameters.fields || {});
            const presetResult = await applyPresetKeys(supabase, user.id, tipoCanon, parameters.preset_keys || []);

            const insertRow = {
              user_id: user.id,
              tipo: tipoCanon,
              name: parameters.name,
              description: parameters.description || null,
              tags: parameters.tags || [],
              aliases: parameters.aliases || [],
              details: prepared.storageDelta,
              field_keys: [...new Set([...prepared.fieldKeys, ...presetResult.fieldKeys])],
              preset_keys: presetResult.presetKeys,
              mentions: []
            };
            // Todo geo de Territorio entra por el contrato v2. Para otros tipos se
            // conserva el comportamiento previo porque Evento/Actor también pueden
            // tener campos geográficos sin convertirse en Territorio.
            if (parameters.geo && typeof parameters.geo === 'object') {
              insertRow.geo = tipoCanon === 'Territorio'
                ? normalizeTerritoryGeo(parameters.geo, { allowOfficial: false })
                : parameters.geo;
            }

            const { data: newItem, error: createErr } = await supabase
              .from('codex_universe_items')
              .insert(insertRow)
              .select()
              .single();

            if (createErr) return { success: false, error: createErr.message };

            return {
              success: true,
              action: 'create_universe_item',
              item: newItem,
              formatted_response: `✓ Item creado: [${newItem.tipo}] ${newItem.name} (ID: ${newItem.id})`,
              metadata: { service: 'codex_universe', timestamp: new Date().toISOString() }
            };
          }

          // ── CODEX: guardar texto libre como Snippet ──
          // ── PROGRESIONES: línea de tiempo del item ────────────────────────
          // Separan los ATRIBUTOS estables del actor (cargo, partido → details)
          // de las COSAS PUNTUALES que hizo o le pasaron (con fecha → aquí).
          case 'add_progresion': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            if (!parameters.item_id) return { success: false, error: 'item_id es requerido (el actor/entidad al que pertenece la progresión)' };
            const p = parameters.progresion || {};
            if (!p.titulo || !String(p.titulo).trim()) {
              return { success: false, error: 'progresion.titulo es requerido (qué pasó, en una línea y en pasado)' };
            }

            // Ownership del item
            const { data: dueño } = await supabase.from('codex_universe_items')
              .select('id, name, tipo').eq('id', parameters.item_id).eq('user_id', user.id).single();
            if (!dueño) return { success: false, error: 'Item no encontrado o no tienes acceso' };

            const TIPOS_PROG = ['accion', 'suceso', 'declaracion', 'nombramiento', 'legal', 'otro'];
            const tipoProg = TIPOS_PROG.includes(p.tipo) ? p.tipo : 'otro';

            // ref_id solo si el item existe y es del usuario (no inventar UUIDs)
            let refId = null;
            if (p.ref_id) {
              const { data: ref } = await supabase.from('codex_universe_items')
                .select('id').eq('id', p.ref_id).eq('user_id', user.id).maybeSingle();
              refId = ref ? ref.id : null;
            }

            const { data: creada, error: progErr } = await supabase
              .from('codex_progresiones')
              .insert({
                user_id: user.id,
                item_id: parameters.item_id,
                titulo: String(p.titulo).slice(0, 300),
                fecha: p.fecha ? String(p.fecha).slice(0, 20) : null,
                descripcion: p.descripcion ? String(p.descripcion).slice(0, 3000) : null,
                tipo: tipoProg,
                ref_id: refId,
                fuente: p.fuente ? String(p.fuente).slice(0, 500) : null,
                orden: Number.isInteger(p.orden) ? p.orden : 0,
              })
              .select('id, titulo, fecha, tipo, ref_id')
              .single();
            if (progErr) return { success: false, error: progErr.message };

            return {
              success: true,
              action: 'add_progresion',
              progresion: creada,
              formatted_response: `✓ Progresión agregada a ${dueño.name}: [${creada.fecha || 'sin fecha'}] ${creada.titulo}` +
                (p.ref_id && !refId ? ' (ojo: el ref_id no existe en tu Codex, se guardó sin referencia)' : ''),
              metadata: { service: 'codex_progresiones', timestamp: new Date().toISOString() }
            };
          }

          case 'get_progresiones': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            if (!parameters.item_id) return { success: false, error: 'item_id es requerido' };

            const { data: prog, error: gErr } = await supabase
              .from('codex_progresiones')
              .select('id, fecha, titulo, descripcion, tipo, ref_id, fuente, orden')
              .eq('user_id', user.id)
              .eq('item_id', parameters.item_id)
              .order('fecha', { ascending: false, nullsFirst: false })
              .order('orden', { ascending: true })
              .limit(200);
            if (gErr) return { success: false, error: gErr.message };

            const lista = prog || [];
            // Resolver nombres de los items referenciados en una sola consulta
            const refIds = [...new Set(lista.map(x => x.ref_id).filter(Boolean))];
            let nombres = {};
            if (refIds.length) {
              const { data: refs } = await supabase.from('codex_universe_items')
                .select('id, name, tipo').in('id', refIds);
              for (const r of refs || []) nombres[r.id] = { name: r.name, tipo: r.tipo };
            }

            return {
              success: true,
              action: 'get_progresiones',
              total: lista.length,
              progresiones: lista.map(x => ({ ...x, ref: x.ref_id ? nombres[x.ref_id] || null : null })),
              formatted_response: lista.length
                ? `Línea de tiempo (${lista.length}):\n` + lista.map(x =>
                    `- [${x.fecha || 's/f'}] (${x.tipo}) ${x.titulo}` +
                    (x.ref_id && nombres[x.ref_id] ? ` → ${nombres[x.ref_id].name}` : '')
                  ).join('\n')
                : 'Este item no tiene progresiones registradas.',
              metadata: { service: 'codex_progresiones', timestamp: new Date().toISOString() }
            };
          }

          case 'delete_progresion': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            if (!parameters.progresion_id) return { success: false, error: 'progresion_id es requerido' };
            const { data: borrada, error: dErr } = await supabase
              .from('codex_progresiones')
              .delete()
              .eq('id', parameters.progresion_id)
              .eq('user_id', user.id)
              .select('id, titulo')
              .maybeSingle();
            if (dErr) return { success: false, error: dErr.message };
            if (!borrada) return { success: false, error: 'Progresión no encontrada o no tienes acceso' };
            return {
              success: true, action: 'delete_progresion',
              formatted_response: `✓ Progresión eliminada: "${borrada.titulo}"`,
              metadata: { service: 'codex_progresiones', timestamp: new Date().toISOString() }
            };
          }

          case 'create_note': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            const contenido = parameters.content ?? parameters.description ?? parameters.note;
            if (!contenido || !String(contenido).trim()) {
              return { success: false, error: 'content es requerido (el texto del snippet)' };
            }
            const nombre = (parameters.name && parameters.name.trim())
              ? parameters.name.trim().slice(0, 200)
              : `Snippet — ${new Date().toLocaleDateString('es-GT')}`;
            const { data: snip, error: snErr } = await supabase
              .from('codex_universe_items')
              .insert({
                user_id: user.id,
                tipo: 'Snippet',
                name: nombre,
                description: String(contenido),
                tags: Array.isArray(parameters.tags) ? parameters.tags : [],
                aliases: [],
                details: {},
                mentions: [],
              })
              .select('id, name')
              .single();
            if (snErr) return { success: false, error: snErr.message };

            return {
              success: true,
              action: 'create_note',
              item: snip,
              formatted_response: `✓ Snippet guardado en el Codex: "${snip.name}" (ID: ${snip.id})`,
              metadata: { service: 'codex_universe', timestamp: new Date().toISOString() }
            };
          }

          case 'update_universe_item': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            if (!parameters.item_id) return { success: false, error: 'item_id es requerido' };

            // Build partial update — only include fields that were provided
            const partial = {};
            if (parameters.name !== undefined)        partial.name        = parameters.name;
            if (parameters.tags !== undefined)        partial.tags        = parameters.tags;
            if (parameters.aliases !== undefined)     partial.aliases     = parameters.aliases;
            // Accept 'description' or 'note' (LLM sometimes uses 'note' for text updates)
            const descValue = parameters.description ?? parameters.note;
            if (descValue !== undefined)              partial.description = descValue;
            partial.updated_at = new Date().toISOString();

            // Verify ownership before update and fetch existing details for merge.
            // Se trae 'tipo' para resolver el preset correcto en la normalización.
            const { data: existing } = await supabase
              .from('codex_universe_items')
              .select('id, name, tipo, is_profile, details, field_keys, preset_keys')
              .eq('id', parameters.item_id)
              .eq('user_id', user.id)
              .single();

            if (!existing) return { success: false, error: 'Item no encontrado o no tienes acceso' };

            if (existing.tipo === 'Source') {
              const item = await updateSource(supabase, user.id, existing.id, { ...parameters, description: descValue });
              return { success: true, action: 'update_universe_item', item, formatted_response: `✓ Source actualizada: ${item.name}` };
            }
            if (existing.tipo === 'Actor' && existing.is_profile === true) {
              const item = await updateProfile(supabase, user.id, existing.id, { ...parameters, description: descValue });
              return { success: true, action: 'update_universe_item', item, formatted_response: `✓ Perfil actualizado: ${item.name}` };
            }

            // geo se valida después de conocer el tipo real del item. null sigue
            // siendo una operación explícita para retirar su representación.
            if (parameters.geo !== undefined) {
              partial.geo = existing.tipo === 'Territorio'
                ? normalizeTerritoryGeo(parameters.geo, { allowNull: true, allowOfficial: false })
                : parameters.geo;
            }

            if (parameters.details && Object.keys(parameters.details).length) {
              return { success: false, error: 'details es legacy. Usa fields keyed por field_key; ejecuta resolve_field antes de escribir.' };
            }
            if (parameters.fields !== undefined || parameters.preset_keys !== undefined) {
              const prepared = await prepareFieldPatch(supabase, user.id, existing.tipo, parameters.fields || {});
              const presetResult = parameters.preset_keys === undefined
                ? { presetKeys: existing.preset_keys || [], fieldKeys: [] }
                : await applyPresetKeys(supabase, user.id, existing.tipo, parameters.preset_keys);
              partial.details = { ...(existing.details || {}), ...prepared.storageDelta };
              delete partial.details.flag;
              partial.field_keys = [...new Set([...(existing.field_keys || []), ...prepared.fieldKeys, ...presetResult.fieldKeys])];
              partial.preset_keys = presetResult.presetKeys;
            }

            const { data: updated, error: updErr } = await supabase
              .from('codex_universe_items')
              .update(partial)
              .eq('id', parameters.item_id)
              .select()
              .single();

            if (updErr) return { success: false, error: updErr.message };

            return {
              success: true,
              action: 'update_universe_item',
              item: updated,
              formatted_response: `✓ Item actualizado: ${updated.name} — campos: ${Object.keys(partial).filter(k => k !== 'updated_at').join(', ')}`,
              metadata: { service: 'codex_universe', timestamp: new Date().toISOString() }
            };
          }

          case 'add_relation': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            if (!parameters.subject_id) return { success: false, error: 'subject_id es requerido' };
            if (!parameters.verb)       return { success: false, error: 'verb es requerido' };
            if (!parameters.object_id)  return { success: false, error: 'object_id es requerido' };

            // Verify both items belong to this user
            const { data: ownerCheck } = await supabase
              .from('codex_universe_items')
              .select('id, name, tipo')
              .eq('user_id', user.id)
              .in('id', [parameters.subject_id, parameters.object_id]);

            if (!ownerCheck || ownerCheck.length < 2) {
              return { success: false, error: 'Uno o ambos items no existen o no tienes acceso' };
            }

            const { data: newRel, error: relCreateErr } = await supabase
              .from('codex_relations')
              .insert({
                user_id: user.id,
                subject_id: parameters.subject_id,
                verb: parameters.verb,
                object_id: parameters.object_id,
                note: parameters.note || null,
                date: parameters.date || null
              })
              .select()
              .single();

            if (relCreateErr) return { success: false, error: relCreateErr.message };

            const subjectItem = ownerCheck.find(i => i.id === parameters.subject_id);
            const objectItem  = ownerCheck.find(i => i.id === parameters.object_id);

            return {
              success: true,
              action: 'add_relation',
              relation: newRel,
              formatted_response: `✓ Relación creada: [${subjectItem?.tipo}] ${subjectItem?.name} → ${parameters.verb} → [${objectItem?.tipo}] ${objectItem?.name}`,
              metadata: { service: 'codex_universe', timestamp: new Date().toISOString() }
            };
          }

          case 'delete_relation': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            if (!parameters.relation_id) return { success: false, error: 'relation_id es requerido' };

            const { error: delErr } = await supabase
              .from('codex_relations')
              .delete()
              .eq('id', parameters.relation_id)
              .eq('user_id', user.id);

            if (delErr) return { success: false, error: delErr.message };

            return {
              success: true,
              action: 'delete_relation',
              formatted_response: `✓ Relación eliminada (ID: ${parameters.relation_id})`,
              metadata: { service: 'codex_universe', timestamp: new Date().toISOString() }
            };
          }

          // ─── BULK READ: filter_universe ──────────────────────────────
          // Filtra por tipo, tags y/o un campo de details. Solo devuelve
          // campos básicos (id, name, tipo, tags + campos clave de details)
          // para no explotar el contexto cuando hay muchos resultados.
          case 'filter_universe': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };

            const bulkLimit = Math.min(parameters.limit || 50, 200);
            let fq = supabase
              .from('codex_universe_items')
              .select('id, name, tipo, tags, details')
              .eq('user_id', user.id);

            if (parameters.tipo) fq = fq.ilike('tipo', parameters.tipo);

            // Filtrar por tags (debe contener TODOS los tags indicados)
            if (parameters.tags && Array.isArray(parameters.tags) && parameters.tags.length > 0) {
              fq = fq.contains('tags', parameters.tags);
            }

            // Filtrar por dataset_id
            if (parameters.dataset_id) {
              fq = fq.contains('details', { datasets: [parameters.dataset_id] });
            }

            const { data: fItems, error: fErr, count: fCount } = await fq
              .order('name', { ascending: true })
              .limit(bulkLimit);

            if (fErr) return { success: false, error: fErr.message };

            // Post-filtro por details (igualdad de campo)
            let filtered = fItems || [];
            if (parameters.filter_details && typeof parameters.filter_details === 'object') {
              for (const [k, v] of Object.entries(parameters.filter_details)) {
                filtered = filtered.filter(it => {
                  const val = it.details?.[k];
                  if (typeof val === 'string') return val.toLowerCase().includes(String(v).toLowerCase());
                  return val === v;
                });
              }
            }

            // Devolver resumen compacto (solo campos básicos + Cargo/Partido/Distrito si existen)
            const summary = filtered.map(it => ({
              id: it.id,
              name: it.name,
              tipo: it.tipo,
              tags: (it.tags || []).slice(0, 5),
              cargo: it.details?.Cargo || it.details?.['Rol / función'] || null,
              partido: it.details?.Partido || null,
              distrito: it.details?.Distrito || null,
              estado: it.details?.Estado || null,
            }));

            console.log(`📚 [CODEX] filter_universe → ${summary.length} items (tipo=${parameters.tipo || 'all'}, dataset=${parameters.dataset_id || '-'}, details_filter=${JSON.stringify(parameters.filter_details || {})})`);

            return {
              success: true,
              action: 'filter_universe',
              total: summary.length,
              truncated: filtered.length >= bulkLimit,
              items: summary,
              note: summary.length >= bulkLimit ? `Resultado truncado a ${bulkLimit}. Usa page o filter_details para acotar más.` : null,
              formatted_response: `Encontré ${summary.length} items${parameters.tipo ? ' de tipo ' + parameters.tipo : ''}:\n${summary.slice(0, 20).map(i => `- [${i.id}] ${i.name}${i.partido ? ' (' + i.partido + ')' : ''}${i.distrito ? ' — ' + i.distrito : ''}`).join('\n')}${summary.length > 20 ? `\n... y ${summary.length - 20} más.` : ''}`,
              metadata: { service: 'codex_universe', timestamp: new Date().toISOString() }
            };
          }

          // ─── BULK READ: list_by_dataset ──────────────────────────────
          // Lista TODOS los items vinculados a un dataset, paginados de 50 en 50.
          // Solo devuelve campos básicos (id, name, tipo, campos clave).
          case 'list_by_dataset': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            if (!parameters.dataset_id) return { success: false, error: 'dataset_id es requerido para list_by_dataset' };

            const pageSize = 50;
            const page = Math.max(1, parameters.page || 1);
            const offset = (page - 1) * pageSize;

            const { data: dsItems, error: dsErr, count: dsTotal } = await supabase
              .from('codex_universe_items')
              .select('id, name, tipo, tags, details', { count: 'exact' })
              .eq('user_id', user.id)
              .contains('details', { datasets: [parameters.dataset_id] })
              .order('name', { ascending: true })
              .range(offset, offset + pageSize - 1);

            if (dsErr) return { success: false, error: dsErr.message };

            const summary = (dsItems || []).map(it => ({
              id: it.id,
              name: it.name,
              tipo: it.tipo,
              tags: (it.tags || []).slice(0, 5),
              cargo: it.details?.Cargo || it.details?.['Rol / función'] || null,
              partido: it.details?.Partido || null,
              distrito: it.details?.Distrito || null,
              estado: it.details?.Estado || null,
            }));

            const totalPages = Math.ceil((dsTotal || 0) / pageSize);
            console.log(`📚 [CODEX] list_by_dataset → dataset=${parameters.dataset_id}, page=${page}/${totalPages}, items=${summary.length}/${dsTotal}`);

            return {
              success: true,
              action: 'list_by_dataset',
              dataset_id: parameters.dataset_id,
              page,
              total_pages: totalPages,
              total_items: dsTotal || 0,
              items: summary,
              has_more: page < totalPages,
              formatted_response: `Dataset ${parameters.dataset_id} — Página ${page}/${totalPages} (${dsTotal} items totales):\n${summary.map(i => `- [${i.id}] ${i.name}${i.partido ? ' (' + i.partido + ')' : ''}${i.distrito ? ' — ' + i.distrito : ''}`).join('\n')}${page < totalPages ? `\n\nHay más items — usa page=${page + 1} para continuar.` : ''}`,
              metadata: { service: 'codex_universe', timestamp: new Date().toISOString() }
            };
          }

          // ─── BULK READ: lookup_by_names ──────────────────────────────
          // Busca una lista de nombres (exacto o fuzzy) en el Codex.
          // Útil cuando tienes una lista de personas y quieres saber
          // cuáles están mapeadas y obtener sus IDs.
          // Solo devuelve campos básicos por match.
          case 'lookup_by_names': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            if (!parameters.names || !Array.isArray(parameters.names) || parameters.names.length === 0) {
              return { success: false, error: 'names (array de strings) es requerido para lookup_by_names' };
            }

            const names = parameters.names.slice(0, 100); // máx 100 nombres por llamada

            // Buscar cada nombre con ilike para fuzzy match
            // Construimos un OR de todos los nombres
            const orClauses = names.map(n => `name.ilike.%${n.trim().replace(/[%]/g, '')}%`).join(',');

            const { data: lItems, error: lErr } = await supabase
              .from('codex_universe_items')
              .select('id, name, tipo, tags, details')
              .eq('user_id', user.id)
              .or(orClauses)
              .limit(Math.min(names.length * 3, 200)); // margen para fuzzy matches múltiples

            if (lErr) return { success: false, error: lErr.message };

            // Para cada nombre buscado, encontrar el mejor match
            function normalize(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); }

            const results = names.map(searchName => {
              const normSearch = normalize(searchName);
              // Primero buscar match exacto, luego partial
              const exact = (lItems || []).find(it => normalize(it.name) === normSearch);
              const partial = !exact ? (lItems || []).find(it => normalize(it.name).includes(normSearch) || normSearch.includes(normalize(it.name))) : null;
              const match = exact || partial;
              return {
                searched: searchName,
                found: !!match,
                match_type: exact ? 'exact' : (partial ? 'partial' : null),
                id: match?.id || null,
                name: match?.name || null,
                tipo: match?.tipo || null,
                cargo: match?.details?.Cargo || match?.details?.['Rol / función'] || null,
                partido: match?.details?.Partido || null,
                distrito: match?.details?.Distrito || null,
              };
            });

            const found = results.filter(r => r.found);
            const notFound = results.filter(r => !r.found);

            console.log(`📚 [CODEX] lookup_by_names → buscados=${names.length}, encontrados=${found.length}, no_encontrados=${notFound.length}`);

            return {
              success: true,
              action: 'lookup_by_names',
              searched: names.length,
              found_count: found.length,
              not_found_count: notFound.length,
              results,
              not_found_names: notFound.map(r => r.searched),
              formatted_response: `Lookup de ${names.length} nombres:\n✅ Encontrados (${found.length}): ${found.map(r => `${r.name} [${r.id}]`).join(', ')}\n❌ No encontrados (${notFound.length}): ${notFound.map(r => r.searched).join(', ')}`,
              metadata: { service: 'codex_universe', timestamp: new Date().toISOString() }
            };
          }

          // ─── RECONCILE: reconcile_dataset ────────────────────────────
          // Responde de forma DETERMINÍSTICA la pregunta "¿están todos los X
          // del dataset mapeados en el codex?". Hace el JOIN dataset↔codex
          // del lado del servidor: compara las filas del dataset (fuente de
          // verdad) contra los items del codex vinculados. Devuelve conteos,
          // faltantes y facetas — payload chico. UNA sola llamada.
          case 'reconcile_dataset': {
            const supabase = require('../utils/supabase');
            if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
            if (!parameters.dataset_id) return { success: false, error: 'dataset_id es requerido para reconcile_dataset' };
            const dsId = parameters.dataset_id;

            // 1. Traer el dataset (público u privado)
            let ds = null;
            const { data: pub } = await supabase.from('public_datasets')
              .select('id, name, json_data, codex_match_column, row_count')
              .eq('id', dsId).eq('owner_id', user.id).maybeSingle();
            ds = pub;
            if (!ds) {
              const { data: priv } = await supabase.from('private_datasets')
                .select('id, name, json_data, codex_match_column, row_count')
                .eq('id', dsId).eq('owner_id', user.id).maybeSingle();
              ds = priv;
            }
            if (!ds) return { success: false, error: `Dataset ${dsId} no encontrado para este usuario` };

            const rows = Array.isArray(ds.json_data) ? ds.json_data : [];
            // Detectar columna de match (nombre) — usa la configurada o la infiere
            const firstRow = rows[0] || {};
            const matchCol = ds.codex_match_column
              || ['nombre', 'name', 'nombre_completo', 'Nombre'].find(k => k in firstRow)
              || Object.keys(firstRow)[0];

            // 2. Traer TODOS los items del codex vinculados al dataset
            const { data: codexItems, error: cErr } = await supabase
              .from('codex_universe_items')
              .select('id, name, tipo, details')
              .eq('user_id', user.id)
              .contains('details', { datasets: [dsId] });
            if (cErr) return { success: false, error: cErr.message };

            const norm = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
            const codexNames = new Set((codexItems || []).map(it => norm(it.name)));

            // 3. Diff: filas del dataset que NO están mapeadas
            const missing = [];
            const facetPartido = {};
            for (const r of rows) {
              const rowName = r[matchCol];
              const mapped = codexNames.has(norm(rowName));
              if (!mapped) missing.push(rowName);
              // faceta por partido (si existe la columna)
              const p = r.partido || r.Partido || 'Sin partido';
              if (!facetPartido[p]) facetPartido[p] = { total: 0, mapeados: 0 };
              facetPartido[p].total++;
              if (mapped) facetPartido[p].mapeados++;
            }

            const totalRows = rows.length;
            const mappedCount = totalRows - missing.length;
            // items del codex que no matchean ninguna fila (huérfanos / mal nombrados)
            const rowNamesSet = new Set(rows.map(r => norm(r[matchCol])));
            const orphans = (codexItems || []).filter(it => !rowNamesSet.has(norm(it.name)));

            console.log(`📊 [CODEX] reconcile_dataset "${ds.name}" → ${mappedCount}/${totalRows} mapeados, ${missing.length} faltantes, ${orphans.length} huérfanos`);

            const facetLines = Object.entries(facetPartido)
              .sort((a, b) => b[1].total - a[1].total)
              .map(([p, v]) => `  · ${p}: ${v.mapeados}/${v.total}`).join('\n');

            return {
              success: true,
              action: 'reconcile_dataset',
              dataset_id: dsId,
              dataset_name: ds.name,
              match_column: matchCol,
              total_rows: totalRows,
              mapped: mappedCount,
              missing_count: missing.length,
              missing_names: missing.slice(0, 100),
              orphan_count: orphans.length,
              orphan_names: orphans.slice(0, 30).map(o => o.name),
              complete: missing.length === 0,
              facets_by_partido: facetPartido,
              formatted_response: `Reconciliación de "${ds.name}":\n` +
                `• ${mappedCount}/${totalRows} mapeados en el codex${missing.length === 0 ? ' ✅ COMPLETO' : ''}\n` +
                (missing.length > 0 ? `• ${missing.length} FALTANTES: ${missing.slice(0, 20).join(', ')}${missing.length > 20 ? ` ... (+${missing.length - 20})` : ''}\n` : '') +
                (orphans.length > 0 ? `• ${orphans.length} items en codex que no matchean ninguna fila (posibles mal nombrados)\n` : '') +
                `• Por partido:\n${facetLines}`,
              metadata: { service: 'codex_universe', timestamp: new Date().toISOString() }
            };
          }

          default:
            return { success: false, error: `Acción desconocida para codex: ${action}` };
        }
      }

      // ===================================================================
      // TOOL: DATA_OPS - Motor de data masiva (operaciones POR REFERENCIA)
      // ===================================================================
      // Simulación multiagente "Oasis compartido": el servidor lleva el estado,
      // el modelo que llama actúa cada persona. Ver services/simulacion.js.
      case 'simular': {
        if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
        const { ejecutarSimulacion } = require('./simulacion');
        console.log(`🎭 [SIMULAR] operation=${parameters.operation} | sim=${parameters.sim_id || 'nueva'} | user=${user.id}`);
        return await ejecutarSimulacion(parameters, user);
      }

      case 'data_ops': {
        const supabase = require('../utils/supabase');
        if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
        const op = parameters.operation;
        const uid = user.id;
        console.log(`⚙️ [DATA_OPS] operation=${op} | dataset=${parameters.source_dataset_id || '-'} tipo=${parameters.source_tipo || '-'} tags=${JSON.stringify(parameters.source_tags || [])} filter=${JSON.stringify(parameters.source_filter || {})}`);

        // ── Resolver de fuente por REFERENCIA: describe QUÉ, resuelve ids server-side.
        // Devuelve items con campos internos (id, name, tipo, details) para uso interno;
        // el modelo NUNCA recibe esto directo en assign/count.
        const _resolveSource = async (opts = {}) => {
          // ids explícitos → resolver directo
          if (Array.isArray(parameters.source_ids) && parameters.source_ids.length > 0) {
            const { data, error } = await supabase.from('codex_universe_items')
              .select('id, name, tipo, details').eq('user_id', uid).in('id', parameters.source_ids.slice(0, 1000));
            if (error) return { error: error.message };
            return { items: data || [] };
          }
          let q = supabase.from('codex_universe_items').select('id, name, tipo, details').eq('user_id', uid);
          if (parameters.source_tipo) q = q.ilike('tipo', parameters.source_tipo);
          if (parameters.source_dataset_id) q = q.contains('details', { datasets: [parameters.source_dataset_id] });
          if (Array.isArray(parameters.source_tags) && parameters.source_tags.length > 0) q = q.contains('tags', parameters.source_tags);
          q = q.order('name', { ascending: true }).limit(opts.cap || 1000);
          let { data, error } = await q;
          if (error) return { error: error.message };
          // Post-filtro por details (igualdad/substring case-insensitive)
          if (parameters.source_filter && typeof parameters.source_filter === 'object') {
            for (const [k, v] of Object.entries(parameters.source_filter)) {
              data = (data || []).filter(it => {
                const val = it.details?.[k];
                if (typeof val === 'string') return val.toLowerCase().includes(String(v).toLowerCase());
                return val === v;
              });
            }
          }
          return { items: data || [] };
        };

        // Resuelve un espacio (free_canvas) por id o nombre
        const _resolveSpace = async (ref) => {
          if (!ref) return null;
          if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref)) {
            const { data } = await supabase.from('free_canvases').select('id, name, data').eq('user_id', uid).eq('id', ref).maybeSingle();
            if (data) return data;
          }
          const { data } = await supabase.from('free_canvases').select('id, name, data').eq('user_id', uid).ilike('name', `%${ref}%`).order('updated_at', { ascending: false }).limit(1);
          return data && data[0] ? data[0] : null;
        };

        switch (op) {
          // ── ASSIGN: mover/asignar items a un espacio o proyecto (por referencia) ──
          case 'assign': {
            const { items, error } = await _resolveSource();
            if (error) return { success: false, error };
            if (items.length === 0) return { success: false, error: 'La fuente no resolvió ningún item. Revisa source_dataset_id / source_tipo / source_filter.' };
            const ids = items.map(it => it.id);

            // Target: espacio
            if (parameters.target_space) {
              const space = await _resolveSpace(parameters.target_space);
              if (!space) return { success: false, error: `No encontré el espacio "${parameters.target_space}".` };
              // Layout en grilla para que no se encimen
              const res = await mutateSpaceData(supabase, uid, space.id, (d) => {
                if (!Array.isArray(d.canvasItems)) d.canvasItems = [];
                if (!d.positions || typeof d.positions !== 'object') d.positions = {};
                const cols = Math.max(1, Math.ceil(Math.sqrt(ids.length)));
                const SPX = 240, SPY = 150, OX = 120, OY = 120;
                let placed = d.canvasItems.length;
                let added = 0;
                for (const id of ids) {
                  if (!d.canvasItems.includes(id)) {
                    d.canvasItems.push(id);
                    const idx = placed++;
                    d.positions[id] = { x: OX + (idx % cols) * SPX, y: OY + Math.floor(idx / cols) * SPY };
                    added++;
                  }
                }
                d.__last_added = added;
              });
              if (res.error) return { success: false, error: res.error };
              console.log(`⚙️ [DATA_OPS] assign → espacio "${space.name}": ${ids.length} items resueltos`);
              return {
                success: true, action: 'data_ops', operation: 'assign', target: 'espacio',
                space: { id: space.id, name: space.name },
                resolved: ids.length,
                formatted_response: `✓ ${ids.length} item(s) asignados al espacio "${space.name}".`,
                metadata: { service: 'data_ops', timestamp: new Date().toISOString() }
              };
            }

            // Target: proyecto (etiqueta project:<id> en tags)
            if (parameters.target_project) {
              const { data: projRow } = /^[0-9a-f-]{36}$/i.test(parameters.target_project)
                ? await supabase.from('projects').select('id, title').eq('user_id', uid).eq('id', parameters.target_project).maybeSingle()
                : await supabase.from('projects').select('id, title').eq('user_id', uid).ilike('title', `%${parameters.target_project}%`).limit(1).maybeSingle();
              if (!projRow) return { success: false, error: `No encontré el proyecto "${parameters.target_project}".` };
              const projTag = `project:${projRow.id}`;
              // Bulk: agregar el tag a cada item que no lo tenga
              let updated = 0;
              for (const it of items) {
                const { data: cur } = await supabase.from('codex_universe_items').select('tags').eq('id', it.id).eq('user_id', uid).maybeSingle();
                const tags = Array.isArray(cur?.tags) ? cur.tags : [];
                if (!tags.includes(projTag)) {
                  await supabase.from('codex_universe_items').update({ tags: [...tags, projTag] }).eq('id', it.id).eq('user_id', uid);
                  updated++;
                }
              }
              console.log(`⚙️ [DATA_OPS] assign → proyecto "${projRow.title}": ${updated}/${ids.length} etiquetados`);
              return {
                success: true, action: 'data_ops', operation: 'assign', target: 'proyecto',
                project: { id: projRow.id, title: projRow.title },
                resolved: ids.length, updated,
                formatted_response: `✓ ${updated} item(s) asignados al proyecto "${projRow.title}".`,
                metadata: { service: 'data_ops', timestamp: new Date().toISOString() }
              };
            }

            return { success: false, error: 'assign requiere target_space o target_project.' };
          }

          // ── COUNT: agregar/agrupar la fuente, devolver solo números ──
          case 'count': {
            const { items, error } = await _resolveSource();
            if (error) return { success: false, error };
            const total = items.length;
            if (!parameters.group_by) {
              return {
                success: true, action: 'data_ops', operation: 'count', total,
                formatted_response: `Total: ${total} items.`,
                metadata: { service: 'data_ops', timestamp: new Date().toISOString() }
              };
            }
            const gb = parameters.group_by;
            const groups = {};
            for (const it of items) {
              const key = gb === 'tipo' ? it.tipo : (it.details?.[gb] ?? 'Sin dato');
              groups[key] = (groups[key] || 0) + 1;
            }
            const sorted = Object.entries(groups).sort((a, b) => b[1] - a[1]);
            return {
              success: true, action: 'data_ops', operation: 'count', total, group_by: gb,
              groups: Object.fromEntries(sorted),
              formatted_response: `Total: ${total}. Por ${gb}:\n${sorted.map(([k, v]) => `  · ${k}: ${v}`).join('\n')}`,
              metadata: { service: 'data_ops', timestamp: new Date().toISOString() }
            };
          }

          // ── FIND: filtrar la fuente, devolver solo ids + campos mínimos ──
          case 'find': {
            const cap = Math.min(parameters.limit || 50, 500);
            const { items, error } = await _resolveSource({ cap: cap + 1 });
            if (error) return { success: false, error };
            const truncated = items.length > cap;
            const slice = items.slice(0, cap).map(it => ({
              id: it.id,
              name: it.name,
              tipo: it.tipo,
              partido: it.details?.Partido || null,
              distrito: it.details?.Distrito || null,
              cargo: it.details?.Cargo || it.details?.['Rol / función'] || null,
            }));
            return {
              success: true, action: 'data_ops', operation: 'find',
              total: slice.length, truncated,
              items: slice,
              formatted_response: `${slice.length} item(s)${truncated ? ` (capado a ${cap})` : ''}:\n${slice.slice(0, 30).map(i => `- [${i.id}] ${i.name}${i.partido ? ' (' + i.partido + ')' : ''}`).join('\n')}${slice.length > 30 ? `\n... y ${slice.length - 30} más en items[].` : ''}`,
              metadata: { service: 'data_ops', timestamp: new Date().toISOString() }
            };
          }

          default:
            return { success: false, error: `Operación desconocida para data_ops: ${op}` };
        }
      }

      // ===================================================================
      // TOOL: MAPA - Fronteras, Territorios (geo), Canvas y vínculos
      // ===================================================================
      case 'mapa': {
        const supabase = require('../utils/supabase');
        if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
        const action = parameters.action;
        const includeGeom = parameters.include_geometry === true;
        console.log(`🗺️ [MAPA] Action: ${action}`);

        switch (action) {
          // ── Leer fronteras administrativas ──
          case 'read_boundaries': {
            let q = supabase.from('map_boundaries')
              .select(includeGeom
                ? 'boundary_id, name, level, parent_id, parent_name, centroid, geometry, country_code, admin_code, source_name, source_url, source_version, curation_status, hierarchy_level, hierarchy_path, hierarchy_profile_version, designation_code, postal_codes'
                : 'boundary_id, name, level, parent_id, parent_name, centroid, country_code, admin_code, source_name, source_url, source_version, curation_status, hierarchy_level, hierarchy_path, hierarchy_profile_version, designation_code, postal_codes');
            if (parameters.level)     q = q.eq('level', parameters.level);
            if (parameters.hierarchy_level != null) q = q.eq('hierarchy_level', Number(parameters.hierarchy_level));
            if (parameters.parent_id) q = q.eq('parent_id', parameters.parent_id);
            if (parameters.name)      q = q.ilike('name', `%${parameters.name}%`);
            q = q.order('name').limit(Math.min(parameters.limit || 50, 400));
            const { data, error } = await q;
            if (error) return { success: false, error: error.message };
            return {
              success: true,
              action: 'read_boundaries',
              count: data.length,
              boundaries: data,
              formatted_response: `✓ ${data.length} fronteras${parameters.level ? ` (${parameters.level})` : ''}${parameters.name ? ` que coinciden con "${parameters.name}"` : ''}`,
              metadata: { service: 'mapa', timestamp: new Date().toISOString() }
            };
          }

          // ── Leer territorios del Codex con geo ──
          case 'read_territorios': {
            let q = supabase.from('codex_universe_items')
              .select('id, name, description, tags, geo, details')
              .eq('user_id', user.id)
              .eq('tipo', 'Territorio');
            if (parameters.name) q = q.ilike('name', `%${parameters.name}%`);
            // Compatibilidad: niveles administrativos siguen en boundary_type;
            // point/place ahora son spatial_role=location.
            if (parameters.level) {
              if (['point', 'place'].includes(parameters.level)) q = q.eq('geo->>spatial_role', 'location');
              else q = q.eq('geo->>boundary_type', parameters.level);
            }
            if (parameters.hierarchy_level != null) {
              q = q.eq('geo->hierarchy->>level', String(Number(parameters.hierarchy_level)));
            }
            if (parameters.spatial_role) q = q.eq('geo->>spatial_role', parameters.spatial_role);
            if (parameters.parent_id) {
              q = q.eq('geo->hierarchy->>parent_id', String(parameters.parent_id));
            }
            q = q.limit(Math.min(parameters.limit || 50, 400));
            const { data, error } = await q;
            if (error) return { success: false, error: error.message };

            const territorios = await Promise.all((data || []).map(async t => {
              // Extraer referencias {id,name,tipo} de details (items vinculados)
              const refs = [];
              if (t.details && typeof t.details === 'object') {
                for (const [key, val] of Object.entries(t.details)) {
                  if (val && typeof val === 'object' && !Array.isArray(val) && 'id' in val && 'name' in val && 'tipo' in val) {
                    refs.push({ key, id: String(val.id), name: String(val.name), tipo: String(val.tipo) });
                  }
                }
              }
              const geo = summarizeTerritoryGeo(t.geo || {});
              let frontierMembership = geo.frontier_membership || null;
              if (geo.spatial_role === 'location') {
                const { data: context, error: contextError } = await supabase.rpc('get_poi_frontier_context', {
                  p_poi_id: t.id,
                });
                if (!contextError) frontierMembership = context;
              }
              return {
                id: t.id,
                name: t.name,
                description: t.description,
                tags: t.tags || [],
                boundary_id: geo.boundary_id || null,
                boundary_type: geo.boundary_type || null,
                schema_version: geo.schema_version || 1,
                spatial_role: geo.spatial_role || null,
                frontier: geo.frontier === true,
                coordinates: geo.anchor || geo.coordinates || null,
                source: geo.source || null,
                curation: geo.curation || null,
                hierarchy: geo.hierarchy || null,
                postal_codes: geo.postal_codes || [],
                frontier_membership: frontierMembership,
                has_geometry: !!geo.geometry,
                ...(includeGeom ? { geometry: geo.geometry || null } : {}),
                linked_items: refs,
              };
            }));
            return {
              success: true,
              action: 'read_territorios',
              count: territorios.length,
              territorios,
              formatted_response: `✓ ${territorios.length} territorios${parameters.name ? ` que coinciden con "${parameters.name}"` : ''}`,
              metadata: { service: 'mapa', timestamp: new Date().toISOString() }
            };
          }

          case 'read_poi_membership': {
            try {
              const item = await territoryService.resolvePoiMembership(
                supabase, user, parameters.item_id
              );
              return {
                success: true,
                action,
                item_id: item.id,
                name: item.name,
                frontier_membership: item.geo?.frontier_membership || null,
                formatted_response: `✓ Contexto territorial resuelto para ${item.name}`,
                metadata: { service: 'mapa', timestamp: new Date().toISOString() }
              };
            } catch (e) {
              return { success: false, error: e.message };
            }
          }

          // ── Crear un Territorio con geometría manual/importada ──
          case 'create_territory': {
            try {
              const rawGeo = {
                ...(parameters.geo || {}),
                ...(parameters.spatial_role ? { spatial_role: parameters.spatial_role } : {}),
              };
              const item = await territoryService.createTerritory(supabase, user, {
                name: parameters.name,
                description: parameters.description,
                tags: parameters.tags,
                geo: rawGeo,
              });
              return {
                success: true, action, item,
                formatted_response: `✓ Territorio creado: ${item.name} (${item.geo?.spatial_role || 'geo'})`,
                metadata: { service: 'mapa', timestamp: new Date().toISOString() }
              };
            } catch (e) {
              return { success: false, error: e.message };
            }
          }

          // ── Crear desde una frontera canónica curada ──
          case 'create_from_boundary': {
            try {
              const item = await territoryService.createFromBoundary(supabase, user, {
                boundary_id: parameters.boundary_id,
                name: parameters.name,
                description: parameters.description,
                tags: parameters.tags,
              });
              return {
                success: true, action, item,
                formatted_response: `✓ Frontera canónica agregada a tus Territorios: ${item.name}`,
                metadata: { service: 'mapa', timestamp: new Date().toISOString() }
              };
            } catch (e) {
              return { success: false, error: e.message };
            }
          }

          // ── Convertir POI de catálogo/Maps o coordenadas en Territorio ──
          case 'create_from_place': {
            try {
              const item = await territoryService.createFromPlace(supabase, user, {
                lugar_id: parameters.lugar_id,
                external_id: parameters.external_id,
                provider: parameters.provider,
                name: parameters.name,
                description: parameters.description,
                tags: parameters.tags,
                lat: parameters.lat,
                lng: parameters.lng,
                category: parameters.category,
                subtype: parameters.subtype,
                address: parameters.address,
                phone: parameters.phone,
                website: parameters.website,
                postal_code: parameters.postal_code,
              });
              return {
                success: true, action, item,
                formatted_response: `✓ Lugar agregado a tus Territorios como pin: ${item.name}`,
                metadata: { service: 'mapa', timestamp: new Date().toISOString() }
              };
            } catch (e) {
              return { success: false, error: e.message };
            }
          }

          case 'create_from_postal_code': {
            try {
              const item = await territoryService.createFromPostalCode(supabase, user, {
                country_code: parameters.country_code,
                postal_code: parameters.postal_code,
                postal_system: parameters.postal_system,
                name: parameters.name,
                description: parameters.description,
                tags: parameters.tags,
              });
              return {
                success: true, action, item,
                formatted_response: `✓ Área postal agregada como frontier: ${item.name}`,
                metadata: { service: 'mapa', timestamp: new Date().toISOString() }
              };
            } catch (e) {
              return { success: false, error: e.message };
            }
          }

          case 'attach_postal_code': {
            try {
              const item = await territoryService.attachPostalCode(supabase, user, parameters.item_id, {
                code: parameters.postal_code,
                country_code: parameters.country_code,
                system: parameters.postal_system,
                relation: parameters.postal_relation,
              });
              return {
                success: true, action, item,
                formatted_response: `✓ Código postal ${parameters.postal_code} asociado a ${item.name}`,
                metadata: { service: 'mapa', timestamp: new Date().toISOString() }
              };
            } catch (e) {
              return { success: false, error: e.message };
            }
          }

          case 'update_territory_geo': {
            try {
              const rawGeo = {
                ...(parameters.geo || {}),
                ...(parameters.spatial_role ? { spatial_role: parameters.spatial_role } : {}),
              };
              const item = await territoryService.updateTerritoryGeo(
                supabase, user, parameters.item_id, rawGeo
              );
              return {
                success: true, action, item,
                formatted_response: `✓ Geografía actualizada: ${item.name}`,
                metadata: { service: 'mapa', timestamp: new Date().toISOString() }
              };
            } catch (e) {
              return { success: false, error: e.message };
            }
          }

          // ── Vincular una frontier del usuario con el catálogo canónico ──
          case 'link_canonical_boundary': {
            try {
              const item = await territoryService.linkCanonicalBoundary(
                supabase,
                user,
                parameters.item_id,
                parameters.boundary_id,
                { adoptGeometry: parameters.adopt_geometry === true }
              );
              return {
                success: true, action, item,
                formatted_response: parameters.adopt_geometry === true
                  ? `✓ ${item.name} vinculado y actualizado con la geometría canónica`
                  : `✓ ${item.name} vinculado a la frontera canónica conservando su geometría original`,
                metadata: { service: 'mapa', timestamp: new Date().toISOString() }
              };
            } catch (e) {
              return { success: false, error: e.message };
            }
          }

          // ── Leer el lienzo de dibujo (canvasmap) ──
          case 'read_canvas': {
            const { data, error } = await supabase.from('mi_mapa_strokes')
              .select('id, tool, color, size, opacity, coords, radius_m, created_at')
              .eq('user_id', user.id)
              .order('created_at', { ascending: true });
            if (error) return { success: false, error: error.message };
            return {
              success: true,
              action: 'read_canvas',
              count: (data || []).length,
              strokes: data || [],
              formatted_response: `✓ ${(data || []).length} trazos en el lienzo`,
              metadata: { service: 'mapa', timestamp: new Date().toISOString() }
            };
          }

          // ── Dibujar un trazo en el lienzo ──
          case 'draw': {
            if (!parameters.tool)   return { success: false, error: 'tool es requerido (brush|spray|line|rect|circle)' };
            if (!Array.isArray(parameters.coords) || parameters.coords.length === 0) {
              return { success: false, error: 'coords es requerido: [[lat,lng], ...]' };
            }
            const validTools = ['brush', 'spray', 'line', 'rect', 'circle'];
            if (!validTools.includes(parameters.tool)) {
              return { success: false, error: `tool inválido. Debe ser uno de: ${validTools.join(', ')}` };
            }
            const { data, error } = await supabase.from('mi_mapa_strokes')
              .insert({
                user_id:  user.id,
                tool:     parameters.tool,
                color:    parameters.color   || '#2563eb',
                size:     parameters.size    || 4,
                opacity:  parameters.opacity != null ? parameters.opacity : 0.9,
                coords:   parameters.coords,
                radius_m: parameters.radius_m != null ? parameters.radius_m : null,
              })
              .select('id')
              .single();
            if (error) return { success: false, error: error.message };
            return {
              success: true,
              action: 'draw',
              stroke_id: data.id,
              formatted_response: `✓ Trazo ${parameters.tool} dibujado en el lienzo (ID: ${data.id})`,
              metadata: { service: 'mapa', timestamp: new Date().toISOString() }
            };
          }

          // ── Vincular un item del Codex a un territorio (u otro item) ──
          case 'link_item': {
            if (!parameters.target_id) return { success: false, error: 'target_id es requerido (item que recibe la referencia)' };
            if (!parameters.item_id)   return { success: false, error: 'item_id es requerido (item a vincular)' };
            const key = (parameters.key || '').trim();
            if (!key) return { success: false, error: 'key es requerido (etiqueta del vínculo, ej: "lider")' };

            // Cargar el item a vincular (debe ser del usuario)
            const { data: linked } = await supabase.from('codex_universe_items')
              .select('id, name, tipo')
              .eq('id', parameters.item_id)
              .eq('user_id', user.id)
              .single();
            if (!linked) return { success: false, error: 'item_id no encontrado o sin acceso' };

            // Cargar el target y mergear la referencia en details
            const { data: target } = await supabase.from('codex_universe_items')
              .select('id, name, details')
              .eq('id', parameters.target_id)
              .eq('user_id', user.id)
              .single();
            if (!target) return { success: false, error: 'target_id no encontrado o sin acceso' };

            const details = (typeof target.details === 'object' && target.details !== null) ? target.details : {};
            details[key] = { id: linked.id, name: linked.name, tipo: linked.tipo };

            const { error: updErr } = await supabase.from('codex_universe_items')
              .update({ details, updated_at: new Date().toISOString() })
              .eq('id', parameters.target_id);
            if (updErr) return { success: false, error: updErr.message };

            return {
              success: true,
              action: 'link_item',
              formatted_response: `✓ Vinculado [${linked.tipo}] ${linked.name} → "${target.name}" como "${key}"`,
              metadata: { service: 'mapa', timestamp: new Date().toISOString() }
            };
          }

          default:
            return { success: false, error: `Acción desconocida para mapa: ${action}` };
        }
      }

      // ===================================================================
      // TOOL: PLACES - Lugares/POIs: Apple Maps + DB (map_lugares)
      // ===================================================================
      case 'places': {
        const supabase = require('../utils/supabase');
        if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
        const action = parameters.action;
        const limit = Math.min(parameters.limit || 15, 50);
        console.log(`📍 [PLACES] Action: ${action}, Query: "${parameters.query || 'N/A'}"`);

        switch (action) {
          // ── Buscar lugares actualizados con Apple Maps ──
          case 'search': {
            if (!parameters.query?.trim()) return { success: false, error: 'query es requerido para search' };
            try {
              const appleMaps = require('./appleMaps');
              const results = await appleMaps.searchPlaces(parameters.query.trim(), {
                lat: parameters.lat, lng: parameters.lng,
              });
              return {
                success: true,
                action: 'search',
                source: 'apple_maps',
                count: results.length,
                places: results.slice(0, limit),
                formatted_response: `✓ ${results.length} lugares encontrados en Apple Maps para "${parameters.query}"`,
                metadata: { service: 'places', timestamp: new Date().toISOString() }
              };
            } catch (e) {
              return { success: false, error: `Apple Maps: ${e.message}` };
            }
          }

          // ── Leer POIs guardados en la DB (map_lugares) ──
          case 'read': {
            let q = supabase.from('map_lugares')
              .select('lugar_id, name, category, subtype, address, phone, website, scope, lat, lng');
            if (parameters.query)    q = q.ilike('name', `%${parameters.query}%`);
            if (parameters.category) q = q.eq('category', parameters.category);
            if (parameters.scope)    q = q.eq('scope', parameters.scope);
            q = q.order('name').limit(limit);
            const { data, error } = await q;
            if (error) return { success: false, error: error.message };
            return {
              success: true,
              action: 'read',
              source: 'database',
              count: (data || []).length,
              places: data || [],
              formatted_response: `✓ ${(data || []).length} POIs en la base de datos${parameters.query ? ` que coinciden con "${parameters.query}"` : ''}`,
              metadata: { service: 'places', timestamp: new Date().toISOString() }
            };
          }

          // ── Guardar un POI en la DB ──
          case 'save': {
            // map_lugares es un catálogo GLOBAL sin user_id. El cliente Supabase
            // del backend usa service role, por lo que RLS no protege este write:
            // la autorización debe verificarse explícitamente aquí.
            const roles = Array.isArray(user?.profile?.roles) ? user.profile.roles : [];
            let canCurate = user?.profile?.role === 'admin' || roles.includes('admin');
            if (!canCurate) {
              const { data: profile } = await supabase.from('profiles')
                .select('role, roles').eq('id', user.id).maybeSingle();
              canCurate = profile?.role === 'admin' || (Array.isArray(profile?.roles) && profile.roles.includes('admin'));
            }
            if (!canCurate) {
              return {
                success: false,
                error: 'places.save modifica el catálogo global y requiere rol admin. Para guardar el lugar en tu Codex usa mapa.create_from_place.'
              };
            }
            if (!parameters.name?.trim()) return { success: false, error: 'name es requerido para save' };
            if (parameters.lat == null || parameters.lng == null) {
              return { success: false, error: 'lat y lng son requeridos para save' };
            }
            // lugar_id: usa apple_id si viene del search, si no genera uno custom
            const lugarId = parameters.lugar_id
              || `usr_${user.id.slice(0, 8)}_${Date.now()}`;
            const row = {
              lugar_id: lugarId,
              name: parameters.name.trim(),
              category: parameters.category || null,
              subtype: parameters.subtype || null,
              address: parameters.address || null,
              phone: parameters.phone || null,
              website: parameters.website || null,
              opening_hours: parameters.opening_hours || null,
              source: parameters.source || 'vizta',
              scope: parameters.scope || 'ciudad',
              lat: parameters.lat,
              lng: parameters.lng,
            };
            const { data, error } = await supabase.from('map_lugares')
              .upsert(row, { onConflict: 'lugar_id' })
              .select('lugar_id, name')
              .single();
            if (error) return { success: false, error: error.message };
            return {
              success: true,
              action: 'save',
              place: data,
              formatted_response: `✓ POI guardado: "${data.name}" (ID: ${data.lugar_id})`,
              metadata: { service: 'places', timestamp: new Date().toISOString() }
            };
          }

          default:
            return { success: false, error: `Acción desconocida para places: ${action}` };
        }
      }

      // ===================================================================
      // CODEX WRITE TOOLS — codex_list_items, codex_update_item, codex_bulk_update
      // ===================================================================
      case 'codex_list_items': {
        const supabase = require('../utils/supabase');
        if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
        const lim = Math.min(parameters.limit || 20, 100);
        let q = supabase
          .from('codex_items')
          // OJO: codex_items NO tiene columna updated_at (solo created_at).
          // Pedirla hacía fallar todo el listado con
          // "column codex_items.updated_at does not exist".
          .select('id, tipo, titulo, descripcion, etiquetas, proyecto, url, nombre_archivo, created_at')
          .eq('user_id', user.id);
        if (parameters.query) {
          q = q.or(`titulo.ilike.%${parameters.query}%,descripcion.ilike.%${parameters.query}%`);
        }
        if (parameters.tipo) q = q.eq('tipo', parameters.tipo);
        if (parameters.project_id) q = q.eq('project_id', parameters.project_id);
        if (parameters.tags && Array.isArray(parameters.tags) && parameters.tags.length > 0) {
          q = q.contains('etiquetas', parameters.tags);
        }
        const { data: items, error: listErr } = await q.order('created_at', { ascending: false }).limit(lim);
        if (listErr) return { success: false, error: listErr.message };
        return {
          success: true,
          action: 'codex_list_items',
          total: items?.length || 0,
          items: items || [],
          formatted_response: items?.length > 0
            ? `${items.length} items en el Codex:\n${items.slice(0,10).map(i=>`- [${i.tipo}] ${i.titulo}${i.proyecto?' ('+i.proyecto+')':''}`).join('\n')}`
            : 'No se encontraron items con esos filtros.',
          metadata: { service: 'codex_items', timestamp: new Date().toISOString() }
        };
      }

      case 'codex_update_item': {
        const supabase = require('../utils/supabase');
        if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
        if (!parameters.item_id) return { success: false, error: 'item_id es requerido' };
        // Verify ownership
        const { data: existing } = await supabase.from('codex_items').select('id, titulo').eq('id', parameters.item_id).eq('user_id', user.id).single();
        if (!existing) return { success: false, error: 'Item no encontrado o no tienes acceso' };
        const patch = { updated_at: new Date().toISOString() };
        if (parameters.titulo !== undefined) patch.titulo = parameters.titulo;
        if (parameters.descripcion !== undefined) patch.descripcion = parameters.descripcion;
        if (parameters.etiquetas !== undefined) patch.etiquetas = parameters.etiquetas;
        if (parameters.proyecto !== undefined) patch.proyecto = parameters.proyecto;
        const { data: updated, error: updErr } = await supabase.from('codex_items').update(patch).eq('id', parameters.item_id).select('id, titulo, descripcion, etiquetas, proyecto').single();
        if (updErr) return { success: false, error: updErr.message };
        return {
          success: true,
          action: 'codex_update_item',
          item: updated,
          formatted_response: `✓ Item actualizado: "${updated.titulo}" — campos: ${Object.keys(patch).filter(k=>k!=='updated_at').join(', ')}`,
          metadata: { service: 'codex_items', timestamp: new Date().toISOString() }
        };
      }

      case 'codex_add_custom_field':
      case 'codex_set_custom_field':
        return {
          success: false,
          error: 'CUSTOM_FIELD_TOOL_RETIRED',
          message: 'Los campos libres por nombre fueron retirados. Usa codex action=resolve_field; si no existe, create_field con field_key, field_type, field_label y field_reason; luego update_universe_item con fields keyed por field_key.'
        };

      case 'codex_bulk_update': {
        const supabase = require('../utils/supabase');
        if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
        if (!parameters.item_ids || !Array.isArray(parameters.item_ids) || parameters.item_ids.length === 0) {
          return { success: false, error: 'item_ids es requerido y debe ser un array no vacío' };
        }
        if (!parameters.item_type) return { success: false, error: 'item_type es requerido (codex_item o universe_item)' };
        if (!parameters.updates || typeof parameters.updates !== 'object') return { success: false, error: 'updates es requerido' };
        const ids = parameters.item_ids;
        const updates = parameters.updates;
        if (parameters.item_type === 'universe_item' && (updates.details !== undefined || updates.flag !== undefined)) {
          return { success: false, error: 'details/flag son legacy. Usa updates.fields keyed por field_key.' };
        }
        const results = { success: [], failed: [] };
        const table = parameters.item_type === 'universe_item' ? 'codex_universe_items' : 'codex_items';
        // Build base patch (exclude custom_fields)
        const basePatch = { updated_at: new Date().toISOString() };
        if (parameters.item_type === 'codex_item') {
          if (updates.titulo !== undefined) basePatch.titulo = updates.titulo;
          if (updates.descripcion !== undefined) basePatch.descripcion = updates.descripcion;
          if (updates.etiquetas !== undefined) basePatch.etiquetas = updates.etiquetas;
          if (updates.proyecto !== undefined) basePatch.proyecto = updates.proyecto;
        } else {
          if (updates.name !== undefined) basePatch.name = updates.name;
          if (updates.description !== undefined) basePatch.description = updates.description;
          if (updates.tags !== undefined) basePatch.tags = updates.tags;
        }
        const hasCoreUpdates = Object.keys(basePatch).length > 1;
        const hasCustomFields = Array.isArray(updates.custom_fields) && updates.custom_fields.length > 0;
        const hasUniverseFields = parameters.item_type === 'universe_item' && updates.fields && typeof updates.fields === 'object';
        // Apply base patch to all IDs in one query
        if (hasCoreUpdates) {
          const { data: batchUpdated, error: batchErr } = await supabase.from(table).update(basePatch).in('id', ids).eq('user_id', user.id).select('id');
          if (batchErr) {
            ids.forEach(id => results.failed.push({ id, error: batchErr.message }));
          } else {
            (batchUpdated||[]).forEach(r => results.success.push(r.id));
          }
        }
        // Apply custom fields per item
        if (hasCustomFields && parameters.item_type === 'codex_item') {
          for (const id of ids) {
            for (const cf of updates.custom_fields) {
              if (!cf.field_name) continue;
              const { error: cfErr } = await supabase.from('codex_item_fields').upsert({
                item_id: id, user_id: user.id,
                field_name: cf.field_name, field_type: cf.field_type || 'text', field_value: cf.field_value || null
              }, { onConflict: 'item_id,field_name' });
              if (cfErr) results.failed.push({ id, field: cf.field_name, error: cfErr.message });
            }
          }
        }
        if (hasUniverseFields) {
          const { data: universeItems, error: universeReadError } = await supabase
            .from('codex_universe_items')
            .select('id, tipo, details, field_keys')
            .in('id', ids)
            .eq('user_id', user.id);
          if (universeReadError) return { success: false, error: universeReadError.message };
          for (const item of universeItems || []) {
            try {
              const prepared = await prepareFieldPatch(supabase, user.id, item.tipo, updates.fields);
              const details = { ...(item.details || {}), ...prepared.storageDelta };
              delete details.flag;
              const fieldKeys = [...new Set([...(item.field_keys || []), ...prepared.fieldKeys])];
              const { error: fieldUpdateError } = await supabase
                .from('codex_universe_items')
                .update({ details, field_keys: fieldKeys })
                .eq('id', item.id)
                .eq('user_id', user.id);
              if (fieldUpdateError) throw fieldUpdateError;
              if (!results.success.includes(item.id)) results.success.push(item.id);
            } catch (error) {
              results.failed.push({ id: item.id, error: error.message, code: error.code });
            }
          }
        }
        return {
          success: true,
          action: 'codex_bulk_update',
          total_requested: ids.length,
          total_updated: results.success.length,
          failed: results.failed.length,
          details: results,
          formatted_response: `✓ Actualización masiva: ${results.success.length}/${ids.length} items actualizados${results.failed.length>0?' ('+results.failed.length+' fallaron)':''}`,
          metadata: { service: table, timestamp: new Date().toISOString() }
        };
      }

      // ===================================================================
      // NEW WRITE TOOLS — codex_create_item, codex_delete_item,
      //   codex_create_universe_item, codex_delete_universe_item, codex_bulk_delete
      // ===================================================================

      case 'codex_create_item': {
        const supabase = require('../utils/supabase');
        if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
        if (!parameters.tipo) return { success: false, error: 'tipo es requerido' };
        if (!parameters.titulo) return { success: false, error: 'titulo es requerido' };
        const newItem = {
          user_id: user.id,
          tipo: parameters.tipo,
          titulo: parameters.titulo,
          descripcion: parameters.descripcion || null,
          etiquetas: parameters.etiquetas || [],
          proyecto: parameters.proyecto || null,
          url: parameters.url || null,
          content: parameters.content || null,
          // 'generated' = creado por el sistema/IA (vs 'manual' del usuario).
          // OJO: la constraint check_source_type solo acepta
          // manual | bookmark | activity | upload | generated.
          // Antes decía 'agentic' (el modo de ejecución, no un origen válido) y
          // Postgres rechazaba TODO insert desde el MCP.
          source_type: 'generated',
          created_at: new Date().toISOString()
        };
        const { data: created, error: createErr } = await supabase
          .from('codex_items')
          .insert(newItem)
          .select('id, tipo, titulo, descripcion, etiquetas, proyecto, url')
          .single();
        if (createErr) return { success: false, error: createErr.message };
        return {
          success: true,
          action: 'codex_create_item',
          item: created,
          formatted_response: `✓ Item creado: [${created.tipo}] "${created.titulo}" (ID: ${created.id})`,
          metadata: { service: 'codex_items', timestamp: new Date().toISOString() }
        };
      }

      case 'codex_delete_item': {
        const supabase = require('../utils/supabase');
        if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
        if (!parameters.item_id) return { success: false, error: 'item_id es requerido' };
        
        // Try codex_items first
        const { data: toDelete } = await supabase
          .from('codex_items')
          .select('id, titulo, tipo')
          .eq('id', parameters.item_id)
          .eq('user_id', user.id)
          .single();
        
        if (toDelete) {
          // Found in codex_items — delete from there
          const { error: delErr } = await supabase
            .from('codex_items')
            .delete()
            .eq('id', parameters.item_id)
            .eq('user_id', user.id);
          if (delErr) return { success: false, error: delErr.message };
          return {
            success: true,
            action: 'codex_delete_item',
            deleted_id: parameters.item_id,
            deleted_titulo: toDelete.titulo,
            formatted_response: `✓ Item eliminado: [${toDelete.tipo}] "${toDelete.titulo}" (ID: ${parameters.item_id})`,
            metadata: { service: 'codex_items', timestamp: new Date().toISOString() }
          };
        }
        
        // Not found in codex_items — try codex_universe_items
        const { data: toDeleteU } = await supabase
          .from('codex_universe_items')
          .select('id, name, tipo')
          .eq('id', parameters.item_id)
          .eq('user_id', user.id)
          .single();
        
        if (toDeleteU) {
          const { error: delUErr } = await supabase
            .from('codex_universe_items')
            .delete()
            .eq('id', parameters.item_id)
            .eq('user_id', user.id);
          if (delUErr) return { success: false, error: delUErr.message };
          return {
            success: true,
            action: 'codex_delete_item',
            deleted_id: parameters.item_id,
            deleted_titulo: toDeleteU.name,
            formatted_response: `✓ Actor/Entidad eliminado: [${toDeleteU.tipo}] "${toDeleteU.name}" (ID: ${parameters.item_id})`,
            metadata: { service: 'codex_universe_items', timestamp: new Date().toISOString() }
          };
        }
        
        return { success: false, error: 'Item no encontrado o no tienes acceso' };
      }

      case 'codex_create_universe_item': {
        const supabase = require('../utils/supabase');
        if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
        if (!parameters.tipo) return { success: false, error: 'tipo es requerido' };
        if (!parameters.name) return { success: false, error: 'name es requerido' };

        // Normaliza tipo antes de escribir. Sin esto, un "persona" o un alias
        // hacen fallar el insert con un error crudo de constraint de Postgres.
        const { tipo: tipoOk, corregido } = normalizeTipo(parameters.tipo);
        if (!tipoOk) {
          return { success: false, error: `tipo inválido: "${parameters.tipo}". Debe ser uno de: ${TIPOS_VALIDOS.join(', ')}. (Actor = persona · Entidad = organización · Territorio = lugar · Historia = concepto/narrativa)` };
        }
        if (corregido) console.log(`🔧 [CODEX] tipo normalizado: "${parameters.tipo}" → "${tipoOk}"`);

        const prepared = await prepareFieldPatch(supabase, user.id, tipoOk, parameters.fields || {});
        const presetResult = await applyPresetKeys(supabase, user.id, tipoOk, parameters.preset_keys || []);

        const { data: newUItem, error: uCreateErr } = await supabase
          .from('codex_universe_items')
          .insert({
            user_id: user.id,
            tipo: tipoOk,
            name: parameters.name,
            description: parameters.description || null,
            tags: parameters.tags || [],
            aliases: parameters.aliases || [],
            details: prepared.storageDelta,
            field_keys: [...new Set([...prepared.fieldKeys, ...presetResult.fieldKeys])],
            preset_keys: presetResult.presetKeys,
            mentions: []
          })
          .select()
          .single();
        if (uCreateErr) return { success: false, error: uCreateErr.message };
        return {
          success: true,
          action: 'codex_create_universe_item',
          item: newUItem,
          formatted_response: `✓ Universe item creado: [${newUItem.tipo}] "${newUItem.name}" (ID: ${newUItem.id})`,
          metadata: { service: 'codex_universe_items', timestamp: new Date().toISOString() }
        };
      }

      case 'codex_delete_universe_item': {
        const supabase = require('../utils/supabase');
        if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
        if (!parameters.universe_item_id) return { success: false, error: 'universe_item_id es requerido' };
        // Verify ownership before delete
        const { data: toDelU } = await supabase
          .from('codex_universe_items')
          .select('id, name, tipo')
          .eq('id', parameters.universe_item_id)
          .eq('user_id', user.id)
          .single();
        if (!toDelU) return { success: false, error: 'Universe item no encontrado o no tienes acceso' };
        const { error: uDelErr } = await supabase
          .from('codex_universe_items')
          .delete()
          .eq('id', parameters.universe_item_id)
          .eq('user_id', user.id);
        if (uDelErr) return { success: false, error: uDelErr.message };
        return {
          success: true,
          action: 'codex_delete_universe_item',
          deleted_id: parameters.universe_item_id,
          deleted_name: toDelU.name,
          formatted_response: `✓ Universe item eliminado: [${toDelU.tipo}] "${toDelU.name}" (ID: ${parameters.universe_item_id})`,
          metadata: { service: 'codex_universe_items', timestamp: new Date().toISOString() }
        };
      }

      case 'codex_bulk_delete': {
        const supabase = require('../utils/supabase');
        if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
        if (!parameters.item_ids || !Array.isArray(parameters.item_ids) || parameters.item_ids.length === 0) {
          return { success: false, error: 'item_ids es requerido y debe ser un array no vacío' };
        }
        if (!parameters.item_type) return { success: false, error: 'item_type es requerido (codex_item o universe_item)' };
        const table = parameters.item_type === 'universe_item' ? 'codex_universe_items' : 'codex_items';
        const ids = parameters.item_ids;
        // Verify ownership — only delete items that belong to this user
        const { data: ownedItems, error: checkErr } = await supabase
          .from(table)
          .select('id')
          .in('id', ids)
          .eq('user_id', user.id);
        if (checkErr) return { success: false, error: checkErr.message };
        const ownedIds = (ownedItems || []).map(i => i.id);
        if (ownedIds.length === 0) return { success: false, error: 'Ningún item encontrado o no tienes acceso' };
        const { error: bulkDelErr } = await supabase
          .from(table)
          .delete()
          .in('id', ownedIds)
          .eq('user_id', user.id);
        if (bulkDelErr) return { success: false, error: bulkDelErr.message };
        const skipped = ids.length - ownedIds.length;
        return {
          success: true,
          action: 'codex_bulk_delete',
          deleted_count: ownedIds.length,
          skipped_count: skipped,
          deleted_ids: ownedIds,
          formatted_response: `✓ Eliminación masiva: ${ownedIds.length}/${ids.length} items eliminados${skipped > 0 ? ` (${skipped} omitidos por falta de acceso)` : ''}`,
          metadata: { service: table, timestamp: new Date().toISOString() }
        };
      }

      // ===================================================================
      // TOOL 3: POLITICAL_CONTEXT - Local DB: news cards + trends + tweets
      // ===================================================================
      case 'political_context': {
        const pcQuery = (parameters.query || '').trim().toLowerCase();
        const pcLimit = Math.min(parameters.limit || 15, 50);
        const pcHoursBack = Math.min(parameters.hours_back || 48, 168);

        // Split query into individual words for OR-style matching
        const pcTokens = pcQuery ? pcQuery.split(/\s+/).filter(w => w.length > 2) : [];
        const pcMatches = (text) => pcTokens.length === 0 || pcTokens.some(tok => text.includes(tok));

        console.log(`🗞️ [POLITICAL_CONTEXT] query="${pcQuery || '(all)'}", tokens=[${pcTokens.join(',')}], limit=${pcLimit}, hoursBack=${pcHoursBack}`);

        const supabasePC = require('../utils/supabase');

        // ── 1. News cards (last 24h) ──────────────────────────────────
        let newsCards = [];
        try {
          const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          const { data: ncData } = await supabasePC
            .from('news_cards')
            .select('cards, generated_at')
            .gte('generated_at', since)
            .order('generated_at', { ascending: false })
            .limit(1)
            .single();

          if (ncData?.cards && Array.isArray(ncData.cards)) {
            let cards = ncData.cards;
            if (pcTokens.length > 0) {
              const filtered = cards.filter(c => {
                const text = `${c.titulo || ''} ${c.resumen || ''} ${(c.entidades || []).join(' ')}`.toLowerCase();
                return pcMatches(text);
              });
              // Fall back to all cards if nothing matches
              cards = filtered.length > 0 ? filtered : ncData.cards;
            }
            newsCards = cards.slice(0, 15).map(c => ({
              titulo: c.titulo,
              categoria: c.categoria,
              resumen: c.resumen,
              entidades: (c.entidades || []).slice(0, 4),
              impacto: c.impacto_score,
              sentimiento: c.sentimiento_general,
            }));
          }
        } catch (e) {
          console.warn('[POLITICAL_CONTEXT] news_cards error:', e.message);
        }

        // ── 2. Latest trends snapshot ─────────────────────────────────
        let trendsData = null;
        try {
          const raw = await getLatestTrends();
          if (raw) {
            let about = Array.isArray(raw.about) ? raw.about : [];
            if (pcTokens.length > 0) {
              const filtered = about.filter(t => {
                const text = `${t.tema || t.name || ''} ${t.descripcion || t.description || ''} ${(t.keywords || []).join(' ')}`.toLowerCase();
                return pcMatches(text);
              });
              // Fall back to all if nothing matches
              about = filtered.length > 0 ? filtered : raw.about;
            }
            trendsData = {
              timestamp: raw.timestamp,
              top_keywords: raw.top_keywords || [],
              about: about.slice(0, 10),
            };
          }
        } catch (e) {
          console.warn('[POLITICAL_CONTEXT] trends error:', e.message);
        }

        // ── 3. Top tweets by engagement ───────────────────────────────
        let tweets = [];
        try {
          const since = new Date(Date.now() - pcHoursBack * 60 * 60 * 1000).toISOString();
          const { data: twData } = await supabasePC
            .from('trending_tweets')
            .select('usuario, verified, likes, retweets, texto, trend_original, fecha_tweet')
            .gte('fecha_tweet', since)
            .order('likes', { ascending: false })
            .limit(pcLimit * 3); // fetch more to allow filtering

          if (twData && twData.length > 0) {
            let filtered = twData;
            if (pcTokens.length > 0) {
              const tokenFiltered = twData.filter(t => {
                const text = `${t.texto || ''} ${t.trend_original || ''}`.toLowerCase();
                return pcMatches(text);
              });
              // Fall back to all tweets if nothing matches
              filtered = tokenFiltered.length > 0 ? tokenFiltered : twData;
            }
            tweets = filtered.slice(0, pcLimit).map(t => ({
              usuario: t.usuario,
              verified: t.verified,
              likes: t.likes,
              retweets: t.retweets,
              texto: t.texto,
              trend: t.trend_original,
              fecha: t.fecha_tweet,
            }));
          }
        } catch (e) {
          console.warn('[POLITICAL_CONTEXT] tweets error:', e.message);
        }

        const totalItems = newsCards.length + (trendsData?.about?.length || 0) + tweets.length;
        console.log(`✅ [POLITICAL_CONTEXT] news_cards=${newsCards.length}, trends=${trendsData?.about?.length || 0}, tweets=${tweets.length}`);

        return {
          success: true,
          tool: 'political_context',
          query: pcQuery || null,
          news_cards: newsCards,
          trends: trendsData,
          tweets,
          summary: {
            total_news_cards: newsCards.length,
            total_trends: trendsData?.about?.length || 0,
            total_tweets: tweets.length,
            hours_back: pcHoursBack,
          },
          formatted_response: totalItems === 0
            ? `No se encontró contexto reciente${pcQuery ? ` sobre "${pcQuery}"` : ''}.`
            : `Contexto local encontrado: ${newsCards.length} news cards, ${trendsData?.about?.length || 0} tendencias, ${tweets.length} tweets relevantes${pcQuery ? ` sobre "${pcQuery}"` : ''}.`,
          metadata: {
            service: 'political_context_local',
            timestamp: new Date().toISOString(),
          }
        };
      }

      // ===================================================================
      // TOOL: WORKSPACE - Proyectos, Espacios (free_canvases) y Decisiones
      // ===================================================================
      case 'workspace': {
        const supabase = require('../utils/supabase');
        if (!user?.id) return { success: false, error: 'Usuario no autenticado' };
        const uid = user.id;
        const action = parameters.action;
        const isUUID = (s) => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

        console.log(`🗂️ [WORKSPACE] Action: ${action}`);

        // Resuelve un proyecto por id o nombre (ILIKE)
        const resolveProject = async (ref) => {
          if (!ref) return null;
          if (isUUID(ref)) {
            const { data } = await supabase.from('projects').select('id,title').eq('user_id', uid).eq('id', ref).maybeSingle();
            return data || null;
          }
          const { data } = await supabase.from('projects').select('id,title').eq('user_id', uid).ilike('title', `%${ref}%`).order('updated_at', { ascending: false }).limit(1);
          return data?.[0] || null;
        };
        // Resuelve un espacio (free_canvases) por id o nombre (ILIKE)
        const resolveSpace = async (ref) => {
          if (!ref) return null;
          if (isUUID(ref)) {
            const { data } = await supabase.from('free_canvases').select('*').eq('user_id', uid).eq('id', ref).maybeSingle();
            return data || null;
          }
          // Se resuelve en dos pasos a propósito: primero candidatos con un select
          // liviano (el blob `data` de un espacio grande pesa ~240k, traer 5 sería
          // absurdo), después la fila completa del elegido.
          const { data: cands } = await supabase.from('free_canvases')
            .select('id,name,updated_at,espacio_index(items_count)')
            .eq('user_id', uid).ilike('name', `%${ref}%`)
            .order('updated_at', { ascending: false }).limit(5);
          if (!cands?.length) return null;

          const n = c => (Array.isArray(c.espacio_index) ? c.espacio_index[0] : c.espacio_index)?.items_count || 0;
          const exacto = c => c.name.toLowerCase() === String(ref).toLowerCase();
          // El usuario tiene espacios duplicados con el mismo nombre, uno de ellos
          // vacío. Ordenar por updated_at devolvía el vacío. Gana el que tiene
          // contenido — y si hay empate real, se avisa en vez de elegir a ciegas.
          const orden = [...cands].sort((a, b) =>
            (exacto(b) - exacto(a)) || (n(b) - n(a)) || (new Date(b.updated_at) - new Date(a.updated_at)));
          const elegido = orden[0];

          const { data: full } = await supabase.from('free_canvases')
            .select('*').eq('id', elegido.id).maybeSingle();
          if (!full) return null;
          const rivales = orden.slice(1).filter(c => exacto(c) === exacto(elegido));
          if (rivales.length) {
            full._ambiguo = rivales.map(c => ({ id: c.id, name: c.name, items: n(c) }));
            full._elegido_items = n(elegido);
          }
          return full;
        };

        // Elegir en silencio entre espacios homónimos es exactamente el error que
        // arruina una investigación. Se dice cuál se tomó y qué otros había.
        const avisoAmbiguo = (s) => !s?._ambiguo ? '' :
          `\n\n⚠️ Hay ${s._ambiguo.length + 1} espacios llamados así. Se usó el de ${s._elegido_items} items (id ${s.id}). Los otros: ` +
          s._ambiguo.map(c => `${c.items} items (id ${c.id})`).join(', ') + '. Pasá el id si querías otro.';

        try {
          switch (action) {
            // ── PROYECTOS ──────────────────────────────────────────────────
            case 'list_projects': {
              const { data, error } = await supabase.from('projects')
                .select('id,title,description,status,category,priority,updated_at')
                .eq('user_id', uid).order('updated_at', { ascending: false }).limit(50);
              if (error) return { success: false, error: error.message };
              return { success: true, action, count: data.length, projects: data,
                formatted_response: `${data.length} proyecto(s).`, metadata: { service: 'workspace' } };
            }
            case 'create_project': {
              const title = (parameters.name || parameters.title || '').trim();
              if (!title) return { success: false, error: 'name (título del proyecto) es requerido' };
              const { data, error } = await supabase.from('projects').insert({
                user_id: uid, title,
                description: parameters.description || null,
                status: 'active', priority: parameters.priority || 'medium',
                category: parameters.category || null,
                tags: Array.isArray(parameters.tags) ? parameters.tags : null,
                visibility: 'private', country: 'GT',
              }).select('id,title').single();
              if (error) return { success: false, error: error.message };
              return { success: true, action, project: data,
                formatted_response: `✓ Proyecto creado: "${data.title}" (ID: ${data.id})`, metadata: { service: 'workspace' } };
            }

            // ── ESPACIOS (free_canvases) ───────────────────────────────────
            case 'list_spaces': {
              let q = supabase.from('free_canvases').select('id,name,project_id,updated_at').eq('user_id', uid);
              if (parameters.project) {
                const proj = await resolveProject(parameters.project);
                if (proj) q = q.eq('project_id', proj.id);
              }
              const { data, error } = await q.order('updated_at', { ascending: false }).limit(50);
              if (error) return { success: false, error: error.message };
              return { success: true, action, count: data.length, spaces: data,
                formatted_response: `${data.length} espacio(s).`, metadata: { service: 'workspace' } };
            }
            case 'create_space': {
              const name = (parameters.name || '').trim();
              if (!name) return { success: false, error: 'name (nombre del espacio) es requerido' };
              let project_id = null;
              if (parameters.project) { const proj = await resolveProject(parameters.project); project_id = proj?.id || null; }
              const emptyData = { notes: [], canvasItems: [], connections: [], positions: {}, promptCards: [], docNodes: [], datasetNodes: [], drawPaths: [] };
              const { data, error } = await supabase.from('free_canvases').insert({
                user_id: uid, name, data: emptyData, project_id,
              }).select('id,name,project_id').single();
              if (error) return { success: false, error: error.message };
              return { success: true, action, space: data,
                formatted_response: `✓ Espacio creado: "${data.name}" (ID: ${data.id})`, metadata: { service: 'workspace' } };
            }
            case 'read_space': {
              const space = await resolveSpace(parameters.space || parameters.name);
              if (!space) return { success: false, error: `No encontré el espacio "${parameters.space || parameters.name || ''}".` };
              const d = space.data || {};
              const itemIds = Array.isArray(d.canvasItems) ? d.canvasItems : [];
              let docs = [], uni = [];
              if (itemIds.length) {
                const r1 = await supabase.from('codex_items').select('id,titulo,tipo,descripcion,content').in('id', itemIds);
                const r2 = await supabase.from('codex_universe_items').select('id,name,tipo,description').in('id', itemIds);
                docs = r1.data || []; uni = r2.data || [];
              }
              const nodos = [
                ...docs.map(x => ({ tipo: x.tipo || 'documento', titulo: x.titulo, contenido: (x.content || x.descripcion || '')?.slice(0, 1500) })),
                ...uni.map(x => ({ tipo: x.tipo || 'item', titulo: x.name, contenido: (x.description || '')?.slice(0, 1500) })),
              ];
              const notas = (Array.isArray(d.notes) ? d.notes : []).map(n => ({ contenido: n.content, color: n.color }));
              const conexiones = (Array.isArray(d.connections) ? d.connections : []).map(c => ({ from: c.from || c.source, to: c.to || c.target, label: c.label || c.verb }));
              return {
                success: true, action, space: { id: space.id, name: space.name, project_id: space.project_id },
                resumen: { nodos: nodos.length, notas: notas.length, conexiones: conexiones.length },
                nodos, notas, conexiones,
                formatted_response: `Espacio "${space.name}": ${nodos.length} nodo(s), ${notas.length} nota(s), ${conexiones.length} conexión(es). Usa este contenido como contexto para responder.`,
                metadata: { service: 'workspace' }
              };
            }
            case 'add_note_to_space': {
              const space = await resolveSpace(parameters.space || parameters.name);
              if (!space) return { success: false, error: `No encontré el espacio "${parameters.space || parameters.name || ''}".` };
              const content = (parameters.content || parameters.note || '').trim();
              if (!content) return { success: false, error: 'content (texto de la nota) es requerido' };
              let note;
              // Write atómico bajo lock (evita lost-update con escrituras concurrentes al mismo espacio)
              const res = await mutateSpaceData(supabase, uid, space.id, (d) => {
                if (!Array.isArray(d.notes)) d.notes = [];
                note = { id: `note-${Date.now()}-${Math.floor(Math.random() * 1e4)}`, x: 200 + Math.random() * 200, y: 200 + Math.random() * 200, color: parameters.color || 'yellow', content };
                d.notes.push(note);
              });
              if (res.error) return { success: false, error: res.error };
              return { success: true, action, note, space: { id: space.id, name: res.name || space.name },
                formatted_response: `✓ Nota agregada al espacio "${res.name || space.name}".`, metadata: { service: 'workspace' } };
            }
            case 'add_item_to_space': {
              const space = await resolveSpace(parameters.space || parameters.name);
              if (!space) return { success: false, error: `No encontré el espacio "${parameters.space || parameters.name || ''}".` };
              // Acepta item_id (uno) o item_ids (varios en UNA sola llamada → preferido para batch)
              let ids = [];
              if (Array.isArray(parameters.item_ids)) ids = parameters.item_ids.filter(Boolean).map(String);
              if (parameters.item_id) ids.push(String(parameters.item_id));
              ids = [...new Set(ids)];
              if (ids.length === 0) return { success: false, error: 'item_id o item_ids (ids del Codex/Universo) es requerido' };
              // Write atómico bajo lock; dedupe contra lo ya presente
              const res = await mutateSpaceData(supabase, uid, space.id, (d) => {
                if (!Array.isArray(d.canvasItems)) d.canvasItems = [];
                if (!d.positions || typeof d.positions !== 'object') d.positions = {};
                for (const id of ids) {
                  if (!d.canvasItems.includes(id)) d.canvasItems.push(id);
                  if (!d.positions[id]) d.positions[id] = { x: 200 + Math.random() * 300, y: 150 + Math.random() * 300 };
                }
              });
              if (res.error) return { success: false, error: res.error };
              return { success: true, action, added: ids.length, space: { id: space.id, name: res.name || space.name },
                formatted_response: `✓ ${ids.length} item(s) agregado(s) al espacio "${res.name || space.name}".`, metadata: { service: 'workspace' } };
            }

            // ── DECISIONES (project_decisions) ─────────────────────────────
            // ── ESPACIOS COMO MEMORIA VIVIENTE ────────────────────────────
            // El blob del canvas sigue siendo la fuente de verdad; triggers de
            // Postgres derivan el índice (items, conexiones, texto de búsqueda,
            // huella temática). Todo determinista: sin embeddings ni resúmenes de
            // LLM. La lectura la pone quien llama — Vizta o Claude vía MCP.
            case 'space_context': {
              const space = await resolveSpace(parameters.space || parameters.name);
              if (!space) return { success: false, error: `No encontré el espacio "${parameters.space || parameters.name || ''}".` };
              const { data: ctx, error: ctxErr } = await supabase.rpc('espacio_contexto', { p_espacio_id: space.id });
              if (ctxErr) return { success: false, error: ctxErr.message };

              const items = ctx?.items || [];
              const porTipo = items.reduce((a, i) => { (a[i.tipo] = a[i.tipo] || []).push(i.nombre); return a; }, {});
              const conex = (ctx?.conexiones || []).filter(c => c.de && c.a);
              const lineas = [
                `📁 ${ctx?.espacio} — ${items.length} items, ${conex.length} conexiones`,
                ...Object.entries(porTipo).map(([t, ns]) =>
                  `  ${t} (${ns.length}): ${ns.slice(0, 30).join(', ')}${ns.length > 30 ? ` … +${ns.length - 30}` : ''}`),
                ...(conex.length ? [`  Conexiones: ${conex.slice(0, 15).map(c => `${c.de} —${c.relacion}→ ${c.a}`).join(' · ')}`] : []),
                ...((ctx?.notas || []).length ? [`  Notas: ${(ctx.notas || []).join(' | ').slice(0, 800)}`] : []),
              ];
              return {
                success: true, action: 'space_context', space_id: space.id, contexto: ctx,
                formatted_response: lineas.join('\n') +
                  '\n\n(Este es el MAPA del espacio. Si necesitás el contenido completo de cada ficha, usá read_space — pero suele no hacer falta.)' +
                  avisoAmbiguo(space),
                metadata: { service: 'espacios', timestamp: new Date().toISOString() }
              };
            }

            case 'search_spaces': {
              if (!parameters.query) return { success: false, error: 'query es requerido (qué buscar, en lenguaje natural)' };
              const { data: res, error: sErr } = await supabase.rpc('espacios_buscar', {
                p_user_id: uid, p_query: parameters.query, p_limite: parameters.limit || 5,
              });
              if (sErr) return { success: false, error: sErr.message };
              const lista = res || [];
              return {
                success: true, action: 'search_spaces', total: lista.length, espacios: lista,
                formatted_response: lista.length
                  // Se devuelve el fragmento que coincidió (`por_que`), no solo un score:
                  // quien lee necesita ver por qué pegó para decidir si sirve.
                  ? `Espacios que coinciden con "${parameters.query}":\n` + lista.map(e =>
                      `- ${e.nombre} (${e.items_count} items · pegaron ${e.terminos_encontrados}/${e.terminos_query} términos)` +
                      (e.por_que ? `\n  …${e.por_que.replace(/\n/g, ' · ')}…` : '')).join('\n')
                  : `Ningún espacio coincide con "${parameters.query}". La búsqueda es literal (nombres, notas, etiquetas): probá con nombres propios o términos concretos, o listá los espacios con list_spaces.`,
                metadata: { service: 'espacios' }
              };
            }

            case 'related_spaces': {
              const space = await resolveSpace(parameters.space || parameters.name);
              if (!space) return { success: false, error: `No encontré el espacio "${parameters.space || parameters.name || ''}".` };
              const { data: rel, error: rErr } = await supabase.rpc('espacios_relacionados', {
                p_espacio_id: space.id, p_limite: parameters.limit || 5,
              });
              if (rErr) return { success: false, error: rErr.message };
              const lista = rel || [];
              return {
                success: true, action: 'related_spaces', espacio: space.name, total: lista.length, relacionados: lista,
                formatted_response: lista.length
                  ? `Espacios relacionados con "${space.name}":\n` + lista.map(r => r.via === 'items'
                      ? `- ${r.nombre} — comparten ${r.comparten} actores${r.ejemplos?.length ? ` (${r.ejemplos.join(', ')})` : ''}`
                      : `- ${r.nombre} — vocabulario en común (${r.comparten} términos${r.ejemplos?.length ? `: ${r.ejemplos.join(', ')}` : ''}), sin actores compartidos`).join('\n') + avisoAmbiguo(space)
                  : `"${space.name}" no comparte actores ni vocabulario con otros espacios.` + avisoAmbiguo(space),
                metadata: { service: 'espacios' }
              };
            }

            case 'item_spaces': {
              if (!parameters.item_id) return { success: false, error: 'item_id es requerido' };
              const { data: esp, error: iErr } = await supabase.rpc('espacios_de_item', {
                p_user_id: uid, p_item_id: parameters.item_id,
              });
              if (iErr) return { success: false, error: iErr.message };
              const lista = esp || [];
              return {
                success: true, action: 'item_spaces', total: lista.length, espacios: lista,
                formatted_response: lista.length
                  ? `Este item aparece en ${lista.length} espacio(s):\n` + lista.map(e =>
                      `- ${e.nombre} (${e.items_count} items)`).join('\n')
                  : 'Este item no está en ningún espacio del usuario.',
                metadata: { service: 'espacios' }
              };
            }

            case 'list_decisions': {
              const proj = await resolveProject(parameters.project);
              if (!proj) return { success: false, error: `No encontré el proyecto "${parameters.project || ''}".` };
              const { data, error } = await supabase.from('project_decisions')
                .select('id,title,description,decision_type,status,urgency,sequence_number,created_at')
                .eq('project_id', proj.id).order('sequence_number', { ascending: true });
              if (error) return { success: false, error: error.message };
              return { success: true, action, project: proj, count: data.length, decisions: data,
                formatted_response: `${data.length} decisión(es) en "${proj.title}".`, metadata: { service: 'workspace' } };
            }
            case 'create_decision': {
              const proj = await resolveProject(parameters.project);
              if (!proj) return { success: false, error: `No encontré el proyecto "${parameters.project || ''}". Primero créalo o especifica el nombre exacto.` };
              const title = (parameters.title || parameters.name || '').trim();
              const description = (parameters.description || '').trim();
              if (!title) return { success: false, error: 'title (título de la decisión) es requerido' };
              if (!description) return { success: false, error: 'description (descripción de la decisión) es requerida' };
              const { data: last } = await supabase.from('project_decisions').select('sequence_number').eq('project_id', proj.id).order('sequence_number', { ascending: false }).limit(1);
              const seq = (last?.[0]?.sequence_number || 0) + 1;
              const { data, error } = await supabase.from('project_decisions').insert({
                project_id: proj.id, title, description,
                decision_type: parameters.decision_type || 'enfoque',
                sequence_number: seq,
                rationale: parameters.rationale || null,
                urgency: parameters.urgency || 'medium',
                status: 'pending',
                tags: Array.isArray(parameters.tags) ? parameters.tags : null,
              }).select('id,title,sequence_number').single();
              if (error) return { success: false, error: error.message };
              return { success: true, action, decision: data, project: proj,
                formatted_response: `✓ Decisión #${data.sequence_number} creada en "${proj.title}": "${data.title}"`, metadata: { service: 'workspace' } };
            }

            default:
              return { success: false, error: `Acción de workspace no reconocida: "${action}"` };
          }
        } catch (wErr) {
          console.error('🗂️ [WORKSPACE] Error:', wErr.message);
          return { success: false, error: wErr.message };
        }
      }

      // ===================================================================
      // TOOL 2: SEARCH - Unified Perplexity + Exa search
      // ===================================================================
      case 'legal_search': {
        // La lógica vive en services/legalSearch.js y no en vizta: vizta ya
        // requiere este módulo, así que importarlo de vuelta sería circular.
        const { legalSearch } = require('./legalSearch');
        const q = parameters.query;

        if (!q || typeof q !== 'string' || !q.trim()) {
          return { success: false, error: 'legal_search requires a non-empty query' };
        }

        try {
          const out = await legalSearch(q, parameters.limit, parameters.area || null);
          console.log(`⚖️  [LEGAL_SEARCH] "${q}" → ${out.found ?? 0} artículos (modo: ${out.mode || 'n/a'})`);
          return { success: true, ...out };
        } catch (err) {
          console.error('⚖️  [LEGAL_SEARCH] error:', err.message);
          return { success: false, error: `Error en búsqueda legal: ${err.message}`, query: q };
        }
      }

      case 'search': {
        const query = parameters.query;
        const provider = parameters.provider || 'exa';
        const location = parameters.location || 'Guatemala';
        const numResults = parameters.num_results || 10;

        if (!query || typeof query !== 'string' || query.trim().length < 3) {
          return { success: false, error: 'search requires a non-empty query (≥3 chars)' };
        }

        console.log(`🔍 [SEARCH] Query: "${query}", Provider: ${provider}, Location: ${location}`);

        // Execute based on provider selection
        if (provider === 'parallel') {
          return await executeParallelSearch(query, location, 'general', user);
        }

        if (provider === 'perplexity') {
          return await executePerplexitySearch(query, location, 'general', false, user);
        }

        if (provider === 'exa') {
          return await executeExaSearch(query, numResults, user);
        }

        // Default: both — Parallel AI + Exa
        console.log(`[SEARCH] 🔍 Executing combined search: Parallel AI + Exa`);

        const [parallelResult, exaResult] = await Promise.allSettled([
          executeParallelSearch(query, location, 'general', user),
          executeExaSearch(query, numResults, user)
        ]);

        // Combine results from both sources
        const combinedResults = [];
        let sourceCount = 0;

        // Process Parallel AI results
        if (parallelResult.status === 'fulfilled' && parallelResult.value) {
          const pResult = parallelResult.value;
          const parallelSearchResults = pResult.data?.search_results || pResult.result?.search_results;
          if (parallelSearchResults && parallelSearchResults.length > 0) {
            combinedResults.push(...parallelSearchResults.map(r => ({ ...r, source: 'parallel' })));
            sourceCount++;
          }
          console.log(`[SEARCH] Parallel AI: ${parallelSearchResults?.length || 0} results`);
        }

        // Process Exa results
        if (exaResult.status === 'fulfilled' && exaResult.value) {
          const eResult = exaResult.value;
          const exaSearchResults = eResult.result?.search_results || eResult.search_results;
          if (exaSearchResults && exaSearchResults.length > 0) {
            combinedResults.push(...exaSearchResults.map(r => ({ ...r, source: 'exa' })));
            sourceCount++;
          }
          console.log(`[SEARCH] Exa: ${exaSearchResults?.length || 0} results`);
        }

        // Remove duplicates based on URL
        const uniqueResults = combinedResults.filter((result, index, self) =>
          index === self.findIndex(r => r.url === result.url)
        );

        console.log(`[SEARCH] Combined: ${sourceCount} sources, ${uniqueResults.length} unique results`);

        return {
          success: true,
          query,
          provider: 'both',
          result: {
            search_results: uniqueResults,
            analysis: `Búsqueda realizada con ${sourceCount} fuentes (Perplexity + Exa)`,
            metadata: {
              results_count: uniqueResults.length,
              sources_used: sourceCount,
              source: 'parallel_search',
              timestamp: new Date().toISOString()
            }
          },
          formatted_response: uniqueResults.length > 0
            ? `Encontré ${uniqueResults.length} resultados:\n${uniqueResults.slice(0, 5).map(r => `- ${r.title || 'Sin título'}: ${r.url}`).join('\n')}`
            : `No encontré resultados para "${query}".`,
          agent: 'Vizta',
          tool: 'search',
          timestamp: new Date().toISOString()
        };
      }

      // ── DATASET TOOLS ──────────────────────────────────────────────────
      case 'dataset_create': {
        const ds = require('./mcpDatasets');
        return await ds.createDataset(parameters, user?.id);
      }
      case 'dataset_append_rows': {
        const ds = require('./mcpDatasets');
        return await ds.appendRows(parameters, user?.id);
      }
      case 'dataset_bulk_insert': {
        const ds = require('./mcpDatasets');
        return await ds.bulkInsert(parameters, user?.id);
      }
      case 'dataset_upsert_rows': {
        const ds = require('./mcpDatasets');
        return await ds.upsertRows(parameters, user?.id);
      }
      case 'dataset_list': {
        const ds = require('./mcpDatasets');
        return await ds.listDatasets(parameters, user?.id);
      }
      case 'dataset_get': {
        const ds = require('./mcpDatasets');
        return await ds.getDataset(parameters, user?.id);
      }
      case 'dataset_query': {
        const ds = require('./mcpDatasets');
        return await ds.queryDataset(parameters, user?.id);
      }
      case 'dataset_bulk_query': {
        const ds = require('./mcpDatasets');
        return await ds.bulkQuery(parameters, user?.id);
      }
      case 'dataset_update_rows': {
        const ds = require('./mcpDatasets');
        return await ds.updateRows(parameters, user?.id);
      }
      case 'dataset_delete_rows': {
        const ds = require('./mcpDatasets');
        return await ds.deleteRows(parameters, user?.id);
      }
      case 'dataset_list_rows': {
        const ds = require('./datasetCodexService');
        return await ds.listRows(parameters, user?.id);
      }
      case 'dataset_preview_codex_alignment': {
        const ds = require('./datasetCodexService');
        return await ds.previewAlignment({ ...parameters, origin_kind: 'mcp' }, user?.id);
      }
      case 'dataset_apply_codex_alignment': {
        const ds = require('./datasetCodexService');
        return await ds.applyAlignment({ ...parameters, origin_kind: 'mcp' }, user?.id);
      }
      case 'dataset_update_row': {
        const ds = require('./datasetCodexService');
        return await ds.updateRow({ ...parameters, origin_kind: 'mcp' }, user?.id);
      }
      case 'dataset_bind_column': {
        const ds = require('./datasetCodexService');
        return await ds.bindColumn(parameters, user?.id);
      }
      case 'dataset_unbind_column': {
        const ds = require('./datasetCodexService');
        return await ds.unbindColumn(parameters, user?.id);
      }
      case 'dataset_detach_row': {
        const ds = require('./datasetCodexService');
        return await ds.detachRow(parameters, user?.id);
      }
      case 'dataset_sync_row': {
        const ds = require('./datasetCodexService');
        return await ds.syncRowToCodex({ ...parameters, origin_kind: 'mcp' }, user?.id);
      }
      case 'dataset_sync_status': {
        const ds = require('./datasetCodexService');
        return await ds.getSyncStatus(parameters, user?.id);
      }
      case 'dataset_list_sync_events': {
        const ds = require('./datasetCodexService');
        return await ds.listSyncEvents(parameters, user?.id);
      }
      case 'dataset_list_conflicts': {
        const ds = require('./datasetCodexService');
        return await ds.listConflicts(parameters, user?.id);
      }

      // ── SEARCH PARALLEL/BULK TOOLS ─────────────────────────────────────
      case 'search_parallel': {
        const ms = require('./mcpSearch');
        return await ms.searchParallel(parameters);
      }
      case 'search_bulk': {
        const ms = require('./mcpSearch');
        return await ms.searchBulk(parameters, user?.id);
      }
      case 'search_and_save_dataset': {
        const ms = require('./mcpSearch');
        return await ms.searchAndSaveDataset(parameters, user?.id);
      }

      default:
        throw new Error(`Ejecutor no implementado para herramienta: ${toolName}`);
    }
  } catch (error) {
    console.error(`❌ Error ejecutando herramienta ${toolName}:`, error);
    throw error;
  }
}


/**
 * Función para optimizar términos de búsqueda con DeepSeek ANTES de buscar
 * @param {string} originalQuery - Consulta original del usuario
 * @param {string} location - Ubicación geográfica
 * @param {Object} user - Usuario autenticado
 * @returns {Object} Términos optimizados por DeepSeek
 */
async function optimizeSearchWithDeepSeek(originalQuery, location, user) {
  try {
    console.log('🧠 Optimizando búsqueda con DeepSeek antes de ejecutar...');

    const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

    if (!DEEPSEEK_API_KEY) {
      console.log('⚠️ DEEPSEEK_API_KEY no configurada, usando términos estándar');
      return {
        optimized: false,
        final_query: originalQuery,
        strategy: 'standard_expansion'
      };
    }

    const now = new Date();
    const currentMonth = now.toLocaleString('es-ES', { month: 'long' });
    const currentYear = now.getFullYear();

    const deepSeekPrompt = `Optimiza esta consulta para encontrar tweets REALES en redes sociales guatemaltecas.

CONSULTA: "${originalQuery}"
UBICACIÓN: ${location}
FECHA: ${currentMonth} ${currentYear}

INSTRUCCIONES:
1. Analiza qué busca el usuario
2. Genera términos que la gente REALMENTE usa en Twitter
3. Incluye hashtags y variaciones populares
4. Considera el contexto guatemalteco actual

EJEMPLOS DE OPTIMIZACIÓN CORRECTA:
- "disturbios Izabal minería" → "izabal OR minería OR protestas OR manifestaciones OR mina OR resistencia"
- "elecciones guatemala" → "elecciones OR electoral OR voto OR tse OR bernardo OR arevalo"
- "orgullo guatemala" → "orgullo OR pride OR lgbt OR diversidad OR marcha OR #orgullogt"

RESPONDE SOLO EN JSON:
{
  "razonamiento": "análisis breve de por qué optimizar",
  "consulta_optimizada": "términos OR reales OR que OR usan",
  "hashtags_incluidos": ["#hashtag1"],
  "estrategia_aplicada": "estrategia usada",
  "probabilidad_exito": "alta|media|baja",
  "terminos_clave_agregados": ["término1"],
  "justificacion": "por qué estos términos funcionan mejor"
}

Usa SOLO términos que realmente se usan en redes sociales guatemaltecas.`;

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-reasoner',
        messages: [
          {
            role: 'system',
            content: 'Eres DeepSeek, un modelo de razonamiento avanzado especializado en optimización de búsquedas para redes sociales. Tu fortaleza es analizar consultas y generar términos de búsqueda que maximicen las posibilidades de encontrar contenido relevante.'
          },
          {
            role: 'user',
            content: deepSeekPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      console.log(`⚠️ Error llamando a DeepSeek: ${response.status}`);
      return {
        optimized: false,
        final_query: originalQuery,
        strategy: 'standard_expansion',
        error: `DeepSeek API error: ${response.status}`
      };
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
      console.log('⚠️ Respuesta de DeepSeek incompleta, usando expansión estándar');
      return {
        optimized: false,
        final_query: originalQuery,
        strategy: 'standard_expansion',
        error: 'DeepSeek response incomplete'
      };
    }

    const rawContent = data.choices[0].message.content.trim();

    let optimization;
    try {
      optimization = JSON.parse(rawContent);
    } catch (parseError) {
      // Intentar extraer JSON si está envuelto en otros caracteres
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          optimization = JSON.parse(jsonMatch[0]);
          console.log('✅ DeepSeek JSON extraído exitosamente');
        } catch (secondError) {
          console.log('⚠️ DeepSeek falló, usando expansión estándar');
          return {
            optimized: false,
            final_query: originalQuery,
            strategy: 'standard_expansion',
            error: `JSON parse error: ${parseError.message}`
          };
        }
      } else {
        console.log('⚠️ DeepSeek no devolvió JSON válido, usando expansión estándar');
        return {
          optimized: false,
          final_query: originalQuery,
          strategy: 'standard_expansion',
          error: `No JSON found in response`
        };
      }
    }

    console.log(`✅ DeepSeek optimizó: "${originalQuery}" → "${optimization.consulta_optimizada}"`);
    console.log(`🎯 Estrategia: ${optimization.estrategia_aplicada}`);
    console.log(`📊 Probabilidad de éxito: ${optimization.probabilidad_exito}`);

    return {
      optimized: true,
      original_query: originalQuery,
      final_query: optimization.consulta_optimizada,
      strategy: optimization.estrategia_aplicada,
      hashtags_included: optimization.hashtags_incluidos,
      key_terms_added: optimization.terminos_clave_agregados,
      success_probability: optimization.probabilidad_exito,
      reasoning: optimization.razonamiento,
      justification: optimization.justificacion
    };

  } catch (error) {
    console.error('❌ Error en optimización DeepSeek:', error);
    return {
      optimized: false,
      final_query: originalQuery,
      strategy: 'standard_expansion',
      error: error.message
    };
  }
}

/**
 * Ejecuta específicamente la herramienta nitter_context para obtener tweets contextuales
 * @param {string} query - Consulta de búsqueda
 * @param {string} location - Ubicación geográfica
 * @param {number} limit - Límite de tweets
 * @param {string} sessionId - ID de sesión
 * @param {Object} user - Información del usuario
 * @returns {Object} Resultado de la búsqueda de tweets contextuales
 */
async function executeNitterContext(query, location = 'guatemala', limit = 10, sessionId = null, user = null) {
  try {
    console.log(`🐦 Ejecutando nitter_context MCP: query="${query}", location="${location}", limit=${limit}`);

    if (!user || !user.id) {
      throw new Error('Usuario autenticado requerido para ejecutar nitter_context');
    }

    // DETECCIÓN DE QUERY OPTIMIZADA POR LLM (Laura)
    // Si la query contiene hashtags, emojis o jerga específica, es de Laura y NO debe modificarse
    const isLLMOptimized = query.includes('#') ||
      /\sOR\s/i.test(query) ||
      query.includes('⚽') ||
      query.includes('chapin') ||
      query.includes('guate') ||
      query.includes('crema') ||
      query.includes('rojo') ||
      /[🎯🏆⚽🏀🎾🥅]/g.test(query);

    let finalQuery;
    const optimizedLimit = optimizeTweetLimit(query, limit);

    if (isLLMOptimized) {
      // La query viene con hashtags/jerga (optimizada por LLM), pero si contiene
      // varias palabras separadas por espacios **y** no contiene operadores
      // OR, la convertimos a formato "palabra OR palabra" para imitar la
      // búsqueda palabra-por-palabra que usa el proceso de trending.

      const containsOR = /\sOR\s/i.test(query);
      const rawTokens = query.split(/\s+/).filter(t => t.length > 1);
      const meaningfulTokens = rawTokens.filter(t => !t.startsWith('#'));

      if (!containsOR && meaningfulTokens.length > 1) {
        const orQuery = meaningfulTokens.join(' OR ');
        // Mantener hashtags al final para no perder contexto viral
        const hashtags = rawTokens.filter(t => t.startsWith('#')).join(' ');
        finalQuery = `${orQuery} Guatemala ${hashtags}`.trim();
        console.log(`🔀 Query LLM optimizada convertida a OR palabra-por-palabra: "${finalQuery}"`);
      } else {
        // Sin modificación si ya contiene OR o es término único
        finalQuery = query;
        console.log(`🧠 Query optimizada por LLM preservada: "${finalQuery}"`);
      }
    } else {
      // SOLO PARA QUERIES SIMPLES: aplicar expansión estándar
      console.log(`🔧 Query simple detectada - aplicando expansión estándar`);

      // Desactivar completamente la optimización con DeepSeek para queries simples también
      const deepSeekOptimization = {
        optimized: false,
        final_query: query,
        strategy: 'disabled',
        reasoning: null,
        success_probability: null
      };

      // PASO 2: EXPANSIÓN ESTÁNDAR como backup
      const standardExpansion = expandSearchTerms(query);

      // Decidir qué query usar: DeepSeek si está optimizada, sino expansión estándar
      finalQuery = deepSeekOptimization.optimized ?
        deepSeekOptimization.final_query :
        standardExpansion;

      console.log(`🎯 Query original: "${query}"`);
      if (deepSeekOptimization.optimized) {
        console.log(`🧠 Query optimizada por DeepSeek: "${finalQuery}"`);
        console.log(`📋 Estrategia aplicada: ${deepSeekOptimization.strategy}`);
        console.log(`🎲 Probabilidad de éxito: ${deepSeekOptimization.success_probability}`);
      } else {
        console.log(`🚀 Query expandida estándar: "${finalQuery}"`);
      }
    }

    console.log(`📊 Límite optimizado: ${optimizedLimit} tweets`);

    // Generar session_id si no se proporciona
    const finalSessionId = sessionId || `mcp_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Detectar si es modo CHAT (solo búsqueda, sin guardar)
    const isChatMode = finalSessionId.startsWith('chat_');
    const saveToDb = !isChatMode; // En modo chat NO guardar, en otros modos SÍ guardar

    console.log(`📋 Modo: ${isChatMode ? 'CHAT (búsqueda sin guardar)' : 'NORMAL (guardar en BD)'}`);

    // PASO 3: EJECUTAR BÚSQUEDA CON TÉRMINOS OPTIMIZADOS
    const result = await processNitterContext(
      finalQuery, // Usar la query optimizada por DeepSeek
      user.id,
      finalSessionId,
      location,
      optimizedLimit,
      saveToDb // Pasar flag de guardado
    );

    if (result.success) {
      console.log(`✅ Nitter context procesado exitosamente: ${result.data.tweets_found} tweets analizados`);

      // Formatear respuesta para el agente AI con información adicional sobre la optimización
      const formattedTweets = result.data.tweets.map(tweet =>
        `@${tweet.usuario} (${tweet.fecha_tweet}): ${tweet.texto}\n` +
        `   📊 Sentimiento: ${tweet.sentimiento} (${tweet.score_sentimiento}) | ` +
        `Intención: ${tweet.intencion_comunicativa}\n` +
        `   💬 Engagement: ❤️${tweet.likes} 🔄${tweet.retweets} 💬${tweet.replies} | ` +
        `Entidades: ${tweet.entidades_mencionadas.length}\n`
      ).join('\n');

      return {
        success: true,
        tweets: result.data.tweets,
        tweets_found: result.data.tweets_found,
        query_original: query,
        query_final: finalQuery,
        optimization_applied: !isLLMOptimized,
        llm_optimized: isLLMOptimized,
        deepseek_strategy: isLLMOptimized ? 'llm_preserved' : 'standard_expansion',
        deepseek_reasoning: isLLMOptimized ? 'Query optimizada por LLM preservada sin modificaciones' : 'Query expandida con método estándar',
        success_probability: isLLMOptimized ? 'alta' : 'media',
        limit_requested: limit,
        limit_used: optimizedLimit,
        session_id: finalSessionId,
        formatted_context: `BÚSQUEDA INTELIGENTE CON PRESERVACIÓN LLM:
Query original del usuario: "${query}"
${isLLMOptimized ?
            `🧠 Query optimizada por LLM PRESERVADA: "${finalQuery}"
📋 Estrategia aplicada: preservación_inteligente
🎯 Razonamiento: Laura detectó y optimizó la query con jerga, hashtags y contexto específico
📊 Probabilidad de éxito estimada: alta (query pre-optimizada por IA)
🏷️ Elementos detectados: ${query.includes('#') ? 'hashtags' : ''}${query.includes('chapin') || query.includes('guate') ? ', jerga guatemalteca' : ''}${/[🎯🏆⚽🏀🎾🥅]/g.test(query) ? ', emojis contextuales' : ''}` :
            `🚀 Query expandida estándar: "${finalQuery}" (sin optimización LLM previa)`}
Tweets analizados: ${result.data.tweets_found}/${optimizedLimit}
Ubicación: ${location}

TWEETS ENCONTRADOS Y ANALIZADOS:
${formattedTweets}

ANÁLISIS CONTEXTUAL:
${isLLMOptimized ?
            `- Laura (LLM) pre-optimizó la query con jerga y hashtags guatemaltecos
- Se preservó la optimización inteligente sin modificaciones adicionales
- Query contiene elementos específicos de redes sociales guatemaltecas` :
            `- Se expandió automáticamente la consulta con métodos estándar`}
- Se optimizó el límite basado en el tipo de análisis requerido
- Todos los tweets incluyen análisis de sentimiento e intención comunicativa
- Las entidades mencionadas han sido extraídas automáticamente`,
        analysis_metadata: {
          deepseek_optimization: false,
          llm_optimization: isLLMOptimized,
          optimization_strategy: isLLMOptimized ? 'llm_preserved' : 'standard_expansion',
          original_vs_optimized: isLLMOptimized,
          limit_optimization_applied: optimizedLimit !== limit,
          tweets_analyzed: result.data.tweets_found,
          sentiment_distribution: result.data.tweets.reduce((acc, tweet) => {
            acc[tweet.sentimiento] = (acc[tweet.sentimiento] || 0) + 1;
            return acc;
          }, {}),
          average_engagement: result.data.tweets.reduce((sum, tweet) =>
            sum + (tweet.likes || 0) + (tweet.retweets || 0) + (tweet.replies || 0), 0
          ) / result.data.tweets.length || 0
        }
      };
    } else {
      throw new Error(result.error || 'Error procesando nitter_context');
    }

  } catch (error) {
    console.error(`❌ Error ejecutando nitter_context MCP:`, error);
    throw error;
  }
}

/**
 * Ejecuta específicamente la herramienta perplexity_search para búsquedas web inteligentes
 * @param {string} query - Consulta de búsqueda web
 * @param {string} location - Contexto geográfico
 * @param {string} focus - Enfoque específico de la búsqueda
 * @param {boolean} improveNitterSearch - Si también generar términos optimizados para Nitter
 * @param {Object} user - Usuario autenticado
 * @returns {Object} Resultado de la búsqueda web con Perplexity
 */
// ── Parallel AI search ────────────────────────────────────────────────────────

/**
 * Executes a web search using Parallel AI "Chat with the Web".
 * Returns the same structure as executePerplexitySearch for compatibility.
 */
async function executeParallelSearch(query, location = 'Guatemala', focus = 'general', user = null) {
  try {
    console.log(`🌐 [Parallel AI] Ejecutando búsqueda: query="${query}", location="${location}", focus="${focus}"`);

    const { callParallelAI } = require('./perplexity');

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.toLocaleString('es-ES', { month: 'long' });
    const currentDate = now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

    const isHistoricalQuery = focus === 'historia' || focus === 'historical';
    const temporalContext = isHistoricalQuery ? '' : `${currentMonth} ${currentYear} actual reciente`;

    let optimizedQuery = query;
    switch (focus) {
      case 'historia': case 'historical':
        optimizedQuery = `${query} ${location} historia contexto histórico`; break;
      case 'noticias':
        optimizedQuery = `${query} noticias ${location} ${temporalContext} últimas`; break;
      case 'eventos':
        optimizedQuery = `${query} eventos ${location} ${temporalContext} próximos`; break;
      case 'deportes':
        optimizedQuery = `${query} deportes ${location} ${temporalContext} temporada`; break;
      case 'politica':
        optimizedQuery = `${query} política ${location} ${temporalContext} gobierno`; break;
      case 'economia':
        optimizedQuery = `${query} economía ${location} ${temporalContext} últimas cifras`; break;
      default:
        optimizedQuery = `${query} ${location} ${temporalContext} información`;
    }

    const systemPrompt = isHistoricalQuery
      ? `Eres un asistente de investigación especializado en historia de ${location}. Proporciona información HISTÓRICA verificada con cronología y contexto.`
      : `Eres un asistente de investigación web para ${location}. Fecha actual: ${currentDate}. Proporciona información ACTUALIZADA (${currentMonth} ${currentYear}) y verificada.`;

    const userPrompt = `${systemPrompt}

Busca en la web: "${optimizedQuery}"

Responde en JSON:
{
  "consulta_original": "${query}",
  "consulta_optimizada": "${optimizedQuery}",
  "resumen": "Dos párrafos con la síntesis principal",
  "puntos_clave": ["dato concreto 1", "dato concreto 2"],
  "contexto_local": "Cómo impacta o se relaciona con ${location}",
  "datos_clave": ["dato numérico o cita", "otro dato"],
  "categoria": "noticias|eventos|deportes|politica|economia|cultura|general",
  "relevancia": "alta|media|baja",
  "fuentes": [{"titulo": "Título", "url": "https://..."}],
  "notas": "Información adicional o limitaciones"
}`;

    console.log(`   📡 Consultando Parallel AI (Chat with the Web)...`);
    const { content: rawResponse, citations } = await callParallelAI(userPrompt);
    console.log(`   ✅ Respuesta Parallel AI recibida (${rawResponse.length} chars, ${citations.length} fuentes)`);

    // Build search_results from citations (real web sources)
    const searchResults = citations.map(c => ({
      title: c.title || 'Fuente',
      url: c.url || '',
      snippet: null,
      source: 'parallel'
    }));

    // Try to parse JSON from response for structured analysis
    let analysis = rawResponse;
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        let jsonStr = jsonMatch[0].replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
        const parsed = JSON.parse(jsonStr);
        analysis = parsed.resumen || parsed.analysis || rawResponse;
      } catch (_) { /* use raw text */ }
    }

    return {
      success: true,
      data: {
        query, location, focus,
        search_results: searchResults,
        analysis,
        metadata: {
          source: 'parallel_ai',
          model: 'core',
          results_count: searchResults.length,
          timestamp: new Date().toISOString()
        }
      },
      agent: 'Vizta', tool: 'parallel_search', timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error(`❌ [Parallel AI] Error en executeParallelSearch:`, error.message);
    throw error;
  }
}

async function executePerplexitySearch(query, location = 'Guatemala', focus = 'general', improveNitterSearch = false, user = null) {
  try {
    console.log(`🔍 Ejecutando perplexity_search MCP: query="${query}", location="${location}", focus="${focus}", improveNitter=${improveNitterSearch}`);

    if (!user || !user.id) {
      throw new Error('Usuario autenticado requerido para ejecutar perplexity_search');
    }

    // Importar el servicio de Perplexity 
    const perplexityService = require('./perplexity');

    // Obtener fecha actual para contexto temporal
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.toLocaleString('es-ES', { month: 'long' });
    const currentDate = now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

    // 🛡️ SAFETY NET: Detectar y corregir años desactualizados en queries de tipo "actual"
    // Si la query menciona años viejos (2023, 2024) pero el focus es actual (politica, noticias, economia)
    // reemplazarlos por el año correcto
    const isCurrentQuery = ['politica', 'noticias', 'economia', 'eventos', 'deportes', 'general'].includes(focus);
    if (isCurrentQuery && currentYear > 2024) {
      // Detectar años desactualizados (2023, 2024) en queries que deberían ser actuales
      const outdatedYearPattern = /\b(202[0-4])\b/g;
      if (outdatedYearPattern.test(query)) {
        const originalQuery = query;
        query = query.replace(outdatedYearPattern, currentYear);
        console.log(`🔄 [PERPLEXITY] Año desactualizado detectado y corregido: "${originalQuery}" → "${query}"`);
      }
    }

    // Construir consulta optimizada basada en el enfoque
    let optimizedQuery = query;
    let searchContext = '';

    // Determinar si necesita contexto temporal actual o histórico
    const isHistoricalQuery = focus === 'historia' || focus === 'historical';
    const temporalContext = isHistoricalQuery ? '' : `${currentMonth} ${currentYear} actual reciente`;

    switch (focus) {
      case 'historia':
      case 'historical':
        optimizedQuery = `${query} ${location} historia contexto histórico`;
        searchContext = `contexto histórico y eventos pasados de ${location}`;
        break;
      case 'noticias':
        optimizedQuery = `${query} noticias ${location} ${temporalContext} últimas`;
        searchContext = `noticias actuales y eventos recientes de ${currentMonth} ${currentYear}`;
        break;
      case 'eventos':
        optimizedQuery = `${query} eventos ${location} ${temporalContext} próximos`;
        searchContext = `eventos y actividades actuales de ${currentMonth} ${currentYear}`;
        break;
      case 'deportes':
        optimizedQuery = `${query} deportes ${location} ${temporalContext} temporada`;
        searchContext = `deportes y competencias actuales de ${currentMonth} ${currentYear}`;
        break;
      case 'politica':
        optimizedQuery = `${query} política ${location} ${temporalContext} gobierno`;
        searchContext = `política y gobierno actual de ${currentMonth} ${currentYear}`;
        break;
      case 'economia':
        optimizedQuery = `${query} economía ${location} ${temporalContext} últimas cifras`;
        searchContext = `economía y finanzas actuales de ${currentMonth} ${currentYear}`;
        break;
      case 'cultura':
        optimizedQuery = `${query} cultura ${location} ${temporalContext} entretenimiento`;
        searchContext = `cultura y entretenimiento actual de ${currentMonth} ${currentYear}`;
        break;
      default:
        optimizedQuery = `${query} ${location} ${temporalContext} información`;
        searchContext = `información general actualizada de ${currentMonth} ${currentYear}`;
    }

    console.log(`🎯 Consulta optimizada: "${optimizedQuery}"`);

    // Preparar prompt especializado según el enfoque (histórico vs actual)
    const webSearchPrompt = isHistoricalQuery
      ? `Analiza la consulta "${query}" y entrega información HISTÓRICA verificada.

**CONTEXTO GEOGRÁFICO: ${location}**
**ENFOQUE: ${searchContext}**

REQUISITOS PARA CONSULTAS HISTÓRICAS:
- Proporciona información sobre eventos, períodos y figuras históricas
- Incluye cronología y contexto temporal relevante
- Conecta eventos históricos cuando sea relevante
- Prioriza fuentes académicas e históricas confiables

INSTRUCCIONES DE RESPUESTA:
- Mantén un tono neutral, analítico y sin opiniones personales
- Integra contexto histórico y cronológico
- Explica causas, consecuencias y relaciones entre eventos
- Incluye fechas específicas y períodos relevantes

FORMATO DE RESPUESTA (JSON):
{
  "consulta_original": "${query}",
  "consulta_optimizada": "${optimizedQuery}",
  "resumen": "Síntesis histórica con cronología",
  "puntos_clave": ["evento histórico 1", "evento histórico 2"],
  "contexto_local": "Contexto histórico de ${location}",
  "datos_clave": ["fecha/período clave", "otro dato histórico"],
  "categoria": "historia|politica|social",
  "relevancia": "alta|media|baja",
  "fuentes": [{"titulo": "Título", "url": "https://..."}],
  "notas": "Información adicional o conexiones históricas"
}`
      : `Analiza la consulta "${query}" y entrega información ACTUALIZADA y verificada.

**FECHA ACTUAL: ${currentDate}**
**CONTEXTO TEMPORAL: ${currentMonth} ${currentYear}**
**CONTEXTO GEOGRÁFICO: ${location}**
**ENFOQUE: ${searchContext}**

REQUISITOS DE ACTUALIDAD:
- Limita la información a hechos de ${currentMonth} ${currentYear} o muy recientes
- Si no encuentras datos recientes, indícalo claramente
- Prioriza fuentes confiables y con fecha clara

INSTRUCCIONES DE RESPUESTA:
- Mantén un tono neutral, analítico y sin opiniones personales
- Integra contexto local relevante para ${location}
- Si la consulta es sobre una persona, incluye su situación actual en ${currentYear}
- Si se trata de eventos o temas, señala las fechas y desarrollos más recientes

FORMATO DE RESPUESTA (JSON):
{
  "consulta_original": "${query}",
  "consulta_optimizada": "${optimizedQuery}",
  "resumen": "Dos párrafos neutrales con la síntesis principal",
  "puntos_clave": ["dato concreto 1", "dato concreto 2"],
  "contexto_local": "Cómo impacta o se relaciona con ${location}",
  "datos_clave": ["dato numérico o cita", "otro dato"],
  "categoria": "noticias|eventos|deportes|politica|economia|cultura|general",
  "relevancia": "alta|media|baja",
  "fuentes": [{"titulo": "Título o descripción breve", "url": "https://..."}],
  "notas": "Información adicional o limitaciones",
  ${improveNitterSearch ? `"optimizacion_redes_sociales": {"hashtags_sugeridos": [], "terminos_alternativos": [], "busqueda_nitter_optimizada": ""},` : ''}
  "alertas": "Mensajes importantes"
}`;

    // Ejecutar búsqueda con Perplexity
    const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

    if (!PERPLEXITY_API_KEY) {
      throw new Error('PERPLEXITY_API_KEY no configurada');
    }

    const systemPrompt = isHistoricalQuery
      ? `Eres un asistente de investigación especializado en historia y contexto histórico de ${location}.

Tu trabajo es encontrar información HISTÓRICA precisa y contextualizada sobre eventos, períodos y figuras del pasado.

**UBICACIÓN: ${location}**
**ENFOQUE: ${searchContext}**

CARACTERÍSTICAS CRÍTICAS:
- Proporciona contexto histórico completo y cronológico
- Conecta eventos históricos y explica relaciones causales
- Identifica períodos, fechas y líneas de tiempo relevantes
- Incluye antecedentes y consecuencias de eventos históricos
- Usa fuentes académicas e históricas confiables
- Explica el impacto y legado de eventos históricos

ENFOQUE HISTÓRICO:
- Proporciona fechas exactas y períodos históricos
- Explica el contexto político/social de la época
- Conecta eventos en secuencia cronológica
- Identifica actores históricos clave
- Analiza causas y consecuencias

Enfócate en proporcionar contexto histórico completo, cronología clara y conexiones entre eventos.`
      : `Eres un asistente de investigación especializado en búsquedas web inteligentes para ${location}.

Tu trabajo es encontrar información ACTUALIZADA, precisa y contextualizada sobre cualquier tema consultado.

**FECHA ACTUAL: ${currentDate}**
**CONTEXTO TEMPORAL: ${currentMonth} ${currentYear}**
**UBICACIÓN: ${location}**

CARACTERÍSTICAS CRÍTICAS:
- Busca información de ${currentMonth} ${currentYear} o MUY RECIENTE
- Contextualiza ESPECÍFICAMENTE para el público de ${location}
- Proporciona datos específicos CON FECHAS DE ${currentYear}
- Identifica fuentes confiables Y ACTUALES
- Analiza relevancia local vs global
- Sugiere términos relacionados para búsquedas adicionales

FILTROS TEMPORALES:
- Prioriza eventos de ${currentMonth} ${currentYear}
- Si no hay información actual, dilo explícitamente
- Enfócate en desarrollos y eventos RECIENTES

Enfócate en información actual, relevante y verificable de ${currentMonth} ${currentYear}.`;

    const payload = {
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: webSearchPrompt
        }
      ],
      search_context: {
        search_queries: isHistoricalQuery
          ? [optimizedQuery, query + ' ' + location + ' historia']
          : [optimizedQuery, query + ' ' + location, query + ' ' + currentMonth + ' ' + currentYear]
      },
      temperature: 0.3,
      max_tokens: 800
    };

    console.log(`📡 Realizando búsqueda web con Perplexity Search API...`);

    const searchTimeoutMs = Number(process.env.PERPLEXITY_SEARCH_TIMEOUT_MS || 15000);
    const searchController = new AbortController();
    const searchStart = Date.now();
    const searchPromise = fetch('https://api.perplexity.ai/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: optimizedQuery,
        max_results: 10,
        country: 'GT',
        max_tokens_per_page: 1024
      }),
      signal: searchController.signal
    }).then(async response => {
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Error en API de Perplexity Search: ${response.status} ${response.statusText} ${errorText}`.trim());
      }
      return response.json();
    }).catch(error => {
      if (error.name === 'AbortError') {
        return { aborted: true };
      }
      throw error;
    });

    let searchData = null;
    let searchDurationMs = null;
    try {
      const searchOutcome = await Promise.race([
        searchPromise,
        new Promise(resolve => setTimeout(() => resolve({ timeout: true }), searchTimeoutMs))
      ]);

      if (searchOutcome?.timeout) {
        searchController.abort();
        console.log(`[VIZTA] ⏱️ Perplexity Search API excedió ${searchTimeoutMs}ms, continuando sin contexto enriquecido.`);
      } else if (searchOutcome?.aborted) {
        console.log(`[VIZTA] ⚠️ Perplexity Search abortada por timeout externo.`);
      } else if (searchOutcome && !searchOutcome.aborted && !searchOutcome.timeout) {
        searchData = searchOutcome;
        searchDurationMs = Date.now() - searchStart;
        console.log(`   📊 Obtained ${searchData.results?.length || 0} search results from Perplexity Search API in ${searchDurationMs}ms`);
      }
    } catch (searchError) {
      searchController.abort();
      console.log(`[VIZTA] ⚠️ Perplexity Search API failed: ${searchError.message}`);
    }

    // If Perplexity Search API returned results, use them directly
    if (searchData?.results?.length > 0) {
      console.log(`[VIZTA] ✅ Using search results directly from Perplexity Search API`);
      const searchResults = searchData.results.slice(0, 5);
      const searchSummary = searchResults.map((result, i) =>
        `**${i + 1}. ${result.title}**\n${result.snippet || ''}\n*Fuente: ${result.url}*`
      ).join('\n\n');
      const analysis = `Basado en búsqueda web actual sobre "${query}" en ${location}:\n\n${searchSummary}\n\n*Información obtenida de ${searchResults.length} fuentes web actualizadas.*`;
      return {
        success: true,
        data: {
          query, location, focus,
          search_results: searchResults,
          analysis,
          metadata: { search_time_ms: searchDurationMs, results_count: searchResults.length, source: 'perplexity_search_api', timestamp: new Date().toISOString() }
        },
        agent: 'Vizta', tool: 'perplexity_search', timestamp: new Date().toISOString()
      };
    }

    // Perplexity Search API did not return results — fall back to chat completions (sonar model has web search built-in)
    console.log(`[VIZTA] ⚠️ Perplexity Search API returned no results — trying chat completions (sonar) as internal fallback`);
    const chatStart = Date.now();
    const chatTimeoutMs = Number(process.env.PERPLEXITY_CHAT_TIMEOUT_MS || 25000);
    const chatController = new AbortController();

    const chatPayload = {
      model: 'sonar',
      messages: [
        { role: 'system', content: `Eres un asistente de investigación especializado en búsquedas web para ${location}. Proporciona información actualizada, precisa y contextualizada. Fecha actual: ${new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}.` },
        { role: 'user', content: `${optimizedQuery}\n\nResponde con un resumen claro y conciso con las fuentes más relevantes que encuentres.` }
      ],
      temperature: 0.3,
      max_tokens: 1024
    };

    let chatData = null;
    let chatDurationMs = null;
    try {
      const chatPromise = fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${PERPLEXITY_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(chatPayload),
        signal: chatController.signal
      }).then(async r => {
        if (!r.ok) { const t = await r.text().catch(() => ''); throw new Error(`Perplexity chat completions error: ${r.status} ${t}`); }
        return r.json();
      });

      const chatOutcome = await Promise.race([
        chatPromise,
        new Promise(resolve => setTimeout(() => resolve({ timeout: true }), chatTimeoutMs))
      ]);

      if (chatOutcome?.timeout) {
        chatController.abort();
        console.log(`[VIZTA] ⏱️ Perplexity chat completions excedió ${chatTimeoutMs}ms`);
      } else {
        chatData = chatOutcome;
        chatDurationMs = Date.now() - chatStart;
        console.log(`[VIZTA] 🤖 Perplexity chat completions completado en ${chatDurationMs}ms`);
      }
    } catch (chatError) {
      chatController.abort();
      console.log(`[VIZTA] ⚠️ Perplexity chat completions failed: ${chatError.message}`);
    }

    if (chatData?.choices?.[0]?.message?.content) {
      const rawResponse = chatData.choices[0].message.content;
      // citations come as array of URLs in sonar model
      const citations = chatData.citations || [];
      const chatSources = citations.slice(0, 5).map((url, i) => ({
        title: `Fuente ${i + 1}`,
        url,
        snippet: null
      }));
      // Also parse inline citations if present [1][2]...
      const analysis = rawResponse;
      return {
        success: true,
        data: {
          query, location, focus,
          search_results: chatSources,
          analysis,
          metadata: { chat_time_ms: chatDurationMs, results_count: chatSources.length, source: 'perplexity_chat_completions', timestamp: new Date().toISOString() }
        },
        agent: 'Vizta', tool: 'perplexity_chat', timestamp: new Date().toISOString()
      };
    }

    // Both Perplexity paths failed — throw so the outer catch tries Exa (when provider='both')
    throw new Error('Perplexity Search API y Chat Completions no retornaron resultados');

  } catch (error) {
    console.error(`❌ Error ejecutando perplexity_search MCP:`, error);
    console.log(`🔄 Intentando fallback con Exa Search...`);

    try {
      // Fallback to Exa Search
      const EXA_API_KEY = process.env.EXA_API_KEY;
      if (!EXA_API_KEY) {
        throw new Error('EXA_API_KEY no configurada para fallback');
      }

      console.log(`🔍 Ejecutando Exa Search como fallback: query="${query}"`);

      const exaResponse = await fetch('https://api.exa.ai/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${EXA_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: query,
          numResults: 10,
          type: 'search',
          useAutoprompt: true
        })
      });

      if (!exaResponse.ok) {
        throw new Error(`Exa Search API error: ${exaResponse.status}`);
      }

      const exaData = await exaResponse.json();
      const searchResults = exaData.results?.map(result => ({
        title: result.title || 'Sin título',
        url: result.url || '',
        snippet: result.text || result.snippet || '',
        date: result.publishedDate || null
      })) || [];

      return {
        success: true,
        result: {
          search_results: searchResults,
          analysis: `Búsqueda realizada con Exa Search como fallback de Perplexity`,
          metadata: {
            results_count: searchResults.length,
            source: 'exa_search_fallback',
            original_error: error.message,
            timestamp: new Date().toISOString()
          }
        },
        agent: 'Vizta',
        tool: 'perplexity_search_with_exa_fallback',
        timestamp: new Date().toISOString()
      };

    } catch (fallbackError) {
      console.error(`❌ Error en fallback Exa Search:`, fallbackError);
      throw new Error(`Perplexity falló: ${error.message}. Exa Search fallback también falló: ${fallbackError.message}`);
    }
  }
}

/**
 * Ejecuta la herramienta user_projects: obtiene proyectos del usuario
 * @param {number} limit - Límite de proyectos a obtener
 * @param {string} status - Filtro por estado (opcional)
 * @param {string} priority - Filtro por prioridad (opcional)
 * @param {Object} user - Usuario autenticado
 * @returns {Object} Resultados de proyectos del usuario
 */
async function executeUserProjects(limit = 20, status = null, priority = null, user = null) {
  try {
    if (!user || !user.id) {
      throw new Error('Usuario no autenticado. Se requiere autenticación para acceder a proyectos personales.');
    }

    console.log(`📊 Ejecutando user_projects para usuario: ${user.email} (${user.id})`);

    const options = { limit };
    if (status) options.status = status;
    if (priority) options.priority = priority;

    const projectsRaw = await getUserProjects(user.id, options);

    // Normalizar colecciones/objetos para evitar errores en plantillas
    const projects = Array.isArray(projectsRaw) ? projectsRaw : (projectsRaw ? [projectsRaw] : []);

    // Obtener estadísticas generales (con valores por defecto seguros)
    const userStatsRaw = await getUserStats(user.id);
    const userStats = {
      totalProjects: Number(userStatsRaw?.totalProjects || projects.length || 0),
      totalCodexItems: Number(userStatsRaw?.totalCodexItems || 0),
      totalDecisions: Number(userStatsRaw?.totalDecisions || 0),
      projectsByStatus: userStatsRaw?.projectsByStatus && typeof userStatsRaw.projectsByStatus === 'object'
        ? userStatsRaw.projectsByStatus
        : {}
    };

    const distributionByStatusEntries = Object.entries(userStats.projectsByStatus || {});
    const distributionByStatusText = distributionByStatusEntries.length > 0
      ? distributionByStatusEntries.map(([key, value]) => `• ${key}: ${value} proyectos`).join('\n')
      : '• Sin datos de estado disponibles';

    const formattedProjectsText = projects.map(project => {
      const stats = project?.stats || {};
      const decisionsCount = Number(stats.decisionsCount || 0);
      const assetsCount = Number(stats.assetsCount || 0);
      const createdAt = project?.created_at ? new Date(project.created_at) : null;
      const createdAtText = createdAt ? createdAt.toLocaleDateString('es-ES') : 'N/D';
      const tags = Array.isArray(project?.tags) ? project.tags : [];

      return `\n📁 ${project?.title || 'Proyecto sin título'} (ID: ${project?.id || 'N/D'})
   Estado: ${project?.status || 'N/D'} | Prioridad: ${project?.priority || 'N/D'}
   Categoría: ${project?.category || 'Sin categoría'}
   Decisiones: ${decisionsCount} | Assets: ${assetsCount}
   ${project?.description ? `Descripción: ${String(project.description).substring(0, 100)}...` : ''}
   Creado: ${createdAtText}
   ${tags.length > 0 ? `Tags: ${tags.join(', ')}` : ''}`;
    }).join('\n');

    // Formatear respuesta para el agente AI
    const formattedResponse = `PROYECTOS DEL USUARIO: ${user.email}

ESTADÍSTICAS GENERALES:
• Total de proyectos: ${userStats.totalProjects}
• Total de items en Codex: ${userStats.totalCodexItems}
• Total de decisiones: ${userStats.totalDecisions}

DISTRIBUCIÓN POR ESTADO:
${distributionByStatusText}

PROYECTOS (${projects.length} mostrados):
${formattedProjectsText}

Los proyectos están ordenados por fecha de actualización más reciente.`;

    return {
      success: true,
      user_id: user.id,
      user_email: user.email,
      filters_applied: { limit, status, priority },
      total_projects: projects.length,
      user_stats: userStats,
      projects: projects,
      formatted_response: formattedResponse,
      analysis_result: formattedResponse,
      metadata: {
        service: 'user_projects',
        execution_time: new Date().toISOString(),
        data_source: 'supabase'
      }
    };

  } catch (error) {
    console.error(`❌ Error ejecutando user_projects MCP:`, error);
    throw error;
  }
}

/**
 * Extract relevant keywords from long text for search
 * Uses simple frequency analysis + stopword filtering
 */
function extractKeywordsFromText(text, maxKeywords = 5) {
  // Spanish stopwords
  const stopwords = new Set([
    'el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'ser', 'se',
    'no', 'haber', 'por', 'con', 'su', 'para', 'como', 'estar',
    'tener', 'le', 'lo', 'todo', 'pero', 'más', 'hacer', 'o',
    'poder', 'decir', 'este', 'ir', 'otro', 'ese', 'si', 'me',
    'ya', 'ver', 'porque', 'dar', 'cuando', 'él', 'muy', 'sin',
    'vez', 'mucho', 'saber', 'qué', 'sobre', 'mi', 'alguno',
    'mismo', 'yo', 'también', 'hasta', 'año', 'dos', 'querer',
    'entre', 'así', 'primero', 'desde', 'grande', 'eso', 'ni',
    'nos', 'llegar', 'pasar', 'tiempo', 'ella', 'sí', 'día',
    'uno', 'bien', 'poco', 'deber', 'entonces', 'poner', 'cosa',
    'tanto', 'hombre', 'parecer', 'nuestro', 'tan', 'donde',
    'ahora', 'parte', 'después', 'vida', 'quedar', 'siempre',
    'creer', 'hablar', 'llevar', 'dejar', 'nada', 'cada', 'seguir',
    'menos', 'nuevo', 'aquí', 'sólo', 'estos', 'grafico', 'base',
    'esto', 'armame', 'ponme', 'detalles', 'está', 'fue', 'descrita'
  ]);

  // Tokenize and filter
  const words = text
    .toLowerCase()
    .replace(/[^\w\sáéíóúñü]/g, ' ') // Keep accented chars
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopwords.has(word));

  // Count frequency
  const frequency = {};
  words.forEach(word => {
    frequency[word] = (frequency[word] || 0) + 1;
  });

  // Get top keywords by frequency
  const sortedKeywords = Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);

  return sortedKeywords.join(' ');
}

/**
 * Ejecuta la herramienta user_codex: accede al Codex personal del usuario
 * @param {string} projectId - ID del proyecto (opcional)
 * @param {string} searchQuery - Búsqueda en contenido (opcional)
 * @param {number} limit - Límite de items a obtener
 * @param {string} type - Filtro por tipo (opcional)
 * @param {Array} tags - Filtro por tags (opcional)
 * @param {Object} user - Usuario autenticado
 * @returns {Object} Resultados del Codex personal
 */
// Búsqueda en el Universo Investigativo por TÉRMINOS individuales (no exige substring
// contiguo de toda la frase) + re-ranking por cobertura. Aquí viven posts, tweets,
// actores, entidades, eventos y snippets. Reutilizada por codex.search y codex.search_universe.
const _UNIV_STOPWORDS = new Set(['del','los','las','una','uno','que','con','por','para','sobre','este','esta','sus','the','and','dame','dime','busca','buscar','localiza','encuentra','post','codex','códex','sobre']);
function _univTerms(query) {
  if (!query) return [];
  return [...new Set(
    query.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .split(/[^a-z0-9ñ]+/)
      .filter(t => t.length >= 3 && !_UNIV_STOPWORDS.has(t))
  )].slice(0, 8);
}
async function searchUniverseByTerms(supabase, userId, query, limit = 10, tipo = null) {
  const qTerms = _univTerms(query);
  let uq = supabase
    .from('codex_universe_items')
    .select('id, tipo, name, description, tags, aliases, details, created_at, updated_at')
    .eq('user_id', userId);
  if (tipo) uq = uq.ilike('tipo', tipo);
  if (query) {
    if (qTerms.length > 0) {
      const ors = [];
      for (const t of qTerms) {
        const esc = t.replace(/[%,().]/g, ' ');
        ors.push(`name.ilike.%${esc}%`);
        ors.push(`description.ilike.%${esc}%`);
      }
      uq = uq.or(ors.join(','));
    } else {
      uq = uq.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
    }
  }
  const fetchLimit = qTerms.length > 0 ? Math.min(limit * 4, 40) : limit;
  let { data, error } = await uq.order('updated_at', { ascending: false }).limit(fetchLimit);
  if (error) return { items: [], terms: qTerms, error: error.message };
  if (qTerms.length > 0 && Array.isArray(data) && data.length > 0) {
    const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const score = (it) => {
      const name = norm(it.name), desc = norm(it.description);
      let s = 0;
      for (const t of qTerms) { if (name.includes(t)) s += 2; else if (desc.includes(t)) s += 1; }
      return s;
    };
    data = data
      .map(it => ({ it, s: score(it) }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s || (new Date(b.it.updated_at) - new Date(a.it.updated_at)))
      .slice(0, limit)
      .map(x => x.it);
  }
  return { items: data || [], terms: qTerms };
}

// Serializa los read-modify-write sobre free_canvases.data por espacio, para evitar
// "lost updates" cuando el agente ejecuta varias escrituras al mismo espacio en paralelo
// dentro de una misma ronda (Promise.all). Mutex en proceso (única instancia del API).
const _spaceLocks = new Map();
function withSpaceLock(spaceId, fn) {
  const prev = _spaceLocks.get(spaceId) || Promise.resolve();
  const run = prev.then(fn, fn); // ejecuta fn pase lo que pase con la anterior
  _spaceLocks.set(spaceId, run.then(() => {}, () => {}));
  return run;
}
// Aplica una mutación atómica a free_canvases.data: re-lee la fila DENTRO del lock,
// aplica el mutator y guarda. Garantiza que escrituras concurrentes no se pisen.
async function mutateSpaceData(supabase, uid, spaceId, mutator) {
  return withSpaceLock(spaceId, async () => {
    const { data: row, error: gErr } = await supabase
      .from('free_canvases').select('id, name, data')
      .eq('id', spaceId).eq('user_id', uid).maybeSingle();
    if (gErr) return { error: gErr.message };
    if (!row) return { error: 'Espacio no encontrado o sin acceso' };
    const d = (row.data && typeof row.data === 'object') ? row.data : {};
    mutator(d);
    const { error: uErr } = await supabase
      .from('free_canvases').update({ data: d, updated_at: new Date().toISOString() })
      .eq('id', spaceId).eq('user_id', uid);
    if (uErr) return { error: uErr.message };
    return { name: row.name };
  });
}

async function executeUserCodex(projectId = null, searchQuery = null, limit = 20, type = null, tags = null, user = null) {
  try {
    if (!user || !user.id) {
      throw new Error('Usuario no autenticado. Se requiere autenticación para acceder al Codex personal.');
    }

    console.log(`📚 Ejecutando user_codex para usuario: ${user.email} (${user.id})`);
    console.log(`Filtros - Proyecto: ${projectId}, Búsqueda: "${searchQuery}", Tipo: ${type}`);

    const options = { limit };
    if (projectId) options.projectId = projectId;
    if (searchQuery) {
      // Extract keywords if query is too long (>200 chars indicates full text, not search terms)
      const processedQuery = searchQuery.length > 200
        ? extractKeywordsFromText(searchQuery, 5) // Extract top 5 keywords
        : searchQuery;
      options.query = processedQuery;
      console.log(`🔍 Query processed: "${searchQuery.substring(0, 100)}..." → "${processedQuery}"`);
    }
    if (type) options.type = type;
    if (tags) options.tags = tags;

    const codexItemsRaw = await getUserCodex(user.id, options);
    const codexItems = Array.isArray(codexItemsRaw?.data) ? codexItemsRaw.data : [];

    // Si hay búsqueda específica, usar también la función de búsqueda
    let searchResults = null;
    if (searchQuery) {
      // Use the same processed query for searchUserCodex
      const processedQuery = searchQuery.length > 200
        ? extractKeywordsFromText(searchQuery, 5)
        : searchQuery;
      const sr = await searchUserCodex(processedQuery, user.id, { limit: 10 });
      searchResults = Array.isArray(sr?.data) ? sr.data : [];
    }

    // Formatear respuesta para el agente AI
    const filtersText = [
      projectId ? `Proyecto: ${projectId}` : null,
      searchQuery ? `Búsqueda: "${searchQuery}"` : null,
      type ? `Tipo: ${type}` : null,
      Array.isArray(tags) ? `Tags: ${tags.join(', ')}` : (typeof tags === 'string' && tags.trim() ? `Tags: ${tags}` : null)
    ].filter(Boolean).join(' | ');

    const formattedResponse = `CODEX PERSONAL: ${user.email}

${filtersText ? `FILTROS APLICADOS: ${filtersText}` : 'MOSTRANDO TODOS LOS ITEMS'}

RESULTADOS DEL CODEX (${codexItems.length} items):
${codexItems.map(item => {
      const itemTags = Array.isArray(item?.etiquetas) ? item.etiquetas : [];
      const createdAt = item?.created_at ? new Date(item.created_at).toLocaleDateString('es-ES') : 'N/D';
      return `\n📄 ${item?.titulo || 'Sin título'} (ID: ${item?.id || 'N/D'})
   Proyecto: ${item?.proyecto || 'N/D'}
   Tipo: ${item?.tipo || 'N/D'}
   ${item?.nombre_archivo ? `Archivo: ${item.nombre_archivo}` : ''}
   ${item?.url ? `URL: ${item.url}` : ''}
   ${item?.audio_transcription ? `🎵 Transcripción: ${item.audio_transcription.substring(0, 200)}${item.audio_transcription.length > 200 ? '...' : ''}` : ''}
   ${item?.document_analysis ? `📊 Análisis: ${item.document_analysis.substring(0, 200)}${item.document_analysis.length > 200 ? '...' : ''}` : ''}
   ${itemTags.length > 0 ? `Tags: ${itemTags.join(', ')}` : ''}
   ${item?.descripcion ? `Descripción: ${item.descripcion.substring(0, 150)}${item.descripcion.length > 150 ? '...' : ''}` : ''}
   Creado: ${createdAt}`;
    }).join('\n')}

${searchResults && searchResults.length > 0 ? `
BÚSQUEDA ESPECÍFICA "${searchQuery}" (${searchResults.length} resultados más relevantes):
${searchResults.slice(0, 5).map(result => `
🔍 ${result.titulo || 'Sin título'} (Relevancia: ${result.relevance_score ?? 'N/D'})
   Proyecto: ${result.proyecto || 'N/D'}
   Tipo: ${result.tipo || 'N/D'}
   ${result.descripcion ? result.descripcion.substring(0, 150) + (result.descripcion.length > 150 ? '...' : '') : ''}
`).join('\n')}` : ''}

Total de items disponibles en tu Codex personal.`;

    return {
      success: true,
      user_id: user.id,
      user_email: user.email,
      filters_applied: { projectId, searchQuery, limit, type, tags },
      total_items: codexItems.length,
      codex_items: codexItems,
      search_results: searchResults,
      formatted_response: formattedResponse,
      analysis_result: formattedResponse,
      metadata: {
        service: 'user_codex',
        execution_time: new Date().toISOString(),
        data_source: 'supabase',
        search_performed: !!searchQuery
      }
    };

  } catch (error) {
    console.error(`❌ Error ejecutando user_codex MCP:`, error);
    throw error;
  }
}

/**
 * ✨ NUEVO: Ejecuta user_codex_specific - obtiene items específicos del Codex por IDs
 * Usado cuando el usuario selecciona manualmente items desde el modal de contexto
 * @param {Array<string>} itemIds - Array de IDs de items del Codex
 * @param {Object} user - Usuario autenticado
 * @returns {Object} Items específicos del Codex con estadísticas
 */
async function executeUserCodexSpecific(itemIds = [], user = null) {
  try {
    if (!user || !user.id) {
      throw new Error('Usuario no autenticado. Se requiere autenticación para acceder al Codex.');
    }

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return {
        success: true,
        user_id: user.id,
        user_email: user.email,
        total_items: 0,
        codex_items: [],
        formatted_response: 'No se seleccionaron items del Codex.',
        metadata: {
          service: 'user_codex_specific',
          selection_mode: 'manual',
          execution_time: new Date().toISOString()
        }
      };
    }

    console.log(`📚 Ejecutando user_codex_specific para usuario: ${user.email}`);
    console.log(`🎯 Items solicitados: ${itemIds.length}`);

    // Usar Robert's CodexEngine para obtener items específicos
    const robert = require('./agents/robert');
    const robertInstance = new robert.RobertAgent();
    const result = await robertInstance.codexEngine.getCodexItemsByIds(user, itemIds);

    // Formatear respuesta para Vizta
    const formattedResponse = `CODEX PERSONAL (Selección Manual): ${user.email}

ITEMS SELECCIONADOS: ${result.total}
${result.stats.wiki_items > 0 ? `📚 Wiki: ${result.stats.wiki_items} items` : ''}
${result.stats.monitoring_items > 0 ? `📊 Monitoreos: ${result.stats.monitoring_items} items` : ''}
${result.stats.general_items > 0 ? `📁 Archivos: ${result.stats.general_items} items` : ''}

DETALLES:
${result.codex.map(item => {
      const itemTags = Array.isArray(item?.etiquetas) ? item.etiquetas : [];
      const createdAt = item?.created_at ? new Date(item.created_at).toLocaleDateString('es-ES') : 'N/D';

      let details = `\n${getCategoryIcon(item.category, item.subcategory)} ${item?.titulo || 'Sin título'} (ID: ${item?.id})`;
      details += `\n   Categoría: ${item.category || 'N/D'} > ${item.subcategory || 'N/D'}`;
      details += `\n   Proyecto: ${item?.proyecto || 'N/D'}`;

      // Info específica de Wiki
      if (item.category === 'wiki' && item.metadata) {
        if (item.metadata.relevance_score) {
          details += `\n   ⭐ Relevancia: ${item.metadata.relevance_score}/100`;
        }
        if (item.metadata.political_party) {
          details += `\n   🏛️ Partido: ${item.metadata.political_party}`;
        }
        if (item.metadata.position) {
          details += `\n   💼 Cargo: ${item.metadata.position}`;
        }
        if (item.metadata.related_items && item.metadata.related_items.length > 0) {
          details += `\n   🔗 ${item.metadata.related_items.length} items relacionados`;
        }
      }

      // Info específica de Monitoring
      if (item.category === 'monitoring' && item.metadata) {
        if (item.metadata.platform) {
          details += `\n   📱 Plataforma: ${item.metadata.platform}`;
        }
        if (item.metadata.sentiment) {
          details += `\n   ${item.metadata.sentiment === 'positive' ? '😊' : item.metadata.sentiment === 'negative' ? '😔' : '😐'} Sentimiento: ${item.metadata.sentiment}`;
        }
        if (item.metadata.tweet_count) {
          details += `\n   📊 ${item.metadata.tweet_count} tweets`;
        }
      }

      if (item.descripcion) {
        details += `\n   Descripción: ${item.descripcion.substring(0, 150)}${item.descripcion.length > 150 ? '...' : ''}`;
      }
      if (item.audio_transcription) {
        details += `\n   🎵 Transcripción: ${item.audio_transcription.substring(0, 200)}...`;
      }
      if (item.document_analysis) {
        details += `\n   📊 Análisis: ${item.document_analysis.substring(0, 200)}...`;
      }
      if (itemTags.length > 0) {
        details += `\n   Tags: ${itemTags.slice(0, 5).join(', ')}`;
      }
      details += `\n   Fecha: ${createdAt}`;

      return details;
    }).join('\n\n')}

ESTADÍSTICAS DE SELECCIÓN:
• Total de items: ${result.total}
${result.stats.by_category && Object.keys(result.stats.by_category).length > 0 ?
        `• Por categoría: ${Object.entries(result.stats.by_category).map(([cat, count]) => `${cat} (${count})`).join(', ')}` : ''}
${result.stats.by_subcategory && Object.keys(result.stats.by_subcategory).length > 0 ?
        `• Por tipo: ${Object.entries(result.stats.by_subcategory).map(([sub, count]) => `${sub} (${count})`).join(', ')}` : ''}
${result.stats.with_transcription > 0 ? `• Con transcripción: ${result.stats.with_transcription}` : ''}
${result.stats.with_analysis > 0 ? `• Con análisis: ${result.stats.with_analysis}` : ''}

Estos son los items específicos que el usuario seleccionó como contexto para su análisis.`;

    return {
      success: true,
      user_id: user.id,
      user_email: user.email,
      selection_mode: 'manual',
      requested_ids: itemIds,
      total_items: result.total,
      codex_items: result.codex,
      stats: result.stats,
      formatted_response: formattedResponse,
      analysis_result: formattedResponse,
      metadata: {
        service: 'user_codex_specific',
        selection_mode: 'manual',
        execution_time: new Date().toISOString(),
        data_source: 'supabase'
      }
    };

  } catch (error) {
    console.error(`❌ Error ejecutando user_codex_specific MCP:`, error);
    throw error;
  }
}

/**
 * Helper para obtener icono según categoría y subcategoría
 */
function getCategoryIcon(category, subcategory) {
  if (subcategory) {
    switch (subcategory) {
      case 'wiki_person': return '👤';
      case 'wiki_organization': return '🏢';
      case 'wiki_location': return '📍';
      case 'wiki_event': return '📅';
      case 'wiki_concept': return '💡';
      case 'bookmark': return '📌';
      case 'activity': return '📈';
      case 'internal_spreadsheet': return '📑';
      case 'document': return '📄';
      case 'audio': return '🎤';
      case 'video': return '🎬';
      case 'external_spreadsheet': return '📊';
    }
  }

  switch (category) {
    case 'wiki': return '📚';
    case 'monitoring': return '📊';
    case 'general': return '📁';
    default: return '📄';
  }
}

/**
 * Ejecuta la herramienta project_decisions: obtiene decisiones de un proyecto específico
 * @param {string} projectId - ID del proyecto
 * @param {Object} user - Usuario autenticado
 * @returns {Object} Resultados de las decisiones del proyecto
 */
async function executeProjectDecisions(projectId, user = null) {
  try {
    if (!user || !user.id) {
      throw new Error('Usuario no autenticado. Se requiere autenticación para acceder a decisiones de proyectos.');
    }

    if (!projectId || typeof projectId !== 'string') {
      throw new Error('Se requiere un project_id válido para obtener las decisiones.');
    }

    console.log(`🎯 Ejecutando project_decisions para proyecto: ${projectId}, usuario: ${user.email}`);

    const result = await getProjectDecisions(projectId, user.id);

    if (!result || !result.project) {
      throw new Error('Proyecto no encontrado o sin permisos para acceder.');
    }

    const { project, decisions } = result;

    // Formatear respuesta para el agente AI
    const formattedResponse = `DECISIONES DEL PROYECTO: ${project.title} (ID: ${projectId})

RESUMEN:
• Total de decisiones: ${decisions.length}
• Proyecto: ${project.title}
• Usuario: ${user.email}

DECISIONES POR CAPAS:
${decisions.map((decision, index) => `
🔹 DECISIÓN ${index + 1}: ${decision.title} [${decision.decision_type.toUpperCase()}]
   Tipo: ${decision.decision_type} | Creada: ${new Date(decision.created_at).toLocaleDateString('es-ES')}
   ${decision.description ? `Descripción: ${decision.description}` : ''}
   ${decision.change_description ? `Cambio: ${decision.change_description}` : ''}
   ${decision.objective ? `Objetivo: ${decision.objective}` : ''}
   ${decision.next_steps ? `Próximos pasos: ${decision.next_steps}` : ''}
   ${decision.deadline ? `Fecha límite: ${new Date(decision.deadline).toLocaleDateString('es-ES')}` : ''}
   
   ${decision.decision_type === 'enfoque' ? `
   📍 DETALLES DE ENFOQUE:
   ${decision.focus_area ? `• Área de enfoque: ${decision.focus_area}` : ''}
   ${decision.focus_context ? `• Contexto: ${decision.focus_context}` : ''}` : ''}
   
   ${decision.decision_type === 'alcance' ? `
   🌐 DETALLES DE ALCANCE:
   ${decision.geographic_scope ? `• Alcance geográfico: ${decision.geographic_scope}` : ''}
   ${decision.monetary_scope ? `• Alcance monetario: ${decision.monetary_scope}` : ''}
   ${decision.time_period_start ? `• Período: ${decision.time_period_start} - ${decision.time_period_end || 'Abierto'}` : ''}
   ${decision.target_entities ? `• Entidades objetivo: ${decision.target_entities}` : ''}
   ${decision.scope_limitations ? `• Limitaciones: ${decision.scope_limitations}` : ''}` : ''}
   
   ${decision.decision_type === 'configuracion' ? `
   ⚙️ DETALLES DE CONFIGURACIÓN:
   ${decision.output_format && decision.output_format.length > 0 ? `• Formatos de salida: ${decision.output_format.join(', ')}` : ''}
   ${decision.methodology ? `• Metodología: ${decision.methodology}` : ''}
   ${decision.data_sources ? `• Fuentes de datos: ${decision.data_sources}` : ''}
   ${decision.search_locations ? `• Ubicaciones de búsqueda: ${decision.search_locations}` : ''}
   ${decision.tools_required ? `• Herramientas requeridas: ${decision.tools_required}` : ''}
   ${decision.references && decision.references.length > 0 ? `• Referencias: ${decision.references.join(', ')}` : ''}` : ''}
`).join('\n')}

Las decisiones están ordenadas de más reciente a más antigua.`;

    return {
      success: true,
      user_id: user.id,
      user_email: user.email,
      project_id: projectId,
      project_title: project.title,
      total_decisions: decisions.length,
      decisions: decisions,
      formatted_response: formattedResponse,
      metadata: {
        service: 'project_decisions',
        execution_time: new Date().toISOString(),
        data_source: 'supabase'
      }
    };

  } catch (error) {
    console.error(`❌ Error ejecutando project_decisions MCP:`, error);
    throw error;
  }
}

/**
 * Valida los parámetros de una herramienta
 * @param {Object} tool - Configuración de la herramienta
 * @param {Object} parameters - Parámetros a validar
 * @returns {Object} Resultado de validación
 */
function validateToolParameters(tool, parameters) {
  const errors = [];

  for (const [paramName, paramConfig] of Object.entries(tool.parameters)) {
    const value = parameters[paramName];

    // Verificar parámetros requeridos
    if (paramConfig.required && (value === undefined || value === null || value === '')) {
      errors.push(`Parámetro requerido faltante: ${paramName}`);
      continue;
    }

    // Si el parámetro no es requerido y no está presente, continuar
    if (!paramConfig.required && (value === undefined || value === null)) {
      continue;
    }

    // Validar tipo
    if (paramConfig.type === 'string' && typeof value !== 'string') {
      errors.push(`${paramName} debe ser una cadena de texto`);
    }

    if (paramConfig.type === 'integer' && (!Number.isInteger(value) || value < 0)) {
      errors.push(`${paramName} debe ser un número entero positivo`);
    }

    // Validar rangos para enteros
    if (paramConfig.type === 'integer' && typeof value === 'number') {
      if (paramConfig.min !== undefined && value < paramConfig.min) {
        errors.push(`${paramName} debe ser mayor o igual a ${paramConfig.min}`);
      }
      if (paramConfig.max !== undefined && value > paramConfig.max) {
        errors.push(`${paramName} debe ser menor o igual a ${paramConfig.max}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Obtiene el estado general del MCP Server
 * @returns {Object} Estado del servidor
 */
async function getServerStatus() {
  try {
    const status = {
      server_name: 'ExtractorW MCP Server',
      version: '1.0.0',
      status: 'running',
      available_tools: Object.keys(AVAILABLE_TOOLS).length,
      tools_list: Object.keys(AVAILABLE_TOOLS),
      external_services: {}
    };

    // Verificar conectividad con ExtractorT
    try {
      const extractorTResponse = await axios.get(`${EXTRACTOR_T_URL}/status`, { timeout: 5000 });
      status.external_services.extractor_t = {
        url: EXTRACTOR_T_URL,
        status: 'connected',
        response_time: extractorTResponse.headers['x-process-time'] || 'unknown'
      };
    } catch (error) {
      status.external_services.extractor_t = {
        url: EXTRACTOR_T_URL,
        status: 'disconnected',
        error: error.message
      };
    }

    console.log('📊 Estado del MCP Server obtenido');
    return status;
  } catch (error) {
    console.error('❌ Error obteniendo estado MCP:', error);
    throw error;
  }
}

/**
 * Ejecuta la herramienta resolve_twitter_handle: resuelve nombres a handles de Twitter
 * @param {string} name - Nombre de la persona a buscar
 * @param {string} context - Contexto adicional
 * @param {string} sector - Sector específico
 * @param {Object} user - Usuario autenticado
 * @returns {Object} Resultado de la resolución del handle
 */
async function executeResolveTwitterHandle(name, context = '', sector = '', user = null) {
  try {
    console.log(`🔍 Ejecutando resolve_twitter_handle MCP: "${name}" (contexto: "${context}", sector: "${sector}")`);

    if (!user || !user.id) {
      throw new Error('Usuario autenticado requerido para ejecutar resolve_twitter_handle');
    }

    // PASO 1: Intentar primero con Perplexity (más actualizado)
    console.log(`🔍 Paso 1: Buscando handle con Perplexity: "${name}"`);

    const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

    if (PERPLEXITY_API_KEY) {
      try {
        const perplexityResult = await searchHandleWithPerplexity(name, context, sector);
        if (perplexityResult.success) {
          console.log(`✅ Handle encontrado con Perplexity: "${name}" → @${perplexityResult.handle}`);

          // Guardar en PulsePolitics
          await saveHandleToPulsePolitics(name, perplexityResult.handle, context, sector, 'perplexity_search');

          return {
            success: true,
            resolved_username: perplexityResult.handle,
            confidence: 0.9,
            method: 'perplexity_search',
            original_name: name,
            context_provided: context,
            sector_provided: sector,
            raw_response: perplexityResult.raw_response,
            saved_to_pulsepolitics: true
          };
        }
      } catch (error) {
        console.log(`⚠️ Perplexity falló, intentando con GPT-4o: ${error.message}`);
      }
    }

    // PASO 2: Usar web search para verificar información real
    console.log(`🔍 Paso 2: Buscando handle con web search verificado: "${name}"`);

    try {
      const webSearchResult = await searchHandleWithWebSearch(name, context, sector);
      if (webSearchResult.success) {
        console.log(`✅ Handle encontrado con web search: "${name}" → @${webSearchResult.handle}`);

        // Guardar en PulsePolitics
        await saveHandleToPulsePolitics(name, webSearchResult.handle, context, sector, 'web_search');

        return {
          success: true,
          resolved_username: webSearchResult.handle,
          confidence: 0.85,
          method: 'web_search',
          original_name: name,
          context_provided: context,
          sector_provided: sector,
          raw_response: webSearchResult.raw_response,
          saved_to_pulsepolitics: true
        };
      }
    } catch (error) {
      console.log(`⚠️ Web search falló, usando GPT-4o como último recurso: ${error.message}`);
    }

    // PASO 3: Fallback a GPT-4o SOLO como último recurso (con advertencia)
    console.log(`🔍 Paso 3: ÚLTIMO RECURSO - GPT-4o (puede no ser preciso): "${name}"`);

    const searchQuery = `ADVERTENCIA: Este es un último recurso. Busca información sobre "${name}"${context ? ` (${context})` : ''}${sector ? ` del sector ${sector}` : ''} en Guatemala y su posible handle de Twitter/X. Responde SOLO el @handle si tienes certeza, o NONE si no estás seguro.`;

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY no configurada para resolución de handles');
    }

    const payload = {
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Eres un investigador especializado en encontrar handles oficiales de Twitter/X de personas públicas, especialmente de Guatemala.

CASOS ESPECÍFICOS IMPORTANTES:
- Bernardo Arévalo de León (Presidente de Guatemala 2024-2028): Su handle oficial es @BArevalodeLeon
- Es importante ser preciso con los handles oficiales de políticos guatemaltecos

INSTRUCCIONES PARA BÚSQUEDA DINÁMICA:
1. Usa tu conocimiento actualizado para buscar el handle oficial de la persona
2. Para políticos guatemaltecos, verifica cargos actuales (2024-2025)
3. Prioriza cuentas verificadas y oficiales
4. Considera variaciones del nombre (nombres completos, apodos, títulos)
5. Si encuentras el handle oficial, responde EXACTAMENTE: @handle
6. Si NO existe cuenta o no puedes encontrarla, responde EXACTAMENTE: NONE
7. NO agregues explicaciones, solo el handle o NONE

CONTEXTO GEOGRÁFICO: Guatemala, Centroamérica
ENFOQUE: Personas públicas, políticos, funcionarios, figuras relevantes
FORMATO RESPUESTA: @handle o NONE (exactamente así, sin texto adicional)`
        },
        {
          role: 'user',
          content: searchQuery
        }
      ],
      temperature: 0.1,
      max_tokens: 20
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Error en API de OpenAI: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Respuesta inválida de OpenAI API');
    }

    let rawResponse = data.choices[0].message.content?.trim() || '';
    console.log(`📝 Respuesta de GPT-4o: "${rawResponse}"`);

    // Extraer handle de la respuesta
    let resolvedHandle = null;
    let confidence = 0.5;

    if (rawResponse.toUpperCase() === 'NONE' || rawResponse.includes('NONE')) {
      console.log(`❌ No se encontró handle de Twitter para "${name}"`);
      return {
        success: false,
        error: `No se encontró cuenta de Twitter para "${name}"`,
        resolved_username: null,
        confidence: 0,
        method: 'gpt4o_search'
      };
    }

    // Extraer handle usando regex mejorado
    const handlePattern = /@([a-zA-Z0-9_]+)/;
    const urlPattern = /(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/i;

    let handleMatch = rawResponse.match(handlePattern);
    if (!handleMatch) {
      handleMatch = rawResponse.match(urlPattern);
    }

    if (handleMatch) {
      resolvedHandle = handleMatch[1];
      confidence = 0.95; // Mayor confianza con GPT-4o 
      console.log(`✅ Handle resuelto con GPT-4o: "${name}" → @${resolvedHandle}`);

      // GUARDAR AUTOMÁTICAMENTE EN PULSEPOLITICS
      await saveHandleToPulsePolitics(name, resolvedHandle, context, sector, 'gpt4o_search');

    } else {
      console.log(`⚠️ No se pudo extraer handle de: "${rawResponse}"`);
      return {
        success: false,
        error: `No se pudo extraer handle válido de la respuesta`,
        resolved_username: null,
        confidence: 0,
        method: 'gpt4o_search',
        raw_response: rawResponse
      };
    }

    return {
      success: true,
      resolved_username: resolvedHandle,
      confidence: confidence,
      method: 'gpt4o_search',
      original_name: name,
      context_provided: context,
      sector_provided: sector,
      raw_response: rawResponse,
      saved_to_pulsepolitics: true
    };

  } catch (error) {
    console.error(`❌ Error ejecutando resolve_twitter_handle MCP:`, error);
    return {
      success: false,
      error: error.message,
      resolved_username: null,
      confidence: 0,
      method: 'error'
    };
  }
}

/**
 * Obtiene tweets recientes de un usuario específico usando Nitter CON ANÁLISIS DE SENTIMIENTO
 * @param {string} username - Nombre de usuario sin @
 * @param {number} limit - Número máximo de tweets
 * @param {boolean} include_retweets - Incluir retweets
 * @param {boolean} include_replies - Incluir replies
 * @param {Object} user - Usuario autenticado
 * @returns {Object} Respuesta con tweets del usuario y análisis completo
 */
async function executeNitterProfile(username, limit = 10, include_retweets = false, include_replies = false, user, sessionId = null) {
  const startTime = Date.now();

  try {
    console.log(`🔍 Procesando nitter_profile: "@${username}" (límite: ${limit})`);

    if (!user || !user.id) {
      throw new Error('Usuario no autenticado - se requiere autenticación para nitter_profile');
    }

    // Generar sessionId si no se proporciona
    const finalSessionId = sessionId || `nitter_profile_mcp_${Date.now()}`;

    // Detectar si es modo CHAT (solo búsqueda, sin guardar)
    const isChatMode = finalSessionId.startsWith('chat_');
    const saveToDb = !isChatMode; // En modo chat NO guardar, en otros modos SÍ guardar

    console.log(`📋 Modo: ${isChatMode ? 'CHAT (búsqueda sin guardar)' : 'NORMAL (guardar en BD)'}`);

    // ✅ USAR FUNCIÓN COMPLETA CON ANÁLISIS DE SENTIMIENTO
    const result = await processNitterProfile(
      username.replace('@', ''), // Remover @ si existe
      user.id,
      finalSessionId,
      limit,
      include_retweets,
      include_replies,
      saveToDb // Pasar flag de guardado
    );

    if (result.success) {
      console.log(`✅ Procesamiento completo de @${username}: ${result.data.tweets_found} tweets con análisis de sentimiento`);

      // Formatear respuesta para compatibilidad MCP/Vizta
      const formattedTweets = result.data.tweets?.map(tweet => ({
        id: tweet.tweet_id || tweet.id,
        text: tweet.texto,
        author: tweet.usuario,
        date: tweet.fecha,
        metrics: {
          likes: tweet.likes || 0,
          retweets: tweet.retweets || 0,
          replies: tweet.replies || 0
        },
        url: tweet.enlace,
        is_retweet: false,
        is_reply: false,
        // 🧠 CAMPOS DE ANÁLISIS DE IA (¡Ahora disponibles!)
        sentimiento: tweet.sentimiento,
        score_sentimiento: tweet.score_sentimiento,
        intencion_comunicativa: tweet.intencion_comunicativa,
        entidades_mencionadas: tweet.entidades_mencionadas,
        engagement: tweet.engagement,
        categoria: tweet.categoria
      })) || [];

      return {
        success: true,
        username: username,
        profile_info: result.data.profile_info || {},
        tweets: formattedTweets,
        tweets_count: result.data.tweets_found,
        execution_time: Date.now() - startTime,
        source: 'nitter_profile_with_sentiment',

        // Información de guardado en Supabase (ya incluida en processNitterProfile)
        supabase_saved: true,
        supabase_saved_count: result.data.tweets_saved,
        profile_link: `https://twitter.com/${username.replace('@', '')}`,

        // Métricas de análisis de IA
        analytics: {
          categoria: result.data.categoria,
          detected_group: result.data.detected_group,
          total_engagement: result.data.total_engagement,
          avg_engagement: result.data.avg_engagement,
          sentiment_analysis: true,
          ai_processing: true
        },

        metadata: {
          include_retweets: include_retweets,
          include_replies: include_replies,
          requested_limit: limit,
          actual_results: result.data.tweets_found,
          sentiment_analysis_included: true,
          processing_method: 'complete_nitter_profile_service'
        }
      };
    } else {
      throw new Error(result.error || 'Error procesando perfil con análisis de sentimiento');
    }

  } catch (error) {
    console.error(`❌ Error procesando perfil @${username}:`, error.message);

    return {
      success: false,
      username: username,
      error: error.message,
      tweets: [],
      tweets_count: 0,
      execution_time: Date.now() - startTime,
      source: 'nitter_profile_with_sentiment',
      metadata: {
        error_type: 'processing_error',
        processing_method: 'complete_nitter_profile_service'
      }
    };
  }
}

/**
 * Buscar handle usando Perplexity con capacidades web
 */
async function searchHandleWithPerplexity(name, context = '', sector = '') {
  try {
    const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

    const searchQuery = `Busca el handle oficial de Twitter/X de "${name}"${context ? ` (${context})` : ''}${sector ? ` del sector ${sector}` : ''} en Guatemala. Verifica en fuentes oficiales, sitios web gubernamentales, medios de comunicación y perfiles verificados de Twitter/X. Es CRÍTICO que sea el handle REAL y ACTUAL.`;

    const payload = {
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: `Eres un investigador especializado en encontrar handles REALES y ACTUALES de Twitter/X de figuras públicas guatemaltecas.

INSTRUCCIONES CRÍTICAS:
1. Busca ÚNICAMENTE en fuentes oficiales: sitios web gubernamentales, medios verificados, perfiles oficiales de Twitter/X
2. Verifica que la cuenta esté ACTIVA y sea OFICIAL (verificada si es posible)
3. Para políticos: busca en sitios oficiales del gobierno, comunicados de prensa oficiales
4. Para el Presidente de Guatemala: busca en el sitio presidencial oficial (presidencia.gob.gt)
5. Verifica que el handle coincida con el nombre real de la persona
6. Si encuentras el handle OFICIAL y VERIFICADO, responde EXACTAMENTE: @handle
7. Si NO encuentras una cuenta oficial verificable, responde EXACTAMENTE: NONE
8. NO inventes handles, NO uses aproximaciones

FORMATO: @handle o NONE (sin explicaciones)`
        },
        {
          role: 'user',
          content: searchQuery
        }
      ],
      temperature: 0.0,
      max_tokens: 30
    };

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    const data = await response.json();
    const rawResponse = data.choices[0].message.content?.trim() || '';

    if (rawResponse.toUpperCase() === 'NONE' || rawResponse.includes('NONE')) {
      return { success: false, raw_response: rawResponse };
    }

    const handlePattern = /@([a-zA-Z0-9_]+)/;
    const handleMatch = rawResponse.match(handlePattern);

    if (handleMatch) {
      return {
        success: true,
        handle: handleMatch[1],
        raw_response: rawResponse
      };
    }

    return { success: false, raw_response: rawResponse };

  } catch (error) {
    console.error(`❌ Error en búsqueda Perplexity:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Buscar handle usando múltiples estrategias de búsqueda web
 */
async function searchHandleWithWebSearch(name, context = '', sector = '') {
  try {
    console.log(`🔍 Iniciando búsqueda web avanzada para: "${name}"`);

    // ESTRATEGIA 1: Búsqueda con múltiples términos específicos
    const searchQueries = [
      `"${name}" Twitter Guatemala @`,
      `"${name}" X.com Guatemala perfil`,
      `${name} Guatemala twitter handle @`,
      `"${name}" cuenta oficial Twitter Guatemala`,
      `${name} Guatemala redes sociales @`
    ];

    for (const query of searchQueries) {
      console.log(`🔍 Probando query: ${query}`);

      const result = await performPerplexityWebSearch(query, name);
      if (result.success) {
        console.log(`✅ Handle encontrado con query "${query}": @${result.handle}`);
        return result;
      }

      // Esperar 500ms entre queries para evitar rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // ESTRATEGIA 2: Búsqueda por contexto profesional si está disponible
    if (context || sector) {
      const contextQuery = `"${name}"${context ? ` ${context}` : ''}${sector ? ` ${sector}` : ''} Guatemala Twitter @`;
      console.log(`🔍 Probando query contextual: ${contextQuery}`);

      const contextResult = await performPerplexityWebSearch(contextQuery, name);
      if (contextResult.success) {
        console.log(`✅ Handle encontrado con contexto: @${contextResult.handle}`);
        return contextResult;
      }
    }

    return { success: false, error: 'No se encontró handle válido después de múltiples intentos' };

  } catch (error) {
    console.error(`❌ Error en web search:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Realizar búsqueda con Perplexity optimizada para web search
 */
async function performPerplexityWebSearch(query, originalName) {
  const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

  if (!PERPLEXITY_API_KEY) {
    throw new Error('PERPLEXITY_API_KEY no disponible');
  }

  const payload = {
    model: 'sonar',
    messages: [
      {
        role: 'system',
        content: `Eres un investigador especializado en encontrar información verificable de Twitter/X.

TAREA: Buscar el handle oficial de Twitter/X de la persona mencionada.

PROCESO:
1. Busca en fuentes web actuales (noticias, perfiles oficiales, sitios web)
2. Verifica que sea la persona correcta comparando información
3. Extrae ÚNICAMENTE el @handle si lo encuentras en fuentes confiables
4. Si no encuentras información verificable, responde NONE

REGLAS CRÍTICAS:
- Solo responde si encuentras el handle en fuentes web reales
- NO inventes ni adivines handles
- NO uses información que no puedas verificar
- Formato: @handle o NONE (sin explicaciones)`
      },
      {
        role: 'user',
        content: query
      }
    ],
    temperature: 0.0,
    max_tokens: 20
  };

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Perplexity API error: ${response.status}`);
  }

  const data = await response.json();
  const rawResponse = data.choices[0].message.content?.trim() || '';

  console.log(`📝 Perplexity response: "${rawResponse}"`);

  // Procesar respuesta
  if (rawResponse.toUpperCase() === 'NONE' || rawResponse.includes('NONE') || !rawResponse.includes('@')) {
    return { success: false, error: 'No se encontró handle válido' };
  }

  // Extraer handle
  const handlePattern = /@([a-zA-Z0-9_]+)/;
  const handleMatch = rawResponse.match(handlePattern);

  if (handleMatch) {
    const foundHandle = handleMatch[1];

    // Verificación básica: el handle debe tener sentido para el nombre
    const nameParts = originalName.toLowerCase().split(' ');
    const handleLower = foundHandle.toLowerCase();

    // Al menos una parte del nombre debe estar relacionada con el handle
    const isReasonable = nameParts.some(part =>
      handleLower.includes(part) ||
      part.includes(handleLower.substring(0, 4)) ||
      // Para nombres compuestos como "Karin Herrera" → "KarinHerreraGT"
      handleLower.includes(part.substring(0, 4))
    );

    if (isReasonable) {
      return {
        success: true,
        handle: foundHandle,
        raw_response: rawResponse,
        query_used: query
      };
    } else {
      console.log(`⚠️ Handle "${foundHandle}" no parece relacionado con "${originalName}"`);
      return { success: false, error: 'Handle encontrado no relacionado con el nombre' };
    }
  }

  return { success: false, error: 'No se pudo extraer handle de la respuesta' };
}

/**
 * Guardar handle en PulsePolitics
 */
async function saveHandleToPulsePolitics(name, handle, context = '', sector = '', method = 'unknown') {
  try {
    console.log(`💾 Guardando handle resuelto en PulsePolitics: "${name}" → @${handle}`);

    const lauraMemoryClient = require('./lauraMemoryClient');

    if (lauraMemoryClient) {
      const saveResult = await lauraMemoryClient.saveUserDiscovery(
        name,
        handle,
        `${context ? context + ' - ' : ''}${sector ? sector + ' - ' : ''}Resuelto con ${method}`,
        sector || 'general'
      );

      if (saveResult) {
        console.log(`✅ Handle guardado exitosamente en PulsePolitics: "${name}" → @${handle}`);
      } else {
        console.log(`⚠️ No se pudo guardar en PulsePolitics (servicio no disponible)`);
      }
    }
  } catch (saveError) {
    console.warn(`⚠️ Error guardando en PulsePolitics:`, saveError.message);
  }
}

/**
 * KNOWLEDGE_SEARCH: Busca en documentos públicos de conocimiento (pk_documents)
 * @param {string} query - Término de búsqueda
 * @param {number} limit - Número máximo de resultados
 * @param {string} userId - ID del usuario (opcional, para documentos privados)
 */
async function executeKnowledgeSearch(query, limit = 5, userId = null) {
  try {
    console.log(`📚 [KNOWLEDGE_SEARCH] Buscando en knowledge base: "${query}"`);

    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL || 'https://qqshdccpmypelhmyqnut.supabase.co',
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
    );

    // Buscar en pk_documents usando full-text search
    let queryBuilder = supabase
      .from('pk_documents')
      .select('*')
      .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
      .limit(limit)
      .order('created_at', { ascending: false });

    // Si hay userId, incluir documentos privados del usuario
    if (userId) {
      queryBuilder = queryBuilder.or(`user_id.eq.${userId},is_public.eq.true`);
    } else {
      queryBuilder = queryBuilder.eq('is_public', true);
    }

    const { data, error } = await queryBuilder;

    if (error) throw error;

    console.log(`✅ [KNOWLEDGE_SEARCH] Encontrados ${data?.length || 0} documentos`);

    return {
      success: true,
      documents: data || [],
      query: query,
      total: data?.length || 0,
      raw: { documents: data }
    };

  } catch (error) {
    console.error(`❌ [KNOWLEDGE_SEARCH] Error:`, error.message);
    return {
      success: false,
      error: error.message,
      documents: [],
      query: query
    };
  }
}

/**
 * LEARNED_KNOWLEDGE: Busca en conocimiento aprendido por Vizta (vizta_learned_items)
 * @param {string} query - Término de búsqueda
 * @param {number} limit - Número máximo de resultados
 * @param {string} userId - ID del usuario
 * @param {string} sourceType - Tipo de fuente (rss, perplexity_search, social_trend, manual)
 */
async function executeLearnedKnowledge(query, limit = 5, userId = null, knowledgeTypes = null, temporalFilter = null) {
  try {
    console.log(`🧠 [LEARNED_KNOWLEDGE] Buscando en conocimiento aprendido: "${query}"`);
    if (knowledgeTypes) console.log(`   └─ Tipos: ${knowledgeTypes.join(', ')}`);
    if (temporalFilter) console.log(`   └─ Temporal: ${temporalFilter}`);

    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL || 'https://qqshdccpmypelhmyqnut.supabase.co',
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
    );

    // ✅ Sanitize query to prevent SQL parsing errors with special characters
    const sanitizedQuery = query
      ? query
        .replace(/[¿?¡!]/g, '') // Remove Spanish question/exclamation marks
        .replace(/[%_]/g, '\\$&') // Escape SQL wildcards
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim()
      : query;

    if (sanitizedQuery !== query) {
      console.log(`🧹 [LEARNED_KNOWLEDGE] Query sanitizada: "${sanitizedQuery}"`);
    }

    // Build query with new schema columns
    let queryBuilder = supabase
      .from('vizta_learned_items')
      .select('*');

    // Text search on term, definition, context, summary
    if (sanitizedQuery) {
      queryBuilder = queryBuilder.or(
        `term.ilike.%${sanitizedQuery}%,definition.ilike.%${sanitizedQuery}%,context.ilike.%${sanitizedQuery}%,summary.ilike.%${sanitizedQuery}%`
      );
    }

    // Filter by user
    if (userId) {
      queryBuilder = queryBuilder.eq('user_id', userId);
    }

    // Filter by knowledge types
    if (knowledgeTypes && Array.isArray(knowledgeTypes) && knowledgeTypes.length > 0) {
      queryBuilder = queryBuilder.in('knowledge_type', knowledgeTypes);
    }

    // Filter by temporal relevance
    if (temporalFilter) {
      queryBuilder = queryBuilder.eq('temporal_relevance', temporalFilter);
    }

    // Order by relevance, usage, and recency
    queryBuilder = queryBuilder
      .order('relevance_score', { ascending: false })
      .order('times_referenced', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    const { data, error } = await queryBuilder;

    if (error) throw error;

    // Update last_referenced_at and times_referenced for retrieved items
    if (data && data.length > 0 && userId) {
      const ids = data.map(item => item.id);
      await supabase.rpc('increment_learned_item_usage', {
        p_user_id: userId,
        p_term: query
      }).catch(err => {
        console.warn('[LEARNED_KNOWLEDGE] Failed to update usage metrics:', err.message);
      });
    }

    console.log(`✅ [LEARNED_KNOWLEDGE] Encontrados ${data?.length || 0} items`);
    if (data && data.length > 0) {
      const types = [...new Set(data.map(item => item.knowledge_type))];
      console.log(`   └─ Tipos encontrados: ${types.join(', ')}`);
    }

    return {
      success: true,
      learned_items: data || [],
      query: query,
      total: data?.length || 0,
      filters_applied: {
        knowledge_types: knowledgeTypes || 'all',
        temporal_filter: temporalFilter || 'all'
      },
      raw: { learned_items: data }
    };

  } catch (error) {
    console.error(`❌ [LEARNED_KNOWLEDGE] Error:`, error.message);
    return {
      success: false,
      error: error.message,
      learned_items: [],
      query: query
    };
  }
}

module.exports = {
  // Core tool functions
  listAvailableTools,
  getToolInfo,
  executeTool,

  // Legacy function exports (kept for backwards compatibility)
  executePerplexitySearch,
  executeParallelSearch,
  executeUserCodex,
  executeExaSearch,

  // Helper functions
  expandSearchTerms,
  enhanceSearchTermsWithPerplexity,
  getServerStatus,

  // Tool definitions
  AVAILABLE_TOOLS,

  // Mode-based tool filtering
  isToolAllowedForMode,
  getToolsForMode,
  TOOL_MODE_ACCESS
};

/**
 * Execute Exa Search for parallel search functionality
 * @param {string} query - Search query
 * @param {number} num - Number of results
 * @param {Object} user - User object
 * @returns {Promise<Object>} - Search results
 */
async function executeExaSearch(query, num = 10, user = null) {
  try {
    const EXA_API_KEY = process.env.EXA_API_KEY;
    const maxResults = Math.min(num, 20); // Cap at 20 results

    if (!query || typeof query !== 'string' || query.trim().length < 3) {
      return { success: false, error: 'exa_search requires a non-empty query (≥3 chars)' };
    }

    if (!EXA_API_KEY) {
      return { success: false, error: 'EXA_API_KEY not configured' };
    }

    console.log(`🔍 [EXA] Searching: "${query}" (max ${maxResults} results)`);

    const resp = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${EXA_API_KEY}`
      },
      body: JSON.stringify({
        query,
        num: maxResults,
        type: 'neural',
        useAutoprompt: true,
        text: true,
        highlights: true
      }),
      timeout: 20000
    });

    if (!resp.ok) {
      const errorText = await resp.text().catch(() => '');
      throw new Error(`EXA search failed: ${resp.status} ${resp.statusText} ${errorText}`);
    }

    const data = await resp.json();
    const results = Array.isArray(data.results) ? data.results : [];

    console.log(`✅ [EXA] Found ${results.length} results for: "${query}"`);

    const search_results = results.slice(0, maxResults).map(r => ({
      title: r.title || null,
      url: r.url || null,
      snippet: r.text
        ? r.text.slice(0, 400)
        : (r.highlights && r.highlights.length > 0 ? r.highlights[0] : null),
      date: r.publishedDate || r.date || null,
      highlights: r.highlights || null
    }));

    // Build a real analysis from highlights/text of top results
    const analysisParts = search_results
      .filter(r => r.snippet || (r.highlights && r.highlights.length > 0))
      .slice(0, 4)
      .map((r, i) => {
        const content = r.snippet || r.highlights?.[0] || '';
        return `**${i + 1}. ${r.title || 'Sin título'}**\n${content}${r.date ? `\n_Fecha: ${r.date}_` : ''}\n*Fuente: ${r.url}*`;
      });

    const analysis = analysisParts.length > 0
      ? `Información encontrada sobre "${query}":\n\n${analysisParts.join('\n\n')}`
      : '';

    return {
      success: true,
      result: {
        search_results: search_results,
        analysis,
        metadata: {
          results_count: search_results.length,
          source: 'exa_search',
          timestamp: new Date().toISOString()
        }
      },
      agent: 'Vizta',
      tool: 'exa_search',
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error(`❌ Error ejecutando executeExaSearch:`, error);
    throw error;
  }
}
