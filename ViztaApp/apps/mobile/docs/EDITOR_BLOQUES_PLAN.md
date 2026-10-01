# Editor de bloques — plan (STA-190)

Cambio estructural del texto de la nota, hacia la 0.1.0. Linear: proyecto
**Vizta App → 0.1.0** (P-STA-3), issue padre **STA-190**, fases STA-196 … STA-202.

Decidido con PJ el 2026-09-28.

## Por qué

Hoy el cuerpo de la nota es **un solo `TextInput` con markdown**
(`CreateSnippetSheet.jsx`, `formato.js`). Los marcadores (`**`, `#`, `==`) no se
esconden, se atenúan, porque el valor del input tiene que ser idéntico a sus
hijos (ver la cabecera de `formato.js`). Eso impide: títulos/cuerpo sin
markdown, tablas, fórmulas, código, dibujo, toggles, páginas dentro de la nota,
y meter audio o fotos en medio del texto (comentario en
`CreateSnippetSheet.jsx` cerca de «Partir el cuerpo en el cursor»).

## Restricciones

- **La app manda.** ThePulse (web) se está adaptando a la app; no se toca
  ThePulse. El formato se define acá y la web lo adopta después.
- **Nada de TipTap ni editores en WebView** (PJ lo descartó).
- Compacto en teléfono pero **personalizable**.
- Hay que conservar lo que hoy vive en la nota: rastreo por contexto
  (`useVeredictos`, veredictos sí/dudosa/no con fundido), autocompletado del
  Codex, toque en un nombre para abrir su ficha, modo Vizta, índice de historia.
- Textos de UI según `apps/mobile/docs/DESIGN.md` (beneficio, no mecánica;
  voseo; sin letreros de sistema; pistas de una sola vez).
- PJ compila en Xcode. **No compilar por terminal ni reinstalar pods mientras
  Xcode está abierto.** Dependencias nativas nuevas → avisar para un rebuild.
- Migraciones: solo base (Supabase `qqshdccpmypelhmyqnut`), VPS y app.
- «Espacios» = workspaces (`spaces`), no el lienzo.

## Stack

| Pieza | Elección | Por qué |
|---|---|---|
| Formato | **Portable Text** + tipos propios, versionado `vizta.doc/1` | Spec abierta de bloques + spans + `markDefs`; `_key` estable por bloque/span; hay serializadores a React/HTML/markdown para la web. Listas planas (`listItem` + `level`); toggles y páginas con `children` como extensión propia. |
| Editor | **Bloques nativos**: un `TextInput` por bloque, formato por rangos pintado como `Text` hijos **sin marcadores** | Se siente nativo (como Craft), iOS + Android, reutiliza el pintado actual y el rastreo. |
| Estado | Zustand normalizado (`orden[]`, `porKey{}`), selector por bloque | Al teclear solo re-renderiza el bloque activo. |
| Deshacer | Pila de operaciones, agrupadas ~500 ms | Deshace frases, no letras. |
| Teclado | `react-native-keyboard-controller` | Barra pegada al teclado sin saltos; llevar el cursor a la vista. |
| Borrador local | `expo-sqlite` (kv-store) | Nada se pierde si la app muere; abrir es instantáneo. |
| Guardado | Automático 1,5 s tras dejar de escribir y al salir: `details.documento` (jsonb) **y** `description` = markdown generado | El indexador (`historia_partir`), rastreo (`codex_resolver_texto`), Vizta, búsqueda y la web siguen leyendo `description` sin cambios. |
| Sincronización | Fusión por bloque usando `_key` (no «gana el último») | Teléfono y web pueden tocar bloques distintos sin pisarse. CRDT (Yjs) solo si algún día hay coedición en vivo. |
| Rastreo | Hash por bloque; solo se re-resuelve el bloque cambiado; RPC nuevo que resuelve varios bloques en una llamada | Hoy se manda la nota entera cada 700 ms. |
| Fórmula | LaTeX → SVG con MathJax en un endpoint de ExtractorW; el SVG se guarda en el bloque; `react-native-svg` para mostrarlo | Sin WebView; offline e instantáneo después del primer render. |
| Código | `highlight.js` core con ~10 lenguajes, al salir del bloque | No colorear en cada tecla. |
| Dibujo | Skia (ya instalado) + `perfect-freehand`; trazos simplificados | Fluido y liviano. |
| Tabla | Grilla nativa con scroll horizontal; celda = `Text` hasta tocarla | 20×10 no monta 200 inputs. |

Plan B para el texto si el motor propio no da la talla en F1:
`react-native-enriched-html` (Software Mansion, nativo, New Arch). Se descartó
como primera opción porque trabaja con HTML y menciones insertadas a mano,
mientras nuestro rastreo detecta y pinta menciones en texto libre.

Limitación aceptada: React Native no permite seleccionar texto a través de
varios inputs. Se resuelve con un modo «seleccionar bloques» (como Craft).

## Forma del documento (borrador para F0)

```jsonc
{
  "_type": "vizta.doc",
  "version": 1,
  "paginas": [
    {
      "_key": "p1",
      "titulo": "Capítulo 1",
      "bloques": [
        { "_type": "block", "_key": "b1", "style": "h1",
          "children": [{ "_type": "span", "_key": "s1", "text": "Políticos", "marks": [] }],
          "markDefs": [] },
        { "_type": "block", "_key": "b2", "style": "normal", "listItem": "bullet", "level": 1,
          "children": [
            { "_type": "span", "_key": "s2", "text": "Algo ", "marks": [] },
            { "_type": "span", "_key": "s3", "text": "importante", "marks": ["strong", "h-amarillo"] }
          ],
          "markDefs": [{ "_key": "h-amarillo", "_type": "resaltado", "color": "#F5D90A" }] },
        { "_type": "todo", "_key": "b3", "hecho": false, "children": [/* spans */] },
        { "_type": "toggle", "_key": "b4", "abierto": true, "children": [/* spans del título */], "bloques": [/* anidados */] },
        { "_type": "separador", "_key": "b5", "estilo": "puntos|punteado|corte|fina|gruesa" },
        { "_type": "codigo", "_key": "b6", "lenguaje": "js", "texto": "…" },
        { "_type": "formula", "_key": "b7", "latex": "E=mc^2", "svg": "<svg…>" },
        { "_type": "dibujo", "_key": "b8", "ancho": 1, "alto": 0.6, "trazos": [] },
        { "_type": "tabla", "_key": "b9", "filas": [["", ""]] },
        { "_type": "datasheet", "_key": "b10", "dataset_id": "…", "vista": "tabla" },
        { "_type": "medio", "_key": "b11", "tipo": "foto|audio|documento", "storage_path": "…" },
        { "_type": "pagina", "_key": "b12", "pagina": "p2" }
      ]
    }
  ]
}
```

Estilos de bloque: `normal`, `h1`, `h2`, `h3`, `cita` (Foco), `tarjeta` (Block);
`h4`–`h6` se aceptan al leer markdown.
Marcas: `strong`, `em`, `code`, `underline`, `strike`, más `markDefs` para
`resaltado` (color) y `link`.

## Fases

Qué toca cada fase:

| Fase | App | Base (Supabase) | VPS (ExtractorW) |
|---|---|---|---|
| F0 Cimientos | sí | solo lectura (script de ida y vuelta) | — |
| F1 Editor | sí | RPC de rastreo multi-bloque | — |
| F2 Barra | sí | — | — |
| F3 Páginas | sí | `historia_partir` parte por páginas | — |
| F4 Especiales | sí | — | endpoint LaTeX → SVG (MathJax) |
| F5 Datasheet | sí | probablemente (vínculo historia ↔ dataset) | a definir |
| F6 Cierre | sí | — | — |

El VPS solo entra en F4. Se parchea por scp en `root@157.245.115.216:/home/pj/ExtractorW` (rama `vps/app-movil-2026-09`), no desde ThePulse.

### F0 · Cimientos — STA-196 (hecho)
Sin cambios visibles.
1. `apps/mobile/src/documento/` (JS puro, sin React): `esquema.js` (forma,
   claves, `validar`), `enLinea.js`, `desdeMarkdown.js`, `aMarkdown.js`,
   `aTextoPlano.js` → `{ texto, mapa }` con `aLocal`/`aGlobal` para pasar de
   posición global a `{ key, offset }` y de vuelta. Pruebas en
   `src/documento/__tests__/` (`npx jest src/documento`).
2. `scripts/documento-ida-y-vuelta.mjs`: ida y vuelta con todas las notas
   reales. **Las notas son `codex_universe_items` con `tipo = 'Snippet'`**
   (columnas `description` y `details`), no `codex_items`. Solo lee.
3. `react-native-keyboard-controller` 1.18.5 y `expo-sqlite` ~16.0.8 en
   `package.json`. **Hace falta un rebuild en Xcode** (`pod install` + compilar);
   todavía no se usan en código, así que la app corre igual sin él.
4. Interruptor `editor_bloques`: `src/utils/editorBloques.js`
   (`useEditorBloques()`), leído de `get_my_capabilities`. Prendido solo para
   la cuenta de PJ con un override en `profile_limits.overrides.features`.
   Apagado si no llegan las capacidades.

Decisiones que salieron de las notas reales:
- **Un bloque por renglón; un renglón en blanco es un bloque vacío.** Así la
  nota siempre se escribió (el `TextInput` muestra cada salto), y así
  `description` no cambia al migrar.
- Tabla y bloque de código son un solo bloque cada uno. Las celdas de la tabla
  guardan su markdown en línea como texto (`filas: string[][]`), más
  `encabezado` y `alineacion`. 17 notas tienen tablas.
- Numeradas: el número se cuenta, salvo `numero` en el renglón donde la cuenta
  no da lo escrito (los modelos escriben «1. Tema» + párrafo + «2. Tema»).
- La cursiva sale con `_` (como la barra), o con `*` si va pegada a una letra.
  `_` no abre pegado a una letra ni cierra antes de una: `@usuario_` no es
  cursiva. Dentro de URLs no se busca formato.
- Estilos `h4`–`h6` se aceptan en el documento para no perder nada; el editor
  los puede pintar como `h3`.

Resultado con las 87 notas (2026-09-28): 60 idénticas, 27 cambian solo de
escritura y **0 pierden algo** (releer el markdown nuevo da el mismo
documento). Motivos: fila de guiones de la tabla normalizada (16 notas),
cursiva `*` → `_` (15), viñeta `*` → `-` (1), `****` → `---` (1), `>` → `> `
(1). Segunda vuelta estable en todas.

### F1 · Editor de bloques — STA-197 (riesgo alto)
- Bloques: párrafo, H1-H3, viñetas, numeración, to-do, toggle, cita.
- Formato en línea sin marcadores; Enter parte, Borrar al inicio une, pegar
  markdown → bloques, deshacer/rehacer.
- Portar rastreo (por bloque, con caché por hash; RPC multi-bloque en la
  base), autocompletado, toque en nombre, modo Vizta, índice de historia.
- Guardado automático + borrador sqlite.
- Metas: < 16 ms por tecla; abrir nota de 5.000 palabras < 300 ms. Medir.
- El editor viejo sigue detrás del interruptor.

Hecho (2026-09-29), detrás de `editor_bloques`:
- **Núcleo puro** (`src/documento/editor/`): estado plano (`orden`, `porKey`,
  `padre` para los hijos de un toggle), operaciones inmutables (escribir con
  diff + atajos `# `/`- `/`1. `/`[] `/`> `/`>> `, Enter, borrar al inicio,
  pegar markdown, tipos, marcas con «pendiente» en blanco, sangría, to-do,
  toggle) y deshacer por estados, agrupando teclas seguidas ~500 ms.
- **UI** (`src/components/codex/bloques/`): store zustand por hoja, un
  `TextInput` por bloque con `submitBehavior="submit"` (Enter parte sin meter
  un salto), formato pintado sin marcadores, montaje de a poco (40 + 80 por
  cuadro), `KeyboardAwareScrollView` para que el bloque nuevo quede a la vista.
  Leer sigue siendo el estado natural (dos toques para escribir; casillas y
  flechas responden leyendo). La tira de formato suma, solo con bloques,
  listas, to-do, toggle, cita, sangría y deshacer/rehacer — provisoria hasta F2.
- **Rastreo por bloque**: `codex_resolver_bloques` (base) resuelve tramos de
  bloques seguidos con los renglones vecinos como contexto; se manda el
  renglón **en markdown** (para `codex_tokens` un `**` es corte de frase).
  Probado contra `codex_resolver_texto` con la nota entera: 308 renglones,
  mismas 50 menciones, mismo veredicto, motivo y firma. La caché es por
  renglón + contexto; solo se pregunta por bloques con algún nombre.
- **Guardado**: automático a 1,5 s y al salir para notas que ya existen, con
  `nota_guardar_documento` (base), que fusiona `details.documento` en vez de
  pisar `details`. Borrador local en `expo-sqlite/kv-store`. Al abrir se
  prefiere: borrador de esta misma versión › `details.documento` si coincide
  con `description` › `description`. «Guardar» sigue creando las notas nuevas
  y ahora escribe también `details.documento`.
- **Modo Vizta** sigue con el campo simple (es la pregunta, no la nota); al
  salir, el editor se recarga desde el cuerpo con la conversación plegada.
- Medido en Node sobre 5.100 palabras / 407 bloques (`MEDIR=1 npx jest
  rendimiento`): abrir 20 ms, tecla p95 1 ms, al dejar de escribir 5 + 4 ms.
  Falta medirlo en el teléfono.
- ~~Pendiente para F3: el índice de la historia salta por aritmética de
  renglones~~ — resuelto en F3: cada sección apunta a su bloque.

### F2 · Barra — STA-198
Tres filas (referencia Craft: Heading/Body/Page/More · checkbox, toggle,
viñetas, numeración, sangría −/+ · Focus, Block, color, …). Tira sobre el
teclado personalizable. 5 separadores. Resaltado con color. `+` para insertar.

**Hecho (2026-09-30, local con PJ):**
- **Dos puertas separadas en la cápsula** (con bloques): **T** = formato del
  texto (`bloques/PanelFormato.jsx`) y **+** = agregar a la nota
  (`bloques/PanelInsertar.jsx`). Cámara, documento y micrófono salen de la
  cápsula y viven en `+` con su nombre. La tira vieja (`BarraFormato`) queda
  solo para el editor viejo.
- **Todo a la vista, sin scroll horizontal** (PJ no encontraba los botones
  escondidos a la derecha). T: fila de estilo (Título, Subtítulo, Cuerpo, Foco,
  con el actual marcado), fila en línea (negrita, cursiva, subrayado, tachado,
  resaltado, código), fila de listas y sangría; deshacer/rehacer arriba. `+`:
  grilla con nombre (Página, Tabla, Dataset, Código, Fórmula, Dibujo, Foto,
  Audio, Documento), fila de 5 separadores elegidos por cómo se ven, y
  «ordenar bloques».
- **Teclado o menú, nunca los dos (como Craft):** abrir T o `+` baja el
  teclado; el panel toma el lugar de la cápsula y se esconden la cápsula y la
  píldora «crear». Cuando un bloque toma el foco, el panel se cierra (se
  escucha `enfocado` del store, no `keyboardWillShow`, que iOS dispara también
  con teclado físico). Formatear con el panel abierto limpia `foco` para no
  traer el teclado.
- Separador con `estilo` (`puntos|punteado|corte|fina|gruesa`); `insertar(tipo, datos)`.

**Hecho (2026-09-30, segunda parte):**
- **Color del resaltado:** cinco colores (`RESALTADOS` en `esquema.js`:
  amarillo, verde, azul, rosa, naranja) y «sin color», en una fila del panel
  T. Un tramo tiene un solo color: poner otro reemplaza al anterior y tocar
  el mismo lo apaga. En `description` todos se escriben `==así==`.
- **Estilo «Bloque»:** `tarjeta` entra en `TIPOS_DE_TEXTO` y en la primera
  fila del panel; se pinta como una tarjeta con fondo. En markdown es un
  párrafo.
- **`+` junto al renglón vacío:** en el renglón vacío donde está el cursor
  aparece un `+` que abre el panel de agregar; lo agregado va en ese renglón.
- **Manija en el bloque activo:** el bloque donde se escribe muestra la
  manija para arrastrarlo sin entrar a «ordenar bloques».
- **A mano** (`bloques/aMano.js`): mantener apretado un botón de T o de `+`
  lo pone o lo saca de la cápsula, donde queda al lado de Aa y `+` mientras
  se escribe y actúa sin bajar el teclado. Hasta 4, en el orden en que se
  eligieron (si no hay lugar sale el más viejo). De entrada: negrita,
  resaltado, por hacer y deshacer. Se guarda en el teléfono.

**Falta:** probar en el iPhone real el cambio teclado ↔ menú (en el simulador
el teclado es el de la Mac).

### F3 · Páginas y capítulos — STA-199
Bloque «Página» con subpágina. Índice de historia por páginas;
`historia_partir` (base) parte por páginas. Modo «seleccionar bloques».
Fusión por bloque al guardar.

Hecho (2026-09-29), detrás de `editor_bloques`:
- **Páginas** (`editor/estructura.js`): el editor muestra una página a la vez
  (`estado.pagina`); `aDocumento` devuelve la abierta a `resto` y descarta las
  páginas que ya no cuelgan de la raíz. Botón «página» en la tira: crea la
  subpágina, la abre y pone el foco en el título. Arriba de una subpágina va
  la vuelta a la de arriba y el título.
- **Índice** (`bloques/indice.js`): si la nota tiene páginas, el índice son
  sus páginas (más una entrada para lo de antes); si no, las secciones de
  siempre, pero cada una salta a su bloque (`yDe`), no por renglones.
- **Base**: `historia_partir_nota(texto, documento)` parte por páginas cuando
  el documento las tiene (y si no, cae en `historia_partir`);
  `historia_sincronizar_una` lee `details.documento`. Comprobado: salida
  idéntica en las 87 notas existentes.
- **Elegir bloques**: mantener apretado un bloque leyendo (o el botón de la
  tira) entra al modo; se eligen con un toque, se arrastran de la manija y la
  barra de abajo sube, baja, copia (markdown) o borra.
- **Fusión por bloque** (`documento/fusion.js`): `nota_guardar_bloques(id,
  description, documento, base)` escribe solo si la base no cambió; si cambió
  devuelve la versión de la base y la app fusiona por `_key` (lo nuestro gana
  si los dos tocaron el mismo bloque; lo que agregó la otra versión entra
  después de su vecino; lo que borró se respeta salvo que lo hayamos
  editado) y reintenta. `nota_guardar_documento` queda hasta F6.

### F4 · Bloques especiales — STA-200
Código, fórmula (endpoint MathJax en ExtractorW, por scp/patch en el VPS),
dibujo, tabla simple, medios en medio del texto.

Hecho (2026-09-29), detrás de `editor_bloques`. **Sin dependencias nativas
nuevas**: `highlight.js` y `perfect-freehand` son JS puro; Skia y
`react-native-svg` ya estaban. No hace falta recompilar.
- **Código**: `«```js »` en un renglón vacío o el botón de la tira. Se colorea
  al salir del bloque (núcleo de `highlight.js` con 11 lenguajes).
- **Fórmula**: `«$$ »` o el botón. El LaTeX se dibuja en ExtractorW
  (`POST /api/latex/svg`, MathJax) y el SVG se guarda en el bloque: abrir la
  nota no vuelve a preguntar. Con un error de TeX se ve el texto y un aviso.
- **Dibujo**: lienzo a pantalla completa con Skia + `perfect-freehand`; los
  trazos se guardan normalizados y simplificados.
- **Tabla simple**: celdas editables, filas y columnas con `+`; mantener
  apretada una celda para quitar su fila o columna.
- **Medios en el texto**: con bloques, la foto, el audio o el documento
  adjuntado entra en el renglón del cursor; lo que ya está en el texto no se
  repite en las listas de abajo. Siguen guardándose en `details` como antes.
- **Pendiente de PJ**: desplegar `vps/ExtractorW/routes/latex.js` en el VPS
  (ver `vps/ExtractorW/LEEME.md`). Sin eso las fórmulas se ven como texto.

### F5 · Datasheet — STA-201
Tabla simple vs datasheet conectado a un dataset real. En modo datasheet la
historia entera es el datasheet, respetando las vistas de la nota (historial,
nota, panel). **Definir con PJ antes de empezar.** Lectura propuesta: cada fila
es una entrada de la historia; la nota muestra la fila abierta y el panel la
tabla entera.

Definido con PJ (2026-09-29): primero el bloque, después la historia; se
puede editar el dataset desde la nota; una tabla simple se puede convertir
en dataset.

Hecho (2026-09-29), detrás de `editor_bloques`:
- **Base** (migraciones `datasheet_en_la_nota` y `historia_como_datasheet`):
  RPCs `datasheet_listar`, `datasheet_leer`, `datasheet_celda`,
  `datasheet_fila_nueva`, `datasheet_fila_quitar`, `datasheet_columna_nueva`
  y `datasheet_desde_tabla`. Corren como quien llama (RLS de siempre: dueño;
  en públicos, también admins). Los 22 datasets de hoy vienen de
  `private_datasets`/`public_datasets` (`legacy_source`), cuyo `json_data`
  sigue siendo la fuente y cuyo trigger rearma `dataset_rows`: por eso las
  escrituras van a la tabla vieja cuando la hay. Una celda se escribe sola
  (`jsonb_set` de esa clave): dos personas en celdas distintas no se pisan.
  Quitar una fila de un dataset viejo corre las de abajo (es un arreglo).
- **Bloque «dataset»** (botón en la tira): elegir uno existente (propios
  primero, después públicos) o crear uno nuevo; tabla editable si es propio
  (celdas, filas, columnas); los de otra persona se leen. La tabla simple se
  convierte con «convertir en dataset» (mantener apretada una celda): la
  primera fila da las columnas y el bloque conserva su `_key`.
- **La historia como datasheet**: en la nota principal de un espacio, un
  datasheet ofrece «usar como la historia». Queda en
  `details.documento.datasheet = { dataset_id, nombre, titulo? }` y lo escrito
  como texto se conserva. Vistas: la **nota** muestra la fila abierta como
  ficha (anterior/siguiente, `+` para una entrada nueva; mantener apretada
  una etiqueta la vuelve la columna del título), el **historial** lista las
  filas antes de las notas y el **panel** muestra la tabla entera (tocar una
  fila la abre) y «volver a escribir la historia como texto».
- **Base de la historia**: `historia_partir_nota` parte por filas cuando el
  documento tiene `datasheet` (título = columna elegida o la primera;
  contenido = «Columna: valor»; hasta 100 filas). `historia_sincronizar_nota`
  la rearma; la app lo pide 3 s después del último cambio al dataset o al
  modo, porque el trigger de la nota solo mira `description`.

### F6 · Cierre — STA-202 (hecho)
Quitar el editor viejo y el interruptor. Documentar `vizta.doc/1` para ThePulse.

**Hecho (2026-10-01):**
- Sin interruptor: `bloquesActivo = !preguntando`. El editor de bloques es el
  de todas las notas. Se borraron `utils/editorBloques.js` y la lectura de
  `editor_bloques` (los overrides en `profile_limits` quedan sin efecto).
- El campo único sigue **solo para el modo Vizta** (la pregunta), que no es una
  nota. Se borraron la tira vieja (`BarraFormato.jsx`), `aplicarFormato` y el
  camino de formato con marcadores, y los glifos de cámara, documento y
  micrófono de la cápsula (viven en `+`).
- Formato documentado en `docs/VIZTA_DOC_1.md`.
- Verificado antes de quitarlo: una nota creada con bloques tiene
  `details.documento` válido en la base, y `nota_guardar_bloques` guarda
  (probado como el usuario dentro de una transacción deshecha). **Falta ver en
  el teléfono** el guardado automático al editar una nota que ya existe.

## Archivos de hoy que importan

- `src/components/codex/CreateSnippetSheet.jsx` — la hoja de la nota (≈3.500 líneas); el `TextInput` único está cerca de la línea 2813.
- `src/components/codex/formato.js` — pintado de formato y `aplicarFormato`.
- `src/components/codex/BarraFormato.jsx` — la tira actual (7 botones).
- `src/components/codex/markdown.js`, `TextoMarkdown.jsx` — lectura de markdown.
- `src/components/codex/historia.js` — índice de historia (mismas reglas que `historia_partir`).
- `src/components/codex/menciones.js`, `useVeredictos.js`, `useIndiceCodex.js` — rastreo.
- `src/components/codex/AutocompletarCodex.jsx`, `HiloVizta.jsx` — autocompletado y modo Vizta.
