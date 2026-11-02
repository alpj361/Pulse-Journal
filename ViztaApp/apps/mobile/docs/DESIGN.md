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

**De quién es algo también va en un ícono** (PJ, 1-nov-2026). Donde se mezcla
lo de un agente con lo de la persona, cada cosa lleva su ícono: una persona si
el agente lo creó en tu Codex, un archivo si es del agente, el signo de unir
si está en los dos. Nunca «se parece a uno tuyo» para algo que ya es tuyo.

**Una persona se toca y aparece su ficha** (PJ, 1-nov-2026). En un hemiciclo,
un mapa o una lista de votos, tocar a alguien abre una ficha emergente sobre
la pantalla: su foto, su nombre, su bancada y su distrito, y en una votación
cómo votó, con su ícono. No se navega a otra pantalla ni se escribe el nombre
debajo del dibujo.

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
- **Cada concepto, con el mismo ícono y el mismo nombre** que tiene en la
  pantalla, para que se reconozca al volver.
- **Los rótulos de la pantalla dicen el hecho completo**: «1 de 4
  publicaciones», no «1 de 4»; «No se sabe quién lo dijo», no «Falta saber
  quién lo dice».

## Estados vacíos y errores

Un cero es una respuesta legítima, no una falla: «nada de lo escrito nombra un
lugar del mapa» es mejor que «0 resultados». Y un error dice qué se puede
hacer ahora, no qué salió mal adentro.
