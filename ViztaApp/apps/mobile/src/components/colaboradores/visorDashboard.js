/**
 * Cómo se encierra el HTML de un dashboard dentro del WebView.
 *
 * El documento puede traer un `<iframe src="https://…">` (un Flourish, una
 * simulación). Eso es otra página: `frame-src` y `child-src` la dejan entrar
 * solo por https. El HTML de afuera sigue sin red (`connect-src 'none'`):
 * no hay fetch, XHR ni WebSocket. Los datos van adentro del HTML.
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
    `script-src 'unsafe-inline' ${CDN}`,
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
