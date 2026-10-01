# `vizta.doc/1` — el formato de una nota

El documento de una nota de Vizta. Lo define la app móvil; ThePulse (web) lo
lee y lo escribe igual. La referencia ejecutable es `apps/mobile/src/documento/`
(JS puro, sin React): si este archivo y el código no coinciden, manda el código.

## Dónde vive

Tabla `codex_universe_items`, filas con `tipo = 'Snippet'`:

| Columna | Qué tiene |
|---|---|
| `details.documento` | El documento (`vizta.doc/1`). Es la fuente de verdad. |
| `description` | Markdown **generado** desde el documento (`aMarkdown`). Lo leen el indexador de historias, el rastreo por contexto, Vizta y la búsqueda. Nunca se edita a mano. |

Una nota vieja sin `details.documento` se abre con `desdeMarkdown(description)`.
Con las 87 notas reales, markdown → doc → markdown no perdió nada.

**Guardar.** Siempre los dos campos juntos, con la RPC de la base:

- `nota_guardar_bloques(p_id, p_description, p_documento, p_base)`: guarda si
  `description` en la base sigue siendo `p_base`. Si alguien cambió la nota en
  otro lado, devuelve `{ ok: false, description, documento }` y el cliente
  fusiona por `_key` (`documento/fusion.js`) y reintenta.
- Una nota nueva se crea con su `description` y `details.documento` en el mismo insert.

## Forma

```jsonc
{
  "_type": "vizta.doc",
  "version": 1,
  "paginas": [                       // la primera es la raíz de la nota
    { "_key": "…", "titulo": "", "bloques": [ /* bloques */ ] }
  ],
  "datasheet": { "dataset_id": "…", "nombre": "…", "titulo": "…" }  // opcional: la historia es un datasheet
}
```

Es [Portable Text](https://portabletext.org) más tipos propios. Todo bloque y
todo span lleva una `_key` de 12 caracteres al azar (`[a-z0-9]`). La fusión entre
dispositivos y el rastreo por bloque dependen de que **las claves no cambien**:
editar un bloque conserva su `_key`.

### Bloques de texto

| `_type` | Campos | Notas |
|---|---|---|
| `block` | `style`, `children`, `markDefs`, `listItem?`, `level?`, `numero?` | `style`: `normal`, `h1`–`h6`, `cita` («Foco»), `tarjeta` («Bloque»). `h4`–`h6` solo llegan de markdown viejo. Listas planas como en Portable Text: `listItem` `bullet`/`number` y `level` ≥ 1. `numero` solo si el número escrito no es el que da la cuenta. |
| `todo` | `hecho` (bool), `children`, `markDefs` | Por hacer. |
| `toggle` | `abierto?`, `children`, `markDefs`, `bloques` | Plegable: `children` es el título y `bloques`, lo de adentro. |

`children` son spans `{ _type: 'span', _key, text, marks: [] }`. Un renglón es
un bloque; un renglón en blanco es un bloque vacío.

**Marcas.** Decoradores en `marks`: `strong`, `em`, `code`, `underline`,
`strike`. Las que llevan datos van en `markDefs` del bloque y el span lleva su
`_key`:

- Resaltado: `{ _type: 'resaltado', _key, color }`. Cinco colores con clave
  fija, para que dos resaltados del mismo color compartan definición:
  `h-amarillo` `#F5C842`, `h-verde` `#8FD19E`, `h-azul` `#8DB8F2`,
  `h-rosa` `#F2A7C3`, `h-naranja` `#F7B267`. Un tramo tiene un solo color.
- Enlace: `{ _type: 'link', _key, href }`.

### Bloques especiales

| `_type` | Campos |
|---|---|
| `separador` | `estilo`: `puntos`, `punteado`, `corte`, `fina`, `gruesa` |
| `codigo` | `lenguaje`, `texto` |
| `formula` | `latex`, `svg?` (render guardado; ver abajo) |
| `dibujo` | `ancho` (1), `alto` (proporción), `trazos` (normalizados 0–1, simplificados) |
| `tabla` | `filas: string[][]` (markdown en línea por celda), `encabezado`, `alineacion?` |
| `datasheet` | `dataset_id`, `vista` (`tabla`) — un dataset real; se edita con las RPC `datasheet_*` |
| `medio` | `tipo` (`foto`/`audio`/`documento`), `ref` o `storage_path` — el archivo sigue registrado en `details` como antes |
| `pagina` | `pagina`: la `_key` de otra entrada de `paginas` (subpágina / capítulo) |

Un tipo desconocido no se valida pero **tampoco se borra**: un cliente viejo
tiene que conservar lo que no entiende.

## Funciones (`apps/mobile/src/documento`)

| Función | Para qué |
|---|---|
| `validar(doc)` | `{ ok, errores[] }`; no lanza. |
| `desdeMarkdown(md)` / `aMarkdown(doc)` | Ida y vuelta con `description`. En markdown todos los resaltados son `==así==` y el color se pierde (vive en el documento). |
| `aTextoPlano(doc)` → `{ texto, mapa }`, `aLocal`, `aGlobal` | Texto para el rastreo y paso de posición global a `{ key, offset }` y de vuelta. Incluye las celdas de las tablas. |
| `fusion.js` | Fusión por `_key` entre dos versiones de la misma nota. |

## Servicios que lo tocan

- **Base:** `nota_guardar_bloques`, `codex_resolver_bloques` (rastreo por
  bloque), `historia_partir_nota` (la historia de un espacio se parte por
  páginas, o por filas si es datasheet), `datasheet_*`.
- **VPS (ExtractorW):** `POST /api/latex/svg` convierte LaTeX en SVG con MathJax (pide la sesión).
  El SVG se guarda en el bloque `formula`, así que se ve sin conexión.
