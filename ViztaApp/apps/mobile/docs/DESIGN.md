# Cómo habla Vizta

Reglas de voz para todo lo que lee una persona dentro de la app: botones,
avisos, permisos, estados vacíos, errores. No aplica a los comentarios del
código —eso lo leemos nosotros— ni a los logs.

## La regla

**Si la frase le sirve a quien programó y no a quien usa, está mal escrita.**

Los textos de la app no explican cómo funciona la app. Dicen qué pasa, o qué
se gana. La mecánica —el sistema operativo, los permisos, las geocercas, los
timeouts, los nombres de las tablas— es asunto nuestro.

| En vez de                              | Se dice                                          |
| -------------------------------------- | ------------------------------------------------ |
| «iOS no va a volver a preguntar»       | «El mapa se destapa solo desde Ajustes»           |
| «Falta el permiso *siempre*»           | «El mapa se descubre por los lugares recorridos»  |
| «La app se despierta a los 400 m»      | (no se dice: es mecánica interna)                 |
| «Error 402: sin cupo»                  | «Se te acabaron los créditos de hoy»              |
| «No se pudo hacer fetch del análisis»  | «No se pudo analizar. Puede intentarse de nuevo.» |

## Qué no va nunca

- **Nombres del sistema**: iOS, Android, API, endpoint, token, caché, RLS,
  `boundary_id`, «la tabla», «el servidor». Nada de eso existe para quien lee.
- **Números de implementación**: metros de una geocerca, milisegundos de un
  timeout, tamaños de lote. Si el número no cambia una decisión de la persona,
  no va.
- **Órdenes sueltas**: «Hacé esto», «Activá aquello». Se dice qué se consigue y
  se ofrece el camino: un botón que lleva a Ajustes, no una instrucción para
  que lo busque.
- **Culpar a la persona**: «No otorgaste el permiso». Pasó algo, y se puede
  arreglar; nadie hizo nada mal.

## Qué sí

- **Instructivo, no conversado** (PJ, 31-oct-2026). La interfaz describe qué
  hace cada cosa; no le habla a la persona ni habla en primera persona. Rótulos
  como nombres de acción («Corregir el análisis», «Reportar algo que falta»,
  «Calificar el análisis») y explicaciones impersonales («El post se analiza de
  nuevo con la corrección»). Nada de «lo vuelvo a analizar con lo que me
  digas», «¿te sirvió?» ni «algo que no sabe leer todavía». Si hace falta un
  verbo dirigido, va sin voseo. Lo que ya existe se pasa a este tono cuando se
  toca.
- **Minúscula en los controles**, como el resto de la interfaz: `buscar un
  lugar`, `mostrar todo`, `ajustar`. Los títulos de un aviso sí van con
  mayúscula inicial.
- **Corto.** Un aviso son dos renglones: qué pasa y qué se puede hacer. Si
  hacen falta tres, casi siempre sobra el que explica la mecánica.
- **Clasificar sin juzgar** (PJ, 1-nov-2026). Un filtro o un grupo dice
  *qué tipo* de cosa es, no cuánto importa: «leyes», «elecciones», «acuerdos y
  resoluciones», «trámite de la sesión». Nunca «importantes», «principales» ni
  «relevantes»: decidir que una votación vale más que otra es una opinión, y
  la app no la da. Lo que sobra se ordena y se pliega, no se descarta por
  menor.
- **El término de la institución.** Cuando algo tiene nombre oficial se usa ese
  nombre, no la descripción del procedimiento: «urgencia nacional», no «en
  único debate».
- **La fecha va con su referencia oficial.** Lo que ocurrió en una sesión lleva
  al lado de la fecha el número de sesión, como lo nombra la institución:
  «27 oct 2026 · Sesión ordinaria 54». No va suelto debajo del título.
- **El beneficio antes que el mecanismo.** «El mapa se va descubriendo por donde
  andás» dice lo mismo que «monitoreo de regiones en segundo plano», y además
  se entiende.

## Cómo se ve

**Nunca puntos de viñeta.** No van al lado de un rótulo («REDES ●»), ni
antes de un título, ni como «pulso» de algo que está activo. En la app se ven
como ruido. Si algo es importante, se nota en el texto, en el color de la
tarjeta o en un filtro; no en un punto suelto.

**El encabezado no repite lo que ya se sabe.** Si estás en el chat de Morrow,
el tema no dice «Morrow lo está siguiendo»: eso ya está dicho. Tampoco se cuelgan
acciones sueltas arriba («pausar», «seguir»). Lo que se controla de algo va en
su propia fila, con su interruptor, al lado de lo que controla.

**Sin subtítulos de relleno.** Debajo de un nombre o un título solo va algo si
dice algo nuevo y vigente. Nada que ya diga el lugar donde estás, el avatar o el
título de arriba:

| No va                                         | Por qué                                                   |
| --------------------------------------------- | --------------------------------------------------------- |
| «de Morrow» bajo «Tareas»                     | Entraste desde el perfil de Morrow: ya se sabe de quién es |
| «agente» al lado del nombre                   | El avatar y la lista ya lo dicen                          |
| «agente · responde a vos» bajo el nombre      | Es relleno: no cambia nada de lo que vas a hacer          |
| «dashboard · versión 1 · de ChatGPT»          | El título y el número de versión alcanzan                 |

Si no hay nada que decir, el renglón no existe: no se pone un texto de reemplazo.
Lo que sí puede ir es lo que está pasando ahora («Organizar fichas del Codex»),
y solo mientras sea cierto.

**El estado va en un ícono; el número lo completa** (PJ, 1-nov-2026). Lo que
ya se sabe por el ícono no se escribe: aprobada es un círculo con visto verde,
no aprobada un círculo con equis roja. Al lado va solo la cifra que lo
explica: «125 a favor» si se aprobó, «20 en contra» si no. Los rótulos no se
alargan con palabras que el ícono ya dice («APROBADA · EN ÚNICO DEBATE ·
INICIATIVA…» pierde la jerarquía): el rótulo queda para *qué* se votó.
En una lista de pasos, ícono y cifra van en columna: la fila que no tiene
flecha (no abre ficha) o no tiene cifra guarda ese lugar vacío, para que los
votos queden alineados (PJ, 7-nov-2026).

**De quién es algo también va en un ícono** (PJ, 1-nov-2026). Donde se mezcla
lo de un agente con lo de la persona, cada cosa lleva su ícono: una persona si
el agente lo creó en tu Codex, un archivo si es del agente, el signo de unir
si está en los dos. Nunca «se parece a uno tuyo» para algo que ya es tuyo.

**Una persona se toca y aparece su ficha** (PJ, 1-nov-2026). En un hemiciclo,
un mapa o una lista de votos, tocar a alguien abre una ficha emergente sobre
la pantalla: su foto, su nombre, su bancada y su distrito, y en una votación
cómo votó, con su ícono. No se navega a otra pantalla ni se escribe el nombre
debajo del dibujo.

**Una votación, un hemiciclo** (PJ, 5-nov-2026). Cerrada, la votación lleva
el hemiciclo de conteos. Al abrirla, el de cada diputado (el que se toca) lo
reemplaza; no se apilan dos medias lunas del mismo voto. El de conteos queda
solo mientras llegan los votos de cada diputado o si no están.

**Una enmienda se explica, no solo se cuenta** (PJ, 6-nov-2026, STA-323).
Toda votación de enmienda abre su ficha, desde la votación suelta («ficha de
la enmienda») o desde su paso plegado bajo la ley, que ya lleva su nombre en
sencillo. La ficha dice, en este orden: en qué quedó (con votos y fecha), el
enlace para verla en la sesión (siempre, arriba: al momento exacto si se
sabe), qué significa en sencillo, a qué pertenece (iniciativa, ley con su
estado y artículo del proyecto), quién la propuso, lo que decía antes frente a
lo que se propuso, su efecto y el trámite de la iniciativa (hasta el dictamen
y después). Cada parte va solo si hay algo que decir: lo que falta no se
anuncia («no identificada» no se escribe). Un paso que solo cuenta la prensa
dice «según prensa». El hemiciclo va al final, de apoyo. «Con las enmiendas
incorporadas» no es una enmienda: es el título ya enmendado.

**Un decreto dice su estado real** (PJ, 6-nov-2026, STA-323). En «Leyes y
decretos», cada decreto lleva su estado de la biblioteca legal: vigente,
vigente · reformada, vetada (en rojo apagado), derogada, pendiente de sanción
o vigencia diferida. Sin ficha en la biblioteca dice «estado sin confirmar»:
aprobado no es vigente. Las leyes que cambió van con sus artículos solo si la
biblioteca ya tiene esa relación («reforma Código Penal · arts. 327 B, 327 F
y 327 G»), y «ficha de la ley» la abre en el buscador legal.

**El veto se ve antes que el título** (PJ, 6-nov-2026). «vetada» va en una
pill redonda, fondo rojo y letra blanca, en todo lugar donde aparece (lista de
decretos, ficha de la ley, iniciativas, buscador, enmiendas). Los demás
estados van en pill gris. En la ficha de una ley el veto se dice una vez,
arriba; abajo, «En el Congreso» solo dice de qué iniciativas nació (todas, si
son varias), sin repetir su etapa.

**El camino de un decreto** (PJ, 6-nov-2026). Un decreto reciente lleva sus
pasos en puntos que se van llenando: aprobado, Ejecutivo, sancionado,
publicado, en vigor; cada uno con su fecha si consta. Los rótulos son
sustantivos cortos: «Ejecutivo», no «al Ejecutivo». Mientras no se sanciona,
el paso en que va es «Ejecutivo». Un decreto vetado sigue al Congreso: el
punto rojo de «vetado» y después «Congreso» (sin resolver), «veto aceptado»
(en rojo: ahí termina) o «veto superado» (sigue a publicado y en vigor). Lo
que el pleno resolvió sale de su votación, no se supone. La descripción larga
de una ley se pliega a tres renglones con «leer más».

**Lo que todavía no es ley no está en el buscador legal** (PJ, 7-nov-2026). Un
decreto vetado, sin sancionar o que aún no entra en vigor no sale en el
buscador legal: ni la ley ni sus artículos, porque no rigen. Sus artículos se
leen en su tarjeta del registro de decretos, plegados («14 artículos») y cada
uno con «leer completo», en lugar de «ficha de la ley». Desde una iniciativa,
«no entró en vigor» nombra el decreto sin enlace.

**Los partidos, por su logo** (PJ, 7-nov-2026). Debajo del hemiciclo, cada
bancada va con su logo (del dataset, `logo_del_partido`) y su cifra, no con el
nombre; los independientes, que no son partido, van en texto. Tocar un logo
resalta sus curules, pinta el mapa con su color (tono relativo a su distrito con
más diputados) y lista a sus diputados agrupados por el distrito que
representan.

**Diputados que dejan el cargo** (PJ, 7-nov-2026). El estado sale del dataset
«Congreso de Guatemala» (`estado`, `fecha_estado`, `ocupa_la_curul_de`). Quien
falleció va con la foto y el anillo en gris; quien renunció o fue destituido, sin
gris. Todos llevan su pill («fallecimiento · 6 nov») y su helper. Su curul queda solo
en contorno hasta que la ocupa el reemplazo, y la leyenda no la cuenta en su
bancada. Las votaciones pasadas no cambian: sus votos siguen con su nombre.

**Las explicaciones del camino van en helpers** (PJ, 6-nov-2026). Debajo de los
puntos no va ninguna oración fija ni la razón de que falte la ficha de la ley.
Cada paso se toca y abre su helper: un globo oscuro con pico debajo del paso,
en frases completas, que enseña cómo funciona el trámite (por ejemplo, en
«Ejecutivo»: «Actualmente se espera la sanción del Ejecutivo. Puede tardar,
según cuándo se entregue a la Secretaría General de la Presidencia…»). La
primera vez se abre solo en el paso en que va, con la nota de que cada paso se
puede tocar; al tocar un paso o cerrarlo no vuelve a abrirse solo. Los plazos
que cita salen de la Constitución (arts. 177 a 180).

**Lo nuevo se ve como lo de antes** (PJ, 6-nov-2026). Todo dato que se agregue
(sobre todo desde el backend) usa los patrones ya trabajados —pill, camino con
puntos, plegable con flecha, una línea con fecha— y es dinámico: nada de
párrafos largos. Cada estado visual se explica en su helper, que se abre al
tocarlo.

**Los avisos de una sesión van en pill, con su helper** (PJ, 6-nov-2026). Lo
que le pasa a una sesión —sin acta, sin votaciones, solo prensa, sin quórum,
suspendida— no lo deduce la app: viene de la base (`avisos_automaticos` y
`aviso_editorial` de la sesión). Se muestra como pill gris al lado de la línea
de la sesión («27 oct 2026 · Sesión ordinaria 54»), y al tocarla se abre el
helper con la explicación. Sin aviso, la línea va sola.

**La etiqueta dice de qué trata la nota, no lo que menciona** (PJ, 6-nov-2026).
Una nota del tablero es «Interpelación» solo si trata de una interpelación: la
comparecencia del ministro, la interpelación misma. El orden del día de una
sesión o su cierre por falta de quórum son del pleno, aunque entre sus puntos
haya una interpelación; y que el resumen la nombre no basta.

**Un grupo se mira como un distrito** (PJ, 1-nov-2026). En una votación, tocar
una curul muestra a esa persona en una línea (foto, nombre, bancada y voto),
sin abrir nada encima; tocar un voto («122 a favor») o una bancada muestra las
fotos de todos los de ese grupo, como al tocar un distrito en el mapa, y el
resto de las curules se apaga. La ficha completa se abre desde una foto, para
quien quiera ver más.

**Las listas de referencia salen de los datasets de Vizta** (PJ, 1-nov-2026).
Los diputados son el dataset «Congreso de Guatemala» y las fechas del
calendario, el dataset «Fechas claves»; no tablas aparte del servidor. Lo que
se arma con la herramienta es lo que se muestra.

**El calendario filtra el feed y marca cada fecha con su tipo** (PJ,
1-nov-2026). Va a la par del selector de «de dónde», y por ahora solo en el
Congreso; en Guatemala no aparece. En el mes, un día con
fecha clave lleva el círculo del color de su tipo (sesión, plazo, proceso
electoral, asueto…), nunca un punto; lo que dura varios días va como una
franja de ese color de su inicio a su fin, para que se lea como un tramo. Los
días con publicaciones van en tinta firme y los vacíos en gris. En la lista
de próximas fechas, el día va en un mini calendario a la izquierda (el número
y el mes abreviado, en el color del tipo), no escrito en el subtítulo; debajo
del título, el tipo en una pastilla («reunión»), la hora con un relojito y
«aprox.» cuando la fecha todavía no es oficial. Tocar un día solo muestra sus fechas
claves. El filtro es un ícono al lado del mes: mientras está encendido (queda
marcado), el día que se toque es el que muestra el feed, salvo los días que
aún no llegan, que solo muestran sus fechas; apagarlo vuelve a todos los días.
No hay botón que aparezca al tocar un día. Mirar fechas con el filtro apagado
no mueve lo que se estaba leyendo. Filtrado, el feed queda en ese día: arriba sus fechas claves y abajo
lo publicado; lo que es «de ahora» (tendencias, últimas publicaciones) no
se muestra mientras se mira otro día. El día se nombra una sola vez: si el
título ya lo dice, la pastilla queda con el ícono y su equis.

**El buscador legal busca en todo lo indexado** (PJ, 2-nov-2026). Por ahora
va en el Congreso, a la par del calendario: una pastilla con un libro y su
lupa. Abre una hoja con la barra de búsqueda; sin escribir nada muestra la
Constitución y los códigos. Busca a la vez en leyes, artículos e
iniciativas, por palabras (encuentra sus variantes) o por frase entre
comillas, y entiende «art 102 constitución». Lo que coincide va en negrita,
y lo que más coincide va primero, sea del tipo que sea. Si ningún texto
tiene todas las palabras, se busca con alguna y se dice en una línea. Los
filtros por tipo aparecen solo cuando hay más de un tipo. El fragmento no
repite lo que ya está arriba (el título, «Artículo 102.») ni dice de dónde
salió el texto. Una ley se abre con todos sus artículos y su propia barra
para buscar adentro, que muestra el pedazo donde aparece lo buscado; un
artículo abre su ley parada en él. Del PDF no pasan los encabezados de
página, y el título de una sección va arriba del artículo que la abre.

**En el buscador, una iniciativa no es una ley** (PJ, 2-nov-2026). Las
iniciativas van en su propia parte («Iniciativas en el Congreso»), después de
«Leyes y artículos», y cada parte muestra lo primero y pliega el resto con su
flecha. Una iniciativa va en su tarjeta: punteada mientras sigue en trámite y
firme cuando se aprueba. Lleva su etapa en un ícono y una palabra (un reloj y
«en trámite · dictamen», o un visto verde y «aprobada»), qué ley cambiaría o
cambió (cada una se toca y se abre; un decreto que no está en la biblioteca
va sin enlace), «propone una ley nueva» si no reforma ninguna, y en qué
decreto se volvió si ya se aprobó. Al abrir una ley, «En el Congreso» dice de
qué iniciativa nació y cuáles la quieren cambiar, primero las que siguen en
trámite.

**Un artículo dice qué decreto le dio su texto** (PJ, 4-nov-2026, STA-319).
Debajo del número, con un lápiz y en tinta: «reformado por el Decreto 2-2025 ·
desde el 8 mar 2025» (o «agregado por», «derogado por»); se toca y abre el
decreto. La fecha es la de vigencia que acredita la base, nunca la de
aprobación. Un reformado lleva «versión anterior» plegada con flecha, que se
trae al abrirla; si la base no tiene ese texto, lo dice y no lo completa con
el actual. Un derogado no se lee como ley: queda su número, «derogado por el
Decreto X» y «ver el texto que tuvo» (la pastilla «derogado» va solo si no se
sabe qué decreto lo derogó: no se dice dos veces). En los resultados, un artículo reformado dice «texto
del Decreto X · vigente desde…». La cabeza de la ley dice la última reforma
aplicada y cuántos cambios faltan por confirmar, sin prometer que esté
completa. Los artículos van por número y, dentro de él, bis, ter, quáter… y
luego A, B… (Ñ va después de N). Una nota de quien cargó el texto
(respaldos, notas de carga) no se muestra.

**Una vetada no es aprobada** (PJ, 2-nov-2026). Si el Ejecutivo vetó el
decreto, la iniciativa no dice «aprobada»: dice «vetada» (ícono de prohibido,
rojo apagado), su tarjeta es firme en ese mismo tono, «no entró en vigor» va
junto al decreto e «iba a cambiar» junto a la ley, nunca «cambió». En la lista
del Congreso el rótulo dice «VETADA». Aprobada y todavía sin valer del todo
lleva su estado al lado: «aprobada · pendiente de sanción», «aprobada ·
vigencia diferida».

**Una ley no repite su nombre** (PJ, 2-nov-2026). El rótulo de arriba no dice
lo que el título ya dice: sobre «Código de Trabajo» va «DECRETO 1441», no
«CÓDIGO · DECRETO 1441»; sobre la Constitución, «CONSTITUCIÓN 1985». La
descripción no empieza nombrando la ley otra vez («Código de Trabajo de
Guatemala.»), y ningún fragmento repite el título, ni entero ni cortado.

**Los documentos se leen en Vizta** (PJ, 2-nov-2026). Un PDF, un Word, una
hoja de cálculo o un texto se abren en el lector (`LectorDocumento`), no en el
navegador: arriba su nombre y de dónde es, compartir, abrir afuera y cerrar;
mientras baja, una línea de avance y el porcentaje, porque los PDF del
Congreso son escaneos pesados. Las fichas y las notas de una página web siguen
abriéndose afuera.

**Un agente trabajando lleva el diamante al lado del nombre** (PJ,
1-nov-2026). Mientras un agente hace algo (usó una herramienta hace un par de
minutos o tiene una tarea en curso), al lado de su nombre, en la lista y en la
cabecera del chat, gira el diamante de píxeles (`Diamante`). No lleva texto:
el diamante ya dice que está en marcha. Es distinto de «cargando», que sigue
siendo `MorphingInfinity`.

**Abajo del chat, el diamante solo cuando te está escribiendo** (PJ,
1-nov-2026). Crear o editar cosas no es escribir: eso se ve solo arriba, al
lado del nombre. Al final de la conversación aparece un globo suyo, sin texto,
con el diamante adentro, únicamente si te debe una respuesta reciente (tu
mensaje lleva menos de 10 minutos sin contestar) y está activo. Cuando llega
la respuesta, el globo se va y entra el mensaje.

**Lo que hace un agente se cuenta en su chat** (PJ, 1-nov-2026). Entre los
mensajes, sin globo, va un renglón con el ícono de la acción y lo que hizo:
«Creó 4 elementos en tu Codex», «Editó el espacio «Caso X»», «Sumó «Milo» a
un espacio». Cada cosa va con su enlace para abrirla. Lo seguido del mismo
tipo va en un solo renglón; con más de cuatro, el resto se pliega con su
flecha. Leer no se cuenta: solo lo que cambia algo tuyo.

**El chat se mueve como una conversación** (PJ, 1-nov-2026). Todo es corto,
porque se repite muchas veces al día; el movimiento vive en
`colaboradores/movimiento.js`.

- Una pantalla nueva entra desde la derecha y la anterior vuelve desde la
  izquierda, en un tramo corto.
- Un mensaje que llega sube y crece desde su esquina, con un toque háptico
  leve. El tuyo entra a media tinta mientras se envía y, ya guardado, solo
  termina de encenderse: no vuelve a entrar.
- Lo que ya estaba se corre con resorte; nada salta.
- Enviar se enciende con un rebote cuando hay algo escrito y se hunde al
  tocarlo.
- Lo que hace un agente entra en vivo: el renglón aparece, su ícono salta y,
  si el renglón crece («Creó 4…» → «Creó 5…»), la cosa nueva se suma debajo.
- El diamante entra y sale con escala. La vista previa de un chat se funde
  cuando llega algo nuevo.

**Plegar y desplegar llevan su flecha.** «7 votaciones más de esta ley» va con
la flecha hacia abajo, y al abrir queda «ocultar» con la flecha hacia arriba.
Un texto suelto que abre o cierra algo no se reconoce como control.

**Lo que carga se ve igual en toda la app:** `MorphingInfinity`, nunca la
ruedita del sistema (`ActivityIndicator`). Y lo nuevo sin leer se nota en la
tinta del texto, no en un punto rojo.

**Ajustes es de papel y tinta, como el resto** (PJ, 2-nov-2026). Nada en
azul ni índigo: ni la versión, ni la cita, ni el rol, ni los interruptores.
Las hojas que se abren desde Ajustes (iniciar sesión, términos, privacidad,
apoyo) van en papel con tinta oscura, no en azul noche; el botón principal es
tinta, y lo que antes era índigo es el verde del orbe. La página corre por
debajo del orbe, como el feed, y su margen de abajo deja subir lo último por
encima de él: no termina en seco a la altura del orbe.

## Permisos: la excepción formal

Los diálogos de permiso del sistema (`Info.plist`) son **la única superficie
que no usa la voz de la app**. Van en tercera persona y con usted, y son más
largos que cualquier otro texto: los lee alguien que está decidiendo si nos
da acceso a algo suyo, y además los revisa Apple. Ahí el registro formal es la
cortesía, no la distancia.

Contestan tres cosas, en este orden:

1. **Para qué** se usa — el beneficio concreto, no la mecánica.
2. **Qué se registra y qué no** — «las zonas por las que se desplaza, no su
   recorrido». Si hay un límite, se dice; es lo que vuelve creíble al resto.
3. **Dónde queda** — «se guarda únicamente en este dispositivo», y solo si es
   verdad.

> Vizta utiliza su ubicación para mostrar dónde se encuentra en el mapa. Si
> autoriza el acceso permanente, la aplicación registra las zonas por las que se
> desplaza —no su recorrido— para ir revelando su mapa de exploración, incluso
> cuando no la está usando. Esa información se guarda únicamente en este
> dispositivo.

Nunca se promete algo que la app no hace, y si cambia lo que hace, el texto
cambia con ella.

**Dentro de la app**, en cambio, se vuelve a la voz de siempre: no se pide dos
veces seguidas lo mismo, y si el sistema ya no va a preguntar, se dice dónde
está la llave —con un botón que abre Ajustes— una vez y en paz.

## Términos exactos en cifras sensibles

Cuando una cifra habla de violencia, víctimas o daños, se usa el término
técnico y no uno coloquial. Nunca «lo normal» para una cantidad de muertos o
de hechos violentos: se dice «Promedio de 7 días: 4». Lo mismo con niveles y
estados: «Incidencia moderada», no «Cargado»; «en actualización», no «hasta
ahora». El tono casual de Vizta queda para los controles, no para los datos.

## Ayudas: van en una guía, no en la pantalla

Una pantalla con información (la huella de autor, un análisis) muestra solo
la información. Las explicaciones de qué es cada cosa no van en cajas ni en
subtítulos al lado de los datos. Van en una **guía** que se abre sola la
primera vez y después con el «?» de arriba. Ejemplo: `huella/GuiaHuella.jsx`.

- **La guía se escribe en frases completas y en registro neutro**, sin voseo
  ni frases cortadas. «Aparecen en lo que publica, no son su postura» no se
  entiende; «Ideas que aparecen en sus publicaciones, con la frase exacta. No
  son necesariamente la opinión de la cuenta» sí.
- **Helpers e instructivos van en registro informativo, no casual** (PJ,
  7-nov-2026). Lo casual queda para la conversación; un helper informa el
  hecho, su fecha y su consecuencia. Sustantivos en los rótulos
  («fallecimiento · 6 nov», «renuncia»), fechas completas en el helper («6 de
  noviembre de 2026») y vocabulario del trámite («la curul permanece vacante
  hasta la juramentación de quien sustituya en el cargo», no «queda vacía hasta
  que jure quien lo reemplaza»).
- **Cada concepto, con el mismo ícono y el mismo nombre** que tiene en la
  pantalla, para que se reconozca al volver.
- **Los rótulos de la pantalla dicen el hecho completo**: «1 de 4
  publicaciones», no «1 de 4»; «No se sabe quién lo dijo», no «Falta saber
  quién lo dice».

## Estados vacíos y errores

Un cero es una respuesta legítima, no una falla: «nada de lo escrito nombra un
lugar del mapa» es mejor que «0 resultados». Y un error dice qué se puede
hacer ahora, no qué salió mal adentro.

## La hoja de compartir

La hoja que abre Vizta desde «Compartir» (`plugins/compartir`) recibe
cualquier enlace, no solo posts (PJ, 7-nov-2026):

- **Un post de Instagram o de X va a Posts**; cualquier otro enlace (un
  artículo, un paper, una lista) se guarda en la **biblioteca** como Bookmark.
  Un enlace que no es post no se rechaza.
- **Lo compartido se ve como en Mensajes**: su imagen, su título y el sitio
  («prensalibre.com»). La URL cruda no se muestra.
- **El tipo se elige con chips de ícono** (Película, Libro, Artículo, Paper,
  Lista, Videojuego…). En un post, la fila dice «Guardar también en la
  biblioteca»: el post habla de una obra y la obra queda guardada, con el post
  como origen. Sin elegir, el Bookmark queda sin tipo; no se adivina.
- Los controles van sin subtítulo fijo («Analizar al llegar», no «Analizar al
  llegar · Lo encontrás ya leído…»), y los avisos de error son impersonales:
  «No se pudo enviar. Se puede intentar de nuevo.», «La cuenta se conecta al
  abrir Vizta una vez.».

## Resultado de una votación

El resultado (aprobada o no aprobada) sale del registro (`votaciones.resultado`)
y se muestra con su ícono. **No se deduce de las cifras** (PJ, 7-nov-2026): no
se supone que hagan falta 81 votos ni que baste con más a favor que en contra.
Un orden del día con 33 a favor y 25 en contra se aprueba con quórum reducido;
una moción con 63 a favor y 49 en contra puede quedar rechazada. Sin resultado
en el registro, va el ícono de «sin confirmar».

- Cada paso muestra **las dos cifras**, a favor y en contra, no solo la que
  coincide con el resultado.
- Todo paso de una sesión (trámite, artículos, mociones) se toca y abre cómo
  votó cada diputado; una enmienda abre su ficha, que también los trae.
- La mayoría absoluta o los dos tercios se nombran solo cuando se alcanzaron;
  por debajo no se dice «no llegó».

## Los guardados de un post

Los Bookmarks (lo que se guarda para revisar después: la película de la que
habla un reel, un libro, una lista) **se ven dentro de la ficha del post que
los generó**, no en una lista aparte (PJ, 8-nov-2026).

- La obra va arriba con su marca: si ya está en la biblioteca, la marca sale
  llena y no se ofrece guardarla otra vez.
- El resto va en «en tu biblioteca»: imagen o ícono del tipo, nombre, tipo y
  fecha de guardado. La fila abre el enlace; la marca de la derecha la da por
  revisada.
- Sin guardados, la sección no aparece.

## Smart UI de posts

La ficha de un post se arma según lo que trae (PJ, 8-nov-2026):

- **Post breve** (sin análisis profundo): se arma alrededor de lo que presenta.
  Su guardado principal va grande arriba (carátula o ícono del tipo, nombre en
  la serif de los titulares, tipo, «abrir» y «por revisar»); el resto, en
  «en tu biblioteca».
- **Análisis profundo** (se pide a mano): se dibuja con las piezas de Vizta
  (OpenUI) en la solapa **vista**, que se abre primero. Las piezas salen de
  reglas fijas (`posts/vistaDelPost.js`), sin modelos: lo que dice (citas con
  quién las dijo), las cifras, quién aparece (lo que está en el Codex), cuándo
  (solo hitos con fecha), cómo se relacionan y en qué se apoya. Una sección
  sin datos no aparece; con menos de dos, no hay solapa **vista**.
- Lo que repite el título no se vuelve a decir, y una fuente cuya cita es solo
  «según X» se muestra como nombre, no como cita.
- **Las piezas traen sus botones** (PJ, 10-nov-2026). Las reglas deciden qué
  piezas van; cada pieza ofrece lo que falta y marca lo que ya está:
  - **Quién aparece** es quien está en el video: las voces (con lo que hacen:
    conduce, invitado, narra) y quien habla a cámara, que suele ser el autor.
    Una voz sin nombre se muestra por su rol y cómo se reconoce. **Mencionados**
    son las personas que solo se nombran, y **Entidades** las organizaciones
    (en cuadrado, no en círculo); no se mezclan (PJ, 10-nov-2026). En las tres,
    el que está en el Codex va con su cara (tocarla abre su ficha) y un ✓; el
    que no, con sus iniciales en un contorno punteado y un + para agregarlo.
  - Una **voz sin nombre** lleva el ícono de voz (no iniciales) y el botón
    **quién es**. Al final de «Quién aparece», **agregar a alguien** suma a
    quien el análisis no detectó. Las dos abren la misma hoja: sugiere a las
    personas del mismo post, busca en el Codex o crea a la persona; para una
    voz pide además cómo se sabe (los motivos de la huella). Se guarda como
    relación del Codex «persona — aparece en → post» y, si es una voz, como
    revisión de esa voz en la huella del autor.
- Si el resumen llega cortado a media palabra, el título es la primera
  oración de la narrativa; la bajada no repite al título.
- **Un video que se entiende por lo que se ve** (una actuación, un baile,
  labios sincronizados con un audio ajeno) se titula con lo que se ve, no con
  su pie de foto; con eso y quién aparece ya hay vista (PJ, 10-nov-2026).
- **El autor que aparece a cámara va primero en «Quién aparece», como
  «autor»; nunca es un mencionado.** Las demás personas a cámara que nadie
  identificó van como «Otra persona · a cámara» con **quién es**. Las voces
  de un audio prestado no son de quienes aparecen y no se listan.
  - Cómo se relacionan: + para guardar el vínculo; ✓ si ya está.
  - Lo que dice: + para guardar el hecho; ✓ si ya está.
  La misma vista fuera de la ficha (el chat, un dashboard) va sin botones.
- Con **vista**, «organizado» desaparece: las solapas son **vista · anotado**
  (y «aprender» si existe). El ojo alterna entre vista y anotado.
- Un post con solo su lectura breve muestra el botón **análisis profundo**:
  el análisis completo se pide a mano, nunca solo.
