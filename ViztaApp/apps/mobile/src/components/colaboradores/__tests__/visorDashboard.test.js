import { CSP, ORIGENES_DEL_VISOR, decidirNavegacion, decidirVentana, directivasCsp } from '../visorDashboard';

const directiva = (nombre) => directivasCsp().find((d) => d.startsWith(`${nombre} `));

describe('la política del dashboard', () => {
  test('un iframe solo entra por https, y el documento sigue sin red', () => {
    expect(directiva('frame-src')).toBe('frame-src https:');
    expect(directiva('child-src')).toBe('child-src https:');
    expect(directiva('connect-src')).toBe("connect-src 'none'");
    expect(directiva('default-src')).toBe("default-src 'none'");
    expect(directiva('form-action')).toBe("form-action 'none'");
    expect(CSP).toBe(directivasCsp().join('; '));
    expect(CSP).not.toContain("frame-src 'none'");
    expect(CSP).not.toContain("child-src 'none'");
  });

  test('un script https externo puede armar el embed; el estilo no se abre', () => {
    // Flourish: <script src="https://public.flourish.studio/resources/embed.js">
    expect(directiva('script-src')).toBe("script-src 'unsafe-inline' https:");
    expect(directiva('script-src')).not.toContain('cdn.jsdelivr.net');
    expect(directiva('style-src')).toBe(
      "style-src 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://unpkg.com https://fonts.googleapis.com",
    );
    expect(directiva('font-src')).toBe('font-src https://fonts.gstatic.com data:');
    expect(directiva('img-src')).toBe('img-src https: data: blob:');
    expect(directivasCsp()).toHaveLength(9);
  });

  test('el WebView deja pasar https y http hasta la decisión', () => {
    expect(ORIGENES_DEL_VISOR).toEqual(['https://*', 'http://*']);
  });
});

describe('decidirNavegacion', () => {
  test('un iframe https se carga y no sale de la app', () => {
    expect(decidirNavegacion({ url: 'https://public.flourish.studio/visualisation/1/embed', isTopFrame: false })).toEqual({
      cargar: true,
      abrirAfuera: false,
    });
    expect(decidirNavegacion({ url: 'HTTPS://ejemplo.test/sim', isTopFrame: false }).cargar).toBe(true);
  });

  test('en un subframe, lo que no es https no se carga ni se abre', () => {
    for (const url of ['http://ejemplo.test/x', 'javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,hola', 'about:srcdoc', 'blob:https://x/abc']) {
      expect(decidirNavegacion({ url, isTopFrame: false })).toEqual({ cargar: false, abrirAfuera: false });
    }
  });

  test('el frame principal no navega: http y https se abren afuera', () => {
    expect(decidirNavegacion({ url: 'https://ejemplo.test/nota', isTopFrame: true })).toEqual({
      cargar: false,
      abrirAfuera: true,
    });
    expect(decidirNavegacion({ url: 'http://ejemplo.test/nota', isTopFrame: true })).toEqual({
      cargar: false,
      abrirAfuera: true,
    });
    // Android: el callback del frame principal llega con isTopFrame en true,
    // y si faltara la marca se trata igual (no es un subframe).
    expect(decidirNavegacion({ url: 'https://ejemplo.test/nota' })).toEqual({ cargar: false, abrirAfuera: true });
  });

  test('el documento propio sigue cargando', () => {
    for (const url of ['about:blank', 'about:blank#x', 'data:text/html,hola', '#seccion']) {
      expect(decidirNavegacion({ url, isTopFrame: true })).toEqual({ cargar: true, abrirAfuera: false });
    }
  });

  test('otro esquema en el frame principal no se abre', () => {
    expect(decidirNavegacion({ url: 'javascript:alert(1)', isTopFrame: true })).toEqual({
      cargar: false,
      abrirAfuera: false,
    });
  });
});

describe('decidirVentana', () => {
  test('un popup http(s) del iframe sale al navegador', () => {
    expect(decidirVentana({ targetUrl: 'https://public.flourish.studio/visualisation/1' })).toEqual({
      abrirAfuera: true,
      url: 'https://public.flourish.studio/visualisation/1',
    });
    expect(decidirVentana({ targetUrl: 'http://ejemplo.test/nota' }).abrirAfuera).toBe(true);
    expect(decidirVentana({ url: 'https://ejemplo.test/nota' })).toEqual({
      abrirAfuera: true,
      url: 'https://ejemplo.test/nota',
    });
  });

  test('otro esquema no se abre ni adentro ni afuera', () => {
    for (const url of ['javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,hola', 'about:blank', '']) {
      expect(decidirVentana({ targetUrl: url })).toEqual({ abrirAfuera: false, url });
    }
  });
});
