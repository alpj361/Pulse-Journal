const app = require('./app.json');

/**
 * Misma configuración que app.json. La clave de Google Maps, si está en el
 * entorno al construir, se inyecta solo para Android: en iOS el tráfico usa
 * MapKit y no hace falta. Sin la variable, el binario queda como hasta ahora.
 */
const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

const expo = {
  ...app.expo,
  android: {
    ...app.expo.android,
    ...(googleMapsApiKey
      ? {
          config: {
            ...(app.expo.android.config || {}),
            googleMaps: { apiKey: googleMapsApiKey },
          },
        }
      : {}),
  },
  plugins: googleMapsApiKey
    ? [...app.expo.plugins, ['react-native-maps', { androidGoogleMapsApiKey: googleMapsApiKey }]]
    : app.expo.plugins,
};

module.exports = { expo };
