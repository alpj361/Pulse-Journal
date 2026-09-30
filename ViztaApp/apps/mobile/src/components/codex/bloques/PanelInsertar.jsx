import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import {
  Brush,
  Camera,
  ChevronDown,
  Database,
  FileText,
  FileUp,
  ListChecks,
  Mic,
  Sigma,
  SquareCode,
  Table,
} from 'lucide-react-native';
import { INK } from '../../theme';
import { Separador } from './Especiales';
import { estilos } from './PanelFormato';
import { roce } from '../../../utils/haptics';

const TINTA = 'rgba(28,43,34,0.78)';
const TENUE = 'rgba(28,43,34,0.38)';

/**
 * `+`: lo que se agrega a la nota. Entra después del renglón del cursor, o al
 * final si no hay cursor.
 *
 * Separado de Aa a propósito: formatear cambia cómo se ve lo que ya está;
 * agregar mete algo nuevo. Mezclados, la tira tenía veinte íconos iguales y
 * no se sabía cuál hacía qué. Acá cada cosa lleva su nombre.
 *
 * Foto, audio y documento también están acá: son cosas que se agregan, como
 * una tabla. `onMedio(tipo)` abre la bandeja, la grabadora o el selector.
 */
const COSAS = [
  { accion: 'pagina', Icono: FileText, nombre: 'Página' },
  { accion: 'tabla', Icono: Table, nombre: 'Tabla' },
  { accion: 'datasheet', Icono: Database, nombre: 'Dataset' },
  { accion: 'bloque-codigo', Icono: SquareCode, nombre: 'Código' },
  { accion: 'formula', Icono: Sigma, nombre: 'Fórmula' },
  { accion: 'dibujo', Icono: Brush, nombre: 'Dibujo' },
];

const MEDIOS = [
  { tipo: 'foto', Icono: Camera, nombre: 'Foto' },
  { tipo: 'audio', Icono: Mic, nombre: 'Audio' },
  { tipo: 'documento', Icono: FileUp, nombre: 'Documento' },
];

const SEPARADORES = ['puntos', 'punteado', 'corte', 'fina', 'gruesa'];

export default function PanelInsertar({ editor, onCerrar, onMedio }) {
  const agregar = (accion, datos) => {
    roce();
    if (accion === 'separador') editor.getState().insertar('separador', datos);
    else editor.getState().formatear(accion);
    onCerrar?.();
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(200).springify().damping(22)}
      exiting={FadeOut.duration(110)}
      style={estilos.panel}
    >
      <View style={estilos.cabecera}>
        <Pressable onPress={() => { roce(); onCerrar?.(); }} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cerrar">
          <ChevronDown size={18} color={TENUE} />
        </Pressable>
        <View style={{ flex: 1 }} />
        {/* Mover, copiar o borrar varios bloques a la vez. */}
        <Pressable
          onPress={() => agregar('seleccionar')}
          hitSlop={8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 5, padding: 4 }}
          accessibilityRole="button"
        >
          <ListChecks size={15} color={TINTA} />
          <Text style={{ fontSize: 12.5, color: TINTA }}>ordenar bloques</Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {COSAS.map(({ accion, Icono, nombre }) => (
          <Tarjeta key={accion} Icono={Icono} nombre={nombre} onPress={() => agregar(accion)} />
        ))}
        {MEDIOS.map(({ tipo, Icono, nombre }) => (
          <Tarjeta
            key={tipo}
            Icono={Icono}
            nombre={nombre}
            onPress={() => {
              roce();
              onCerrar?.();
              onMedio?.(tipo);
            }}
          />
        ))}
      </View>

      {/* Los separadores se eligen por cómo se ven, no por nombre. */}
      <View style={estilos.fila}>
        {SEPARADORES.map((s) => (
          <Pressable
            key={s}
            onPress={() => agregar('separador', { estilo: s })}
            style={({ pressed }) => [estilos.casilla, { paddingHorizontal: 12 }, pressed && { opacity: 0.55 }]}
            accessibilityRole="button"
            accessibilityLabel={`Separador ${s}`}
          >
            <View style={{ alignSelf: 'stretch' }}>
              <Separador estilo={s} compacto />
            </View>
          </Pressable>
        ))}
      </View>
    </Animated.View>
  );
}

function Tarjeta({ Icono, nombre, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: '32%',
          flexGrow: 1,
          height: 58,
          borderRadius: 14,
          backgroundColor: 'rgba(28,43,34,0.05)',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
        },
        pressed && { opacity: 0.55 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={nombre}
    >
      <Icono size={19} color={TINTA} />
      <Text style={{ fontSize: 12, color: INK.body }}>{nombre}</Text>
    </Pressable>
  );
}
