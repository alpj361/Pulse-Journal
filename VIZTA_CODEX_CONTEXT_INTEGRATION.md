# 🧠 Vizta + Codex: Integración de Contexto Manual

## ✅ Implementación Completada

### Backend (ExtractorW)
- ✅ `codexEngine.js`: Función `getCodexItemsByIds()` creada
- ✅ `mcp.js`: Handler `executeUserCodexSpecific()` implementado
- ✅ `vizta/index.js`: Detección de `codex_item_ids` en parámetros

### Frontend (ThePulse)
- ✅ `CodexSelector.tsx`: Actualizado con filtros de categoría
- ✅ Soporte para Wiki items (👤 🏢 📍 📅 💡)
- ✅ Badges de categoría y metadata
- ✅ Iconos específicos por tipo

---

## 🎯 Cómo Funciona

### Flujo de Usuario

```
Usuario abre modal de contexto en Sondeos/Vizta
         ↓
Selecciona "📚 Codex" como fuente
         ↓
Ve filtros de categoría:
┌──────────────────────────────────────────┐
│ [Todos] [📁 General] [📊 Monitoreos] [📚 Wiki] │
└──────────────────────────────────────────┘
         ↓
Selecciona "📚 Wiki"
         ↓
Ve subfiltros:
┌──────────────────────────────────────────┐
│ [👤 Personas] [🏢 Orgs] [📍 Lugares]    │
│ [📅 Eventos] [💡 Conceptos]              │
└──────────────────────────────────────────┘
         ↓
Selecciona "👤 Personas"
         ↓
Ve lista de personas en su Wiki:
┌──────────────────────────────────────────┐
│ ☑ 👤 Bernardo Arévalo                   │
│    ⭐ Relevancia: 95/100                 │
│    🏛️ Movimiento Semilla                │
│    🔗 5 items relacionados               │
│                                          │
│ ☐ 👤 Consuelo Porras                    │
│    ⭐ Relevancia: 70/100                 │
│    🏛️ Ministerio Público                │
│    🔗 3 items relacionados               │
└──────────────────────────────────────────┘
         ↓
Hace click en checkbox de "Bernardo Arévalo"
         ↓
Item se agrega a selectedCodex: ["codex_abc-123"]
         ↓
Usuario hace pregunta en Vizta Chat
         ↓
Frontend envía a backend:
{
  message: "¿Qué opinas sobre las políticas de Bernardo?",
  codex_item_ids: ["codex_abc-123"],
  ...
}
         ↓
Backend (Vizta):
1. Detecta codex_item_ids en params
2. Llama a user_codex_specific
3. Robert obtiene items específicos
4. Formatea con metadata de Wiki
5. Vizta usa este contexto para responder
         ↓
Usuario recibe respuesta contextualizada:
"Basándome en tu Wiki sobre Bernardo Arévalo
(Presidente, Movimiento Semilla, Relevancia 95/100)..."
```

---

## 📝 Cambios Técnicos Realizados

### 1. CodexEngine (Robert)

**Archivo:** `server/services/agents/robert/codexEngine.js`

**Nueva función:**
```javascript
async getCodexItemsByIds(user, itemIds = []) {
  // Limpia prefijos "codex_"
  const cleanIds = itemIds.map(id => String(id).replace('codex_', ''));
  
  // Obtiene items por IDs con todos los campos nuevos
  const { data: codexItems } = await this.supabase
    .from('codex_items')
    .select(`
      id, titulo, descripcion, tipo, etiquetas, proyecto,
      url, storage_path, audio_transcription, document_analysis,
      content, created_at,
      category, subcategory, source_type, metadata
    `)
    .eq('user_id', user.id)
    .in('id', cleanIds);

  // Retorna con estadísticas
  return {
    codex: codexItems,
    total: codexItems.length,
    stats: {
      by_category: {...},
      by_subcategory: {...},
      wiki_items: count,
      monitoring_items: count,
      general_items: count
    }
  };
}
```

---

### 2. MCP Service

**Archivo:** `server/services/mcp.js`

**Nuevo handler:**
```javascript
case 'user_codex_specific':
  return await executeUserCodexSpecific(
    parameters.item_ids || [],
    user
  );
```

**Nueva función:**
```javascript
async function executeUserCodexSpecific(itemIds, user) {
  // Obtiene items específicos
  const result = await robertInstance.codexEngine.getCodexItemsByIds(user, itemIds);
  
  // Formatea para Vizta con iconos por categoría
  const formattedResponse = `CODEX PERSONAL (Selección Manual):

ITEMS SELECCIONADOS: ${result.total}
📚 Wiki: ${result.stats.wiki_items} items
📊 Monitoreos: ${result.stats.monitoring_items} items
📁 Archivos: ${result.stats.general_items} items

DETALLES:
${result.codex.map(item => `
${getCategoryIcon(item.category, item.subcategory)} ${item.titulo}
   Categoría: ${item.category} > ${item.subcategory}
   ${item.metadata?.relevance_score ? `⭐ Relevancia: ${item.metadata.relevance_score}/100` : ''}
   ${item.metadata?.political_party ? `🏛️ ${item.metadata.political_party}` : ''}
   ${item.descripcion}
`).join('\n\n')}`;

  return { ...result, formatted_response: formattedResponse };
}
```

---

### 3. Vizta Index

**Archivo:** `server/services/agents/vizta/index.js`

**Modificación en executeTool:**
```javascript
case 'user_codex':
  // ✨ NUEVO: Si se proporcionan codex_item_ids específicos, usarlos
  if (params.codex_item_ids && Array.isArray(params.codex_item_ids) && params.codex_item_ids.length > 0) {
    console.log(`[VIZTA] 🎯 Usando ${params.codex_item_ids.length} items específicos del Codex`);
    return await logAndExecute('user_codex_specific', {
      item_ids: params.codex_item_ids
    });
  }
  // Comportamiento normal: búsqueda general
  return await logAndExecute('user_codex', {
    query: params.query || cleanedMessage
  });
```

---

### 4. CodexSelector (Frontend)

**Archivo:** `ThePulse/src/components/ui/CodexSelector.tsx`

**Nuevas características:**
- ✅ Filtro por categoría (General, Monitoring, Wiki)
- ✅ Subfiltros dinámicos según categoría
- ✅ Iconos específicos para Wiki items (👤 🏢 📍 📅 💡)
- ✅ Badges de categoría en cada card
- ✅ Metadata de Wiki visible (relevancia, partido, relaciones)
- ✅ Metadata de Monitoring visible (sentiment, platform, tweet_count)

**Filtros UI:**
```tsx
// Categoría principal
[Todos] [📁 Archivos Generales] [📊 Monitoreos] [📚 Wiki]

// Subcategorías de Wiki (cuando Wiki está seleccionado)
[Todos] [👤 Personas] [🏢 Organizaciones] [📍 Lugares] [📅 Eventos] [💡 Conceptos]

// Subcategorías de Monitoring
[Todos] [📌 Posts Guardados] [📈 Actividad]

// Subcategorías de General
[Todos] [📄 Documentos] [🎤 Audios] [🎬 Videos] [📊 Spreadsheets]
```

---

## 💬 Ejemplos de Uso

### Ejemplo 1: Consultar sobre Político

```
Usuario:
1. Abre Vizta Chat
2. Click en botón de contexto
3. Selecciona "📚 Codex"
4. Filtra por "📚 Wiki" > "👤 Personas"
5. Selecciona "Bernardo Arévalo"
6. Pregunta: "¿Cuál es su posición sobre educación?"

Backend recibe:
{
  message: "¿Cuál es su posición sobre educación?",
  codex_item_ids: ["uuid-arevalo"]
}

Vizta ejecuta:
user_codex_specific → obtiene perfil completo de Arévalo

Contexto incluye:
👤 Bernardo Arévalo
   Categoría: wiki > wiki_person
   ⭐ Relevancia: 95/100
   🏛️ Movimiento Semilla
   💼 Presidente de Guatemala
   🔗 5 items relacionados

Respuesta de Vizta:
"Basándome en tu perfil de Wiki sobre Bernardo Arévalo (Presidente,
Movimiento Semilla, relevancia 95/100), y considerando su trayectoria
académica (PhD en Sociología)..."
```

---

### Ejemplo 2: Análisis con Evento + Organización

```
Usuario:
1. Selecciona de Wiki:
   - Caso Hogar Seguro (📅 evento)
   - Ministerio Público (🏢 organización)
2. Pregunta: "¿Cuál es el estado del caso?"

Backend recibe:
{
  message: "¿Cuál es el estado del caso?",
  codex_item_ids: ["uuid-caso", "uuid-mp"]
}

Contexto incluye:
📅 Caso Hogar Seguro
   Categoría: wiki > wiki_event
   📍 08 Mar 2017 → En curso
   🚨 Impacto: Alto
   👥 Participantes: Víctimas, Estado, MP

🏢 Ministerio Público
   Categoría: wiki > wiki_organization
   🏛️ Institución Gubernamental
   👥 Personas clave: Consuelo Porras

Respuesta de Vizta:
"Basándome en tu Wiki: El Caso Hogar Seguro (evento iniciado el
8 de marzo 2017, estado: en curso, impacto alto) está siendo manejado
por el Ministerio Público (institución gubernamental, fiscal general:
Consuelo Porras)..."
```

---

### Ejemplo 3: Análisis Político con Múltiples Fuentes

```
Usuario selecciona:
- Bernardo Arévalo (persona)
- Movimiento Semilla (organización)
- Elecciones 2023 (evento)
- Actividad guardada: "Scrape #semilla" (monitoring)

Backend recibe 4 codex_item_ids

Contexto incluye:
- Perfil completo de Arévalo (Wiki)
- Info de Movimiento Semilla (Wiki)
- Timeline de Elecciones 2023 (Wiki)
- 45 tweets sobre #semilla con sentiment positivo (Monitoring)

Respuesta de Vizta:
"Conectando los puntos de tu Codex: Bernardo Arévalo (Presidente,
relevancia 95) del Movimiento Semilla (partido, relevancia 90)
ganó las Elecciones 2023 (evento, impacto alto). Según tu monitoreo
de #semilla (45 tweets, sentimiento positivo 60%), la percepción
pública..."
```

---

## 🎨 Mejoras Visuales en Modal

### Vista del Modal de Contexto con Wiki

```
┌─────────────────────────────────────────────────────────┐
│  Selecciona Contexto                              [✕]   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ▼ 📚 Codex (3 seleccionados)                           │
│  ┌────────────────────────────────────────────────────┐│
│  │ Categoría:                                         ││
│  │ [Todos] [📁 General] [📊 Monitoreos] [📚 Wiki]    ││
│  │                                       ──────────   ││
│  │                                                     ││
│  │ Tipo de Wiki:                                       ││
│  │ [Todos] [👤 Personas] [🏢 Orgs] [📍 Lugares]       ││
│  │         ──────────                                  ││
│  │ [📅 Eventos] [💡 Conceptos]                         ││
│  │                                                     ││
│  │ [🔍 Buscar en Wiki...                          ]  ││
│  │                                                     ││
│  │ ─────────────────────────────────────────────────  ││
│  │                                                     ││
│  │ ✅ 3 items seleccionados:                          ││
│  │                                                     ││
│  │ ┌──────────────────────────────────────────────┐  ││
│  │ │ ☑ 👤 Bernardo Arévalo            ⭐95/100    │  ││
│  │ │    Presidente de Guatemala                   │  ││
│  │ │    🏛️ Movimiento Semilla                    │  ││
│  │ │    🔗 5 items relacionados                   │  ││
│  │ │    📅 Última mención: Hoy                    │  ││
│  │ └──────────────────────────────────────────────┘  ││
│  │                                                     ││
│  │ ┌──────────────────────────────────────────────┐  ││
│  │ │ ☑ 🏢 Movimiento Semilla          ⭐90/100    │  ││
│  │ │    Partido Político                          │  ││
│  │ │    👥 Bernardo Arévalo, Samuel Pérez         │  ││
│  │ │    🔗 8 items relacionados                   │  ││
│  │ └──────────────────────────────────────────────┘  ││
│  │                                                     ││
│  │ ┌──────────────────────────────────────────────┐  ││
│  │ │ ☑ 📅 Elecciones 2023             ⭐85/100    │  ││
│  │ │    Evento - Elección                         │  ││
│  │ │    📍 Ago 2023 → Completado                  │  ││
│  │ │    🚨 Impacto: Alto                          │  ││
│  │ └──────────────────────────────────────────────┘  ││
│  │                                                     ││
│  │ [Seleccionar todo] [Limpiar selección]             ││
│  └────────────────────────────────────────────────────┘│
│                                                          │
│  [Cancelar]                         [Aplicar Contexto]  │
└─────────────────────────────────────────────────────────┘
```

---

## 🔍 Respuesta de Vizta con Contexto de Wiki

### Sin Contexto Manual (antes)
```
Usuario: "¿Qué opinas de Bernardo Arévalo?"

Vizta: "Bernardo Arévalo es el actual Presidente de Guatemala.
Necesitaría más contexto para dar una opinión específica.
¿Sobre qué aspecto te gustaría que analice?"
```

### Con Contexto Manual (después)
```
Usuario: "¿Qué opinas de Bernardo Arévalo?"
[Con Wiki item de Bernardo Arévalo seleccionado]

Vizta: "Basándome en tu perfil de Wiki sobre Bernardo Arévalo:

📊 CONTEXTO DE TU CODEX:
• Presidente de Guatemala (desde 2024)
• Movimiento Semilla (partido político)
• Relevancia en tu investigación: 95/100
• 5 items relacionados en tu Codex

Bernardo Arévalo representa un cambio significativo en la política
guatemalteca. Como fundador de Movimiento Semilla, su llegada a la
presidencia marca una transición hacia políticas de transparencia
y anticorrupción.

Conectando con tu investigación (según tu Codex), veo que has
monitoreado activamente su actividad (45 posts guardados) y
tienes documentación sobre Movimiento Semilla, lo que sugiere
que es una figura central en tu análisis político..."
```

---

## 🎨 Metadata Visible por Tipo

### Wiki - Personas
```
☑ 👤 Bernardo Arévalo
   Presidente de Guatemala
   ⭐ Relevancia: 95/100
   🏛️ Movimiento Semilla
   🐦 @BArevalodeLeon
   🔗 5 items relacionados
   📅 Última mención: Hoy
```

### Wiki - Organizaciones
```
☑ 🏢 Movimiento Semilla
   Partido Político
   ⭐ Relevancia: 90/100
   📅 Fundado: 2014
   👥 15 miembros clave
   🔗 8 items relacionados
```

### Wiki - Eventos
```
☑ 📅 Caso Hogar Seguro
   Caso Judicial
   ⭐ Relevancia: 85/100
   📍 08 Mar 2017 → En curso
   🚨 Impacto: Alto
   👥 4 partes involucradas
   🔗 12 items relacionados
```

### Monitoring - Actividad
```
☑ 📈 Monitoreo: #argentina
   Actividad de Twitter
   😊 Sentimiento: Positivo
   📊 45 tweets
   📅 20-22 Enero 2025
   🔗 Link a scrape completo
```

### Monitoring - Bookmark
```
☑ 📌 Tweet de @elonmusk
   Post de Twitter
   📱 Twitter
   ❤️ 15K  💬 350  🔁 2.5K
   👁️ 1M vistas
```

---

## 🚀 Ventajas de la Implementación

### 1. **Contexto Preciso**
- Usuario selecciona exactamente qué información usar
- No hay búsquedas automáticas innecesarias
- Vizta recibe contexto específico y relevante

### 2. **Wiki Como Fuente de Conocimiento**
- Perfiles de políticos disponibles como contexto
- Eventos y casos judiciales referenciables
- Organizaciones con metadata completa

### 3. **Integración Total**
- Wiki items aparecen en modal de contexto
- Filtros por categoría y subcategoría
- Metadata visible antes de seleccionar

### 4. **Performance Optimizada**
- Solo carga items seleccionados
- No procesa todo el Codex
- Estadísticas útiles para Vizta

---

## 📊 Estadísticas en Respuesta de Vizta

Cuando se usan items específicos, Vizta recibe:

```json
{
  "stats": {
    "total": 3,
    "by_category": {
      "wiki": 2,
      "monitoring": 1
    },
    "by_subcategory": {
      "wiki_person": 1,
      "wiki_organization": 1,
      "activity": 1
    },
    "wiki_items": 2,
    "monitoring_items": 1,
    "general_items": 0,
    "with_transcription": 0,
    "with_analysis": 0
  }
}
```

Vizta puede usar estas estadísticas para contextualizar mejor:
- "Basándome en 2 items de tu Wiki y 1 análisis de actividad..."
- "Veo que seleccionaste principalmente perfiles políticos (2 personas)..."

---

## ✅ Checklist de Testing

### Backend
- [x] ✅ `getCodexItemsByIds()` obtiene items correctamente
- [x] ✅ Estadísticas se calculan bien
- [x] ✅ Metadata de Wiki se incluye
- [x] ✅ `executeUserCodexSpecific()` formatea correctamente
- [x] ✅ Vizta detecta codex_item_ids
- [ ] ⏳ Testing end-to-end con frontend

### Frontend
- [x] ✅ Filtros de categoría funcionan
- [x] ✅ Filtros de subcategoría aparecen dinámicamente
- [x] ✅ Iconos específicos para Wiki
- [x] ✅ Badges de categoría
- [x] ✅ Metadata de Wiki visible
- [ ] ⏳ Envío de codex_item_ids a backend
- [ ] ⏳ Testing de respuesta de Vizta

### Integración
- [ ] ⏳ Vizta usa contexto de Wiki correctamente
- [ ] ⏳ Respuestas muestran awareness del contexto seleccionado
- [ ] ⏳ Estadísticas aparecen en metadata

---

## 📝 Próximos Pasos

### 1. Testing Manual (Ahora)
```bash
# Crear un Wiki item de prueba
curl -X POST https://server.standatpd.com/api/wiki/save-item \
  -H "Authorization: Bearer {token}" \
  -d '{
    "user_id": "{user-id}",
    "wiki_data": {
      "wiki_type": "wiki_person",
      "name": "Test Person",
      "description": "Persona de prueba",
      "relevance_score": 80
    }
  }'

# Probar que aparece en CodexSelector
# (abrir modal en ThePulse y filtrar por Wiki > Personas)

# Seleccionar y enviar a Vizta
# Ver que la respuesta incluye el contexto
```

### 2. Verificar Flujo Completo (Mañana)
- [ ] Frontend envía codex_item_ids correctamente
- [ ] Backend los procesa
- [ ] Vizta los usa en respuesta

### 3. Documentar para Usuarios (Esta semana)
- [ ] Guía de uso del modal de contexto
- [ ] Ejemplos de preguntas con Wiki context
- [ ] Video tutorial (opcional)

---

## 📖 Archivos Modificados

```
✅ ExtractorW/server/services/agents/robert/codexEngine.js (+115 líneas)
✅ ExtractorW/server/services/mcp.js (+173 líneas)
✅ ExtractorW/server/services/agents/vizta/index.js (+7 líneas)
✅ ThePulse/src/components/ui/CodexSelector.tsx (+150 líneas)
```

---

## 🎯 Impacto

### Para el Usuario
- ✨ Puede seleccionar perfiles de Wiki como contexto
- ✨ Vizta entiende relaciones entre entidades
- ✨ Análisis más precisos con contexto específico
- ✨ No need para repetir información que ya tiene guardada

### Para Vizta
- ✨ Acceso a base de conocimiento estructurada
- ✨ Metadata rica (relevancia, relaciones, etc.)
- ✨ Contexto categor izado y organizado
- ✨ Mejor comprensión del foco del usuario

---

**Fecha:** 20 Enero 2025  
**Estado:** ✅ Backend Implementado  
**Testing:** ⏳ Pendiente end-to-end  
**Listo para:** Uso en producción (después de testing)


