if (__DEV__) {
  /**
   * Atrapar errores de JS sin recargar la app.
   *
   * Antes esto reemplazaba `handleException` importando
   * `react-native/Libraries/Core/ExceptionsManager` por ruta profunda. Ese
   * import arrastra una cadena de módulos internos que en esta versión de React
   * Native ya no existe, y la app moría antes de arrancar con
   * «Property 'MessageQueue' doesn't exist» — un error que no menciona ni el
   * archivo ni el import que lo causó.
   *
   * `ErrorUtils.setGlobalHandler` es la API pública para lo mismo y no depende
   * de la estructura interna de RN, así que no vuelve a romperse con la próxima
   * actualización.
   */
  const handler = (error, isFatal) => {
    console.error('[FATAL ERROR CAUGHT]', isFatal ? '(FATAL)' : '(non-fatal)', error?.message || error);
    if (error?.stack) console.error('[STACK]', error.stack);
  };

  const eu = (global as any).ErrorUtils;
  if (eu?.setGlobalHandler) eu.setGlobalHandler(handler);
}

import 'react-native-url-polyfill/auto';
import './src/__create/polyfills';
global.Buffer = require('buffer').Buffer;

// CRITICAL: metro-runtime requires Metro dev server — only safe in dev mode
if (__DEV__) {
  require('@expo/metro-runtime');
}

import { AppRegistry, LogBox } from 'react-native';
import { renderRootComponent } from 'expo-router/build/renderRootComponent';
import App from './entrypoint';

// Dev-only: error boundary wrapper and dev tools from Create.xyz scaffold
if (__DEV__) {
  LogBox.ignoreAllLogs();
  LogBox.uninstall();
  const { DeviceErrorBoundaryWrapper } = require('./__create/DeviceErrorBoundary');
  const AnythingMenu = require('./src/__create/anything-menu').default;
  AppRegistry.setWrapperComponentProvider(() => ({ children }) => {
    return (
      <>
        <DeviceErrorBoundaryWrapper>
          {children}
        </DeviceErrorBoundaryWrapper>
        <AnythingMenu />
      </>
    );
  });
}

// Release: capture crashes so they appear in Xcode console / logcat for diagnosis
if (!__DEV__) {
  const defaultHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.error('[RELEASE CRASH]', isFatal ? 'FATAL' : 'non-fatal', error?.message, error?.stack);
    if (defaultHandler) defaultHandler(error, isFatal);
  });
}

renderRootComponent(App);
