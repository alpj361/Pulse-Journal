import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Sticker from '../Sticker';
import { INK } from '../theme';
import { organizar, traerArchivoCongreso } from './congreso';
import { BuscadorRegistro, CARD_REGISTRO, CuentaRegistro, ListaIniciativas, ListaLeyes, ListaVotaciones, Paginado, useConteosLegislativos } from './LegislativoCongreso';
import { Origen, RAYA, Rotulo, TINTA, Titulo, cabezaDe, rotuloDe } from './TarjetasCongreso';
import FiltroChips from './FiltroChips';
import { buscarRegistro, fechaRegistro, periodoDe } from './organizacion';

const REGISTROS = [['iniciativas', 'Iniciativas'], ['leyes', 'Leyes y decretos'], ['votaciones', 'Votaciones']];
const ACTIVIDAD = [['comisiones', 'Comisiones y citaciones'], ['pleno', 'Pleno y sesiones'], ['fiscalizacion', 'Fiscalización y actividad']];
const NOMBRES = Object.fromEntries([...REGISTROS, ...ACTIVIDAD]);

/** Distingue los registros disponibles de la cobertura de noticias por período. */
export default function CongresoOrganizado({ dias, onAbrir, onPagina }) {
  const [elegida, setElegida] = useState(null);
  const [abierto, setAbierto] = useState(true);
  const [alcance, setAlcance] = useState('reciente');
  const anclaSeccion = useRef(null);
  const registro = useConteosLegislativos();
  const archivo = useQuery({ queryKey: ['congreso-archivo-noticias'], queryFn: traerArchivoCongreso,
    enabled: alcance === 'historial', staleTime: 10 * 60 * 1000 });
  const fuente = alcance === 'historial' ? archivo.data || [] : dias || [];
  const secciones = useMemo(() => organizar(fuente), [fuente]);
  const cuantas = (clave) => REGISTROS.some(([c]) => c === clave) ? registro.data?.[clave] : (secciones[clave] || []).length;
  const elegir = (clave) => { setElegida(clave); setAbierto(false); onPagina?.(anclaSeccion.current); };
  const esRegistro = REGISTROS.some(([c]) => c === elegida);
  const periodo = periodoDe(fuente, 'fecha');
  return (
    <View ref={anclaSeccion} collapsable={false} style={{ marginTop: 14 }}>
      <Pressable onPress={() => setAbierto((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: abierto }}
        accessibilityLabel={abierto ? 'plegar secciones del Congreso' : 'cambiar sección del Congreso'}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, marginBottom: 8 }}>
        {elegida ? <Sticker nombre={elegida} size={30} /> : null}
        <View style={{ flex: 1 }}><Text style={{ fontSize: 15, fontWeight: '700', color: INK.title }}>{elegida ? NOMBRES[elegida] : 'Explorá el Congreso'}</Text>
          {!abierto ? <Text style={{ fontSize: 11, color: INK.meta, marginTop: 2 }}>cambiar sección</Text> : null}</View>
        {abierto ? <ChevronUp size={17} color={INK.meta} /> : <ChevronDown size={17} color={INK.meta} />}
      </Pressable>
      {abierto ? <View style={{ marginBottom: 16 }}>
        <GrupoSecciones titulo="REGISTROS DISPONIBLES" secciones={REGISTROS} cuantas={cuantas} elegida={elegida} onElegir={elegir} />
        {registro.isError ? <Text style={{ color: INK.meta, fontSize: 12 }}>Los conteos aún no están disponibles. Podés abrir cada registro.</Text> : null}
        <GrupoSecciones titulo="NOTICIAS Y ACTIVIDAD" secciones={ACTIVIDAD} cuantas={cuantas} elegida={elegida} onElegir={elegir} />
      </View> : null}
      {elegida === 'iniciativas' ? <ListaIniciativas onPagina={onPagina} /> : null}
      {elegida === 'leyes' ? <ListaLeyes onPagina={onPagina} /> : null}
      {elegida === 'votaciones' ? <ListaVotaciones onPagina={onPagina} /> : null}
      {!esRegistro ? <>
        <FiltroChips valor={alcance} onCambiar={setAlcance} opciones={[
          { clave: 'reciente', nombre: 'últimos días' }, { clave: 'historial', nombre: 'historial disponible' },
        ]} />
        {periodo ? <Text style={{ fontSize: 12, lineHeight: 18, color: INK.meta, marginBottom: 12 }}>{periodo}</Text> : null}
        {alcance === 'historial' && archivo.isLoading ? <Text style={{ color: INK.meta, paddingVertical: 16 }}>Trayendo las noticias anteriores…</Text>
          : alcance === 'historial' && archivo.isError ? <Pressable onPress={() => archivo.refetch()} accessibilityRole="button" style={{ minHeight: 44 }}><Text style={{ color: TINTA }}>No se pudo traer el historial. Volver a intentar.</Text></Pressable>
          : elegida ? <ActividadLista key={`${elegida}-${alcance}`} lista={secciones[elegida] || []} clave={elegida} onAbrir={onAbrir} onPagina={onPagina} />
          : ACTIVIDAD.map(([clave, nombre]) => <View key={clave} style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: INK.title, marginBottom: 6 }}>{nombre} · {(secciones[clave] || []).length}</Text>
              {(secciones[clave] || []).slice(0, 2).map((item) => <Entrada key={item.id} item={item} onAbrir={onAbrir} />)}
              <Pressable onPress={() => elegir(clave)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: TINTA, fontSize: 13 }}>ver esta sección ›</Text></Pressable>
            </View>)}
      </> : null}
    </View>
  );
}

function GrupoSecciones({ titulo, secciones, cuantas, elegida, onElegir }) {
  return <View style={{ marginTop: 8 }}><Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: INK.meta, marginBottom: 8 }}>{titulo}</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {secciones.map(([clave, nombre]) => <Pressable key={clave} onPress={() => onElegir(clave)} accessibilityRole="button"
        accessibilityLabel={`${nombre}${cuantas(clave) == null ? '' : `, ${cuantas(clave)}`}`} accessibilityState={{ selected: elegida === clave }}
        style={{ width: '48%', minHeight: 64, paddingHorizontal: 10, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 7,
          borderRadius: 14, borderWidth: 1, borderColor: elegida === clave ? TINTA : RAYA, backgroundColor: elegida === clave ? 'rgba(47,74,122,0.08)' : 'rgba(255,255,255,0.6)' }}>
        <Sticker nombre={clave} size={28} /><View style={{ flex: 1 }}><Text style={{ fontSize: 12, lineHeight: 16, fontWeight: '600', color: INK.title }}>{nombre}</Text>
          <Text style={{ fontSize: 11, color: INK.meta, marginTop: 3 }}>{cuantas(clave) ?? '…'}</Text></View>
      </Pressable>)}
    </View>
  </View>;
}

export function ActividadLista({ lista, clave, onAbrir, onPagina }) {
  const [texto, setTexto] = useState('');
  const [comision, setComision] = useState('todas');
  const [pagina, setPagina] = useState(1);
  const ancla = useRef(null);
  const comisiones = [...new Set(lista.map((i) => i.comision_name).filter(Boolean))].sort();
  const filas = lista.filter((item) => buscarRegistro(`${item.titulo || ''} ${item.summary || ''} ${item.iniciativa_numero || ''} ${item.comision_name || ''}`, texto) && (comision === 'todas' || item.comision_name === comision));
  const total = Math.max(1, Math.ceil(filas.length / 20));
  const actual = Math.min(pagina, total);
  const cambiar = (n) => { setPagina(n); onPagina?.(ancla.current); };
  return <View>
    <View ref={ancla} collapsable={false}>
      <BuscadorRegistro valor={texto} onCambiar={(v) => { setTexto(v); setPagina(1); }} etiqueta="buscar por tema, iniciativa o comisión" />
      {clave === 'comisiones' && comisiones.length ? <FiltroChips valor={comision} onCambiar={(v) => { setComision(v); setPagina(1); }} opciones={[
        { clave: 'todas', nombre: 'todas las comisiones' }, ...comisiones.map((c) => ({ clave: c, nombre: c.replace(/^Comisi[oó]n de /, '') })),
      ]} /> : null}
    </View>
    {clave === 'fiscalizacion' ? <Text style={{ color: INK.meta, fontSize: 12, lineHeight: 18, marginVertical: 10 }}>Fiscalización, intermediación y otras actividades institucionales.</Text> : null}
    {!filas.length ? <Text style={{ color: INK.meta, paddingVertical: 18 }}>No hay publicaciones para esta búsqueda.</Text> : null}
    <Paginado actual={actual} total={total} onCambiar={cambiar} />
    {filas.slice((actual - 1) * 20, actual * 20).map((item) => <Entrada key={item.id} item={item} onAbrir={onAbrir} />)}
    <CuentaRegistro pagina={actual} cantidad={filas.length} unidad="temas" />
    <Paginado actual={actual} total={total} onCambiar={cambiar} />
  </View>;
}

export function Entrada({ item, onAbrir }) {
  const { titulo, resumen } = cabezaDe(item);
  const [expandido, setExpandido] = useState(false);
  const [relacionadas, setRelacionadas] = useState(false);
  const pasos = item._pasos || [];
  return <View style={CARD_REGISTRO}>
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
      <View style={{ flex: 1 }}>{rotuloDe(item) ? <Rotulo>{rotuloDe(item)}</Rotulo> : null}</View>
      <Text style={{ color: INK.meta, fontSize: 11 }}>{fechaRegistro(item._ultima || item.digest_date)}</Text>
    </View>
    <Titulo>{titulo}</Titulo>
    {resumen ? <><Text numberOfLines={expandido ? undefined : 3} style={{ fontSize: 13.5, color: INK.body, lineHeight: 20, marginTop: 8 }}>{resumen}</Text>
      <Pressable onPress={() => setExpandido((v) => !v)} accessibilityRole="button" accessibilityLabel={`${expandido ? 'cerrar resumen' : 'leer resumen completo'}, ${titulo}`} accessibilityState={{ expanded: expandido }} style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text style={{ fontSize: 12, color: TINTA }}>{expandido ? 'resumir' : 'leer resumen completo'}</Text>
      </Pressable></> : null}
    <Origen item={item} />
    <Pressable onPress={() => onAbrir(item)} accessibilityRole="button" accessibilityLabel={`abrir noticia, ${titulo}`} style={{ minHeight: 44, justifyContent: 'center', marginTop: 4 }}>
      <Text style={{ fontSize: 13, color: TINTA, fontWeight: '600' }}>abrir noticia ›</Text>
    </Pressable>
    {pasos.length > 1 ? <>
      <Pressable onPress={() => setRelacionadas((v) => !v)} accessibilityRole="button" accessibilityLabel={`noticias relacionadas, ${titulo}`} accessibilityState={{ expanded: relacionadas }} style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text style={{ fontSize: 12, color: TINTA }}>{relacionadas ? 'ocultar noticias relacionadas' : `${pasos.length} noticias relacionadas`}</Text>
      </Pressable>
      {relacionadas ? [...pasos].reverse().map((p, i) => <Pressable key={`${p.item.id}-${i}`} onPress={() => onAbrir(p.item)} accessibilityRole="button" accessibilityLabel={`abrir noticia relacionada, ${p.item.titulo}`} style={{ minHeight: 44, paddingVertical: 10, borderTopWidth: 1, borderTopColor: RAYA }}>
        <Text style={{ fontSize: 11, color: INK.meta, marginBottom: 4 }}>{fechaRegistro(p.fecha)}</Text>
        <Text style={{ fontSize: 13, color: INK.title, lineHeight: 18 }}>{cabezaDe(p.item).titulo}</Text>
      </Pressable>) : null}
    </> : null}
  </View>;
}

/**
 * Las secciones como burbujas, para mirar una sola.
 *
 * Plegable: abierto se ven todas con su ícono y cuántas entradas tiene cada
 * una; plegado queda una línea que dice qué se está mirando. Tocar la burbuja
 * elegida otra vez vuelve a mostrar todo.
 */
export function Burbujas({ secciones, cuantas, elegida, onElegir, abierto, onAbrir, icono, todas = 'Todas las secciones' }) {
  const nombreElegida = secciones.find(([clave]) => clave === elegida)?.[1];
  const texto = nombreElegida || todas;

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
                {icono ? icono(clave) : <Sticker nombre={clave} size={34} />}
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
