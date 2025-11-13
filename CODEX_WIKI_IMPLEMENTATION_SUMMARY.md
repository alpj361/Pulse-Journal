# 📚 Resumen: Implementación de Wiki en Codex

## ✅ Estado Actual

### Migraciones Aplicadas en Supabase
1. ✅ **Columnas agregadas** → `category`, `subcategory`, `source_type`, `metadata`
2. ✅ **Índices creados** → Optimización para queries rápidas
3. ✅ **Constraints validados** → Incluye categorías: `general`, `monitoring`, `wiki`
4. ✅ **Datos migrados** → 58 items categorizados automáticamente
5. ✅ **Wiki habilitada** → 5 nuevas subcategorías disponibles

---

## 📊 Estadísticas de Migración

### Datos Actuales en Codex (58 items total)

**📁 GENERAL (26 items - 44.8%)**
- 📄 Documentos: 16 items
- 🎤 Audios: 10 items

**📊 MONITORING (32 items - 55.2%)**
- 📌 Bookmarks: 28 items (posts de Twitter/Instagram)
- 📈 Actividad: 4 items (scrapes guardados)

**📚 WIKI (0 items - 0%)**
- 👤 Personas: 0 items
- 🏢 Organizaciones: 0 items
- 📍 Lugares: 0 items
- 📅 Eventos: 0 items
- 💡 Conceptos: 0 items

### Por Fuente (Source Type)
- 🔖 Bookmark: 28 items (48.3%)
- ✍️ Manual: 18 items (31.0%)
- 📤 Upload: 8 items (13.8%)
- 📊 Activity: 4 items (6.9%)

---

## 🆕 Nuevas Categorías de Wiki

### 1. 👤 **Personas** (`wiki_person`)
Políticos, funcionarios públicos, periodistas, activistas, líderes de opinión

**Metadata incluye:**
- Nombre completo y aliases
- Posición y partido político
- Biografía y educación
- Historial de carrera
- Controversias y logros
- Redes sociales
- Entidades relacionadas

**Ejemplo de uso:**
```json
{
  "wiki_type": "wiki_person",
  "name": "Bernardo Arévalo",
  "full_name": "Bernardo Arévalo de León",
  "position": "Presidente de Guatemala",
  "political_party": "Movimiento Semilla",
  "relevance_score": 95,
  "social_media": {
    "twitter": "@BArevalodeLeon",
    "facebook": "BernardoArevalodeLeón"
  }
}
```

### 2. 🏢 **Organizaciones** (`wiki_organization`)
Partidos políticos, ONGs, empresas, instituciones gubernamentales, medios

**Metadata incluye:**
- Nombre oficial y acrónimo
- Tipo (partido, ONG, gobierno, medio, empresa)
- Estado legal y fecha de fundación
- Sede y personas clave
- Misión y presupuesto
- Escándalos y logros

**Ejemplo de uso:**
```json
{
  "wiki_type": "wiki_organization",
  "name": "Movimiento Semilla",
  "acronym": "Semilla",
  "org_type": "political_party",
  "founding_date": "2014-02-14",
  "key_people": ["Bernardo Arévalo", "Samuel Pérez Álvarez"],
  "relevance_score": 90
}
```

### 3. 📍 **Lugares** (`wiki_location`)
Ciudades, departamentos, barrios, edificios, zonas de conflicto

**Metadata incluye:**
- Nombre y tipo de lugar
- Coordenadas geográficas
- Jurisdicción y población
- Autoridades (alcalde, gobernador)
- Eventos recientes
- Estado de seguridad

**Ejemplo de uso:**
```json
{
  "wiki_type": "wiki_location",
  "name": "Municipalidad de Guatemala",
  "location_type": "building",
  "coordinates": { "lat": 14.634915, "lng": -90.506882 },
  "mayor": "Ricardo Quiñónez",
  "importance": "high",
  "relevance_score": 75
}
```

### 4. 📅 **Eventos** (`wiki_event`)
Casos judiciales, elecciones, manifestaciones, crisis políticas

**Metadata incluye:**
- Nombre y tipo de evento
- Fechas de inicio y fin
- Estado actual y resultado
- Participantes
- Timeline de momentos clave
- Partes involucradas
- Impacto público

**Ejemplo de uso:**
```json
{
  "wiki_type": "wiki_event",
  "name": "Caso Hogar Seguro",
  "event_type": "legal_case",
  "start_date": "2017-03-08",
  "status": "ongoing",
  "participants": ["Víctimas", "Estado de Guatemala", "MP"],
  "public_impact": "high",
  "relevance_score": 85
}
```

### 5. 💡 **Conceptos** (`wiki_concept`)
Leyes, políticas públicas, movimientos sociales, términos técnicos

**Metadata incluye:**
- Nombre y categoría del concepto
- Definición y contexto
- Estado actual
- Leyes relacionadas
- Población afectada
- Presupuesto
- Controversias

**Ejemplo de uso:**
```json
{
  "wiki_type": "wiki_concept",
  "name": "Ley de ONG",
  "concept_category": "law",
  "definition": "Ley para la Regulación de las Organizaciones No Gubernamentales",
  "current_status": "controversial",
  "affected_population": "ONGs internacionales",
  "relevance_score": 80
}
```

---

## 🔗 Características Especiales

### 1. **Relaciones entre Entidades**
Cada item de Wiki puede vincularse con otros:
- Persona → Organización (ej: político → partido)
- Organización → Evento (ej: MP → Caso Hogar Seguro)
- Evento → Lugar (ej: Manifestación → Plaza Central)
- Concepto → Persona (ej: Ley de ONG → Bernardo Arévalo)

**Endpoint para relacionar:**
```javascript
PUT /api/codex/wiki-item/:id/relate
Body: { "related_item_ids": ["uuid-1", "uuid-2", ...] }
```

### 2. **Sistema de Relevancia**
Cada item tiene un `relevance_score` (0-100) basado en:
- Frecuencia de menciones en monitoreos
- Engagement en posts relacionados
- Actualizaciones recientes
- Importancia manual asignada

### 3. **Referencias Cruzadas**
- Link directo a **Posts** relacionados (bookmarks)
- Link a **Actividades** de monitoreo (scrapes)
- Link a **Documentos** guardados
- URLs de fuentes externas

### 4. **Timeline/Cronología**
Para eventos, se puede mantener un timeline detallado:
```json
{
  "timeline": [
    {
      "date": "2017-03-08",
      "event": "Incendio en Hogar Seguro",
      "description": "Mueren 41 niñas..."
    },
    {
      "date": "2023-01-15",
      "event": "Sentencia",
      "description": "Se dicta sentencia..."
    }
  ]
}
```

---

## 🎨 Visualización en ThePulse

### Filtros Sugeridos
```
┌─────────────────────────────────────┐
│  🗂️ Codex                           │
├─────────────────────────────────────┤
│  [Todos] [📁 General] [📊 Monitoreos] [📚 Wiki]
├─────────────────────────────────────┤
│  Cuando Wiki está seleccionado:     │
│  [👤 Personas] [🏢 Orgs] [📍 Lugares] [📅 Eventos] [💡 Conceptos]
└─────────────────────────────────────┘
```

### Card de Persona
```
┌────────────────────────────────────┐
│ 👤 Bernardo Arévalo               │
│ Presidente de Guatemala            │
│                                    │
│ 🏛️ Movimiento Semilla             │
│ 🐦 @BArevalodeLeon                │
│                                    │
│ 📊 Relevancia: ⭐⭐⭐⭐⭐ (95)        │
│ 🔗 5 items relacionados            │
│                                    │
│ [Ver perfil completo]              │
│ [Ver posts relacionados]           │
└────────────────────────────────────┘
```

### Card de Organización
```
┌────────────────────────────────────┐
│ 🏢 Ministerio Público (MP)         │
│ Institución Gubernamental          │
│                                    │
│ 📅 Fundación: 1994                 │
│ 👥 Personas clave: 3               │
│ 📊 Relevancia: ⭐⭐⭐⭐ (80)          │
│                                    │
│ 🔗 Relacionado con:                │
│ • Caso Hogar Seguro                │
│ • Consuelo Porras (Fiscal General) │
│ • Ley Orgánica del MP              │
│                                    │
│ [Ver detalles] [Ver actividad]     │
└────────────────────────────────────┘
```

### Card de Evento
```
┌────────────────────────────────────┐
│ 📅 Caso Hogar Seguro               │
│ Caso Judicial                      │
│                                    │
│ 📍 2017-03-08 → En curso           │
│ 🚨 Estado: En proceso              │
│ 📊 Impacto: Alto                   │
│                                    │
│ 👥 Participantes:                  │
│ • Víctimas (41 niñas)              │
│ • Estado de Guatemala              │
│ • Ministerio Público               │
│                                    │
│ 📰 28 posts relacionados           │
│ 📊 4 análisis de actividad         │
│                                    │
│ [Ver timeline] [Ver cobertura]     │
└────────────────────────────────────┘
```

### Vista de Red (Graph View)
Visualización de relaciones entre entidades:
```
        [Bernardo Arévalo] ──────► [Movimiento Semilla]
                │                           │
                │                           │
                ▼                           ▼
        [Elecciones 2023] ◄──────── [Consuelo Porras]
                │                           │
                │                           │
                ▼                           ▼
        [Política Electoral] ────► [Ministerio Público]
                                            │
                                            ▼
                                    [Caso Hogar Seguro]
```

---

## 🚀 Endpoints Disponibles

### 1. **Crear Item de Wiki**
```http
POST /api/codex/save-wiki-item
Authorization: Bearer {token}

Body:
{
  "user_id": "uuid",
  "wiki_data": {
    "wiki_type": "wiki_person",
    "name": "Bernardo Arévalo",
    "full_name": "Bernardo Arévalo de León",
    "position": "Presidente",
    "political_party": "Movimiento Semilla",
    "biography": "...",
    "social_media": {...},
    "tags": ["política", "presidente", "semilla"]
  }
}

Response:
{
  "success": true,
  "id": "uuid",
  "item": {...}
}
```

### 2. **Obtener Items de Wiki**
```http
GET /api/codex/wiki-items?wiki_type=wiki_person&search=arévalo&limit=10
Authorization: Bearer {token}

Response:
{
  "success": true,
  "items": [...],
  "count": 5
}
```

### 3. **Relacionar Items**
```http
PUT /api/codex/wiki-item/{id}/relate
Authorization: Bearer {token}

Body:
{
  "related_item_ids": ["uuid-1", "uuid-2"]
}

Response:
{
  "success": true,
  "related_items": ["uuid-1", "uuid-2", "uuid-3"]
}
```

---

## 📋 Próximos Pasos

### Fase 1: ThePulse (Frontend) - 3-4 días
- [ ] Agregar filtro de categoría "Wiki" en EnhancedCodex
- [ ] Crear componentes específicos:
  - [ ] `PersonCard` - Card para personas
  - [ ] `OrganizationCard` - Card para organizaciones
  - [ ] `LocationCard` - Card para lugares
  - [ ] `EventCard` - Card para eventos
  - [ ] `ConceptCard` - Card para conceptos
- [ ] Implementar modal de creación de Wiki items
- [ ] Agregar vista de relaciones (graph view)
- [ ] Testing de UI

### Fase 2: Integración con Monitoreos - 2-3 días
- [ ] Auto-detección de entidades en posts
- [ ] Sugerencias automáticas al guardar actividad
- [ ] Link automático de posts con Wiki items
- [ ] Actualización de relevance_score

### Fase 3: Búsqueda y Navegación - 2 días
- [ ] Búsqueda global en Wiki
- [ ] Filtros avanzados (por relevancia, fecha, tipo)
- [ ] Navegación por relaciones (explorar grafo)
- [ ] Export de Wiki items

### Fase 4: Detección Automática con IA - 3-4 días
- [ ] Usar Vizta/Claude para extraer entidades de textos
- [ ] Auto-crear Wiki items desde posts analizados
- [ ] Sugerencias inteligentes de relaciones
- [ ] Enriquecimiento automático con web search

---

## 💡 Casos de Uso Reales

### Caso 1: Monitoreo de Político
1. Usuario hace scrape de `@BArevalodeLeon`
2. Sistema detecta menciones frecuentes
3. Sugiere crear Wiki item para "Bernardo Arévalo"
4. Usuario crea perfil con datos básicos
5. Sistema auto-vincula todos los posts relacionados
6. Relevance score se actualiza automáticamente

### Caso 2: Seguimiento de Caso Judicial
1. Usuario guarda varios posts sobre "Caso Hogar Seguro"
2. Crea Wiki item tipo "evento"
3. Agrega timeline con fechas clave
4. Vincula con personas (fiscal, jueces, víctimas)
5. Vincula con organizaciones (MP, instituciones)
6. Vista de timeline muestra evolución del caso

### Caso 3: Análisis de Partido Político
1. Usuario crea Wiki item para "Movimiento Semilla"
2. Vincula con personas clave del partido
3. Vincula con eventos (elecciones, manifestaciones)
4. Sistema muestra todos los posts relacionados
5. Vista de red muestra relaciones con otras entidades
6. Export genera reporte completo del partido

---

## 🎯 Beneficios de la Wiki

### 1. **Organización de Conocimiento**
- Base de datos estructurada de entidades clave
- Fácil búsqueda y navegación
- Información centralizada

### 2. **Contexto Enriquecido**
- Posts vinculados con entidades conocidas
- Timeline de eventos importantes
- Relaciones visualizadas

### 3. **Investigación Eficiente**
- Seguimiento de personas/organizaciones
- Historial de eventos
- Conexiones entre entidades reveladas

### 4. **Reportes Automáticos**
- Generar informes sobre entidades
- Análisis de relaciones
- Timeline visualizado

### 5. **Detección de Patrones**
- Ver cómo entidades interactúan
- Detectar tendencias en el tiempo
- Identificar actores clave

---

## ✅ Resumen de Estado

**✅ Base de Datos:** Completamente configurada
**✅ Backend:** Endpoints implementados en el plan
**⏳ Frontend:** Por implementar (ThePulse)
**⏳ Auto-detección:** Por implementar (IA)

**Próximo paso inmediato:**
Implementar UI en ThePulse para crear y visualizar Wiki items.

---

**Fecha:** 2025-01-20
**Versión:** 1.0
**Estado:** Base de datos lista, endpoints diseñados, listo para frontend


