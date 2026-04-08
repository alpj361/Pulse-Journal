import ExceptionsManager from 'react-native/Libraries/Core/ExceptionsManager';

if (__DEV__) {
  ExceptionsManager.handleException = (error, isFatal) => {
    // Log the error so we can debug it, then no-op to prevent app reload
    console.error('[FATAL ERROR CAUGHT]', isFatal ? '(FATAL)' : '(non-fatal)', error?.message || error);
    if (error?.stack) console.error('[STACK]', error.stack);
  };
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
