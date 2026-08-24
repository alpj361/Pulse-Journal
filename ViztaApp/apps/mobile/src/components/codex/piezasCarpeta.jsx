import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { INK, RADIUS } from '../theme';
import { MONO } from './mono';
import { PAPEL } from './Papel';

/**
 * Las piezas que comparten las dos páginas con carpetas — el historial de notas
 * y la galería de posts.
 *
 * Viven acá porque son idénticas en las dos y ya estaban escritas dos veces a
 * punto de divergir. Lo que **no** está acá es el menú en sí: en el historial se
 * ancla sobre una fila de texto y en posts sobre una miniatura, así que cada
 * página arma el suyo con estas piezas adentro.
 */

export const TENUE = 'rgba(28,43,34,0.3)';
export const RESALTADOR = 'rgba(124,176,132,0.42)';

/** Una fila de menú contextual. `lomo` la marca con el color de una carpeta. */
export function Opcion({ icono, lomo, texto, peligro, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 13,
        backgroundColor: pressed
          ? peligro
            ? 'rgba(185,28,28,0.08)'
            : 'rgba(28,43,34,0.05)'
          : 'transparent',
      })}
      accessibilityRole="button"
      accessibilityLabel={texto}
    >
      {lomo ? <View style={{ width: 3, height: 15, backgroundColor: lomo }} /> : icono}
      <Text
        numberOfLines={1}
        style={{ fontFamily: MONO, fontSize: 13, color: peligro ? '#B91C1C' : INK.title, flex: 1 }}
      >
        {texto}
      </Text>
    </Pressable>
  );
}

/**
 * Pedir el nombre de una carpeta.
 *
 * Va anclado arriba y no centrado: el teclado sube apenas se abre, y una tarjeta
 * en el medio de la pantalla queda tapada justo cuando hay que escribir en ella.
 * Anclarlo alto evita tener que calcular la altura del teclado para algo que
 * dura cuatro segundos.
 */
export function Nombrador({ modo, inicial = '', topInset = 0, onCancel, onConfirm }) {
  const [texto, setTexto] = useState(inicial);
  const listo = texto.trim().length > 0;

  return (
    <>
      <Animated.View
        entering={FadeIn.duration(140)}
        exiting={FadeOut.duration(110)}
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(20,28,22,0.22)' }]}
      >
        <Pressable style={{ flex: 1 }} onPress={onCancel} />
      </Animated.View>

      <Animated.View
        entering={FadeIn.duration(160)}
        exiting={FadeOut.duration(110)}
        style={{
          position: 'absolute',
          top: topInset + 110,
          left: 26,
          right: 26,
          borderRadius: RADIUS.md,
          backgroundColor: PAPEL,
          borderWidth: 1,
          borderColor: 'rgba(28,43,34,0.10)',
          padding: 18,
          shadowColor: '#1E3326',
          shadowOpacity: 0.18,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: 10 },
          elevation: 12,
        }}
      >
        <Text style={{ fontFamily: MONO, fontSize: 11.5, color: TENUE, marginBottom: 14 }}>
          {modo === 'renombrar' ? 'renombrar carpeta' : 'carpeta nueva'}
        </Text>

        <TextInput
          value={texto}
          onChangeText={setTexto}
          autoFocus
          selectTextOnFocus={modo === 'renombrar'}
          returnKeyType="done"
          onSubmitEditing={() => listo && onConfirm(texto)}
          placeholder="nombre"
          placeholderTextColor="rgba(28,43,34,0.22)"
          style={{
            fontFamily: MONO,
            fontSize: 15,
            color: INK.title,
            paddingVertical: 8,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(28,43,34,0.14)',
          }}
        />

        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 22, marginTop: 18 }}>
          <Pressable onPress={onCancel} hitSlop={10} accessibilityRole="button">
            <Text style={{ fontFamily: MONO, fontSize: 13, color: TENUE }}>cancelar</Text>
          </Pressable>
          <Pressable
            onPress={() => listo && onConfirm(texto)}
            disabled={!listo}
            hitSlop={10}
            accessibilityRole="button"
          >
            <Text
              style={{
                fontFamily: MONO,
                fontSize: 13,
                color: listo ? INK.title : 'rgba(28,43,34,0.22)',
                backgroundColor: listo ? RESALTADOR : 'transparent',
                paddingHorizontal: 4,
              }}
            >
              {modo === 'renombrar' ? 'guardar' : 'crear'}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </>
  );
}

export const etiquetaConteo = (n, sing = 'nota', plur = 'notas') =>
  n === 1 ? `1 ${sing}` : `${n} ${plur}`;
