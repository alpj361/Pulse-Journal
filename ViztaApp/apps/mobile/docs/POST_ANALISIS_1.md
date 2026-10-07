# `post_analisis/1` — el análisis de un post

Contrato del análisis de posts de la Task 2 (STA-191 → 2.1, STA-203). Lo
escribe ExtractorW y lo leen la app y la huella del autor. Decidido con PJ el
2026-10-03.

## Por qué tablas propias

Hasta ahora el análisis vivía entero en `codex_universe_items.details.analysis`.
La huella necesita buscar entre muchos posts **por autor, por tiempo, por eje y
por fuente**, y eso adentro de un JSON por post es lento. PJ decidió tabla
propia por latencia.

**Transición:** ExtractorW escribe en los dos lados (`details.analysis` como
siempre y las tablas nuevas). La app sigue leyendo `details.analysis` hasta la
2.6; ahí pasa a leer las tablas y el JSON del post se retira.

## Tablas

Todas privadas por persona (RLS `user_id = auth.uid()`), como el Codex. La
huella se podrá compartir cuando exista la colaboración, no antes.

### `autores`
Quien publica: una **persona, un grupo o una institución** — alguien que hace
contenido y transmite un discurso.

| Columna | Qué es |
|---|---|
| `plataforma` + `usuario` | La identidad (única por dueño). `usuario` en minúsculas, sin `@`. |
| `usuario_confirmado` | `false` si la plataforma solo dio el nombre visible (los reels hoy traen «Bihotza Uberuaga», no el usuario). Hay que capturar el usuario real al traer el post. |
| `nombre` | Nombre visible. |
| `clase` | `persona`, `grupo`, `institucion` (o vacío hasta saberlo). |
| `codex_item_id` | La ficha del Codex, **solo si la persona ya la tiene**: la huella sugiere crearla, no la crea. |

### `post_analisis` — uno por post
| Columna | Qué es |
|---|---|
| `autor_id` | Quién publicó. |
| `contenido_clave` | `plataforma:clave` (`instagram:Dd90cFJFNxF`). El servidor puede reutilizar el análisis de un reel que otra persona ya pagó. |
| `nivel` | `basico` (solo texto y transcripción) o `avanzado` (la escalera de ver y oír, 2.2 y 2.3). |
| `publicado_en` | Fecha del post: **el tiempo cuenta** para la huella. Hoy no se captura; hay que traerla al cargar el post. |
| `tipos` | `[{ tipo, confianza, cuenta }]`: **los ocho tipos**, cada uno con su número de 0 a 1 (cuánto tiene el post de cada uno), de mayor a menor. `cuenta` dice si pasa 0,6. Tipos: opinion, informacion, aprendizaje, hechos, comedia, narrativa, baile_tendencia, lista. Los da Jev. |
| `narrativa` | `{ resumen, ejes: [{ eje, tema, postura, sentido, hacia, cita, cita_en_texto, confianza, hablante }] }`. `eje`: politico, economico, social, cultural o especifico; `postura`, lo que el post sostiene ahí; `sentido`: a_favor, en_contra, informa o mixto, respecto de `hacia`; `confianza`, el número que le pone Jev (por debajo de 0,35 el eje no se guarda). Hasta tres, o ninguno. |
| `paises` | `[{ nombre, boundary_id, rol, veces }]`, con la red sin IA del catálogo (STA-217). |
| `temas`, `menciones`, `relaciones` | Como el análisis v2 (las menciones con su vínculo al Codex). |
| `fuentes` | `[{ nombre, tipo, cita, cita_en_texto }]`: a quién invoca el post para sostener lo que dice. `tipo`: medio, institucion, persona, documento, estudio, dato_oficial, otro. Solo entran las que están nombradas en el texto. Pesa en la confianza; no citar también dice algo. |
| `hablantes` | `[{ id, rol, nombre, descripcion, turnos, palabras, es_autor, seguro }]`, solo si hablan dos o más voces. `id` es `H1`, `H2`… en el orden en que hablan; `rol`: anfitrion, invitado, narrador, voz_en_off, personaje (un fragmento ajeno), otro. `es_autor` dice si esa voz es la cuenta que publicó (`null` si no se sabe) y `seguro`, si salió de un nombre dicho en voz alta o solo del papel. Lo que dice un invitado no suma a la huella del anfitrión; entrevistarlo sí. Los turnos crudos están en `details.turnos` del post (`[{ h, t, texto }]`). |
| `linea_tiempo` | `[{ desde, hasta, tipo, hablante, texto, aprox }]`, tipo: `habla`, `escena`, `texto_en_pantalla`. Lo dicho sale de `details.tramos` y sus segundos son aproximados (`aprox: true`: los pone el modelo que transcribe); lo visto y lo escrito salen de lo que el vistazo anotó de cada cuadro, en el segundo exacto de ese cuadro. Solo en reels mirados. |
| `cantidades` | `[{ valor, numero, variable, hacia, periodo, cita, cita_en_texto }]`: las cifras en piezas, **valor · variable → hacia** («240 millones · quetzales de inversión → ruta de Villa Canales», «20% · remesas → PIB»). `valor` es el número como se muestra (con `%`, `‰`, `mil` o `millones`, y con el símbolo de la moneda si es dinero: `Q3,850`, `€20`; solo se aclara cuál cuando varias comparten símbolo: `US$`, `MX$`); `moneda`, su código (`GTQ`, `USD`…) o `null`; `numero`, el mismo ya leído como número, para comparar o graficar; `variable`, lo que se cuenta; `hacia`, a qué o a quién corresponde. Sin años sueltos ni medidas de recetas. Un análisis anterior al 2026-10-04 trae `que_representa` y `de` en vez de `variable` y `hacia`. |
| `aprender` | `{ idea, puntos, contexto, conceptos: [{ termino, explicacion, en_texto }], pasos, preguntas }` si el post enseña algo; si no, `null` y la sección no aparece. Es una lección corta: `puntos` es lo que el post explica (solo lo que dice); `contexto`, lo único que va más allá del post, y por eso se muestra aparte. Lo decide Jev (0,25 o más de «aprendizaje»). |
| `calidad` | `{ reintentos, avisos, hechos, hechos_con_cita, hechos_descartados, contiene: { cifras, receta, guardables } }`. `contiene` es lo que Jev dice que el post trae (0 a 1). Si esperaba cifras o una lista (0,6 o más) y el análisis no las trajo, se vuelven a pedir una vez (`reintentos`); lo que sigue faltando queda en `avisos`: `sin_cifras`, `sin_lista`, `sin_receta`, `sin_guardables`, `citas_no_literales`. |
| `modelo`, `costo_microusd` | Con qué se hizo y cuánto costó. |

### `post_afirmaciones` — muchas por post
`verificable` es un número de 0 a 1 que pone Jev a cada una: desde 0,6 es un
hecho, entre 0,3 y 0,6 una afirmación, y por debajo de 0,3 no se guarda.

Lo verificable: `texto` (redactado), `cita` (literal) y `cita_en_texto`,
`cifra`, `momento_seg`, `hablante` (el `id` de la voz que lo dice, `H2`, o vacío si habla una sola persona o la cita no se encontró en ningún turno),
`sobre_codex_ids` (de quién o qué habla) y `fuente`.

### `post_guardables` — la lista de lo mencionado
Todo lo que el post nombra y vale la pena guardar. Se rehace en cada análisis;
lo que la persona ya guardó (`guardado = true`) no se toca ni se repite.

| `tipo` | De dónde sale | Se confirma contra |
|---|---|---|
| `pelicula`, `serie` | Mención con material, o la obra que identificó el vistazo | TMDB |
| `libro` | Mención con material | Open Library |
| `musica` | Mención con material | MusicBrainz |
| `lugar` | Mención con material | Apple Maps |
| `videojuego`, `herramienta` | Mención con material | Wikidata (mismo nombre y descripción de la clase) |
| `podcast`, `sitio`, `producto`, `comida` | Mención con material | nada todavía |
| `lista` | Lo que el post enumera | — |
| `receta` | Cómo preparar algo | — |

`datos` siempre trae `origen` (`analisis` o `vistazo`). Según el tipo:

- De una mención: `confirmado` (si una base de afuera la encontró), `identidad`
  (año, imagen, url…), `como_aparece`, `pista`, `rol`, `en_texto`.
- De una obra vista: `relacion` (`escena` o `audio`), `anio`, `url`, `imagen`.
- `lista`: `items: [{ texto, detalle, mencion }]`; `mencion` ata el ítem a la
  mención que trae la identidad.
- `receta`: `ingredientes` y `pasos`.

Los **hechos** no van acá: son `post_afirmaciones`.

## Lo que todavía no está

- La **huella** (`autor_huellas`) y los **pulgares** con comentario son de la
  2.5: se diseñan aparte, con las decisiones de PJ en STA-207.
- Un reel traído antes del 2026-10-03 no tiene cuadros, usuario real ni fecha:
  se completa solo la primera vez que se toca su ojo (`details.completado_en`).
- El set de prueba etiquetado a mano (los 93 posts).

## Estado al crearlas (2026-10-03)

55 autores (11 con usuario real), 33 análisis migrados desde `details.analysis`
(todos con autor), 157 afirmaciones (los hechos de esos análisis). Migraciones
en la base: `post_analisis_1` y `post_analisis_1_backfill`.
