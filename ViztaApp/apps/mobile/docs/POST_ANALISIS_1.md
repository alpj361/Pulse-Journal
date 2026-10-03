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
| `tipos` | `[{ tipo, confianza }]`: opinion, informacion, aprendizaje, hechos, comedia, narrativa, baile_tendencia, lista. Puede haber varios. |
| `narrativa` | `{ resumen, discurso, ejes: [{ eje, postura, confianza }] }`. Ejes: político, económico, social, cultural o específicos; uno, varios o ninguno. |
| `paises` | `[{ nombre, boundary_id, rol, veces }]`, con la red sin IA del catálogo (STA-217). |
| `temas`, `menciones`, `relaciones` | Como el análisis v2 (las menciones con su vínculo al Codex). |
| `fuentes` | `[{ nombre, tipo, cita }]`: lo que el post cita. Pesa en la confianza; no citar también dice algo. |
| `hablantes` | `[{ id, autor_id, es_autor, rol }]`, rol: anfitrión, invitado, narrador, voz en off. Lo que dice un invitado no suma a la huella del anfitrión; entrevistarlo sí. |
| `linea_tiempo` | `[{ desde, hasta, tipo, hablante, texto }]`, tipo: escena, habla, texto en pantalla. |
| `modelo`, `costo_microusd` | Con qué se hizo y cuánto costó. |

### `post_afirmaciones` — muchas por post
Lo verificable: `texto` (redactado), `cita` (literal) y `cita_en_texto`,
`cifra`, `momento_seg`, `hablante` (quien lo dice no siempre es el autor),
`sobre_codex_ids` (de quién o qué habla) y `fuente`.

### `post_guardables`
Lo que la gente guarda de un reel: `tipo` (lugar, lista, pelicula, serie,
libro, producto, receta, musica, otro), `titulo`, `datos` (dirección, ítems de
la lista, año…), `codex_item_id` y `guardado`.

## Lo que todavía no está

- La **huella** (`autor_huellas`) y los **pulgares** con comentario son de la
  2.5: se diseñan aparte, con las decisiones de PJ en STA-207.
- `tipos`, `ejes`, `fuentes`, `hablantes`, `linea_tiempo` y `guardables`
  existen en la tabla pero se llenan desde la 2.2 a la 2.4.
- El set de prueba etiquetado a mano (los 93 posts).

## Estado al crearlas (2026-10-03)

55 autores (11 con usuario real), 33 análisis migrados desde `details.analysis`
(todos con autor), 157 afirmaciones (los hechos de esos análisis). Migraciones
en la base: `post_analisis_1` y `post_analisis_1_backfill`.
