import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import {
  ArrowUpRight,
  Ban,
  CarFront,
  CircleOff,
  Construction,
  MapPin,
  Megaphone,
  Mountain,
  X,
} from 'lucide-react-native';
import { CARD_SHADOW, INK, RADIUS, SERIF } from '../theme';
import { MONO } from '../codex/mono';
import { PAPEL } from '../codex/Papel';
import { COLOR_TRAFICO } from './TraficoSheet';
import { lineaDeTramo, minutosDe, regionInicial, tiemposClave } from './incidentesTrafico';
import { roce } from '../../utils/haptics';

/**
 * El tráfico como lo muestra el mapa del teléfono.
 *
 * En iOS el proveedor por defecto de `react-native-maps` es MapKit, y
 * `showsTraffic` enciende el coloreado en vivo de las calles. En Android el
 * proveedor es Google, que es el que tiene esa capa ahí. Los pines de arriba
 * son reportes de Vizta, no el coloreado: un toque abre la ficha, y la ficha
 * siempre dice de dónde salió.
 *
 * Los tramos que medimos nosotros se pueden dibujar, apagados de entrada. El
 * coloreado del sistema ya dice lo mismo con todas las calles, y las dos capas
 * juntas se pisan.
 */

const ICONOS = {
  bloqueo: Ban,
  accidente: CarFront,
  protesta: Megaphone,
  cierre: CircleOff,
  obra: Construction,
  derrumbe: Mountain,
  reporte: MapPin,
};

const TINTA = {
  bloqueo: '#B91C1C',
  cierre: '#B91C1C',
  protesta: '#B91C1C',
  accidente: '#C2410C',
  obra: '#B45309',
  derrumbe: '#B45309',
  reporte: '#1C2B22',
};

const PROVEEDOR = Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined;

function tituloDe(tipo) {
  if (!tipo) return 'Reporte';
  return tipo.charAt(0).toUpperCase() + tipo.slice(1);
}

const MapaTrafico = forwardRef(function MapaTrafico(
  { ancho, alto, vista, bottomInset = 0, tramos = [], tiemposListos = false, ubicados = [], sueltos = [], error = false, onReintentar, onVerTiempos, yo = null },
  ref
) {
  const mapa = useRef(null);
  const inicial = useRef(regionInicial(vista, ancho, alto)).current;
  const [elegido, setElegido] = useState(null);
  const [verTramos, setVerTramos] = useState(false);
  const [verSueltos, setVerSueltos] = useState(false);
  const tiempos = useMemo(() => tiemposClave(tramos, 3), [tramos]);

  const irA = useCallback(
    (lat, lng, zoom = 14) => {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const latitudeDelta = 360 / 2 ** zoom;
      const relacion = ancho > 0 && alto > 0 ? ancho / alto : 0.55;
      mapa.current?.animateToRegion(
        {
          latitude: lat - latitudeDelta * 0.18,
          longitude: lng,
          latitudeDelta,
          longitudeDelta: latitudeDelta * relacion,
        },
        380
      );
    },
    [ancho, alto]
  );

  useImperativeHandle(ref, () => ({ irA }), [irA]);

  const abrir = (inc) => {
    roce();
    setElegido(inc);
    setVerSueltos(false);
    if (Number.isFinite(inc.lat) && Number.isFinite(inc.lng)) irA(inc.lat, inc.lng, 14);
  };

  return (
    <View style={{ position: 'absolute', left: 0, top: 0, width: ancho, height: alto }} pointerEvents="box-none">
      <MapView
        key={Platform.OS === 'web' ? `web-${verTramos ? 1 : 0}-${ubicados.map((inc) => inc.id).join('|')}` : 'trafico'}
        ref={mapa}
        style={{ width: ancho, height: alto }}
        provider={PROVEEDOR}
        initialRegion={inicial}
        showsTraffic
        showsCompass={false}
        showsScale={false}
        toolbarEnabled={false}
        rotateEnabled
        pitchEnabled={false}
        moveOnMarkerPress={false}
        userInterfaceStyle="light"
        mapType="standard"
      >
        {verTramos
          ? tramos.map((t) => {
              const coordinates = lineaDeTramo(t.geometria);
              if (coordinates.length < 2) return null;
              return (
                <Polyline
                  key={t.clave || t.id}
                  coordinates={coordinates}
                  strokeColor={COLOR_TRAFICO[t.nivel] || COLOR_TRAFICO.sin_dato}
                  strokeWidth={5}
                  lineCap="round"
                  lineJoin="round"
                />
              );
            })
          : null}

        {ubicados.map((inc) => {
          const Icono = ICONOS[inc.icono] || MapPin;
          const tinta = TINTA[inc.icono] || TINTA.reporte;
          const activo = elegido?.id === inc.id;
          return (
            <Marker
              key={inc.id}
              coordinate={{ latitude: inc.lat, longitude: inc.lng }}
              onPress={() => abrir(inc)}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges
              zIndex={activo ? 2 : 1}
              accessibilityLabel={`${tituloDe(inc.tipo)}${inc.lugar ? `, ${inc.lugar}` : ''}`}
            >
              <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <View
                  style={{
                    width: activo ? 34 : 30,
                    height: activo ? 34 : 30,
                    borderRadius: 17,
                    backgroundColor: tinta,
                    borderWidth: 2,
                    borderColor: PAPEL,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icono size={15} color={PAPEL} strokeWidth={2.4} />
                </View>
              </View>
            </Marker>
          );
        })}

        {yo && Number.isFinite(yo.lat) && Number.isFinite(yo.lng) ? (
          <Marker coordinate={{ latitude: yo.lat, longitude: yo.lng }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges>
            <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#4B4FA6', borderWidth: 2, borderColor: PAPEL }} />
          </Marker>
        ) : null}
      </MapView>

      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
        <PanelTiempos
          tiempos={tiempos}
          listo={tiemposListos}
          verTramos={verTramos}
          error={error}
          onReintentar={onReintentar}
          onTramos={() => {
            roce();
            setVerTramos((v) => !v);
          }}
          onIr={(t) => {
            const medio = t.geometria?.[Math.floor((t.geometria?.length || 0) / 2)];
            if (!medio) return;
            roce();
            irA(Number(medio[0]), Number(medio[1]), 13);
          }}
          onVerTiempos={() => {
            roce();
            onVerTiempos?.();
          }}
        />

        {elegido ? (
          <FichaIncidente
            inc={elegido}
            bottomInset={bottomInset}
            onClose={() => setElegido(null)}
          />
        ) : sueltos.length ? (
          <Sueltos
            sueltos={sueltos}
            abierto={verSueltos}
            bottomInset={bottomInset}
            onAlternar={() => {
              roce();
              setVerSueltos((v) => !v);
            }}
            onElegir={abrir}
          />
        ) : null}
      </View>
    </View>
  );
});

export default MapaTrafico;

function PanelTiempos({ tiempos, listo, verTramos, error, onReintentar, onTramos, onIr, onVerTiempos }) {
  if (!tiempos.length) {
    return (
      <View style={caja}>
        {listo ? <Text style={{ fontFamily: MONO, fontSize: 11.5, color: INK.faint }}>Sin tiempos medidos ahora.</Text> : null}
        <ControlTramos activo={verTramos} onPress={onTramos} />
        {error ? <Reintento onPress={onReintentar} /> : null}
      </View>
    );
  }
  return (
    <View style={caja}>
      {tiempos.map((t) => {
        const min = minutosDe(t.con_trafico_s);
        return (
          <Pressable
            key={t.clave || t.id}
            onPress={() => onIr(t)}
            style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
            accessibilityRole="button"
            accessibilityLabel={`${t.desde} a ${t.hacia}, ${min} minutos`}
          >
            <Text style={{ fontFamily: MONO, fontSize: 12.5, color: INK.title }} numberOfLines={1}>
              {min} min
              <Text style={{ color: INK.faint }}>{`  ${t.desde} → ${t.hacia}`}</Text>
            </Text>
          </Pressable>
        );
      })}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 14 }}>
        <ControlTramos activo={verTramos} onPress={onTramos} />
        <Pressable onPress={onVerTiempos} hitSlop={8} accessibilityRole="button" accessibilityLabel="Ver todos los tiempos" style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={{ fontFamily: MONO, fontSize: 11.5, color: INK.faint }}>todos los tiempos</Text>
        </Pressable>
      </View>
      {error ? <Reintento onPress={onReintentar} /> : null}
    </View>
  );
}

function Reintento({ onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Volver a traer los reportes" style={{ minHeight: 44, justifyContent: 'center' }}>
      <Text style={{ fontFamily: MONO, fontSize: 12, color: INK.body }}>No se pudieron traer los reportes. Probar de nuevo.</Text>
    </Pressable>
  );
}

function ControlTramos({ activo, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityState={{ checked: activo }}
      accessibilityLabel={activo ? 'Ocultar los tramos medidos' : 'Mostrar los tramos medidos'}
      style={{ minHeight: 44, justifyContent: 'center' }}
    >
      <Text style={{ fontFamily: MONO, fontSize: 11.5, color: activo ? INK.title : INK.faint }}>
        {activo ? 'ocultar tramos' : 'ver tramos'}
      </Text>
    </Pressable>
  );
}

const caja = {
  position: 'absolute',
  left: 14,
  right: 72,
  top: 12,
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: 14,
  backgroundColor: 'rgba(255,253,248,0.94)',
  borderWidth: 1,
  borderColor: 'rgba(28,43,34,0.12)',
};

function Sueltos({ sueltos, abierto, bottomInset, onAlternar, onElegir }) {
  return (
    <View
      style={{
        position: 'absolute',
        left: 12,
        right: 68,
        bottom: bottomInset + 12,
        borderRadius: RADIUS.md,
        backgroundColor: 'rgba(255,253,248,0.96)',
        borderWidth: 1,
        borderColor: 'rgba(28,43,34,0.12)',
        overflow: 'hidden',
      }}
    >
      <Pressable
        onPress={onAlternar}
        style={{ minHeight: 44, paddingHorizontal: 14, justifyContent: 'center' }}
        accessibilityRole="button"
        accessibilityState={{ expanded: abierto }}
        accessibilityLabel={`${sueltos.length} reportes sin un punto en el mapa`}
      >
        <Text style={{ fontFamily: MONO, fontSize: 12.5, color: INK.title }}>
          {sueltos.length === 1 ? '1 reporte sin un punto' : `${sueltos.length} reportes sin un punto`}
        </Text>
      </Pressable>
      {abierto ? (
        <ScrollView style={{ maxHeight: 220 }} contentContainerStyle={{ paddingBottom: 6 }}>
          {sueltos.map((inc) => (
            <Pressable
              key={inc.id}
              onPress={() => onElegir(inc)}
              style={({ pressed }) => ({
                minHeight: 44,
                paddingHorizontal: 14,
                paddingVertical: 8,
                opacity: pressed ? 0.6 : 1,
              })}
              accessibilityRole="button"
              accessibilityLabel={`${tituloDe(inc.tipo)}. ${inc.fuentes[0]?.etiqueta || 'fuente'}`}
            >
              <Text style={{ fontFamily: MONO, fontSize: 12.5, color: INK.title }} numberOfLines={1}>
                {tituloDe(inc.tipo)}
                {inc.lugar ? <Text style={{ color: INK.faint }}>{`  ${inc.lugar}`}</Text> : null}
              </Text>
              <Text style={{ fontFamily: MONO, fontSize: 11, color: INK.faint, marginTop: 2 }} numberOfLines={1}>
                {inc.fuentes.map((f) => f.etiqueta).join(' · ')}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

function FichaIncidente({ inc, bottomInset, onClose }) {
  const abrir = (url) => {
    if (!url) return;
    Linking.openURL(url).catch(() => {});
  };
  return (
    <View
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: bottomInset + 12,
        maxHeight: 420,
        backgroundColor: PAPEL,
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: 'rgba(28,43,34,0.12)',
        ...CARD_SHADOW,
      }}
    >
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: SERIF, fontSize: 26, lineHeight: 30, letterSpacing: -0.3, color: INK.title }}>
              {tituloDe(inc.tipo)}
            </Text>
            {inc.lugar ? (
              <Text style={{ fontFamily: MONO, fontSize: 12, color: INK.body, marginTop: 4, lineHeight: 18 }}>{inc.lugar}</Text>
            ) : null}
          </View>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar el reporte" style={{ padding: 6 }}>
            <X size={18} color={INK.faint} />
          </Pressable>
        </View>

        {inc.preciso === false ? (
          <Text style={{ fontFamily: MONO, fontSize: 11, color: INK.faint, marginTop: 8 }}>Punto aproximado.</Text>
        ) : null}

        {inc.descripcion ? (
          <Text style={{ fontFamily: MONO, fontSize: 13, color: INK.title, lineHeight: 20, marginTop: 12 }}>{inc.descripcion}</Text>
        ) : null}

        {inc.causa ? <Bloque etiqueta="causa" texto={inc.causa} /> : null}
        {inc.efecto ? <Bloque etiqueta="efecto" texto={inc.efecto} /> : null}
        {inc.alternas ? <Bloque etiqueta="por dónde más" texto={inc.alternas} /> : null}

        {inc.cuando ? (
          <Text style={{ fontFamily: MONO, fontSize: 11.5, color: INK.faint, marginTop: 12 }}>
            {inc.cuando.startsWith('ayer') ? `desde ${inc.cuando}` : `desde las ${inc.cuando}`}
          </Text>
        ) : null}

        <Text style={{ fontFamily: MONO, fontSize: 11, color: INK.faint, marginTop: 16 }}>fuentes</Text>
        {inc.fuentes.map((f) =>
          f.url ? (
            <Pressable
              key={f.url}
              onPress={() => abrir(f.url)}
              style={({ pressed }) => ({
                minHeight: 44,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                opacity: pressed ? 0.55 : 1,
              })}
              accessibilityRole="link"
              accessibilityLabel={`Abrir ${f.etiqueta}`}
            >
              <Text style={{ fontFamily: MONO, fontSize: 13.5, color: INK.title }}>{f.etiqueta}</Text>
              <ArrowUpRight size={14} color={INK.faint} />
            </Pressable>
          ) : (
            <View key={f.etiqueta} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text style={{ fontFamily: MONO, fontSize: 13.5, color: INK.title }}>{f.etiqueta}</Text>
            </View>
          )
        )}
      </ScrollView>
    </View>
  );
}

function Bloque({ etiqueta, texto }) {
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={{ fontFamily: MONO, fontSize: 11, color: INK.faint }}>{etiqueta}</Text>
      <Text style={{ fontFamily: MONO, fontSize: 13, color: INK.body, lineHeight: 19, marginTop: 3 }}>{texto}</Text>
    </View>
  );
}
