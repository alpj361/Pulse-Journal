import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import {
  AlignLeft,
  AtSign,
  BookOpen,
  BookText,
  Box,
  Brain,
  Building2,
  CalendarDays,
  FileText,
  LayoutDashboard,
  Lightbulb,
  Link2,
  MapPin,
  Quote,
  Search,
  User,
} from 'lucide-react-native';
import { INK } from '../theme';
import { TEMAS } from '../feed/temas';
import { claveTipo, nombreTipo } from './logica';

/** Ícono y lavado por tipo (pantalla 8). Un tipo nuevo cae al de documento. */
const ESTILO = {
  actor: { Icono: User, tema: TEMAS.Política },
  entidad: { Icono: Building2, tema: TEMAS.Movilidad },
  source: { Icono: BookOpen, tema: TEMAS.Economía },
  fuente: { Icono: BookOpen, tema: TEMAS.Economía },
  evidencia: { Icono: BookOpen, tema: TEMAS.Economía },
  evento: { Icono: CalendarDays, tema: TEMAS.Entretenimiento },
  historia: { Icono: BookText, tema: TEMAS.Cultura },
  snippet: { Icono: Quote, tema: TEMAS.Justicia },
  fragmento: { Icono: Quote, tema: TEMAS.Justicia },
  nota: { Icono: AlignLeft, tema: TEMAS.Política },
  enlace: { Icono: Link2, tema: TEMAS.Economía },
  investigación: { Icono: Search, tema: TEMAS.Social },
  investigacion: { Icono: Search, tema: TEMAS.Social },
  territorio: { Icono: MapPin, tema: TEMAS.Social },
  concepto: { Icono: Lightbulb, tema: TEMAS.Deportes },
  objeto: { Icono: Box, tema: TEMAS.Tecnología },
  artefacto: { Icono: Box, tema: TEMAS.Tecnología },
  memoria: { Icono: Brain, tema: TEMAS.Cultura },
  artifact: { Icono: LayoutDashboard, tema: TEMAS.Tecnología },
  dashboard: { Icono: LayoutDashboard, tema: TEMAS.Tecnología },
  post: { Icono: AtSign, tema: TEMAS.Social },
};

export const estiloDe = (item) => ESTILO[claveTipo(item)] || { Icono: FileText, tema: TEMAS.Clima };

/**
 * La cara de algo del Codex: su foto si tiene, o el ícono de su tipo en su
 * color. La misma en Su Codex, al adjuntar y en el chat.
 */
export function Cara({ item, imagen, size = 40 }) {
  const { Icono, tema } = estiloDe(item);
  const radio = Math.round(size * 0.26);
  // Las fotos de Instagram vienen firmadas y vencen: si no carga, va el ícono.
  const [rota, setRota] = useState(null);
  if (imagen && rota !== imagen) {
    return (
      <Image
        source={{ uri: imagen }}
        onError={() => setRota(imagen)}
        accessible={false}
        style={{ width: size, height: size, borderRadius: radio, backgroundColor: tema.lavado[0] }}
      />
    );
  }
  return (
    <View
      accessible={false}
      style={{ width: size, height: size, borderRadius: radio, backgroundColor: tema.lavado[0], borderWidth: 1, borderColor: tema.lavado[1], alignItems: 'center', justifyContent: 'center' }}
    >
      <Icono size={Math.round(size * 0.48)} color={tema.tinta} strokeWidth={1.8} />
    </View>
  );
}

/**
 * Algo del Codex adjunto a un mensaje: la cara, el título y el tipo, en una
 * tarjeta. Del lado de quien lo mandó.
 */
export default function Elemento({ titulo, tipo, imagen, mio, onPress, derecha }) {
  const item = { tipo };
  const estilo = {
    alignSelf: mio ? 'flex-end' : 'flex-start',
    width: '78%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(28,43,34,0.1)',
    borderRadius: 16,
    padding: 10,
    paddingRight: 14,
  };
  const contenido = (
    <>
      <Cara item={item} imagen={imagen} size={44} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 14.5, fontWeight: '700', lineHeight: 19, color: INK.title }} numberOfLines={2}>
          {titulo || 'Sin título'}
        </Text>
        <Text style={{ fontSize: 12, color: INK.meta }} numberOfLines={1}>
          {nombreTipo(claveTipo(item))}
        </Text>
      </View>
      {derecha}
    </>
  );
  const etiqueta = `${titulo || 'Sin título'}, ${nombreTipo(claveTipo(item))}`;
  if (!onPress) {
    return (
      <View style={estilo} accessible accessibilityLabel={etiqueta}>
        {contenido}
      </View>
    );
  }
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={etiqueta} style={({ pressed }) => [estilo, { opacity: pressed ? 0.7 : 1 }]}>
      {contenido}
    </Pressable>
  );
}
