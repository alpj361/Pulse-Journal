import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Linking, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { BookOpen, ChevronDown, ChevronLeft, ChevronUp, FileText, Pilcrow, Scale, ScrollText, Search, X } from 'lucide-react-native';
import { INK, RADIUS, SERIF } from '../theme';
import { PAPEL } from '../codex/Papel';
import { ROTULO } from '../colaboradores/piezas';
import MorphingInfinity from '../MorphingInfinity';
import { Cristal } from './SelectorFeed';
import FiltroChips from './FiltroChips';
import { RAYA, TINTA } from './TarjetasCongreso';
import { COLUMNAS_INICIATIVA, Iniciativa, limpiarTitulo } from './LegislativoCongreso';
import { normalizar } from './organizacion';
import { supabase } from '../../utils/supabase';
import { roce } from '../../utils/haptics';
import {
  buscarLegal, descripcionDe, enlaceDeNorma, nombreEstado, nombreTipo, recorteAlrededor, separarEncabezado, textoLegible, traerLeyesDeBase, traerNorma,
} from './buscadorLegal';

const ICONO = { ley: Scale, articulo: Pilcrow, iniciativa: ScrollText };
const FILTROS = [
  ['todo', 'todo'],
  ['ley', 'leyes'],
  ['articulo', 'artículos'],
  ['iniciativa', 'iniciativas'],
];

/**
 * El buscador legal, a la par del calendario en el Congreso.
 *
 * Cerrado es una pastilla con un libro y su lupa. Abierto, una hoja con la
 * barra de búsqueda: leyes, artículos e iniciativas a la vez, con lo que
 * coincide en negrita. Una ley se abre con todos sus artículos; un artículo
 * abre su ley parada en él.
 */
export default function BuscadorLegal() {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => { roce(); setAbierto(true); }}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Buscar en leyes, artículos e iniciativas"
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        <Cristal radio={RADIUS.pill}>
          <View style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
            <IconoBuscador />
          </View>
        </Cristal>
      </Pressable>
      {abierto ? <Panel onClose={() => setAbierto(false)} /> : null}
    </>
  );
}

/** Un libro con su lupa: buscar adentro de lo legal. */
function IconoBuscador({ color = INK.meta }) {
  return (
    <View style={{ width: 18, height: 18 }}>
      <BookOpen size={16} color={color} strokeWidth={2.2} />
      <View style={{ position: 'absolute', right: -3, bottom: -3, borderRadius: 7, backgroundColor: 'rgba(255,253,248,0.95)', padding: 1 }}>
        <Search size={9} color={color} strokeWidth={3} />
      </View>
    </View>
  );
}

function Panel({ onClose }) {
  const insets = useSafeAreaInsets();
  const [texto, setTexto] = useState('');
  const [buscado, setBuscado] = useState('');
  const [filtro, setFiltro] = useState('todo');
  const [abierta, setAbierta] = useState(null); // { tipo: 'norma', id, foco } | { tipo: 'iniciativa', numero }

  // Se busca cuando se deja de escribir, no con cada letra.
  useEffect(() => {
    const t = setTimeout(() => setBuscado(texto.trim()), 320);
    return () => clearTimeout(t);
  }, [texto]);

  const busqueda = useQuery({
    queryKey: ['buscador-legal', buscado],
    queryFn: () => buscarLegal(buscado),
    enabled: buscado.length >= 2,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
  const base = useQuery({ queryKey: ['leyes-de-base'], queryFn: traerLeyesDeBase, staleTime: 60 * 60 * 1000 });

  const resultados = buscado.length >= 2 ? busqueda.data?.resultados || [] : [];
  const cuenta = (t) => resultados.filter((r) => r.tipo === t).length;
  const tiposConResultados = new Set(resultados.map((r) => r.tipo)).size;
  // Con un solo tipo de resultado no hay nada que filtrar; y un filtro que
  // quedó sin nada en la búsqueda nueva vuelve a «todo».
  const activo = tiposConResultados > 1 && filtro !== 'todo' && cuenta(filtro) ? filtro : 'todo';
  const visibles = activo === 'todo' ? resultados : resultados.filter((r) => r.tipo === activo);

  const abrir = (r) => {
    roce();
    if (r.tipo === 'iniciativa') setAbierta({ tipo: 'iniciativa', numero: r.numero });
    else setAbierta({ tipo: 'norma', id: r.normaId, foco: r.tipo === 'articulo' ? r.id : null });
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={abierta ? () => setAbierta(null) : onClose}>
      <View style={{ flex: 1, backgroundColor: PAPEL }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 16, paddingHorizontal: 18, minHeight: 44 }}>
          {abierta ? (
            <Pressable onPress={() => { roce(); setAbierta(null); }} hitSlop={12} accessibilityRole="button" accessibilityLabel="Volver a los resultados"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: -6, flex: 1 }}>
              <ChevronLeft size={20} color={INK.meta} />
              <Text style={{ fontSize: 13, color: INK.meta }}>{buscado ? 'resultados' : 'buscador legal'}</Text>
            </Pressable>
          ) : (
            <Text style={[ROTULO, { flex: 1 }]}>BUSCADOR LEGAL</Text>
          )}
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar" style={{ padding: 6 }}>
            <X size={19} color={INK.faint} />
          </Pressable>
        </View>

        {abierta?.tipo === 'norma' ? (
          <Norma key={abierta.id} id={abierta.id} foco={abierta.foco} abajo={insets.bottom} />
        ) : abierta?.tipo === 'iniciativa' ? (
          <IniciativaAbierta numero={abierta.numero} abajo={insets.bottom} />
        ) : (
          <View style={{ flex: 1 }}>
            <View style={{ paddingHorizontal: 18, paddingTop: 8 }}>
              <Barra valor={texto} onCambiar={setTexto} cargando={busqueda.isFetching} autoFocus={!texto} />
              {tiposConResultados > 1 ? (
                <FiltroChips valor={activo} onCambiar={(v) => { roce(); setFiltro(v); }} opciones={FILTROS
                  .map(([clave, nombre]) => ({ clave, nombre, cuenta: clave === 'todo' ? resultados.length : cuenta(clave) }))
                  .filter((o) => o.clave === 'todo' || o.cuenta)} />
              ) : null}
            </View>
            <FlatList
              data={buscado.length >= 2 ? visibles : []}
              keyExtractor={(r) => r.clave}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 32 }}
              ListHeaderComponent={busqueda.data?.amplia && resultados.length && buscado.length >= 2 ? (
                <Text style={{ fontSize: 12.5, color: INK.meta, lineHeight: 18, marginBottom: 6 }}>
                  Ningún texto tiene todas las palabras. Estos tienen alguna.
                </Text>
              ) : null}
              ListEmptyComponent={
                buscado.length < 2 ? (
                  <LeyesDeBase leyes={base.data || []} onAbrir={(n) => { roce(); setAbierta({ tipo: 'norma', id: n.id, foco: null }); }} />
                ) : busqueda.isLoading ? (
                  <View style={{ alignItems: 'center', paddingVertical: 40 }}><MorphingInfinity size={30} color={INK.meta} /></View>
                ) : busqueda.isError ? (
                  <Aviso>No se pudo buscar. Puede intentarse de nuevo.</Aviso>
                ) : (
                  <Aviso>Ninguna ley, artículo ni iniciativa dice «{buscado}».</Aviso>
                )
              }
              renderItem={({ item }) => <Resultado r={item} onPress={() => abrir(item)} />}
            />
          </View>
        )}
      </View>
    </Modal>
  );
}

function Barra({ valor, onCambiar, cargando, autoFocus, etiqueta = 'buscar leyes, artículos o iniciativas' }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 46, borderWidth: 1, borderColor: RAYA, borderRadius: 14, paddingHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.7)' }}>
      {cargando ? <MorphingInfinity size={16} color={INK.meta} /> : <Search size={16} color={INK.meta} strokeWidth={2.2} />}
      <TextInput
        value={valor}
        onChangeText={onCambiar}
        placeholder={etiqueta}
        accessibilityLabel={etiqueta}
        placeholderTextColor={INK.meta}
        autoFocus={autoFocus}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        style={{ flex: 1, color: INK.title, fontSize: 15, paddingVertical: 10 }}
      />
      {valor ? (
        <Pressable onPress={() => onCambiar('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Borrar la búsqueda">
          <X size={15} color={INK.faint} strokeWidth={2.4} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Lo encontrado, con lo que coincide en negrita. */
function Fragmento({ partes, lineas = 3 }) {
  if (!partes?.length) return null;
  return (
    <Text numberOfLines={lineas} style={{ fontSize: 13.5, lineHeight: 19.5, color: INK.body, marginTop: 6 }}>
      {partes.map((p, i) => (p.marca ? <Text key={i} style={{ fontWeight: '700', color: INK.title }}>{p.texto}</Text> : p.texto))}
    </Text>
  );
}

function Resultado({ r, onPress }) {
  const Icono = ICONO[r.tipo];
  const rotulo = r.tipo === 'articulo'
    ? `ARTÍCULO ${r.numero}`
    : r.tipo === 'iniciativa'
      ? `INICIATIVA ${r.numero}`
      : [r.decreto].filter(Boolean).join('').toUpperCase() || 'LEY';
  const titulo = r.tipo === 'iniciativa' ? limpiarTitulo(r.titulo) : r.titulo;
  const estado = r.tipo === 'ley' ? nombreEstado(r.estado) : null;
  return (
    <Animated.View entering={FadeIn.duration(160)}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${rotulo.toLowerCase()}, ${titulo}`}
        style={({ pressed }) => ({ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: RAYA, opacity: pressed ? 0.6 : 1 })}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icono size={12} color={TINTA} strokeWidth={2.4} />
          <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 0.9, color: TINTA, flexShrink: 1 }} numberOfLines={1}>{rotulo}</Text>
          {estado ? <Pastilla>{estado}</Pastilla> : null}
        </View>
        <Text numberOfLines={2} style={r.tipo === 'articulo'
          ? { fontSize: 13, fontWeight: '600', color: INK.meta, marginTop: 4 }
          : { fontFamily: SERIF, fontSize: 18, lineHeight: 22, color: INK.title, marginTop: 4 }}>
          {titulo}
        </Text>
        <Fragmento partes={r.partes} />
      </Pressable>
    </Animated.View>
  );
}

function Pastilla({ children }) {
  return (
    <View style={{ backgroundColor: 'rgba(28,43,34,0.06)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 }}>
      <Text style={{ fontSize: 11, color: INK.body }}>{children}</Text>
    </View>
  );
}

function Aviso({ children }) {
  return <Text style={{ fontSize: 13.5, color: INK.meta, lineHeight: 20, paddingVertical: 24 }}>{children}</Text>;
}

/** Sin escribir nada: la Constitución y los códigos, para entrar directo. */
function LeyesDeBase({ leyes, onAbrir }) {
  if (!leyes.length) return null;
  return (
    <View style={{ paddingTop: 14 }}>
      <Text style={[ROTULO, { marginBottom: 4 }]}>CONSTITUCIÓN Y CÓDIGOS</Text>
      {leyes.map((n) => (
        <Pressable key={n.id} onPress={() => onAbrir(n)} accessibilityRole="button" accessibilityLabel={`${n.titulo}, ${n.articulos_count} artículos`}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: RAYA, opacity: pressed ? 0.6 : 1 })}>
          <Scale size={16} color={TINTA} strokeWidth={2.2} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: SERIF, fontSize: 17, lineHeight: 21, color: INK.title }}>{n.titulo}</Text>
            <Text style={{ fontSize: 12, color: INK.meta, marginTop: 2 }}>{[n.decreto, `${n.articulos_count} artículos`].filter(Boolean).join(' · ')}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

// ─── Una ley abierta ─────────────────────────────────────────────────────────

/** La ruta de un artículo dentro de su ley: libro › título › capítulo. */
const seccionDe = (a) => [a.libro, a.titulo_seccion, a.capitulo].filter(Boolean).join(' › ');

function Norma({ id, foco, abajo }) {
  const q = useQuery({ queryKey: ['norma-legal', id], queryFn: () => traerNorma(id), staleTime: 30 * 60 * 1000 });
  const [dentro, setDentro] = useState('');
  const lista = useRef(null);
  const norma = q.data?.norma;
  // El texto ya limpio, y el título de sección que el PDF dejó al final de
  // un artículo pasa arriba del siguiente.
  const legibles = useMemo(() => {
    let cola = null;
    return (q.data?.articulos || []).map((a) => {
      const { texto, encabezado } = separarEncabezado(textoLegible(a.texto, { numero: a.numero_articulo, titulo: q.data.norma.titulo }));
      const fila = { ...a, legible: texto, antes: cola };
      cola = encabezado;
      return fila;
    });
  }, [q.data]);
  const articulos = useMemo(() => {
    const t = normalizar(dentro).trim();
    if (!t) return legibles;
    const palabras = t.split(/\s+/);
    return legibles.filter((a) => {
      const base = normalizar(`${a.numero_articulo} ${a.legible}`);
      return palabras.every((p) => base.includes(p));
    });
  }, [legibles, dentro]);
  const indiceFoco = foco && !dentro ? articulos.findIndex((a) => a.id === foco) : -1;

  // Un artículo buscado abre su ley parada en él.
  useEffect(() => {
    if (indiceFoco < 0) return undefined;
    const t = setTimeout(() => lista.current?.scrollToIndex({ index: indiceFoco, viewPosition: 0, animated: false }), 60);
    return () => clearTimeout(t);
  }, [indiceFoco]);

  if (q.isLoading) return <View style={{ alignItems: 'center', paddingVertical: 60 }}><MorphingInfinity size={30} color={INK.meta} /></View>;
  if (q.isError || !norma) return <View style={{ paddingHorizontal: 18 }}><Aviso>No se pudo abrir esta ley. Puede intentarse de nuevo.</Aviso></View>;

  return (
    <FlatList
      ref={lista}
      data={articulos}
      keyExtractor={(a) => a.id}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      initialNumToRender={indiceFoco >= 0 ? indiceFoco + 6 : 12}
      onScrollToIndexFailed={({ index, averageItemLength }) => {
        lista.current?.scrollToOffset({ offset: averageItemLength * index, animated: false });
        setTimeout(() => lista.current?.scrollToIndex({ index, viewPosition: 0, animated: false }), 120);
      }}
      contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: abajo + 32 }}
      ListHeaderComponent={<CabezaNorma norma={norma} dentro={dentro} onDentro={setDentro} cuantos={articulos.length} total={q.data.articulos.length} />}
      ListEmptyComponent={<Aviso>Ningún artículo de esta ley dice «{dentro}».</Aviso>}
      renderItem={({ item, index }) => {
        const seccion = seccionDe(item);
        const nueva = seccion && (index === 0 || seccionDe(articulos[index - 1]) !== seccion);
        return <Articulo articulo={item} seccion={nueva ? seccion : dentro ? null : item.antes} enFoco={item.id === foco} resaltar={dentro} />;
      }}
    />
  );
}

function CabezaNorma({ norma, dentro, onDentro, cuantos, total }) {
  const [error, setError] = useState(false);
  const enlace = enlaceDeNorma(norma);
  const descripcion = descripcionDe(norma);
  const estado = nombreEstado(norma.estado);
  const fecha = norma.fecha_publicacion
    ? new Date(`${norma.fecha_publicacion}T12:00:00`).toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;
  return (
    <View style={{ paddingTop: 6, paddingBottom: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Scale size={12} color={TINTA} strokeWidth={2.4} />
        <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 0.9, color: TINTA }}>
          {[nombreTipo(norma.tipo), norma.decreto].filter(Boolean).join(' · ').toUpperCase()}
        </Text>
        {estado ? <Pastilla>{estado}</Pastilla> : null}
      </View>
      <Text accessibilityRole="header" style={{ fontFamily: SERIF, fontSize: 28, lineHeight: 32, color: INK.title, marginTop: 6 }}>{norma.titulo}</Text>
      <Text style={{ fontSize: 12, color: INK.meta, marginTop: 6 }}>{[fecha, `${total} artículos`].filter(Boolean).join(' · ')}</Text>
      {descripcion ? <Text style={{ fontSize: 14, lineHeight: 20, color: INK.body, marginTop: 10 }}>{descripcion}</Text> : null}
      {norma.necesita_revision ? (
        <Text style={{ fontSize: 12.5, lineHeight: 18, color: INK.meta, marginTop: 8 }}>Texto en revisión: puede faltar alguna reforma o artículo.</Text>
      ) : null}
      {enlace ? (
        <Pressable onPress={() => { setError(false); Linking.openURL(enlace).catch(() => setError(true)); }} accessibilityRole="link" accessibilityLabel={`documento oficial, ${norma.titulo}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 46, paddingHorizontal: 12, marginTop: 12, borderWidth: 1, borderColor: RAYA, borderRadius: 10 }}>
          <FileText size={18} color={TINTA} />
          <Text style={{ color: TINTA, fontSize: 13, fontWeight: '600', flex: 1 }}>documento oficial</Text>
        </Pressable>
      ) : null}
      {error ? <Text accessibilityLiveRegion="polite" style={{ fontSize: 12, color: INK.body, marginTop: 6 }}>No se pudo abrir. Prueba de nuevo.</Text> : null}
      <View style={{ marginTop: 16, marginBottom: 4 }}>
        <Barra valor={dentro} onCambiar={onDentro} etiqueta="buscar en esta ley" />
      </View>
      {dentro && cuantos ? <Text accessibilityLiveRegion="polite" style={{ fontSize: 12, color: INK.meta, marginTop: 6 }}>{cuantos} de {total} artículos</Text> : null}
    </View>
  );
}

/** Lo buscado adentro de la ley, en negrita, sin depender de tildes. */
function resaltado(texto, buscado) {
  const palabras = normalizar(buscado).trim().split(/\s+/).filter((p) => p.length >= 2);
  if (!palabras.length) return texto;
  const plano = normalizar(texto);
  const marcas = new Array(texto.length).fill(false);
  for (const p of palabras) {
    for (let i = plano.indexOf(p); i >= 0; i = plano.indexOf(p, i + p.length)) marcas.fill(true, i, i + p.length);
  }
  const partes = [];
  for (let i = 0; i < texto.length;) {
    let j = i;
    while (j < texto.length && marcas[j] === marcas[i]) j++;
    partes.push(marcas[i] ? <Text key={i} style={{ fontWeight: '700', color: INK.title, backgroundColor: 'rgba(47,74,122,0.10)' }}>{texto.slice(i, j)}</Text> : texto.slice(i, j));
    i = j;
  }
  return partes;
}

function Articulo({ articulo: a, seccion, enFoco, resaltar }) {
  const texto = a.legible;
  const largo = texto.length > 520;
  // Abierto si se tocó; si no, el buscado entra abierto. Buscando adentro,
  // un artículo largo muestra el pedazo donde aparece lo buscado.
  const [tocado, setAbierto] = useState(null);
  const abierto = tocado ?? enFoco;
  const recorte = useMemo(() => (largo && resaltar ? recorteAlrededor(texto, resaltar) : null), [largo, resaltar, texto]);
  const visible = abierto ? texto : recorte || texto;
  const cortado = largo && !abierto;
  const Flecha = abierto ? ChevronUp : ChevronDown;
  return (
    <View>
      {seccion ? <Text style={{ fontSize: 10.5, fontWeight: '700', letterSpacing: 0.4, color: INK.faint, marginTop: 18, marginBottom: 2 }}>{seccion.toUpperCase()}</Text> : null}
      <View style={{
        paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: RAYA,
        ...(enFoco ? { backgroundColor: 'rgba(47,74,122,0.06)', borderRadius: 12, paddingHorizontal: 12, marginHorizontal: -12, borderBottomColor: 'transparent' } : null),
      }}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: enFoco ? TINTA : INK.title }}>Artículo {a.numero_articulo}</Text>
        <Text selectable numberOfLines={cortado && !recorte ? 7 : undefined} style={{ fontSize: 14, lineHeight: 21, color: INK.body, marginTop: 5 }}>
          {resaltar ? resaltado(visible, resaltar) : visible}
        </Text>
        {a.notas_reforma ? <Text style={{ fontSize: 12, lineHeight: 17, color: INK.meta, marginTop: 6 }}>{textoLegible(a.notas_reforma)}</Text> : null}
        {largo ? (
          <Pressable onPress={() => setAbierto(!abierto)} accessibilityRole="button" accessibilityState={{ expanded: abierto }} accessibilityLabel={`${abierto ? 'ocultar' : 'leer completo'}, artículo ${a.numero_articulo}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, alignSelf: 'flex-start' }}>
            <Text style={{ fontSize: 12, color: INK.meta }}>{abierto ? 'ocultar' : 'leer completo'}</Text>
            <Flecha size={13} color={INK.meta} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// ─── Una iniciativa abierta ──────────────────────────────────────────────────

function IniciativaAbierta({ numero, abajo }) {
  const q = useQuery({
    queryKey: ['congreso-iniciativa-registro', numero],
    queryFn: async () => {
      const { data, error } = await supabase.from('iniciativas_app_view').select(COLUMNAS_INICIATIVA).eq('numero', numero).maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 10 * 60 * 1000,
  });
  return (
    <FlatList
      data={q.data ? [q.data] : []}
      keyExtractor={(i) => String(i.numero)}
      contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 6, paddingBottom: abajo + 32 }}
      ListEmptyComponent={q.isLoading
        ? <View style={{ alignItems: 'center', paddingVertical: 60 }}><MorphingInfinity size={30} color={INK.meta} /></View>
        : <Aviso>No se pudo abrir esta iniciativa. Puede intentarse de nuevo.</Aviso>}
      renderItem={({ item }) => <Iniciativa ini={item} />}
    />
  );
}
