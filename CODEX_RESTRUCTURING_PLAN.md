# Plan de Reestructuración del Codex

## 📋 Análisis del Sistema Actual

### Flujo de Datos Actual
```
MobileApp (SavedItem) 
  → codexService.ts 
  → ExtractorW (/api/codex/save-link) 
  → Supabase (codex_items)
  → ThePulse (RecentActivity/EnhancedCodex)
```

### Estructura Actual de `codex_items`
```sql
- id (UUID)
- user_id (UUID)
- tipo (TEXT) -- Valor genérico: "enlace", "audio", "video", etc.
- titulo (TEXT)
- descripcion (TEXT)
- etiquetas (TEXT[])
- proyecto (TEXT) -- String libre
- project_id (UUID) -- Referencia a projects table
- storage_path (TEXT)
- url (TEXT)
- nombre_archivo (TEXT)
- tamano (BIGINT)
- fecha (DATE)
- created_at (TIMESTAMP)
-- Engagement metrics
- likes (INTEGER)
- comments (INTEGER)
- shares (INTEGER)
- views (INTEGER)
-- Additional fields
- is_drive (BOOLEAN)
- drive_file_id (TEXT)
- audio_transcription (TEXT)
- document_analysis (TEXT)
- recent_scrape_id (UUID)
-- Grouping fields
- group_id (UUID)
- is_group_parent (BOOLEAN)
- group_name (TEXT)
- group_description (TEXT)
- part_number (INTEGER)
- total_parts (INTEGER)
```

### Problemas Identificados
1. **Campo `tipo` muy genérico** → No distingue entre archivos generales y monitoreos
2. **Falta categorización clara** → Todo se mezcla en una sola tabla
3. **Sin distinción de fuentes** → Posts guardados vs Actividad vs Archivos
4. **Metadata insuficiente** → No captura información específica de cada tipo

---

## 🎯 Nueva Estructura Propuesta

### Categorías Principales

#### 1. **Archivos Generales** (General Files)
Contenido que el usuario guarda manualmente o sube

**Subcategorías:**
- **Documentos** (`document`)
  - PDFs, Word, Excel externos, PowerPoint
  - Campos especiales: `page_count`, `file_format`, `document_type`
  
- **Audios** (`audio`)
  - Grabaciones de voz, podcasts, música
  - Campos especiales: `duration`, `audio_transcription`, `audio_format`
  
- **Videos** (`video`)
  - Videos subidos, videos externos
  - Campos especiales: `duration`, `video_transcription`, `resolution`, `video_format`
  
- **Spreadsheets Externas** (`external_spreadsheet`)
  - Excel, Google Sheets, CSV externos
  - Campos especiales: `sheet_count`, `row_count`, `has_formulas`

#### 2. **Monitoreos** (Monitoring)
Contenido capturado de redes sociales y análisis

**Subcategorías:**
- **Actividad** (`activity`)
  - Tweets/Posts guardados desde "Actividad"
  - Colección de posts relacionados a un tema/monitoreo
  - Campos especiales: `activity_type`, `activity_query`, `sentiment`, `tweet_count`
  
- **Posts** (`bookmark`)
  - Bookmarks individuales guardados manualmente
  - Instagram posts, Tweets, TikToks guardados
  - Campos especiales: `platform`, `author`, `engagement` (likes, comments, shares, views), `post_id`
  
- **Spreadsheets Internas** (`internal_spreadsheet`)
  - Spreadsheets generadas por la app (exports, análisis)
  - Campos especiales: `generated_from`, `analysis_type`, `row_count`

#### 3. **Wiki** (Knowledge Base)
Base de conocimiento estructurado sobre entidades, personas y conceptos clave

**Subcategorías:**
- **Personas** (`wiki_person`)
  - Políticos, funcionarios públicos, periodistas, activistas, líderes de opinión
  - Campos especiales: `full_name`, `aliases`, `position`, `political_party`, `biography`, `social_media`, `relevance_score`, `last_mentioned`
  - Metadata: `{ birth_date, education, career_history, controversies, achievements, related_entities }`
  - **Casos de uso:** Perfiles de políticos guatemaltecos, funcionarios del MP, periodistas de investigación
  
- **Organizaciones/Entidades** (`wiki_organization`)
  - Partidos políticos, ONGs, empresas, instituciones gubernamentales, medios de comunicación
  - Campos especiales: `official_name`, `acronym`, `type`, `legal_status`, `founding_date`, `headquarters`, `key_people`
  - Metadata: `{ mission, budget, members_count, parent_organization, subsidiaries, scandals, achievements }`
  - **Casos de uso:** Ministerio Público, Partidos políticos (Semilla, UNE, etc.), ONGs (CICIG), medios (Prensa Libre, Nómada)

- **Lugares** (`wiki_location`)
  - Ciudades, departamentos, barrios, edificios emblemáticos, zonas de conflicto
  - Campos especiales: `place_name`, `type`, `coordinates`, `jurisdiction`, `population`, `importance`
  - Metadata: `{ mayor, governor, demographic_data, recent_events, security_status, infrastructure }`
  - **Casos de uso:** Municipalidades bajo investigación, zonas de manifestaciones, sedes gubernamentales

- **Eventos** (`wiki_event`)
  - Casos judiciales, elecciones, manifestaciones, crisis políticas, hitos históricos
  - Campos especiales: `event_name`, `event_type`, `start_date`, `end_date`, `status`, `outcome`, `participants`
  - Metadata: `{ timeline, key_moments, involved_parties, legal_status, public_impact, related_events }`
  - **Casos de uso:** Caso Hogar Seguro, Elecciones 2023, Caso Construcción y Corrupción, Paro Nacional

- **Conceptos/Temas** (`wiki_concept`)
  - Leyes, políticas públicas, movimientos sociales, términos técnicos, iniciativas
  - Campos especiales: `concept_name`, `category`, `definition`, `context`, `current_status`, `relevance`
  - Metadata: `{ related_laws, affected_population, budget, timeline, controversies, public_opinion }`
  - **Casos de uso:** Ley de ONG, Política de Transparencia, Pacto Colectivo, Acuerdo Gubernativo

**Características Especiales de la Wiki:**
- **Relaciones entre entidades:** Cada item puede vincularse con otros (ej: Persona → Organización → Evento)
- **Timeline/Cronología:** Eventos ordenados temporalmente
- **Referencias cruzadas:** Links a Posts guardados, Actividades y Documentos relacionados
- **Actualización dinámica:** Se actualiza con nueva información de monitoreos
- **Sistema de relevancia:** Score basado en menciones recientes y engagement
- **Vista de red/grafo:** Visualización de relaciones entre entidades

---

## 🗄️ Nueva Estructura de Base de Datos

### Opción 1: Agregar Campo `category` y `subcategory`
**Ventaja:** Mínima migración, mantiene compatibilidad  
**Desventaja:** Menos flexible para campos específicos

```sql
ALTER TABLE public.codex_items 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general',
ADD COLUMN IF NOT EXISTS subcategory TEXT,
ADD COLUMN IF NOT EXISTS source_type TEXT; -- 'manual', 'bookmark', 'activity', 'upload'

-- Índices
CREATE INDEX IF NOT EXISTS idx_codex_items_category ON public.codex_items(category);
CREATE INDEX IF NOT EXISTS idx_codex_items_subcategory ON public.codex_items(subcategory);
CREATE INDEX IF NOT EXISTS idx_codex_items_source_type ON public.codex_items(source_type);

-- Valores posibles:
-- category: 'general', 'monitoring'
-- subcategory: 'document', 'audio', 'video', 'external_spreadsheet', 
--              'activity', 'bookmark', 'internal_spreadsheet'
-- source_type: 'manual', 'bookmark', 'activity', 'upload', 'generated'
```

### Opción 2: Agregar JSONB para Metadata Específica
**Ventaja:** Flexible para cada tipo de contenido  
**Desventaja:** Queries más complejas

```sql
ALTER TABLE public.codex_items 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_codex_items_metadata_gin ON public.codex_items USING GIN (metadata);

-- Ejemplos de metadata por tipo:
-- Document: { "page_count": 10, "file_format": "pdf", "document_type": "report" }
-- Audio: { "duration": 180, "audio_format": "mp3", "transcription_available": true }
-- Video: { "duration": 300, "resolution": "1080p", "video_format": "mp4" }
-- Bookmark: { "platform": "twitter", "author": "@user", "post_id": "123", "engagement": {...} }
-- Activity: { "activity_type": "hashtag", "query": "#argentina", "sentiment": "positive", "tweet_count": 45 }
```

### ✅ Opción Recomendada: Combinación de Ambas
Usar `category` + `subcategory` + `source_type` para filtrado rápido, y `metadata` JSONB para información específica.

```sql
-- Migration Script
ALTER TABLE public.codex_items 
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general',
ADD COLUMN IF NOT EXISTS subcategory TEXT,
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Indices para performance
CREATE INDEX IF NOT EXISTS idx_codex_items_category ON public.codex_items(category);
CREATE INDEX IF NOT EXISTS idx_codex_items_subcategory ON public.codex_items(subcategory);
CREATE INDEX IF NOT EXISTS idx_codex_items_source_type ON public.codex_items(source_type);
CREATE INDEX IF NOT EXISTS idx_codex_items_metadata_gin ON public.codex_items USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_codex_items_user_category ON public.codex_items(user_id, category);

-- Constraints para validación
ALTER TABLE public.codex_items
ADD CONSTRAINT check_category CHECK (category IN ('general', 'monitoring', 'wiki')),
ADD CONSTRAINT check_subcategory CHECK (
  subcategory IN (
    'document', 'audio', 'video', 'external_spreadsheet', 
    'activity', 'bookmark', 'internal_spreadsheet',
    'wiki_person', 'wiki_organization', 'wiki_location', 'wiki_event', 'wiki_concept'
  )
),
ADD CONSTRAINT check_source_type CHECK (
  source_type IN ('manual', 'bookmark', 'activity', 'upload', 'generated')
);

-- Actualizar registros existentes (migración)
UPDATE public.codex_items 
SET 
  category = CASE 
    WHEN tipo IN ('tweet', 'instagram', 'tiktok') AND url IS NOT NULL THEN 'monitoring'
    WHEN recent_scrape_id IS NOT NULL THEN 'monitoring'
    ELSE 'general'
  END,
  subcategory = CASE 
    WHEN tipo IN ('tweet', 'instagram', 'tiktok') AND url IS NOT NULL THEN 'bookmark'
    WHEN recent_scrape_id IS NOT NULL THEN 'activity'
    WHEN tipo = 'audio' THEN 'audio'
    WHEN tipo = 'video' THEN 'video'
    WHEN tipo IN ('document', 'pdf', 'doc', 'docx') THEN 'document'
    WHEN tipo IN ('excel', 'spreadsheet', 'csv') THEN 'external_spreadsheet'
    ELSE 'document'
  END,
  source_type = CASE 
    WHEN recent_scrape_id IS NOT NULL THEN 'activity'
    WHEN url IS NOT NULL AND tipo IN ('tweet', 'instagram', 'tiktok') THEN 'bookmark'
    WHEN storage_path IS NOT NULL THEN 'upload'
    ELSE 'manual'
  END;
```

---

## 🔄 Cambios en el Backend

### 1. Actualizar `/api/codex/save-link` (ExtractorW)

```javascript
// server/routes/codex.js

router.post('/save-link', verifyUserAccess, async (req, res) => {
  const { user_id, link_data } = req.body || {};

  try {
    // ... validaciones existentes ...

    // Determinar category y subcategory basado en el tipo de contenido
    let category = 'general';
    let subcategory = 'document';
    let source_type = 'manual';
    let metadata = {};

    const platform = link_data.platform?.toLowerCase();
    const type = link_data.type?.toLowerCase();

    // Clasificación inteligente
    if (['twitter', 'instagram', 'tiktok', 'facebook'].includes(platform)) {
      category = 'monitoring';
      subcategory = 'bookmark';
      source_type = 'bookmark';
      
      metadata = {
        platform: platform,
        author: link_data.author || null,
        post_id: extractPostId(link_data.url, platform),
        engagement: {
          likes: link_data.engagement?.likes || 0,
          comments: link_data.engagement?.comments || 0,
          shares: link_data.engagement?.shares || 0,
          views: link_data.engagement?.views || 0
        }
      };
    } else if (type === 'audio') {
      category = 'general';
      subcategory = 'audio';
      source_type = link_data.source || 'upload';
      
      metadata = {
        duration: link_data.duration || null,
        audio_format: link_data.format || null,
        transcription_available: !!link_data.transcription
      };
    } else if (type === 'video') {
      category = 'general';
      subcategory = 'video';
      source_type = link_data.source || 'upload';
      
      metadata = {
        duration: link_data.duration || null,
        resolution: link_data.resolution || null,
        video_format: link_data.format || null
      };
    } else if (['pdf', 'doc', 'docx', 'ppt', 'pptx'].includes(type)) {
      category = 'general';
      subcategory = 'document';
      source_type = link_data.source || 'upload';
      
      metadata = {
        page_count: link_data.page_count || null,
        file_format: type,
        document_type: link_data.document_type || 'general'
      };
    } else if (['excel', 'csv', 'xls', 'xlsx'].includes(type)) {
      category = 'general';
      subcategory = 'external_spreadsheet';
      source_type = link_data.source || 'upload';
      
      metadata = {
        sheet_count: link_data.sheet_count || null,
        row_count: link_data.row_count || null,
        has_formulas: link_data.has_formulas || false
      };
    }

    const codexItemData = {
      user_id: userId,
      tipo: type || 'enlace', // Mantener por compatibilidad
      category: category,
      subcategory: subcategory,
      source_type: source_type,
      metadata: metadata,
      titulo: link_data.title || 'Sin título',
      descripcion: link_data.description || '',
      etiquetas: link_data.tags || [],
      proyecto: link_data.project || 'Sin proyecto',
      project_id: link_data.project_id || null,
      url: link_data.url,
      storage_path: link_data.storage_path || null,
      nombre_archivo: link_data.filename || null,
      tamano: link_data.size || 0,
      fecha: link_data.timestamp 
        ? new Date(link_data.timestamp).toISOString().split('T')[0] 
        : new Date().toISOString().split('T')[0],
      // Mantener campos legacy por compatibilidad
      likes: link_data.engagement?.likes || 0,
      comments: link_data.engagement?.comments || 0,
      shares: link_data.engagement?.shares || 0,
      views: link_data.engagement?.views || 0
    };

    // ... resto del código de inserción ...
  } catch (error) {
    // ... manejo de errores ...
  }
});

// Helper para extraer post IDs
function extractPostId(url, platform) {
  if (platform === 'twitter' || platform === 'x') {
    const match = url.match(/status\/(\d+)/);
    return match ? match[1] : null;
  } else if (platform === 'instagram') {
    const match = url.match(/\/p\/([A-Za-z0-9_-]+)/);
    return match ? match[1] : null;
  } else if (platform === 'tiktok') {
    const match = url.match(/video\/(\d+)/);
    return match ? match[1] : null;
  }
  return null;
}
```

### 2. Nuevo Endpoint para Guardar Actividad

```javascript
// server/routes/codex.js

/**
 * POST /api/codex/save-activity
 * Guarda una colección de tweets/posts desde Actividad
 */
router.post('/save-activity', verifyUserAccess, async (req, res) => {
  const { user_id, activity_data } = req.body || {};

  try {
    const userId = req.user.id;
    
    // Validaciones
    if (userId !== user_id) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const codexItemData = {
      user_id: userId,
      category: 'monitoring',
      subcategory: 'activity',
      source_type: 'activity',
      tipo: 'actividad', // Legacy
      titulo: activity_data.title || `Actividad: ${activity_data.query}`,
      descripcion: activity_data.description || `Monitoreo de ${activity_data.query}`,
      etiquetas: activity_data.tags || [],
      proyecto: activity_data.project || 'Sin proyecto',
      project_id: activity_data.project_id || null,
      recent_scrape_id: activity_data.scrape_id || null, // Link to recent_scrapes
      metadata: {
        activity_type: activity_data.type || 'general', // 'hashtag', 'user', 'keyword'
        activity_query: activity_data.query,
        sentiment: activity_data.sentiment || 'neutral',
        tweet_count: activity_data.tweet_count || 0,
        time_range: activity_data.time_range || null,
        platform: activity_data.platform || 'twitter'
      },
      fecha: new Date().toISOString().split('T')[0]
    };

    const { data: insertedItem, error: insertError } = await supabase
      .from('codex_items')
      .insert([codexItemData])
      .select('*')
      .single();

    if (insertError) {
      console.error('❌ Error insertando actividad en Codex:', insertError);
      return res.status(500).json({
        error: 'Error guardando actividad',
        message: insertError.message
      });
    }

    console.log(`✅ Actividad guardada en Codex: ${insertedItem.id}`);

    await logUsage('/api/codex/save-activity', userId, {
      item_id: insertedItem.id,
      query: activity_data.query,
      tweet_count: activity_data.tweet_count
    });

    return res.json({
      success: true,
      id: insertedItem.id,
      item: insertedItem
    });

  } catch (error) {
    console.error('❌ Error en /api/codex/save-activity:', error);
    await logError('/api/codex/save-activity', error, req.user, req);
    return res.status(500).json({
      error: 'Error interno',
      message: error.message
    });
  }
});
```

### 3. Nuevo Endpoint para Guardar Items de Wiki

```javascript
// server/routes/codex.js

/**
 * POST /api/codex/save-wiki-item
 * Guarda un item de la Wiki (persona, organización, lugar, evento, concepto)
 */
router.post('/save-wiki-item', verifyUserAccess, async (req, res) => {
  const { user_id, wiki_data } = req.body || {};

  try {
    const userId = req.user.id;
    
    // Validaciones
    if (userId !== user_id) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    // Validar tipo de wiki
    const validWikiTypes = ['wiki_person', 'wiki_organization', 'wiki_location', 'wiki_event', 'wiki_concept'];
    if (!validWikiTypes.includes(wiki_data.wiki_type)) {
      return res.status(400).json({ error: 'Tipo de wiki inválido' });
    }

    // Construir metadata específica según el tipo
    let metadata = buildWikiMetadata(wiki_data);

    const codexItemData = {
      user_id: userId,
      category: 'wiki',
      subcategory: wiki_data.wiki_type,
      source_type: wiki_data.source_type || 'manual',
      tipo: 'wiki', // Legacy
      titulo: wiki_data.name || wiki_data.title,
      descripcion: wiki_data.description || wiki_data.summary || '',
      etiquetas: wiki_data.tags || [],
      proyecto: wiki_data.project || 'Sin proyecto',
      project_id: wiki_data.project_id || null,
      url: wiki_data.url || null, // Puede tener URL de referencia
      metadata: metadata,
      fecha: new Date().toISOString().split('T')[0]
    };

    const { data: insertedItem, error: insertError } = await supabase
      .from('codex_items')
      .insert([codexItemData])
      .select('*')
      .single();

    if (insertError) {
      console.error('❌ Error insertando item de Wiki en Codex:', insertError);
      return res.status(500).json({
        error: 'Error guardando item de Wiki',
        message: insertError.message
      });
    }

    console.log(`✅ Item de Wiki guardado en Codex: ${insertedItem.id} (${wiki_data.wiki_type})`);

    await logUsage('/api/codex/save-wiki-item', userId, {
      item_id: insertedItem.id,
      wiki_type: wiki_data.wiki_type,
      name: wiki_data.name
    });

    return res.json({
      success: true,
      id: insertedItem.id,
      item: insertedItem
    });

  } catch (error) {
    console.error('❌ Error en /api/codex/save-wiki-item:', error);
    await logError('/api/codex/save-wiki-item', error, req.user, req);
    return res.status(500).json({
      error: 'Error interno',
      message: error.message
    });
  }
});

/**
 * Helper para construir metadata específica de Wiki
 */
function buildWikiMetadata(wiki_data) {
  const base_metadata = {
    created_by: wiki_data.created_by || 'user',
    relevance_score: wiki_data.relevance_score || 0,
    last_mentioned: wiki_data.last_mentioned || null,
    source_urls: wiki_data.source_urls || [],
    related_items: wiki_data.related_items || [] // IDs de otros items del codex relacionados
  };

  switch (wiki_data.wiki_type) {
    case 'wiki_person':
      return {
        ...base_metadata,
        full_name: wiki_data.full_name,
        aliases: wiki_data.aliases || [],
        position: wiki_data.position || null,
        political_party: wiki_data.political_party || null,
        birth_date: wiki_data.birth_date || null,
        biography: wiki_data.biography || null,
        social_media: wiki_data.social_media || {},
        education: wiki_data.education || [],
        career_history: wiki_data.career_history || [],
        controversies: wiki_data.controversies || [],
        achievements: wiki_data.achievements || [],
        related_entities: wiki_data.related_entities || []
      };

    case 'wiki_organization':
      return {
        ...base_metadata,
        official_name: wiki_data.official_name,
        acronym: wiki_data.acronym || null,
        type: wiki_data.org_type || 'other', // 'political_party', 'ngo', 'government', 'media', 'company'
        legal_status: wiki_data.legal_status || null,
        founding_date: wiki_data.founding_date || null,
        headquarters: wiki_data.headquarters || null,
        key_people: wiki_data.key_people || [],
        mission: wiki_data.mission || null,
        budget: wiki_data.budget || null,
        members_count: wiki_data.members_count || null,
        parent_organization: wiki_data.parent_organization || null,
        subsidiaries: wiki_data.subsidiaries || [],
        scandals: wiki_data.scandals || [],
        achievements: wiki_data.achievements || []
      };

    case 'wiki_location':
      return {
        ...base_metadata,
        place_name: wiki_data.place_name,
        type: wiki_data.location_type || 'city', // 'city', 'department', 'neighborhood', 'building', 'zone'
        coordinates: wiki_data.coordinates || null,
        jurisdiction: wiki_data.jurisdiction || null,
        population: wiki_data.population || null,
        importance: wiki_data.importance || 'medium',
        mayor: wiki_data.mayor || null,
        governor: wiki_data.governor || null,
        demographic_data: wiki_data.demographic_data || {},
        recent_events: wiki_data.recent_events || [],
        security_status: wiki_data.security_status || 'unknown',
        infrastructure: wiki_data.infrastructure || []
      };

    case 'wiki_event':
      return {
        ...base_metadata,
        event_name: wiki_data.event_name,
        event_type: wiki_data.event_type || 'general', // 'legal_case', 'election', 'protest', 'crisis', 'milestone'
        start_date: wiki_data.start_date || null,
        end_date: wiki_data.end_date || null,
        status: wiki_data.status || 'ongoing', // 'planned', 'ongoing', 'completed', 'cancelled'
        outcome: wiki_data.outcome || null,
        participants: wiki_data.participants || [],
        timeline: wiki_data.timeline || [],
        key_moments: wiki_data.key_moments || [],
        involved_parties: wiki_data.involved_parties || [],
        legal_status: wiki_data.legal_status || null,
        public_impact: wiki_data.public_impact || 'medium',
        related_events: wiki_data.related_events || []
      };

    case 'wiki_concept':
      return {
        ...base_metadata,
        concept_name: wiki_data.concept_name,
        category: wiki_data.concept_category || 'general', // 'law', 'policy', 'movement', 'initiative', 'technical_term'
        definition: wiki_data.definition || null,
        context: wiki_data.context || null,
        current_status: wiki_data.current_status || 'active',
        relevance: wiki_data.relevance || 'medium',
        related_laws: wiki_data.related_laws || [],
        affected_population: wiki_data.affected_population || null,
        budget: wiki_data.budget || null,
        timeline: wiki_data.timeline || [],
        controversies: wiki_data.controversies || [],
        public_opinion: wiki_data.public_opinion || null
      };

    default:
      return base_metadata;
  }
}

/**
 * GET /api/codex/wiki-items
 * Obtiene items de la Wiki con filtros
 */
router.get('/wiki-items', verifyUserAccess, async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      wiki_type,      // 'wiki_person', 'wiki_organization', etc.
      search,         // Búsqueda en título/descripción
      related_to,     // ID de otro item del codex
      relevance_min,  // Score mínimo de relevancia
      limit = 50
    } = req.query;

    let query = supabase
      .from('codex_items')
      .select('*')
      .eq('user_id', userId)
      .eq('category', 'wiki')
      .order('created_at', { ascending: false });

    if (wiki_type) {
      query = query.eq('subcategory', wiki_type);
    }

    if (search) {
      query = query.or(`titulo.ilike.%${search}%,descripcion.ilike.%${search}%`);
    }

    if (relevance_min) {
      query = query.gte('metadata->relevance_score', parseInt(relevance_min));
    }

    if (limit) {
      query = query.limit(parseInt(limit));
    }

    const { data, error } = await query;

    if (error) {
      console.error('❌ Error obteniendo items de Wiki:', error);
      return res.status(500).json({
        error: 'Error obteniendo items de Wiki',
        message: error.message
      });
    }

    // Si se filtró por relacionados, filtrar en memoria (metadata->related_items)
    let filteredData = data;
    if (related_to) {
      filteredData = data.filter(item => 
        item.metadata?.related_items?.includes(related_to)
      );
    }

    return res.json({
      success: true,
      items: filteredData,
      count: filteredData.length
    });

  } catch (error) {
    console.error('❌ Error en /api/codex/wiki-items:', error);
    return res.status(500).json({
      error: 'Error interno',
      message: error.message
    });
  }
});

/**
 * PUT /api/codex/wiki-item/:id/relate
 * Vincula un item de Wiki con otros items del Codex
 */
router.put('/wiki-item/:id/relate', verifyUserAccess, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { related_item_ids } = req.body;

    // Obtener item actual
    const { data: currentItem, error: fetchError } = await supabase
      .from('codex_items')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !currentItem) {
      return res.status(404).json({ error: 'Item no encontrado' });
    }

    // Agregar nuevos relacionados a los existentes
    const existingRelated = currentItem.metadata?.related_items || [];
    const newRelated = [...new Set([...existingRelated, ...related_item_ids])];

    // Actualizar metadata
    const updatedMetadata = {
      ...currentItem.metadata,
      related_items: newRelated
    };

    const { error: updateError } = await supabase
      .from('codex_items')
      .update({ metadata: updatedMetadata })
      .eq('id', id);

    if (updateError) {
      return res.status(500).json({ error: 'Error actualizando relaciones' });
    }

    return res.json({
      success: true,
      related_items: newRelated
    });

  } catch (error) {
    console.error('❌ Error en /api/codex/wiki-item/relate:', error);
    return res.status(500).json({ error: 'Error interno' });
  }
});
```

---

## 📱 Cambios en la MobileApp

### 1. Actualizar `SavedItem` Interface

```typescript
// src/state/savedStore.ts

export interface SavedItem extends LinkData {
  id: string;
  source: 'chat' | 'clipboard' | 'manual' | 'activity' | 'bookmark';
  isFavorite?: boolean;
  codex_id?: string;
  
  // Nuevos campos para categorización
  category?: 'general' | 'monitoring';
  subcategory?: 'document' | 'audio' | 'video' | 'external_spreadsheet' | 
                'activity' | 'bookmark' | 'internal_spreadsheet';
  source_type?: 'manual' | 'bookmark' | 'activity' | 'upload' | 'generated';
  
  // Metadata específica por tipo
  metadata?: {
    // Para bookmarks de redes sociales
    platform?: string;
    author?: string;
    post_id?: string;
    engagement?: {
      likes?: number;
      comments?: number;
      shares?: number;
      views?: number;
    };
    
    // Para audios
    duration?: number;
    audio_format?: string;
    transcription_available?: boolean;
    
    // Para videos
    resolution?: string;
    video_format?: string;
    
    // Para documentos
    page_count?: number;
    file_format?: string;
    document_type?: string;
    
    // Para actividad
    activity_type?: 'hashtag' | 'user' | 'keyword' | 'profile';
    activity_query?: string;
    sentiment?: 'positive' | 'negative' | 'neutral';
    tweet_count?: number;
    time_range?: string;
  };
  
  // Mantener campos existentes para compatibilidad
  quality?: 'excellent' | 'good' | 'fair' | 'poor';
  contentScore?: number;
  hasCleanDescription?: boolean;
  imageQuality?: 'high' | 'medium' | 'low' | 'none';
  processingTime?: number;
  lastUpdated?: number;
  commentsInfo?: { ... };
  analysisInfo?: { ... };
  xAnalysisInfo?: { ... };
}
```

### 2. Actualizar `codexService.ts`

```typescript
// src/services/codexService.ts

export async function saveLinkToCodex(userId: string, item: SavedItem): Promise<CodexSaveResult> {
  try {
    // Determinar category y subcategory automáticamente si no están definidos
    const category = item.category || determineCategory(item);
    const subcategory = item.subcategory || determineSubcategory(item);
    const source_type = item.source_type || mapSourceToSourceType(item.source);
    
    // Construir metadata
    const metadata = buildMetadata(item);

    const link_data = {
      url: item.url,
      title: item.title,
      description: item.description,
      platform: item.platform,
      image: item.image,
      author: item.author,
      domain: item.domain,
      type: item.type,
      timestamp: item.timestamp,
      engagement: item.engagement,
      // Nuevos campos
      category: category,
      subcategory: subcategory,
      source_type: source_type,
      metadata: metadata,
      tags: item.metadata?.tags || []
    };

    // ... resto del código de guardado ...
  } catch (error) {
    // ... manejo de errores ...
  }
}

function determineCategory(item: SavedItem): 'general' | 'monitoring' {
  const socialPlatforms = ['twitter', 'instagram', 'tiktok', 'facebook'];
  if (socialPlatforms.includes(item.platform || '')) {
    return 'monitoring';
  }
  if (item.source === 'activity') {
    return 'monitoring';
  }
  return 'general';
}

function determineSubcategory(item: SavedItem): string {
  // Si viene de actividad
  if (item.source === 'activity') {
    return 'activity';
  }
  
  // Si es un bookmark de redes sociales
  const socialPlatforms = ['twitter', 'instagram', 'tiktok', 'facebook'];
  if (socialPlatforms.includes(item.platform || '')) {
    return 'bookmark';
  }
  
  // Según el tipo de contenido
  switch (item.type) {
    case 'audio':
      return 'audio';
    case 'video':
      return 'video';
    case 'document':
    case 'pdf':
      return 'document';
    case 'spreadsheet':
    case 'excel':
    case 'csv':
      return 'external_spreadsheet';
    default:
      return 'document';
  }
}

function mapSourceToSourceType(source: SavedItem['source']): string {
  switch (source) {
    case 'activity':
      return 'activity';
    case 'clipboard':
    case 'chat':
      return 'bookmark';
    case 'manual':
      return 'manual';
    default:
      return 'manual';
  }
}

function buildMetadata(item: SavedItem): any {
  const metadata: any = {};
  
  // Social media bookmarks
  const socialPlatforms = ['twitter', 'instagram', 'tiktok', 'facebook'];
  if (socialPlatforms.includes(item.platform || '')) {
    metadata.platform = item.platform;
    metadata.author = item.author;
    metadata.post_id = extractPostId(item.url, item.platform);
    metadata.engagement = item.engagement || {
      likes: 0,
      comments: 0,
      shares: 0,
      views: 0
    };
  }
  
  // Audio
  if (item.type === 'audio') {
    metadata.duration = item.metadata?.duration;
    metadata.audio_format = item.metadata?.audio_format;
    metadata.transcription_available = !!item.metadata?.transcription_available;
  }
  
  // Video
  if (item.type === 'video') {
    metadata.duration = item.metadata?.duration;
    metadata.resolution = item.metadata?.resolution;
    metadata.video_format = item.metadata?.video_format;
  }
  
  // Document
  if (['document', 'pdf'].includes(item.type || '')) {
    metadata.page_count = item.metadata?.page_count;
    metadata.file_format = item.metadata?.file_format || item.type;
    metadata.document_type = item.metadata?.document_type;
  }
  
  return metadata;
}

function extractPostId(url: string, platform?: string): string | null {
  if (!url || !platform) return null;
  
  if (platform === 'twitter' || platform === 'x') {
    const match = url.match(/status\/(\d+)/);
    return match ? match[1] : null;
  } else if (platform === 'instagram') {
    const match = url.match(/\/p\/([A-Za-z0-9_-]+)/);
    return match ? match[1] : null;
  } else if (platform === 'tiktok') {
    const match = url.match(/video\/(\d+)/);
    return match ? match[1] : null;
  }
  
  return null;
}

/**
 * Nueva función para guardar actividad al Codex
 */
export async function saveActivityToCodex(
  userId: string, 
  activityData: {
    query: string;
    type: 'hashtag' | 'user' | 'keyword' | 'profile';
    sentiment?: 'positive' | 'negative' | 'neutral';
    tweet_count?: number;
    scrape_id?: string;
    title?: string;
    description?: string;
    tags?: string[];
    project?: string;
    project_id?: string;
  }
): Promise<CodexSaveResult> {
  try {
    const pulseConnectionStore = require('../state/pulseConnectionStore').usePulseConnectionStore.getState();
    const pulseUser = pulseConnectionStore.connectedUser;
    
    if (!pulseUser) {
      return { 
        success: false, 
        error: 'No se encontró una conexión válida con Pulse Journal.' 
      };
    }

    const response = await fetch('https://server.standatpd.com/api/codex/save-activity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        pulse_user_email: pulseUser.email,
        activity_data: activityData
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Error desconocido');
      console.error('Backend save activity to Codex failed:', response.status, errorText);
      throw new Error(`Error del servidor: ${response.status}`);
    }

    const result = await response.json();
    
    if (result.success) {
      return { success: true, id: result.id };
    } else {
      return { success: false, error: result.error || 'Error guardando actividad en Codex' };
    }
  } catch (error: any) {
    console.error('Error saving activity to Codex:', error);
    return { success: false, error: error?.message || 'Error conectando con el servidor' };
  }
}
```

---

## 🎨 Cambios en ThePulse (Frontend)

### 1. Actualizar `EnhancedCodex.tsx`

Agregar filtros visuales por categoría y subcategoría:

```tsx
// src/pages/EnhancedCodex.tsx

const [selectedCategory, setSelectedCategory] = useState<'all' | 'general' | 'monitoring'>('all');
const [selectedSubcategory, setSelectedSubcategory] = useState<string>('all');

// Filtros visuales
<Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
  {/* Filtro por Categoría */}
  <Chip
    label="Todos"
    onClick={() => setSelectedCategory('all')}
    color={selectedCategory === 'all' ? 'primary' : 'default'}
    sx={{ fontWeight: selectedCategory === 'all' ? 600 : 400 }}
  />
  <Chip
    label="📁 Archivos Generales"
    onClick={() => setSelectedCategory('general')}
    color={selectedCategory === 'general' ? 'primary' : 'default'}
    sx={{ fontWeight: selectedCategory === 'general' ? 600 : 400 }}
  />
  <Chip
    label="📊 Monitoreos"
    onClick={() => setSelectedCategory('monitoring')}
    color={selectedCategory === 'monitoring' ? 'primary' : 'default'}
    sx={{ fontWeight: selectedCategory === 'monitoring' ? 600 : 400 }}
  />
</Box>

{/* Filtro por Subcategoría (solo si hay categoría seleccionada) */}
{selectedCategory === 'general' && (
  <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
    <Chip size="small" label="Todos" onClick={() => setSelectedSubcategory('all')} />
    <Chip size="small" label="📄 Documentos" onClick={() => setSelectedSubcategory('document')} />
    <Chip size="small" label="🎤 Audios" onClick={() => setSelectedSubcategory('audio')} />
    <Chip size="small" label="🎬 Videos" onClick={() => setSelectedSubcategory('video')} />
    <Chip size="small" label="📊 Spreadsheets" onClick={() => setSelectedSubcategory('external_spreadsheet')} />
  </Box>
)}

{selectedCategory === 'monitoring' && (
  <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
    <Chip size="small" label="Todos" onClick={() => setSelectedSubcategory('all')} />
    <Chip size="small" label="📌 Posts Guardados" onClick={() => setSelectedSubcategory('bookmark')} />
    <Chip size="small" label="📊 Actividad" onClick={() => setSelectedSubcategory('activity')} />
    <Chip size="small" label="📑 Spreadsheets Internos" onClick={() => setSelectedSubcategory('internal_spreadsheet')} />
  </Box>
)}

// Actualizar query de Supabase
const fetchCodexItems = async () => {
  let query = supabase
    .from('codex_items')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (selectedCategory !== 'all') {
    query = query.eq('category', selectedCategory);
  }

  if (selectedSubcategory !== 'all') {
    query = query.eq('subcategory', selectedSubcategory);
  }

  const { data, error } = await query;
  
  if (error) {
    console.error('Error fetching codex items:', error);
    return;
  }

  setCodexItems(data || []);
};
```

### 2. Crear Componentes Específicos por Tipo

```tsx
// src/components/ui/CodexItemCard.tsx

interface CodexItemCardProps {
  item: CodexItem;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
}

export default function CodexItemCard({ item, onDelete, onEdit }: CodexItemCardProps) {
  const renderCardBySubcategory = () => {
    switch (item.subcategory) {
      case 'bookmark':
        return <BookmarkCard item={item} />;
      case 'activity':
        return <ActivityCard item={item} />;
      case 'audio':
        return <AudioCard item={item} />;
      case 'video':
        return <VideoCard item={item} />;
      case 'document':
        return <DocumentCard item={item} />;
      case 'external_spreadsheet':
      case 'internal_spreadsheet':
        return <SpreadsheetCard item={item} />;
      default:
        return <GenericCard item={item} />;
    }
  };

  return (
    <Card sx={{ position: 'relative' }}>
      {renderCardBySubcategory()}
      
      {/* Badges de categorización */}
      <Box sx={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 0.5 }}>
        {item.category && (
          <Chip 
            size="small" 
            label={item.category === 'general' ? '📁' : '📊'} 
            sx={{ fontSize: '0.7rem' }}
          />
        )}
        {item.source_type && (
          <Chip 
            size="small" 
            label={getSourceTypeLabel(item.source_type)} 
            sx={{ fontSize: '0.7rem' }}
          />
        )}
      </Box>
    </Card>
  );
}

// Componentes específicos
function BookmarkCard({ item }: { item: CodexItem }) {
  const metadata = item.metadata || {};
  
  return (
    <CardContent>
      <Typography variant="h6">{item.titulo}</Typography>
      <Typography variant="body2" color="text.secondary">{item.descripcion}</Typography>
      
      {/* Platform badge */}
      <Chip 
        size="small" 
        label={metadata.platform} 
        icon={getPlatformIcon(metadata.platform)}
        sx={{ mt: 1 }}
      />
      
      {/* Author */}
      {metadata.author && (
        <Typography variant="caption" display="block" sx={{ mt: 1 }}>
          Por: {metadata.author}
        </Typography>
      )}
      
      {/* Engagement metrics */}
      {metadata.engagement && (
        <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
          <Typography variant="caption">❤️ {metadata.engagement.likes || 0}</Typography>
          <Typography variant="caption">💬 {metadata.engagement.comments || 0}</Typography>
          <Typography variant="caption">🔁 {metadata.engagement.shares || 0}</Typography>
          <Typography variant="caption">👁️ {metadata.engagement.views || 0}</Typography>
        </Box>
      )}
      
      {/* Link to post */}
      {item.url && (
        <Button 
          size="small" 
          href={item.url} 
          target="_blank"
          sx={{ mt: 2 }}
        >
          Ver post original
        </Button>
      )}
    </CardContent>
  );
}

function ActivityCard({ item }: { item: CodexItem }) {
  const metadata = item.metadata || {};
  
  return (
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <TimelineIcon />
        <Typography variant="h6">{item.titulo}</Typography>
      </Box>
      
      <Typography variant="body2" color="text.secondary">{item.descripcion}</Typography>
      
      {/* Activity details */}
      <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {metadata.activity_query && (
          <Chip 
            size="small" 
            label={`Query: ${metadata.activity_query}`}
            color="primary"
          />
        )}
        
        {metadata.activity_type && (
          <Chip 
            size="small" 
            label={metadata.activity_type}
            color="secondary"
          />
        )}
        
        {metadata.sentiment && (
          <Chip 
            size="small" 
            label={`Sentimiento: ${metadata.sentiment}`}
            color={
              metadata.sentiment === 'positive' ? 'success' : 
              metadata.sentiment === 'negative' ? 'error' : 
              'default'
            }
          />
        )}
        
        {metadata.tweet_count && (
          <Chip 
            size="small" 
            label={`${metadata.tweet_count} tweets`}
            icon={<DataUsageIcon />}
          />
        )}
      </Box>
      
      {/* Link to recent_scrapes if available */}
      {item.recent_scrape_id && (
        <Button 
          size="small" 
          sx={{ mt: 2 }}
          onClick={() => {
            // Navigate to RecentActivity with specific scrape
            window.location.href = `/recent-activity?scrape=${item.recent_scrape_id}`;
          }}
        >
          Ver análisis completo
        </Button>
      )}
    </CardContent>
  );
}

function AudioCard({ item }: { item: CodexItem }) {
  const metadata = item.metadata || {};
  
  return (
    <CardContent>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <MicIcon />
        <Typography variant="h6">{item.titulo}</Typography>
      </Box>
      
      <Typography variant="body2" color="text.secondary">{item.descripcion}</Typography>
      
      {/* Audio details */}
      <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
        {metadata.duration && (
          <Chip 
            size="small" 
            label={formatDuration(metadata.duration)}
          />
        )}
        
        {metadata.audio_format && (
          <Chip 
            size="small" 
            label={metadata.audio_format.toUpperCase()}
          />
        )}
        
        {metadata.transcription_available && (
          <Chip 
            size="small" 
            label="Transcripción disponible"
            color="success"
          />
        )}
      </Box>
      
      {/* Audio player */}
      {item.storage_path && (
        <Box sx={{ mt: 2 }}>
          <audio controls style={{ width: '100%' }}>
            <source src={item.storage_path} type={`audio/${metadata.audio_format || 'mp3'}`} />
          </audio>
        </Box>
      )}
      
      {/* Transcription */}
      {item.audio_transcription && (
        <Accordion sx={{ mt: 2 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="body2">Ver transcripción</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {item.audio_transcription}
            </Typography>
          </AccordionDetails>
        </Accordion>
      )}
    </CardContent>
  );
}

// ... Similar para VideoCard, DocumentCard, SpreadsheetCard ...
```

---

## 📋 Plan de Implementación

### Fase 1: Base de Datos (1-2 días)
1. ✅ Ejecutar migration SQL en Supabase
2. ✅ Verificar constraints y indices
3. ✅ Migrar datos existentes con script de UPDATE
4. ✅ Probar queries de lectura con nuevos filtros

### Fase 2: Backend (2-3 días)
1. ✅ Actualizar `/api/codex/save-link` con lógica de categorización
2. ✅ Crear `/api/codex/save-activity` endpoint
3. ✅ Actualizar `getUserCodex` para soportar nuevos filtros
4. ✅ Agregar funciones helper (extractPostId, buildMetadata, etc.)
5. ✅ Testing de endpoints

### Fase 3: MobileApp (3-4 días)
1. ✅ Actualizar interface `SavedItem`
2. ✅ Modificar `codexService.ts` con nuevas funciones
3. ✅ Actualizar `improved-link-processor.ts` para incluir metadata
4. ✅ Agregar `saveActivityToCodex` function
5. ✅ Testing de guardado con diferentes tipos

### Fase 4: ThePulse Frontend (3-4 días)
1. ✅ Agregar filtros de category/subcategory en EnhancedCodex
2. ✅ Crear componentes específicos (BookmarkCard, ActivityCard, etc.)
3. ✅ Actualizar RecentActivity para integrar "Guardar a Codex"
4. ✅ Testing de visualización y filtrado

### Fase 5: Testing y Refinamiento (2-3 días)
1. ✅ Testing end-to-end completo
2. ✅ Verificar backward compatibility
3. ✅ Ajustes de UI/UX
4. ✅ Documentación final

---

## 🔍 Casos de Uso

### 1. Usuario guarda un tweet desde MobileApp
```
1. Usuario copia link de Twitter
2. App detecta → platform: 'twitter'
3. Link processor extrae engagement, author, etc.
4. codexService.saveLinkToCodex() →
   - category: 'monitoring'
   - subcategory: 'bookmark'
   - source_type: 'bookmark'
   - metadata: { platform: 'twitter', author: '@user', post_id: '123', engagement: {...} }
5. Backend guarda en codex_items
6. ThePulse muestra en "Monitoreos > Posts Guardados"
```

### 2. Usuario guarda análisis de hashtag desde Actividad
```
1. Usuario hace scrape de #argentina en ThePulse
2. Ve resultados en RecentActivity
3. Click en "Guardar a Codex"
4. Backend /api/codex/save-activity →
   - category: 'monitoring'
   - subcategory: 'activity'
   - source_type: 'activity'
   - metadata: { activity_type: 'hashtag', query: '#argentina', sentiment: 'positive', tweet_count: 45 }
   - recent_scrape_id: link al scrape original
5. ThePulse muestra en "Monitoreos > Actividad"
```

### 3. Usuario sube un audio desde MobileApp
```
1. Usuario graba audio
2. App transcribe con Whisper
3. codexService.saveRecordingToCodex() →
   - category: 'general'
   - subcategory: 'audio'
   - source_type: 'upload'
   - metadata: { duration: 180, audio_format: 'mp3', transcription_available: true }
   - audio_transcription: texto transcrito
4. Backend guarda en codex_items
5. ThePulse muestra en "Archivos Generales > Audios"
```

---

## 🚀 Ventajas del Nuevo Sistema

### 1. **Organización Clara**
- Separación lógica entre archivos personales y monitoreos
- Filtrado intuitivo por categoría y subcategoría
- Fácil navegación en ThePulse

### 2. **Metadata Específica**
- Cada tipo de contenido tiene campos relevantes
- Búsquedas más precisas
- Análisis más detallados

### 3. **Escalabilidad**
- Fácil agregar nuevas subcategorías
- JSONB metadata flexible
- Backward compatible

### 4. **Mejor UX**
- Usuarios encuentran contenido más rápido
- Visualización específica por tipo
- Badges y etiquetas claras

### 5. **Analytics Mejorado**
- Métricas por categoría
- Engagement tracking preciso
- Insights de uso

---

## 📊 Métricas de Éxito

1. **Tiempo de búsqueda** → Reducción del 50% con filtros
2. **Engagement** → Aumento del 30% en guardado de items
3. **Organización** → 90% de items categorizados correctamente
4. **Performance** → Queries < 200ms con indices

---

## 🔒 Consideraciones de Seguridad

1. **RLS Policies** → Mantener políticas estrictas por user_id
2. **Validación de Metadata** → Constraints en DB + validación en backend
3. **Sanitización** → Limpiar URLs y inputs antes de guardar
4. **Rate Limiting** → Limitar guardados por minuto

---

## ✅ Checklist Final

- [ ] Migration SQL ejecutado y verificado
- [ ] Backend endpoints actualizados y probados
- [ ] MobileApp interfaces y servicios actualizados
- [ ] ThePulse filtros y componentes implementados
- [ ] Testing end-to-end completo
- [ ] Documentación actualizada
- [ ] Deploy a producción
- [ ] Monitoreo de métricas post-deploy

---

## 📝 Notas Adicionales

### Compatibilidad con Sistema Actual
- Todos los items existentes se migran automáticamente
- Campo `tipo` se mantiene para backward compatibility
- Campos legacy (`likes`, `comments`, etc.) se mantienen
- Queries antiguas siguen funcionando

### Próximas Mejoras (Future)
- Agregar tags automáticos con IA
- Smart categorization con ML
- Bulk operations (mover múltiples items)
- Export por categoría
- Compartir colecciones de items

---

**Fecha de Creación:** {fecha_actual}  
**Versión:** 1.0  
**Autor:** AI Assistant

