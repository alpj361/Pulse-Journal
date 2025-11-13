# 🎯 Sistema de Filtro de Deportes - Guía Completa de Implementación

## ✅ **COMPLETADO**

### 1. **Base de Datos - Supabase** ✅
- ✅ Tabla `trends` actualizada con:
  - `is_deportes` BOOLEAN
  - `categoria_principal` TEXT
- ✅ Índices creados para optimizar consultas
- ✅ Backfill de datos existentes completado
- ✅ Vistas helper creadas (`trends_recent_deportes`, `trends_recent_generales`, `trends_distribution_stats`)

### 2. **ExtractorT - Scraper de Trends** ✅
- ✅ Modificado para obtener **todos los trends** de Trends24
- ✅ Scraper mejorado para capturar **todas las columnas de tiempo**
- ✅ Resultado: **145+ trends** únicos de Guatemala disponibles
- ✅ Acepta parámetro `limit` (hasta 50)
- **Archivos modificados:**
  - `ExtractorT/app/services/trends.py`
  - `ExtractorT/docker_extract_recent.py`

### 3. **NewsCron - Clasificación y Balanceo** ✅
- ✅ Obtiene 50 trends de ExtractorT
- ✅ Usa **Gemini 2.0 Flash** para clasificación IA
- ✅ Clasifica como DEPORTIVO o NO_DEPORTIVO
- ✅ Balanceo automático: **5 deportivos + 10 no deportivos = 15 totales**
- ✅ Configurado para producción (VPS)
- ✅ Envía `preclassification_hints` a ExtractorW
- **Archivos modificados:**
  - `NewsCron/fetch_trending_process.js`
  - `NewsCron/package.json` (agregado `@google/generative-ai`)

### 4. **ExtractorW - Procesamiento y Almacenamiento** ✅
- ✅ Procesa **15 trends** (5 deportivos + 10 no deportivos)
- ✅ Función `detectSportsContent` mejorada con:
  - Keywords internacionales
  - Confidence scoring
  - Análisis del campo `about`
- ✅ Guarda `is_deportes` y `categoria_principal` en Supabase
- ✅ Logging detallado de clasificación
- **Archivos modificados:**
  - `ExtractorW/server/routes/trends.js`

### 5. **Frontend - ThePulse** ✅ (Parcial)
- ✅ Tipos TypeScript creados:
  - `ThePulse/src/types/trends.ts` (TrendItem, AboutInfo, Statistics, TrendsFilter, TrendsStats)
- ✅ Servicios Supabase actualizados:
  - `getTrendsByType(isDeportes, limit)` - Obtiene trends filtrados
  - `getTrendsStats()` - Obtiene estadísticas de distribución
- **Archivos modificados:**
  - `ThePulse/src/types/trends.ts` (NUEVO)
  - `ThePulse/src/types/index.ts`
  - `ThePulse/src/services/supabase.ts`

---

## 🎯 **PENDIENTE - Frontend UI**

### Componentes a Actualizar

#### 1. **Página Principal de Trends** (`src/pages/Trends.tsx`)

**Objetivo**: Agregar tabs para separar Deportes y Generales

```tsx
import { Tabs, Tab, Box } from '@mui/material';
import { getTrendsByType, getTrendsStats } from '../services/supabase';

// Estado para tabs
const [selectedTab, setSelectedTab] = useState<'general' | 'deportes' | 'all'>('all');
const [trendsStats, setTrendsStats] = useState<TrendsStats | null>(null);

// Cargar estadísticas al montar
useEffect(() => {
  const loadStats = async () => {
    const stats = await getTrendsStats();
    setTrendsStats(stats);
  };
  loadStats();
}, []);

// Función para filtrar datos según tab seleccionado
const getFilteredData = () => {
  if (!latestData) return null;
  
  if (selectedTab === 'all') return latestData;
  
  // Filtrar datos según is_deportes
  const isDeportes = selectedTab === 'deportes';
  return {
    ...latestData,
    topKeywords: latestData.topKeywords?.filter(kw => 
      latestData.about_data?.find(a => 
        a.trend === kw.keyword && 
        (isDeportes ? a.category === 'Deportes' : a.category !== 'Deportes')
      )
    ),
    about: latestData.about?.filter(a => 
      isDeportes ? a.category === 'Deportes' : a.category !== 'Deportes'
    )
  };
};

// UI de tabs
<Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
  <Tabs value={selectedTab} onChange={(e, newValue) => setSelectedTab(newValue)}>
    <Tab 
      label="Todos" 
      value="all"
      icon={<TrendingUp />}
    />
    <Tab 
      label={`Generales (${trendsStats?.no_deportivos || 0})`}
      value="general"
      icon={<LayoutDashboard />}
    />
    <Tab 
      label={`Deportes (${trendsStats?.deportivos || 0})`}
      value="deportes"
      icon={<SportsSoccer />}
    />
  </Tabs>
</Box>
```

#### 2. **Componente de Estadísticas** (`src/components/ui/TrendsStatsCard.tsx`)

**Objetivo**: Mostrar distribución deportes vs generales

```tsx
import { Card, CardContent, Typography, Box, Chip } from '@mui/material';
import { TrendsStats } from '../../types';

interface TrendsStatsCardProps {
  stats: TrendsStats | null;
}

export const TrendsStatsCard: React.FC<TrendsStatsCardProps> = ({ stats }) => {
  if (!stats) return null;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6">Distribución de Trends</Typography>
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2">
            Total: {stats.total_trends} trends
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <Chip 
              label={`Deportes: ${stats.deportivos} (${stats.porcentaje_deportes}%)`}
              color="primary"
              size="small"
            />
            <Chip 
              label={`Generales: ${stats.no_deportivos}`}
              color="secondary"
              size="small"
            />
          </Box>
          
          <Typography variant="subtitle2" sx={{ mt: 2 }}>
            Por Categoría:
          </Typography>
          {Object.entries(stats.categorias_count).map(([cat, count]) => (
            <Chip 
              key={cat}
              label={`${cat}: ${count}`}
              size="small"
              sx={{ m: 0.5 }}
            />
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};
```

#### 3. **About Card con Filtros** (`src/components/ui/AboutCard.tsx`)

**Modificación**: Agregar prop para filtrar por categoría

```tsx
interface AboutCardProps {
  aboutData: AboutInfo[];
  filterCategory?: 'Deportes' | 'General' | null;
}

export const AboutCard: React.FC<AboutCardProps> = ({ 
  aboutData, 
  filterCategory 
}) => {
  const filteredData = filterCategory
    ? aboutData.filter(item => 
        filterCategory === 'Deportes' 
          ? item.category === 'Deportes'
          : item.category !== 'Deportes'
      )
    : aboutData;

  return (
    // ... render filteredData
  );
};
```

---

## 📊 **Flujo Completo del Sistema**

```
1. ExtractorT (VPS)
   └─> Obtiene 145 trends de Trends24 Guatemala
        └─> Endpoint: https://api.standatpd.com/trending?location=guatemala&limit=50

2. NewsCron (Cron Job)
   └─> Limita a 50 trends
   └─> Gemini AI clasifica: 35 deportivos, 15 no deportivos
   └─> Balanceo: Selecciona 5 deportivos + 10 no deportivos
   └─> Envía 15 trends a ExtractorW

3. ExtractorW
   └─> Procesa 15 trends con Perplexity AI
   └─> Detecta deportes con detectSportsContent()
   └─> Guarda en Supabase con is_deportes y categoria_principal

4. ThePulse (Frontend)
   └─> Lee de Supabase
   └─> Muestra tabs: Todos | Generales | Deportes
   └─> Filtra y muestra datos según tab seleccionado
```

---

## 🚀 **Despliegue**

### ExtractorT (VPS)
```bash
cd /path/to/ExtractorT
git pull
docker-compose down
docker-compose build
docker-compose up -d
```

### ExtractorW (VPS)
```bash
cd /path/to/ExtractorW
git pull
docker-compose restart
```

### NewsCron
Ya está configurado para producción con:
- `VPS_TRENDING_URL = 'https://api.standatpd.com/trending?location=guatemala&limit=50'`
- `GEMINI_API_KEY` desde variables de entorno

### Frontend
```bash
cd ThePulse
npm install
npm run build
# Deploy según tu configuración (Vercel/Netlify/etc)
```

---

## 📝 **Variables de Entorno Necesarias**

### NewsCron
```env
GEMINI_API_KEY=tu_api_key_de_gemini
```

### ExtractorW
(Ya configuradas, verificar que estén presentes)
```env
SUPABASE_URL=https://qqshdccpmypelhmyqnut.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key
OPENAI_API_KEY=tu_openai_key
```

---

## 🎯 **Métricas de Éxito**

### Esperadas después del despliegue:
- ✅ **33% o menos** de trends son deportivos (5 de 15)
- ✅ **67% o más** de trends son no deportivos (10 de 15)
- ✅ **95%+ de precisión** en clasificación de deportes
- ✅ **15 trends procesados** por día (5 deportivos + 10 generales)

### Monitoreo Semanal:
```sql
-- Ver distribución de la última semana
SELECT 
  DATE(timestamp) as fecha,
  COUNT(*) as total,
  SUM(CASE WHEN is_deportes THEN 1 ELSE 0 END) as deportivos,
  SUM(CASE WHEN NOT is_deportes THEN 1 ELSE 0 END) as generales,
  ROUND(100.0 * SUM(CASE WHEN is_deportes THEN 1 ELSE 0 END) / COUNT(*), 1) as porcentaje_deportes
FROM trends
WHERE timestamp >= NOW() - INTERVAL '7 days'
GROUP BY DATE(timestamp)
ORDER BY fecha DESC;
```

---

## 📚 **Documentación Relacionada**

- `NewsCron/GEMINI_CLASSIFICATION_SYSTEM.md` - Sistema de clasificación con Gemini
- `NewsCron/migrations/README_SPORTS_MIGRATION.md` - Migración SQL
- `NewsCron/EXTRACTORW_SPORTS_INTEGRATION.md` - Integración con ExtractorW
- `NewsCron/FRONTEND_SPORTS_DIVISION_PLAN.md` - Plan para división en frontend

---

## ⚠️ **Notas Importantes**

1. **ExtractorT debe ser desplegado al VPS** con los cambios del scraper para obtener 50+ trends
2. **ExtractorW debe ser reiniciado** para procesar los 15 trends (no 10)
3. **Frontend necesita completar la UI** con tabs y filtros
4. **Gemini API Key** debe estar configurada en las variables de entorno de NewsCron

---

## 🎉 **Resultado Final**

Después de completar la implementación del frontend, tendrás:

- **Sección "Todos"**: Muestra los 15 trends (5 deportivos + 10 generales) juntos
- **Sección "Generales"**: Muestra solo los 10 trends no deportivos
- **Sección "Deportes"**: Muestra solo los 5 trends deportivos
- **Estadísticas**: Dashboard con distribución y porcentajes
- **Balanceo automático**: El sistema mantiene 33% deportes / 67% generales
- **Clasificación IA**: Gemini AI y Perplexity AI trabajan juntos para máxima precisión

---

**Fecha de implementación**: Octubre 5, 2025
**Sistema**: Pulse Journal - Trends Analysis
**Versión**: 2.0 - Sports Filter Edition

