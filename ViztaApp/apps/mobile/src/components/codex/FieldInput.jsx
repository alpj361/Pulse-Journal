import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Switch, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  interpolateColor,
  FadeIn,
  LinearTransition,
} from 'react-native-reanimated';
import { Check, Plus, X, Search, Minus } from 'lucide-react-native';
import { INK, GLASS } from '../theme';
import MorphingInfinity from '../MorphingInfinity';
import Slider from '@react-native-community/slider';
import { supabase } from '../../utils/supabase';
import CampoFecha from './CampoFecha';
import CampoGeo from './CampoGeo';
import CampoArchivo from './CampoArchivo';

/**
 * Controles por tipo de dato del Codex.
 *
 * Las formas de valor son las de ThePulse (`CxControl.tsx`), no una versión
 * simplificada — un item editado en el teléfono tiene que abrirse bien en la
 * web y al revés:
 *
 *   ref        { id, name, tipo }              refs   RefVal[]
 *   moneda     { amount, cur }                 rango  { from, to, gran? }
 *   eje        { value: -100..100, poles? }    escala number 1..5
 *   repetible  { rows: string[][] }            geo    { lat, lng }
 *   porcentaje decimal 0..1 (se muestra ×100)  tags   string[]
 *
 * `formula` es derivado: se muestra, no se edita.
 */

const RESORTE = { damping: 20, stiffness: 250, mass: 0.5 };

// Campos que ocupan el ancho completo — mismo criterio que CX_WIDE en la web.
export const TIPOS_ANCHOS = new Set(['parrafo', 'eje', 'repetible', 'geo']);

export const inputStyle = {
  backgroundColor: GLASS.fill,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: GLASS.rim,
  paddingHorizontal: 13,
  paddingVertical: 11,
  fontSize: 14,
  color: INK.title,
};

// ─── Piezas con física ────────────────────────────────────────────────────────

/** Pastilla seleccionable: hunde al presionar, tiñe al quedar activa. */
function Pastilla({ activo, accent, onPress, children, compacta }) {
  const press = useSharedValue(0);
  const on = useSharedValue(activo ? 1 : 0);

  useEffect(() => {
    on.value = withSpring(activo ? 1 : 0, RESORTE);
  }, [activo]);

  const estilo = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.05 }],
    backgroundColor: interpolateColor(on.value, [0, 1], ['rgba(28,43,34,0.05)', accent]),
    borderColor: interpolateColor(on.value, [0, 1], ['rgba(28,43,34,0.08)', accent]),
  }));

  const texto = useAnimatedStyle(() => ({
    color: interpolateColor(on.value, [0, 1], [INK.body, '#FFFFFF']),
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        press.value = withTiming(1, { duration: 80 });
      }}
      onPressOut={() => {
        press.value = withSpring(0, RESORTE);
      }}
    >
      <Animated.View
        style={[
          {
            paddingHorizontal: compacta ? 10 : 12,
            paddingVertical: compacta ? 6 : 8,
            borderRadius: 10,
            borderWidth: 1,
          },
          estilo,
        ]}
      >
        <Animated.Text style={[{ fontSize: 12.5, fontWeight: '600' }, texto]}>{children}</Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

/** Escala 1..5 — los puntos se llenan con resorte escalonado. */
function Escala({ value, onChange, accent }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <PuntoEscala
          key={n}
          n={n}
          lleno={(value || 0) >= n}
          accent={accent}
          onPress={() => onChange(value === n ? null : n)}
        />
      ))}
    </View>
  );
}

function PuntoEscala({ n, lleno, accent, onPress }) {
  const on = useSharedValue(lleno ? 1 : 0);
  const press = useSharedValue(0);

  useEffect(() => {
    on.value = withSpring(lleno ? 1 : 0, { ...RESORTE, stiffness: 200 + n * 20 });
  }, [lleno]);

  const estilo = useAnimatedStyle(() => ({
    transform: [{ scale: (1 - press.value * 0.12) * interpolate(on.value, [0, 1], [0.88, 1]) }],
    backgroundColor: interpolateColor(on.value, [0, 1], ['rgba(28,43,34,0.06)', accent]),
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        press.value = withTiming(1, { duration: 70 });
      }}
      onPressOut={() => {
        press.value = withSpring(0, RESORTE);
      }}
      style={{ flex: 1 }}
    >
      <Animated.View style={[{ height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, estilo]}>
        <Text style={{ fontSize: 12.5, fontWeight: '700', color: lleno ? '#FFFFFF' : INK.faint }}>{n}</Text>
      </Animated.View>
    </Pressable>
  );
}

/**
 * Eje: deslizador continuo de −100 a 100, igual que el `input type="range"`
 * de la web. El valor se escribe mientras se arrastra y conserva `poles` si
 * el dato ya los traía.
 */
function Eje({ value, poles, onChange, accent }) {
  const polos = value?.poles ?? poles ?? ['−', '+'];
  const v = typeof value?.value === 'number' ? value.value : 0;

  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
        <Text style={{ fontSize: 11, color: INK.meta, fontWeight: '600' }}>{polos[0]}</Text>
        <Text style={{ fontSize: 12, fontWeight: '800', color: accent }}>
          {v > 0 ? '+' : ''}
          {v}
        </Text>
        <Text style={{ fontSize: 11, color: INK.meta, fontWeight: '600' }}>{polos[1]}</Text>
      </View>
      <Slider
        minimumValue={-100}
        maximumValue={100}
        step={1}
        value={v}
        onValueChange={(n) =>
          onChange({ value: Math.round(n), ...(value?.poles ? { poles: value.poles } : {}) })
        }
        minimumTrackTintColor={accent}
        maximumTrackTintColor="rgba(28,43,34,0.14)"
        thumbTintColor={accent}
        style={{ width: '100%', height: 36 }}
      />
    </View>
  );
}

/** Buscador de referencias contra codex_universe_items. */
function RefPicker({ value, multiple, onChange, accent }) {
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  /**
   * Lo que ya está puesto, venga como venga.
   *
   * Un campo `ref` no siempre guarda `{id, name, tipo}`: los items importados
   * de datasets traen el nombre en texto plano. Leído como objeto, ese texto
   * daba una pastilla sin letras —`r.name` es `undefined`— y encima tapaba el
   * buscador, así que el campo quedaba imposible de corregir: ni se veía lo
   * que había ni se podía poner otra cosa.
   */
  const crudas = Array.isArray(value) ? value : value || value === 0 ? [value] : [];
  const seleccionadas = crudas
    .map((v) =>
      v && typeof v === 'object'
        ? { id: v.id || null, name: v.name || v.nombre || v.label || v.titulo || null, tipo: v.tipo || null }
        : { id: null, name: String(v), tipo: null }
    )
    .filter((r) => r.id || r.name);

  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) {
      setResultados([]);
      return;
    }
    let vivo = true;
    setBuscando(true);
    const timer = setTimeout(async () => {
      // Sin tildes ni mayúsculas, por nombre y alias, y ordenado: primero lo
      // exacto, después lo que empieza así. Antes era un `ilike` sin orden:
      // «Raices» no encontraba «RAÍCES», y aunque se escribiera con tilde, la
      // entidad quedaba afuera de los 8 primeros detrás de posts y notas que
      // la nombraban. Posts, notas y hechos no se ofrecen: un campo de
      // referencia apunta a algo del mundo, no a algo que lo menciona.
      const { data } = await supabase.rpc('buscar_codex_para_referencia', { p_q: t, p_limite: 10 });
      if (!vivo) return;
      setResultados(data || []);
      setBuscando(false);
    }, 280);
    return () => {
      vivo = false;
      clearTimeout(timer);
    };
  }, [q]);

  const agregar = (item) => {
    // Shape de ThePulse: { id, name, tipo }. Al guardar se recorta a `{ id }`,
    // que es lo único que el contrato acepta; el nombre vive acá para la
    // pastilla y para que la ficha lo muestre sin esperar a releer del backend.
    const ref = { id: item.id, name: item.name, tipo: item.tipo };
    onChange(multiple ? [...crudas.filter((r) => r?.id !== ref.id), ref] : ref);
    setQ('');
    setResultados([]);
  };

  // Por posición y no por id: un valor viejo en texto plano no tiene id, y
  // filtrar por `undefined` los quitaba todos de una.
  const quitar = (i) => {
    if (multiple) onChange(crudas.filter((_, j) => j !== i));
    else onChange(null);
  };

  return (
    <View>
      {seleccionadas.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {seleccionadas.map((r, i) => (
            <Animated.View key={r.id || `t${i}`} entering={FadeIn.duration(180)} layout={LinearTransition.springify()}>
              <Pressable
                onPress={() => quitar(i)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 9,
                  backgroundColor: `${accent}14`,
                  borderWidth: 1,
                  borderColor: `${accent}33`,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: accent }}>{r.name || 'vinculado'}</Text>
                <X size={11} color={accent} />
              </Pressable>
            </Animated.View>
          ))}
        </View>
      ) : null}

      {/* El buscador sigue a la vista mientras lo puesto no sea un vínculo de
          verdad: con un nombre en texto plano, esconderlo dejaba el campo sin
          manera de corregirse. */}
      {multiple || seleccionadas.length === 0 || !seleccionadas[0].id ? (
        <View style={[inputStyle, { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9 }]}>
          <Search size={14} color={INK.faint} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Buscar en el universo…"
            placeholderTextColor={INK.faint}
            style={{ flex: 1, fontSize: 13.5, color: INK.title, padding: 0 }}
          />
          {buscando ? <MorphingInfinity size={18} color={INK.faint} /> : null}
        </View>
      ) : null}

      {resultados.length > 0 ? (
        <Animated.View
          entering={FadeIn.duration(160)}
          style={{
            marginTop: 6,
            backgroundColor: '#FFFFFF',
            borderRadius: 12,
            borderWidth: 1,
            borderColor: 'rgba(28,43,34,0.08)',
            overflow: 'hidden',
          }}
        >
          {resultados.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => agregar(r)}
              style={({ pressed }) => ({
                paddingHorizontal: 12,
                paddingVertical: 10,
                backgroundColor: pressed ? 'rgba(28,43,34,0.05)' : 'transparent',
              })}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: INK.title }}>{r.name}</Text>
              {/* Si apareció por un alias, se dice: «Patty» encontrando a
                  «Ana Patricia Orantes» se lee como un error hasta que se ve por qué. */}
              <Text style={{ fontSize: 10.5, color: INK.faint, marginTop: 1 }}>
                {r.por_alias ? `${r.tipo} · «${r.por_alias}»` : r.tipo}
              </Text>
            </Pressable>
          ))}
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Tabla repetible — { rows: string[][] } con las columnas del preset. */
function Repetible({ value, cols = [], onChange, accent }) {
  const rows = value?.rows || [];

  const setCelda = (ri, ci, texto) => {
    const next = rows.map((r, i) => (i === ri ? r.map((c, j) => (j === ci ? texto : c)) : r));
    onChange({ rows: next });
  };

  return (
    <View>
      {rows.map((r, ri) => (
        <Animated.View
          key={ri}
          entering={FadeIn.duration(180)}
          layout={LinearTransition.springify()}
          style={{ flexDirection: 'row', gap: 5, marginBottom: 6, alignItems: 'center' }}
        >
          {cols.map((c, ci) => (
            <TextInput
              key={c}
              value={r[ci] ?? ''}
              onChangeText={(t) => setCelda(ri, ci, t)}
              placeholder={c}
              placeholderTextColor={INK.faint}
              style={[inputStyle, { flex: 1, paddingVertical: 9, fontSize: 12.5 }]}
            />
          ))}
          <Pressable
            onPress={() => onChange({ rows: rows.filter((_, i) => i !== ri) })}
            hitSlop={8}
            style={{ padding: 4 }}
          >
            <Minus size={14} color={INK.faint} />
          </Pressable>
        </Animated.View>
      ))}

      <Pressable
        onPress={() => onChange({ rows: [...rows, cols.map(() => '')] })}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingVertical: 10,
          borderRadius: 11,
          backgroundColor: pressed ? 'rgba(28,43,34,0.09)' : 'rgba(28,43,34,0.05)',
        })}
      >
        <Plus size={13} color={accent} />
        <Text style={{ fontSize: 12, fontWeight: '700', color: INK.body }}>
          {cols.length ? cols.join(' · ') : 'Fila'}
        </Text>
      </Pressable>
    </View>
  );
}

const COLORES = ['#4B4FA6', '#0E7490', '#15803D', '#B45309', '#9D2A6B', '#6B21A8', '#3F3A38', '#B91C1C'];

// ─── Control ──────────────────────────────────────────────────────────────────

/**
 * Valor guardado que no calza con la forma esperada del tipo — típicamente
 * texto libre que escribió Vizta en un campo estructurado. La web lo muestra
 * en solo lectura en vez de romper; acá igual.
 */
function SoloLectura({ children }) {
  return (
    <View style={[inputStyle, { opacity: 0.75 }]}>
      <Text style={{ fontSize: 14, color: INK.body }}>{children || '—'}</Text>
    </View>
  );
}

/**
 * `contexto` es de quién es el campo: `{ itemId, tipo }`, y al crear también
 * `{ pendientesRostro, onPendienteRostro }`. Casi ningún control lo necesita; la
 * foto de un actor sí, para ofrecer usarla en el reconocimiento.
 */
export default function FieldInput({ field, value, onChange, accent = INK.title, contexto = null }) {
  const { type, options, poles, cols, readonly } = field;

  if (readonly || type === 'formula') {
    return (
      <View style={[inputStyle, { opacity: 0.7 }]}>
        <Text style={{ fontSize: 14, color: INK.body }}>{value == null || value === '' ? '—' : String(value)}</Text>
      </View>
    );
  }

  switch (type) {
    case 'booleano':
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 2 }}>
          <Text style={{ fontSize: 14, color: INK.body }}>{value ? 'Sí' : 'No'}</Text>
          <Switch
            value={!!value}
            onValueChange={onChange}
            trackColor={{ false: 'rgba(28,43,34,0.14)', true: accent }}
            thumbColor="#FFFFFF"
          />
        </View>
      );

    case 'dropdown': {
      const lista = Array.isArray(options) ? options.filter(Boolean) : [];

      /**
       * Sin opciones no hay nada que elegir, y el control quedaba en blanco.
       *
       * Un campo del catálogo trae sus opciones, pero uno creado a mano —o uno
       * cuyo valor llegó bajo una clave que no calza con ninguna definición—
       * llega sin ellas: el `map` sobre una lista vacía dibujaba un `View` de
       * cero alto y el campo parecía roto, sin manera de escribir ni de elegir.
       * Con el texto libre al menos se puede poner el valor; el aviso dice por
       * qué no hay pastillas.
       */
      if (!lista.length) {
        return (
          <View style={{ gap: 6 }}>
            <TextInput
              value={value == null ? '' : String(value)}
              onChangeText={(t) => onChange(t === '' ? null : t)}
              placeholder="Escribí el valor"
              placeholderTextColor={INK.faint}
              style={inputStyle}
            />
            <Text style={{ fontSize: 11.5, color: INK.faint }}>
              Este campo todavía no tiene opciones definidas.
            </Text>
          </View>
        );
      }

      return (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {lista.map((op) => (
            <Pastilla key={op} activo={value === op} accent={accent} onPress={() => onChange(value === op ? null : op)}>
              {op}
            </Pastilla>
          ))}
          {/* Un valor que no está entre las opciones existe igual —lo puso el
              análisis, o cambió el catálogo— y esconderlo haría creer que el
              campo está vacío. Se muestra marcado y se puede quitar. */}
          {value != null && value !== '' && !lista.includes(value) ? (
            <Pastilla activo accent={accent} onPress={() => onChange(null)}>
              {String(value)}
            </Pastilla>
          ) : null}
        </View>
      );
    }

    case 'fecha':
      return <CampoFecha value={value} onChange={onChange} accent={accent} />;

    case 'escala':
      return <Escala value={value} onChange={onChange} accent={accent} />;

    case 'eje':
      if (typeof value === 'string') return <SoloLectura>{value}</SoloLectura>;
      return <Eje value={value} poles={poles} onChange={onChange} accent={accent} />;

    case 'ref':
      return <RefPicker value={value} onChange={onChange} accent={accent} />;

    case 'refs':
      return <RefPicker value={value} multiple onChange={onChange} accent={accent} />;

    case 'repetible':
      return <Repetible value={value} cols={cols} onChange={onChange} accent={accent} />;

    case 'moneda': {
      // cur = cualquier código ISO de 3 letras (no está fijo a GTQ);
      // amount solo dígitos y separadores de miles.
      if (typeof value === 'string') return <SoloLectura>{value}</SoloLectura>;
      const v = value && typeof value === 'object' ? value : undefined;
      return (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TextInput
            value={v?.cur ?? 'GTQ'}
            onChangeText={(t) =>
              onChange({ cur: t.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3), amount: v?.amount ?? '' })
            }
            placeholder="GTQ"
            placeholderTextColor={INK.faint}
            maxLength={3}
            autoCapitalize="characters"
            style={[inputStyle, { width: 66, textAlign: 'center', fontWeight: '700' }]}
          />
          <TextInput
            value={v?.amount || ''}
            onChangeText={(t) => onChange({ cur: v?.cur || 'GTQ', amount: t.replace(/[^\d.,]/g, '') })}
            placeholder="0"
            placeholderTextColor={INK.faint}
            keyboardType="decimal-pad"
            style={[inputStyle, { flex: 1 }]}
          />
        </View>
      );
    }

    case 'rango': {
      const v = value && typeof value === 'object' ? value : { from: '', to: '' };
      const patch = (p) => onChange({ from: v.from ?? '', to: v.to ?? '', ...(v.gran ? { gran: v.gran } : {}), ...p });
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TextInput
            value={v.from ?? ''}
            onChangeText={(t) => patch({ from: t })}
            placeholder="Inicio"
            placeholderTextColor={INK.faint}
            style={[inputStyle, { flex: 1 }]}
          />
          <Text style={{ fontSize: 13, color: INK.faint }}>→</Text>
          <TextInput
            value={v.to ?? ''}
            onChangeText={(t) => patch({ to: t })}
            placeholder="Fin"
            placeholderTextColor={INK.faint}
            style={[inputStyle, { flex: 1 }]}
          />
        </View>
      );
    }

    case 'geo':
      return <CampoGeo value={value} onChange={onChange} accent={accent} />;

    case 'porcentaje': {
      // Se guarda decimal 0..1 y se muestra ×100, igual que en la web.
      const mostrado = typeof value === 'number' ? String(Math.round(value * 100)) : '';
      const barra = typeof value === 'number' ? Math.max(0, Math.min(100, value * 100)) : 0;
      return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TextInput
            value={mostrado}
            onChangeText={(t) => {
              if (t === '') return onChange(null);
              const n = Math.max(0, Math.min(100, Number(t.replace(/[^0-9]/g, '')) || 0));
              onChange(n / 100);
            }}
            placeholder="0"
            placeholderTextColor={INK.faint}
            keyboardType="number-pad"
            style={[inputStyle, { width: 82, textAlign: 'center' }]}
          />
          <Text style={{ fontSize: 14, color: INK.meta, fontWeight: '600' }}>%</Text>
          <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(28,43,34,0.07)', overflow: 'hidden' }}>
            <View style={{ width: `${barra}%`, height: '100%', backgroundColor: accent, borderRadius: 3 }} />
          </View>
        </View>
      );
    }

    case 'color':
      return (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {COLORES.map((c) => (
            <Pressable key={c} onPress={() => onChange(value === c ? null : c)}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  backgroundColor: c,
                  borderWidth: value === c ? 2.5 : 0,
                  borderColor: '#FFFFFF',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {value === c ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : null}
              </View>
            </Pressable>
          ))}
        </View>
      );

    case 'tags':
      return (
        <TextInput
          value={Array.isArray(value) ? value.join(', ') : value || ''}
          onChangeText={(t) =>
            onChange(
              t
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            )
          }
          placeholder="Separá con comas"
          placeholderTextColor={INK.faint}
          style={inputStyle}
        />
      );

    case 'archivo':
    case 'imagen':
      return (
        <CampoArchivo
          value={value}
          onChange={onChange}
          soloImagen={type === 'imagen'}
          accent={accent}
          // Solo en la foto de un Actor. Si ya existe, el chequecito indexa en
          // el momento; si se está creando, anota la intención y la ficha la
          // cumple al guardar, cuando ya hay a quién asociarle la cara.
          reconocer={
            type === 'imagen' && String(contexto?.tipo || '').toLowerCase() === 'actor'
              ? contexto?.itemId
                ? { actorId: contexto.itemId }
                : contexto?.onPendienteRostro
                  ? { actorId: null, pendientes: contexto.pendientesRostro, onPendiente: contexto.onPendienteRostro }
                  : null
              : null
          }
        />
      );

    default: {
      // Un campo de texto con algo que no es texto —un vínculo, un objeto de
      // cuando el campo era otro tipo— no se dibuja como `[object Object]`:
      // se muestra legible y sin editar, hasta que se le cambie el tipo.
      if (['texto', 'link', 'email', 'telefono', 'id', 'hora'].includes(type) && value != null && typeof value === 'object') {
        const legible = Array.isArray(value)
          ? value.map((v) => (v && typeof v === 'object' ? v.name || v.nombre || JSON.stringify(v) : String(v))).join(', ')
          : value.name || value.nombre || JSON.stringify(value);
        return <SoloLectura>{legible}</SoloLectura>;
      }

      // parrafo: fallback cuando el valor guardado no es string — suele ser un
      // objeto { value, poles } de cuando el campo era `eje`. Sin esto se
      // renderiza "[object Object]".
      if (type === 'parrafo' && value != null && typeof value !== 'string') {
        const texto =
          typeof value.value === 'number'
            ? `${value.value > 0 ? '+' : ''}${value.value}${
                value.poles ? ` (${value.poles[0]} ↔ ${value.poles[1]})` : ''
              }`
            : JSON.stringify(value);
        return <SoloLectura>{texto}</SoloLectura>;
      }

      // numero: solo dígitos, nunca unidades ni texto. Se guarda como number.
      if (type === 'numero') {
        return (
          <TextInput
            value={value != null && value !== '' ? String(value) : ''}
            onChangeText={(t) => {
              const digitos = t.replace(/[^\d]/g, '');
              onChange(digitos === '' ? null : Number(digitos));
            }}
            placeholder="0"
            placeholderTextColor={INK.faint}
            keyboardType="number-pad"
            style={inputStyle}
          />
        );
      }

      // email: marca el borde si el formato no calza, pero no bloquea guardar.
      if (type === 'email') {
        const t = value ?? '';
        const malo = String(t).trim() !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
        return (
          <TextInput
            value={String(t)}
            onChangeText={onChange}
            placeholder="correo@dominio.gt"
            placeholderTextColor={INK.faint}
            keyboardType="email-address"
            autoCapitalize="none"
            style={[inputStyle, malo ? { borderColor: '#E5484D', borderWidth: 1.5 } : null]}
          />
        );
      }

      const multiline = type === 'parrafo';
      const placeholders = {
        texto: 'Texto corto',
        parrafo: 'Texto…',
        fecha: 'AAAA-MM-DD',
        hora: '14:30 · 2h 15m',
        link: 'https://',
        telefono: '+502 0000 0000',
        id: '—',
      };
      return (
        <TextInput
          value={value == null ? '' : String(value)}
          onChangeText={onChange}
          placeholder={placeholders[type] || ''}
          placeholderTextColor={INK.faint}
          multiline={multiline}
          keyboardType={type === 'telefono' ? 'phone-pad' : 'default'}
          autoCapitalize={type === 'link' || type === 'id' ? 'none' : 'sentences'}
          style={[
            inputStyle,
            multiline ? { minHeight: 84, textAlignVertical: 'top', paddingTop: 11 } : null,
            type === 'id' ? { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13 } : null,
          ]}
        />
      );
    }
  }
}
