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

Estilos de bloque: `normal`, `h1`, `h2`, `h3`, `cita` (Foco), `tarjeta` (Block).
Marcas: `strong`, `em`, `code`, `underline`, `strike`, más `markDefs` para
`resaltado` (color) y `link`.

## Fases

### F0 · Cimientos — STA-196
Sin cambios visibles.
1. `apps/mobile/src/documento/` (JS puro, sin React): esquema, validación,
   `desdeMarkdown(md)`, `aMarkdown(doc)`, `aTextoPlano(doc)` → `{ texto, mapa }`
   (mapa: offset global ↔ `{ _key bloque, offset }`) para el rastreo.
   `desdeMarkdown` debe entender lo que ya escriben las notas: `#`, `##`,
   `**`, `_`/`*`, `==resaltado==`, `` ` ``, listas `-`/`1.`, `---`
   (ver `formato.js`, `markdown.js`, `historia.js`).
2. Script de prueba de ida y vuelta con **todas las notas reales**
   (`codex_items` tipo Snippet, `description`): markdown → doc → markdown,
   reportar cuántas cambian y por qué.
3. Dependencias nativas juntas (un solo rebuild): `react-native-keyboard-controller`,
   `expo-sqlite`. Avisar a PJ para compilar en Xcode.
4. Interruptor `editor_bloques` (solo la cuenta de PJ al principio).

### F1 · Editor de bloques — STA-197 (riesgo alto)
- Bloques: párrafo, H1-H3, viñetas, numeración, to-do, toggle, cita.
- Formato en línea sin marcadores; Enter parte, Borrar al inicio une, pegar
  markdown → bloques, deshacer/rehacer.
- Portar rastreo (por bloque, con caché por hash; RPC multi-bloque en la
  base), autocompletado, toque en nombre, modo Vizta, índice de historia.
- Guardado automático + borrador sqlite.
- Metas: < 16 ms por tecla; abrir nota de 5.000 palabras < 300 ms. Medir.
- El editor viejo sigue detrás del interruptor.

### F2 · Barra — STA-198
Tres filas (referencia Craft: Heading/Body/Page/More · checkbox, toggle,
viñetas, numeración, sangría −/+ · Focus, Block, color, …). Tira sobre el
teclado personalizable. 5 separadores. Resaltado con color. `+` para insertar.

### F3 · Páginas y capítulos — STA-199
Bloque «Página» con subpágina. Índice de historia por páginas;
`historia_partir` (base) parte por páginas. Modo «seleccionar bloques».
Fusión por bloque al guardar.

### F4 · Bloques especiales — STA-200
Código, fórmula (endpoint MathJax en ExtractorW, por scp/patch en el VPS),
dibujo, tabla simple, medios en medio del texto.

### F5 · Datasheet — STA-201
Tabla simple vs datasheet conectado a un dataset real. En modo datasheet la
historia entera es el datasheet, respetando las vistas de la nota (historial,
nota, panel). **Definir con PJ antes de empezar.** Lectura propuesta: cada fila
es una entrada de la historia; la nota muestra la fila abierta y el panel la
tabla entera.

### F6 · Cierre — STA-202
Quitar el editor viejo y el interruptor. Documentar `vizta.doc/1` para ThePulse.

## Archivos de hoy que importan

- `src/components/codex/CreateSnippetSheet.jsx` — la hoja de la nota (≈3.500 líneas); el `TextInput` único está cerca de la línea 2813.
- `src/components/codex/formato.js` — pintado de formato y `aplicarFormato`.
- `src/components/codex/BarraFormato.jsx` — la tira actual (7 botones).
- `src/components/codex/markdown.js`, `TextoMarkdown.jsx` — lectura de markdown.
- `src/components/codex/historia.js` — índice de historia (mismas reglas que `historia_partir`).
- `src/components/codex/menciones.js`, `useVeredictos.js`, `useIndiceCodex.js` — rastreo.
- `src/components/codex/AutocompletarCodex.jsx`, `HiloVizta.jsx` — autocompletado y modo Vizta.
