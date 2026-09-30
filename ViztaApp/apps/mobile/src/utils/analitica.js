import PostHog from 'posthog-react-native';

/**
 * Analítica: solo eventos.
 *
 * Qué está prendido: eventos que se mandan a mano, y nada más.
 *
 * Qué está apagado, y por qué:
 *  · **Autocaptura** — en React Native no se activa sola: viene del componente
 *    `<PostHogProvider autocapture>`, que acá no se usa. Sin él, PostHog no
 *    registra ni un toque ni una pantalla por su cuenta.
 *  · **Session replay** (`enableSessionReplay: false`) — graba la pantalla. Es
 *    justo lo contrario de «solo eventos», y en una app donde se escriben notas
 *    de fuentes periodísticas grabar la pantalla es inaceptable.
 *  · **Surveys** (`disableSurveys: true`) — puede dibujar encuestas encima de la
 *    app desde el panel de PostHog. Nadie quiere que la interfaz cambie sin
 *    pasar por el código.
 *  · **Ciclo de vida automático** (`captureAppLifecycleEvents: false`) — manda
 *    `$app_opened` y compañía. Lo mismo se manda desde acá, con nombre propio.
 *
 * **Sobre datos personales: acá no viaja contenido.** Ningún evento lleva el
 * texto de una nota, el nombre de un item, un titular ni una URL. Solo cuántos,
 * de qué tipo y desde dónde. Esto no es una precaución genérica: la app guarda
 * apuntes de investigación periodística, y mandarlos a un tercero para saber
 * «cómo se usa» sería un problema serio. Si algún día hace falta un nombre en
 * un evento, esa decisión merece pensarse aparte.
 *
 * La `distinct_id` la maneja PostHog: anónima hasta que `identificar()` la
 * asocia a la cuenta.
 */

const CLAVE = process.env.EXPO_PUBLIC_POSTHOG_KEY || 'phc_AkiAK4mnoYLncThDiETUtzqxERnuwNKdiw8uVZWociYH';

// Región verificada: esta clave autentica contra la nube de EE.UU. y la de la
// UE la rechaza con 401. Importa dejarlo escrito porque el endpoint de ingesta
// contesta «Ok» a cualquier cosa —incluso a una clave inventada—, así que
// apuntar a la región equivocada no daría ningún error: los eventos
// simplemente no aparecerían nunca en el panel.
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

export const posthog = new PostHog(CLAVE, {
  host: HOST,
  enableSessionReplay: false,
  disableSurveys: true,
  captureAppLifecycleEvents: false,
  // Captura automática de excepciones, apagada y por escrito.
  //
  // El panel de PostHog la trae prendida (`autocaptureExceptions: true` en la
  // config remota) y el SDK lo anuncia en los logs: «Error tracking autocapture
  // enabled by remote config». Eso suena peor de lo que es — ese aviso solo
  // levanta una compuerta sobre los handlers, y los handlers se instalan del
  // lado del cliente: `autocapture()` solo engancha errores si cada opción vale
  // exactamente `true`. En `false` no engancha ninguno, y la config remota no
  // tiene nada que habilitar.
  //
  // El valor por defecto del SDK ya es `false`; queda explícito igual para que
  // nadie lo prenda sin querer. Importa: un stack trace o el mensaje de un
  // error de Supabase puede arrastrar el nombre de un item o parte de una
  // consulta. Eso es contenido, y contenido no sale de la app.
  errorTracking: { autocapture: false },
  // Se juntan de a 20 o cada 30 s. Mandar uno por uno gastaría batería y datos
  // para nada: ningún evento de esta app necesita llegar al instante.
  flushAt: 20,
  flushInterval: 30000,
});

/**
 * Catálogo de eventos.
 *
 * Todos los nombres viven acá y en ningún otro lado. Un `capture('nota abierta')`
 * suelto en una pantalla y un `capture('nota_abierta')` en otra son dos eventos
 * distintos en el panel, y eso no se nota hasta que los números no cierran.
 *
 * Convención: `objeto_verbo`, en pasado.
 */
export const EV = {
  APP_ABIERTA: 'app_abierta',

  NOTA_ABIERTA: 'nota_abierta',
  NOTA_GUARDADA: 'nota_guardada',
  NOTA_DESCARTADA: 'nota_descartada',
  NOTA_PAGINA_VISTA: 'nota_pagina_vista',
  NOTA_FOTO_ADJUNTA: 'nota_foto_adjunta',
  NOTA_AUDIO_ADJUNTO: 'nota_audio_adjunto',

  MENCION_TOCADA: 'mencion_tocada',
  ITEM_CREADO_DESDE_SELECCION: 'item_creado_desde_seleccion',

  POSTS_ABIERTOS: 'posts_abiertos',
  POST_ABIERTO: 'post_abierto',
  POST_AGREGADO: 'post_agregado',
  POST_AGREGADO_FALLO: 'post_agregado_fallo',
  POST_ANALIZADO: 'post_analizado',

  FEED_NOTICIA_ABIERTA: 'feed_noticia_abierta',

  // El seguro del grafo tuvo que rehacer el acomodo. Si aparece, hay un caso
  // que la prueba no cubre.
  GRAFO_RESCATADO: 'grafo_rescatado',
};

/** Manda un evento. Nunca lanza: la analítica no puede romper la app. */
export function evento(nombre, props) {
  try {
    posthog.capture(nombre, props);
  } catch {
    // Si la analítica falla, falla sola.
  }
}

/** Asocia los eventos a la cuenta. Solo el id: ni correo ni nombre. */
export function identificar(userId, props) {
  try {
    if (!userId) return;
    posthog.identify(String(userId), props);
  } catch {
    // idem
  }
}

/** Al desconectar la cuenta, los eventos vuelven a ser anónimos. */
export function olvidar() {
  try {
    posthog.reset();
  } catch {
    // idem
  }
}
