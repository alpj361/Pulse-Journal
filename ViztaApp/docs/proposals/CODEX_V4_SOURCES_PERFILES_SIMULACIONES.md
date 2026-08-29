# Ficha técnica: Sources, Perfiles y Simulaciones

Estado: propuesta para aprobación  
Fecha de revisión técnica: 27 de agosto de 2026  
Servicios afectados: ExtractorW, Supabase, MCP y contrato Codex v4  
Implementación frontend: fuera de alcance en esta fase; el contrato de presentación sí se define

## 1. Resumen de la propuesta

| Concepto | Representación recomendada | Motivo |
| --- | --- | --- |
| Source | Octavo tipo oficial de ítem: `Source`, con presentación diferenciada | Debe poder consultarse, relacionarse y citarse como ítem, pero su modal y lectura responden al flujo particular de una fuente |
| Perfil | `Actor` con `is_profile = true` | Todavía no debe convertirse en un tipo; el checkbox permite distinguirlo sin romper el contrato |
| Simulación | Recurso persistente en `codex_simulations` + eventos en `codex_simulation_events` | Su estado y su línea de tiempo son operativos y pueden crecer mucho para guardarlos en `details` |
| Post | Tipo auxiliar de contenido | No es un ítem oficial |
| Snippet | Tipo auxiliar de contenido | No es un ítem oficial |

El contrato expondrá tres grupos distintos:

```json
{
  "itemTypes": [
    "Actor",
    "Entidad",
    "Territorio",
    "Evento",
    "Historia",
    "Objeto",
    "Artefacto",
    "Source"
  ],
  "auxiliaryTypes": ["Post", "Snippet"],
  "resourceTypes": ["Simulacion"],
  "storageTypes": [
    "Actor",
    "Entidad",
    "Territorio",
    "Evento",
    "Historia",
    "Objeto",
    "Artefacto",
    "Source",
    "Post",
    "Snippet"
  ]
}
```

`Perfil` no aparece en `itemTypes` porque continúa siendo una modalidad de `Actor`.

`Post` y `Snippet` sí permanecen como valores explícitos de la columna `tipo`. La separación como auxiliares describe su función en el producto; no elimina su identidad física ni los convierte en un campo secundario.

## 2. Estado actual verificado

### Codex

- `server/services/codexSchema.js` mantiene siete tipos principales y dos informales dentro de `TIPOS_VALIDOS`.
- `Snippet` y `Post` todavía comparten la constraint física y varios enums MCP con los ítems principales.
- `Fuente` se normaliza actualmente hacia `Objeto` mediante `PRESET_TIPO_ALIAS`.
- `codex_user_fields.item_types` y `codex_user_presets.item_types` aceptan los nueve valores actuales.
- Los ítems, campos y presets ya están aislados por `user_id` y RLS.

### Simulaciones

El servicio `server/services/simulacion.js` ya implementa:

- `crear`;
- `actuar`;
- `reporte`;
- `estado`;
- participantes del Codex;
- personas sintéticas efímeras;
- red basada en relaciones del Codex o afinidad;
- hasta 200 turnos por simulación;
- hasta 200 simulaciones simultáneas en memoria;
- métricas, propagación y línea de tiempo.

Limitaciones verificadas:

1. El estado vive en un `Map` de Node.
2. Reiniciar el proceso elimina las simulaciones.
3. `reporte` calcula los resultados, pero no los guarda.
4. Repetir accidentalmente una llamada `actuar` puede duplicar acciones o avanzar el turno dos veces.
5. Los perfiles sintéticos existen solo dentro de la ejecución.
6. El contrato MCP todavía llama “personas sintéticas” a cualquier perfil generado en el momento.

## 3. Source como ítem oficial

### 3.1 Definición

Un `Source` representa el origen consultable de información usada por el usuario.

Puede representar:

- una persona;
- un enlace web;
- un archivo;
- un libro;
- un documento;
- un dataset;
- una entrevista;
- una publicación;
- otro origen identificable.

Un `Actor` puede actuar como fuente, pero no deja de ser `Actor`. En ese caso se crea un `Source` que lo representa y lo enlaza mediante una referencia.

Ejemplo:

```text
[Actor] Periodista X
        ↑ representa
[Source] Entrevista con Periodista X, 12 de agosto
        ↓ cita
[Historia] Investigación sobre contrataciones
```

Esto permite que una misma persona sea fuente en varias entrevistas o contextos sin convertir su identidad completa en una cita.

### 3.2 Preset base propuesto

Clave: `sys_base_source`

| Campo | `field_key` | Tipo | Regla |
| --- | --- | --- | --- |
| Nombre o título | `name` | central | Requerido |
| Descripción | `description` | central | Opcional |
| Tipo de fuente | `sys_source_kind` | `dropdown` | Persona, web, archivo, libro, documento, dataset, entrevista, publicación u otra |
| Ítem representado | `sys_source_represented_item` | `ref` | Actor, Entidad, Objeto, Post u otro ítem ya existente |
| Autor o autores | `sys_source_authors` | `refs` | Referencias del Codex cuando existan |
| Editorial o entidad emisora | `sys_source_publisher` | `ref` | Opcional |
| Fecha de publicación | `sys_source_published_at` | `fecha` | Opcional |
| Fecha de consulta | `sys_source_accessed_at` | `fecha` | Relevante para enlaces |
| URL | `sys_source_url` | `link` | Requerida para fuente web |
| Archivo | `sys_source_file` | `archivo` | Referencia a un archivo ya representado en Codex; requerido para fuente de archivo |
| Identificador | `sys_source_identifier` | `id` | ISBN, DOI, número registral u otro |
| Idioma | `sys_source_languages` | `tags` | Opcional |
| Cita formateada | `sys_source_citation` | `parrafo` | Texto reutilizable para citar la fuente |
| Estilo de cita | `sys_source_citation_style` | `dropdown` | APA, MLA, Chicago, institucional o personalizado |
| Localizador por defecto | `sys_source_locator` | `texto` | Página, capítulo, párrafo, minuto o sección |
| Extracto | `sys_source_excerpt` | `parrafo` | Cita o fragmento relevante |
| Estado de verificación | `sys_source_verification_status` | `dropdown` | Verificada, parcial, pendiente o descartada |
| Confiabilidad | `sys_source_reliability` | `escala` | 1–5; debe poder justificarse |
| Confidencialidad | `sys_source_confidentiality` | `dropdown` | Pública, reservada, confidencial o anónima |
| Notas | `sys_source_notes` | `parrafo` | Contexto editorial |

### 3.3 Validación por clase

| `source_kind` | Requisito mínimo |
| --- | --- |
| Persona | `represented_item` debe apuntar a un `Actor` |
| Web | URL válida |
| Archivo | Referencia real en `sys_source_file` |
| Libro | Título y al menos autor o identificador |
| Documento | Archivo, URL o ítem representado |
| Dataset | Ítem representado o URL verificable |
| Entrevista | Actor representado y fecha o descripción contextual |
| Publicación | Post representado o URL |
| Otra | Descripción no vacía |

`sys_source_file` no almacena un upload ni una URL libre. Conserva una referencia del Codex hacia el archivo o Artefacto correspondiente. `sys_source_url` continúa siendo un campo `link` separado.

### 3.4 Cómo se registra una cita

El `Source` conserva la cita bibliográfica reutilizable. La forma en que se usa dentro de una investigación depende de la relación.

MVP propuesto:

- relación: `Historia → cita → Source`;
- `codex_relations.note`: extracto, página o motivo de uso;
- `codex_relations.date`: fecha relevante de la cita.

Esto aprovecha la tabla existente y evita una tabla nueva en la primera versión.

Limitación aceptada del MVP: `note` no permite consultar por separado página, fragmento y afirmación respaldada. Si más adelante se implementan citas por afirmación, se justificará una tabla `codex_citations` con metadata estructurada.

### 3.5 Página futura de Sources

La página podrá consultar `codex_universe_items` filtrando `tipo = 'Source'` y `user_id`.

Filtros previstos:

- tipo de fuente;
- verificación;
- confiabilidad;
- confidencialidad;
- autor;
- fecha;
- tags;
- investigación o caso relacionado.

No se necesita una tabla `sources` separada para construir esa página.

### 3.6 Contrato de presentación

`Source` es un ítem oficial y conserva las capacidades comunes del Codex:

- UUID y ownership;
- presets y campos personalizados por usuario;
- relaciones con otros ítems;
- búsqueda, filtros y tags;
- historial y controles de acceso.

Sin embargo, no debe presentarse como una tarjeta o modal genérico intercambiable con Actor, Objeto o Historia. El schema deberá exponer metadata de presentación para que móvil y web utilicen un flujo ligeramente diferente sin inferirlo por nombre:

```json
{
  "tipo": "Source",
  "typeClass": "official_item",
  "presentation": {
    "card": "source",
    "createModal": "source",
    "detailModal": "source",
    "primaryAction": "cite"
  }
}
```

El modal de Source deberá:

1. Comenzar preguntando qué clase de fuente es.
2. Mostrar progresivamente solo los campos pertinentes para persona, web, archivo, libro, entrevista u otra clase.
3. Dar prioridad visual a autoría, procedencia, fecha, cita, verificación y confidencialidad.
4. Mostrar relaciones como “citado en” o “sustenta”, no solo como relaciones genéricas.
5. Mantener una acción visible para abrir el Actor, archivo, Post u otro ítem representado.

La diferencia es de experiencia y presentación; no implica almacenar Source fuera de `codex_universe_items` ni reducir sus capacidades como ítem oficial.

## 4. Perfiles como modalidad de Actor

### 4.1 Definición de producto

**Persona**  
Representa a una persona real.

**Perfil**  
Representa un tipo de persona o grupo para explorar comportamientos, necesidades y posibles reacciones. No corresponde a una persona real.

### 4.2 Contrato de datos

Se agrega a `codex_universe_items`:

```sql
is_profile boolean not null default false
```

Constraint propuesta:

```sql
check (is_profile = false or tipo = 'Actor')
```

Índice parcial:

```sql
create index idx_codex_actor_profiles
on codex_universe_items (user_id, updated_at desc)
where tipo = 'Actor' and is_profile = true;
```

Razones para usar una columna y no `details`:

1. La interfaz necesita filtrar Perfiles sin descargar y recorrer JSON.
2. El simulador necesita resolverlos de forma directa.
3. Es una propiedad estructural, no un campo editorial opcional.
4. El valor por defecto mantiene compatibles los actores actuales.

No se crea una tabla llamada `profiles`, porque el proyecto ya utiliza ese nombre para perfiles de autenticación.

### 4.3 Preset propuesto

Clave: `sys_profile_actor`

| Pregunta inicial | Persistencia |
| --- | --- |
| ¿A quién quieres representar? | `name` + `sys_actor_profile_target` |
| ¿Qué quieres entender? | `sys_actor_profile_goal` |
| ¿Qué sabes de ellos? | `description` + `sys_actor_profile_known` |

Campos estructurados que Vizta puede proponer después:

| Campo | `field_key` | Tipo |
| --- | --- | --- |
| Edad mínima estimada | `sys_actor_profile_age_min` | `numero` |
| Edad máxima estimada | `sys_actor_profile_age_max` | `numero` |
| Territorios relacionados | `sys_actor_profile_territories` | `refs` |
| Motivaciones | `sys_actor_profile_motivations` | `tags` |
| Preocupaciones | `sys_actor_profile_concerns` | `tags` |
| Hábitos | `sys_actor_profile_habits` | `tags` |
| Necesidades | `sys_actor_profile_needs` | `tags` |
| Fuentes de evidencia | `sys_actor_profile_sources` | `refs` |
| Supuestos | `sys_actor_profile_assumptions` | `repetible` |
| Incertidumbres | `sys_actor_profile_uncertainties` | `repetible` |
| Fecha de revisión | `sys_actor_profile_reviewed_at` | `fecha` |

### 4.4 Flujo de creación

1. El usuario crea un Actor y marca `is_profile = true`.
2. La interfaz muestra solo las tres preguntas iniciales.
3. Vizta propone campos adicionales a partir del texto y de Sources relacionados.
4. Cada inferencia debe quedar separada entre evidencia, supuesto e incertidumbre.
5. El usuario confirma antes de guardar campos inferidos sensibles.
6. El registro aparece bajo “Perfiles”, no bajo “Personas”, aunque ambos sigan almacenados como Actor.

### 4.5 Uso en simulaciones

El motor distinguirá:

| Origen | Significado |
| --- | --- |
| `actor` | Persona real del Codex, `is_profile = false` |
| `profile` | Perfil guardado, `is_profile = true` |
| `synthetic` | Participante efímero creado solo para una simulación |

Los perfiles guardados mantienen su `codexId`. Los participantes sintéticos no se convierten automáticamente en Perfiles.

## 5. Simulaciones persistentes

### 5.1 Decisión de modelo

`Simulacion` será un recurso del contrato, pero no un `tipo` de `codex_universe_items`.

Motivos:

- una simulación guarda estado operativo, no una entidad del mundo;
- una línea de tiempo de 200 turnos puede contener cientos de kilobytes;
- actualizar `details` por cada turno degradaría la lectura normal del Codex;
- debe poder reanudarse después de reiniciar ExtractorW;
- necesita control de concurrencia e idempotencia que no corresponde a un ítem genérico.

### 5.2 Tablas propuestas

Se recomiendan dos tablas. `codex_simulations` guarda el estado resumido de la ejecución. `codex_simulation_events` guarda la línea de tiempo de forma append-only.

Guardar toda la línea de tiempo dentro de un solo JSONB obligaría a reescribir un arreglo creciente en cada turno. Con 200 turnos, esa estrategia produce amplificación de escritura y dificulta idempotencia, paginación y auditoría. Dos tablas están justificadas aquí aunque los presets y shapes no deban crear tablas nuevas.

```sql
create table public.codex_simulations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  scenario text not null,
  status text not null default 'active',
  engine_version text not null default 'oasis_v1',
  version integer not null default 1,
  config jsonb not null default '{}'::jsonb,
  participant_specs jsonb not null default '[]'::jsonb,
  participants_snapshot jsonb not null default '[]'::jsonb,
  network_snapshot jsonb not null default '{}'::jsonb,
  runtime_state jsonb not null default '{}'::jsonb,
  metrics jsonb,
  analysis text,
  context_item_ids uuid[] not null default '{}'::uuid[],
  source_ids uuid[] not null default '{}'::uuid[],
  parent_simulation_id uuid references public.codex_simulations(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint codex_simulations_status check (
    status in ('active','completed','failed','cancelled','archived')
  ),
  constraint codex_simulations_config_object check (jsonb_typeof(config) = 'object')
);

create table public.codex_simulation_events (
  id uuid primary key default gen_random_uuid(),
  simulation_id uuid not null
    references public.codex_simulations(id) on delete cascade,
  turn_number integer not null,
  turn_token text not null,
  participant_id text not null,
  participant_name text not null,
  action_type text not null,
  content text,
  description text,
  reply_to_event_id uuid
    references public.codex_simulation_events(id) on delete set null,
  is_public boolean not null default true,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint codex_simulation_events_action check (
    action_type in ('publicar','responder','amplificar','callar','otra')
  ),
  constraint codex_simulation_events_turn_nonnegative check (turn_number >= 0),
  unique (simulation_id, turn_token, participant_id)
);
```

Índices:

```sql
create index idx_codex_simulations_owner_recent
on public.codex_simulations (user_id, updated_at desc);

create index idx_codex_simulations_owner_status
on public.codex_simulations (user_id, status);

create index idx_codex_simulations_context_items
on public.codex_simulations using gin (context_item_ids);

create index idx_codex_simulations_sources
on public.codex_simulations using gin (source_ids);

create index idx_codex_simulation_events_timeline
on public.codex_simulation_events (simulation_id, turn_number, created_at);
```

RLS de simulaciones:

```sql
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id)
```

RLS de eventos: una fila puede leerse o escribirse únicamente cuando la simulación padre pertenece a `auth.uid()`. La policy debe usar `exists` contra `codex_simulations`, con índice en `simulation_id`.

### 5.3 Snapshot y trazabilidad

Cada simulación guarda una copia de los participantes y de las Sources que utilizó al comenzar.

Esto evita que editar posteriormente un Actor o Perfil cambie silenciosamente el significado de una simulación histórica.

Se conservan dos cosas:

- referencias actuales mediante `context_item_ids` y `source_ids`;
- snapshot histórico dentro de `participants_snapshot` y `network_snapshot`.

### 5.4 Ciclo de persistencia

#### `crear`

1. Valida ownership de actores, perfiles, territorios y Sources.
2. Resuelve participantes.
3. Construye la red.
4. Inserta inmediatamente `codex_simulations`.
5. Devuelve el UUID como `sim_id`.

#### `actuar`

1. Recibe `sim_id`, `turn_token` y acciones.
2. Bloquea o compara la versión actual.
3. Inserta los eventos con unicidad por simulación, token y participante.
4. Rechaza un `turn_token` ya procesado sin duplicar acciones.
5. Actualiza cursor, estado y versión en la misma transacción.
6. Devuelve el siguiente lote.

La operación atómica debe implementarse mediante una función SQL/RPC, por ejemplo `advance_codex_simulation`, porque varias llamadas independientes de PostgREST podrían insertar eventos y fallar antes de avanzar el cursor.

#### `estado`

Lee Supabase cuando la simulación no está en el cache de memoria. Esto permite recuperar sesiones después de un reinicio.

#### `reporte`

Calcula y persiste métricas desde `codex_simulation_events`, marca `completed_at` y conserva la línea de tiempo paginable.

#### `guardar_analisis`

Nueva operación para guardar el análisis narrativo que el agente redacta después de recibir las métricas.

### 5.5 Operaciones MCP

Se conservan:

- `crear`;
- `actuar`;
- `reporte`;
- `estado`.

Se agregan:

- `guardar_analisis`;
- `listar`;
- `obtener`;
- `archivar`;
- `duplicar` para crear una nueva ejecución basada en otra.

Parámetros nuevos de `crear`:

```json
{
  "title": "Reacción a cierre de calles en Zona 1",
  "scenario": "...",
  "participants": [
    { "source": "actor", "ids": ["uuid"] },
    { "source": "profile", "ids": ["uuid"] },
    { "source": "synthetic", "n": 20, "profile": "..." }
  ],
  "context_item_ids": ["uuid"],
  "source_ids": ["uuid"],
  "turns": 40,
  "batch": 5
}
```

El MCP puede seguir aceptando temporalmente las claves españolas actuales (`escenario`, `personas`, `turnos`) y normalizarlas al contrato estable.

### 5.6 Etiquetado de resultados

Toda simulación debe mostrar:

- que el resultado es simulado;
- qué participantes eran personas reales, perfiles o sintéticos;
- qué Sources sustentaron los datos iniciales;
- qué campos fueron inferidos;
- incertidumbres y supuestos;
- versión del motor;
- fecha de ejecución.

Una simulación no convierte una inferencia en hecho ni modifica automáticamente los ítems que utilizó.

## 6. API propuesta

### Sources

```http
GET  /api/codex/sources
POST /api/codex/sources
GET  /api/codex/sources/:id
PATCH /api/codex/sources/:id
```

Internamente pueden reutilizar el contrato de `codex_universe_items`, pero validan `tipo = Source` y las reglas por `source_kind`.

### Perfiles

```http
GET  /api/codex/profiles
POST /api/codex/profiles
PATCH /api/codex/profiles/:id
```

Estos endpoints son fachadas sobre Actor:

```json
{
  "tipo": "Actor",
  "is_profile": true
}
```

### Simulaciones

```http
POST /api/codex/simulations
GET  /api/codex/simulations
GET  /api/codex/simulations/:id
POST /api/codex/simulations/:id/actions
POST /api/codex/simulations/:id/report
PATCH /api/codex/simulations/:id/analysis
POST /api/codex/simulations/:id/archive
```

Todos requieren autenticación y verifican `user_id` en servicio y RLS.

## 7. Cambios en el contrato Codex y MCP

### Taxonomía

Crear constantes separadas:

```js
const UNIVERSE_ITEM_TYPES = [
  'Actor', 'Entidad', 'Territorio', 'Evento',
  'Historia', 'Objeto', 'Artefacto', 'Source'
];

const AUXILIARY_CONTENT_TYPES = ['Snippet', 'Post'];
const STORAGE_TYPES = [...UNIVERSE_ITEM_TYPES, ...AUXILIARY_CONTENT_TYPES];
```

`TIPOS_VALIDOS` puede mantenerse como alias temporal de `STORAGE_TYPES` para no romper clientes existentes.

La columna física `codex_universe_items.tipo` conserva los valores `Post` y `Snippet`. El backend los identifica mediante `AUXILIARY_CONTENT_TYPES` para excluirlos de selectores o conteos de ítems oficiales, pero las consultas, respuestas REST y herramientas MCP continúan devolviendo:

```json
{
  "tipo": "Post",
  "typeClass": "auxiliary"
}
```

No se reemplaza `tipo` por un booleano ni se oculta la clase concreta del contenido auxiliar.

### Alias

- `fuente`, `source` y `cita` → `Source` para nuevas escrituras.
- El alias legacy `Fuente → Objeto` deja de aplicarse a nuevas escrituras.
- No se migran automáticamente los Objetos históricos que antes representaban fuentes.
- Se ofrecerá una conversión explícita para evitar reclasificar evidencia por error.

### MCP Codex

Acciones recomendadas:

- `create_source`;
- `update_source`;
- `search_sources`;
- `cite_source`;
- `create_profile`;
- `update_profile`;
- `search_profiles`.

Las acciones específicas utilizan internamente las funciones v4 existentes, pero aplican validaciones semánticas antes de escribir.

### Presets como fuente de verdad de los formularios

Como parte de esta migración se debe verificar y completar el flujo de presets de extremo a extremo. Los campos que móvil y web permiten llenar no deben mantenerse como arreglos independientes escritos directamente en cada modal. La fuente de verdad será el contrato de presets del usuario.

Flujo requerido:

1. El frontend solicita el schema correspondiente al `tipo` y al usuario autenticado.
2. El backend devuelve los presets disponibles y el catálogo de campos que utiliza cada uno.
3. El usuario puede aplicar uno o varios presets compatibles.
4. El frontend combina sus `field_keys`, elimina duplicados por clave estable y respeta orden, label, tipo, opciones y reglas de validación.
5. El formulario se construye dinámicamente con esa definición.
6. Al guardar, backend y MCP rechazan claves desconocidas o valores incompatibles con el tipo declarado.

Respuesta mínima propuesta:

```json
{
  "tipo": "Source",
  "presets": [
    {
      "presetKey": "sys_base_source",
      "label": "Fuente",
      "fieldKeys": [
        "sys_source_kind",
        "sys_source_authors",
        "sys_source_published_at",
        "sys_source_url",
        "sys_source_citation"
      ]
    }
  ],
  "fields": {
    "sys_source_url": {
      "label": "URL",
      "type": "link",
      "required": false,
      "order": 40
    }
  }
}
```

Reglas:

- Los presets son por usuario y un ítem puede aplicar varios.
- Los presets oficiales se aprovisionan para cada usuario mediante claves `sys_*` estables.
- Los presets creados por el usuario utilizan el mismo contrato de clave, label, tipo, motivo y campos.
- Agregar un campo posteriormente consiste en registrarlo en `codex_user_fields` y asociarlo al preset correspondiente en `codex_user_presets`; los clientes que soportan el contrato lo mostrarán sin una nueva lista hardcodeada.
- Añadir un campo a un preset no sobrescribe ítems existentes. Al volver a editarlos, el campo nuevo puede aparecer vacío para que el usuario decida si lo completa.
- Retirar un campo del preset impide ofrecerlo en nuevas capturas, pero no elimina silenciosamente valores históricos ya guardados.
- Los campos centrales que realmente pertenezcan a todos los ítems, como `name`, `description` y `tipo`, se documentan en el schema base; las diferencias editoriales viven en presets.
- El modal particular de Source sigue siendo diferente visualmente, pero obtiene sus campos y validaciones desde `sys_base_source` y los demás presets seleccionados.

La migración debe incluir un aprovisionamiento idempotente de campos y presets oficiales para usuarios existentes, además del mismo aprovisionamiento al crear usuarios nuevos. Repetir la migración no debe duplicar presets ni cambiar claves existentes.

## 8. Migración propuesta

### Fase 1: base de datos

1. Crear backup privado de columnas afectadas.
2. Añadir `Source` a la constraint física de `codex_universe_items.tipo`.
3. Añadir `Source` a `codex_user_fields.item_types` y `codex_user_presets.item_types`.
4. Añadir `is_profile` y su constraint.
5. Crear el índice parcial de perfiles.
6. Crear `codex_simulations`, `codex_simulation_events`, índices, grants y RLS.
7. Crear la RPC transaccional e idempotente para avanzar turnos.
8. Aprovisionar de forma idempotente los campos y presets oficiales por usuario, incluidos Source y Perfil.
9. Añadir el mecanismo de aprovisionamiento equivalente para usuarios nuevos.
10. Ejecutar dry run y comprobar que ningún registro existente cambia de tipo ni pierde valores de campos.

### Fase 2: contrato backend

1. Separar tipos oficiales y auxiliares en `codexSchema.js`.
2. Añadir el preset de Source.
3. Añadir el preset de Perfil aplicable a Actor.
4. Actualizar `codexContractV4.js` para `is_profile` y validaciones Source.
5. Añadir filtros Source/Perfil en REST.
6. Exponer presets, campos, orden, opciones y validaciones mediante el endpoint de schema.
7. Definir la combinación determinista de varios presets y deduplicación por `field_key`.

### Fase 3: MCP

1. Actualizar enums de `codex`, `data_ops` y búsqueda.
2. Añadir acciones específicas de Sources y Perfiles.
3. Persistir el estado de `simular` después de cada operación.
4. Añadir `turn_token` e idempotencia.
5. Añadir listar, obtener, guardar análisis, archivar y duplicar.

### Fase 4: pruebas y documentación

1. Pruebas unitarias de normalización y validaciones.
2. Pruebas de RLS entre dos usuarios.
3. Prueba de recuperación de simulación después de reiniciar el proceso.
4. Prueba de reintento de `actuar` sin duplicados.
5. Pruebas de creación de Source por cada clase.
6. Prueba de Actor real frente a Perfil.
7. Prueba de un formulario generado únicamente desde presets, sin campos específicos hardcodeados.
8. Prueba de varios presets con una misma `field_key`, sin duplicar el control visual.
9. Prueba de añadir un campo a un preset y verlo en clientes existentes sin cambiar el modal.
10. Handoff separado al frontend móvil y web.

## 9. Compatibilidad

### No cambia

- IDs de ítems existentes.
- Valores actuales de Actor, Entidad, Territorio, Evento, Historia, Objeto y Artefacto.
- Post y Snippet almacenados.
- RLS por usuario.
- Herramienta `simular` y sus cuatro operaciones actuales.
- Relaciones existentes.

### Cambia de forma aditiva

- `Source` se acepta como tipo.
- Actor incorpora `is_profile` con default `false`.
- Schema diferencia tipos oficiales, auxiliares y recursos.
- Simulaciones se conservan en Supabase.
- MCP obtiene acciones específicas y recuperación de estado.

## 10. Riesgos y controles

| Riesgo | Control |
| --- | --- |
| Duplicar un Actor como Source sin relación | `represented_item` y búsqueda previa obligatoria para fuentes personales |
| Confundir Perfil con persona real | Badge visible, `is_profile`, copy explícito y validación Actor-only |
| Presentar inferencias como hechos | Sources, supuestos e incertidumbres obligatorios en la generación asistida |
| Perder simulaciones al reiniciar | Persistencia después de cada operación |
| Duplicar acciones por retry | `turn_token` idempotente + versión optimista |
| Timeline demasiado grande | Eventos append-only, límite de 200 turnos y paginación; los listados no incluyen eventos por defecto |
| Exponer fuentes confidenciales | RLS, confidencialidad y responses mínimos en listados |
| Reclasificar Objetos históricos incorrectamente | Sin migración automática `Objeto → Source` |
| Frontend y presets divergen | El schema de presets es la fuente de verdad; las pruebas detectan campos hardcodeados o desconocidos |
| Duplicar campos al aplicar varios presets | Unión determinista y deduplicación por `field_key` estable |
| Una migración repetida duplica presets | Aprovisionamiento idempotente con claves estables y constraints por usuario |

## 11. Criterios de aceptación

1. El schema devuelve ocho `itemTypes`, dos `auxiliaryTypes` y `Simulacion` como recurso.
2. Source conserva las capacidades de un ítem oficial y expone un contrato para tarjeta, modal de creación y modal de detalle diferenciados.
3. Un usuario puede crear y consultar Sources sin ver los de otro usuario.
4. Una Source-persona apunta a un Actor existente y no duplica su identidad.
5. Un Actor con `is_profile = true` aparece como Perfil y no como persona real.
6. Los actores actuales permanecen con `is_profile = false`.
7. Una simulación iniciada antes de reiniciar ExtractorW puede continuar después del reinicio.
8. Reenviar el mismo `turn_token` no duplica acciones ni avanza dos veces.
9. El reporte, métricas, timeline y análisis final permanecen consultables.
10. Cada simulación conserva snapshots y referencias de los ítems y Sources utilizados.
11. Post y Snippet continúan identificándose mediante `tipo`, pero no se presentan ni se cuentan como ítems oficiales.
12. Los formularios de creación y edición obtienen sus campos desde los presets del usuario.
13. Añadir un campo a un preset lo vuelve disponible en el frontend sin agregarlo manualmente al modal.
14. Aplicar varios presets no duplica campos que comparten la misma `field_key`.

## 12. Decisiones que requieren aprobación

1. Aprobar `Source` como octavo ítem oficial.
2. Aprobar que Source tenga tarjeta y modales propios, conservando el mismo núcleo de ítem oficial.
3. Aprobar que una fuente-persona sea un Source enlazado a Actor, no el Actor convertido a Source.
4. Aprobar que Post y Snippet permanezcan identificados en `tipo` como auxiliares.
5. Aprobar `is_profile` como checkbox estructural exclusivo de Actor.
6. Aprobar que las personas sintéticas efímeras no se guarden automáticamente como Perfiles.
7. Aprobar `Simulacion` como recurso persistente separado, no como tipo de ítem.
8. Aprobar dos tablas operativas: `codex_simulations` y `codex_simulation_events`.
9. Aprobar que las citas específicas usen temporalmente `codex_relations.note`.
10. Aprobar los presets del usuario como fuente de verdad para construir formularios en móvil y web.
11. Confirmar si la información de Sources confidenciales necesita cifrado adicional a RLS en una fase posterior.
