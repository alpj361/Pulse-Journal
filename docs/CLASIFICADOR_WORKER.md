# PULZOS | Worker de Clasificación
## El Clasificador
### Asociación semántica de hechos y afinamiento incremental del conocimiento

**Documento de diseño · v0.2 · Primer Worker de Vizta**

---

## 1. Qué es el Clasificador

El Clasificador es el primer Worker de Vizta y, sobre todo, la primera forma de memoria que tendrá el sistema. Su trabajo no es decidir qué noticia es ruido y cuál no — eso ya lo resuelve el sistema de trends actual. Lo que el Clasificador hace, y que hoy no existe en ningún lado, es tomar cada hecho nuevo que entra al sistema y conectarlo con todo lo que ya pasó antes, buscando por significado dentro de la base de datos.

Cuando un tema reaparece después de semanas o meses, el Clasificador reconoce que no es nuevo: es la continuación de algo que ya venía. Cuando encuentra algo mal puesto y la corrección es clara, lo arregla él mismo. Y cuando se topa con algo que no logra resolver porque le falta contexto, en lugar de inventarse una conexión, levanta una pregunta para que vos la respondas. Así el sistema no solo recuerda lo que pasó: también se corrige y aprende dónde su propio entendimiento está incompleto.

**En una línea:** el Clasificador asocia el presente con el pasado, corrige lo que puede, y te muestra qué le falta saber.

---

## 2. Jobs y Workers — vocabulario base

Conviene fijar el vocabulario antes de seguir, porque de aquí en adelante son dos cosas distintas.

- **Jobs**: lo que hoy ya existe — los scripts que corren en NewsCron que scrapean perfiles, obtienen trends, y generan las news cards, la narrativa y el feed. Los Jobs traen y producen el material crudo; no razonan sobre él.
- **Workers**: lo nuevo — la capa que toma ese material y lo interpreta, conecta y organiza. El Clasificador es el primer Worker; el Law Worker será el segundo.

La relación entre ambos es de **secuencia**: los Jobs corren primero y dejan el material en la base; los Workers corren después, río abajo, sobre lo que los Jobs ya dejaron. NewsCron pasa a ser el host de las dos cosas — sigue ejecutando los Jobs y ahora también dispara a los Workers en su turno. Y como los Workers van a ser varios, existirá una tabla que los registra a todos, igual que hoy los Jobs son un conjunto conocido de scripts.

---

## 3. El problema que resuelve

Hoy cada cosa que el sistema captura aterriza aislada. Una noticia, un tweet o un trend entran a la base de datos como un registro suelto, sin relación con lo que se publicó la semana anterior o hace tres meses. El resultado es que un tema con historia se siente siempre como si arrancara de cero. El lector — y vos mismo — pierden el hilo: no hay nada que diga *"esto es el siguiente capítulo de aquello"*.

Hay un segundo problema, más silencioso. El sistema no tiene forma de saber lo que no sabe. No entiende, por ejemplo, qué implica que el Congreso esté en periodo extraordinario, así que no puede distinguir entre actividad legislativa real y simple ruido político alrededor del Congreso. Ese conocimiento general — los periodos, los calendarios institucionales, el contexto procesal — no vive en ninguna parte todavía, y nadie le está diciendo al sistema que le hace falta.

**El Clasificador ataca los dos al mismo tiempo:** reconstruye la continuidad entre hechos, y convierte sus propios vacíos de contexto en preguntas que vos podés responder.

---

## 4. Qué hace — el ciclo completo

El ciclo corre cada vez que entra material nuevo a la base:

1. **Entra un hecho nuevo** desde los Jobs.
2. **Se genera un vector** (embedding) que representa su significado.
3. **Se busca por similitud semántica** en el histórico — no por palabras, sino por sentido.
4. **Se evalúa la confianza** de las asociaciones encontradas. De ahí salen tres caminos:
   - ✅ **Asociación clara** → registra la continuidad, enlaza al Tema existente o crea uno nuevo.
   - 🔧 **Error detectado** → si la corrección es evidente, la hace él mismo.
   - ❓ **Duda genuina** → escribe el cuestionamiento en la tabla para que vos lo atiendas.

Cada vuelta del ciclo termina de una de tres formas: **alimenta un Tema**, **corrige un error**, o **levanta un cuestionamiento**.

---

## 5. Las nuevas tablas en la base de datos

El Clasificador escribe en tres tablas nuevas de Supabase:

| Tabla | Qué guarda |
|-------|-----------|
| **Temas** | Los hilos: temas, actores y cosas que aparecen en común entre hechos. Es la continuidad — donde el hilo de una historia se acumula con el tiempo. |
| **Cuestionamientos** | Las dudas que el Worker no pudo resolver solo y que escala a vos. También es el registro de lo que el sistema aún no entiende. |
| **Workers** | El registro de los Workers creados, con su estado y configuración. El panel de control de la capa de razonamiento. |

### Temas
Cada vez que el Clasificador encuentra temas, actores o cosas que se repiten o se relacionan entre varios hechos, los cristaliza en un Tema. Un Tema agrupa los items que pertenecen a la misma historia y los elementos que tienen en común, y **crece con el tiempo** a medida que entran hechos nuevos que le pertenecen.

### Cuestionamientos
La cola de lo que el Clasificador no pudo resolver solo. Aquí caen las dudas que escala hacia vos — asociaciones que no tuvo la confianza de hacer, y sobre todo vacíos de contexto general que le impiden interpretar algo. **Responder los cuestionamientos es lo que entrena al sistema**: cada respuesta tuya cierra una duda y agrega conocimiento que evita las futuras.

### Workers
El registro de los Workers que se vayan creando. Empieza con el Clasificador, sumará el Law Worker, y los que vengan. Guarda qué hace cada Worker, su estado y su configuración.

---

## 6. Qué necesita — el RAG semántico sobre Supabase

La pieza central es un **índice semántico** usando `pgvector` dentro de Supabase:

- Cada hecho del histórico se convierte en un embedding (vector que representa su significado) y se guarda junto a la fila original.
- Cuando entra algo nuevo, se convierte en su propio vector y se busca por **cercanía entre vectores**, no por coincidencia de texto.
- Por eso *"reforma a la ley de competencia"* puede emparejarse con *"iniciativa 5906"* aunque no compartan ni una sola palabra.

**Por qué dentro de Supabase y no en un servicio aparte:**
- Todo — noticias, tweets, análisis — ya vive ahí.
- `pgvector` mantiene la memoria en el mismo lugar que los datos.
- No se paga un servicio externo.
- No se repite lo que pasó con Zep, que falló en silencio y nunca llegó a guardar nada.
- El costo en tokens aparece solo en dos momentos puntuales: generación de embeddings (baratísimo) y redacción de asociaciones/preguntas sobre los pocos candidatos recuperados.

### Qué se indexa

| Fuente | Qué aporta a la memoria |
|--------|------------------------|
| `news_cards` | Las noticias AI-generadas — el grueso del relato diario. |
| `trending_tweets` | Las señales tempranas de qué se está moviendo. |
| `narrativa_diaria` | La síntesis del día, útil para ubicar el clima general. |
| `trends` | Los temas que el sistema ya marcó como relevantes. |
| Análisis existentes | Lo que ya se generó sobre política y otros temas en la DB. |

### Qué hay que montar
- `pgvector` activado en Supabase.
- Columna de embedding sobre las tablas históricas (o tabla de índice aparte que las referencie).
- Modelo de embeddings barato para poblarla.
- Consulta de recuperación por similitud: dado un hecho nuevo → devuelve sus parientes del pasado.

---

## 7. Qué conocimientos necesita

El Clasificador necesita dos clases de conocimiento distintas:

### Memoria histórica
El registro completo de lo que ya pasó, convertido en el índice semántico. Es su **memoria de largo plazo**. Se construye sola: a medida que los Jobs siguen corriendo y poblando la base, el índice crece sin intervención manual.

### Conocimiento general o contextual
Los marcos que le permiten **interpretar** lo que ve: periodos legislativos (ordinario y extraordinario) y qué implica cada uno, calendarios institucionales, contexto procesal de cómo se mueve una ley o un caso. Este conocimiento **no se construye solo**: lo curás vos. Es exactamente aquí donde el Clasificador gana su segundo propósito — como no lo tiene, te va señalando dónde le hace falta a través de los Cuestionamientos.

**La relación entre los dos:**
- La memoria histórica le dice *"esto ya pasó antes"*.
- El conocimiento general le dice *"y esto significa tal cosa en este contexto"*.
- Con solo la primera, conecta hechos pero no los entiende del todo.
- Con las dos, ubica cada hecho en su lugar correcto.

---

## 8. El loop de afinamiento y la auto-corrección

Esta es la parte que vuelve al sistema más listo con el tiempo. Tiene dos niveles:

1. **Auto-corrección primero**: antes de escalar a vos, el Clasificador intenta resolver por su cuenta. Si encuentra algo claramente mal puesto y la corrección es evidente, la hace él mismo. Solo cuando de verdad no puede decidir con seguridad escala la duda.

2. **Cuestionamientos que valen tu criterio**: las preguntas que sí escalan son de dos tipos:
   - De **asociación**: *"esto parece relacionarse con tal evento de tal fecha, ¿lo conecto?"*
   - De **contexto**: *"esto ocurre durante un periodo extraordinario; no tengo registrado qué implica eso, ¿me lo explicás?"*

**Cada respuesta tuya se vuelve conocimiento general nuevo**: la próxima vez que aparezca algo parecido, el Clasificador ya no pregunta. Con el tiempo las preguntas se vuelven más raras y más finas, y lo que queda es un sistema que entiende cada vez mejor el terreno guatemalteco.

De paso, ese flujo de cuestionamientos es un **mapa de las áreas de oportunidad del sistema de trends**: muestra qué está capturando pero no logra ubicar — los temas que vale la pena atender.

---

## 9. Lo que el Clasificador NO hace

Para que no se desborde, sus límites con claridad:

- ❌ No opina ni interpreta los hechos — eso es trabajo del Codex, Vizta y los productos que vendrán.
- ❌ No vuelve a scrapear ni a generar noticias — eso lo hacen los Jobs en NewsCron; el Clasificador trabaja río abajo.
- ❌ No decide qué es ruido — eso ya existe.
- ❌ No inventa conexiones: corrige solo lo que es claro, y cuando no está seguro, pregunta.

Mantener estos límites es lo que evita que el Clasificador se convierta en *"que haga periodismo"*.

---

## 10. Orden de implementación

### Fase 1 — Fundación (en este orden estricto)

```
1. RAG semántico
   └── Activar pgvector en Supabase
   └── Generar embeddings del histórico
   └── Dejar lista la búsqueda por similitud
   (Sin esto el Clasificador no tiene con qué asociar)

2. Las tres tablas
   └── Crear Temas, Cuestionamientos, Workers
   (Tienen que existir antes de que el Worker corra)

3. El Clasificador en NewsCron
   └── Montar el Worker y dejarlo corriendo en su turno
   └── Ciclo básico: asocia hechos nuevos con el pasado
   └── Empieza a poblar Temas
```

### Fase 2 — Afinamiento

```
4. Loop de afinamiento
   └── Auto-corrección de lo claro
   └── Escalada de cuestionamientos
   └── Interfaz en la app para responder desde vos

5. Conocimiento general
   └── Almacén de contexto curado
   └── Periodos legislativos y calendarios institucionales
   └── Se va llenando con las respuestas a cuestionamientos

6. Estado en Temas
   └── Temas acumulan estado
   └── Cada corrida procesa solo lo nuevo
   └── Reporta qué cambió (costo plano a medida que la base crece)
```

### Fase 3 — Expansión

```
7. Law Worker
   └── Segundo Worker registrado en la tabla Workers
   └── Montado sobre el subset legal que el Clasificador dejó ordenado
```

---

## Fase 4 — Afinamiento del Histórico

Esta fase corre **una sola vez**, antes de que el sistema entre en operación normal. Su propósito es procesar todo lo que ya existe en la base — con criterio, no a ciegas.

### El problema del histórico

El histórico acumulado es ruidoso por naturaleza:
- Tweets duplicados o casi duplicados de la misma tendencia
- News cards generadas con errores que luego se corrigieron
- Trends que aparecieron una vez y nunca más
- Cosas bien clasificadas mezcladas con basura de épocas donde el sistema fallaba

Correr el Clasificador directo sobre todo eso sin filtrar generaría Temas basura. La estrategia es hacerlo en dos pasadas separadas.

### Pasada 1 — Poblar embeddings (sin clasificar)

`poblar_embeddings.js` indexa todo el histórico como vectores en `embeddings_index`. **No crea Temas, no toma decisiones.** Solo convierte texto en vectores.

Esto es seguro correrlo sobre todo el histórico — incluso sobre el ruido. Un vector de un tweet malo no daña nada.

```
Rango: últimos 365 días
Acción: solo indexar
Resultado: embeddings_index poblado con todo el histórico
```

### Pasada 2 — Clasificar el histórico (con criterio)

El Clasificador corre en **`modo_historico: true`**, clasificando desde lo más reciente hacia atrás con thresholds más estrictos para lo más viejo:

```
Últimos 30 días    → threshold normal (0.90 auto, 0.75 cuestionamiento)
30 a 90 días       → threshold estricto (0.92 auto, 0.85 cuestionamiento)
Más de 90 días     → solo indexar, no clasificar
```

**Por qué desde lo más reciente:** lo reciente es lo más relevante y probablemente lo más limpio. El histórico lejano tiene más ruido acumulado y no querés conectar un trend de hace 6 meses con algo de hoy solo porque comparten contexto en el embedding.

Al terminar, el Worker cambia automáticamente `modo_historico: false` en Supabase y el cron toma control normal.

### Parámetros en `workers.configuracion`

```json
"modo_historico": true,
"historico_dias_clasificar": 90,
"historico_dias_indexar": 365
```

### Lo que los Cuestionamientos van a revelar

Al clasificar el histórico van a aparecer muchos Cuestionamientos. Eso es esperado y útil — son el mapa de dónde está el ruido:

- **Temas con 40+ items iguales** → señal de duplicados en el sistema
- **Items huérfanos** (en `embeddings_index` sin `tema_items`) → contenido aislado que nunca conectó con nada
- **Cuestionamientos masivos sobre el mismo período** → época donde el sistema estaba fallando

Revisás los Cuestionamientos desde la UI (Fase 2), respondés los que valen, descartás los que son ruido.

### Orden de ejecución de Fase 4

```
1. Correr poblar_embeddings.js
   → indexa todo (365 días) en embeddings_index
   → sin crear Temas, sin clasificar

2. Editar workers.configuracion en Supabase:
   → modo_historico: true
   → historico_dias_clasificar: 90
   → historico_dias_indexar: 365

3. Correr clasificador_worker.js manualmente (una vez)
   → clasifica últimos 90 días
   → genera Temas y Cuestionamientos del período reciente
   → al terminar: escribe modo_historico: false automáticamente

4. Revisar resultados en ThePulse (Fase 2):
   → responder Cuestionamientos que valen
   → descartar los que son ruido
   → verificar que los Temas creados tienen sentido

5. El cron toma control normal:
   → modo_historico: false
   → solo procesa lo nuevo desde ultimo_item_procesado_at
```

---

*Pulzos · Worker de Clasificación · documento de diseño v0.2*
