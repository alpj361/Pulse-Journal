import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { INK, RADIUS } from '../../theme';
import { MONO } from '../mono';
import { latAY, lngAX, TESELA } from '../../mapa/proyeccion';

/**
 * Un mapa chico, para un campo de coordenadas.
 *
 * **No es el mapa grande en miniatura.** Ese trae gestos, capas, niebla y
 * territorios; acá lo único que hay que contestar es «dónde queda esto». Sin
 * interacción, sin estado, sin red más allá de las teselas que se ven.
 *
 * **Se dibujan cuatro teselas, no una.** Con una sola, el punto cae donde caiga
 * dentro de ella —a veces contra un borde— y la mitad del contexto que explica
 * el lugar queda afuera. Centrando el punto y dibujando el cuadrante alrededor,
 * el pin siempre queda al medio y siempre se ve qué lo rodea.
 *
 * Las coordenadas van abajo y en gris: son la respuesta a «cuál exactamente»,
 * que casi nunca es la pregunta. La pregunta es la imagen.
 */

const MAPBOX = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
const ESTILO = 'mapbox/outdoors-v12';
const ALTO = 172;
const ZOOM = 14;

const urlTesela = (z, x, y) =>
  MAPBOX
    ? `https://api.mapbox.com/styles/v1/${ESTILO}/tiles/256/${z}/${x}/${y}@2x?access_token=${MAPBOX}`
    : `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;

export default function MiniMapa({ lat, lng, ancho = 320, etiqueta }) {
  const { teselas, pin } = useMemo(() => {
    const px = lngAX(lng, ZOOM);
    const py = latAY(lat, ZOOM);

    // La esquina superior izquierda del recorte, en píxeles de mundo.
    const x0 = px - ancho / 2;
    const y0 = py - ALTO / 2;

    const tx0 = Math.floor(x0 / TESELA);
    const ty0 = Math.floor(y0 / TESELA);
    const tx1 = Math.floor((x0 + ancho) / TESELA);
    const ty1 = Math.floor((y0 + ALTO) / TESELA);

    const fuera = [];
    const n = Math.pow(2, ZOOM);
    for (let ty = ty0; ty <= ty1; ty += 1) {
      for (let tx = tx0; tx <= tx1; tx += 1) {
        // El mundo se repite en X y termina en Y: sin esto, un punto cerca del
        // antimeridiano pide teselas que no existen y quedan huecos.
        if (ty < 0 || ty >= n) continue;
        fuera.push({
          clave: `${tx}:${ty}`,
          url: urlTesela(ZOOM, ((tx % n) + n) % n, ty),
          left: tx * TESELA - x0,
          top: ty * TESELA - y0,
        });
      }
    }

    return { teselas: fuera, pin: { x: px - x0, y: py - y0 } };
  }, [lat, lng, ancho]);

  return (
    <View>
      <View
        style={{
          width: ancho,
          height: ALTO,
          borderRadius: RADIUS.sm,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: 'rgba(28,43,34,0.12)',
          backgroundColor: '#EFEFEA',
        }}
      >
        {teselas.map((t) => (
          <Image
            key={t.clave}
            source={{ uri: t.url }}
            cachePolicy="memory-disk"
            recyclingKey={t.clave}
            // `+1` mata la costura entre teselas: con ancho exacto, el redondeo
            // a píxeles físicos deja una hilacha del fondo entre columnas.
            style={{ position: 'absolute', left: t.left, top: t.top, width: TESELA + 1, height: TESELA + 1 }}
            transition={null}
          />
        ))}

        {/* El pin. Aro de papel para que se despegue de cualquier terreno —sobre
            verde oscuro un punto ámbar solo desaparece. */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: pin.x - 9,
            top: pin.y - 9,
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: '#B45309',
            borderWidth: 3,
            borderColor: '#FFFDF8',
          }}
        />
      </View>

      <Text style={{ fontFamily: MONO, fontSize: 11, color: INK.meta, marginTop: 7 }}>
        {etiqueta ? `${etiqueta} · ` : ''}
        {lat.toFixed(4)}, {lng.toFixed(4)}
      </Text>
    </View>
  );
}
