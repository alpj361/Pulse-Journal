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

if (__DEV__) {
  require('@expo/metro-runtime');
}
import { AppRegistry, LogBox } from 'react-native';
import { DeviceErrorBoundaryWrapper } from './__create/DeviceErrorBoundary';
import AnythingMenu from './src/__create/anything-menu';
import { renderRootComponent } from 'expo-router/build/renderRootComponent';
import App from './entrypoint'


if (__DEV__ || process.env.EXPO_PUBLIC_CREATE_ENV === 'DEVELOPMENT') {
  LogBox.ignoreAllLogs();
  LogBox.uninstall();
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
renderRootComponent(App);
