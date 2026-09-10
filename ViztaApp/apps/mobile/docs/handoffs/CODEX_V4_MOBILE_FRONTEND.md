# Handoff para Opus: contrato Codex v4 en la app móvil

## Estado y orden de trabajo

El backend y Supabase ya exponen el contrato Codex v4. La app móvil todavía consume parcialmente el contrato anterior.

En esta etapa debes **revisar, diseñar la adaptación y entregar un plan**. No implementes ni modifiques el frontend hasta recibir confirmación del usuario. El objetivo inmediato es que el diseño de interacción y la capa de datos móvil queden alineados antes de tocar los modales.

La fuente de verdad es el contrato v4 descrito aquí. Los `details` por label son compatibilidad temporal, no el modelo futuro.

## Decisión central del contrato

- `field_key` es la identidad estable de un campo.
- `label` es únicamente el texto visible y puede cambiar sin cambiar la identidad.
- Un campo del sistema usa `sys_<tipo>_<slug>`.
- Un campo creado por un usuario usa `usr_<slug>` y pertenece a ese usuario.
- Un preset creado por un usuario usa `usr_preset_<slug>`.
- Un ítem puede aplicar varios presets mediante `preset_keys`.
- Los presets son machotes para orientar al usuario o al agente. Aplicarlos no crea herencia viva: el ítem conserva sus campos aunque el preset cambie después.
- Antes de crear un campo personalizado se debe resolver contra el catálogo existente para reducir duplicados y sinónimos.
- Si el label normalizado coincide exactamente con un campo existente, se reutiliza ese campo aunque el agente proponga otro tipo.

## Cambios en datos

### Tablas nuevas

- `public.codex_user_fields`
- `public.codex_user_presets`

Ambas usan ownership por `user_id` y RLS con `auth.uid() = user_id`.

### Columnas nuevas en `codex_universe_items`

- `field_keys text[]`
- `preset_keys text[]`

La migración conservó 1,329 ítems. Se eliminaron 206 valores legacy de `flag`. Un único campo personalizado existente, `Oficina` de Actor, se registró como `usr_oficina`. La segunda ejecución de validación de la migración reportó cero cambios pendientes.

## Tipos canónicos de ítem

El backend reconoce estos nueve valores:

1. `Actor`
2. `Entidad`
3. `Territorio`
4. `Evento`
5. `Historia`
6. `Objeto`
7. `Artefacto`
8. `Snippet`
9. `Post`

La UI puede mostrar labels más amigables, pero el valor persistido debe ser uno de esos nueve. Actualmente `apps/mobile/src/components/codex/tipos.js` incluye además `Concepto`, `Documento` y `Evidencia`; debes proponer cómo retirar o mapear esos valores legacy sin mezclar identidad de almacenamiento con copy de interfaz.

## Tipos canónicos de campo

El contrato admite 25 tipos:

`texto`, `parrafo`, `numero`, `moneda`, `porcentaje`, `fecha`, `rango`, `hora`, `booleano`, `dropdown`, `tags`, `escala`, `ref`, `refs`, `id`, `link`, `email`, `telefono`, `archivo`, `imagen`, `geo`, `color`, `formula`, `eje`, `repetible`.

Formatos que la UI debe respetar:

```ts
type AxisValue = { value: number }; // entero entre -100 y 100
type CodexReference = { id: string }; // UUID real de un ítem Codex
type CodexReferences = Array<{ id: string }>;
type GeoValue = { lat: number; lng: number };
type CurrencyValue = { amount: number; cur: string }; // ISO de 3 letras, mayúsculas
type RangeValue = { from?: unknown; to?: unknown; gran?: string };
type RepeatableValue = { rows: string[][] };
```

Reglas particulares:

- `eje`: el valor contiene solo `{ value }`. Los polos y su copy vienen de `field.config.poles`.
- `ref`: selector de un solo ítem Codex; persiste `{ id }`.
- `refs`: selector múltiple de ítems Codex; persiste `[{ id }]`.
- `archivo` e `imagen`: aceptan una referencia Codex `{ id }`; no aceptan URL ni un upload arbitrario. Para URL existe `link`.
- `porcentaje`: número de 0 a 100.
- `formula`: solo lectura en el cliente.
- `geo`: coordenada simple `{ lat, lng }`; no sustituye el contrato geográfico de Territorio.
- `flag`: dejó de ser una propiedad global. No debe existir como control, valor o fallback. Su concepto se representa mediante campos `eje` y presets, por ejemplo eje político o eje general.

## Endpoints v4

### Leer el catálogo

```http
GET /api/codex/schema?tipo=Actor
```

La respuesta incluye:

- `version`
- `fieldTypes`
- `fields`
- `presetDefinitions`
- `baseFieldKeys`
- `tipoAlias`
- `presets`, conservado temporalmente para clientes legacy

Una petición autenticada incluye catálogo de sistema y catálogo del usuario. Una petición anónima recibe solo el catálogo de sistema.

### Resolver o crear catálogo personalizado

```http
POST /api/codex/fields/resolve
POST /api/codex/fields
POST /api/codex/presets
```

Al crear un campo, el flujo agentic o de interfaz debe declarar al menos:

- clave propuesta
- tipo
- label
- motivo de uso

El backend normaliza la clave al namespace `usr_` y puede devolver una coincidencia existente.

Un usuario puede crear varios presets y aplicar varios a un mismo ítem.

### Validar y guardar valores

```http
POST /api/codex/validate-fields
GET /api/codex/universe-items/:id/fields
PATCH /api/codex/universe-items/:id/fields
```

Ejemplo de escritura:

```json
{
  "fields": {
    "sys_actor_cargo": "Presidente",
    "sys_actor_eje_social": { "value": 20 }
  },
  "preset_keys": ["sys_base_actor", "usr_preset_politica"]
}
```

Una forma inválida responde `400 INVALID_FIELD_SHAPE` e incluye `details.correction`. El modal debe mostrar esa corrección cerca del campo afectado y conservar el borrador del usuario.

La lectura resuelta devuelve elementos con esta forma conceptual:

```ts
interface ResolvedField {
  field_key: string;
  label: string;
  field_type: string;
  config: Record<string, unknown> | null;
  item_types: string[];
  origin: 'system' | 'user';
  readonly: boolean;
  value: unknown;
  has_value: boolean;
  status: string;
}
```

El backend aún refleja los valores en `details` bajo el label visible para que el frontend anterior pueda leerlos. El cliente nuevo debe usar `resolved_fields` y escribir por `field_key`.

## Brechas verificadas en el móvil

### `apps/mobile/src/utils/codexSchema.js`

- Consume `GET /api/codex/schema`.
- Solo conserva `version`, `fieldTypes`, `presets` legacy y `tipoAlias`.
- Ignora `fields`, `presetDefinitions` y `baseFieldKeys`.

### `apps/mobile/src/components/codex/useCamposEditables.js`

- Indexa definición y valor usando `label`.
- `_k` solo estabiliza componentes React; no es identidad de datos.
- Crea y actualiza directamente en Supabase escribiendo `details` por label.
- No persiste `field_keys` ni `preset_keys`.
- No llama la validación v4 ni el endpoint PATCH de campos.

### `apps/mobile/src/components/codex/tipos.js`

- Expone tipos legacy que ya no forman parte del contrato canónico.
- Debe separar `canonicalType` del label que vea el usuario.

### `apps/mobile/src/components/codex/ItemDetailSheet.jsx`

- Es la base visual actual: portada, tabs de detalle/progresión/menciones/relaciones y bloque “Más campos”.
- La adaptación puede conservar esa arquitectura mientras cambia la obtención, resolución, validación y persistencia de campos.
- Durante creación solo aparece Detalle; en ítems existentes aparecen las otras pestañas según tipo.

## Flujo móvil que debes diseñar

1. Obtener el schema autenticado y normalizarlo en modelos indexados por `field_key`.
2. Formar el modal con campos base, campos aplicados por presets y campos ya asociados al ítem.
3. Mostrar `label`, tipo de control y procedencia (`Sistema` o `Personal`) sin exponer la clave técnica en el flujo normal.
4. En “Más campos”, buscar primero en el catálogo personal y del sistema.
5. Si no existe, abrir creación de campo con label, tipo y motivo; resolver antes de confirmar creación.
6. Permitir seleccionar varios presets. Debe quedar claro que un preset añade un machote de campos y no bloquea su edición.
7. Mantener un borrador indexado por `field_key`.
8. Validar con el backend antes de guardar.
9. Guardar con `PATCH /api/codex/universe-items/:id/fields`.
10. Representar correcciones por campo, error general, loading, retry, catálogo vacío, campo readonly y campo legacy con `status` no válido.

Para creación de un ítem nuevo, determina en el plan cómo encadenar la creación base con la escritura v4 sin dejar un ítem incompleto si falla la segunda operación. No inventes un endpoint: documenta la necesidad si el API actual no ofrece una operación atómica.

## Compatibilidad transitoria

- Leer `resolved_fields` para ítems existentes cuando esté disponible.
- Los valores legacy restantes pueden mostrarse desde `details`, identificados como compatibilidad, pero no se deben crear nuevos valores dependientes solo del label.
- Un cambio de label no debe mover, duplicar ni perder el valor.
- No derives una clave desde el label en el cliente para guardar.
- No escribas directamente `field_keys` o `preset_keys` mediante Supabase desde el modal; usa la API v4 para que se aplique validación y ownership.

## Territorios y mapa: límite de este trabajo

El contrato de campos Codex y el modelo geográfico son capas distintas.

- La jerarquía administrativa, códigos postales y niveles 1–6 aplican a fronteras oficiales o personalizadas del modelo frontier.
- Un POI puede reasociarse automáticamente cuando se agrega una nueva jerarquía geográfica.
- Áreas, rutas o polígonos que no son frontier no usan jerarquía administrativa ni código postal.
- El campo genérico `geo` no reemplaza fronteras, shapes ni POIs.

No rediseñes ni implementes Territorio/mapa como parte de esta adaptación v4. Señala únicamente los puntos de integración que el modal tendrá que respetar en una fase posterior.

## Entregable solicitado antes de implementar

Devuelve al usuario un plan técnico y de UX que incluya:

1. Mapa de impacto por archivo y responsabilidad.
2. Modelo TypeScript propuesto para schema, campos resueltos, presets, borrador y errores.
3. Decisión de migración para `Concepto`, `Documento` y `Evidencia`.
4. Wireflow textual de crear/editar ítem, “Más campos”, resolver/crear campo y seleccionar presets.
5. Matriz tipo de campo → control móvil, incluyendo `eje`, `ref`, `refs`, `archivo`, `imagen`, `geo`, `formula` y `repetible`.
6. Estados de carga, error, validación, offline/retry y compatibilidad legacy.
7. Fases de implementación que puedan verificarse de forma incremental.
8. Pruebas unitarias, integración y recorrido manual en iOS.
9. Preguntas o bloqueos reales que requieran una decisión de producto o backend.

## Criterios de aceptación para la futura implementación

- La identidad de cada campo se mantiene por `field_key` aunque cambie su label.
- La UI reutiliza campos existentes y reduce duplicados por sinónimos mediante resolución.
- Los campos personales y presets quedan aislados por usuario.
- Un ítem puede combinar varios presets.
- El cliente rechaza o corrige valores con formas no válidas usando el mensaje documentado por el backend.
- `flag` no aparece en UI, payloads ni fallbacks.
- Los tipos de ítem guardados coinciden con los nueve tipos canónicos.
- El modal conserva la experiencia actual de portada, tabs y “Más campos”, salvo cambios justificados en el plan.
- La implementación no mezcla el campo `geo` con el contrato frontier/shape/POI.

