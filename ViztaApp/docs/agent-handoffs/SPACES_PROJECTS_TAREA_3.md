# Handoff para agentes: Tarea 3, Proyectos y Espacios

Estado: Tarea 3 completa; 3.1–3.4 desplegadas en Supabase y ExtractorW  
Fecha de corte: 10 de septiembre de 2026  
Audiencia: agentes y equipo de ingeniería  

## 1. División acordada

La Tarea 3 se divide en fragmentos cortos:

| Fragmento | Alcance | Estado |
| --- | --- | --- |
| 3.1 | Identidad canónica de Espacios, relación opcional con Proyectos y seguridad por usuario | Implementado |
| 3.2 | Estructura interna del Espacio y vínculos normalizados con Codex, datasets, carpetas y otras fuentes | Implementado |
| 3.3 | API/MCP, recuperación de contexto y reglas para usar Proyecto o Espacio como memoria | Implementado y desplegado |
| 3.4 | Memoria semántica y grafo privado de cada Espacio | Implementado y desplegado |

Las variables de Proyecto permanecen fuera de estos tres fragmentos y se definirán en una fase posterior.

## 2. Corrección conceptual importante

`free_canvases` ya representaba los Espacios. No debía crearse una tabla paralela.

El contrato ahora establece:

- `spaces` es la tabla canónica.
- `free_canvases` es una vista temporal y obsoleta para compatibilidad.
- Un Espacio puede existir sin Proyecto.
- Cuando tiene `project_id`, el Proyecto debe pertenecer al mismo usuario.
- El lienzo es una posible vista o forma de editar un Espacio; no es la identidad del Espacio.

## 3. Estado encontrado antes de 3.1

- 7 proyectos existentes.
- 10 registros en `free_canvases`.
- 4 de esos registros estaban asociados a un proyecto.
- 0 asociaciones tenían propietarios incompatibles.
- `project_collaborators` existe, pero contiene 0 filas y la colaboración activa continúa fuera de alcance.
- Los datos del Espacio viven actualmente en un objeto JSONB con combinaciones de:
  - `canvasItems`;
  - `connections`;
  - `datasetNodes`;
  - `docNodes`;
  - `drawPaths`;
  - `notes`;
  - `positions`;
  - `promptCards`.

También existían previamente:

- `espacio_items`;
- `espacio_conexiones`;
- `espacio_index`;
- funciones de búsqueda, contexto, relación y reindexado de Espacios.

Estas estructuras derivan parte del JSONB, pero todavía no constituyen el contrato completo planteado para secciones, documentos, datasets y recursos.

## 4. Tarea 3.1 implementada

### Renombre canónico

La tabla física `public.free_canvases` fue renombrada a `public.spaces`.

También se renombraron:

- clave primaria;
- foreign keys principales;
- índices;
- trigger y función de `updated_at`;
- políticas RLS.

La migración registrada en Supabase es:

- `spaces_canonical_rename_v1`

### Compatibilidad

Se creó una vista automáticamente actualizable:

```text
public.free_canvases → public.spaces
```

La vista tiene `security_invoker=true`, por lo que conserva las políticas RLS de `spaces`. Es únicamente un puente para clientes todavía no migrados y debe retirarse cuando el backend del VPS ya no la consulte.

### Relación Proyecto → Espacio

La relación es opcional:

```text
projects 1 ───── 0..N spaces
```

La foreign key ahora usa `(project_id, user_id)`. Esto impide asociar el Espacio de un usuario con el Proyecto de otro usuario, incluso si se conoce el UUID.

Al eliminar un Proyecto:

- `project_id` se vuelve `null`;
- el Espacio permanece disponible como Espacio independiente;
- `user_id` no cambia.

### Acceso

- `authenticated`: puede leer, crear, editar y eliminar sus propios Espacios mediante RLS.
- `anon`: no tiene permisos sobre `spaces` ni sobre la vista legacy.
- `service_role`: conserva acceso operativo.
- Las funciones internas `espacio_*` y `sync_espacio_*` dejaron de ser ejecutables por `anon` y `authenticated`; solo `service_role` puede invocarlas directamente.
- `set_spaces_updated_at()` tiene un `search_path` fijo.

Migraciones de seguridad:

- `spaces_function_security_v1`
- `spaces_function_security_fix_v1`

El nombre por defecto también cambió de “Canvas sin título” a “Espacio sin título” mediante `spaces_default_name_v1`.

## 5. Clientes adaptados

Las consultas conocidas fueron cambiadas para utilizar `spaces`:

- `ViztaApp/apps/mobile/src/utils/codexSpaces.js`
- `ViztaApp/apps/mobile/src/app/(tabs)/codex.jsx`
- `ThePulse/src/services/canvasService.ts`
- comentarios técnicos relacionados en ThePulse.

Los nombres internos `FreeCanvas*` de algunos componentes de ThePulse todavía describen el modo visual de lienzo o conservan compatibilidad de código. La tabla consultada ya es `spaces`. Su renombre de componentes puede hacerse durante la reestructuración web, sin volver a cambiar el contrato de datos.

El MCP del VPS consulta `spaces`. La vista `free_canvases` permanece únicamente para clientes legacy que todavía no hayan migrado.

## 6. Verificación de 3.1

- `spaces` es una tabla física.
- `free_canvases` es una vista.
- Ambas superficies devuelven los mismos 10 registros.
- Los 4 Espacios asociados conservaron su Proyecto.
- Continúan existiendo 0 asociaciones con propietario incompatible.
- Se probó una actualización transaccional tanto por `spaces` como por la vista legacy; ambas rutas funcionaron y se revirtieron.
- Las funciones internas verificadas reportan:
  - `anon_execute=false`;
  - `authenticated_execute=false`;
  - `service_role_execute=true`.
- El auditor de Supabase ya no reporta hallazgos asociados con `free_canvases`, `set_spaces_updated_at` ni las funciones internas de Espacios.
- `node --check` pasó para el servicio móvil de Espacios.
- El build de ThePulse terminó correctamente. Conserva advertencias previas no relacionadas, incluida una propiedad JSX `ref` duplicada en `EntityColumn.tsx`.

## 7. Archivos SQL preservados localmente

Las copias exactas de las migraciones también permanecen en:

- `docs/agent-handoffs/sql/20260907120000_spaces_canonical_rename_v1.sql`
- `docs/agent-handoffs/sql/20260907123000_spaces_function_security_v1.sql`
- `docs/agent-handoffs/sql/20260907124500_spaces_function_security_fix_v1.sql`
- `docs/agent-handoffs/sql/20260907125500_spaces_default_name_v1.sql`

Estos archivos ya fueron copiados a `ExtractorW/migrations` y versionados. No deben reaplicarse a Supabase: ya figuran en el historial remoto.

## 8. Tarea 3.2 implementada

Objetivo: separar la estructura conceptual del Espacio de su representación de lienzo.

### Metadatos del Espacio

`spaces` ahora incorpora:

- `description`;
- `space_kind`;
- `status`;
- `position`;
- `revision`;
- `metadata`.

Los tipos iniciales de Espacio son:

```text
document | story | article | case | research | market_research |
workflow | deck | other
```

El tipo describe el uso general. No fija la estructura interna: un artículo y una demanda pueden usar secciones distintas sin necesitar otra tabla.

### Secciones jerárquicas

Se creó `space_sections`. Cada sección:

- pertenece al mismo usuario que su Espacio;
- puede tener una sección madre del mismo Espacio;
- tiene orden, tipo, título, contenido editable, texto extraído y revisión;
- no puede crear ciclos jerárquicos;
- tiene RLS por propietario.

Los tipos iniciales de sección son:

```text
part | chapter | section | subsection | scene | page |
step | slide | block | custom
```

Esto permite representar, por ejemplo:

- novela → parte → capítulo → escena;
- demanda → apartado → página o subsección;
- investigación → línea de trabajo → paso;
- presentación → diapositiva;
- artículo → sección → subsección.

### Recursos vinculados

Se creó `workspace_resources`. Una asociación apunta a exactamente un Proyecto o un Espacio y referencia, sin copiar:

- ítem oficial del Codex;
- auxiliar del Codex, como Post o Snippet;
- dataset;
- carpeta;
- simulación.

Cada asociación también declara su función:

```text
context | reference | evidence | subject | output | attachment
```

La base valida que tanto el contenedor como el recurso pertenezcan al mismo usuario. Esto evita referencias cruzadas aunque se conozca un UUID ajeno.

### Compatibilidad del lienzo

`spaces.data` continúa guardando la representación visual legacy. No se eliminó ninguna nota, posición, conexión o trazo.

Se migraron 280 referencias válidas de `canvasItems`:

- 279 ítems oficiales del Codex;
- 1 auxiliar del Codex.

Cinco identificadores históricos que ya no existen en las tablas canónicas permanecen en `spaces.data`; no se inventó ni se duplicó un recurso para ellos.

Migración:

- `spaces_structure_resources_v1`

## 9. Tarea 3.3

Objetivo: hacer que agentes y servicios recuperen contexto limitado y trazable sin consultar o descargar indiscriminadamente todas las tablas.

### Contrato activo en Supabase

Se implementaron estas funciones:

| Función | Uso |
| --- | --- |
| `workspace_get_space_context` | Lee todo un Espacio o el subárbol de una sección. |
| `workspace_get_project_context` | Compone el Proyecto a partir de sus Espacios, recursos, Codex, datasets, decisiones y memoria. |
| `workspace_search_context` | Busca en secciones normalizadas y en el índice legacy del Espacio. |
| `workspace_hydrate_resource` | Convierte una asociación en un resumen útil con nombre, tipo y datos visibles. |

Reglas aplicadas:

1. Toda lectura recibe el `user_id` autenticado y comprueba propiedad.
2. Las funciones solo pueden ejecutarse con `service_role`; `anon` y `authenticated` tienen `EXECUTE=false`.
3. El contexto se limita mediante un presupuesto de caracteres.
4. Una sección seleccionada incluye sus descendientes, no secciones hermanas no solicitadas.
5. Los recursos se devuelven hidratados; un cliente no recibe únicamente UUIDs crudos.
6. Los recursos se referencian y no se copian al Proyecto ni al Espacio.
7. El Proyecto reparte su presupuesto entre los Espacios activos.
8. Las respuestas indican truncamiento y cantidad total para que el agente pueda solicitar una lectura más específica.

Migraciones:

- `workspace_context_api_v1`
- `workspace_contract_performance_v1`

### Pruebas realizadas

- Árbol transaccional raíz → hija: 2 secciones recuperadas.
- Presupuesto solicitado: 1,500 caracteres; presupuesto incluido: 1,500.
- Búsqueda de una marca textual transaccional: 1 resultado.
- La transacción de prueba se revirtió: producción conserva 0 secciones ficticias.
- Recurso hidratado: devuelve tipo y nombre visible.
- Integridad: 10 Espacios, 280 asociaciones y 0 asociaciones entre usuarios diferentes.
- El MCP Vizta activo respondió `list_spaces` con los 9 Espacios del usuario conectado mediante la vista compatible; el cambio de esquema no rompió la herramienta legacy.
- Auditor de seguridad: 0 hallazgos nuevos para las tablas y funciones de 3.2/3.3.

### Adaptación desplegada en ExtractorW/MCP

La herramienta `workspace` ahora:

- consulta la tabla canónica `spaces`;
- usa `workspace_get_space_context` y `workspace_get_project_context` para lecturas limitadas;
- conoce secciones jerárquicas y `workspace_resources`;
- permite buscar contexto, asociar recursos y devolverlos hidratados;
- mantiene las acciones legacy;
- conserva temporalmente el nodo visual en `spaces.data` y crea además la asociación normalizada cuando se agrega un ítem al lienzo.

Despliegue del 8 de septiembre de 2026:

- rama: `codex/codex-contract-v41`;
- commit: `fa4e2ca7` (`feat(workspace): complete spaces contract v3`);
- contenedor reconstruido: `extractorw-api`;
- health check: `healthy`;
- el hash de `server/services/mcp.js` coincide entre el worktree y `/app`;
- una llamada al MCP publicado mediante Vizta devolvió los 9 Espacios y los nuevos campos `space_kind`, `status` y `revision`.

La sesión MCP que ya estaba abierta puede conservar el esquema anterior en caché. Al reconectar o iniciar una sesión nueva, el catálogo debe cargar las acciones nuevas.

El contrato operativo exacto está en:

- `docs/agent-handoffs/EXTRACTORW_WORKSPACE_3_3_HANDOFF.md`

## 10. Archivos SQL añadidos para 3.2 y 3.3

- `docs/agent-handoffs/sql/20260908100000_spaces_structure_resources_v1.sql`
- `docs/agent-handoffs/sql/20260908113000_workspace_context_api_v1.sql`
- `docs/agent-handoffs/sql/20260908124500_workspace_contract_performance_v1.sql`

Estos archivos ya están en `ExtractorW/migrations` y forman parte del commit `fa4e2ca7`. No deben reaplicarse a Supabase: ya están registrados en el historial remoto.

## 11. Restricciones para el próximo agente

- No crear otra tabla de Espacios.
- No tratar el lienzo como la identidad completa del Espacio.
- No insertar todos los recursos dentro de `spaces.data` como solución final.
- No permitir relaciones entre usuarios distintos.
- No eliminar la vista legacy hasta actualizar y verificar ExtractorW por SSH.
- No exponer las funciones `workspace_*` directamente a clientes con `anon` o `authenticated`.
- No devolver todo el Proyecto sin presupuesto de contexto ni marcas de truncamiento.
- No implementar colaboración activa todavía.
- No incorporar variables de Proyecto en 3.2 o 3.3 sin una decisión nueva del usuario.

## 12. Extensión 3.4: memoria semántica y grafo

Antes de reestructurar la versión web se añadió la Tarea 3.4, dividida en:

| Fragmento | Alcance | Estado |
| --- | --- | --- |
| 3.4.1 | Contrato privado de fragmentos semánticos, agrupaciones y asociaciones | Implementado en Supabase |
| 3.4.2 | Indexador: extracción, fragmentación, embeddings y propuestas de agrupación | Implementado y desplegado |
| 3.4.3 | Recuperación GraphRAG, fuentes, MCP y medición de calidad | Implementado y desplegado |

Decisión de producto: una agrupación vive dentro de un Espacio. Un concepto detectado automáticamente puede proponer una agrupación, pero no reorganiza ni cambia la estructura confirmada sin aceptación del usuario.

El contrato, las reglas de seguridad y la evidencia de 3.4 se documentan en:

- `docs/agent-handoffs/SPACES_GRAPH_MEMORY_TAREA_3_4.md`

El indexador de 3.4.2 quedó desplegado en `extractorw-api` mediante el commit `6e280cd1`. Usa una cola durable, fragmentos con hash reutilizable y embeddings de 3,072 dimensiones. No se ejecutó backfill de contenido privado histórico; esa operación permanece separada hasta que exista una autorización explícita.

La recuperación editorial de 3.4.3 quedó desplegada mediante el commit `68417944`. `search_context` y `search_memory` combinan significado y texto, devuelven citas, respetan presupuesto y pueden expandir conexiones. `list_discoveries`, `review_group` y `review_connection` permiten revisar inferencias sin crear Espacios ni modificar las relaciones oficiales del Codex.

El commit selectivo `59303ede` actualiza el contrato del agente interno de Vizta para que pueda invocar esas acciones. Los demás cambios que ya existían en ese archivo permanecen fuera de ese commit.
