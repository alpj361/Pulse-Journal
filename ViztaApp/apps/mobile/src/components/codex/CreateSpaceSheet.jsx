import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  interpolateColor,
} from 'react-native-reanimated';
import { X, Layers } from 'lucide-react-native';
import { INK, GLASS, CARD_SHADOW } from '../theme';
import MorphingInfinity from '../MorphingInfinity';
import { createSpace } from '../../utils/codexSpaces';

const RESORTE = { damping: 20, stiffness: 250, mass: 0.5 };

/**
 * Crear un espacio.
 *
 * Un espacio nace vacío y suelto (`project_id` null): agrupa lo que se le vaya
 * agregando. No pide más que un nombre — pedir descripción, proyecto y color de
 * entrada es lo que hace que nadie cree ninguno.
 */
export default function CreateSpaceSheet({ onClose, onCreated, bottomInset = 0 }) {
  const [nombre, setNombre] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const guardar = async () => {
    const n = nombre.trim();
    if (!n || guardando) return;
    setGuardando(true);
    setError(null);
    try {
      const espacio = await createSpace(n);
      onCreated?.(espacio);
      onClose();
    } catch (e) {
      setError(e.message || 'No se pudo crear el espacio');
      setGuardando(false);
    }
  };

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1, backgroundColor: 'rgba(20,28,22,0.35)', justifyContent: 'center', paddingHorizontal: 24 }}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

          <View
            style={{
              backgroundColor: '#F7F8F5',
              borderRadius: 24,
              padding: 20,
              paddingBottom: 20 + (bottomInset ? 0 : 0),
              ...CARD_SHADOW,
              shadowOpacity: 0.22,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 13,
                  backgroundColor: 'rgba(28,43,34,0.06)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Layers size={18} color={INK.title} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '800', color: INK.title, letterSpacing: -0.3 }}>
                  Nuevo espacio
                </Text>
                <Text style={{ fontSize: 11.5, color: INK.meta, marginTop: 1 }}>
                  Agrupa actores y documentos de una investigación
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 11,
                  backgroundColor: 'rgba(28,43,34,0.06)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={15} color={INK.body} />
              </Pressable>
            </View>

            <TextInput
              value={nombre}
              onChangeText={setNombre}
              onSubmitEditing={guardar}
              returnKeyType="done"
              placeholder="Ej: Caso USAC"
              placeholderTextColor={INK.faint}
              autoFocus
              maxLength={80}
              style={{
                backgroundColor: GLASS.fill,
                borderRadius: 13,
                borderWidth: 1,
                borderColor: GLASS.rim,
                paddingHorizontal: 14,
                paddingVertical: 13,
                fontSize: 15,
                color: INK.title,
              }}
            />

            {error ? (
              <View
                style={{
                  marginTop: 12,
                  padding: 11,
                  borderRadius: 11,
                  backgroundColor: 'rgba(220,38,38,0.08)',
                  borderWidth: 1,
                  borderColor: 'rgba(220,38,38,0.18)',
                }}
              >
                <Text style={{ fontSize: 12.5, color: '#B91C1C' }}>{error}</Text>
              </View>
            ) : null}

            <Boton habilitado={!!nombre.trim()} guardando={guardando} onPress={guardar} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Boton({ habilitado, guardando, onPress }) {
  const press = useSharedValue(0);
  const on = useSharedValue(habilitado ? 1 : 0);

  useEffect(() => {
    on.value = withSpring(habilitado ? 1 : 0, RESORTE);
  }, [habilitado]);

  const estilo = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.025 }],
    backgroundColor: interpolateColor(on.value, [0, 1], ['rgba(28,43,34,0.12)', '#1C2B22']),
    opacity: interpolate(press.value, [0, 1], [1, 0.92]),
  }));

  return (
    <Pressable
      onPress={onPress}
      disabled={!habilitado || guardando}
      onPressIn={() => {
        press.value = withTiming(1, { duration: 80 });
      }}
      onPressOut={() => {
        press.value = withSpring(0, RESORTE);
      }}
    >
      <Animated.View style={[{ marginTop: 14, borderRadius: 14, paddingVertical: 14, alignItems: 'center' }, estilo]}>
        {guardando ? (
          <MorphingInfinity size={18} color="#FFFFFF" />
        ) : (
          <Text style={{ fontSize: 14.5, fontWeight: '800', color: habilitado ? '#FFFFFF' : INK.faint }}>
            Crear espacio
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
}
