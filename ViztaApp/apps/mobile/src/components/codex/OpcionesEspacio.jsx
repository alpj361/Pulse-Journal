import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { INK } from '../theme';
import { MONO } from './mono';
import { PAPEL } from './Papel';
import PortadaEspacio from './PortadaEspacio';
import BandejaFotos from './BandejaFotos';
import { ASPECTOS, ONTOLOGIA } from './ontologia';
import { ajustarEspacio } from '../../utils/codexSpaces';
import { subirImagen, borrarMedio } from '../../utils/subirMedio';
import { roce, toque, falla } from '../../utils/haptics';

const TENUE = 'rgba(28,43,34,0.34)';
const INDIGO = '#4B4FA6';

/**
 * Las opciones de un espacio: su portada y de qué tipo es.
 *
 * Cada cambio se guarda en el acto, como en los ajustes de una ficha: no hay
 * nada que confirmar después.
 *
 * `onCambio(parcial)` avisa lo que cambió —`{ coverPath }`, `{ aspectos,
 * hibrido }`— para que la pantalla de atrás lo refleje sin volver a pedir.
 */
export default function OpcionesEspacio({ espacio, bottomInset = 0, onCambio, onClose }) {
  const { height } = useWindowDimensions();
  const [aspectos, setAspectos] = useState(espacio?.aspectos || []);
  const [hibrido, setHibrido] = useState(!!espacio?.hibrido || (espacio?.aspectos || []).length > 1);
  const [coverPath, setCoverPath] = useState(espacio?.coverPath || null);
  const [eligiendo, setEligiendo] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState(null);

  if (!espacio) return null;

  const guardarTipo = async (nuevos, nuevoHibrido) => {
    const antes = { aspectos, hibrido };
    setAspectos(nuevos);
    setHibrido(nuevoHibrido);
    setError(null);
    try {
      await ajustarEspacio(espacio.id, { aspectos: nuevos, hibrido: nuevoHibrido });
      onCambio?.({ aspectos: nuevos, hibrido: nuevoHibrido });
    } catch {
      falla();
      setAspectos(antes.aspectos);
      setHibrido(antes.hibrido);
      setError('No se pudo guardar el cambio');
    }
  };

  const tocarAspecto = (id) => {
    roce();
    if (hibrido) {
      guardarTipo(aspectos.includes(id) ? aspectos.filter((a) => a !== id) : [...aspectos, id], true);
    } else {
      guardarTipo(aspectos[0] === id ? [] : [id], false);
    }
  };

  const tocarHibrido = () => {
    roce();
    // Al salir de híbrido queda el primero que estaba elegido.
    if (hibrido) guardarTipo(aspectos.slice(0, 1), false);
    else guardarTipo(aspectos, true);
  };

  const ponerPortada = async ({ uri, ancho, alto }) => {
    setEligiendo(false);
    setSubiendo(true);
    setError(null);
    const vieja = coverPath;
    try {
      const subida = await subirImagen(uri, { ancho, alto, carpeta: 'espacios' });
      await ajustarEspacio(espacio.id, { coverPath: subida.storage_path });
      setCoverPath(subida.storage_path);
      onCambio?.({ coverPath: subida.storage_path });
      toque();
      if (vieja) borrarMedio(vieja);
    } catch (e) {
      falla();
      setError(e?.message?.includes('cupo') ? e.message : 'No se pudo poner la portada');
    } finally {
      setSubiendo(false);
    }
  };

  const quitarPortada = async () => {
    roce();
    const vieja = coverPath;
    setError(null);
    try {
      await ajustarEspacio(espacio.id, { quitarCover: true });
      setCoverPath(null);
      onCambio?.({ coverPath: null });
      if (vieja) borrarMedio(vieja);
    } catch {
      falla();
      setError('No se pudo quitar la portada');
    }
  };

  const nombresFiccion = aspectos.includes('ficcion') ? Object.values(ONTOLOGIA.ficcion) : null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(20,28,22,0.35)' }} onPress={onClose} />
      <Animated.View
        entering={FadeInDown.duration(220).springify().damping(22)}
        layout={LinearTransition.springify().damping(22)}
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          maxHeight: height * 0.92,
          backgroundColor: PAPEL, borderTopLeftRadius: 24, borderTopRightRadius: 24,
          paddingTop: 22, paddingBottom: eligiendo ? 0 : bottomInset + 24,
        }}
      >
        <View style={{ paddingHorizontal: 26 }}>
          <Text numberOfLines={1} style={{ fontFamily: MONO, fontSize: 15, color: INK.title }}>
            {espacio.name}
          </Text>

          {/* Portada */}
          <Text style={{ fontFamily: MONO, fontSize: 11.5, color: TENUE, marginTop: 22 }}>portada</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 12 }}>
            <View style={{ width: 84, height: 84 }}>
              <PortadaEspacio space={{ ...espacio, coverPath }} lado={84} radius={16} style={{ width: 84, height: 84 }} />
              {subiendo ? (
                <View
                  style={{
                    position: 'absolute', inset: 0, borderRadius: 16,
                    backgroundColor: 'rgba(247,248,245,0.6)', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <ActivityIndicator color={INK.title} />
                </View>
              ) : null}
            </View>
            <View style={{ gap: 10 }}>
              <Boton onPress={() => { roce(); setEligiendo((v) => !v); }} disabled={subiendo}>
                {eligiendo ? 'no, dejarla' : coverPath ? 'cambiar la foto' : 'poner una foto'}
              </Boton>
              {coverPath && !eligiendo ? (
                <Boton onPress={quitarPortada} disabled={subiendo} tenue>
                  volver a la de colores
                </Boton>
              ) : null}
            </View>
          </View>

          {/* Tipo de espacio */}
          {!eligiendo ? (
            <Animated.View entering={FadeIn.duration(180)}>
              <Text style={{ fontFamily: MONO, fontSize: 11.5, color: TENUE, marginTop: 28 }}>tipo de espacio</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {ASPECTOS.map((a) => (
                  <Chip key={a.id} activo={aspectos.includes(a.id)} onPress={() => tocarAspecto(a.id)} multiple={hibrido}>
                    {a.nombre}
                  </Chip>
                ))}
                <Chip activo={hibrido} onPress={tocarHibrido}>
                  híbrido
                </Chip>
              </View>
              {nombresFiccion ? (
                <Animated.Text
                  entering={FadeIn.duration(200)}
                  style={{ fontFamily: MONO, fontSize: 11.5, color: TENUE, marginTop: 14, lineHeight: 18 }}
                >
                  {nombresFiccion.join(' · ')}
                </Animated.Text>
              ) : null}
            </Animated.View>
          ) : null}

          {error ? <Text style={{ fontSize: 12.5, color: '#B91C1C', marginTop: 12 }}>{error}</Text> : null}
        </View>

        {/* Elegir la foto: la misma bandeja de las notas, con cámara y carrete. */}
        {eligiendo ? (
          <Animated.View entering={FadeIn.duration(200)} style={{ marginTop: 18, paddingBottom: bottomInset }}>
            <BandejaFotos onFoto={ponerPortada} />
          </Animated.View>
        ) : null}
      </Animated.View>
    </Modal>
  );
}

function Boton({ children, onPress, disabled, tenue }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => ({ opacity: disabled ? 0.4 : pressed ? 0.5 : 1 })}
      accessibilityRole="button"
    >
      <Text style={{ fontFamily: MONO, fontSize: 13, color: tenue ? TENUE : INDIGO }}>{children}</Text>
    </Pressable>
  );
}

function Chip({ children, activo, onPress, multiple }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999,
        backgroundColor: activo ? INDIGO : 'rgba(28,43,34,0.05)',
        borderWidth: multiple && !activo ? 1 : 0,
        borderStyle: 'dashed',
        borderColor: 'rgba(28,43,34,0.2)',
        opacity: pressed ? 0.7 : 1,
      })}
      accessibilityRole={multiple ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: !!activo }}
    >
      <Text style={{ fontFamily: MONO, fontSize: 12.5, color: activo ? '#FFFFFF' : INK.body }}>{children}</Text>
    </Pressable>
  );
}
