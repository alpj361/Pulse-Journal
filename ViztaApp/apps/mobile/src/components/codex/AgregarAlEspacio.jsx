import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeOut, ZoomIn } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Check, Plus, X } from 'lucide-react-native';
import { INK, GLASS, CARD_SHADOW, RIM } from '../theme';
import { MONO } from './mono';
import { PAPEL } from './Papel';
import { TYPE_ACCENT, normalizeTipo } from './tipos';
import { claveDe } from './menciones';
import { aplanar, buscar } from './buscarCodex';
import { roce, toque } from '../../utils/haptics';

const TENUE = 'rgba(28,43,34,0.34)';
const INDIGO = '#4B4FA6';

// Cinco filas y pico: la fila cortada abajo es lo que dice que hay más.
const ALTO_LISTA = 230;

/**
 * Sumar elementos del Codex al espacio abierto.
 *
 * Es la lupa de la hoja, en Espacios. En Notas la lupa completa lo que se está
 * escribiendo; acá no hay nada escribiéndose, así que tiene su propio campo.
 * Busca con lo mismo que el autocompletado —el índice del Codex y su orden de
 * resultados—, así que lo que aparece es lo mismo que aparecería al escribir
 * el nombre en una nota.
 *
 * Tocar un resultado lo suma y el panel queda abierto: armar un espacio es
 * sumar varias cosas seguidas, y cerrarse después de cada una obligaría a
 * volver a abrirlo cada vez. Lo que ya está en el espacio se ve marcado.
 */
export default function AgregarAlEspacio({ indice, espacio, onAgregar, onCerrar }) {
  const [consulta, setConsulta] = useState('');
  const [sumando, setSumando] = useState(null);

  const terminos = useMemo(() => aplanar(indice), [indice]);
  const resultados = useMemo(() => buscar(terminos, consulta), [terminos, consulta]);
  const miembros = useMemo(() => new Set(espacio?.itemIds || []), [espacio?.itemIds]);

  const sumar = async (item) => {
    if (miembros.has(item.id) || sumando) return;
    roce();
    setSumando(item.id);
    try {
      await onAgregar?.(item);
      toque();
    } finally {
      setSumando(null);
    }
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(200).springify().damping(22)}
      exiting={FadeOut.duration(130)}
      style={[
        CARD_SHADOW,
        { borderRadius: 16, backgroundColor: PAPEL, overflow: 'hidden', boxShadow: RIM },
      ]}
    >
      <BlurView intensity={GLASS.blur} tint="light" style={StyleSheet.absoluteFill} />

      <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 8 }}>
        <TextInput
          value={consulta}
          onChangeText={setConsulta}
          placeholder={`sumá algo a ${espacio?.name || 'este espacio'}…`}
          placeholderTextColor="rgba(28,43,34,0.3)"
          autoFocus
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          style={{ flex: 1, fontFamily: MONO, fontSize: 13.5, color: INK.title, paddingVertical: 13 }}
          accessibilityLabel="Buscar en el Codex para sumar al espacio"
        />
        <Pressable
          onPress={onCerrar}
          hitSlop={8}
          style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.5 : 1 })}
          accessibilityRole="button"
          accessibilityLabel="Cerrar la búsqueda"
        >
          <X size={16} color={TENUE} />
        </Pressable>
      </View>

      {resultados.length ? (
        <ScrollView
          style={{ maxHeight: ALTO_LISTA, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(28,43,34,0.1)' }}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 4 }}
        >
          {resultados.map((r) => (
            <Fila
              key={r.item.id}
              item={r.item}
              clave={r.clave}
              adentro={miembros.has(r.item.id)}
              sumando={sumando === r.item.id}
              onPress={() => sumar(r.item)}
            />
          ))}
        </ScrollView>
      ) : null}
    </Animated.View>
  );
}

/**
 * Un resultado. A la derecha, lo que pasa al tocarlo: un «+» si todavía no está
 * en el espacio, un tilde si ya está. El tilde entra con un salto al sumarlo,
 * que es la confirmación de que quedó adentro.
 */
function Fila({ item, clave, adentro, sumando, onPress }) {
  const color = TYPE_ACCENT[normalizeTipo(item.tipo)] || TYPE_ACCENT.Artefacto;
  const porAlias = claveDe(item.name) !== clave;

  return (
    <Pressable
      onPress={onPress}
      disabled={adentro}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: pressed ? 'rgba(28,43,34,0.05)' : 'transparent',
        opacity: sumando ? 0.5 : 1,
      })}
      accessibilityRole="button"
      accessibilityState={{ disabled: adentro }}
      accessibilityLabel={adentro ? `${item.name}, ya está en el espacio` : `Sumar ${item.name} al espacio`}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <Text
        numberOfLines={1}
        style={{ flex: 1, fontFamily: MONO, fontSize: 12.5, color: adentro ? TENUE : INK.title }}
      >
        {item.name}
      </Text>
      {porAlias ? (
        <Text numberOfLines={1} style={{ fontFamily: MONO, fontSize: 10, color: TENUE, maxWidth: 96 }}>
          {clave}
        </Text>
      ) : null}
      {adentro ? (
        <Animated.View entering={ZoomIn.springify().damping(14)}>
          <Check size={15} color={INDIGO} />
        </Animated.View>
      ) : (
        <Plus size={15} color={TENUE} />
      )}
    </Pressable>
  );
}
