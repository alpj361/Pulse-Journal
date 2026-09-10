import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Modal } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Search, X, Check } from 'lucide-react-native';
import { INK } from '../theme';
import { MONO } from './mono';
import { PAPEL } from './Papel';
import { listarModelos } from '../../services/viztaRapido';
import { useModeloStore } from '../../state/modeloStore';
import MorphingInfinity from '../MorphingInfinity';
import { roce } from '../../utils/haptics';

const TENUE = 'rgba(28,43,34,0.34)';

/** Cuántos se pintan de una. Ver `visibles`. */
const TECHO = 80;

/**
 * Elegir el modelo.
 *
 * La lista sale viva de OpenRouter, ya filtrada a los que soportan
 * herramientas. Son cientos, así que esto es un buscador con resultados y no
 * una lista para recorrer: sin campo de búsqueda, encontrar un modelo concreto
 * sería desplazar por trescientas filas.
 *
 * Se muestran el proveedor y el precio de entrada por millón de tokens. El
 * precio no es decoración: entre dos modelos que hacen lo mismo, es lo único
 * que los distingue de un vistazo, y algunos cuestan cien veces más que otros.
 */
export default function SelectorModelo({ onCerrar, topInset = 0, bottomInset = 0 }) {
  const [modelos, setModelos] = useState(null); // null = cargando
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');

  const elegido = useModeloStore((s) => s.modelo);
  const elegir = useModeloStore((s) => s.elegir);

  useEffect(() => {
    let vivo = true;

    listarModelos()
      .then((lista) => vivo && setModelos(lista))
      .catch((e) => vivo && setError(e.message || 'No se pudo traer la lista'));

    return () => {
      vivo = false;
    };
  }, []);

  const filtrados = useMemo(() => {
    if (!modelos) return [];
    const t = q.trim().toLowerCase();
    if (!t) return modelos;
    return modelos.filter(
      (m) => m.nombre.toLowerCase().includes(t) || m.id.toLowerCase().includes(t)
    );
  }, [modelos, q]);

  /**
   * Lo que se pinta.
   *
   * Trescientas filas de una traban el scroll al abrir. Se corta en `TECHO`, y
   * el modelo elegido se fuerza al principio: si quedó fuera del corte, el
   * selector se abriría sin mostrar cuál está activo, que es lo primero que uno
   * viene a ver.
   */
  const visibles = useMemo(() => {
    const activo = filtrados.find((m) => m.id === elegido);
    const resto = filtrados.filter((m) => m.id !== elegido).slice(0, TECHO);
    return activo ? [activo, ...resto] : resto;
  }, [filtrados, elegido]);

  const sobrantes = filtrados.length - visibles.length;

  return (
    <Modal visible animationType="slide" onRequestClose={onCerrar} transparent={false}>
      <View style={{ flex: 1, backgroundColor: PAPEL, paddingTop: topInset + 12 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingHorizontal: 22,
            paddingBottom: 12,
          }}
        >
          <Pressable onPress={onCerrar} hitSlop={12} style={{ padding: 6 }}>
            <X size={19} color={INK.faint} />
          </Pressable>
          <Text style={{ fontFamily: MONO, fontSize: 13, color: INK.title, flex: 1 }}>modelo</Text>
          {modelos ? (
            <Text style={{ fontFamily: MONO, fontSize: 11, color: TENUE }}>{modelos.length}</Text>
          ) : null}
        </View>

        <View style={{ paddingHorizontal: 28, paddingBottom: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Search size={15} color={TENUE} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="buscar un modelo"
              placeholderTextColor="rgba(28,43,34,0.22)"
              autoCapitalize="none"
              autoCorrect={false}
              style={{ flex: 1, fontFamily: MONO, fontSize: 13.5, color: INK.title, padding: 0 }}
            />
          </View>
          <View style={{ height: 1, marginTop: 9, backgroundColor: 'rgba(28,43,34,0.14)' }} />
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 28,
            paddingTop: 12,
            paddingBottom: bottomInset + 40,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {error ? (
            <Text style={{ fontFamily: MONO, fontSize: 12, color: '#B91C1C', lineHeight: 19 }}>
              {error}
            </Text>
          ) : !modelos ? (
            <MorphingInfinity size={18} color={INK.title} />
          ) : visibles.length ? (
            <>
              {visibles.map((m) => (
                <Fila
                  key={m.id}
                  modelo={m}
                  activo={m.id === elegido}
                  onPress={() => {
                    roce();
                    elegir(m.id, m.nombre);
                    onCerrar();
                  }}
                />
              ))}
              {sobrantes > 0 ? (
                <Text
                  style={{ fontFamily: MONO, fontSize: 11, color: TENUE, paddingTop: 14 }}
                >
                  y {sobrantes} más — buscá para acotar
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={{ fontFamily: MONO, fontSize: 11.5, color: TENUE }}>
              nada con «{q.trim()}»
            </Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function Fila({ modelo, activo, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 11,
        opacity: pressed ? 0.5 : 1,
      })}
      accessibilityRole="button"
      accessibilityState={{ selected: activo }}
      accessibilityLabel={modelo.nombre}
    >
      <View style={{ width: 16 }}>
        {activo ? (
          <Animated.View entering={FadeIn.duration(160)}>
            <Check size={14} color={INK.title} strokeWidth={2.6} />
          </Animated.View>
        ) : null}
      </View>

      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={{ fontFamily: MONO, fontSize: 13, color: INK.title }}
        >
          {modelo.nombre}
        </Text>
        <Text
          numberOfLines={1}
          style={{ fontFamily: MONO, fontSize: 10, color: TENUE, marginTop: 2 }}
        >
          {modelo.proveedor}
          {modelo.precio != null ? ` · $${formatearPrecio(modelo.precio)}/M` : ''}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * El precio, legible.
 *
 * Va entre céntimos y decenas de dólares según el modelo, así que un número
 * fijo de decimales miente en un extremo o en el otro: con dos, los baratos
 * quedan todos en «$0.00»; con cuatro, los caros arrastran ceros que no dicen
 * nada.
 */
function formatearPrecio(p) {
  if (p < 1) return p.toFixed(2).replace(/^0/, '');
  return p.toFixed(p < 10 ? 1 : 0);
}
