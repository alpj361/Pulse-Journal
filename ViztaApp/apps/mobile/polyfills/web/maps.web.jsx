import WebMapView, * as WebMaps from '@teovilla/react-native-web-maps';
import { TrafficLayer } from '../../node_modules/@teovilla/react-native-web-maps/node_modules/@react-google-maps/api';
import React from 'react';

export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = undefined;

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

const MapView = React.forwardRef((props, ref) => {
  const { showsTraffic, children, provider: _proveedor, ...rest } = props;
  return (
    <WebMapView
      ref={ref}
      {...rest}
      // En la web solo existe Google. Va después de las props para que un
      // `provider` de iOS (undefined, MapKit) no deje el mapa en blanco.
      provider={PROVIDER_GOOGLE}
      googleMapsApiKey={GOOGLE_MAPS_API_KEY}
      options={{
        disableDefaultUI: true,
        zoomControl: false,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        rotateControl: false,
        scaleControl: false,
        keyboardShortcuts: false,
        ...props.options,
      }}
    >
      {showsTraffic ? <TrafficLayer /> : null}
      {children}
    </WebMapView>
  );
});

Object.assign(MapView, {
  ...WebMaps,
  PROVIDER_GOOGLE,
  PROVIDER_DEFAULT,
});

export const {
  Marker,
  Callout,
  Polyline,
  Polygon,
  Circle,
  Overlay,
  Heatmap,
  UrlTile,
  WMSTile,
  LocalTile,
} = WebMaps;

export default MapView;
