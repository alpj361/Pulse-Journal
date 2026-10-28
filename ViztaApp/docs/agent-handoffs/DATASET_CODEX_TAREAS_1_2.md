# Handoff para agentes: contrato Dataset ↔ Codex, tareas 1 y 2

Estado: implementado, migrado y desplegado  
Fecha de corte: 7 de septiembre de 2026  
Audiencia: agentes y equipo de ingeniería  
Alcance: estructura de datos, sincronización, API REST y herramientas MCP  

> Este archivo es una fotografía técnica del trabajo ya realizado. No es documentación para usuarios. La documentación técnica en Mintlify queda pendiente para la siguiente sesión y la documentación de producto se hará después.

## 1. Cómo usar este documento

Para trabajar en Dataset ↔ Codex, el orden de autoridad es:

1. Migraciones y código desplegado de `ExtractorW`.
2. Esquema vigente de Supabase.
3. Este handoff.
4. Documentación anterior de Codex v4 y Mintlify.

Los documentos anteriores todavía pueden servir como contexto general, pero no describen estas dos tareas. En particular, `CODEX_V4_DOCUMENTACION_TECNICA.md` y el handoff móvil de Codex v4 quedaron anteriores a este contrato.

## 2. Decisión central

Un dataset y un ítem del Codex no son copias independientes del mismo objeto.

- El dataset organiza información en filas y columnas.
- El Codex conserva la ficha conceptual de un Actor, Entidad, Territorio u otro ítem.
- Una fila solo se conecta con el Codex cuando el usuario revisa y confirma la relación.
- La conexión puede limitarse a seguimiento (`track`) o habilitar sincronización (`sync`).
- Solo los campos vinculados explícitamente se sincronizan.
- La identidad del vínculo es por UUID; los nombres y labels son presentación para la interfaz.

El flujo normativo es:

```text
Dataset legacy
  → dataset canónico + filas estables
  → previsualización de coincidencias
  → revisión y confirmación del usuario
  → vincular | crear | omitir
  → seguimiento o sincronización bidireccional
  → registro de eventos y conflictos
```

## 3. Vocabulario del contrato

| Concepto | Significado |
| --- | --- |
| Dataset canónico | Registro estable del conjunto de datos, independiente de su representación legacy |
| Fila | Registro individual con UUID estable y revisión para control de concurrencia |
| Ítem Codex | Ficha conceptual propiedad del mismo usuario |
| Enlace | Asociación confirmada entre una fila y un ítem Codex |
| Binding | Regla que conecta una columna con un campo oficial/personal o una clave de `details` |
| `track` | Mantiene la relación fila–ítem, pero no propaga cambios de campos |
| `sync` | Propaga los campos aprobados en una o ambas direcciones |
| Evento | Registro auditable de sincronización, conflicto, error o decisión |
| Conflicto | Cambio que no puede aplicarse silenciosamente, por ejemplo una revisión obsoleta |

## 4. Tarea 1: fundamento de datos

### Objetivo

Crear una representación canónica de datasets y filas que pudiera conectarse al Codex sin romper los datasets existentes.

### Tablas incorporadas

| Tabla | Responsabilidad |
| --- | --- |
| `datasets` | Identidad, propietario y metadata del conjunto |
| `dataset_rows` | Filas con UUID estable, datos estructurados y revisión |
| `dataset_row_codex_links` | Relación confirmada entre fila e ítem Codex |
| `dataset_field_bindings` | Mapeo columna ↔ campo Codex o `details` |
| `codex_sync_events` | Auditoría, estado, fallos y conflictos |

### Migración y compatibilidad

- Se migraron 21 datasets legacy.
- Se migraron 3,841 filas.
- Las superficies `private_datasets` y `public_datasets` siguen disponibles para compatibilidad.
- Las escrituras legacy actualizan la representación canónica.
- Los cambios canónicos mantienen actualizado el JSON legacy cuando corresponde.
- La tarea fue aditiva: no exigió cambios inmediatos en la app móvil ni en ThePulse.

### Seguridad y propiedad

- Las tablas nuevas usan RLS por usuario.
- Un usuario solo puede modificar sus propios datasets, filas, enlaces y bindings.
- Los datasets públicos pueden consultarse según las políticas existentes, pero no alinearse ni modificarse por un usuario que no sea su propietario.
- Las funciones auxiliares sensibles no tienen permiso de ejecución para `anon`.
- Las únicas funciones auxiliares expuestas a `authenticated` son las comprobaciones documentadas de propiedad y visibilidad.

### Invariantes de la tarea 1

1. Una fila no se convierte automáticamente en un ítem Codex.
2. Toda fila canónica tiene identidad estable.
3. Toda mutación relevante incrementa o comprueba una revisión.
4. Un enlace Dataset ↔ Codex pertenece al mismo usuario en ambos extremos.
5. Los datasets legacy continúan operativos durante la transición.

### Commit principal

- `2f8a11bb feat(data): add dataset codex foundation`

## 5. Tarea 2: alineación, sincronización y herramientas

### Objetivo

Permitir que el usuario revise filas de un dataset, las conecte con ítems existentes del Codex o cree ítems confirmados, y sincronice únicamente los campos aprobados.

### Componentes del backend

| Archivo | Responsabilidad |
| --- | --- |
| `ExtractorW/server/services/datasetCodexService.js` | Reglas de preview, apply, vínculos, bindings, sincronización y conflictos |
| `ExtractorW/server/routes/datasets.js` | API REST del contrato |
| `ExtractorW/server/services/mcp.js` | Definición y ejecución de herramientas para agentes |
| `ExtractorW/server/services/mcpServer.js` | Publicación de herramientas MCP |
| `ExtractorW/server/routes/index.js` | Montaje de las rutas de datasets |
| `ExtractorW/server/services/datasetCodexService.test.js` | Pruebas unitarias del servicio |
| `ExtractorW/migrations/20260907100000_dataset_codex_sync_runtime_v1.sql` | Funciones, triggers y soporte de sincronización |
| `ExtractorW/migrations/20260907103000_dataset_contract_function_grants_v1.sql` | Restricción de permisos de funciones |

Los paths anteriores se expresan desde la raíz del repositorio general. El servicio desplegado vive en `/home/pj/ExtractorW` dentro del VPS.

Advertencia para agentes: el gitlink local `../ExtractorW` puede estar atrasado y no contener todavía estos archivos. Fueron verificados directamente en el VPS, en la rama `codex/codex-contract-v41`, con HEAD `981feb20`. No concluyas que la implementación falta basándote únicamente en el checkout local.

### Flujo obligatorio de alineación

```text
1. preview (solo lectura)
2. el usuario revisa coincidencias y bindings
3. el cliente conserva preview_token
4. apply con confirmed=true
5. cada fila declara link | create | skip
6. se crean enlaces y bindings aprobados
7. si el modo es sync, se propagan los campos autorizados
```

`apply` debe incluir:

- `confirmed: true`;
- el mismo `preview_token` vigente;
- una decisión explícita por fila revisada;
- la lista completa de bindings revisados, incluso cuando sea `[]`.

No se permite crear ítems implícitamente desde una coincidencia ambigua, exacta o por alias. En esos casos el usuario debe enlazar el ítem encontrado o resolver la ambigüedad.

### Modos de conexión

| Modo | Comportamiento |
| --- | --- |
| `track` | Conserva el enlace y permite navegación o contexto, sin copiar campos |
| `sync` | Sincroniza solo los bindings activos y aprobados |

Cambiar a `track` no elimina el enlace. Detiene la propagación de campos hasta que el usuario vuelva a habilitar `sync`.

### Destinos de binding

| Destino | Uso | Regla |
| --- | --- | --- |
| `field` | Campo oficial o personal del catálogo Codex | Requiere un `field_key` real y compatible |
| `details` | Dato adicional decidido por el usuario | Acepta una clave personalizada si no colisiona con el catálogo |

Los datos que el usuario decida incluir en `details` no necesitan existir previamente en el catálogo. Sin embargo, si la clave corresponde a un campo catalogado, debe usarse como `field` para conservar su identidad estable y su tipo.

### Dirección de sincronización

| Dirección | Efecto |
| --- | --- |
| `both` | Dataset → Codex y Codex → Dataset |
| `dataset_to_codex` | Solo cambios de la fila hacia la ficha |
| `codex_to_dataset` | Solo cambios de la ficha hacia la fila |

### Política de valores vacíos

| Política | Efecto |
| --- | --- |
| `ignore_empty` | Un valor vacío no borra el destino |
| `propagate_empty` | El vacío se propaga y puede limpiar el destino |
| `confirm_clear` | La limpieza requiere confirmación explícita |

### Concurrencia y consistencia

- `dataset_rows` utiliza revisión optimista.
- El cliente debe enviar `expected_revision` al actualizar una fila.
- Una revisión desactualizada produce conflicto en vez de sobrescribir silenciosamente.
- Los cambios Dataset → Codex pasan por el servicio de backend para validar ownership, binding y tipo.
- Los cambios Codex → Dataset se propagan mediante triggers de base de datos.
- El JSON legacy se actualiza a partir de la fila canónica.
- Un campo eliminado del Codex puede representarse como `null` en la fila según la política aprobada.

### Coincidencias para preview

El servicio admite coincidencias por:

- `name`;
- `alias`;
- `id`.

Todas las búsquedas están limitadas al usuario propietario. Un UUID de otro usuario no es un destino válido.

## 6. API REST incorporada

| Método | Endpoint | Uso |
| --- | --- | --- |
| `GET` | `/api/datasets/:datasetId/rows` | Listar filas canónicas e información del vínculo |
| `PATCH` | `/api/datasets/:datasetId/rows/:rowId` | Actualizar una fila con revisión optimista |
| `POST` | `/api/datasets/:datasetId/rows/:rowId/sync` | Ejecutar sincronización de una fila |
| `POST` | `/api/datasets/:datasetId/codex/preview` | Previsualizar coincidencias y propuesta de bindings |
| `POST` | `/api/datasets/:datasetId/codex/apply` | Aplicar decisiones confirmadas del preview |
| `POST` | `/api/datasets/:datasetId/bindings` | Crear o actualizar un binding |
| `DELETE` | `/api/datasets/:datasetId/bindings/:bindingId` | Desactivar/eliminar un binding |
| `DELETE` | `/api/datasets/:datasetId/rows/:rowId/codex-link` | Desconectar una fila del Codex |
| `GET` | `/api/datasets/:datasetId/sync-status` | Consultar enlaces, bindings y estado de sincronización |
| `GET` | `/api/datasets/:datasetId/sync-events` | Consultar historial auditable |
| `GET` | `/api/datasets/:datasetId/conflicts` | Consultar conflictos pendientes o registrados |

Las respuestas que representan vínculos hidratan nombre y tipo del ítem Codex. Una interfaz no debe mostrar UUIDs crudos como representación principal.

## 7. Herramientas MCP incorporadas

| Herramienta | Uso agentivo |
| --- | --- |
| `dataset_list_rows` | Consultar filas y sus enlaces |
| `dataset_preview_codex_alignment` | Preparar una propuesta sin escribir datos |
| `dataset_apply_codex_alignment` | Aplicar una propuesta ya confirmada por el usuario |
| `dataset_update_row` | Actualizar una fila con control de revisión |
| `dataset_bind_column` | Vincular una columna con un destino Codex |
| `dataset_unbind_column` | Retirar un binding |
| `dataset_detach_row` | Desconectar una fila de su ítem Codex |
| `dataset_sync_row` | Sincronizar una fila según sus bindings |
| `dataset_sync_status` | Consultar el estado actual |
| `dataset_list_sync_events` | Leer el historial de sincronización |
| `dataset_list_conflicts` | Revisar conflictos |

El servidor publica 21 herramientas relacionadas con datasets en total: estas 11 corresponden al contrato nuevo y conviven con herramientas legacy.

### Regla para agentes

Un agente puede preparar y explicar el preview, pero no debe llamar `dataset_apply_codex_alignment` como si la aprobación pudiera inferirse. La confirmación debe venir del usuario y debe materializarse en los argumentos exigidos por el contrato.

## 8. Errores que clientes y agentes deben manejar

| Código | Significado |
| --- | --- |
| `CONFIRMATION_REQUIRED` | Falta confirmación explícita |
| `PREVIEW_TOKEN_REQUIRED` | No se envió el token del preview |
| `PREVIEW_STALE` | El preview ya no representa el estado actual |
| `BINDINGS_ARRAY_REQUIRED` | Falta la lista completa de bindings revisados |
| `CODEX_MATCH_ALREADY_EXISTS` | Se intentó crear un ítem que ya coincide con uno existente |
| `ROW_REVISION_CONFLICT` | La fila cambió desde que el cliente la leyó |
| `DETAIL_KEY_IS_CATALOG_FIELD` | La clave de `details` debe mapearse como campo del catálogo |

Los clientes deben conservar el borrador, explicar la corrección y permitir reintentar. Un conflicto no debe resolverse sobrescribiendo automáticamente.

## 9. Verificación realizada

- 6 de 6 pruebas unitarias del servicio pasaron.
- Se ejecutó un preview de integración, solo lectura, contra un dataset de 100 filas.
- Se verificó sincronización transaccional en ambas direcciones a nivel de base de datos.
- Se verificó la representación de campos eliminados como `null` cuando corresponde.
- Se verificó RLS por usuario.
- Se comprobaron grants: `anon_execute=false` en todas las funciones auxiliares del contrato.
- El conteo posterior a pruebas permaneció en 21 datasets y 3,841 filas.
- No quedaron enlaces ni bindings creados por las pruebas: 0 enlaces confirmados y 0 bindings activos.
- ExtractorW fue reconstruido y reiniciado; el contenedor quedó `healthy`.
- `https://mcp.standatpd.com/mcp` respondió con el comportamiento esperado: `GET` 405, `POST` sin token 401 y metadata OAuth 200.

## 10. Commits de la tarea 2

- `39d4cfcd feat(data): connect datasets with Codex`
- `11f49729 fix(data): restrict dataset helper functions`
- `981feb20 fix(data): harden dataset alignment workflow`

Los commits viven en la rama de backend `codex/codex-contract-v41`.

## 11. Qué puede asumir el frontend

El frontend todavía no tuvo que cambiar para completar las tareas 1 y 2. El contrato mantiene compatibilidad con los datasets existentes.

Una implementación futura puede apoyarse en estas garantías:

1. Las filas tienen UUID estable y revisión.
2. El preview no escribe datos.
3. El usuario decide por fila entre enlazar, crear u omitir.
4. La interfaz puede mostrar nombre y tipo del Codex sin exponer UUIDs.
5. Los bindings disponibles y actuales se devuelven en preview y estado.
6. `track` y `sync` son decisiones visibles y reversibles.
7. Los conflictos y el historial se pueden consultar.
8. Los campos personalizados de `details` son válidos si el usuario los aprueba y no colisionan con el catálogo.

Superficies que se necesitarán cuando se adapte la interfaz:

- vista de filas del dataset;
- acción “Conectar con Codex”;
- revisión de coincidencias;
- selector enlazar | crear | omitir;
- catálogo para mapear columnas;
- selector seguimiento | sincronización;
- dirección y política de vacíos por binding;
- historial y conflictos;
- tarjetas, nombres y tipos visibles en lugar de UUIDs.

## 12. Límites conocidos

- No existe todavía una interfaz móvil o web para este flujo.
- El proceso `apply` coordina varias operaciones desde Node; no es una sola transacción SQL global. El servicio registra el estado de la operación y un resultado parcial si ocurre un fallo.
- El preview de alineación tiene un límite operativo de 10,000 filas.
- Los datasets públicos pueden ser visibles, pero solo su propietario puede conectarlos o sincronizarlos.
- Las APIs legacy continúan disponibles durante la transición.
- En producción todavía no hay enlaces confirmados ni bindings activos; el contrato está desplegado, pero su adopción por interfaz está pendiente.

## 13. Trabajo pendiente acordado

No continuar estas fases sin la indicación del usuario.

1. Documentar técnicamente las tareas 1 y 2 en Mintlify.
2. Preparar después la documentación orientada a usuarios, con lenguaje de producto.
3. Continuar el contrato de Espacios y Proyectos. La Tarea 3.1 ya está implementada y su handoff vive en `docs/agent-handoffs/SPACES_PROJECTS_TAREA_3.md`; 3.2 y 3.3 siguen pendientes.
4. Adaptar la app móvil cuando se defina el flujo visual.
5. Reestructurar la versión web de ThePulse después de estabilizar el contrato de datos.

## 14. Checklist antes de modificar este contrato

- [ ] Confirmar el esquema vigente en Supabase.
- [ ] Revisar las migraciones listadas en este documento.
- [ ] Revisar `datasetCodexService.js` y sus pruebas.
- [ ] Mantener RLS y propiedad por usuario.
- [ ] No crear enlaces ni ítems sin confirmación.
- [ ] No mostrar UUIDs como copy principal de interfaz.
- [ ] Conservar compatibilidad legacy mientras exista un cliente que la consuma.
- [ ] Añadir una prueba para cada nueva regla de sincronización o conflicto.
- [ ] Actualizar este handoff y, cuando corresponda, Mintlify.
