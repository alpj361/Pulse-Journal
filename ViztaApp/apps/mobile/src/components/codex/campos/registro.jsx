import { Image, Linking, Pressable, Text, View } from 'react-native';
import { Check, ExternalLink, Link2, Mail, Minus, Phone } from 'lucide-react-native';
import { INK, ACCENT, RADIUS, chipStyle } from '../../theme';
import { MONO } from '../mono';
import { formatValue } from '../../../utils/codexSchema';
import FieldInput from '../FieldInput';
import MiniMapa from './MiniMapa';

/**
 * El registro de componentes por tipo de campo.
 *
 * Un solo lugar donde se pregunta «cómo se ve» y «cómo se edita» un campo, en
 * vez de un `switch` para editar y una función de formateo para mostrar,
 * viviendo en archivos distintos y sin saber una de la otra.
 *
 * **Los editores delegan en `FieldInput`.** Ya funcionan; moverlos acá sería
 * mover 667 líneas de código probado para no cambiar nada de lo que hace. Lo
 * que el registro agrega es la otra mitad: hasta ahora **leer un campo era
 * siempre texto**. Un porcentaje decía «25», un booleano decía «Sí», un color
 * decía «#B45309» y una coordenada decía dos números — todos legibles, ninguno
 * mostrando lo que el dato es.
 *
 * **`Viewer` recibe el valor crudo, no formateado.** Un porcentaje necesita el
 * número para dibujar la barra; recibir «25%» obligaría a volver a parsearlo.
 * El texto es el caso por defecto, no el contrato.
 */

const texto = (v) => (v == null || v === '' ? null : String(v));

/** El caso por defecto: lo que había antes, y sigue siendo correcto para la
 *  mayoría de los tipos. */
function VerTexto({ value, type }) {
  const t = typeof value === 'string' ? value : formatValue(value, type);
  if (!t) return null;
  return <Text style={{ fontSize: 14.5, color: INK.title, lineHeight: 21 }}>{t}</Text>;
}

function VerPorcentaje({ value }) {
  const n = Number(typeof value === 'object' ? value?.value : value);
  if (!Number.isFinite(n)) return <VerTexto value={value} />;
  const acotado = Math.max(0, Math.min(100, n));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11 }}>
      <View style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: 'rgba(28,43,34,0.10)', overflow: 'hidden' }}>
        <View style={{ width: `${acotado}%`, height: '100%', backgroundColor: ACCENT.green.ink }} />
      </View>
      <Text style={{ fontFamily: MONO, fontSize: 13, color: INK.title, fontVariant: ['tabular-nums'] }}>
        {acotado}%
      </Text>
    </View>
  );
}

function VerBooleano({ value }) {
  const si = Boolean(value);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View
        style={{
          width: 19,
          height: 19,
          borderRadius: 5,
          borderWidth: 1.5,
          borderColor: si ? ACCENT.green.ink : 'rgba(28,43,34,0.22)',
          backgroundColor: si ? ACCENT.green.ink : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {si ? <Check size={13} color="#FFFDF8" strokeWidth={3} /> : null}
      </View>
      <Text style={{ fontSize: 14.5, color: si ? INK.title : INK.meta }}>{si ? 'Sí' : 'No'}</Text>
    </View>
  );
}

function VerEscala({ value }) {
  const n = Number(value);
  if (!Number.isFinite(n)) return <VerTexto value={value} />;
  return (
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <View
          key={i}
          style={{
            width: 11,
            height: 11,
            borderRadius: 6,
            borderWidth: 1.4,
            borderColor: i <= n ? ACCENT.amber.ink : 'rgba(28,43,34,0.20)',
            backgroundColor: i <= n ? ACCENT.amber.ink : 'transparent',
          }}
        />
      ))}
      <Text style={{ fontFamily: MONO, fontSize: 12, color: INK.meta, marginLeft: 4 }}>{n} de 5</Text>
    </View>
  );
}

/**
 * El eje, con sus dos polos.
 *
 * Los polos vienen del schema y no del valor: el contrato guarda solo
 * `{value}`. Duplicarlos adentro del dato los dejaría desincronizados el día
 * que alguien corrija un nombre en el catálogo.
 */
function VerEje({ value, field }) {
  const n = Number(typeof value === 'object' ? value?.value : value);
  if (!Number.isFinite(n)) return <VerTexto value={value} />;
  const [izq, der] = field?.poles || ['—', '—'];
  // De −100…100 a 0…100 para posicionar el punto.
  const pos = ((Math.max(-100, Math.min(100, n)) + 100) / 200) * 100;

  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 }}>
        <Text style={{ fontFamily: MONO, fontSize: 10.5, color: INK.meta }}>{izq}</Text>
        <Text style={{ fontFamily: MONO, fontSize: 10.5, color: INK.meta }}>{der}</Text>
      </View>
      <View style={{ height: 3, borderRadius: 2, backgroundColor: 'rgba(28,43,34,0.10)', justifyContent: 'center' }}>
        {/* La marca del centro: sin ella no se distingue «neutro» de «sin dato». */}
        <View style={{ position: 'absolute', left: '50%', width: 1, height: 9, backgroundColor: 'rgba(28,43,34,0.18)' }} />
        <View
          style={{
            position: 'absolute',
            left: `${pos}%`,
            marginLeft: -6,
            width: 12,
            height: 12,
            borderRadius: 7,
            backgroundColor: ACCENT.indigo.ink,
            borderWidth: 2,
            borderColor: '#FFFDF8',
          }}
        />
      </View>
      <Text style={{ fontFamily: MONO, fontSize: 12, color: INK.title, marginTop: 9, textAlign: 'center' }}>
        {n > 0 ? `+${n}` : n}
      </Text>
    </View>
  );
}

function VerColor({ value }) {
  const hex = texto(value);
  if (!hex) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 5,
          backgroundColor: hex,
          borderWidth: 1,
          borderColor: 'rgba(28,43,34,0.14)',
        }}
      />
      <Text style={{ fontFamily: MONO, fontSize: 13, color: INK.title }}>{hex}</Text>
    </View>
  );
}

/** Enlace, correo y teléfono comparten forma: el dato y qué hacer con él. */
function accionable(Icono, prefijo, transformar) {
  return function VerAccionable({ value }) {
    const v = texto(value);
    if (!v) return null;
    const destino = prefijo ? `${prefijo}${transformar ? transformar(v) : v}` : v;
    // El dominio dice más que la URL entera: nadie lee un query string.
    const visible = prefijo ? v : v.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return (
      <Pressable
        onPress={() => Linking.openURL(destino).catch(() => {})}
        accessibilityRole="link"
        accessibilityLabel={v}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, opacity: pressed ? 0.5 : 1 })}
      >
        <Icono size={14} color={ACCENT.amber.ink} />
        <Text numberOfLines={1} style={{ flex: 1, fontSize: 14.5, color: ACCENT.amber.ink }}>
          {visible}
        </Text>
      </Pressable>
    );
  };
}

function VerTags({ value }) {
  const lista = Array.isArray(value) ? value : texto(value) ? [texto(value)] : [];
  if (!lista.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {lista.map((t, i) => (
        <View key={`${t}-${i}`} style={chipStyle(ACCENT.neutral.tint, 'rgba(28,43,34,0.10)')}>
          <Text style={{ fontSize: 11.5, color: INK.body }}>{String(t)}</Text>
        </View>
      ))}
    </View>
  );
}

function VerDropdown({ value }) {
  const v = texto(value);
  if (!v) return null;
  return (
    <View style={{ flexDirection: 'row' }}>
      <View style={chipStyle(ACCENT.neutral.tint, 'rgba(28,43,34,0.10)')}>
        <Text style={{ fontSize: 12.5, color: INK.title }}>{v}</Text>
      </View>
    </View>
  );
}

function VerGeo({ value }) {
  const lat = Number(value?.lat);
  const lng = Number(value?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return <VerTexto value={value} />;
  return <MiniMapa lat={lat} lng={lng} />;
}

/**
 * Referencias, archivos e imágenes.
 *
 * Muestran lo que tengan a mano y **nunca el UUID**. La resolución a nombre,
 * tipo y miniatura es el `ReferenceResolver`, que todavía no existe; hasta
 * entonces esto dice honestamente que hay algo vinculado sin fingir saber qué.
 *
 * **Un campo `ref` no siempre guarda un objeto.** La mayoría de los items
 * importados de datasets traen el nombre en texto plano —«Partido»: «Vamos por
 * una Guatemala Diferente - VAMOS»— porque se llenaron antes de que el campo
 * fuera una referencia. Ese texto es el dato que la persona escribió y se lee
 * perfectamente; leerlo como objeto vacío y contestar «Referencia no
 * disponible» borra de la pantalla algo que sí está guardado. Se muestra el
 * texto tal cual, sin la pastilla de vínculo, que sería mentir sobre que
 * apunta a una ficha.
 */
/** Un valor que es una imagen en sí: la URL de una foto, no el nombre de algo. */
const esImagen = (v) => typeof v === 'string' && /^https?:\/\//.test(v);

function VerReferencia({ value, type }) {
  const lista = Array.isArray(value) ? value : value || value === 0 ? [value] : [];
  if (!lista.length) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {lista.map((r, i) => {
        const suelto = typeof r !== 'object' || r === null;
        const nombre = suelto ? texto(r) : r.name || r.nombre || r.label || r.titulo || null;
        if (!nombre && !r?.id) return null;

        // Un campo `imagen` cuyo valor es una URL se mira, no se lee: la foto
        // de un actor escrita como «https://congreso.gob.gt/assets/…» ocupa dos
        // renglones para no mostrar nada.
        if (type === 'imagen' && esImagen(suelto ? r : r.url)) {
          return (
            <Image
              key={r?.id || i}
              source={{ uri: suelto ? r : r.url }}
              style={{
                width: 76, height: 76, borderRadius: 12,
                backgroundColor: 'rgba(28,43,34,0.06)',
                borderWidth: 1, borderColor: 'rgba(28,43,34,0.10)',
              }}
            />
          );
        }
        // Los dos casos van en pastilla —es un campo de referencia, no un
        // párrafo—, pero no en la misma: el texto suelto usa la pastilla neutra
        // del catálogo (la de dropdown y tags) y no lleva eslabón, porque no
        // apunta a ninguna ficha. El color y el ícono son la diferencia.
        if (suelto) {
          return (
            <View key={i} style={chipStyle(ACCENT.neutral.tint, 'rgba(28,43,34,0.10)')}>
              <Text style={{ fontSize: 12.5, color: INK.title }}>{nombre}</Text>
            </View>
          );
        }
        // Una referencia apunta a otra ficha, y eso tiene que verse sin leer:
        // pastilla y eslabón. Al lado del texto plano de la línea de arriba, la
        // diferencia entre «acá dice VAMOS» y «acá está VAMOS» queda a la vista.
        return (
          <View
            key={r.id || i}
            style={{
              ...chipStyle(ACCENT.indigo.tint, 'rgba(99,102,241,0.22)'),
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Link2 size={11} color={ACCENT.indigo.ink} />
            <Text style={{ fontSize: 12, fontWeight: '600', color: ACCENT.indigo.ink }}>
              {nombre || 'vinculado'}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** El editor de cualquier tipo: lo que ya existía. */
const Editor = (props) => <FieldInput {...props} />;

/**
 * El registro.
 *
 * Cada entrada nombra solo lo que se aparta del caso por defecto. Un tipo que
 * no está acá se muestra como texto y se edita con `FieldInput`, que es
 * exactamente lo que hacía antes — la migración no rompe nada por omisión.
 */
export const registroCampos = {
  porcentaje: { Viewer: VerPorcentaje, Editor },
  booleano: { Viewer: VerBooleano, Editor },
  escala: { Viewer: VerEscala, Editor },
  eje: { Viewer: VerEje, Editor },
  color: { Viewer: VerColor, Editor },
  link: { Viewer: accionable(ExternalLink, '', null), Editor },
  email: { Viewer: accionable(Mail, 'mailto:', null), Editor },
  telefono: { Viewer: accionable(Phone, 'tel:', (v) => v.replace(/\s/g, '')), Editor },
  tags: { Viewer: VerTags, Editor },
  dropdown: { Viewer: VerDropdown, Editor },
  geo: { Viewer: VerGeo, Editor },
  ref: { Viewer: VerReferencia, Editor },
  refs: { Viewer: VerReferencia, Editor },
  archivo: { Viewer: VerReferencia, Editor },
  imagen: { Viewer: VerReferencia, Editor },
};

export const componenteDe = (type) => registroCampos[type] || { Viewer: VerTexto, Editor };
