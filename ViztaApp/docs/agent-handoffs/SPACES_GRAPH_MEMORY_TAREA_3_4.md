# Handoff para agentes: Tarea 3.4, memoria semántica y grafo de Espacios

Estado: 3.4.1, 3.4.2 y 3.4.3 implementados y desplegados  
Fecha de corte: 10 de septiembre de 2026  
Audiencia: backend, datos, agentes y futuros clientes web/móvil

## 1. Objetivo

Convertir cada Espacio en una memoria consultable que combine:

- el contenido escrito y sus secciones;
- recursos vinculados del Codex, datasets y simulaciones;
- similitud semántica;
- asociaciones explícitas e inferidas;
- agrupaciones visibles que ayuden a organizar el trabajo.

El resultado esperado se parece a una memoria de notas conectadas: una pregunta puede recuperar fragmentos relevantes, explicar de dónde salieron y mostrar conexiones con otros elementos del mismo Espacio. Un Proyecto puede consultar el conjunto de sus Espacios, pero no duplica el grafo.

## 2. División acordada

### 3.4.1 — Contrato privado

Define las estructuras, reglas de propiedad y estados de revisión. No genera embeddings ni cambia el MCP.

Estado: implementado.

### 3.4.2 — Indexador

Debe:

1. observar cambios en fuentes canónicas;
2. extraer texto legible;
3. normalizar y dividir el texto en fragmentos;
4. calcular `content_hash` y reutilizar fragmentos sin cambios;
5. generar embeddings con un único modelo y dimensión documentados;
6. proponer asociaciones y agrupaciones semánticas;
7. eliminar fragmentos obsoletos cuando una fuente se edite o se elimine;
8. registrar errores y permitir reintentos idempotentes.

Estado: implementado y desplegado en ExtractorW.

### 3.4.3 — Recuperación GraphRAG

Debe combinar búsqueda literal, similitud vectorial y expansión controlada del grafo. También debe exponer resultados trazables al MCP, aplicar presupuestos de contexto y medir precisión con preguntas conocidas.

Estado: implementado y desplegado en ExtractorW/MCP.

## 3. Decisiones conceptuales

### Espacio

Continúa siendo la unidad de trabajo y la micromemoria. No se crea otro tipo de Espacio para representar conceptos.

### Concepto

Es una señal semántica calculada por el sistema: varios fragmentos parecen hablar de una misma idea. Puede producir una sugerencia, pero no es por sí solo una estructura confirmada por el usuario.

### Agrupación

Es una colección visible dentro de un Espacio. Puede ser:

- creada manualmente;
- creada por un agente;
- sugerida por análisis semántico;
- reservada por el sistema.

Una sugerencia puede aceptarse, renombrarse, rechazarse, archivarse o combinarse posteriormente. Mientras tenga estado `suggested`, no debe presentarse como una decisión del usuario.

### Asociación

Es una arista entre dos elementos del mismo Espacio. Puede expresar pertenencia, mención, referencia, apoyo, contradicción, secuencia, derivación o una relación general.

Una asociación semántica es una inferencia y conserva evidencia y confianza. Las relaciones explícitas del Codex siguen siendo hechos canónicos en `codex_relations`; el grafo de Espacios no debe sobrescribirlas.

## 4. Contrato implementado

### `workspace_memory_chunks`

Índice semántico privado, separado de `embeddings_index`, que actualmente contiene principalmente noticias y memoria global.

Campos centrales:

| Campo | Propósito |
| --- | --- |
| `user_id` | Propietario obligatorio del fragmento. |
| `source_type` + `source_id` | Fuente canónica; no se copia su identidad. |
| `chunk_index` | Orden del fragmento dentro de la fuente. |
| `content` | Texto recuperable y citable. |
| `content_hash` | SHA-256 normalizado para reindexado idempotente. |
| `embedding` | Vector opcional de 3,072 dimensiones. |
| `embedding_model` | Modelo que generó el vector. |
| `token_count` | Medición para presupuestos de contexto. |
| `language` | Idioma del fragmento; comienza en `es`. |
| `metadata` | Datos auxiliares estructurados. |

Fuentes admitidas inicialmente:

```text
space | space_section | codex_item | codex_auxiliary | dataset |
dataset_row | simulation | project_decision | project_memory
```

La base valida que la fuente pertenezca al mismo usuario antes de aceptar el fragmento.

Acceso:

- `anon`: ninguno;
- `authenticated`: ninguno directamente;
- `service_role`: lectura y escritura;
- RLS: activa, con política explícita para el servicio.

Los clientes no reciben embeddings ni pueden insertar texto como si ya hubiese sido indexado. Las consultas futuras deben pasar por funciones limitadas o por ExtractorW.

Índices:

- fuente y propietario;
- fecha de actualización;
- texto completo en español;
- HNSW de distancia coseno sobre `halfvec(3072)`.

### `space_groups`

Agrupaciones visibles dentro de un Espacio.

Campos centrales:

| Campo | Propósito |
| --- | --- |
| `space_id` + `user_id` | Aislamiento y pertenencia al Espacio. |
| `name`, `description` | Presentación comprensible. |
| `origin` | `user`, `agent`, `semantic` o `system`. |
| `status` | `suggested`, `confirmed`, `rejected` o `archived`. |
| `position` | Orden visual. |
| `representative_terms` | Términos que explican una propuesta. |
| `centroid_embedding` | Centro semántico opcional de la agrupación. |
| `revision` | Control de cambios. |

Los usuarios autenticados pueden leer únicamente sus propias agrupaciones. La escritura inicial queda restringida al backend; una API posterior debe validar las transiciones de estado.

### `workspace_graph_edges`

Asociaciones del grafo dentro de un Espacio.

Extremos admitidos:

```text
space | group | space_section | codex_item | codex_auxiliary |
dataset | dataset_row | folder | simulation
```

Relaciones iniciales:

```text
member_of | related_to | mentions | references | supports |
contradicts | precedes | derived_from
```

Cada arista conserva:

- origen;
- estado;
- confianza;
- peso;
- dirección;
- evidencia;
- versión del modelo;
- metadatos y fechas.

La base rechaza:

- extremos de otro usuario;
- elementos que no estén asociados al mismo Espacio;
- autorrelaciones;
- `member_of` cuyo destino no sea una agrupación;
- duplicados de la misma relación.

Los usuarios autenticados pueden leer únicamente sus propias asociaciones. La escritura inicial queda restringida al backend para impedir que un cliente falsifique procedencia, evidencia o confianza.

## 5. Límites deliberados de 3.4.1

- No se generaron embeddings.
- No se hizo backfill de contenido histórico.
- No se creó todavía una cola de indexado.
- No se expusieron funciones públicas de búsqueda vectorial.
- No se modificó la herramienta MCP.
- No se proyectaron automáticamente `codex_relations` al grafo.
- No se añadió interfaz móvil ni web.
- No se reorganizó ningún Espacio existente.

## 6. Indexador implementado en 3.4.2

### Cola durable e idempotente

`workspace_memory_index_jobs` conserva un trabajo combinado por usuario y fuente. Los cambios repetidos incrementan `generation` en vez de multiplicar filas. El trabajador reclama lotes con bloqueo transaccional y solo puede aplicar resultados si la generación sigue vigente; un trabajador atrasado no puede sobrescribir una edición posterior.

Las fuentes canónicas crean trabajos automáticamente mediante triggers:

```text
spaces | space_sections | codex_universe_items | codex_items |
datasets | dataset_rows | codex_simulations | project_decisions |
project_memory | workspace_resources
```

Una eliminación produce un trabajo `delete`. Una edición produce `upsert`. Los reintentos usan espera exponencial y guardan el error para diagnóstico.

### Documento legible y fragmentación

El servicio `server/services/workspaceMemoryIndexer.js`:

- lee la fila canónica y comprueba `user_id`;
- transforma objetos en texto útil sin añadir UUIDs técnicos;
- añade contexto del dataset a sus filas;
- divide cada documento en fragmentos de hasta 3,200 caracteres con 320 caracteres de solapamiento;
- calcula SHA-256 sobre contenido normalizado;
- conserva el vector anterior cuando coinciden hash y modelo;
- borra fragmentos que dejaron de existir.

Los valores son parámetros de arranque y pueden medirse antes de modificarlos:

```text
WORKSPACE_MEMORY_CHUNK_SIZE
WORKSPACE_MEMORY_CHUNK_OVERLAP
WORKSPACE_MEMORY_BATCH_SIZE
WORKSPACE_MEMORY_POLL_MS
```

### Embeddings

El modelo activo es `google/gemini-embedding-2`, consultado mediante OpenRouter, con 3,072 dimensiones. El indexador valida tanto la cantidad de vectores como su dimensión antes de escribirlos.

Consecuencia de privacidad: al indexar una fuente, su texto legible se envía a OpenRouter para calcular el vector. No se ejecutó un backfill de contenido privado histórico. Ese backfill requiere una decisión explícita separada; los cambios posteriores sí entran en la cola automática mientras el indexador esté habilitado.

El servicio puede pausarse con:

```text
WORKSPACE_MEMORY_INDEXER_ENABLED=false
```

### Asociaciones y agrupaciones sugeridas

Después de indexar una fuente, el servicio busca vecinos semánticos del mismo usuario y Espacio. Las coincidencias producen:

- asociaciones `related_to` con confianza, evidencia y modelo;
- una agrupación `origin=semantic`, `status=suggested` cuando existen al menos tres miembros relacionados;
- asociaciones `member_of` hacia esa agrupación.

El propio Espacio puede recuperarse como texto, pero no se usa como miembro de una agrupación interna. Las propuestas con miembros solapados se reutilizan o combinan para evitar duplicados. Una agrupación confirmada, rechazada o archivada con el mismo núcleo de miembros impide que el sistema vuelva a crear la misma sugerencia.

Los términos se comparan sin depender de tildes, pero conservan la forma escrita para presentar nombres legibles.

## 7. Verificación realizada

- Migración `workspace_graph_memory_contract_v1`: aplicada correctamente.
- Migración `workspace_graph_memory_service_policy_v1`: aplicada correctamente.
- Migración `workspace_graph_memory_fk_indexes_v1`: aplicada correctamente.
- RLS activa en las tres tablas.
- `anon` no tiene lectura ni escritura.
- `authenticated` puede leer agrupaciones y asociaciones propias, pero no escribirlas.
- `workspace_memory_chunks` no es legible directamente por clientes autenticados.
- `service_role` tiene CRUD sobre las tres tablas.
- El índice HNSW de 3,072 dimensiones fue creado mediante `halfvec`, compatible con la extensión instalada.
- Una prueba transaccional creó un fragmento, una agrupación y una asociación, incrementó la revisión de la agrupación y rechazó un `member_of` inválido.
- Otra prueba transaccional rechazó una fuente inexistente y un recurso asociado a otro Espacio.
- La prueba se revirtió y no dejó filas ficticias.
- El auditor no reportó problemas de seguridad asociados con las tablas o funciones nuevas.
- Las claves foráneas compuestas hacia Espacios tienen índices en el orden declarado.

Verificación adicional de 3.4.2:

- La cola combinó actualizaciones y rechazó la finalización de un trabajador con generación atrasada.
- La sustitución atómica creó, conservó y eliminó fragmentos según el contenido vigente.
- Se ejecutaron 6 pruebas unitarias dentro del contenedor: 6 aprobadas, 0 fallidas, 427 ms medidos.
- Una fuente sintética produjo un vector de 3,072 dimensiones en 1,680 ms.
- Al reindexar el mismo contenido se reutilizó 1 fragmento, se generaron 0 embeddings y el lote terminó en 314 ms.
- Tres actores sintéticos relacionados produjeron 1 agrupación sugerida y 6 asociaciones; 0 asociaciones trataron al Espacio como miembro.
- Al rechazar la agrupación y reindexar un actor quedaron 0 agrupaciones nuevas sugeridas y 1 rechazada.
- La limpieza procesó 4 trabajos de borrado: 4 completados, 0 fallidos y 0 atrasados.
- La comprobación posterior encontró 0 Espacios, actores, recursos, grupos, asociaciones, fragmentos o trabajos sintéticos residuales.
- La cola global quedó con 0 trabajos pendientes antes del despliegue.
- El contenedor `extractorw-api` quedó `healthy`; `/health` respondió HTTP 200.
- El inicio del contenedor registró el indexador activo con intervalo de 5,000 ms.
- La inicialización pública de MCP sin credenciales respondió HTTP 401 con exigencia de Bearer token, lo que confirma disponibilidad y control de acceso.

El auditor sí conserva hallazgos históricos de otras tablas y funciones. No forman parte de esta tarea. La política explícita de servicio evita que `workspace_memory_chunks` quede como una tabla RLS sin ninguna política.

## 8. Migraciones preservadas

- `docs/agent-handoffs/sql/20260909100000_workspace_graph_memory_contract_v1.sql`
- `docs/agent-handoffs/sql/20260909103000_workspace_graph_memory_service_policy_v1.sql`
- `docs/agent-handoffs/sql/20260909104500_workspace_graph_memory_fk_indexes_v1.sql`
- `docs/agent-handoffs/sql/20260909130000_workspace_memory_indexing_pipeline_v1.sql`
- `docs/agent-handoffs/sql/20260909133000_workspace_memory_queue_priority_fix_v1.sql`
- `docs/agent-handoffs/sql/20260909140000_workspace_memory_semantic_neighbors_v1.sql`
- `docs/agent-handoffs/sql/20260909143000_workspace_memory_guarded_apply_v1.sql`
- `docs/agent-handoffs/sql/20260909150000_workspace_memory_neighbor_scope_fix_v1.sql`
- `docs/agent-handoffs/sql/20260910100000_workspace_graphrag_retrieval_v1.sql`

Ya figuran en el historial remoto de Supabase y no deben reaplicarse.

El despliegue de ExtractorW quedó versionado en:

```text
rama: codex/codex-contract-v41
commit: 6e280cd1 feat(workspace): add semantic memory indexer
commit: 68417944 feat(workspace): add editorial GraphRAG retrieval
commit: 59303ede feat(vizta): expose editorial workspace memory
```

## 9. Reglas vigentes del indexador

1. Obtener el usuario desde la sesión o desde un trabajo interno validado, no desde texto libre del agente.
2. Usar la fuente canónica y mantener `(user_id, source_type, source_id, chunk_index)` estable.
3. Usar el mismo modelo de embedding para documentos y consultas.
4. No recalcular fragmentos cuyo `content_hash` no cambió.
5. No mezclar la memoria privada con `embeddings_index`.
6. Producir evidencia legible para cada asociación inferida.
7. Crear agrupaciones automáticas como `origin=semantic` y `status=suggested`.
8. No convertir similitud en hecho del Codex.
9. Eliminar o marcar como obsoletos los fragmentos que ya no existen en la fuente.
10. Medir tamaño de fragmento, solapamiento, latencia, cobertura y tasa de error antes de ajustar parámetros.

## 10. Recuperación GraphRAG implementada en 3.4.3

### Propósito editorial

La memoria semántica ayuda a encontrar y producir trabajo dentro de Espacios creados por el usuario. No propone ni crea Espacios. Tampoco mueve contenido ni convierte similitud en una relación oficial del Codex.

La separación vigente es:

```text
Codex → conocimiento reutilizable
Espacio → trabajo editorial con propósito
Memoria semántica → búsqueda y conexiones
Resultado → análisis, informe, artículo, demanda u otro producto
```

El grafo es una superficie opcional de descubrimiento y explicación. La búsqueda y la generación contextual son el uso principal.

### Búsqueda híbrida

`workspace_hybrid_search` combina:

- búsqueda vectorial sobre embeddings de 3,072 dimensiones;
- búsqueda de texto completo en español;
- fusión por rango recíproco para evitar comparar escalas incompatibles;
- filtros por propietario, Proyecto y Espacio;
- etiquetas legibles para cada fuente.

El servicio `workspaceMemoryRetrieval.js` genera el vector de la consulta, recupera fragmentos, elimina conexiones repetidas y arma un contexto que no supera `max_chars`. Si el proveedor de embeddings no está disponible, puede continuar con búsqueda textual. Mientras no exista backfill histórico, una búsqueda sin resultados en el índice nuevo conserva la búsqueda literal anterior como compatibilidad.

Cada fragmento devuelto tiene una referencia como `[F1]` y conserva:

- fuente y tipo;
- fragmento exacto;
- Espacio asociado;
- puntuación semántica, textual e híbrida;
- identificadores internos para trazabilidad, sin mostrarlos como texto principal al usuario.

### Expansión del grafo

`workspace_get_graph_connections` recupera conexiones cercanas a las fuentes encontradas. Las respuestas distinguen:

- `confirmed`: decisión editorial confirmada;
- `suggested`: inferencia pendiente de revisión.

Las conexiones rechazadas o archivadas no entran al contexto activo. Las sugerencias pueden omitirse con `include_suggestions=false`.

### Revisión editorial

El MCP `workspace` incorpora:

| Acción | Resultado |
| --- | --- |
| `search_memory` | Busca por texto y significado, con fuentes y conexiones. |
| `search_context` | Usa la misma recuperación híbrida y mantiene compatibilidad literal. |
| `list_discoveries` | Lista agrupaciones y conexiones activas de un Espacio. |
| `review_group` | Confirma, rechaza, archiva o renombra una agrupación. |
| `review_connection` | Confirma, rechaza o archiva una conexión. |

Confirmar una agrupación también confirma sus asociaciones de pertenencia. Rechazarla o archivarla propaga ese estado a sus miembros. Las conexiones `related_to` se revisan por separado. Ninguna acción escribe en `codex_relations`.

### Seguridad

Las cinco funciones nuevas son `SECURITY DEFINER`, fijan `search_path` y solo pueden ejecutarse con `service_role`. `anon` y `authenticated` tienen `EXECUTE=false`. El usuario llega desde la sesión MCP; no se acepta un propietario enviado como texto libre por el agente.

### Verificación medida

- Prueba SQL transaccional: 2 resultados híbridos; agrupación confirmada y renombrada; conexión rechazada; pertenencia confirmada; 1 conexión activa después de la revisión.
- Prueba completa con datos sintéticos: 4 trabajos indexados, 4 resultados, 4 citas y 6 conexiones.
- La respuesta visible de esa prueba contenía 0 UUIDs.
- Se creó 1 agrupación sugerida; luego quedó confirmada. Una conexión sugerida quedó rechazada.
- Limpieza: 4 trabajos de borrado completados; 0 Espacios, secciones, fragmentos, grupos, conexiones o trabajos residuales.
- Suite final dentro del contenedor: 10 pruebas aprobadas, 0 fallidas, 685 ms medidos.
- `extractorw-api`: saludable; `/health`: HTTP 200.
- MCP público: HTTP 401 sin Bearer token, confirmando que la ruta está disponible y exige autenticación.
- El catálogo desplegado expone las cuatro acciones nuevas y describe explícitamente el control editorial.
- El agente interno de Vizta conoce las mismas acciones y solo debe revisar inferencias cuando el usuario lo pida explícitamente.
- Los asesores de Supabase no reportaron hallazgos nuevos asociados con estas funciones. Los hallazgos históricos de otros objetos permanecen fuera de esta tarea.

## 11. Límites posteriores a 3.4

- No se ejecutó backfill privado histórico.
- No se construyó una interfaz de grafo web o móvil.
- No se añadió generación automática de documentos dentro de `workspace`; los agentes utilizan el contexto recuperado para redactar y el usuario decide dónde guardar el resultado.
- La calidad semántica deberá medirse posteriormente con preguntas reales de usuarios y resultados esperados antes de ajustar pesos o umbrales.

## 12. Referencias técnicas oficiales

- [Búsqueda semántica con pgvector](https://supabase.com/docs/guides/ai/semantic-search)
- [Índices vectoriales](https://supabase.com/docs/guides/ai/vector-indexes)
- [RAG con permisos](https://supabase.com/docs/guides/ai/rag-with-permissions)
