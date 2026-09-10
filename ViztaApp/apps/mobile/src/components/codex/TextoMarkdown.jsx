import { View, Text } from 'react-native';
import { INK } from '../theme';
import { MONO } from './mono';

const TENUE = 'rgba(28,43,34,0.34)';
const REGLA = 'rgba(28,43,34,0.12)';
const FONDO_CODIGO = 'rgba(28,43,34,0.05)';

/**
 * Pinta las líneas que devuelve `parsear`.
 *
 * La jerarquía se hace con **peso y aire**, no con tamaños. La hoja es
 * monoespaciada y de medida angosta: un título a 22 puntos partiría en tres
 * renglones y rompería el ritmo vertical que sostiene toda la nota. En negrita
 * y con espacio arriba se lee como título igual, y la página sigue siendo una
 * página.
 */
export default function TextoMarkdown({ lineas, color = INK.title, size = 15 }) {
  return (
    <View>
      {lineas.map((l, i) => (
        <Linea key={i} linea={l} primera={i === 0} color={color} size={size} />
      ))}
    </View>
  );
}

function Linea({ linea, primera, color, size }) {
  const { tipo, piezas, marca } = linea;

  if (tipo === 'regla') {
    return <View style={{ height: 1, backgroundColor: REGLA, marginVertical: 12 }} />;
  }

  // Una línea en blanco es un espacio entre párrafos, no un renglón vacío de la
  // altura de una línea de texto: a media respuesta eso deja huecos enormes.
  if (!piezas.length || !piezas.some((p) => p.t.trim())) {
    return <View style={{ height: primera ? 0 : 10 }} />;
  }

  const base = {
    fontFamily: MONO,
    fontSize: tipo === 'titulo' ? size + 0.5 : size,
    lineHeight: Math.round((tipo === 'titulo' ? size + 0.5 : size) * 1.8),
    color,
  };

  const contenido = (
    <Text style={base}>
      {piezas.map((p, i) => (
        <Text
          key={i}
          style={{
            fontWeight: p.negrita || tipo === 'titulo' ? '700' : '400',
            fontStyle: p.cursiva ? 'italic' : 'normal',
            ...(p.codigo ? { backgroundColor: FONDO_CODIGO } : null),
          }}
        >
          {p.t}
        </Text>
      ))}
    </Text>
  );

  if (tipo === 'lista') {
    return (
      <View style={{ flexDirection: 'row', marginTop: 2 }}>
        {/* Ancho fijo para la marca: sin él, «1.» y «10.» arrancan el texto en
            columnas distintas y la lista se ve torcida. */}
        <Text style={[base, { width: marca ? 26 : 16, color: TENUE }]}>{marca || '·'}</Text>
        <View style={{ flex: 1 }}>{contenido}</View>
      </View>
    );
  }

  if (tipo === 'cita') {
    return (
      <View style={{ paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: REGLA, marginTop: 6 }}>
        {contenido}
      </View>
    );
  }

  if (tipo === 'codigo') {
    return (
      <View style={{ backgroundColor: FONDO_CODIGO, paddingHorizontal: 8, paddingVertical: 2 }}>
        <Text style={[base, { fontSize: size - 1.5 }]}>{piezas.map((p) => p.t).join('')}</Text>
      </View>
    );
  }

  return <View style={{ marginTop: tipo === 'titulo' && !primera ? 14 : 0 }}>{contenido}</View>;
}
