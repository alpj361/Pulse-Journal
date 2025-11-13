# 🔄 Diagramas de Flujo: Sistema de Codex Reestructurado

## 📐 Arquitectura General

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PULSE JOURNAL ECOSYSTEM                      │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────┐          ┌──────────────────┐          ┌──────────────────┐
│   MobileApp      │          │   ExtractorW     │          │   ThePulse       │
│   (React Native) │◄────────►│   (Backend)      │◄────────►│   (Frontend)     │
└──────────────────┘          └──────────────────┘          └──────────────────┘
        │                              │                              │
        │                              ▼                              │
        │                     ┌──────────────────┐                   │
        └────────────────────►│    Supabase      │◄──────────────────┘
                              │  (PostgreSQL)    │
                              └──────────────────┘
                                      │
                              ┌───────┴────────┐
                              │  codex_items   │
                              └────────────────┘
```

---

## 🗄️ Estructura de Datos en Supabase

```
┌─────────────────────────────────────────────────────────────────────┐
│                        codex_items TABLE                             │
├─────────────────────────────────────────────────────────────────────┤
│ CAMPOS PRINCIPALES                                                   │
│ • id (UUID)                                                          │
│ • user_id (UUID)                                                     │
│ • titulo (TEXT)                                                      │
│ • descripcion (TEXT)                                                 │
│ • url (TEXT)                                                         │
│ • created_at (TIMESTAMP)                                             │
├─────────────────────────────────────────────────────────────────────┤
│ ⭐ NUEVOS CAMPOS DE CATEGORIZACIÓN                                   │
│ • category (TEXT)        → 'general' | 'monitoring'                 │
│ • subcategory (TEXT)     → Ver lista abajo                          │
│ • source_type (TEXT)     → 'manual' | 'bookmark' | 'activity' ...  │
│ • metadata (JSONB)       → Info específica por tipo                 │
├─────────────────────────────────────────────────────────────────────┤
│ CAMPOS LEGACY (mantener compatibilidad)                             │
│ • tipo (TEXT)                                                        │
│ • likes, comments, shares, views (INTEGER)                          │
│ • etiquetas (TEXT[])                                                 │
│ • proyecto (TEXT)                                                    │
│ • project_id (UUID)                                                  │
│ • storage_path (TEXT)                                                │
│ • recent_scrape_id (UUID)                                            │
└─────────────────────────────────────────────────────────────────────┘

SUBCATEGORIES:
┌─────────────────────────────┐  ┌─────────────────────────────┐
│  📁 GENERAL                 │  │  📊 MONITORING              │
├─────────────────────────────┤  ├─────────────────────────────┤
│  • document                 │  │  • bookmark                 │
│  • audio                    │  │  • activity                 │
│  • video                    │  │  • internal_spreadsheet     │
│  • external_spreadsheet     │  │                             │
└─────────────────────────────┘  └─────────────────────────────┘
```

---

## 📱 Flujo 1: Guardar Bookmark desde MobileApp

```
┌─────────────────────────────────────────────────────────────────────┐
│ PASO 1: Usuario Guarda Tweet                                        │
└─────────────────────────────────────────────────────────────────────┘

MobileApp: Usuario copia URL de Twitter
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ improved-link-processor.ts                                      │
├─────────────────────────────────────────────────────────────────┤
│ 1. detectPlatform(url) → 'twitter'                             │
│ 2. extractTwitterTitle(html) → "Tesla Model Y..."             │
│ 3. extractTwitterDescription(html) → "Production update..."    │
│ 4. extractXEngagementAndContent(url) →                         │
│    {                                                            │
│      engagement: { likes: 15K, comments: 350, ... }           │
│      author: '@elonmusk'                                       │
│      text: "Tesla Model Y production..."                       │
│    }                                                            │
│ 5. extractPostId(url, 'twitter') → '1234567890'               │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ savedStore.addSavedItem()                                       │
├─────────────────────────────────────────────────────────────────┤
│ SavedItem {                                                     │
│   url: "https://twitter.com/elonmusk/status/1234567890"       │
│   title: "Tesla Model Y production update"                     │
│   description: "Production ramping up..."                       │
│   platform: 'twitter'                                          │
│   author: '@elonmusk'                                          │
│   engagement: { likes: 15K, comments: 350, ... }              │
│   source: 'clipboard'                                          │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
    │
    │ Usuario hace tap en "Guardar a Codex"
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ codexService.saveLinkToCodex()                                  │
├─────────────────────────────────────────────────────────────────┤
│ 1. determineCategory(item) → 'monitoring'                      │
│ 2. determineSubcategory(item) → 'bookmark'                     │
│ 3. mapSourceToSourceType('clipboard') → 'bookmark'            │
│ 4. buildMetadata(item) → {                                     │
│      platform: 'twitter',                                      │
│      author: '@elonmusk',                                      │
│      post_id: '1234567890',                                    │
│      engagement: { likes: 15K, ... }                           │
│    }                                                            │
└─────────────────────────────────────────────────────────────────┘
    │
    │ POST /api/codex/save-link-pulse
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ ExtractorW: /api/codex/save-link-pulse                         │
├─────────────────────────────────────────────────────────────────┤
│ const codexItemData = {                                        │
│   user_id: userId,                                             │
│   category: 'monitoring',                                      │
│   subcategory: 'bookmark',                                     │
│   source_type: 'bookmark',                                     │
│   tipo: 'tweet', // legacy                                     │
│   titulo: "Tesla Model Y production update",                   │
│   descripcion: "Production ramping up...",                     │
│   url: "https://twitter.com/...",                             │
│   metadata: {                                                   │
│     platform: 'twitter',                                       │
│     author: '@elonmusk',                                       │
│     post_id: '1234567890',                                     │
│     engagement: { likes: 15K, comments: 350, ... }            │
│   },                                                            │
│   // Legacy fields                                             │
│   likes: 15000,                                                │
│   comments: 350,                                               │
│   shares: 2500,                                                │
│   views: 1000000                                               │
│ }                                                               │
│                                                                 │
│ supabase.from('codex_items').insert([codexItemData])          │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Supabase: codex_items                                           │
├─────────────────────────────────────────────────────────────────┤
│ INSERT INTO codex_items (                                      │
│   id, user_id, category, subcategory, source_type,            │
│   titulo, descripcion, url, metadata, ...                      │
│ )                                                               │
│ RETURNING *                                                     │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ MobileApp: Actualizar SavedItem con codex_id                   │
├─────────────────────────────────────────────────────────────────┤
│ savedStore.setCodexId(item.id, result.id)                     │
│ → SavedItem.codex_id = "abc-123-..."                          │
│ → UI muestra badge "✓ En Codex"                               │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ ThePulse: Ver en Codex                                          │
├─────────────────────────────────────────────────────────────────┤
│ Usuario abre ThePulse → Enhanced Codex                         │
│ Selecciona filtro: "📊 Monitoreos" > "📌 Posts Guardados"     │
│                                                                 │
│ ┌────────────────────────────────────────────┐                │
│ │ 🐦 @elonmusk                               │                │
│ │ "Tesla Model Y production update"          │                │
│ │ Production ramping up...                   │                │
│ │                                            │                │
│ │ ❤️ 15K  💬 350  🔁 2.5K  👁️ 1M             │                │
│ │ [Ver post original]                        │                │
│ └────────────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 Flujo 2: Guardar Actividad desde ThePulse

```
┌─────────────────────────────────────────────────────────────────────┐
│ PASO 1: Usuario Hace Scrape en ThePulse                             │
└─────────────────────────────────────────────────────────────────────┘

ThePulse: Usuario busca "#argentina" en Vizta Chat
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ ExtractorW: /api/vizta/chat                                     │
├─────────────────────────────────────────────────────────────────┤
│ 1. Detecta intent → 'nitter_context'                           │
│ 2. Scrape tweets con #argentina                                │
│ 3. Analiza sentimiento → 'positive' (60% positivo)             │
│ 4. Guarda en recent_scrapes:                                   │
│    {                                                            │
│      query_original: '#argentina',                             │
│      herramienta: 'nitter_context',                            │
│      tweet_count: 45,                                           │
│      sentimiento: 'positive'                                    │
│    }                                                            │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ ThePulse: RecentActivity                                        │
├─────────────────────────────────────────────────────────────────┤
│ Usuario ve los resultados:                                      │
│                                                                 │
│ ┌────────────────────────────────────────────┐                │
│ │ 📊 Scrape: #argentina                      │                │
│ │ • 45 tweets encontrados                    │                │
│ │ • Sentimiento: Positivo (60%)              │                │
│ │ • Herramienta: nitter_context              │                │
│ │                                            │                │
│ │ [Ver resultados] [💾 Guardar a Codex]     │                │
│ └────────────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────────┘
    │
    │ Usuario hace click en "💾 Guardar a Codex"
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ ThePulse: Preparar datos de actividad                          │
├─────────────────────────────────────────────────────────────────┤
│ const activityData = {                                         │
│   query: '#argentina',                                         │
│   type: 'hashtag',                                             │
│   sentiment: 'positive',                                       │
│   tweet_count: 45,                                             │
│   scrape_id: 'recent-scrape-id-123',                          │
│   title: 'Monitoreo: #argentina',                             │
│   description: 'Análisis de sentimiento del hashtag',         │
│   time_range: '2025-01-20 to 2025-01-22'                      │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
    │
    │ POST /api/codex/save-activity
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ ExtractorW: /api/codex/save-activity                           │
├─────────────────────────────────────────────────────────────────┤
│ const codexItemData = {                                        │
│   user_id: userId,                                             │
│   category: 'monitoring',                                      │
│   subcategory: 'activity',                                     │
│   source_type: 'activity',                                     │
│   tipo: 'actividad', // legacy                                 │
│   titulo: 'Monitoreo: #argentina',                            │
│   descripcion: 'Análisis de sentimiento del hashtag',         │
│   recent_scrape_id: 'recent-scrape-id-123',                   │
│   metadata: {                                                   │
│     activity_type: 'hashtag',                                  │
│     activity_query: '#argentina',                             │
│     sentiment: 'positive',                                     │
│     tweet_count: 45,                                           │
│     time_range: '2025-01-20 to 2025-01-22',                   │
│     platform: 'twitter'                                        │
│   }                                                             │
│ }                                                               │
│                                                                 │
│ supabase.from('codex_items').insert([codexItemData])          │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Supabase: codex_items + recent_scrapes (JOIN)                  │
├─────────────────────────────────────────────────────────────────┤
│ codex_items:                                                    │
│ • id, user_id, category: 'monitoring',                        │
│   subcategory: 'activity', metadata: {...}                     │
│ • recent_scrape_id → FK a recent_scrapes                      │
│                                                                 │
│ recent_scrapes:                                                 │
│ • Contiene los 45 tweets originales                           │
│ • Sentimiento detallado por tweet                             │
│ • Metadata del scrape                                          │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ ThePulse: Ver en Codex                                          │
├─────────────────────────────────────────────────────────────────┤
│ Usuario abre Enhanced Codex                                    │
│ Selecciona filtro: "📊 Monitoreos" > "📈 Actividad"           │
│                                                                 │
│ ┌────────────────────────────────────────────┐                │
│ │ 📊 Monitoreo: #argentina                   │                │
│ │ Query: #argentina                          │                │
│ │ 🔖 hashtag                                 │                │
│ │ 😊 Sentimiento: Positivo                   │                │
│ │ 📊 45 tweets                               │                │
│ │ 📅 20-22 Enero 2025                        │                │
│ │                                            │                │
│ │ [Ver análisis completo]                    │                │
│ └────────────────────────────────────────────┘                │
│                                                                 │
│ Click "Ver análisis completo" →                               │
│ Redirige a RecentActivity con scrape_id                       │
│ Muestra los 45 tweets originales                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎤 Flujo 3: Grabar Audio en MobileApp

```
┌─────────────────────────────────────────────────────────────────────┐
│ PASO 1: Usuario Graba Audio                                         │
└─────────────────────────────────────────────────────────────────────┘

MobileApp: RecordingScreen
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ recordingStore.startRecording()                                 │
├─────────────────────────────────────────────────────────────────┤
│ 1. Expo AV inicia grabación                                    │
│ 2. Usuario habla: "Recordatorio para la reunión de mañana..." │
│ 3. Usuario detiene grabación                                   │
│ 4. Guardar audio en local storage                              │
│    → uri: 'file:///...recording-123.m4a'                       │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Transcripción con Whisper (ExtractorW)                         │
├─────────────────────────────────────────────────────────────────┤
│ POST /api/transcription/transcribe                             │
│ FormData: { audio: file }                                      │
│                                                                 │
│ ExtractorW:                                                     │
│ 1. Recibe audio file                                           │
│ 2. Envía a OpenAI Whisper API                                  │
│ 3. Recibe transcripción:                                       │
│    "Recordatorio para la reunión de mañana con el equipo      │
│     de marketing a las 3pm. Discutir estrategia Q2."          │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ recordingStore.saveRecording()                                  │
├─────────────────────────────────────────────────────────────────┤
│ Recording {                                                     │
│   id: 'rec-123',                                               │
│   title: 'Grabación 20 Enero 2025',                           │
│   uri: 'file:///...recording-123.m4a',                        │
│   duration: 45, // segundos                                    │
│   timestamp: 1737345600000,                                    │
│   transcription: "Recordatorio para la reunión..."            │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
    │
    │ Auto-save a Codex si conectado
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ codexService.saveRecordingToCodex()                             │
├─────────────────────────────────────────────────────────────────┤
│ const recording_data = {                                       │
│   title: 'Grabación 20 Enero 2025',                           │
│   duration: 45,                                                │
│   transcription: "Recordatorio para la reunión...",           │
│   timestamp: 1737345600000,                                    │
│   audio_uri: 'file:///...recording-123.m4a'                   │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
    │
    │ POST /api/codex/save-recording-pulse
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ ExtractorW: /api/codex/save-recording-pulse                    │
├─────────────────────────────────────────────────────────────────┤
│ 1. Upload audio file a Supabase Storage                       │
│    → storage_path: 'codex/user-id/audio/recording-123.m4a'   │
│                                                                 │
│ 2. Insert en codex_items:                                      │
│    const codexItemData = {                                     │
│      user_id: userId,                                          │
│      category: 'general',                                      │
│      subcategory: 'audio',                                     │
│      source_type: 'upload',                                    │
│      tipo: 'audio', // legacy                                  │
│      titulo: 'Grabación 20 Enero 2025',                       │
│      descripcion: 'Grabación de audio',                       │
│      storage_path: 'codex/.../recording-123.m4a',             │
│      audio_transcription: "Recordatorio para...",             │
│      tamano: 512000, // bytes                                  │
│      metadata: {                                               │
│        duration: 45,                                           │
│        audio_format: 'm4a',                                    │
│        transcription_available: true                           │
│      }                                                          │
│    }                                                            │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Supabase: codex_items + Storage                                │
├─────────────────────────────────────────────────────────────────┤
│ codex_items:                                                    │
│ • INSERT nuevo item con category: 'general',                  │
│   subcategory: 'audio'                                         │
│                                                                 │
│ Storage Bucket (codex):                                        │
│ • /user-id/audio/recording-123.m4a                            │
│ • Accessible via signed URL                                    │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ MobileApp: Agregar a SavedStore                                │
├─────────────────────────────────────────────────────────────────┤
│ savedStore.addSavedItem({                                      │
│   url: 'file:///...recording-123.m4a',                        │
│   title: 'Grabación 20 Enero 2025',                           │
│   description: 'Recordatorio para la reunión...',             │
│   type: 'audio',                                               │
│   platform: 'audio',                                           │
│   source: 'manual',                                            │
│   codex_id: 'abc-123-...' // from backend response            │
│ })                                                              │
│                                                                 │
│ → Aparece en SavedScreen con badge "✓ En Codex"               │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ ThePulse: Ver en Codex                                          │
├─────────────────────────────────────────────────────────────────┤
│ Usuario abre Enhanced Codex                                    │
│ Selecciona filtro: "📁 General" > "🎤 Audios"                 │
│                                                                 │
│ ┌────────────────────────────────────────────┐                │
│ │ 🎤 Grabación 20 Enero 2025                 │                │
│ │ Grabación de audio                         │                │
│ │                                            │                │
│ │ ⏱️ 45s  📁 m4a  ✓ Transcripción            │                │
│ │                                            │                │
│ │ ▶️ [Audio Player]                          │                │
│ │ ───────────●──────────                     │                │
│ │                                            │                │
│ │ 📝 Transcripción:                          │                │
│ │ "Recordatorio para la reunión de mañana   │                │
│ │  con el equipo de marketing a las 3pm.    │                │
│ │  Discutir estrategia Q2."                 │                │
│ └────────────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎨 Flujo 4: Visualización en ThePulse

```
┌─────────────────────────────────────────────────────────────────────┐
│ ThePulse: EnhancedCodex Component                                   │
└─────────────────────────────────────────────────────────────────────┘

Usuario abre Enhanced Codex
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ EnhancedCodex.tsx                                               │
├─────────────────────────────────────────────────────────────────┤
│ const [selectedCategory, setSelectedCategory] = 'all'          │
│ const [selectedSubcategory, setSelectedSubcategory] = 'all'    │
│                                                                 │
│ useEffect(() => {                                              │
│   fetchCodexItems(selectedCategory, selectedSubcategory)       │
│ }, [selectedCategory, selectedSubcategory])                    │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Supabase Query con Filtros                                     │
├─────────────────────────────────────────────────────────────────┤
│ let query = supabase                                           │
│   .from('codex_items')                                         │
│   .select('*')                                                 │
│   .eq('user_id', user.id)                                      │
│                                                                 │
│ if (selectedCategory !== 'all')                                │
│   query = query.eq('category', selectedCategory)              │
│                                                                 │
│ if (selectedSubcategory !== 'all')                             │
│   query = query.eq('subcategory', selectedSubcategory)        │
│                                                                 │
│ query.order('created_at', { ascending: false })                │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Renderizar UI con Filtros                                      │
├─────────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────┐                 │
│ │ 🗂️ Codex                                  │                 │
│ ├───────────────────────────────────────────┤                 │
│ │ Filtros:                                  │                 │
│ │ [Todos] [📁 General] [📊 Monitoreos]     │ ← chips         │
│ ├───────────────────────────────────────────┤                 │
│ │ [Todos] [📄 Docs] [🎤 Audio] [🎬 Video]  │ ← subfilters    │
│ ├───────────────────────────────────────────┤                 │
│ │                                           │                 │
│ │ ┌─────────────────────────────────────┐  │                 │
│ │ │ CodexItemCard                       │  │                 │
│ │ │ → renderCardBySubcategory()        │  │                 │
│ │ │                                     │  │                 │
│ │ │ if (subcategory === 'bookmark')     │  │                 │
│ │ │   return <BookmarkCard />          │  │                 │
│ │ │ else if (subcategory === 'activity')│  │                 │
│ │ │   return <ActivityCard />          │  │                 │
│ │ │ else if (subcategory === 'audio')   │  │                 │
│ │ │   return <AudioCard />              │  │                 │
│ │ │ ...                                 │  │                 │
│ │ └─────────────────────────────────────┘  │                 │
│ │                                           │                 │
│ └───────────────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Ejemplo: BookmarkCard                                           │
├─────────────────────────────────────────────────────────────────┤
│ function BookmarkCard({ item }) {                              │
│   const metadata = item.metadata || {}                         │
│                                                                 │
│   return (                                                      │
│     <Card>                                                      │
│       <CardContent>                                            │
│         <Typography variant="h6">{item.titulo}</Typography>   │
│         <Typography variant="body2">                           │
│           {item.descripcion}                                   │
│         </Typography>                                          │
│                                                                 │
│         {/* Platform Badge */}                                 │
│         <Chip                                                  │
│           label={metadata.platform}                            │
│           icon={getPlatformIcon(metadata.platform)}           │
│         />                                                      │
│                                                                 │
│         {/* Author */}                                         │
│         <Typography variant="caption">                         │
│           Por: {metadata.author}                              │
│         </Typography>                                          │
│                                                                 │
│         {/* Engagement Metrics */}                             │
│         <Box sx={{ display: 'flex', gap: 2 }}>                │
│           <Typography>❤️ {metadata.engagement.likes}</Typography> │
│           <Typography>💬 {metadata.engagement.comments}</Typography> │
│           <Typography>🔁 {metadata.engagement.shares}</Typography> │
│           <Typography>👁️ {metadata.engagement.views}</Typography> │
│         </Box>                                                  │
│                                                                 │
│         {/* Link */}                                           │
│         <Button href={item.url} target="_blank">              │
│           Ver post original                                    │
│         </Button>                                              │
│       </CardContent>                                           │
│     </Card>                                                     │
│   )                                                             │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Migración de Datos Existentes

```
┌─────────────────────────────────────────────────────────────────────┐
│ Script de Migración SQL                                              │
└─────────────────────────────────────────────────────────────────────┘

PASO 1: Agregar columnas
    ↓
ALTER TABLE codex_items ADD COLUMN category, subcategory, source_type, metadata

PASO 2: Crear indices
    ↓
CREATE INDEX idx_codex_items_category, idx_codex_items_subcategory, ...

PASO 3: Iterar sobre items existentes
    ↓
┌─────────────────────────────────────────────────────────────────┐
│ Para cada item en codex_items:                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ IF tipo IN ('tweet', 'instagram', 'tiktok') AND url IS NOT NULL│
│   → category: 'monitoring'                                     │
│   → subcategory: 'bookmark'                                    │
│   → source_type: 'bookmark'                                    │
│   → metadata: {                                                │
│       platform: detectar de URL,                              │
│       post_id: extraer de URL,                                │
│       engagement: { likes, comments, shares, views }          │
│     }                                                           │
│                                                                 │
│ ELSE IF recent_scrape_id IS NOT NULL                           │
│   → category: 'monitoring'                                     │
│   → subcategory: 'activity'                                    │
│   → source_type: 'activity'                                    │
│   → metadata: { activity_type, platform }                     │
│                                                                 │
│ ELSE IF tipo = 'audio'                                         │
│   → category: 'general'                                        │
│   → subcategory: 'audio'                                       │
│   → source_type: 'upload' if storage_path else 'manual'       │
│   → metadata: { transcription_available }                     │
│                                                                 │
│ ELSE IF tipo IN ('video', 'youtube')                           │
│   → category: 'general'                                        │
│   → subcategory: 'video'                                       │
│   → source_type: 'upload' if storage_path else 'manual'       │
│                                                                 │
│ ELSE IF tipo IN ('excel', 'csv', 'spreadsheet')                │
│   → category: 'general'                                        │
│   → subcategory: 'external_spreadsheet'                        │
│   → source_type: 'upload' if storage_path else 'manual'       │
│                                                                 │
│ ELSE (default)                                                  │
│   → category: 'general'                                        │
│   → subcategory: 'document'                                    │
│   → source_type: 'manual'                                      │
│   → metadata: { file_format: tipo }                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

PASO 4: Verificar migración
    ↓
SELECT category, subcategory, COUNT(*)
FROM codex_items
GROUP BY category, subcategory

RESULTADO ESPERADO:
┌─────────────┬──────────────────────┬────────┐
│ category    │ subcategory          │ count  │
├─────────────┼──────────────────────┼────────┤
│ general     │ document             │   45   │
│ general     │ audio                │   12   │
│ general     │ video                │    8   │
│ general     │ external_spreadsheet │    3   │
│ monitoring  │ bookmark             │   89   │
│ monitoring  │ activity             │   24   │
└─────────────┴──────────────────────┴────────┘
```

---

## ✅ Verificación de Implementación

```
┌─────────────────────────────────────────────────────────────────────┐
│ Checklist de Testing                                                │
└─────────────────────────────────────────────────────────────────────┘

[ ] 1. BASE DE DATOS
    ├─ [ ] Migración SQL ejecutada sin errores
    ├─ [ ] Todas las columnas creadas correctamente
    ├─ [ ] Indices funcionando (verificar EXPLAIN ANALYZE)
    ├─ [ ] Constraints validando datos
    └─ [ ] Datos existentes migrados correctamente

[ ] 2. BACKEND (ExtractorW)
    ├─ [ ] /api/codex/save-link categoriza correctamente
    │   ├─ [ ] Bookmarks de Twitter → monitoring/bookmark
    │   ├─ [ ] Bookmarks de Instagram → monitoring/bookmark
    │   └─ [ ] URLs genéricas → general/document
    ├─ [ ] /api/codex/save-activity funciona
    ├─ [ ] /api/codex/save-recording-pulse funciona
    └─ [ ] Metadata JSONB se guarda correctamente

[ ] 3. MOBILEAPP
    ├─ [ ] SavedItem interface actualizada
    ├─ [ ] codexService.saveLinkToCodex() funciona
    │   ├─ [ ] Tweets se guardan correctamente
    │   ├─ [ ] Instagram posts se guardan correctamente
    │   └─ [ ] Audios se guardan correctamente
    ├─ [ ] SavedItemCard muestra badge "En Codex"
    └─ [ ] Backward compatibility con items antiguos

[ ] 4. THEPULSE
    ├─ [ ] Filtros visuales funcionan
    │   ├─ [ ] Filtro por category (General/Monitoreos)
    │   └─ [ ] Filtro por subcategory
    ├─ [ ] Cards específicos renderizan correctamente
    │   ├─ [ ] BookmarkCard muestra engagement
    │   ├─ [ ] ActivityCard muestra sentiment
    │   └─ [ ] AudioCard muestra player
    └─ [ ] Performance aceptable (< 200ms queries)

[ ] 5. END-TO-END
    ├─ [ ] Usuario guarda tweet en MobileApp → aparece en ThePulse
    ├─ [ ] Usuario guarda actividad en ThePulse → aparece categorizado
    ├─ [ ] Usuario graba audio → aparece en ambos lados
    └─ [ ] Filtros funcionan en tiempo real

[ ] 6. PERFORMANCE
    ├─ [ ] Queries con indices < 200ms
    ├─ [ ] Carga de Codex < 1 segundo
    └─ [ ] No hay N+1 queries

[ ] 7. DEPLOYMENT
    ├─ [ ] Migración en staging exitosa
    ├─ [ ] Testing en staging completo
    ├─ [ ] Migración en producción planeada
    └─ [ ] Monitoreo post-deploy configurado
```

---

**Archivo:** CODEX_FLOW_DIAGRAMS.md  
**Fecha:** 2025-01-XX  
**Versión:** 1.0


