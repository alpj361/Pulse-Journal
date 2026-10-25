# Handoff operativo: ExtractorW y MCP para Espacios 3.3

Estado: contrato SQL y adaptación MCP desplegados en el VPS  
Fecha: 8 de septiembre de 2026  

Comprobación remota: `extractorw-api` fue reconstruido y está saludable. `list_spaces` respondió mediante el MCP publicado con los 9 Espacios del usuario conectado y con los campos nuevos. Una sesión MCP abierta antes del despliegue puede conservar el enum legacy en caché hasta reconectarse.

## Objetivo

Actualizar la herramienta MCP `workspace` sin cambiar su nombre público. Debe seguir atendiendo las acciones legacy mientras adopta `spaces`, secciones normalizadas, recursos y lecturas limitadas de contexto.

## Superficies canónicas

- `projects`: contenedor opcional superior.
- `spaces`: identidad del Espacio.
- `space_sections`: contenido jerárquico editable.
- `workspace_resources`: referencias de Proyecto o Espacio.
- `spaces.data`: compatibilidad del lienzo visual; no es la fuente canónica de secciones.
- `free_canvases`: vista obsoleta; solo compatibilidad temporal.

## Funciones que debe invocar el backend

### Leer Espacio o sección

```js
const { data, error } = await supabase.rpc('workspace_get_space_context', {
  p_user_id: user.id,
  p_space_id: spaceId,
  p_section_id: sectionId ?? null,
  p_max_chars: maxChars ?? 30000,
});
```

### Leer Proyecto

```js
const { data, error } = await supabase.rpc('workspace_get_project_context', {
  p_user_id: user.id,
  p_project_id: projectId,
  p_max_chars: maxChars ?? 60000,
});
```

### Buscar contexto

```js
const { data, error } = await supabase.rpc('workspace_search_context', {
  p_user_id: user.id,
  p_query: query,
  p_project_id: projectId ?? null,
  p_space_id: spaceId ?? null,
  p_limit: limit ?? 20,
});
```

Estas llamadas deben hacerse desde ExtractorW con `service_role`. El backend debe tomar `p_user_id` de la sesión validada; no debe aceptar un usuario arbitrario desde los parámetros MCP.

## Acciones MCP

Conservar:

```text
list_projects | create_project | list_spaces | create_space |
read_space | add_note_to_space | add_item_to_space |
list_decisions | create_decision
```

Agregar:

```text
read_project | list_sections | create_section | update_section |
delete_section | attach_resource | detach_resource |
list_resources | search_context
```

Parámetros nuevos:

| Parámetro | Tipo | Uso |
| --- | --- | --- |
| `section_id` | UUID opcional | Leer o modificar una sección. |
| `parent_section_id` | UUID opcional | Crear una hija. |
| `section_kind` | enum | Tipo de división. |
| `content_format` | enum | `tiptap`, `markdown`, `plain_text` o `json`. |
| `content` | string | Texto legible de la sección. |
| `content_json` | object/array | Documento estructurado del editor. |
| `resource_type` | enum | Tipo de recurso canónico. |
| `resource_id` | UUID | Recurso a asociar. |
| `resource_role` | enum | Función del recurso. |
| `max_chars` | integer | Presupuesto de contexto. |
| `query` | string | Texto de búsqueda. |
| `limit` | integer | Máximo de resultados, hasta 50. |

## Cambios implementados en el ejecutor

1. Cambiar todas las consultas `.from('free_canvases')` a `.from('spaces')`.
2. `resolveSpace` debe seleccionar `id,user_id,project_id,name,description,space_kind,status,revision,data,updated_at`.
3. `list_spaces` debe devolver también `description,space_kind,status,revision`.
4. `create_space` debe aceptar `description` y `space_kind`; puede conservar el objeto visual vacío en `data`.
5. `read_space` debe usar `workspace_get_space_context`; no debe volver a hidratar manualmente todos los `canvasItems`.
6. `read_project` debe usar `workspace_get_project_context`.
7. `search_context` debe usar `workspace_search_context`.
8. El CRUD de secciones debe filtrar siempre por `user_id` y `space_id`.
9. `attach_resource` debe insertar en `workspace_resources`; el trigger validará propietario y existencia.
10. `detach_resource` debe eliminar por `association_id` y `user_id`, no únicamente por UUID del recurso.

## Compatibilidad de `add_item_to_space`

Durante la transición, esta acción tiene dos efectos deliberados:

1. inserta o conserva el nodo dentro de `spaces.data.canvasItems` y su posición visual;
2. crea una asociación `workspace_resources` con:

```json
{
  "space_id": "...",
  "resource_type": "codex_item o codex_auxiliary",
  "resource_id": "...",
  "role": "context"
}
```

Primero debe verificar en cuál tabla canónica existe el recurso para escoger el tipo. La restricción única permite usar `upsert` o ignorar el conflicto sin duplicar la asociación.

La actualización JSON actual utiliza un mutex de proceso. Esto puede mitigar colisiones en una sola instancia, pero no coordina varios contenedores. Debe mantenerse como compatibilidad hasta reemplazar esa escritura por una función SQL transaccional; no ampliar ese patrón para contenido nuevo.

## Respuestas para el agente

- Exponer nombres, títulos, etiquetas y tipos visibles.
- Conservar UUIDs únicamente como identificadores secundarios para acciones posteriores.
- Informar `context_budget`, `resource_count` y banderas `*_truncated`.
- Si hay truncamiento, sugerir que el agente lea una sección concreta o haga una búsqueda.
- No afirmar que leyó recursos que solo aparecieron como resumen.

## API REST potencial para una fase posterior

```text
GET    /api/workspaces/projects
POST   /api/workspaces/projects
GET    /api/workspaces/projects/:projectId/context
GET    /api/workspaces/spaces
POST   /api/workspaces/spaces
PATCH  /api/workspaces/spaces/:spaceId
GET    /api/workspaces/spaces/:spaceId/context
GET    /api/workspaces/spaces/:spaceId/sections
POST   /api/workspaces/spaces/:spaceId/sections
PATCH  /api/workspaces/spaces/:spaceId/sections/:sectionId
DELETE /api/workspaces/spaces/:spaceId/sections/:sectionId
GET    /api/workspaces/resources
POST   /api/workspaces/resources
DELETE /api/workspaces/resources/:associationId
GET    /api/workspaces/search
```

Los clientes móviles pueden continuar usando tablas con RLS para edición. Estas rutas son especialmente útiles para MCP y clientes que necesiten una respuesta compuesta y con presupuesto.

## Verificación realizada en el VPS

1. Las siete migraciones de 3.1–3.3 fueron copiadas al worktree únicamente para versionarlas; no se reaplicaron.
2. `server/services/mcp.js` fue actualizado y validado con `node --check`.
3. Las acciones de lectura y escritura se probaron contra Supabase: crear, editar, leer y eliminar sección; asociar, hidratar, listar y retirar recurso.
4. La prueba temporal terminó con 0 filas residuales.
5. El orden del listado de recursos se corrigió para que asociaciones nuevas aparezcan dentro del límite de 50.
6. El commit aislado es `fa4e2ca7` en `codex/codex-contract-v41`.
7. Se reconstruyó únicamente `extractorw` mediante Docker Compose.
8. El contenedor reportó `healthy`, sin errores de arranque en los logs.
9. El MCP publicado respondió `list_spaces` usando el código nuevo.
10. `free_canvases` no fue retirada y sigue disponible como compatibilidad temporal.
