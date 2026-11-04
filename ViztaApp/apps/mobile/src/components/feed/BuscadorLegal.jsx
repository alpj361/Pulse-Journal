import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Ban, BookOpen, ChevronDown, ChevronLeft, ChevronUp, CircleCheck, Clock, FilePlus, FileText, PencilLine, Pilcrow, Scale, ScrollText, Search, X } from 'lucide-react-native';
import { INK, RADIUS, SERIF } from '../theme';
import { PAPEL } from '../codex/Papel';
import { ROTULO } from '../colaboradores/piezas';
import MorphingInfinity from '../MorphingInfinity';
import LectorDocumento from '../LectorDocumento';
import { Cristal } from './SelectorFeed';
import FiltroChips from './FiltroChips';
import { RAYA, TINTA } from './TarjetasCongreso';
import { COLUMNAS_INICIATIVA, Iniciativa, limpiarTitulo, registroCompleto } from './LegislativoCongreso';
import { ROTULOS_ETAPA } from './iniciativas';
import { normalizar } from './organizacion';
import { supabase } from '../../utils/supabase';
import { roce } from '../../utils/haptics';
import {
  buscarLegal, descripcionDe, iniciativasDeLey, nombreDecreto, nombreEstado, notaVisible, recorteAlrededor, relacionDe, rotuloDeNorma, separarEncabezado, textoLegible,
  traerIndiceNormas, traerLeyesDeBase, traerNorma, traerVersionAnterior, urlDeDocumento,
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
 *
 * Las iniciativas van aparte de las leyes: una iniciativa es una propuesta
 * hasta que se aprueba, y no es parte de ninguna ley. Cada una dice en qué
 * etapa va, qué ley cambia (con enlace) o si propone una nueva, y en qué
 * decreto se convirtió si ya se aprobó. Las que siguen en trámite van con
 * borde punteado; las aprobadas, con borde firme.
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

/** Lo que el buscador necesita de todo el registro: las leyes y las iniciativas. */
function useRegistro() {
  const normas = useQuery({ queryKey: ['normas-indice'], queryFn: traerIndiceNormas, staleTime: 60 * 60 * 1000 });
  // La misma consulta que la lista de iniciativas del Congreso: se comparte.
  const iniciativas = useQuery({
    queryKey: ['congreso-iniciativas-registro-v2'],
    queryFn: () => registroCompleto('iniciativas_app_view', COLUMNAS_INICIATIVA, 'numero'),
    staleTime: 10 * 60 * 1000,
  });
  return useMemo(() => ({
    normas: normas.data || [],
    iniciativas: iniciativas.data || [],
    porNumero: new Map((iniciativas.data || []).map((i) => [i.numero, i])),
    tipoDe: new Map((normas.data || []).map((n) => [n.id, n.tipo])),
  }), [normas.data, iniciativas.data]);
}

function Panel({ onClose }) {
  const insets = useSafeAreaInsets();
  const [texto, setTexto] = useState('');
  const [buscado, setBuscado] = useState('');
  const [filtro, setFiltro] = useState('todo');
  const [abiertas, setAbiertas] = useState({}); // las partes desplegadas en «todo»
  // Lo abierto, en pila: de una ley a una iniciativa que la cambia, y de
  // vuelta. Cada paso: { tipo: 'norma', id, foco } | { tipo: 'iniciativa', numero }.
  const [pila, setPila] = useState([]);
  const abierta = pila[pila.length - 1] || null;
  const registro = useRegistro();

  // Se busca cuando se deja de escribir, no con cada letra.
  useEffect(() => {
    setAbiertas({});
    if (!texto.trim()) { setBuscado(''); return undefined; } // borrar vuelve al inicio al momento
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
  // Lo que es ley y lo que se propone en el Congreso, en dos partes. Cada
  // parte muestra lo primero y pliega el resto, para que las dos se vean.
  const filas = useMemo(() => {
    const deLey = visibles.filter((r) => r.tipo !== 'iniciativa');
    const propuestas = visibles.filter((r) => r.tipo === 'iniciativa');
    if (!deLey.length || !propuestas.length) return visibles;
    const parte = (clave, titulo, Icono, lista, primeras) => {
      const abierta = abiertas[clave];
      const vistas = abierta ? lista : lista.slice(0, primeras);
      return [
        { clave: `parte-${clave}`, parte: titulo, Icono },
        ...vistas,
        ...(lista.length > primeras ? [{ clave: `mas-${clave}`, mas: clave, abierta, quedan: lista.length - primeras }] : []),
      ];
    };
    return [
      ...parte('ley', 'LEYES Y ARTÍCULOS', Scale, deLey, 5),
      ...parte('congreso', 'INICIATIVAS EN EL CONGRESO', ScrollText, propuestas, 3),
    ];
  }, [visibles, abiertas]);

  const ir = (paso) => { roce(); setPila((p) => [...p, paso]); };
  const volver = () => { roce(); setPila((p) => p.slice(0, -1)); };
  const abrir = (r) => (r.tipo === 'iniciativa'
    ? ir({ tipo: 'iniciativa', numero: r.numero })
    : ir({ tipo: 'norma', id: r.normaId, foco: r.tipo === 'articulo' ? r.id : null }));
  const abrirLey = (n) => n?.id && ir({ tipo: 'norma', id: n.id, foco: null });
  const abrirIniciativa = (numero) => ir({ tipo: 'iniciativa', numero });

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={abierta ? volver : onClose}>
      <View style={{ flex: 1, backgroundColor: PAPEL }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 16, paddingHorizontal: 18, minHeight: 44 }}>
          {abierta ? (
            <Pressable onPress={volver} hitSlop={12} accessibilityRole="button" accessibilityLabel="Volver"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: -6, flex: 1 }}>
              <ChevronLeft size={20} color={INK.meta} />
              <Text style={{ fontSize: 13, color: INK.meta }}>{pila.length > 1 ? 'volver' : buscado ? 'resultados' : 'buscador legal'}</Text>
            </Pressable>
          ) : (
            <Text style={[ROTULO, { flex: 1 }]}>BUSCADOR LEGAL</Text>
          )}
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar" style={{ padding: 6 }}>
            <X size={19} color={INK.faint} />
          </Pressable>
        </View>

        {abierta?.tipo === 'norma' ? (
          <Norma key={`${pila.length}-${abierta.id}`} id={abierta.id} foco={abierta.foco} abajo={insets.bottom} registro={registro} onIniciativa={abrirIniciativa} onLey={abrirLey} />
        ) : abierta?.tipo === 'iniciativa' ? (
          <IniciativaAbierta key={`${pila.length}-${abierta.numero}`} numero={abierta.numero} abajo={insets.bottom} registro={registro} onLey={abrirLey} />
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
              data={buscado.length >= 2 ? filas : []}
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
                  <LeyesDeBase leyes={base.data || []} onAbrir={abrirLey} />
                ) : busqueda.isLoading ? (
                  <View style={{ alignItems: 'center', paddingVertical: 40 }}><MorphingInfinity size={30} color={INK.meta} /></View>
                ) : busqueda.isError ? (
                  <Aviso>No se pudo buscar. Puede intentarse de nuevo.</Aviso>
                ) : (
                  <Aviso>Ninguna ley, artículo ni iniciativa dice «{buscado}».</Aviso>
                )
              }
              renderItem={({ item }) => (item.parte
                ? <Parte Icono={item.Icono}>{item.parte}</Parte>
                : item.mas
                  ? <Mas abierta={item.abierta} quedan={item.quedan} onPress={() => { roce(); setAbiertas((a) => ({ ...a, [item.mas]: !a[item.mas] })); }} />
                : item.tipo === 'iniciativa'
                  ? <ResultadoIniciativa r={item} ini={registro.porNumero.get(item.numero)} normas={registro.normas} onPress={() => abrir(item)} onLey={abrirLey} />
                  : <Resultado r={item} tipo={registro.tipoDe.get(item.normaId)} onPress={() => abrir(item)} />)}
            />
          </View>
        )}
      </View>
    </Modal>
  );
}

function Mas({ abierta, quedan, onPress }) {
  const Flecha = abierta ? ChevronUp : ChevronDown;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ expanded: abierta }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 40, alignSelf: 'flex-start' }}>
      <Text style={{ fontSize: 12.5, color: INK.meta }}>{abierta ? 'ocultar' : `${quedan} más`}</Text>
      <Flecha size={13} color={INK.meta} />
    </Pressable>
  );
}

function Parte({ Icono, children }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18, marginBottom: 2 }}>
      <Icono size={12} color={INK.faint} strokeWidth={2.4} />
      <Text style={ROTULO}>{children}</Text>
    </View>
  );
}

/**
 * La barra de búsqueda. El campo no es controlado: lo que se escribe queda en
 * el campo sin pasar por cada render, así no se pierden teclas mientras la
 * lista de abajo se recalcula.
 */
function Barra({ valor, onCambiar, cargando, autoFocus, etiqueta = 'buscar leyes, artículos o iniciativas' }) {
  const campo = useRef(null);
  const [inicial] = useState(valor); // solo al montar: cambiarlo después reescribe lo que se está tecleando
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 46, borderWidth: 1, borderColor: RAYA, borderRadius: 14, paddingHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.7)' }}>
      {cargando ? <MorphingInfinity size={16} color={INK.meta} /> : <Search size={16} color={INK.meta} strokeWidth={2.2} />}
      <TextInput
        ref={campo}
        defaultValue={inicial}
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
        <Pressable onPress={() => { campo.current?.clear(); onCambiar(''); }} hitSlop={10} accessibilityRole="button" accessibilityLabel="Borrar la búsqueda">
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

function Resultado({ r, tipo, onPress }) {
  const Icono = ICONO[r.tipo];
  const rotulo = r.tipo === 'articulo' ? `ARTÍCULO ${r.numero}` : rotuloDeNorma({ titulo: r.titulo, decreto: r.decreto, tipo });
  const titulo = r.titulo;
  const estado = r.tipo === 'ley' ? nombreEstado(r.estado) : null;
  return (
    <Animated.View entering={FadeIn.duration(160)}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${rotulo.toLowerCase()}, ${titulo}`}
        style={({ pressed }) => ({ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: RAYA, opacity: pressed ? 0.6 : 1 })}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icono size={12} color={TINTA} strokeWidth={2.4} />
          <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 0.9, color: TINTA, flexShrink: 1 }} numberOfLines={1}>{rotulo}</Text>
          {estado ? <Pastilla>{estado}</Pastilla> : null}
          {r.derogado ? <Pastilla>derogado</Pastilla> : null}
        </View>
        <Text numberOfLines={2} style={r.tipo === 'articulo'
          ? { fontSize: 13, fontWeight: '600', color: INK.meta, marginTop: 4 }
          : { fontFamily: SERIF, fontSize: 18, lineHeight: 22, color: INK.title, marginTop: 4 }}>
          {titulo}
        </Text>
        <Fragmento partes={r.partes} />
        {r.reforma?.decreto ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 }}>
            <PencilLine size={11.5} color={INK.meta} strokeWidth={2.2} />
            <Text numberOfLines={1} style={{ fontSize: 12, color: INK.meta, flexShrink: 1 }}>
              {[`texto del ${r.reforma.decreto}`, r.reforma.desde ? `vigente desde el ${fechaLegal(r.reforma.desde)}` : null].filter(Boolean).join(' · ')}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

/** «2025-03-08» → «8 mar 2025». */
const fechaLegal = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' });

/** El último día de una versión: su fin no está incluido, así que es el día antes. */
function ultimoDia(iso) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Una iniciativa en los resultados. No es ley: va en su tarjeta, punteada
 * mientras sigue en trámite y firme si ya se aprobó. Dice en qué etapa va,
 * qué ley cambia o si propone una nueva, y en qué decreto se convirtió.
 */
function ResultadoIniciativa({ r, ini, normas, onPress, onLey }) {
  const datos = ini || { numero: r.numero, titulo: r.titulo, decreto_resultante: r.decreto };
  const rel = relacionDe(datos, normas);
  return (
    <Animated.View entering={FadeIn.duration(160)}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`iniciativa ${r.numero}, ${palabraEtapa(rel)}, ${limpiarTitulo(r.titulo)}`}
        style={({ pressed }) => ({ ...tarjetaIniciativa(rel), opacity: pressed ? 0.6 : 1 })}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <ScrollText size={12} color={TINTA} strokeWidth={2.4} />
          <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 0.9, color: TINTA }}>{`INICIATIVA ${r.numero}`}</Text>
          <Etapa rel={rel} />
        </View>
        <Text numberOfLines={3} style={{ fontFamily: SERIF, fontSize: 17, lineHeight: 21, color: INK.title, marginTop: 4 }}>{limpiarTitulo(r.titulo)}</Text>
        <Relacion rel={rel} onLey={onLey} />
        <Fragmento partes={r.partes} lineas={2} />
      </Pressable>
    </Animated.View>
  );
}

const VETO = '#A0463C';

/** Punteada en trámite, firme si se aprobó; la vetada, firme y en rojo apagado: terminó sin ser ley. */
const tarjetaIniciativa = (rel) => ({
  padding: 12, marginTop: 10, borderRadius: 14, borderWidth: 1,
  borderStyle: rel.aprobada || rel.vetada ? 'solid' : 'dashed',
  borderColor: rel.vetada ? 'rgba(160,70,60,0.28)' : rel.aprobada ? 'rgba(28,43,34,0.12)' : 'rgba(47,74,122,0.35)',
  backgroundColor: rel.vetada ? 'rgba(160,70,60,0.035)' : rel.aprobada ? 'rgba(255,255,255,0.55)' : 'rgba(47,74,122,0.03)',
});

const palabraEtapa = (rel) => (rel.vetada ? 'vetada' : rel.aprobada ? 'aprobada' : 'en trámite');

/** La etapa en un ícono y una palabra: aprobada (visto verde), vetada o dónde va. */
function Etapa({ rel }) {
  if (rel.vetada) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Ban size={11.5} color={VETO} strokeWidth={2.4} />
        <Text style={{ fontSize: 11.5, color: VETO, fontWeight: '600' }}>vetada</Text>
      </View>
    );
  }
  if (rel.aprobada) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <CircleCheck size={12} color="#2E7D4F" strokeWidth={2.4} />
        <Text style={{ fontSize: 11.5, color: '#2E7D4F', fontWeight: '600' }}>{rel.estadoLey ? `aprobada · ${rel.estadoLey}` : 'aprobada'}</Text>
      </View>
    );
  }
  const etapa = ROTULOS_ETAPA[rel.etapa]?.toLowerCase();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Clock size={11.5} color={INK.meta} strokeWidth={2.4} />
      <Text style={{ fontSize: 11.5, color: INK.meta }}>{etapa && etapa !== 'presentada' ? `en trámite · ${etapa}` : 'en trámite'}</Text>
    </View>
  );
}

/**
 * Qué tiene que ver con las leyes: en qué decreto se convirtió, qué ley
 * cambia (cada una se abre) o si propone una nueva.
 */
function Relacion({ rel, onLey }) {
  const filas = [];
  if (rel.resultante) {
    filas.push(
      <Linea key="es" Icono={rel.vetada ? Ban : CircleCheck} texto={rel.vetada ? 'no entró en vigor' : 'se volvió'}>
        <Chip onPress={rel.resultante.id ? () => onLey(rel.resultante) : null}>{rel.resultante.titulo ? `${rel.resultante.decreto} · ${rel.resultante.titulo}` : rel.resultante.decreto}</Chip>
      </Linea>,
    );
  }
  if (rel.cambia.length || rel.sinFicha.length) {
    filas.push(
      <Linea key="cambia" Icono={PencilLine} texto={rel.aprobada ? 'cambió' : rel.vetada ? 'iba a cambiar' : 'cambiaría'}>
        {rel.cambia.map((n) => <Chip key={n.id} onPress={() => onLey(n)}>{n.titulo}</Chip>)}
        {rel.sinFicha.map((d) => <Chip key={d}>{`Decreto ${d}`}</Chip>)}
      </Linea>,
    );
  } else if (rel.proposito === 'nueva' && !rel.resultante) {
    filas.push(<Linea key="nueva" Icono={FilePlus} texto="propone una ley nueva" />);
  }
  return filas.length ? <View style={{ gap: 6, marginTop: 8 }}>{filas}</View> : null;
}

function Linea({ Icono, texto, children }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
      <Icono size={12} color={INK.meta} strokeWidth={2.2} />
      <Text style={{ fontSize: 12.5, color: INK.meta }}>{texto}</Text>
      {children}
    </View>
  );
}

/** Una ley nombrada: si está en la base, se toca y se abre. */
function Chip({ onPress, children }) {
  const contenido = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 260, backgroundColor: onPress ? 'rgba(47,74,122,0.08)' : 'rgba(28,43,34,0.05)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 }}>
      <Scale size={11} color={onPress ? TINTA : INK.meta} strokeWidth={2.2} />
      <Text numberOfLines={1} style={{ fontSize: 12.5, color: onPress ? TINTA : INK.body, fontWeight: onPress ? '600' : '400', flexShrink: 1 }}>{children}</Text>
    </View>
  );
  if (!onPress) return contenido;
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="link" accessibilityLabel={`abrir ${children}`} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      {contenido}
    </Pressable>
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
            <Text style={{ fontSize: 12, color: INK.meta, marginTop: 2 }}>{[nombreDecreto(n.decreto), `${n.articulos_count} artículos`].filter(Boolean).join(' · ')}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

// ─── Una ley abierta ─────────────────────────────────────────────────────────

/** La ruta de un artículo dentro de su ley: libro › título › capítulo. */
const seccionDe = (a) => [a.libro, a.titulo_seccion, a.capitulo].filter(Boolean).join(' › ');

function Norma({ id, foco, abajo, registro, onIniciativa, onLey }) {
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
      ListHeaderComponent={<CabezaNorma norma={norma} dentro={dentro} onDentro={setDentro} cuantos={articulos.length} total={q.data.articulos.length} registro={registro} onIniciativa={onIniciativa} />}
      ListEmptyComponent={<Aviso>Ningún artículo de esta ley dice «{dentro}».</Aviso>}
      renderItem={({ item, index }) => {
        const seccion = seccionDe(item);
        const nueva = seccion && (index === 0 || seccionDe(articulos[index - 1]) !== seccion);
        return <Articulo articulo={item} seccion={nueva ? seccion : dentro ? null : item.antes} enFoco={item.id === foco} resaltar={dentro} onLey={onLey} />;
      }}
    />
  );
}

function CabezaNorma({ norma, dentro, onDentro, cuantos, total, registro, onIniciativa }) {
  const [leyendo, setLeyendo] = useState(null);
  const documento = useQuery({ queryKey: ['documento-norma', norma.id], queryFn: () => urlDeDocumento(norma), staleTime: 50 * 60 * 1000 });
  const descripcion = descripcionDe(norma);
  const estado = nombreEstado(norma.estado);
  const fecha = norma.fecha_publicacion
    ? new Date(`${norma.fecha_publicacion}T12:00:00`).toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;
  return (
    <View style={{ paddingTop: 6, paddingBottom: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Scale size={12} color={TINTA} strokeWidth={2.4} />
        <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 0.9, color: TINTA }}>{rotuloDeNorma(norma)}</Text>
        {estado ? <Pastilla>{estado}</Pastilla> : null}
      </View>
      <Text accessibilityRole="header" style={{ fontFamily: SERIF, fontSize: 28, lineHeight: 32, color: INK.title, marginTop: 6 }}>{norma.titulo}</Text>
      <Text style={{ fontSize: 12, color: INK.meta, marginTop: 6 }}>{[fecha, `${total} artículos`].filter(Boolean).join(' · ')}</Text>
      <AlDia norma={norma} />
      {descripcion ? <Text style={{ fontSize: 14, lineHeight: 20, color: INK.body, marginTop: 10 }}>{descripcion}</Text> : null}
      {norma.necesita_revision ? (
        <Text style={{ fontSize: 12.5, lineHeight: 18, color: INK.meta, marginTop: 8 }}>Texto en revisión: puede faltar alguna reforma o artículo.</Text>
      ) : null}
      {documento.data ? (
        <Pressable onPress={() => { roce(); setLeyendo({ uri: documento.data, titulo: norma.titulo, origen: rotuloDeNorma(norma).toLowerCase() }); }}
          accessibilityRole="button" accessibilityLabel={`leer el documento oficial, ${norma.titulo}`}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 46, paddingHorizontal: 12, marginTop: 12, borderWidth: 1, borderColor: RAYA, borderRadius: 10, opacity: pressed ? 0.6 : 1 })}>
          <FileText size={18} color={TINTA} />
          <Text style={{ color: TINTA, fontSize: 13, fontWeight: '600', flex: 1 }}>leer el documento oficial</Text>
        </Pressable>
      ) : null}
      <EnElCongreso norma={norma} iniciativas={registro.iniciativas} normas={registro.normas} onIniciativa={onIniciativa} />
      <View style={{ marginTop: 16, marginBottom: 4 }}>
        <Barra valor={dentro} onCambiar={onDentro} etiqueta="buscar en esta ley" />
      </View>
      {dentro && cuantos ? <Text accessibilityLiveRegion="polite" style={{ fontSize: 12, color: INK.meta, marginTop: 6 }}>{cuantos} de {total} artículos</Text> : null}
      <LectorDocumento documento={leyendo} onClose={() => setLeyendo(null)} />
    </View>
  );
}

/**
 * Hasta dónde llega el texto: la última reforma aplicada, la fecha del texto
 * si se conoce, y cuántos cambios de otros decretos faltan por confirmar.
 * Dice lo que hay; no promete que la ley esté completa.
 */
function AlDia({ norma }) {
  const u = norma.ultimaReforma;
  const partes = [
    u ? `última reforma aplicada: ${u.decreto}${u.desde ? `, desde el ${fechaLegal(u.desde)}` : ''}` : null,
    norma.texto_al ? `texto al ${fechaLegal(norma.texto_al)}` : null,
    norma.porConfirmar ? `${norma.porConfirmar} ${norma.porConfirmar === 1 ? 'cambio' : 'cambios'} por confirmar` : null,
  ].filter(Boolean);
  if (!partes.length) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginTop: 4 }}>
      <PencilLine size={11.5} color={INK.meta} strokeWidth={2.2} style={{ marginTop: 2.5 }} />
      <Text style={{ fontSize: 12, lineHeight: 17, color: INK.meta, flex: 1 }}>{partes.join(' · ')}</Text>
    </View>
  );
}

const VISIBLES_CONGRESO = 3;

/**
 * Lo que pasa con esta ley en el Congreso: la iniciativa de la que nació y
 * las que la quieren cambiar, primero las que siguen en trámite.
 */
function EnElCongreso({ norma, iniciativas, normas, onIniciativa }) {
  const [todas, setTodas] = useState(false);
  const { origen, cambios } = useMemo(() => iniciativasDeLey(norma, iniciativas, normas), [norma, iniciativas, normas]);
  if (!origen && !cambios.length) return null;
  const vistas = todas ? cambios : cambios.slice(0, VISIBLES_CONGRESO);
  return (
    <View style={{ marginTop: 18 }}>
      <Parte Icono={ScrollText}>EN EL CONGRESO</Parte>
      {origen ? (
        <FilaIniciativa ini={origen.ini} rel={origen.rel} detalle="nació de esta iniciativa" onPress={() => onIniciativa(origen.ini.numero)} />
      ) : null}
      {vistas.map(({ ini, rel }) => (
        <FilaIniciativa key={ini.numero} ini={ini} rel={rel} detalle={rel.aprobada ? 'la cambió' : rel.vetada ? 'la iba a cambiar' : 'la cambiaría'} onPress={() => onIniciativa(ini.numero)} />
      ))}
      {cambios.length > VISIBLES_CONGRESO ? (
        <Pressable onPress={() => setTodas((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: todas }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, alignSelf: 'flex-start' }}>
          <Text style={{ fontSize: 12, color: INK.meta }}>{todas ? 'ocultar' : `${cambios.length - VISIBLES_CONGRESO} más`}</Text>
          {todas ? <ChevronUp size={13} color={INK.meta} /> : <ChevronDown size={13} color={INK.meta} />}
        </Pressable>
      ) : null}
    </View>
  );
}

function FilaIniciativa({ ini, rel, detalle, onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`iniciativa ${ini.numero}, ${palabraEtapa(rel)}, ${detalle}, ${limpiarTitulo(ini.titulo)}`}
      style={({ pressed }) => ({ ...tarjetaIniciativa(rel), padding: 10, marginTop: 8, opacity: pressed ? 0.6 : 1 })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 0.9, color: TINTA }}>{`INICIATIVA ${ini.numero}`}</Text>
        <Etapa rel={rel} />
      </View>
      <Text numberOfLines={2} style={{ fontSize: 13.5, lineHeight: 19, color: INK.title, marginTop: 4 }}>{limpiarTitulo(ini.titulo)}</Text>
      <Text style={{ fontSize: 12, color: INK.meta, marginTop: 3 }}>{detalle}</Text>
    </Pressable>
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

const HIZO = { reforma: 'reformado por el', adiciona: 'agregado por el', deroga: 'derogado por el' };

function Articulo({ articulo: a, seccion, enFoco, resaltar, onLey }) {
  // Un derogado no es ley vigente: su texto se ve solo si se pide.
  const [verDerogado, setVerDerogado] = useState(false);
  if (a.derogado && !verDerogado) {
    return (
      <View>
        {seccion ? <Text style={{ fontSize: 10.5, fontWeight: '700', letterSpacing: 0.4, color: INK.faint, marginTop: 18, marginBottom: 2 }}>{seccion.toUpperCase()}</Text> : null}
        <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: RAYA }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: INK.faint }}>Artículo {a.numero_articulo}</Text>
            {/* «derogado por el Decreto…» ya lo dice; la pastilla, solo si no se sabe cuál. */}
            {a.reforma?.decreto ? null : <Pastilla>derogado</Pastilla>}
          </View>
          <Reforma reforma={a.reforma} onLey={onLey} />
          <Pressable onPress={() => { roce(); setVerDerogado(true); }} accessibilityRole="button" accessibilityState={{ expanded: false }} accessibilityLabel={`ver el texto que tuvo, artículo ${a.numero_articulo}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, alignSelf: 'flex-start' }}>
            <Text style={{ fontSize: 12, color: INK.meta }}>ver el texto que tuvo</Text>
            <ChevronDown size={13} color={INK.meta} />
          </Pressable>
        </View>
      </View>
    );
  }
  return <ArticuloVigente a={a} seccion={seccion} enFoco={enFoco} resaltar={resaltar} onLey={onLey} onOcultar={a.derogado ? () => setVerDerogado(false) : null} />;
}

/** Qué decreto le cambió el texto y desde cuándo; se toca y abre el decreto. */
function Reforma({ reforma, onLey }) {
  if (!reforma?.decreto) return null;
  const texto = [`${HIZO[reforma.accion] || HIZO.reforma} ${reforma.decreto}`, reforma.desde ? `desde el ${fechaLegal(reforma.desde)}` : null].filter(Boolean).join(' · ');
  return (
    <Pressable onPress={reforma.normaId ? () => { roce(); onLey?.({ id: reforma.normaId }); } : null} disabled={!reforma.normaId}
      accessibilityRole="button" accessibilityLabel={`${texto}, abrir el decreto`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, minHeight: 28, alignSelf: 'flex-start', opacity: pressed ? 0.5 : 1 })}>
      <PencilLine size={12} color={TINTA} strokeWidth={2.2} />
      <Text style={{ fontSize: 12, color: TINTA, fontWeight: '600' }}>{texto}</Text>
    </Pressable>
  );
}

/** La versión anterior de un artículo reformado, plegada; se trae al abrirla. */
function VersionAnterior({ articuloId, numero }) {
  const [abierta, setAbierta] = useState(false);
  const q = useQuery({ queryKey: ['version-anterior', articuloId], queryFn: () => traerVersionAnterior(articuloId), enabled: abierta, staleTime: 60 * 60 * 1000 });
  const Flecha = abierta ? ChevronUp : ChevronDown;
  return (
    <View>
      <Pressable onPress={() => { roce(); setAbierta(!abierta); }} accessibilityRole="button" accessibilityState={{ expanded: abierta }} accessibilityLabel={`versión anterior, artículo ${numero}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, alignSelf: 'flex-start' }}>
        <Text style={{ fontSize: 12, color: INK.meta }}>versión anterior</Text>
        <Flecha size={13} color={INK.meta} />
      </Pressable>
      {abierta ? (
        q.isLoading ? <MorphingInfinity size={20} color={INK.meta} />
          : q.isError ? <Text style={{ fontSize: 12.5, color: INK.meta }}>No se pudo traer. Puede intentarse de nuevo.</Text>
          : q.data?.texto ? (
            <View style={{ borderLeftWidth: 2, borderLeftColor: RAYA, paddingLeft: 10, marginBottom: 4 }}>
              {q.data.hasta ? <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.4, color: INK.faint }}>{`VIGENTE HASTA EL ${ultimoDia(q.data.hasta).toUpperCase()}`}</Text> : null}
              <Text selectable style={{ fontSize: 13.5, lineHeight: 20, color: INK.meta, marginTop: 3 }}>{textoLegible(q.data.texto, { numero })}</Text>
            </View>
          ) : (
            <Text style={{ fontSize: 12.5, lineHeight: 18, color: INK.meta }}>
              {q.data?.desconocida ? 'El texto anterior a esta reforma no está en la biblioteca.' : 'No tenía una versión anterior: este decreto lo agregó.'}
            </Text>
          )
      ) : null}
    </View>
  );
}

function ArticuloVigente({ a, seccion, enFoco, resaltar, onLey, onOcultar }) {
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: enFoco ? TINTA : INK.title }}>Artículo {a.numero_articulo}</Text>
          {a.derogado && !a.reforma?.decreto ? <Pastilla>derogado</Pastilla> : null}
        </View>
        <Reforma reforma={a.reforma} onLey={onLey} />
        <Text selectable numberOfLines={cortado && !recorte ? 7 : undefined} style={{ fontSize: 14, lineHeight: 21, color: INK.body, marginTop: 5 }}>
          {resaltar ? resaltado(visible, resaltar) : visible}
        </Text>
        {!a.reforma && notaVisible(a.notas_reforma) ? <Text style={{ fontSize: 12, lineHeight: 17, color: INK.meta, marginTop: 6 }}>{textoLegible(notaVisible(a.notas_reforma))}</Text> : null}
        {largo ? (
          <Pressable onPress={() => setAbierto(!abierto)} accessibilityRole="button" accessibilityState={{ expanded: abierto }} accessibilityLabel={`${abierto ? 'ocultar' : 'leer completo'}, artículo ${a.numero_articulo}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, alignSelf: 'flex-start' }}>
            <Text style={{ fontSize: 12, color: INK.meta }}>{abierto ? 'ocultar' : 'leer completo'}</Text>
            <Flecha size={13} color={INK.meta} />
          </Pressable>
        ) : null}
        {a.reforma?.accion === 'reforma' ? <VersionAnterior articuloId={a.id} numero={a.numero_articulo} /> : null}
        {onOcultar ? (
          <Pressable onPress={() => { roce(); onOcultar(); }} accessibilityRole="button" accessibilityState={{ expanded: true }} accessibilityLabel={`ocultar el texto que tuvo, artículo ${a.numero_articulo}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, alignSelf: 'flex-start' }}>
            <Text style={{ fontSize: 12, color: INK.meta }}>ocultar</Text>
            <ChevronUp size={13} color={INK.meta} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// ─── Una iniciativa abierta ──────────────────────────────────────────────────

function IniciativaAbierta({ numero, abajo, registro, onLey }) {
  const enRegistro = registro.porNumero.get(numero);
  const q = useQuery({
    queryKey: ['congreso-iniciativa-registro', numero],
    queryFn: async () => {
      const { data, error } = await supabase.from('iniciativas_app_view').select(COLUMNAS_INICIATIVA).eq('numero', numero).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !enRegistro,
    staleTime: 10 * 60 * 1000,
  });
  const ini = enRegistro || q.data;
  const rel = ini ? relacionDe(ini, registro.normas) : null;
  return (
    <FlatList
      data={ini ? [ini] : []}
      keyExtractor={(i) => String(i.numero)}
      contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 6, paddingBottom: abajo + 32 }}
      ListEmptyComponent={q.isLoading
        ? <View style={{ alignItems: 'center', paddingVertical: 60 }}><MorphingInfinity size={30} color={INK.meta} /></View>
        : <Aviso>No se pudo abrir esta iniciativa. Puede intentarse de nuevo.</Aviso>}
      renderItem={({ item }) => (
        <View>
          {/* Antes de la ficha, qué tiene que ver con las leyes: así se sabe
              si es una propuesta suelta o el cambio de una ley que existe. */}
          {rel && (rel.resultante || rel.cambia.length || rel.sinFicha.length || rel.proposito === 'nueva') ? (
            <View style={{ ...tarjetaIniciativa(rel), marginTop: 0, marginBottom: 4 }}>
              <Etapa rel={rel} />
              <Relacion rel={rel} onLey={onLey} />
            </View>
          ) : null}
          <Iniciativa ini={item} />
        </View>
      )}
    />
  );
}
