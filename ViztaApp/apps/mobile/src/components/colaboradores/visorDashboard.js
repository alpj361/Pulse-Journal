/**
 * Cómo se encierra el HTML de un dashboard dentro del WebView.
 *
 * El documento puede traer un embed de cualquier página https: un iframe, o
 * el código que lo arma (`<script src="https://public.flourish.studio/…">`).
 * `script-src` deja ese script; `frame-src` y `child-src` dejan el iframe.
 * El HTML de afuera sigue sin red (`connect-src 'none'`): no hay fetch, XHR
 * ni WebSocket. Lo que el iframe pida por su cuenta es de esa otra página.
 *
 * Quién puede *guardar* un iframe no se decide en la app. No hay un flag de
 * cliente para admin o Beta: `get_my_capabilities` no trae
 * `DASHBOARDS_IFRAMES`, y el rol (alfa, beta, admin) solo abre Colaboradores.
 * Lo valida ExtractorW al guardar: el iframe queda solo si el flag está
 * prendido y el rol es admin o Beta. Acá, si el HTML ya lo trae, se dibuja.
 */

const CDN = 'https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://unpkg.com';

/** Directivas, en orden, para poder probar cada una. */
export function directivasCsp() {
  return [
    "default-src 'none'",
    // Cualquier script https (el embed de Flourish no vive en los CDN de
    // gráficos). 'unsafe-inline' se queda: el dashboard trae su propio JS.
    "script-src 'unsafe-inline' https:",
    `style-src 'unsafe-inline' ${CDN} https://fonts.googleapis.com`,
    'font-src https://fonts.gstatic.com data:',
    'img-src https: data: blob:',
    "connect-src 'none'",
    'frame-src https:',
    'child-src https:',
    "form-action 'none'",
  ];
}

export const CSP = directivasCsp().join('; ');

/**
 * Orígenes que el WebView deja llegar a `decidirNavegacion`.
 *
 * Sin `https://*`, un iframe https no llega a la decisión: react-native-webview
 * lo abre afuera (el filtro corre antes del callback). `http://*` entra para
 * poder rechazarlo cuando es un subframe, sin disparar el navegador.
 * `about:blank` lo agrega la librería sola.
 */
export const ORIGENES_DEL_VISOR = ['https://*', 'http://*'];

const esInterno = (url) =>
  url === 'about:blank' || url.startsWith('about:') || url.startsWith('data:') || url.startsWith('#');

/**
 * Si esa carga sigue dentro del WebView o se abre afuera.
 *
 * iOS (WKWebView, react-native-webview 13.15): `isTopFrame` es false cuando
 * la URL del pedido no es la del documento principal. Un iframe https cae
 * ahí y se carga. El frame principal no navega: un http(s) se abre afuera.
 *
 * Android: `shouldOverrideUrlLoading` no avisa de un frame interno, y el
 * evento que sí llega trae `isTopFrame` siempre en true
 * (`TopShouldStartLoadWithRequestEvent`). No hay otra señal en el pedido
 * (no viaja `isForMainFrame`). Un `<iframe src="https://…">` no pasa por
 * acá: lo carga el WebView y lo acota la CSP (`frame-src https:`), que
 * también corta http, data y javascript. Si alguna versión manda
 * `isTopFrame === false`, se usa esa señal y un esquema que no sea https
 * no se carga.
 *
 * @param {{ url?: string, isTopFrame?: boolean }} pedido
 * @returns {{ cargar: boolean, abrirAfuera: boolean }}
 */
export function decidirNavegacion(pedido) {
  const url = String(pedido?.url ?? '');
  // Solo false cuenta como subframe. En Android el callback del frame
  // principal llega con true, y un valor ausente se trata igual: no navega.
  if (pedido?.isTopFrame === false) {
    return { cargar: /^https:\/\//i.test(url), abrirAfuera: false };
  }
  if (esInterno(url)) return { cargar: true, abrirAfuera: false };
  if (/^https?:\/\//i.test(url)) return { cargar: false, abrirAfuera: true };
  return { cargar: false, abrirAfuera: false };
}

/**
 * Una ventana que pide el iframe (`window.open`, `target="_blank"`).
 *
 * No se dibuja en el WebView. Si es http(s), va al navegador del sistema.
 * Otro esquema no se abre. En iOS el aviso es `onOpenWindow` (y WKWebView
 * cancela la navegación, así que el documento de adentro no cambia). En
 * Android el aviso solo llega con `setSupportMultipleWindows`: la librería
 * arma una vista que no se muestra y entrega la URL en `targetUrl`.
 *
 * @param {{ targetUrl?: string, url?: string }} pedido
 * @returns {{ abrirAfuera: boolean, url: string }}
 */
export function decidirVentana(pedido) {
  const url = String(pedido?.targetUrl ?? pedido?.url ?? '');
  if (/^https?:\/\//i.test(url)) return { abrirAfuera: true, url };
  return { abrirAfuera: false, url };
}
