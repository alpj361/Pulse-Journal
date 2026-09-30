import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { X } from 'lucide-react-native';
import { INK, GLASS, CARD_SHADOW, RIM } from '../theme';
import { MONO } from './mono';
import { PAPEL } from './Papel';
import { TYPE_ACCENT, normalizeTipo } from './tipos';
import { roce } from '../../utils/haptics';

const TENUE = 'rgba(28,43,34,0.34)';
const ALTO_LISTA = 260;
const TOPE = 40;

/** El tipo de cada resultado, en singular: es una cosa, no un filtro. */
const TIPO_SINGULAR = {
  Snippet: 'nota',
  Actor: 'actor',
  Entidad: 'entidad',
  Territorio: 'territorio',
  Evento: 'evento',
  Concepto: 'concepto',
  Documento: 'documento',
  Evidencia: 'evidencia',
  Objeto: 'objeto',
  Artefacto: 'artefacto',
  Post: 'post',
};
const tipoDe = (tipo) => TIPO_SINGULAR[tipo] || String(tipo || '').toLowerCase();

const plano = (t) =>
  String(t || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/**
 * Qué tan bien coincide un nombre con lo escrito. El mismo orden que el resto
 * de la app: primero lo que empieza con eso, después lo que tiene una palabra
 * que empieza con eso, al final lo que lo contiene en cualquier parte. `null`
 * si no coincide.
 */
function rango(nombre, q) {
  const n = plano(nombre);
  if (!n || !q) return null;
  if (n.startsWith(q)) return 0;
  if (n.split(/[^a-z0-9ñ]+/).some((p) => p.startsWith(q))) return 1;
  if (n.includes(q)) return 2;
  return null;
}

/**
 * Buscar dentro del espacio abierto.
 *
 * Solo entre lo que ya está en el espacio: actores, entidades, notas, posts…
 * Para sumar algo de afuera está el «+». Busca por nombre y por alias, y tocar
 * un resultado abre su ficha —o la nota, si es una nota—, igual que la lista
 * «en este espacio».
 */
export default function BuscarEnEspacio({ espacio, items, onAbrir, onCerrar }) {
  const [consulta, setConsulta] = useState('');
  const q = plano(consulta);

  const resultados = useMemo(() => {
    if (!q) return [];
    const salida = [];
    for (const it of items || []) {
      const nombres = [it.name, ...(Array.isArray(it.aliases) ? it.aliases : [])];
      let mejor = null;
      let porAlias = null;
      nombres.forEach((nombre, k) => {
        const r = rango(nombre, q);
        if (r !== null && (mejor === null || r < mejor)) {
          mejor = r;
          porAlias = k > 0 ? nombre : null;
        }
      });
      if (mejor !== null) salida.push({ item: it, rango: mejor, porAlias });
    }
    return salida
      .sort(
        (a, b) =>
          a.rango - b.rango ||
          String(a.item.name).length - String(b.item.name).length ||
          String(a.item.name).localeCompare(String(b.item.name), 'es')
      )
      .slice(0, TOPE);
  }, [items, q]);

  return (
    <Animated.View
      entering={FadeInDown.duration(200).springify().damping(22)}
      exiting={FadeOut.duration(130)}
      style={[CARD_SHADOW, { borderRadius: 16, backgroundColor: PAPEL, overflow: 'hidden', boxShadow: RIM }]}
    >
      <BlurView intensity={GLASS.blur} tint="light" style={StyleSheet.absoluteFill} />

      <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 8 }}>
        <TextInput
          value={consulta}
          onChangeText={setConsulta}
          placeholder={`buscá en ${espacio?.name || 'este espacio'}…`}
          placeholderTextColor="rgba(28,43,34,0.3)"
          autoFocus
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          style={{ flex: 1, fontFamily: MONO, fontSize: 13.5, color: INK.title, paddingVertical: 13 }}
          accessibilityLabel="Buscar dentro del espacio"
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

      {q ? (
        <ScrollView
          style={{
            maxHeight: ALTO_LISTA,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: 'rgba(28,43,34,0.1)',
          }}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 4 }}
        >
          {resultados.length ? (
            resultados.map((r) => (
              <Fila
                key={r.item.id}
                item={r.item}
                porAlias={r.porAlias}
                onPress={() => {
                  roce();
                  onAbrir?.(r.item);
                }}
              />
            ))
          ) : (
            <Text style={{ fontFamily: MONO, fontSize: 12, color: TENUE, paddingHorizontal: 16, paddingVertical: 12 }}>
              nada con ese nombre en este espacio.
            </Text>
          )}
        </ScrollView>
      ) : null}
    </Animated.View>
  );
}

function Fila({ item, porAlias, onPress }) {
  const tipo = normalizeTipo(item.tipo);
  const color = TYPE_ACCENT[tipo] || TYPE_ACCENT.Artefacto;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: pressed ? 'rgba(28,43,34,0.05)' : 'transparent',
      })}
      accessibilityRole="button"
      accessibilityLabel={`Abrir ${item.name}`}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <Text numberOfLines={1} style={{ flex: 1, fontFamily: MONO, fontSize: 12.5, color: INK.title }}>
        {item.name}
      </Text>
      <Text numberOfLines={1} style={{ fontFamily: MONO, fontSize: 10, color: TENUE, maxWidth: 110 }}>
        {porAlias || tipoDe(tipo)}
      </Text>
    </Pressable>
  );
}
