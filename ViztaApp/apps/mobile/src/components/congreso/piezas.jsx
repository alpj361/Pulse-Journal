import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, ArrowUpRight } from 'lucide-react-native';
import { INK } from '../theme';
import { COPY } from './copy';
import { VOTO_COLOR, estilos } from './estilos';

export function Volver({ onPress }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={onPress || (() => (router.canGoBack() ? router.back() : router.replace('/')))}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={COPY.comun.volver}
      style={({ pressed }) => [estilos.volver, { opacity: pressed ? 0.5 : 1 }]}
    >
      <ArrowLeft size={24} color={INK.title} strokeWidth={2.2} />
    </Pressable>
  );
}

export function Encabezado({ titulo, bajada, tinta }) {
  return (
    <View style={estilos.encabezado}>
      <Volver />
      <Text style={[estilos.titulo, tinta ? { color: tinta } : null]}>{titulo}</Text>
      {bajada ? <Text style={estilos.bajada}>{bajada}</Text> : null}
    </View>
  );
}

export function Chip({ texto, tinta, lavado, borde, activo = true }) {
  return (
    <View
      style={[
        estilos.chip,
        {
          backgroundColor: activo ? lavado : 'transparent',
          borderColor: borde,
        },
      ]}
    >
      <Text style={[estilos.chipTexto, { color: tinta }]}>{texto}</Text>
    </View>
  );
}

export function ChipFiltro({ texto, activo, tinta, lavado, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: activo }}
      hitSlop={6}
      style={({ pressed }) => [
        estilos.chip,
        {
          backgroundColor: activo ? lavado : 'rgba(28,43,34,0.04)',
          borderColor: activo ? tinta : 'rgba(28,43,34,0.10)',
          opacity: pressed ? 0.7 : 1,
          minHeight: 32,
          justifyContent: 'center',
        },
      ]}
    >
      <Text style={[estilos.chipTexto, { color: activo ? tinta : INK.body }]}>{texto}</Text>
    </Pressable>
  );
}

export function EstadoCaja({ cargando, error, vacio, onReintentar, children }) {
  if (cargando) {
    return (
      <View style={estilos.estadoCaja}>
        <ActivityIndicator color={INK.meta} />
        <Text style={[estilos.estadoTexto, { marginTop: 12 }]}>{COPY.comun.cargar}</Text>
      </View>
    );
  }
  if (error) {
    return (
      <View style={estilos.estadoCaja}>
        <Text style={estilos.estadoTexto}>{error}</Text>
        {onReintentar ? (
          <Pressable onPress={onReintentar} style={estilos.reintentar} accessibilityRole="button">
            <Text style={estilos.reintentarTexto}>{COPY.comun.reintentar}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }
  if (vacio) {
    return (
      <View style={estilos.estadoCaja}>
        <Text style={estilos.estadoTexto}>{vacio}</Text>
      </View>
    );
  }
  return children;
}

export function CargarMas({ visible, onPress }) {
  if (!visible) return null;
  return (
    <Pressable onPress={onPress} style={estilos.cargarMas} accessibilityRole="button">
      <Text style={estilos.cargarMasTexto}>{COPY.comun.cargarMas}</Text>
    </Pressable>
  );
}

export function EnlaceFuente({ url, texto, tinta }) {
  if (!url) return null;
  return (
    <Pressable
      onPress={() => {
        Linking.openURL(url).catch(() => {});
      }}
      accessibilityRole="link"
      accessibilityLabel={texto}
      style={estilos.enlace}
    >
      <Text style={[estilos.enlaceTexto, { color: tinta }]}>{texto}</Text>
      <ArrowUpRight size={16} color={tinta} strokeWidth={2.2} />
    </Pressable>
  );
}

export function ConteoVotos({ aFavor, enContra, ausentes, licencia }) {
  const items = [
    { clave: 'a_favor', label: 'A favor', valor: aFavor },
    { clave: 'en_contra', label: 'En contra', valor: enContra },
    { clave: 'ausente', label: 'Ausentes', valor: ausentes },
    { clave: 'licencia', label: 'Licencia', valor: licencia },
  ];
  return (
    <View style={estilos.conteos}>
      {items.map((item) => {
        const tono = VOTO_COLOR[item.clave];
        return (
          <View
            key={item.clave}
            style={[estilos.conteo, { backgroundColor: tono.tint, borderColor: tono.tint }]}
          >
            <Text style={[estilos.conteoNumero, { color: tono.ink }]}>{item.valor ?? '—'}</Text>
            <Text style={[estilos.conteoLabel, { color: tono.ink }]}>{item.label}</Text>
          </View>
        );
      })}
    </View>
  );
}
