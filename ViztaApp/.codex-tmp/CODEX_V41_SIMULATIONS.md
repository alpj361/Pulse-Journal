# Codex v4.1 — contrato de simulaciones

Fecha: 2026-08-29

Backend: ExtractorW

Motor: `oasis_v2`

## Decisión de modelo

Una simulación es un recurso persistente por usuario. No es un `codex_universe_item` y no agrega un tipo nuevo al Codex.

- Los ocho items oficiales continúan siendo Actor, Entidad, Territorio, Evento, Historia, Objeto, Artefacto y Source.
- Post y Snippet conservan su valor en `tipo`, pero son contenido auxiliar, no items oficiales.
- Perfil continúa siendo Actor con `is_profile=true`.
- Source es un item oficial con semántica, acciones y futura interfaz propias.
- Simulación usa tablas propias porque tiene estado, eventos append-only, versiones y snapshots.

## Tablas

### `codex_simulations`

Registro principal y propiedad del usuario.

| Campo | Uso |
| --- | --- |
| `user_id` | Ownership y RLS |
| `title`, `scenario` | Identidad y escenario |
| `status` | `active`, `completed`, `failed`, `cancelled`, `archived` |
| `engine_version` | Versión del motor; nuevas corridas usan `oasis_v2` |
| `version` | Control optimista de concurrencia |
| `config` | `turns`, `batch`, `seed` |
| `participant_specs` | Selección original solicitada |
| `participants_snapshot` | Participantes ya resueltos y congelados |
| `sources_snapshot` | Sources ya resueltas y congeladas |
| `network_snapshot` | Red usada por la corrida |
| `runtime_state` | Cola, cursor, lote pendiente y `turn_token` |
| `metrics`, `analysis` | Resultado estructurado e interpretación humana/agentica |
| `context_item_ids`, `source_ids` | Trazabilidad hacia Codex |
| `parent_simulation_id` | Variante de otra simulación del mismo usuario |

### `codex_simulation_events`

Timeline append-only. Cada evento conserva participante, tipo de acción, contenido, referencia de respuesta y payload.

La restricción `(simulation_id, turn_token, participant_id)` evita duplicados del mismo lote.

### RPC `advance_codex_simulation`

Avanza un lote dentro de una transacción:

1. bloquea la simulación;
2. valida ownership y `expected_version`;
3. detecta reintentos por `turn_token`;
4. inserta eventos;
5. actualiza runtime, estado y versión.

Con `service_role`, ExtractorW debe enviar el `p_owner_id` real. Un JWT autenticado se valida con `auth.uid()`.

## Reproducibilidad

Al crear se guarda:

- la semilla;
- la versión del motor;
- la configuración;
- snapshots de participantes, Sources y red;
- la cola determinista.

Editar un Actor, Perfil o Source después no modifica una corrida existente. Para usar los datos nuevos se crea otra simulación y, si corresponde, se indica `parent_simulation_id`.

## Perfiles y Sources

Los participantes Codex se resuelven con el catálogo v4.1 (`field_key`), no con nombres libres de campos.

Si un Perfil contiene `sys_actor_profile_sources`, esas Sources se adjuntan automáticamente. `source_ids` permite agregar otras Sources explícitas. Todas deben pertenecer al usuario y ser items `Source`.

## Protocolo agentico

### Crear

```json
{
  "operation": "crear",
  "titulo": "Reacción al anuncio",
  "escenario": "El Congreso anuncia...",
  "personas": [
    { "fuente": "codex", "ids": ["actor-o-profile-uuid"] },
    { "fuente": "sintetica", "n": 20, "perfil": "jóvenes urbanos", "etiqueta": "Joven" }
  ],
  "source_ids": ["source-uuid"],
  "turnos": 30,
  "batch": 5,
  "seed": "corrida-editorial-01"
}
```

La respuesta incluye `sim_id`, `turn_token` y `turno`.

### Actuar

```json
{
  "operation": "actuar",
  "sim_id": "simulation-uuid",
  "turn_token": "turn_1_...",
  "acciones": [
    { "persona_id": "p0", "tipo": "publicar", "texto": "..." }
  ]
}
```

Debe enviarse exactamente una acción por persona del lote. Repetir el mismo `turn_token` devuelve un resultado idempotente y no duplica eventos.

Tipos: `publicar`, `responder`, `amplificar`, `callar`, `otra`.

### Consultar y cerrar

- `estado`: lectura no destructiva; no consume turnos.
- `reporte`: calcula y persiste métricas.
- `guardar_analisis`: conserva la interpretación final.
- `listar`, `obtener`: lectura para interfaz o agente.
- `archivar`, `cancelar`: cambian estado sin borrar historia.

## REST autenticado

| Método | Ruta | Operación |
| --- | --- | --- |
| `GET` | `/api/codex/simulations` | listar |
| `POST` | `/api/codex/simulations` | crear |
| `GET` | `/api/codex/simulations/:id` | obtener con eventos |
| `GET` | `/api/codex/simulations/:id/state` | estado |
| `GET` | `/api/codex/simulations/:id/report` | reporte |
| `POST` | `/api/codex/simulations/:id/actions` | actuar |
| `PATCH` | `/api/codex/simulations/:id` | guardar análisis, archivar o cancelar |

Todas las rutas usan `verifyUserAccess`; una simulación ajena responde como no encontrada/sin acceso.

## Campos personalizados

Los tools legacy `codex_add_custom_field` y `codex_set_custom_field` ya no forman parte del catálogo ni de los modos agenticos/MCP. El dispatcher conserva una defensa explícita para código interno antiguo, sin permitir escrituras por nombre libre.

Flujo vigente:

1. `codex action=resolve_field`;
2. si no existe, `create_field` con `field_key`, `field_type`, `field_label` y `field_reason`;
3. escribir con `update_universe_item.fields`, keyed por `field_key`.

No se borran valores históricos de las tablas legacy.

## Reglas para frontend

- Tratar Simulación como recurso/página, no como una card de item.
- Mostrar estado, escenario, participantes, Sources, métricas y análisis desde las tablas/rutas propias.
- No reconstruir snapshots haciendo joins contra items actuales.
- En una corrida activa, conservar y reenviar `turn_token`.
- No avanzar el cursor al refrescar; `state` es lectura.
- Sources deben mostrarse como contexto de la corrida, diferenciadas de participantes.
- Perfiles pueden mostrarse con badge “Perfil”, aunque en datos continúan siendo Actor.

## Verificación ejecutada

- persistencia después de cada operación;
- lectura repetida de estado sin mover cursor;
- reintento idempotente sin eventos duplicados;
- evento `callar` persistido y contabilizado;
- Perfil con Source adjunta automáticamente;
- snapshot de Source inmutable después de editar el item original;
- cola determinista con seed fija;
- limpieza de todos los registros temporales de prueba.
