# Codex v4: documentación técnica

Estado del contrato: `v4`  
Backend: ExtractorW  
Persistencia: Supabase, proyecto `qqshdccpmypelhmyqnut`

## 1. Arquitectura

Codex v4 separa tres conceptos:

- `field_key`: identidad estable del campo.
- `label`: texto visible y modificable.
- `value`: dato validado según `field_type`.

Componentes principales:

| Componente | Responsabilidad |
| --- | --- |
| `server/services/codexSchema.js` | Tipos normativos, campos del sistema, aliases y tipos canónicos |
| `server/services/codexContractV4.js` | Resolución, creación, validación, presets y lectura resuelta |
| `server/routes/codex.js` | API REST |
| `server/services/mcp.js` | Acciones para agentes |
| `codex_universe_items` | Ítems estructurados del usuario |
| `codex_user_fields` | Catálogo de campos personales |
| `codex_user_presets` | Presets personales |

`codex_items` continúa funcionando como biblioteca de archivos, monitoreos y contenido capturado. El contrato v4 opera principalmente sobre `codex_universe_items`.

### Flujo

1. El cliente solicita el schema.
2. Selecciona campos mediante `field_key`.
3. Construye un objeto `fields` keyed por esas claves.
4. El backend valida cada valor según `field_type`.
5. Las referencias se verifican contra los ítems del mismo usuario.
6. La lectura devuelve campos resueltos con definición, valor y estado.

### Convenciones

| Origen | Convención | Ejemplo |
| --- | --- | --- |
| Campo del sistema | `sys_<tipo>_<slug>` | `sys_actor_cargo` |
| Campo personal | `usr_<slug>` | `usr_oficina` |
| Preset del sistema | `sys_base_<tipo>` | `sys_base_actor` |
| Preset personal | `usr_preset_<slug>` | `usr_preset_politica` |

Los campos del sistema viven en ExtractorW. Los campos y presets personales viven en Supabase y se aíslan por `user_id`.

## 2. Modelo de datos

### codex_universe_items

Columnas relevantes:

| Columna | Tipo | Uso |
| --- | --- | --- |
| `id` | UUID | Identidad del ítem |
| `user_id` | UUID | Propietario |
| `tipo` | citext | Tipo canónico |
| `name` | text | Nombre principal |
| `description` | text nullable | Resumen |
| `aliases` | text[] | Nombres alternativos |
| `tags` | text[] | Etiquetas |
| `details` | jsonb | Puente temporal de valores por label |
| `field_keys` | text[] | Campos asociados |
| `preset_keys` | text[] | Presets aplicados |
| `geo` | jsonb nullable | Datos geográficos legacy |
| `geo_geometry` | geometry nullable | Geometría espacial |

`field_keys` y `preset_keys` tienen índices GIN.

### codex_user_fields

| Columna | Uso |
| --- | --- |
| `field_key` | Clave estable |
| `label` | Copy visible |
| `field_type` | Tipo y shape normativo |
| `config` | `options`, `poles`, `cols` o configuración futura |
| `item_types` | Tipos donde aplica |
| `reason` | Motivo obligatorio de creación |
| `created_by` | `user`, `agent` o `migration` |
| `active` | Disponibilidad en catálogo |

### codex_user_presets

| Columna | Uso |
| --- | --- |
| `preset_key` | Identidad estable |
| `label` | Nombre visible |
| `description` | Explicación opcional |
| `item_types` | Tipos donde aplica |
| `field_keys` | Campos incluidos |
| `active` | Disponibilidad |

### Presets como snapshot

Aplicar un preset:

1. agrega su clave a `preset_keys`;
2. incorpora sus campos a `field_keys`;
3. no crea definiciones duplicadas;
4. no actualiza retroactivamente el ítem si el preset cambia.

Un ítem puede combinar varios presets. Enviar `preset_keys: []` elimina la procedencia, pero conserva los campos incorporados.

### RLS

Las tres tablas tienen RLS habilitado. La política vigente usa:

```sql
auth.uid() = user_id
```

La condición se aplica a lectura y escritura.

## 3. Tipos canónicos de ítem

| Tipo | Representa |
| --- | --- |
| `Actor` | Persona o individuo |
| `Entidad` | Organización, institución, empresa o partido |
| `Territorio` | Lugar o ámbito geográfico |
| `Evento` | Suceso situado en el tiempo |
| `Historia` | Narrativa, marco, ley, caso o concepto |
| `Objeto` | Evidencia, documento o cosa concreta |
| `Artefacto` | Sistema, herramienta, método o infraestructura |
| `Snippet` | Nota, cita o fragmento interno |
| `Post` | Publicación de una plataforma |

Aliases principales:

| Entrada | Tipo canónico |
| --- | --- |
| persona, funcionario, político | `Actor` |
| organización, empresa, partido | `Entidad` |
| lugar, municipio, departamento, país | `Territorio` |
| concepto, narrativa, ley, caso | `Historia` |
| suceso, hecho | `Evento` |
| evidencia, documento, expediente | `Objeto` |
| herramienta, sistema | `Artefacto` |
| nota, fragmento, cita | `Snippet` |
| publicación, tweet | `Post` |

Mapeo legacy:

- `Concepto` → `Historia`
- `Documento` → `Objeto`
- `Evidencia` → `Objeto`
- `Biblioteca` → `Historia`
- `Fuente` → `Objeto`

## 4. API REST

### Schema

```http
GET /api/codex/schema?tipo=Actor
```

Devuelve:

- `version`
- `fieldTypes`
- `tipoAlias`
- `fields`
- `presetDefinitions`
- `baseFieldKeys`
- `presets` y `legacyPresets` para compatibilidad v3

Una petición anónima recibe solo campos del sistema. Una petición autenticada también recibe el catálogo personal.

Cache:

- autenticado: `private, max-age=60`;
- anónimo: `public, max-age=300`.

### Resolver un campo

```http
POST /api/codex/fields/resolve
Content-Type: application/json

{
  "tipo": "Actor",
  "label": "Puesto",
  "field_type": "texto"
}
```

Estados:

- `matched`: reutilizar `exact.field_key`;
- `candidates`: revisar candidatos;
- `not_found`: puede crearse un campo.

Una coincidencia exacta por clave o label se reutiliza aunque el tipo propuesto sea diferente.

### Crear campo personal

```http
POST /api/codex/fields

{
  "field_key": "oficina",
  "label": "Oficina",
  "field_type": "texto",
  "reason": "Distinguir la oficina operativa del cargo",
  "item_types": ["Actor"]
}
```

El backend normaliza la clave a `usr_oficina`.

Errores relevantes:

| Código | HTTP | Causa |
| --- | ---: | --- |
| `FIELD_LABEL_REQUIRED` | 400 | Falta label |
| `INVALID_FIELD_TYPE` | 400 | Tipo inválido |
| `FIELD_REASON_REQUIRED` | 400 | Falta motivo |
| `INVALID_ITEM_TYPES` | 400 | Alcance inválido |
| `FIELD_ALREADY_EXISTS` | 409 | Debe reutilizarse una coincidencia |
| `FIELD_KEY_CONFLICT` | 409 | La clave ya existe |

### Crear preset personal

```http
POST /api/codex/presets

{
  "preset_key": "politica",
  "label": "Política",
  "description": "Campos para perfiles políticos",
  "item_types": ["Actor"],
  "field_keys": [
    "sys_actor_cargo",
    "sys_actor_partido",
    "sys_actor_eje_social"
  ]
}
```

La clave se normaliza a `usr_preset_politica`.

### Validar sin guardar

```http
POST /api/codex/validate-fields

{
  "tipo": "Actor",
  "fields": {
    "sys_actor_cargo": "Presidente",
    "sys_actor_eje_social": { "value": 20 }
  }
}
```

### Leer campos de un ítem

```http
GET /api/codex/universe-items/:id/fields
```

El ítem debe pertenecer al usuario autenticado. Si no existe o pertenece a otro usuario, responde `404 ITEM_NOT_FOUND`.

### Actualizar campos

```http
PATCH /api/codex/universe-items/:id/fields

{
  "fields": {
    "sys_actor_cargo": "Presidente",
    "sys_actor_eje_social": { "value": 20 }
  },
  "preset_keys": [
    "sys_base_actor",
    "usr_preset_politica"
  ]
}
```

La respuesta incluye `item` y `resolved_fields`.

## 5. Tipos y shapes de campo

El contrato reconoce 25 tipos:

`texto`, `parrafo`, `numero`, `moneda`, `porcentaje`, `fecha`, `rango`, `hora`, `booleano`, `dropdown`, `tags`, `escala`, `ref`, `refs`, `id`, `link`, `email`, `telefono`, `archivo`, `imagen`, `geo`, `color`, `formula`, `eje`, `repetible`.

| Tipo | Shape o regla |
| --- | --- |
| `texto`, `parrafo`, `hora`, `telefono`, `id` | string |
| `numero` | número finito |
| `porcentaje` | número de 0 a 100 |
| `fecha` | `YYYY-MM-DD` |
| `booleano` | boolean |
| `escala` | entero de 1 a 5 |
| `link` | URL HTTP(S) |
| `email` | email válido |
| `color` | `#RRGGBB` |
| `dropdown` | string incluido en `config.options` |
| `tags` | `string[]` sin valores vacíos |
| `moneda` | `{ "amount": "5000", "cur": "GTQ" }` |
| `rango` | `{ "from": "2024-01", "to": "2026-05", "gran": "month" }` |
| `eje` | `{ "value": 20 }`, entero de -100 a 100 |
| `geo` | `{ "lat": 14.63, "lng": -90.50 }` |
| `ref` | `{ "id": "UUID_REAL" }` |
| `refs` | `[{ "id": "UUID_REAL" }]` |
| `archivo`, `imagen` | `{ "id": "UUID_REAL" }` |
| `repetible` | `{ "rows": [["celda"]] }` |
| `formula` | solo lectura |

Notas:

- `moneda.amount` se normaliza a string.
- Los polos de `eje` viven en `config.poles`.
- `archivo` e `imagen` referencian otros ítems del Codex; no almacenan URL ni upload directo.
- `geo` representa un punto y no sustituye fronteras, polígonos, rutas o POIs.
- Todos los tipos aceptan `null` para vaciar el valor sin retirar el campo.

Un shape inválido responde:

```json
{
  "success": false,
  "error": "INVALID_FIELD_SHAPE",
  "message": "Shape inválido para sys_actor_eje_social.",
  "details": {
    "field_key": "sys_actor_eje_social",
    "field_type": "eje",
    "expected": "{ value: entero -100..100 }",
    "correction": "Los polos viven en config; envía solo value."
  }
}
```

## 6. Contrato MCP

Acciones de la herramienta unificada `codex`:

| Acción | Uso |
| --- | --- |
| `get_schema` | Obtener campos y presets |
| `resolve_field` | Buscar una definición equivalente |
| `create_field` | Crear un campo personal |
| `create_preset` | Crear un preset |
| `create_universe_item` | Crear un ítem con campos v4 |
| `update_universe_item` | Actualizar por claves estables |

Secuencia recomendada:

1. `get_schema`.
2. `resolve_field`.
3. `create_field` solo si no existe.
4. escribir mediante `fields`.
5. corregir usando `details.correction` si falla el shape.

Ejemplo:

```json
{
  "action": "create_universe_item",
  "tipo": "Actor",
  "name": "Nombre del actor",
  "fields": {
    "sys_actor_cargo": "Diputado",
    "sys_actor_eje_social": { "value": -10 }
  },
  "preset_keys": ["sys_base_actor"]
}
```

Para `ref`, `refs`, `archivo` e `imagen`, el agente debe buscar primero mediante `search_universe` y usar UUIDs reales del mismo usuario.

`details` permanece en la definición MCP como compatibilidad. Los agentes v4 deben usar `fields`.

## 7. Migración y compatibilidad

Cambios introducidos:

- `field_keys` y `preset_keys` en `codex_universe_items`;
- tablas `codex_user_fields` y `codex_user_presets`;
- claves de sistema `sys_...`;
- claves personales `usr_...`;
- validación estricta REST y MCP;
- eliminación de `flag`;
- representación de espectros mediante `eje`.

Resultado de la migración inicial del 25 de agosto de 2026:

| Métrica | Resultado |
| --- | ---: |
| Ítems conservados | 1,329 |
| Valores `flag` eliminados | 206 |
| Ítems con `field_keys` | 620 |
| Asociaciones campo–ítem | 1,443 |
| Cambios pendientes en el segundo dry run | 0 |

El campo histórico `Oficina` de Actor se registró como `usr_oficina`. Los valores `flag` no se migraron a ejes porque no existe una correspondencia semántica segura.

Compatibilidad temporal:

- schema conserva `presets` y `legacyPresets`;
- v4 escribe mediante `fields`;
- los valores se reflejan en `details` para clientes v3;
- la lectura infiere claves conocidas desde `details`;
- un valor histórico inválido aparece como `legacy_invalid`.

Aliases de recuperación:

| Tipo | Clave legacy | Label vigente |
| --- | --- | --- |
| Actor | `profesion` | Profesión |
| Territorio | `lider` | Quién controla |
| Evento | `resultado` | Resultado / desenlace |

## 8. Pendiente en el frontend móvil

La app móvil todavía mantiene partes de v3:

- `src/utils/codexSchema.js` ignora propiedades de v4;
- `useCamposEditables.js` indexa por label;
- parte de la escritura puede ir directo a Supabase mediante `details`;
- el selector conserva tipos legacy.

La adaptación debe:

1. indexar por `field_key`;
2. consumir `fields`, `presetDefinitions` y `baseFieldKeys`;
3. resolver antes de crear campos;
4. validar mediante `/validate-fields`;
5. guardar mediante el PATCH v4;
6. consumir `resolved_fields`;
7. retirar `flag` de UI y payloads;
8. persistir los nueve tipos canónicos.
