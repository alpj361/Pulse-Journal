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
| «Falta el permiso *siempre*»           | «Para ir descubriendo los lugares por donde andás»|
| «La app se despierta a los 400 m»      | (no se dice: es mecánica interna)                 |
| «Error 402: sin cupo»                  | «Se te acabaron los créditos de hoy»              |
| «No se pudo hacer fetch del análisis»  | «No se pudo analizar. Probá de nuevo.»            |

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

- **Segunda persona, voseo.** «Tenés», «podés», «andás». Es como se habla acá y
  es como habla el resto de la app.
- **Minúscula en los controles**, como el resto de la interfaz: `buscar un
  lugar`, `mostrar todo`, `ajustar`. Los títulos de un aviso sí van con
  mayúscula inicial.
- **Corto.** Un aviso son dos renglones: qué pasa y qué se puede hacer. Si
  hacen falta tres, casi siempre sobra el que explica la mecánica.
- **El beneficio antes que el mecanismo.** «El mapa se va descubriendo por donde
  andás» dice lo mismo que «monitoreo de regiones en segundo plano», y además
  se entiende.

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

## Estados vacíos y errores

Un cero es una respuesta legítima, no una falla: «nada de lo escrito nombra un
lugar del mapa» es mejor que «0 resultados». Y un error dice qué se puede
hacer ahora, no qué salió mal adentro.
