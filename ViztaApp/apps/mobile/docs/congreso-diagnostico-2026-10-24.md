# Diagnóstico actualizado del Congreso en Vizta

**Fecha:** 24 de octubre de 2026. **Alcance:** Iniciativas, Leyes y decretos, Votaciones, Comisiones y citaciones, Pleno y sesiones, Fiscalización y actividad.

## Conclusión

Se encontraron tres clases de problemas: presentación y navegación, consultas de la app que recortaban el contenido disponible, y errores o faltantes persistidos en el backend. Cambiar el diseño no corrige por sí solo los estados ni las asociaciones de noticias. Tampoco un conteo en la base demuestra cobertura completa de las fuentes oficiales.

## Inventario comprobado mediante consultas de lectura

| Fuente | Disponible en la base | Cobertura observada | Límite de la evidencia |
| --- | ---: | --- | --- |
| Iniciativas | 512 | 509 con estado principal `conocio_pleno`; 3 con `presentada` | Hay avances posteriores en el historial y las noticias |
| Objetivos o resúmenes de iniciativas | 17 de 512 | Objetivo en eventos o resumen de noticia asociado | Es disponibilidad estructurada, no validación de esos textos |
| Enlaces de iniciativas | 508 con PDF y ficha; 4 con fuente de presentación | Todas tienen alguna fuente de respaldo | Una noticia no equivale al documento de la iniciativa |
| Votaciones | 82 | 8 sep 2026 – 22 oct 2026; 54 aprobadas y 28 no aprobadas | Falta cotejar contra el registro oficial |
| Leyes y decretos | 83 | 30 ene 2024 – 29 sep 2026 | 3 carecen de enlace PDF; la fecha no prueba publicación ni vigencia |
| Noticias del Congreso | 182 | 5 oct 2026 – 24 oct 2026 | La app filtra duplicados y contenido poco informativo; no todas se muestran como temas separados |

Los números son una fotografía de las consultas realizadas durante esta revisión y pueden cambiar con nuevas ingestiones.

## A. Problemas de diseño y navegación

| Hallazgo observado | Consecuencia | Cambio implementado |
| --- | --- | --- |
| Registros históricos y noticias recientes compartían el mismo menú, sin indicar alcance | Los conteos parecían comparables y completos | Grupos «Registros disponibles» y «Noticias y actividad», con períodos visibles |
| «Ver más» acumulaba iniciativas y decretos | Costaba volver, buscar o saltar a otra parte del registro | Páginas numeradas, anterior/siguiente y búsqueda sobre el registro cargado |
| Leyes presentaba filas sin acción clara; las filas sin PDF quedaban inertes | No era evidente si se podía consultar el documento | Cards con título, número, fecha y documento explícito; aviso cuando falta el enlace |
| Los resúmenes largos se truncaban | No había una acción clara para leerlos completos | Expansión del resumen independiente del recorrido o del detalle de la noticia |
| Los registros de años distintos no se distinguían claramente | Fechas y números de decretos podían confundirse | Fechas con año y filtro de año en Leyes |
| El selector ocupaba espacio aun después de elegir una sección | Había que recorrer navegación antes de llegar al contenido | Selector agrupado que se pliega al elegir y permite «cambiar sección» |
| Un tema agrupaba varias noticias pero no exponía todas | Una sola noticia representativa ocultaba el resto | Control de noticias relacionadas para abrir cada publicación |

## B. Problemas de consulta o clasificación de la app

### Por qué aparecían solo dos votaciones

`traerCongreso()` consultaba las votaciones únicamente para las fechas de los siete días con noticias elegidos para el tablero. `organizar()` reutilizaba esas mismas votaciones en «Organizado». En el período visible solo entraban las dos del 22 de octubre, aunque la tabla contenía 82.

**Corrección en la app:** Votaciones consulta su propio historial guardado, con búsqueda, filtros por resultado y paginado. Su acceso ya no depende de que haya noticias recientes.

**Lo que esto no demuestra:** no se ha comprobado que las 82 cubran todas las votaciones oficiales, ni que las dos del 22 de octubre representen la sesión completa. Esa comprobación pertenece a la auditoría de ingestión.

### Por qué otras secciones parecían tener tan poca información

Comisiones, Pleno y Fiscalización se construían con los mismos días recientes. Iniciativas y Leyes, en cambio, representaban registros de varios años. La interfaz no explicaba esa diferencia.

**Corrección en la app:** las secciones de noticias permiten «últimos días» o «historial disponible», muestran fechas y ofrecen búsqueda/paginado. Los grupos cuentan temas, que pueden reunir varias noticias.

### Qué pasa con «Fiscalización»

`seccionDe()` utilizaba Fiscalización como destino por defecto para lo que no clasificaba como comisión o pleno. Por eso aparecían allí notas culturales e institucionales.

**Cambio de presentación:** el rótulo ahora dice «Fiscalización y actividad», con explicación de su contenido. Se conserva la clasificación existente; no se presenta como una clasificación temática validada.

**Pendiente:** si se requiere una sección de fiscalización estricta, debe definirse una categoría explícita y consistente en los datos, revisar los registros actuales y adaptar la app a esa clasificación. No basta con cambiar el color o el título de la card.

## C. Errores y faltantes del backend

### 1. Estado principal desincronizado

La vista `iniciativas_app_view` toma `iniciativas.estado_actual` directamente. Aunque reúne `latest_event` y `eventos_timeline`, no los utiliza para resolver ese estado. `card_data.stage` además usa `COALESCE(i.estado_actual, 'conocio_pleno')`.

**Caso reproducible: 6775.** El registro principal dice `conocio_pleno`, pero su historial contiene `dictamen_favorable` del 15 de octubre de 2026. Fuente guardada: https://www.congreso.gob.gt/noticias_congreso/17259/2026/3.

La inspección encontró solo el trigger que actualiza `updated_at` en `iniciativas` y ningún trigger de usuario en `iniciativa_eventos`. Esto descarta sincronización mediante triggers entre ambas tablas; falta comprobar la lógica del servicio que escribe esos eventos.

**Trabajo para backend:** localizar la escritura del estado, normalizar alias, resolver transiciones con evidencia y mantener coherencia entre estado principal, historial y `card_data`. Un evento tardío no debe hacer retroceder el avance por accidente. Considerar retiro, rechazo, archivo y correcciones cuando existan.

### 2. Noticias asociadas a una iniciativa incorrecta o demasiado generales

**6863 / río Pinula:** dos noticias del 16 de octubre están asociadas al mismo número. La noticia `cfc2aa5a-6801-4169-84b4-ffad6661f696` es un resumen semanal sobre agenda y juramentación; no resume la propuesta del río Pinula. La específica es `c7757614-da73-4381-bc5e-6a85a1ef007e`, https://www.congreso.gob.gt/noticias_congreso/17274/2026/4.

**6842:** el registro dice «Ley de Horarios Escalonados para la Movilidad Urbana», pero la noticia `8f8909e8-57ba-4a63-a590-5f6781a1e806` la identifica como «Presupuesto 2027». Fuente guardada: https://www.congreso.gob.gt/noticias_congreso/17226/2026/3.

**Trabajo para backend:** verificar el número en la fuente, corregir asociaciones y revisar estados/montos derivados de ellas. Una noticia que menciona varias iniciativas no debe trasladar el mismo avance a todas.

La app prioriza resúmenes de noticias y usa objetivos guardados como respaldo. Tiene un filtro conservador de coincidencia temática para evitar algunos textos ajenos; ese filtro puede omitir paráfrasis válidas y no repara las relaciones en la base. El cruce de etapas todavía depende de la calidad de esas asociaciones.

### 3. Resúmenes y documentos faltantes

Solo 17 iniciativas tienen objetivo o resumen estructurado disponible. Hay 4 iniciativas sin PDF/ficha, aunque tienen fuente de presentación, y 3 decretos sin PDF.

**Acuerdo de esta fase:** conservar enlaces para que la persona lea el documento; usar resúmenes de noticias existentes. No se añade extracción ni generación de resúmenes de PDFs.

**Trabajo para backend:** recuperar enlaces oficiales faltantes cuando existan, comprobar las asociaciones y registrar procedencia. No construir una URL suponiendo que el número de iniciativa es el identificador interno del documento.

### 4. Montos

Se observaron unidades heterogéneas: `GTQ`, `quetzales (Q)` y `millones de Q`. La app normaliza el formato respetando la escala explícita.

El ejemplo de Q15 millones y Q40 millones corresponde a Foncc y Fobosques respectivamente según el resumen guardado. Ese ejemplo no demuestra una contradicción numérica. Para auditar un monto deben compararse fuente, fondo, moneda, escala, año y finalidad.

## Criterios de aceptación para el agente de backend

1. Corregir el estado de 6775 con su fuente y mantener coherencia entre las superficies de lectura.
2. Resolver los conflictos de asociación de 6863 y 6842, incluidos posibles avances derivados erróneamente.
3. Probar eventos fuera de orden, alias, estado desconocido, correcciones y reingestión idempotente.
4. Cotejar las votaciones guardadas contra las actas o registros oficiales por sesión, con conteos antes/después y procedencia.
5. Cotejar decretos y enlaces, sin inferir vigencia o publicación de una fecha sin verificar su significado.
6. Definir la taxonomía para separar fiscalización, intermediación y actividad institucional.
7. Mantener fuera de esta fase la extracción automática de resúmenes de PDFs.

## Validación y límites de esta entrega

- 67 pruebas del feed aprobadas en 9 suites.
- Metro compiló la aplicación para iOS con los cambios.
- Se capturaron e inspeccionaron Leyes, Votaciones, Comisiones, Pleno y Fiscalización antes del cambio, y la nueva navegación agrupada después.
- En el dispositivo se comprobó el nuevo conteo de 82 votaciones. La revisión visual de todos los flujos finales y sus estados aún está pendiente; las pruebas de componentes verifican búsqueda, filtros y paginado.
- No se modificaron tablas, vistas, políticas ni servicios del backend.
- No se cotejó el inventario completo contra las fuentes oficiales.
