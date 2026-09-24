import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { LocateFixed, Search } from 'lucide-react-native';
import { INK, RADIUS } from '../theme';
import { MONO } from './mono';
import MiniMapa from './MiniMapa';
import BuscarLugar from '../mapa/BuscarLugar';
import { donde, pedirEnUso } from '../../services/ubicacion';
import { roce } from '../../utils/haptics';

/**
 * El estilo de las cajas de coordenadas.
 *
 * Copiado y no importado de `FieldInput`: ese módulo importa este para dibujar
 * el campo, así que importarlo de vuelta cierra un ciclo, y en un ciclo el que
 * carga segundo ve `undefined` donde esperaba el estilo.
 */
const caja = {
  paddingHorizontal: 13,
  paddingVertical: 11,
  borderRadius: RADIUS.sm,
  borderWidth: 1,
  borderColor: 'rgba(28,43,34,0.12)',
  color: INK.title,
};

/**
 * Un punto se marca mirando un mapa.
 *
 * El campo eran dos cajas de números. Para el agente que llena el Codex eso es
 * exacto y suficiente; para una persona, «14.6349 / −90.5069» no dice si el
 * punto cayó en la plaza o en el río de al lado. Ahora se ve dónde quedó, y se
 * puede poner de las dos maneras que alguien tiene a mano: donde está parado, o
 * buscando el lugar por su nombre.
 *
 * Las cajas de coordenadas se quedan, abajo y en letra de máquina: son la
 * salida para pegar un par exacto que vino de otro lado, y la prueba de qué se
 * va a guardar. El contrato no cambia — `{ lat, lng }`, como antes.
 */
export default function CampoGeo({ value, onChange, accent = INK.title }) {
  const [buscando, setBuscando] = useState(false);
  const v = value && typeof value === 'object' ? value : {};
  const hayPunto = Number.isFinite(Number(v.lat)) && Number.isFinite(Number(v.lng));

  const ubicarAqui = async () => {
    try {
      const permiso = await pedirEnUso();
      if (permiso === 'ninguno') return;
      const aqui = await donde();
      onChange({ lat: Number(aqui.lat.toFixed(6)), lng: Number(aqui.lng.toFixed(6)) });
      roce();
    } catch {
      // Sin señal o con la ubicación apagada: quedan las otras dos formas.
    }
  };

  return (
    <View style={{ gap: 9 }}>
      {hayPunto ? (
        <MiniMapa
          ubicacion={{ lat: Number(v.lat), lng: Number(v.lng) }}
          compacto
          onPress={() => {
            roce();
            setBuscando(true);
          }}
        />
      ) : null}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Accion Icono={LocateFixed} texto="donde estoy" onPress={ubicarAqui} accent={accent} />
        <Accion
          Icono={Search}
          texto="buscar un lugar"
          onPress={() => {
            roce();
            setBuscando(true);
          }}
          accent={accent}
        />
      </View>

      {/* Las coordenadas, para pegar un par exacto o para verificar. */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          value={v.lat != null ? String(v.lat) : ''}
          onChangeText={(t) => onChange({ ...v, lat: t === '' ? undefined : Number(t) })}
          placeholder="lat (14.6349)"
          placeholderTextColor={INK.faint}
          keyboardType="numbers-and-punctuation"
          style={[caja, { flex: 1, fontFamily: MONO, fontSize: 12.5 }]}
        />
        <TextInput
          value={v.lng != null ? String(v.lng) : ''}
          onChangeText={(t) => onChange({ ...v, lng: t === '' ? undefined : Number(t) })}
          placeholder="lng (−90.5069)"
          placeholderTextColor={INK.faint}
          keyboardType="numbers-and-punctuation"
          style={[caja, { flex: 1, fontFamily: MONO, fontSize: 12.5 }]}
        />
      </View>

      <BuscarLugar
        visible={buscando}
        centro={hayPunto ? { lat: Number(v.lat), lng: Number(v.lng) } : null}
        onElegir={(sugerencia) => {
          setBuscando(false);
          onChange({ lat: Number(sugerencia.lat), lng: Number(sugerencia.lng) });
          roce();
        }}
        onClose={() => setBuscando(false)}
      />
    </View>
  );
}

function Accion({ Icono, texto, onPress, accent }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={texto}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        paddingVertical: 11,
        borderRadius: RADIUS.sm,
        borderWidth: 1,
        borderColor: 'rgba(28,43,34,0.12)',
        backgroundColor: pressed ? 'rgba(28,43,34,0.05)' : 'transparent',
      })}
    >
      <Icono size={14} color={accent} />
      <Text style={{ fontFamily: MONO, fontSize: 11.5, color: INK.body }}>{texto}</Text>
    </Pressable>
  );
}
