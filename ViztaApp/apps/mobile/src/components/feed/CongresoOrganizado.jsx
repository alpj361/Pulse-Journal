import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Sticker from '../Sticker';
import { INK } from '../theme';
import { SECCIONES, diaCorto, organizar, traerLeyes } from './congreso';
import { Camino, Origen, RAYA, Rotulo, TINTA, Titulo, VotacionCongreso, cabezaDe, rotuloDe } from './TarjetasCongreso';

/**
 * Lo del Congreso de la semana, ordenado por lo que es.
 *
 * El tablero cuenta los días en el orden en que pasaron; esto junta lo mismo
 * por tema: iniciativas, comisiones, pleno, fiscalización y leyes. Una
 * iniciativa que salió varias veces es una sola entrada, con su etapa más
 * avanzada y los días en que se movió.
 */
export default function CongresoOrganizado({ dias, onAbrir }) {
  const secciones = useMemo(() => organizar(dias), [dias]);
  const { data: leyes = [] } = useQuery({ queryKey: ['congreso-leyes'], queryFn: traerLeyes, staleTime: 6 * 60 * 60 * 1000 });
  // Qué sección se mira: ninguna elegida es todas.
  const [elegida, setElegida] = useState(null);
  const [abierto, setAbierto] = useState(true);

  const cuantas = (clave) => (secciones[clave] || []).length + (clave === 'leyes' ? leyes.length : 0);
  const disponibles = SECCIONES.filter(([clave]) => cuantas(clave) > 0);

  return (
    <View style={{ marginTop: 14 }}>
      <Burbujas
        secciones={disponibles}
        cuantas={(clave) => (secciones[clave] || []).length}
        elegida={elegida}
        onElegir={(clave) => setElegida((antes) => (antes === clave ? null : clave))}
        abierto={abierto}
        onAbrir={() => setAbierto((x) => !x)}
      />
      {SECCIONES.map(([clave, nombre]) => {
        if (elegida && elegida !== clave) return null;
        const lista = secciones[clave] || [];
        const publicadas = clave === 'leyes' ? leyes : [];
        if (!lista.length && !publicadas.length) return null;
        return (
          <View key={clave} style={{ marginBottom: 26 }}>
            {/* Con una sola sección elegida, su nombre ya está en la burbuja. */}
            {elegida ? null : (
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', letterSpacing: 1.1, color: INK.title }}>{nombre.toUpperCase()}</Text>
                {lista.length ? <Text style={{ fontSize: 12, color: INK.faint }}>{lista.length}</Text> : null}
              </View>
            )}
            {clave === 'votaciones'
              ? lista.map((v) => (
                  <View key={v.id}>
                    <Text style={{ fontSize: 11, color: INK.faint, marginTop: 12, marginBottom: -8, textAlign: 'right' }}>{diaCorto(v.fecha)}</Text>
                    <VotacionCongreso votacion={v} compacta />
                  </View>
                ))
              : lista.map((item, i) => (
              <Entrada key={item.id} item={item} conCamino={clave === 'iniciativas'} ultima={i === lista.length - 1 && !publicadas.length} onPress={() => onAbrir(item)} />
                ))}
            {publicadas.length ? <Publicadas leyes={publicadas} /> : null}
          </View>
        );
      })}
    </View>
  );
}

function Entrada({ item, conCamino, ultima, onPress }) {
  const { titulo, resumen } = cabezaDe(item);
  const rotulo = rotuloDe(item);
  const pasos = item._pasos || [];
  // Los días en que se movió, sin repetir: «lun 6 · jue 8 · lun 12».
  const dias = [...new Set(pasos.map((p) => p.fecha))].map(diaCorto);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({ paddingVertical: 14, borderBottomWidth: ultima ? 0 : 1, borderBottomColor: RAYA, opacity: pressed ? 0.6 : 1 })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flex: 1 }}>{rotulo ? <Rotulo>{rotulo}</Rotulo> : null}</View>
        <Text style={{ fontSize: 11, color: INK.faint, marginBottom: 5 }}>{dias.join(' · ')}</Text>
      </View>
      <Titulo>{titulo}</Titulo>
      {conCamino ? <Camino etapa={item.stage} /> : null}
      {resumen ? (
        <Text numberOfLines={2} style={{ fontSize: 13, color: INK.body, lineHeight: 19, marginTop: 7 }}>
          {resumen}
        </Text>
      ) : null}
      <Origen item={item} />
    </Pressable>
  );
}

/** Lo último publicado como ley o acuerdo, del registro de normas. */
function Publicadas({ leyes }) {
  return (
    <View style={{ marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: RAYA }}>
      <Rotulo color={INK.faint}>LO ÚLTIMO PUBLICADO</Rotulo>
      {leyes.map((ley) => (
        <View key={ley.id} style={{ paddingVertical: 9 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: TINTA }}>{ley.decreto}</Text>
            {ley.fecha_publicacion ? <Text style={{ fontSize: 11, color: INK.faint }}>{ley.fecha_publicacion}</Text> : null}
          </View>
          <Text numberOfLines={3} style={{ fontSize: 13.5, color: INK.title, lineHeight: 19, marginTop: 3 }}>
            {ley.titulo}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Las secciones como burbujas, para mirar una sola.
 *
 * Plegable: abierto se ven todas con su ícono y cuántas entradas tiene cada
 * una; plegado queda una línea que dice qué se está mirando. Tocar la burbuja
 * elegida otra vez vuelve a mostrar todo.
 */
function Burbujas({ secciones, cuantas, elegida, onElegir, abierto, onAbrir }) {
  const nombreElegida = secciones.find(([clave]) => clave === elegida)?.[1];
  const texto = nombreElegida || 'Todas las secciones';

  // Abierto, los nombres ya están en las burbujas: arriba queda solo la flecha.
  // Plegado, la flecha «escupe» el nombre de lo que se mira, y al abrir se lo
  // vuelve a comer. El texto nace pegado a la flecha, chico y transparente, y
  // se estira hacia la izquierda hasta su ancho.
  const plegado = useSharedValue(abierto ? 0 : 1);
  const [ancho, setAncho] = useState(0);
  useEffect(() => {
    plegado.value = withTiming(abierto ? 0 : 1, { duration: 280, easing: Easing.out(Easing.cubic) });
  }, [abierto, plegado]);

  const caja = useAnimatedStyle(() => ({ width: ancho * plegado.value, marginRight: 6 * plegado.value }));
  const letras = useAnimatedStyle(() => ({
    opacity: plegado.value,
    transform: [{ translateX: (1 - plegado.value) * 18 }, { scale: 0.8 + 0.2 * plegado.value }],
  }));
  const flecha = useAnimatedStyle(() => ({ transform: [{ rotate: `${(1 - plegado.value) * 180}deg` }] }));

  return (
    <View style={{ marginBottom: 18 }}>
      {/* El ancho del texto se mide aparte, sin mostrarse: la caja animada
          necesita saber hasta dónde estirarse. */}
      <Text
        onLayout={(e) => setAncho(Math.ceil(e.nativeEvent.layout.width))}
        style={{ position: 'absolute', opacity: 0, fontSize: 13, fontWeight: '700' }}
        numberOfLines={1}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {texto}
      </Text>
      <Pressable
        onPress={onAbrir}
        accessibilityRole="button"
        accessibilityLabel={abierto ? 'Plegar las secciones' : texto}
        accessibilityState={{ expanded: abierto }}
        hitSlop={10}
        style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 6 }}
      >
        <Animated.View style={[{ overflow: 'hidden', alignItems: 'flex-end' }, caja]}>
          <Animated.Text numberOfLines={1} style={[{ width: ancho, fontSize: 13, fontWeight: '700', color: INK.title }, letras]}>
            {texto}
          </Animated.Text>
        </Animated.View>
        <Animated.View style={flecha}>
          <ChevronDown size={16} color={INK.meta} />
        </Animated.View>
      </Pressable>
      {abierto ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
          {secciones.map(([clave, nombre]) => {
            const activa = elegida === clave;
            const n = cuantas(clave);
            return (
              <Pressable
                key={clave}
                onPress={() => onElegir(clave)}
                accessibilityRole="button"
                accessibilityState={{ selected: activa }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingLeft: 4,
                  paddingRight: 13,
                  paddingVertical: 4,
                  borderRadius: 24,
                  borderWidth: 1,
                  borderColor: activa ? TINTA : 'rgba(28,43,34,0.10)',
                  backgroundColor: activa ? 'rgba(47,74,122,0.08)' : 'rgba(255,255,255,0.7)',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Sticker nombre={clave} size={34} />
                <Text style={{ fontSize: 13, fontWeight: activa ? '700' : '500', color: activa ? TINTA : INK.title }}>{nombre}</Text>
                {n ? <Text style={{ fontSize: 12, color: INK.faint }}>{n}</Text> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
