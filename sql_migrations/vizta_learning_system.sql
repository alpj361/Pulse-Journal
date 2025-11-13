-- ============================================================================
-- VIZTA v4.3 - Sprint 2: Knowledge Integration & Active Learning System
-- ============================================================================
-- Fecha: 2025-10-07
-- Descripción: Tablas para el sistema de aprendizaje activo de Vizta
-- ============================================================================

-- ============================================================================
-- 1. TABLA: vizta_learned_items
-- ============================================================================
-- Descripción: Almacena todo lo que Vizta aprende automáticamente
-- Incluye: RSS feeds, búsquedas web guardadas, tendencias detectadas
-- ============================================================================

CREATE TABLE IF NOT EXISTS vizta_learned_items (
  -- Identificación
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Metadata de la fuente
  source_type TEXT NOT NULL CHECK (source_type IN ('rss', 'perplexity_search', 'social_trend', 'manual')),
  source_name TEXT, -- Ej: "Prensa Libre", "BBC News", "Web Search"
  source_url TEXT,
  
  -- Contenido
  title TEXT NOT NULL,
  content TEXT,
  summary TEXT,
  tags TEXT[] DEFAULT '{}',
  
  -- Información contextual
  related_query TEXT, -- Query del usuario que generó este aprendizaje (si aplica)
  session_id TEXT, -- Session donde se aprendió esto
  relevance_score FLOAT DEFAULT 0.5 CHECK (relevance_score >= 0 AND relevance_score <= 1),
  
  -- Timestamps
  learned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  content_date TIMESTAMP WITH TIME ZONE, -- Fecha del contenido original (de la noticia, etc)
  
  -- Metadata adicional (flexible para datos extra)
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Índices de auditoría
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_vizta_learned_tags ON vizta_learned_items USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_vizta_learned_date ON vizta_learned_items(learned_at DESC);
CREATE INDEX IF NOT EXISTS idx_vizta_learned_content_date ON vizta_learned_items(content_date DESC) WHERE content_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vizta_learned_source ON vizta_learned_items(source_type, source_name);
CREATE INDEX IF NOT EXISTS idx_vizta_learned_user ON vizta_learned_items(user_id);
CREATE INDEX IF NOT EXISTS idx_vizta_learned_session ON vizta_learned_items(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_vizta_learned_query ON vizta_learned_items(related_query) WHERE related_query IS NOT NULL;

-- Índice de texto completo para búsqueda
CREATE INDEX IF NOT EXISTS idx_vizta_learned_search ON vizta_learned_items USING GIN(
  to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(content, '') || ' ' || coalesce(summary, ''))
);

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_vizta_learned_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_vizta_learned_items_updated_at
  BEFORE UPDATE ON vizta_learned_items
  FOR EACH ROW
  EXECUTE FUNCTION update_vizta_learned_items_updated_at();

-- RLS (Row Level Security)
ALTER TABLE vizta_learned_items ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios pueden ver sus propios learned items
CREATE POLICY "Users can view their learned items"
ON vizta_learned_items FOR SELECT
USING (auth.uid() = user_id);

-- Política: El sistema puede insertar learned items para cualquier usuario
-- (Necesario para scrapers automáticos y LearningInterceptor)
CREATE POLICY "System can insert learned items"
ON vizta_learned_items FOR INSERT
WITH CHECK (true);

-- Política: Los usuarios pueden actualizar sus propios learned items
CREATE POLICY "Users can update their learned items"
ON vizta_learned_items FOR UPDATE
USING (auth.uid() = user_id);

-- Política: Los usuarios pueden eliminar sus propios learned items
CREATE POLICY "Users can delete their learned items"
ON vizta_learned_items FOR DELETE
USING (auth.uid() = user_id);

-- Comentarios para documentación
COMMENT ON TABLE vizta_learned_items IS 'Almacena todo lo que Vizta aprende automáticamente: noticias RSS, búsquedas guardadas, tendencias';
COMMENT ON COLUMN vizta_learned_items.source_type IS 'Tipo de fuente: rss, perplexity_search, social_trend, manual';
COMMENT ON COLUMN vizta_learned_items.relevance_score IS 'Score de relevancia (0-1) para ranking de resultados';
COMMENT ON COLUMN vizta_learned_items.related_query IS 'Query del usuario que generó este aprendizaje';
COMMENT ON COLUMN vizta_learned_items.session_id IS 'ID de sesión donde se aprendió';

-- ============================================================================
-- 2. TABLA: vizta_query_log
-- ============================================================================
-- Descripción: Analytics de queries de usuarios a Vizta
-- Propósito: Identificar patrones, knowledge gaps, métricas de uso
-- ============================================================================

CREATE TABLE IF NOT EXISTS vizta_query_log (
  -- Identificación
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  request_id TEXT, -- ID único de la request (para correlación)
  
  -- Query info
  query TEXT NOT NULL,
  intent_type TEXT, -- 'news_event', 'research', 'conceptual', 'conversation', etc
  intent_confidence FLOAT, -- Confianza del clasificador (0-1)
  
  -- Response info
  response_message TEXT,
  has_sources BOOLEAN DEFAULT FALSE,
  sources_count INTEGER DEFAULT 0,
  
  -- Tools used
  tools_used TEXT[] DEFAULT '{}',
  knowledge_search_used BOOLEAN DEFAULT FALSE,
  learned_items_used INTEGER DEFAULT 0, -- Cuántos learned_items se usaron en la respuesta
  user_codex_used BOOLEAN DEFAULT FALSE,
  
  -- Performance
  response_time_ms INTEGER,
  total_tokens INTEGER, -- Tokens consumidos (si aplica)
  
  -- Feedback (opcional - para futuras implementaciones)
  feedback_score INTEGER CHECK (feedback_score >= 1 AND feedback_score <= 5),
  feedback_text TEXT,
  feedback_given_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata adicional
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para analytics rápidos
CREATE INDEX IF NOT EXISTS idx_query_log_user ON vizta_query_log(user_id);
CREATE INDEX IF NOT EXISTS idx_query_log_date ON vizta_query_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_log_session ON vizta_query_log(session_id);
CREATE INDEX IF NOT EXISTS idx_query_log_intent ON vizta_query_log(intent_type) WHERE intent_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_query_log_knowledge ON vizta_query_log(knowledge_search_used) WHERE knowledge_search_used = FALSE;
CREATE INDEX IF NOT EXISTS idx_query_log_feedback ON vizta_query_log(feedback_score) WHERE feedback_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_query_log_request ON vizta_query_log(request_id) WHERE request_id IS NOT NULL;

-- Índice de texto completo para búsqueda de queries
CREATE INDEX IF NOT EXISTS idx_query_log_search ON vizta_query_log USING GIN(
  to_tsvector('spanish', coalesce(query, ''))
);

-- RLS (Row Level Security)
ALTER TABLE vizta_query_log ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios pueden ver sus propios query logs
CREATE POLICY "Users can view their query logs"
ON vizta_query_log FOR SELECT
USING (auth.uid() = user_id);

-- Política: El sistema puede insertar query logs
CREATE POLICY "System can insert query logs"
ON vizta_query_log FOR INSERT
WITH CHECK (true);

-- Política: Los usuarios pueden actualizar su feedback
CREATE POLICY "Users can update their query feedback"
ON vizta_query_log FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Comentarios para documentación
COMMENT ON TABLE vizta_query_log IS 'Analytics de queries de usuarios: intenciones, herramientas usadas, performance, feedback';
COMMENT ON COLUMN vizta_query_log.intent_type IS 'Tipo de intención detectada por el clasificador';
COMMENT ON COLUMN vizta_query_log.learned_items_used IS 'Cantidad de learned_items que se usaron en la respuesta';
COMMENT ON COLUMN vizta_query_log.feedback_score IS 'Puntuación de satisfacción del usuario (1-5)';

-- ============================================================================
-- 3. TABLA: rss_feeds
-- ============================================================================
-- Descripción: Configuración de RSS feeds para curación automática
-- Propósito: Permitir que usuarios/admins configuren feeds personalizados
-- ============================================================================

CREATE TABLE IF NOT EXISTS rss_feeds (
  -- Identificación
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Configuración del feed
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  
  -- Estado
  active BOOLEAN DEFAULT TRUE,
  
  -- Metadata de scraping
  last_scraped_at TIMESTAMP WITH TIME ZONE,
  last_scrape_success BOOLEAN,
  last_scrape_error TEXT,
  items_scraped_count INTEGER DEFAULT 0,
  
  -- Configuración avanzada
  scrape_frequency_hours INTEGER DEFAULT 24, -- Cada cuántas horas scrapear
  max_items_per_scrape INTEGER DEFAULT 10,
  
  -- Metadata adicional
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_rss_feeds_user ON rss_feeds(user_id);
CREATE INDEX IF NOT EXISTS idx_rss_feeds_active ON rss_feeds(active) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_rss_feeds_tags ON rss_feeds USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_rss_feeds_last_scraped ON rss_feeds(last_scraped_at) WHERE active = TRUE;

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_rss_feeds_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_rss_feeds_updated_at
  BEFORE UPDATE ON rss_feeds
  FOR EACH ROW
  EXECUTE FUNCTION update_rss_feeds_updated_at();

-- RLS (Row Level Security)
ALTER TABLE rss_feeds ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios pueden ver sus propios feeds
CREATE POLICY "Users can view their rss feeds"
ON rss_feeds FOR SELECT
USING (auth.uid() = user_id);

-- Política: Los usuarios pueden crear sus propios feeds
CREATE POLICY "Users can create rss feeds"
ON rss_feeds FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Política: Los usuarios pueden actualizar sus propios feeds
CREATE POLICY "Users can update their rss feeds"
ON rss_feeds FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Política: Los usuarios pueden eliminar sus propios feeds
CREATE POLICY "Users can delete their rss feeds"
ON rss_feeds FOR DELETE
USING (auth.uid() = user_id);

-- Política: El sistema puede actualizar feeds (para scraping status)
CREATE POLICY "System can update rss feeds scraping status"
ON rss_feeds FOR UPDATE
USING (true)
WITH CHECK (true);

-- Comentarios para documentación
COMMENT ON TABLE rss_feeds IS 'Configuración de RSS feeds para curación automática de noticias';
COMMENT ON COLUMN rss_feeds.scrape_frequency_hours IS 'Frecuencia de scraping en horas (default: 24)';
COMMENT ON COLUMN rss_feeds.max_items_per_scrape IS 'Máximo de items a procesar por scrape (default: 10)';

-- ============================================================================
-- 4. VISTAS ÚTILES PARA ANALYTICS
-- ============================================================================

-- Vista: Query analytics por usuario
CREATE OR REPLACE VIEW vizta_query_analytics AS
SELECT 
  user_id,
  COUNT(*) as total_queries,
  COUNT(DISTINCT session_id) as total_sessions,
  COUNT(CASE WHEN knowledge_search_used THEN 1 END) as queries_with_knowledge,
  COUNT(CASE WHEN learned_items_used > 0 THEN 1 END) as queries_with_learned_items,
  COUNT(CASE WHEN user_codex_used THEN 1 END) as queries_with_user_codex,
  AVG(CASE WHEN has_sources THEN sources_count ELSE 0 END) as avg_sources_per_query,
  AVG(response_time_ms) as avg_response_time_ms,
  AVG(CASE WHEN feedback_score IS NOT NULL THEN feedback_score END) as avg_feedback_score,
  COUNT(CASE WHEN feedback_score IS NOT NULL THEN 1 END) as total_feedback_given,
  DATE_TRUNC('day', created_at) as date
FROM vizta_query_log
GROUP BY user_id, DATE_TRUNC('day', created_at);

COMMENT ON VIEW vizta_query_analytics IS 'Analytics agregados de queries por usuario y día';

-- Vista: Knowledge gaps (queries sin knowledge_search)
CREATE OR REPLACE VIEW vizta_knowledge_gaps AS
SELECT 
  query,
  intent_type,
  COUNT(*) as query_count,
  AVG(CASE WHEN has_sources THEN sources_count ELSE 0 END) as avg_sources,
  MAX(created_at) as last_asked,
  user_id
FROM vizta_query_log
WHERE knowledge_search_used = FALSE 
  AND learned_items_used = 0
  AND intent_type NOT IN ('conversation', 'help')
GROUP BY query, intent_type, user_id
HAVING COUNT(*) > 1
ORDER BY query_count DESC, last_asked DESC;

COMMENT ON VIEW vizta_knowledge_gaps IS 'Identifica queries frecuentes sin uso de knowledge base (posibles gaps)';

-- Vista: Learned items recientes por fuente
CREATE OR REPLACE VIEW vizta_learned_items_summary AS
SELECT 
  source_type,
  source_name,
  COUNT(*) as items_count,
  MAX(learned_at) as last_learned,
  AVG(relevance_score) as avg_relevance,
  array_agg(DISTINCT unnest(tags)) as all_tags,
  user_id
FROM vizta_learned_items
WHERE learned_at > NOW() - INTERVAL '30 days'
GROUP BY source_type, source_name, user_id
ORDER BY last_learned DESC;

COMMENT ON VIEW vizta_learned_items_summary IS 'Resumen de items aprendidos en los últimos 30 días por fuente';

-- ============================================================================
-- 5. FUNCIONES ÚTILES
-- ============================================================================

-- Función: Obtener learned items relevantes para una query
CREATE OR REPLACE FUNCTION get_relevant_learned_items(
  p_query TEXT,
  p_user_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 10,
  p_days_back INTEGER DEFAULT 30
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  summary TEXT,
  source_type TEXT,
  source_name TEXT,
  source_url TEXT,
  tags TEXT[],
  learned_at TIMESTAMP WITH TIME ZONE,
  relevance_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    li.id,
    li.title,
    li.summary,
    li.source_type,
    li.source_name,
    li.source_url,
    li.tags,
    li.learned_at,
    li.relevance_score
  FROM vizta_learned_items li
  WHERE 
    (p_user_id IS NULL OR li.user_id = p_user_id)
    AND li.learned_at > NOW() - (p_days_back || ' days')::INTERVAL
    AND (
      li.title ILIKE '%' || p_query || '%'
      OR li.content ILIKE '%' || p_query || '%'
      OR li.summary ILIKE '%' || p_query || '%'
    )
  ORDER BY li.learned_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_relevant_learned_items IS 'Busca learned items relevantes para una query específica';

-- Función: Obtener feeds que necesitan scraping
CREATE OR REPLACE FUNCTION get_feeds_to_scrape()
RETURNS TABLE (
  id UUID,
  name TEXT,
  url TEXT,
  tags TEXT[],
  scrape_frequency_hours INTEGER,
  max_items_per_scrape INTEGER,
  user_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rf.id,
    rf.name,
    rf.url,
    rf.tags,
    rf.scrape_frequency_hours,
    rf.max_items_per_scrape,
    rf.user_id
  FROM rss_feeds rf
  WHERE 
    rf.active = TRUE
    AND (
      rf.last_scraped_at IS NULL 
      OR rf.last_scraped_at < NOW() - (rf.scrape_frequency_hours || ' hours')::INTERVAL
    )
  ORDER BY 
    CASE WHEN rf.last_scraped_at IS NULL THEN 0 ELSE 1 END,
    rf.last_scraped_at ASC NULLS FIRST;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_feeds_to_scrape IS 'Retorna RSS feeds que necesitan ser scrapeados según su frecuencia configurada';

-- ============================================================================
-- 6. DATOS INICIALES (OPCIONAL - SEEDS)
-- ============================================================================

-- Comentario: Descomentar para insertar feeds RSS de ejemplo
-- INSERT INTO rss_feeds (user_id, name, url, tags, description) VALUES
-- (auth.uid(), 'BBC News - World', 'https://feeds.bbci.co.uk/news/world/rss.xml', ARRAY['news', 'world'], 'BBC World News Feed'),
-- (auth.uid(), 'Reuters - World', 'https://www.reutersagency.com/feed/?taxonomy=best-topics&post_type=best', ARRAY['news', 'world'], 'Reuters World News')
-- ON CONFLICT (url) DO NOTHING;

-- ============================================================================
-- FIN DE MIGRACIÓN
-- ============================================================================

-- Verificación de tablas creadas
DO $$
BEGIN
  RAISE NOTICE '✅ Migración completada exitosamente';
  RAISE NOTICE '📊 Tablas creadas: vizta_learned_items, vizta_query_log, rss_feeds';
  RAISE NOTICE '👁️ Vistas creadas: vizta_query_analytics, vizta_knowledge_gaps, vizta_learned_items_summary';
  RAISE NOTICE '🔧 Funciones creadas: get_relevant_learned_items, get_feeds_to_scrape';
  RAISE NOTICE '🔒 RLS habilitado en todas las tablas';
END $$;

