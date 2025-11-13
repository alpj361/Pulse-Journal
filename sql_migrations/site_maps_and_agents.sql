-- ===================================================================
-- MIGRACIÓN: SISTEMA DE MAPAS DE SITIOS Y AGENTES DE EXTRACCIÓN
-- ===================================================================
-- Esta migración crea las tablas necesarias para el sistema de mapas
-- de sitios web y agentes de extracción automatizada en Knowledge.tsx
-- ===================================================================

-- 1. TABLA: site_maps
-- Almacena mapas de sitios web explorados inicialmente
CREATE TABLE IF NOT EXISTS site_maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  site_name VARCHAR(255) NOT NULL,
  base_url VARCHAR(500) NOT NULL,
  exploration_goal TEXT,
  site_structure JSONB NOT NULL DEFAULT '{}', -- Estructura del sitio explorado
  navigation_summary TEXT NOT NULL, -- Resumen en markdown de la exploración
  exploration_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'outdated', 'archived')),
  
  -- Índices para performance
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para site_maps
CREATE INDEX IF NOT EXISTS idx_site_maps_user_id ON site_maps(user_id);
CREATE INDEX IF NOT EXISTS idx_site_maps_status ON site_maps(status);
CREATE INDEX IF NOT EXISTS idx_site_maps_exploration_date ON site_maps(exploration_date DESC);
CREATE INDEX IF NOT EXISTS idx_site_maps_base_url ON site_maps(base_url);

-- 2. TABLA: site_agents
-- Almacena agentes de extracción configurados para sitios específicos
CREATE TABLE IF NOT EXISTS site_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  site_map_id UUID REFERENCES site_maps(id) ON DELETE CASCADE,
  agent_name VARCHAR(255) NOT NULL,
  extraction_target TEXT NOT NULL, -- Descripción de qué debe extraer
  extraction_config JSONB DEFAULT '{}', -- Configuración específica del agente
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_execution TIMESTAMP WITH TIME ZONE,
  
  -- Constraint: un usuario no puede tener dos agentes con el mismo nombre
  CONSTRAINT unique_agent_name_per_user UNIQUE (user_id, agent_name)
);

-- Índices para site_agents
CREATE INDEX IF NOT EXISTS idx_site_agents_user_id ON site_agents(user_id);
CREATE INDEX IF NOT EXISTS idx_site_agents_site_map_id ON site_agents(site_map_id);
CREATE INDEX IF NOT EXISTS idx_site_agents_status ON site_agents(status);
CREATE INDEX IF NOT EXISTS idx_site_agents_last_execution ON site_agents(last_execution DESC);

-- 3. TABLA: agent_extractions
-- Almacena el historial de extracciones realizadas por cada agente
CREATE TABLE IF NOT EXISTS agent_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES site_agents(id) ON DELETE CASCADE,
  extracted_data JSONB DEFAULT '{}', -- Datos extraídos en formato JSON
  extraction_summary TEXT, -- Resumen de la extracción
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Metadatos adicionales
  execution_duration_ms INTEGER, -- Duración en milisegundos
  data_size_bytes INTEGER -- Tamaño aproximado de los datos extraídos
);

-- Índices para agent_extractions
CREATE INDEX IF NOT EXISTS idx_agent_extractions_agent_id ON agent_extractions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_extractions_executed_at ON agent_extractions(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_extractions_success ON agent_extractions(success);

-- ===================================================================
-- TRIGGERS PARA ACTUALIZAR TIMESTAMPS
-- ===================================================================

-- Trigger para actualizar last_updated en site_maps
CREATE OR REPLACE FUNCTION update_site_maps_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = NOW();
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_site_maps_updated_at
  BEFORE UPDATE ON site_maps
  FOR EACH ROW
  EXECUTE FUNCTION update_site_maps_updated_at();

-- ===================================================================
-- FUNCIONES AUXILIARES
-- ===================================================================

-- Función para obtener estadísticas de un agente
CREATE OR REPLACE FUNCTION get_agent_stats(agent_uuid UUID)
RETURNS TABLE (
  total_executions BIGINT,
  successful_executions BIGINT,
  failed_executions BIGINT,
  last_successful_execution TIMESTAMP WITH TIME ZONE,
  avg_execution_duration_ms NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_executions,
    COUNT(*) FILTER (WHERE success = true) as successful_executions,
    COUNT(*) FILTER (WHERE success = false) as failed_executions,
    MAX(executed_at) FILTER (WHERE success = true) as last_successful_execution,
    AVG(execution_duration_ms) as avg_execution_duration_ms
  FROM agent_extractions 
  WHERE agent_id = agent_uuid;
END;
$$ LANGUAGE plpgsql;

-- Función para limpiar extracciones antiguas (mantener solo últimas 100 por agente)
CREATE OR REPLACE FUNCTION cleanup_old_extractions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
  agent_record RECORD;
BEGIN
  -- Para cada agente, mantener solo las últimas 100 extracciones
  FOR agent_record IN SELECT DISTINCT agent_id FROM agent_extractions LOOP
    WITH old_extractions AS (
      SELECT id FROM agent_extractions 
      WHERE agent_id = agent_record.agent_id 
      ORDER BY executed_at DESC 
      OFFSET 100
    )
    DELETE FROM agent_extractions 
    WHERE id IN (SELECT id FROM old_extractions);
    
    GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;
  END LOOP;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ===================================================================
-- POLÍTICAS RLS (ROW LEVEL SECURITY)
-- ===================================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE site_maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_extractions ENABLE ROW LEVEL SECURITY;

-- Políticas para site_maps
CREATE POLICY "Users can view own site maps" ON site_maps
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own site maps" ON site_maps
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own site maps" ON site_maps
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own site maps" ON site_maps
  FOR DELETE USING (auth.uid() = user_id);

-- Políticas para site_agents
CREATE POLICY "Users can view own site agents" ON site_agents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own site agents" ON site_agents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own site agents" ON site_agents
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own site agents" ON site_agents
  FOR DELETE USING (auth.uid() = user_id);

-- Políticas para agent_extractions (solo pueden ver extracciones de sus propios agentes)
CREATE POLICY "Users can view extractions from own agents" ON agent_extractions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM site_agents 
      WHERE site_agents.id = agent_extractions.agent_id 
      AND site_agents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert extractions for own agents" ON agent_extractions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM site_agents 
      WHERE site_agents.id = agent_extractions.agent_id 
      AND site_agents.user_id = auth.uid()
    )
  );

-- ===================================================================
-- DATOS DE EJEMPLO (OPCIONAL - COMENTADO)
-- ===================================================================

/*
-- Ejemplo de mapa de sitio
INSERT INTO site_maps (user_id, site_name, base_url, exploration_goal, site_structure, navigation_summary) 
VALUES (
  auth.uid(),
  'Ejemplo.com',
  'https://ejemplo.com',
  'Explorar estructura general del sitio',
  '{"sections": ["header", "main", "footer"], "navigation": ["inicio", "productos", "contacto"]}',
  '# Estructura del Sitio\n\nEl sitio tiene una navegación principal con tres secciones...'
);

-- Ejemplo de agente
INSERT INTO site_agents (user_id, site_map_id, agent_name, extraction_target)
VALUES (
  auth.uid(),
  (SELECT id FROM site_maps WHERE site_name = 'Ejemplo.com' AND user_id = auth.uid() LIMIT 1),
  'Extractor de Noticias',
  'Extraer títulos, fechas y enlaces de todas las noticias de la página principal'
);
*/

-- ===================================================================
-- COMENTARIOS Y DOCUMENTACIÓN
-- ===================================================================

COMMENT ON TABLE site_maps IS 'Mapas de sitios web explorados inicialmente con WebAgent';
COMMENT ON TABLE site_agents IS 'Agentes configurados para extraer información específica de sitios mapeados';
COMMENT ON TABLE agent_extractions IS 'Historial de extracciones realizadas por cada agente';

COMMENT ON COLUMN site_maps.site_structure IS 'Estructura JSON del sitio explorado con navegación, secciones, etc.';
COMMENT ON COLUMN site_maps.navigation_summary IS 'Resumen en markdown de la exploración inicial';
COMMENT ON COLUMN site_agents.extraction_target IS 'Descripción detallada de qué información debe extraer el agente';
COMMENT ON COLUMN site_agents.extraction_config IS 'Configuración JSON específica del agente (frecuencia, filtros, etc.)';
COMMENT ON COLUMN agent_extractions.extracted_data IS 'Datos extraídos en formato JSON estructurado';

-- ===================================================================
-- FIN DE LA MIGRACIÓN
-- ===================================================================

-- Verificar que las tablas fueron creadas correctamente
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'site_maps') AND
     EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'site_agents') AND
     EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agent_extractions') THEN
    RAISE NOTICE 'Migración completada exitosamente: Sistema de Mapas de Sitios y Agentes creado';
  ELSE
    RAISE EXCEPTION 'Error en la migración: No se pudieron crear todas las tablas necesarias';
  END IF;
END $$;







