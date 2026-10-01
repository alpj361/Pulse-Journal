import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { useStore } from 'zustand';
import {
  Bold,
  ChevronDown,
  Code,
  Highlighter,
  IndentDecrease,
  IndentIncrease,
  Italic,
  List,
  ListCollapse,
  ListOrdered,
  ListTodo,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from 'lucide-react-native';
import { INK } from '../../theme';
import { tipoDe } from '../../../documento/editor';
import { RESALTADOS } from '../../../documento/esquema';
import { aMano, useAMano } from './aMano';
import { roce, toque } from '../../../utils/haptics';

const INDIGO = '#4B4FA6';
const TINTA = 'rgba(28,43,34,0.78)';
const TENUE = 'rgba(28,43,34,0.38)';
const CASILLA = 'rgba(28,43,34,0.05)';

/**
 * Aa: cómo se ve lo que se escribe. Solo formato del texto; lo que se agrega a
 * la nota (páginas, tablas, separadores…) vive en el panel de `+`.
 *
 * Todo a la vista, sin deslizar: una tira con scroll escondía la mitad de los
 * botones fuera de la pantalla y nadie los encontraba. Tres filas, como en
 * Craft:
 *   1. qué es el renglón (título, subtítulo, cuerpo, foco), con nombre;
 *   2. el formato de lo seleccionado;
 *   3. listas y sangría.
 *
 * El renglón actual se marca en la primera fila, así se sabe dónde se está
 * parado sin mirar el texto.
 */
const ESTILOS = [
  { accion: 'h1', tipo: 'h1', nombre: 'Título', estilo: { fontSize: 17, fontWeight: '800' } },
  { accion: 'h2', tipo: 'h2', nombre: 'Subtítulo', estilo: { fontSize: 15, fontWeight: '700' } },
  { accion: 'cuerpo', tipo: 'normal', nombre: 'Cuerpo', estilo: { fontSize: 15 } },
  { accion: 'cita', tipo: 'cita', nombre: 'Foco', estilo: { fontSize: 15 }, barra: true },
  { accion: 'bloque', tipo: 'tarjeta', nombre: 'Bloque', estilo: { fontSize: 15 }, tarjeta: true },
];

/** Los colores del resaltado, con su nombre para leerlos en voz alta. */
const COLORES = RESALTADOS.map((r) => ({ nombre: r._key.slice(2), color: r.color }));

/**
 * Mantener apretado un botón lo deja a mano (en la cápsula, sobre el
 * teclado) o lo saca. Un toque corto de vibración dice que pasó.
 */
export const fijar = (accion) => {
  toque();
  aMano.getState().alternar(accion);
};

const LISTAS = [
  { accion: 'todo', tipo: 'todo', Icono: ListTodo, etiqueta: 'Por hacer' },
  { accion: 'toggle', tipo: 'toggle', Icono: ListCollapse, etiqueta: 'Plegable' },
  { accion: 'vineta', tipo: 'bullet', Icono: List, etiqueta: 'Viñetas' },
  { accion: 'numerada', tipo: 'number', Icono: ListOrdered, etiqueta: 'Numerada' },
];

const EN_LINEA = [
  { accion: 'negrita', Icono: Bold, etiqueta: 'Negrita' },
  { accion: 'cursiva', Icono: Italic, etiqueta: 'Cursiva' },
  { accion: 'subrayado', Icono: Underline, etiqueta: 'Subrayado' },
  { accion: 'tachado', Icono: Strikethrough, etiqueta: 'Tachado' },
  { accion: 'resaltado', Icono: Highlighter, etiqueta: 'Resaltar' },
  { accion: 'codigo', Icono: Code, etiqueta: 'Código' },
];

export default function PanelFormato({ editor, onCerrar }) {
  const fijadas = useAMano();
  const tipo = useStore(editor, (s) => {
    const b = s.seleccion?.key ? s.estado.porKey[s.seleccion.key] : null;
    return b ? tipoDe(b) : null;
  });
  const hacer = (accion) => {
    roce();
    editor.getState().formatear(accion);
    // Formatear pide el cursor de vuelta; con el panel abierto no: traería el
    // teclado y el panel se cerraría en cada toque. Al tocar el texto vuelve.
    editor.setState({ foco: null });
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(200).springify().damping(22)}
      exiting={FadeOut.duration(110)}
      style={estilos.panel}
    >
      <View style={estilos.cabecera}>
        <Pressable onPress={() => { roce(); onCerrar?.(); }} hitSlop={10} accessibilityRole="button" accessibilityLabel="Bajar el formato">
          <ChevronDown size={18} color={TENUE} />
        </Pressable>
        <Text style={{ flex: 1, fontSize: 11.5, color: TENUE }} numberOfLines={1}>
          mantené apretado un botón para tenerlo a mano
        </Text>
        <Pressable onPress={() => hacer('deshacer')} hitSlop={8} style={{ padding: 4 }} accessibilityRole="button" accessibilityLabel="Deshacer">
          <Undo2 size={17} color={TINTA} />
        </Pressable>
        <Pressable onPress={() => hacer('rehacer')} hitSlop={8} style={{ padding: 4 }} accessibilityRole="button" accessibilityLabel="Rehacer">
          <Redo2 size={17} color={TINTA} />
        </Pressable>
      </View>

      {/* 1 · Qué es el renglón. */}
      <View style={estilos.fila}>
        {ESTILOS.map((e) => {
          const activo = tipo === e.tipo;
          return (
            <Pressable
              key={e.accion}
              onPress={() => hacer(e.accion)}
              onLongPress={() => fijar(e.accion)}
              style={({ pressed }) => [
                estilos.estilo,
                e.tarjeta && { backgroundColor: 'rgba(28,43,34,0.10)' },
                activo && estilos.estiloActivo,
                pressed && { opacity: 0.6 },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: activo }}
            >
              {e.barra ? <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: activo ? INDIGO : TINTA, marginRight: 6 }} /> : null}
              <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[{ color: activo ? INDIGO : INK.title }, e.estilo]}>
                {e.nombre}
              </Text>
              {fijadas.includes(e.accion) ? <Punto /> : null}
            </Pressable>
          );
        })}
      </View>

      {/* 2 · Formato de lo seleccionado. */}
      <View style={estilos.fila}>
        {EN_LINEA.map(({ accion, Icono, etiqueta }) => (
          <Casilla key={accion} Icono={Icono} etiqueta={etiqueta} fijada={fijadas.includes(accion)} onPress={() => hacer(accion)} onLongPress={() => fijar(accion)} />
        ))}
      </View>

      {/* 2b · El color del resaltado. El botón de arriba resalta en amarillo;
          acá se elige otro, o se saca. */}
      <View style={[estilos.fila, { alignItems: 'center', paddingHorizontal: 4 }]}>
        {COLORES.map((c) => (
          <Pressable
            key={c.nombre}
            onPress={() => hacer(`resaltado:${c.nombre}`)}
            hitSlop={4}
            style={({ pressed }) => ({ flex: 1, height: 30, borderRadius: 10, backgroundColor: `${c.color}99`, opacity: pressed ? 0.6 : 1 })}
            accessibilityRole="button"
            accessibilityLabel={`Resaltar en ${c.nombre}`}
          />
        ))}
        <Pressable
          onPress={() => hacer('resaltado:ninguno')}
          hitSlop={4}
          style={({ pressed }) => ({ flex: 1, height: 30, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(28,43,34,0.15)', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
          accessibilityRole="button"
          accessibilityLabel="Sacar el resaltado"
        >
          <Text style={{ fontSize: 11.5, color: TENUE }}>sin color</Text>
        </Pressable>
      </View>

      {/* 3 · Listas y sangría. */}
      <View style={estilos.fila}>
        {LISTAS.map(({ accion, tipo: t, Icono, etiqueta }) => (
          <Casilla key={accion} Icono={Icono} etiqueta={etiqueta} activo={tipo === t} fijada={fijadas.includes(accion)} onPress={() => hacer(accion)} onLongPress={() => fijar(accion)} />
        ))}
        <View style={{ width: 8 }} />
        <Casilla Icono={IndentDecrease} etiqueta="Menos sangría" fijada={fijadas.includes('desangrar')} onPress={() => hacer('desangrar')} onLongPress={() => fijar('desangrar')} />
        <Casilla Icono={IndentIncrease} etiqueta="Más sangría" fijada={fijadas.includes('sangrar')} onPress={() => hacer('sangrar')} onLongPress={() => fijar('sangrar')} />
      </View>
    </Animated.View>
  );
}

/** La marca de «está a mano»: un punto chico en la esquina. */
export function Punto() {
  return <View style={{ position: 'absolute', top: 5, right: 5, width: 5, height: 5, borderRadius: 3, backgroundColor: INDIGO }} />;
}

function Casilla({ Icono, etiqueta, onPress, onLongPress, activo, fijada }) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [estilos.casilla, activo && estilos.casillaActiva, pressed && { opacity: 0.55 }]}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ selected: !!activo }}
    >
      <Icono size={18} color={activo ? '#FFFFFF' : TINTA} />
      {fijada ? <Punto /> : null}
    </Pressable>
  );
}

export const estilos = StyleSheet.create({
  panel: {
    marginHorizontal: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(28,43,34,0.08)',
    shadowColor: '#14201A',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    padding: 12,
    gap: 8,
  },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4, paddingBottom: 2 },
  fila: { flexDirection: 'row', gap: 6 },
  estilo: {
    flex: 1,
    height: 44,
    borderRadius: 13,
    backgroundColor: CASILLA,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  estiloActivo: { backgroundColor: 'rgba(75,79,166,0.10)', borderWidth: 1.5, borderColor: INDIGO },
  casilla: { flex: 1, height: 44, borderRadius: 13, backgroundColor: CASILLA, alignItems: 'center', justifyContent: 'center' },
  casillaActiva: { backgroundColor: INDIGO },
});
