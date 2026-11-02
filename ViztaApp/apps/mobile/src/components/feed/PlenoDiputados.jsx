import { useMemo, useState } from 'react';
import { Modal, Pressable, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Image } from 'expo-image';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';
import { CalendarOff, ChevronDown, ChevronUp, CircleCheck, CircleDashed, CircleX, X } from 'lucide-react-native';
import { INK, SERIF } from '../theme';
import { traerVotos } from './congreso';
import { DISTRITOS, LISTADO_NACIONAL, VISTA_GUATEMALA, distritoEn } from './distritosGuatemala';
import {
  COLOR_BANCADA,
  COLOR_OTRA,
  COLOR_VOTO,
  ORDEN_VOTO,
  asignarCurules,
  bancadasDeLaVotacion,
  claveNombre,
  colorBancada,
  iniciales,
  nombreBancada,
  ordenBancadas,
  porDistrito,
  traerDiputados,
  votosUnicos,
} from './diputados';

const TINTA = '#2F4A7A';
const RAYA = 'rgba(28,43,34,0.09)';

const NOMBRE_VOTO = { favor: 'A favor', contra: 'En contra', ausente: 'Ausente', licencia: 'Con licencia' };
const PLURAL_VOTO = { favor: 'a favor', contra: 'en contra', ausente: 'ausentes', licencia: 'con licencia' };
const ICONO_VOTO = { favor: CircleCheck, contra: CircleX, ausente: CircleDashed, licencia: CalendarOff };

export function useDiputados({ enabled = true } = {}) {
  return useQuery({ queryKey: ['congreso-diputados'], queryFn: traerDiputados, enabled, staleTime: 6 * 60 * 60 * 1000 });
}

/** El voto, en un ícono con su color. */
export function IconoVoto({ voto, size = 15 }) {
  const Icono = ICONO_VOTO[voto];
  return Icono ? <Icono size={size} color={COLOR_VOTO[voto]} accessibilityLabel={NOMBRE_VOTO[voto]} /> : null;
}

/** La foto del diputado; sin foto, sus iniciales. El anillo es el color de su bancada. */
export function FotoDiputado({ diputado, size = 34, anillo = false }) {
  const [fallo, setFallo] = useState(false);
  // `anillo` en true es el color de su bancada; un color, ese color (p. ej. el de su voto).
  const borde = anillo ? { borderWidth: 2, borderColor: anillo === true ? colorBancada(diputado.sigla) : anillo } : null;
  const caja = { width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: 'rgba(28,43,34,0.06)', ...borde };
  if (!diputado.foto || fallo) {
    return (
      <View style={[caja, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ fontSize: size * 0.34, fontWeight: '700', color: INK.meta }}>{iniciales(diputado.nombre)}</Text>
      </View>
    );
  }
  return (
    <View style={caja}>
      <Image source={{ uri: diputado.foto }} style={{ width: '100%', height: '100%' }} contentFit="cover" contentPosition="top" onError={() => setFallo(true)} accessible={false} />
    </View>
  );
}

/**
 * La ficha de un diputado: aparece sobre la pantalla al tocarlo, con su foto,
 * su bancada y su distrito, y —en una votación— cómo votó.
 */
export function FichaDiputado({ diputado, voto, onCerrar }) {
  return (
    <Modal visible={!!diputado} transparent animationType="none" onRequestClose={onCerrar}>
      {diputado ? (
        <Animated.View entering={FadeIn.duration(140)} style={{ flex: 1, backgroundColor: 'rgba(16,22,30,0.32)', justifyContent: 'center', padding: 28 }}>
          <Pressable style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} onPress={onCerrar} accessibilityRole="button" accessibilityLabel="cerrar la ficha" />
          <Animated.View entering={ZoomIn.springify().damping(16).stiffness(220)}
            style={{ backgroundColor: '#FBFAF7', borderRadius: 22, padding: 18, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } }}>
            <Pressable onPress={onCerrar} hitSlop={12} accessibilityRole="button" accessibilityLabel="cerrar" style={{ position: 'absolute', top: 12, right: 12, padding: 4 }}>
              <X size={18} color={INK.meta} />
            </Pressable>
            <FotoDiputado diputado={diputado} size={112} anillo />
            <Text style={{ fontFamily: SERIF, fontSize: 22, lineHeight: 26, color: INK.title, textAlign: 'center', marginTop: 14 }}>{diputado.nombre}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colorBancada(diputado.sigla) }} />
              <Text style={{ fontSize: 13, color: INK.body }}>{[nombreBancada(diputado.sigla), diputado.distrito].filter(Boolean).join(' · ')}</Text>
            </View>
            {voto ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(28,43,34,0.05)' }}>
                <IconoVoto voto={voto} size={16} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: INK.title }}>{NOMBRE_VOTO[voto]}</Text>
              </View>
            ) : null}
          </Animated.View>
        </Animated.View>
      ) : null}
    </Modal>
  );
}

/**
 * Las 160 curules, cada una con su diputado. `colorDe(diputado)` la pinta; al
 * tocar cerca de una curul se elige la más cercana (son demasiado chicas para
 * acertarles con el dedo).
 */
export function HemicicloDiputados({ curules, colorDe, onTocar, atenuar, ancho = 300 }) {
  const [elegido, setElegido] = useState(null);
  const alto = ancho / 2 + 6;
  const R = ancho / 2 - 6;
  const puntos = useMemo(() => curules.map((c) => ({ ...c, px: ancho / 2 + c.x * R, py: alto - 5 - c.y * R })), [curules, ancho, alto, R]);
  const tocar = (e) => {
    const { locationX: x, locationY: y } = e.nativeEvent;
    let cerca = null;
    let mejor = Infinity;
    for (const p of puntos) {
      const d = (p.px - x) ** 2 + (p.py - y) ** 2;
      if (d < mejor) { mejor = d; cerca = p; }
    }
    if (!cerca || mejor > (ancho / 18) ** 2) return;
    setElegido(cerca.diputado.id);
    onTocar?.(cerca.diputado);
  };
  return (
    <Pressable onPress={tocar} accessibilityRole="image" accessibilityLabel="hemiciclo del Congreso, toca una curul para ver al diputado">
      <Svg width={ancho} height={alto} pointerEvents="none">
        {puntos.map((p) => (
          <Circle key={p.diputado.id} cx={p.px} cy={p.py} r={ancho / 96} fill={colorDe(p.diputado)}
            fillOpacity={atenuar?.(p.diputado) ? 0.18 : 1} stroke={p.diputado.id === elegido ? INK.title : 'none'} strokeWidth={1.4} />
        ))}
      </Svg>
    </Pressable>
  );
}

function Punto({ color, texto }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ fontSize: 12, color: INK.body }}>{texto}</Text>
    </View>
  );
}

function Subtitulo({ rotulo, titulo }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 0.9, color: TINTA }}>{rotulo}</Text>
      <Text style={{ fontFamily: SERIF, fontSize: 20, color: INK.title, marginTop: 3 }}>{titulo}</Text>
    </View>
  );
}

/** Las bancadas con color, una por una; las demás, juntas en un punto gris. */
export function LeyendaBancadas({ bancadas }) {
  const conColor = bancadas.filter((b) => COLOR_BANCADA[b.sigla] && b.sigla !== 'IND');
  const otras = bancadas.filter((b) => !COLOR_BANCADA[b.sigla]);
  const ind = bancadas.find((b) => b.sigla === 'IND');
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6, marginTop: 10 }}>
      {conColor.map((b) => <Punto key={b.sigla} color={colorBancada(b.sigla)} texto={`${nombreBancada(b.sigla)} ${b.total}`} />)}
      {otras.length ? <Punto color={COLOR_OTRA} texto={`${otras.length} bancadas más ${otras.reduce((s, b) => s + b.total, 0)}`} /> : null}
      {ind ? <Punto color={colorBancada('IND')} texto={`Independientes ${ind.total}`} /> : null}
    </View>
  );
}

/**
 * Los diputados en el Explora del Congreso: el hemiciclo por bancada y el mapa
 * de quién representa cada distrito.
 */
export default function PlenoDiputados() {
  const { width } = useWindowDimensions();
  const ancho = Math.min(width - 48, 360);
  const diputados = useDiputados();
  const [ficha, setFicha] = useState(null);
  const lista = diputados.data || [];
  const curules = useMemo(() => asignarCurules(lista), [lista]);
  const bancadas = useMemo(() => ordenBancadas(lista), [lista]);

  if (diputados.isLoading) return <Text style={{ color: INK.meta, paddingVertical: 16 }}>Trayendo a los diputados…</Text>;
  if (diputados.isError || !lista.length) {
    return (
      <Pressable onPress={() => diputados.refetch()} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text style={{ color: TINTA }}>No se pudo traer la lista de diputados. Volver a intentar.</Text>
      </Pressable>
    );
  }
  return (
    <View>
      <Subtitulo rotulo={`EL PLENO · ${lista.length} CURULES`} titulo="Hemiciclo por bancada" />
      <View style={{ alignItems: 'center' }}>
        <HemicicloDiputados curules={curules} colorDe={(d) => colorBancada(d.sigla)} onTocar={setFicha} ancho={ancho} />
      </View>
      <LeyendaBancadas bancadas={bancadas} />
      <View style={{ height: 1, backgroundColor: RAYA, marginVertical: 22 }} />
      <Subtitulo rotulo="QUIÉN REPRESENTA QUÉ" titulo="Diputados por distrito" />
      <MapaDiputados diputados={lista} onTocar={setFicha} />
      <FichaDiputado diputado={ficha} onCerrar={() => setFicha(null)} />
    </View>
  );
}

// El tono de un distrito dice cuántos diputados elige.
const [, , VW, VH] = VISTA_GUATEMALA.split(' ').map(Number);
const ASPECTO = VW / VH;
const tono = (n) => (n >= 10 ? 0.85 : n >= 7 ? 0.62 : n >= 4 ? 0.42 : n >= 3 ? 0.26 : 0.14);

/**
 * Los distritos de Guatemala, cada uno con el tono de cuántos diputados elige.
 * Al tocar uno se ven sus diputados; el Listado Nacional, que no es un
 * territorio, va en su propio recuadro.
 */
export function MapaDiputados({ diputados, onTocar }) {
  const grupos = useMemo(() => porDistrito(diputados), [diputados]);
  const [elegido, setElegido] = useState(null);
  const orden = useMemo(() => ordenBancadas(diputados).map((b) => b.sigla), [diputados]);
  const delElegido = (grupos[elegido] || []).slice().sort((a, b) => orden.indexOf(a.sigla) - orden.indexOf(b.sigla) || a.nombre.localeCompare(b.nombre));
  const [caja, setCaja] = useState(null);
  const nacional = (grupos[LISTADO_NACIONAL] || []).length;
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <Pressable onLayout={(e) => setCaja(e.nativeEvent.layout)}
          onPress={(e) => { const n = caja && distritoEn(e.nativeEvent.locationX, e.nativeEvent.locationY, caja.width, caja.height); if (n) setElegido(n); }}
          accessibilityRole="image" accessibilityLabel="mapa de los distritos, toca uno para ver a sus diputados"
          style={{ flex: 1, aspectRatio: ASPECTO }}>
          <Svg width="100%" height="100%" viewBox={VISTA_GUATEMALA} pointerEvents="none">
            {Object.entries(DISTRITOS).map(([nombre, d]) => (
              <Path key={nombre} d={d} fill={`rgba(47,74,122,${tono((grupos[nombre] || []).length)})`}
                stroke={nombre === elegido ? INK.title : '#FBFAF7'} strokeWidth={nombre === elegido ? 0.03 : 0.012} />
            ))}
          </Svg>
        </Pressable>
        <Pressable onPress={() => setElegido(LISTADO_NACIONAL)} accessibilityRole="button" accessibilityLabel={`Listado Nacional, ${nacional} diputados`}
          style={{ width: 76, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 12, borderWidth: 1, alignItems: 'center',
            borderColor: elegido === LISTADO_NACIONAL ? INK.title : 'rgba(28,43,34,0.16)', backgroundColor: `rgba(47,74,122,${tono(nacional)})` }}>
          <Text style={{ fontSize: 22, fontWeight: '700', color: '#fff' }}>{nacional}</Text>
          <Text style={{ fontSize: 11, lineHeight: 14, color: '#fff', textAlign: 'center' }}>Listado Nacional</Text>
        </Pressable>
      </View>
      {elegido ? (
        <RejillaFotos titulo={`${elegido} · ${delElegido.length} ${delElegido.length === 1 ? 'diputado' : 'diputados'}`} personas={delElegido} onTocar={onTocar} />
      ) : (
        <Text style={{ fontSize: 12, color: INK.meta, marginTop: 10 }}>Toca un distrito para ver a sus diputados.</Text>
      )}
    </View>
  );
}

/**
 * Las fotos de un grupo, como en un distrito: cada una con su anillo. Al tocar
 * una se abre su ficha.
 */
export function RejillaFotos({ titulo, personas, anillo = () => true, onTocar, style }) {
  return (
    <View style={[{ marginTop: 14 }, style]}>
      {titulo ? <Text style={{ fontSize: 14, fontWeight: '700', color: INK.title, marginBottom: 10 }}>{titulo}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {personas.map((d) => (
          <Pressable key={`${d.nombre}-${d.voto || ''}`} onPress={() => onTocar?.(d)} accessibilityRole="button"
            accessibilityLabel={[d.nombre, nombreBancada(d.sigla), d.voto ? NOMBRE_VOTO[d.voto] : null].filter(Boolean).join(', ')}>
            <FotoDiputado diputado={d} size={40} anillo={anillo(d)} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** Un diputado en una línea: foto, nombre, bancada y distrito, y su voto. Al tocarlo, la ficha completa. */
function Elegido({ persona, onAbrir }) {
  return (
    <Pressable onPress={onAbrir} accessibilityRole="button" accessibilityLabel={`${persona.nombre}, ${NOMBRE_VOTO[persona.voto] || ''}, abrir ficha`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, padding: 10, borderRadius: 16, backgroundColor: 'rgba(28,43,34,0.04)' }}>
      <FotoDiputado diputado={persona} size={48} anillo />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: INK.title }}>{persona.nombre}</Text>
        <Text style={{ fontSize: 12, color: INK.meta, marginTop: 2 }}>{[nombreBancada(persona.sigla), persona.distrito].filter(Boolean).join(' · ')}</Text>
      </View>
      {persona.voto ? <IconoVoto voto={persona.voto} size={18} /> : null}
    </Pressable>
  );
}

/**
 * Cómo votó el pleno, diputado por diputado.
 *
 * Arriba el hemiciclo: cada curul en el mismo lugar que en el hemiciclo
 * general, pintada por su voto, así se ve quién se apartó de su bancada. Se
 * mira por partes, como un distrito en el mapa: una curul muestra a esa
 * persona; un voto («a favor»), las fotos de todos los que votaron así; una
 * bancada, las de los suyos. La ficha completa queda para quien la abra.
 */
export function VotosDelPleno({ votacionId }) {
  const { width } = useWindowDimensions();
  const ancho = Math.min(width - 48, 340);
  const votos = useQuery({ queryKey: ['congreso-votos', votacionId], queryFn: () => traerVotos(votacionId), staleTime: 60 * 60 * 1000 });
  const diputados = useDiputados();
  const [ficha, setFicha] = useState(null);
  // { curul: persona } | { voto: 'favor' } | { sigla: 'VAMOS' } | null
  const [vista, setVista] = useState(null);
  const unicos = useMemo(() => votosUnicos(votos.data || []), [votos.data]);
  const curules = useMemo(() => asignarCurules(diputados.data || []), [diputados.data]);
  const bancadas = useMemo(() => bancadasDeLaVotacion(unicos, diputados.data || []), [unicos, diputados.data]);
  const personas = useMemo(() => bancadas.flatMap((b) => b.personas), [bancadas]);

  if (votos.isLoading || diputados.isLoading) return <Text style={{ fontSize: 12, color: INK.faint, marginTop: 12 }}>Trayendo los votos…</Text>;
  if (votos.isError || !unicos.size) return <Text style={{ fontSize: 12, color: INK.faint, marginTop: 12 }}>Los votos de cada diputado no están por ahora.</Text>;

  const votoDe = (d) => unicos.get(claveNombre(d.nombre))?.voto;
  const cuenta = (k) => personas.filter((p) => p.voto === k).length;
  const mayor = bancadas[0]?.total || 1;
  const alternar = (nueva) => setVista((actual) => (JSON.stringify(actual) === JSON.stringify(nueva) ? null : nueva));
  const atenuar = vista?.voto ? (d) => votoDe(d) !== vista.voto
    : vista?.sigla ? (d) => unicos.get(claveNombre(d.nombre))?.sigla !== vista.sigla
      : null;
  return (
    <View style={{ marginTop: 14 }}>
      {curules.length ? (
        <View style={{ alignItems: 'center' }}>
          <HemicicloDiputados curules={curules} colorDe={(d) => COLOR_VOTO[votoDe(d)] || 'rgba(28,43,34,0.06)'} atenuar={atenuar}
            onTocar={(d) => setVista({ curul: { ...d, voto: votoDe(d) } })} ancho={ancho} />
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 10 }}>
        {ORDEN_VOTO.map((k) => (cuenta(k) ? (
          <Pressable key={k} onPress={() => alternar({ voto: k })} accessibilityRole="button" accessibilityState={{ selected: vista?.voto === k }}
            accessibilityLabel={`${cuenta(k)} ${PLURAL_VOTO[k]}, ver sus fotos`}
            style={{ minHeight: 36, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 999, borderWidth: 1,
              borderColor: vista?.voto === k ? COLOR_VOTO[k] : 'transparent', backgroundColor: vista?.voto === k ? 'rgba(28,43,34,0.04)' : 'transparent' }}>
            <Punto color={COLOR_VOTO[k]} texto={`${cuenta(k)} ${PLURAL_VOTO[k]}`} />
          </Pressable>
        ) : null))}
      </View>
      {vista?.curul ? <Elegido persona={vista.curul} onAbrir={() => setFicha(vista.curul)} /> : null}
      {vista?.voto ? (
        <RejillaFotos titulo={`${cuenta(vista.voto)} ${PLURAL_VOTO[vista.voto]}`} personas={personas.filter((p) => p.voto === vista.voto)} onTocar={setFicha} />
      ) : null}
      <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: RAYA }}>
        {bancadas.map((b) => (
          <BancadaVoto key={b.sigla} bancada={b} mayor={mayor} abierta={vista?.sigla === b.sigla}
            onAlternar={() => alternar({ sigla: b.sigla })} onTocar={setFicha} />
        ))}
      </View>
      <FichaDiputado diputado={ficha} voto={ficha?.voto} onCerrar={() => setFicha(null)} />
    </View>
  );
}

/** Una bancada con su barra de votos; abierta, las fotos de los suyos con el anillo de su voto. */
function BancadaVoto({ bancada: b, mayor, abierta, onAlternar, onTocar }) {
  const Flecha = abierta ? ChevronUp : ChevronDown;
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: RAYA }}>
      <Pressable onPress={onAlternar} accessibilityRole="button" accessibilityState={{ expanded: abierta }}
        accessibilityLabel={`${nombreBancada(b.sigla, { plural: true })}, ${b.total}, ${ORDEN_VOTO.filter((k) => b[k]).map((k) => `${b[k]} ${PLURAL_VOTO[k]}`).join(', ')}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colorBancada(b.sigla) }} />
        <Text numberOfLines={1} style={{ width: 98, fontSize: 13, color: INK.title }}>{nombreBancada(b.sigla, { plural: true })}</Text>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', width: `${Math.max(5, (b.total / mayor) * 100)}%` }}>
            {ORDEN_VOTO.map((k) => (b[k] ? <View key={k} style={{ flex: b[k], backgroundColor: COLOR_VOTO[k] }} /> : null))}
          </View>
        </View>
        <Text style={{ width: 24, textAlign: 'right', fontSize: 12, color: INK.faint }}>{b.total}</Text>
        <Flecha size={15} color={INK.faint} />
      </Pressable>
      {abierta ? (
        <RejillaFotos personas={b.personas} anillo={(p) => COLOR_VOTO[p.voto]} onTocar={onTocar} style={{ marginTop: 2, marginBottom: 12 }} />
      ) : null}
    </View>
  );
}
