import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen, Calendar, Check, ChevronDown, ChevronRight, ChevronUp, CircleDot, FileScan, FileText, MessageCircleQuestionMark,
  Network, Paperclip, Plus, RefreshCw, ScrollText, Search, Target, User,
} from 'lucide-react-native';
import { INK } from '../theme';
import { ROTULO } from '../colaboradores/piezas';
import MorphingInfinity from '../MorphingInfinity';
import CreateSnippetSheet from '../codex/CreateSnippetSheet';
import { RAYA, TINTA } from './TarjetasCongreso';
import { roce } from '../../utils/haptics';
import {
  leerAnalisisDeCaso, leerTrabajo, pasoPorTiempo, pedirAnalisisDeCaso, snippetDeDocumento, traerCasosRecientes, traerDocumentos,
} from './casoLegal';

/**
 * «Analizar un caso», en el buscador legal.
 *
 * Plegado es una fila bajo la barra. Desplegado deja elegir el caso: una nota
 * reciente, un documento PDF o Word de la biblioteca, o una nota nueva (se
 * abre el editor de notas, con su transición de siempre). Con el caso elegido,
 * «analizar» lo lee con el buscador legal; el análisis queda en la nota, así
 * que reabrirla lo trae sin volver a pedirlo.
 *
 * `estado` vive en el panel ({ caso, trabajoId, abierto }) para que abrir un
 * artículo y volver no pierda nada.
 */
export default function AnalizarCaso({ estado, onEstado, onArticulo, onIniciativa, onPreguntar }) {
  const { caso = null, trabajoId = null, abierto = false } = estado || {};
  const set = (cambio) => onEstado((e) => ({ ...(e || {}), ...cambio }));
  const [editor, setEditor] = useState(false);
  const qc = useQueryClient();

  const recientes = useQuery({ queryKey: ['caso-legal-recientes'], queryFn: () => traerCasosRecientes(), enabled: abierto && !caso, staleTime: 30 * 1000 });
  const documentos = useQuery({ queryKey: ['caso-legal-documentos'], queryFn: () => traerDocumentos(), enabled: abierto && !caso, staleTime: 5 * 60 * 1000 });

  // El análisis que ya tiene la nota, o el que se acaba de pedir.
  const idAnalisis = trabajoId || caso?.analisis?.id || null;
  const trabajo = useQuery({
    queryKey: ['caso-legal-trabajo', idAnalisis],
    queryFn: async () => leerTrabajo(await leerAnalisisDeCaso(idAnalisis)),
    enabled: !!idAnalisis,
    refetchInterval: (q) => (q.state.data?.estado === 'en_curso' ? 3000 : false),
    staleTime: (q) => (q.state.data?.estado === 'listo' ? Infinity : 0),
  });

  const pedido = useMutation({
    mutationFn: () => pedirAnalisisDeCaso(caso),
    onSuccess: (job) => { set({ trabajoId: job.id }); qc.setQueryData(['caso-legal-trabajo', job.id], leerTrabajo(job)); qc.invalidateQueries({ queryKey: ['caso-legal-recientes'] }); },
  });

  const elegirDocumento = useMutation({
    mutationFn: snippetDeDocumento,
    onSuccess: (c) => { roce(); set({ caso: c, trabajoId: null }); },
  });

  const elegir = (c) => { roce(); pedido.reset(); set({ caso: c, trabajoId: null }); };
  const cambiar = () => { roce(); pedido.reset(); set({ caso: null, trabajoId: null }); };

  // La nota nueva: el editor guarda y se queda abierto; al cerrarlo, la última guardada es el caso.
  const [guardada, setGuardada] = useState(null);
  const cerrarEditor = () => {
    setEditor(false);
    if (guardada?.id) elegir({ id: guardada.id, titulo: (guardada.name || '').trim() || 'Nota sin título', actualizado: guardada.updated_at || new Date().toISOString(), analisis: null, documento: null });
    setGuardada(null);
    qc.invalidateQueries({ queryKey: ['caso-legal-recientes'] });
  };

  const r = trabajo.data;
  const corriendo = pedido.isPending || r?.estado === 'en_curso';

  return (
    <Animated.View layout={LinearTransition.duration(220)} style={{ marginTop: 6, marginBottom: 4 }}>
      <Pressable onPress={() => { roce(); set({ abierto: !abierto }); }} accessibilityRole="button" accessibilityState={{ expanded: abierto }}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, opacity: pressed ? 0.6 : 1 })}>
        <FileScan size={18} color={TINTA} strokeWidth={2.1} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: INK.title }}>Analizar un caso</Text>
          <Text numberOfLines={1} style={{ fontSize: 12, color: INK.meta, marginTop: 1 }}>{caso ? caso.titulo : 'Desde tus notas o un documento'}</Text>
        </View>
        {abierto ? <ChevronUp size={17} color={INK.meta} /> : <ChevronDown size={17} color={INK.meta} />}
      </Pressable>

      {abierto ? (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(120)}>
          {!caso ? (
            <EleccionDeCaso
              recientes={recientes} documentos={documentos} cargandoDocumento={elegirDocumento.isPending}
              onNota={elegir} onDocumento={(d) => elegirDocumento.mutate(d)} onNueva={() => { roce(); setEditor(true); }}
            />
          ) : (
            <View>
              <CasoElegido caso={caso} onCambiar={cambiar} />
              {corriendo ? <Cargando desde={pedido.submittedAt || trabajo.dataUpdatedAt} />
                : r?.estado === 'listo' ? (
                  <MatrizDelCaso r={r} onArticulo={onArticulo} onIniciativa={onIniciativa} onPreguntar={onPreguntar}
                    onRehacer={caso.actualizado && r && caso.analisis?.fecha && caso.actualizado > caso.analisis.fecha ? () => pedido.mutate() : null} />
                ) : (
                  <Pedir error={pedido.error?.codigo || (r?.estado === 'fallido' ? r.error : null) || (trabajo.isError ? 'lectura' : null)} onPedir={() => { roce(); pedido.mutate(); }} />
                )}
            </View>
          )}
        </Animated.View>
      ) : null}

      {editor ? <CreateSnippetSheet onClose={cerrarEditor} onCreated={setGuardada} /> : null}
    </Animated.View>
  );
}

function Rotulo({ children, Icono }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, marginBottom: 4 }}>
      {Icono ? <Icono size={12} color={INK.faint} strokeWidth={2.4} /> : null}
      <Text style={ROTULO}>{children}</Text>
    </View>
  );
}

function Fila({ Icono, titulo, nota, onPress, derecha = null, deshabilitada = false }) {
  return (
    <Pressable onPress={onPress} disabled={deshabilitada} accessibilityRole="button"
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, borderBottomWidth: 1, borderBottomColor: RAYA, opacity: pressed || deshabilitada ? 0.6 : 1 })}>
      <Icono size={15} color={TINTA} strokeWidth={2.2} />
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ fontSize: 14, color: INK.title }}>{titulo}</Text>
        {nota ? <Text numberOfLines={1} style={{ fontSize: 11.5, color: INK.meta, marginTop: 1 }}>{nota}</Text> : null}
      </View>
      {derecha || <ChevronRight size={15} color={INK.faint} />}
    </Pressable>
  );
}

const fechaCorta = (iso) => (iso ? new Date(iso).toLocaleDateString('es-GT', { day: 'numeric', month: 'short' }) : null);

function EleccionDeCaso({ recientes, documentos, cargandoDocumento, onNota, onDocumento, onNueva }) {
  const notas = recientes.data || [];
  const docs = documentos.data || [];
  return (
    <View>
      <Pressable onPress={onNueva} accessibilityRole="button"
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', minHeight: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: 'rgba(47,74,122,0.08)', opacity: pressed ? 0.6 : 1 })}>
        <Plus size={14} color={TINTA} strokeWidth={2.4} />
        <Text style={{ fontSize: 13, fontWeight: '600', color: TINTA }}>Nueva nota con el caso</Text>
      </Pressable>
      <Rotulo Icono={FileText}>TUS NOTAS RECIENTES</Rotulo>
      {recientes.isLoading ? <MorphingInfinity size={18} color={INK.meta} /> : notas.length ? notas.map((n, i) => (
        <Animated.View key={n.id} entering={FadeInDown.duration(200).delay(i * 40)}>
          <Fila Icono={FileText} titulo={n.titulo} nota={[n.documento ? 'con documento' : null, n.analisis ? 'con análisis legal' : null, fechaCorta(n.actualizado)].filter(Boolean).join(' · ')} onPress={() => onNota(n)} />
        </Animated.View>
      )) : <Text style={{ fontSize: 13, color: INK.meta, paddingVertical: 8 }}>Todavía no hay notas.</Text>}
      {docs.length ? (
        <>
          <Rotulo Icono={Paperclip}>DOCUMENTOS DE TU BIBLIOTECA</Rotulo>
          {docs.map((d, i) => (
            <Animated.View key={d.id} entering={FadeInDown.duration(200).delay(i * 40)}>
              <Fila Icono={Paperclip} titulo={d.titulo} nota={d.formato} onPress={() => onDocumento(d)} deshabilitada={cargandoDocumento} />
            </Animated.View>
          ))}
        </>
      ) : null}
    </View>
  );
}

function CasoElegido({ caso, onCambiar }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 }}>
      <FileText size={14} color={INK.meta} strokeWidth={2.2} />
      <Text numberOfLines={1} style={{ flex: 1, fontSize: 13.5, fontWeight: '600', color: INK.title }}>{caso.titulo}</Text>
      <Pressable onPress={onCambiar} hitSlop={8} accessibilityRole="button" accessibilityLabel="elegir otro caso">
        <Text style={{ fontSize: 12.5, color: TINTA }}>cambiar</Text>
      </Pressable>
    </View>
  );
}

const ERRORES = {
  sin_cupo: 'No queda cupo para este análisis.',
  analysis_input_limit: 'El caso es muy breve para analizarlo. Agrega más detalle a la nota.',
  analysis_not_found: 'Esta nota ya no está disponible.',
};

function Pedir({ error, onPedir }) {
  return (
    <View style={{ paddingTop: 4, paddingBottom: 8 }}>
      {error ? <Text style={{ fontSize: 13, color: INK.meta, lineHeight: 19, marginBottom: 8 }}>{ERRORES[error] || 'No se pudo analizar. Puede intentarse de nuevo.'}</Text> : null}
      <Pressable onPress={onPedir} accessibilityRole="button" accessibilityLabel="analizar el caso con el buscador legal"
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, borderRadius: 14, backgroundColor: TINTA, opacity: pressed ? 0.75 : 1 })}>
        <Search size={15} color="#F7F6EF" strokeWidth={2.4} />
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#F7F6EF' }}>{error ? 'volver a analizar' : 'analizar con el buscador legal'}</Text>
      </Pressable>
    </View>
  );
}

const PASOS = [
  { Icono: FileText, texto: 'Leyendo el caso: actores, hechos, fechas' },
  { Icono: Search, texto: 'Buscando las leyes e iniciativas que lo tocan' },
  { Icono: Network, texto: 'Armando la matriz: fundamentos, contradicciones' },
];

/** Los tres pasos, por el tiempo que lleva. El servidor no reporta el paso: es una guía, no un reloj. */
function Cargando({ desde }) {
  const [ahora, setAhora] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setAhora(Date.now()), 1000); return () => clearInterval(t); }, []);
  const paso = pasoPorTiempo(Math.max(0, (ahora - (desde || ahora)) / 1000));
  return (
    <View style={{ paddingVertical: 8, gap: 8 }}>
      {PASOS.map(({ Icono, texto }, i) => (
        <Animated.View key={texto} entering={FadeInDown.duration(220).delay(i * 80)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, opacity: i > paso ? 0.4 : 1 }}>
          <View style={{ width: 22, alignItems: 'center' }}>
            {i < paso ? <Check size={15} color={TINTA} strokeWidth={2.6} /> : i === paso ? <MorphingInfinity size={16} color={TINTA} /> : <Icono size={15} color={INK.faint} strokeWidth={2.2} />}
          </View>
          <Text style={{ fontSize: 13, color: i === paso ? INK.title : INK.meta }}>{texto}</Text>
        </Animated.View>
      ))}
    </View>
  );
}

const ICONO_HECHO = { actor: User, hecho: CircleDot, fecha: Calendar, pretension: Target, evidencia: Paperclip };
const NOMBRE_HECHO = { actor: 'actor', hecho: 'hecho', fecha: 'fecha', pretension: 'pide', evidencia: 'prueba' };
const ENTRE = { caso_caso: 'en el relato', caso_ley: 'relato y ley', ley_ley: 'entre normas' };

function MatrizDelCaso({ r, onArticulo, onIniciativa, onPreguntar, onRehacer }) {
  return (
    <Animated.View entering={FadeInDown.duration(240)} layout={LinearTransition.duration(220)}
      style={{ marginTop: 4, marginBottom: 8, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: RAYA, backgroundColor: 'rgba(255,255,255,0.75)' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Network size={12} color={TINTA} strokeWidth={2.4} />
        <Text style={{ flex: 1, fontSize: 10, fontWeight: '800', letterSpacing: 0.9, color: TINTA }}>ANÁLISIS LEGAL DEL CASO</Text>
        {onRehacer ? (
          <Pressable onPress={() => { roce(); onRehacer(); }} hitSlop={8} accessibilityRole="button" accessibilityLabel="volver a analizar con la nota actualizada"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <RefreshCw size={12} color={TINTA} strokeWidth={2.4} />
            <Text style={{ fontSize: 11.5, color: TINTA }}>nota editada</Text>
          </Pressable>
        ) : null}
      </View>
      {r.resumen ? <Text style={{ fontSize: 14.5, lineHeight: 22, color: INK.title, marginTop: 8 }}>{r.resumen}</Text> : null}
      {r.secciones.map((s, i) => (
        <Seccion key={s.key} s={s} abiertaAlInicio={i < 2} refs={r.refs} onArticulo={onArticulo} onIniciativa={onIniciativa} onPreguntar={onPreguntar} />
      ))}
      {r.limitaciones.length ? <Text style={{ fontSize: 11.5, lineHeight: 17, color: INK.meta, marginTop: 12 }}>{r.limitaciones.join(' ')}</Text> : null}
    </Animated.View>
  );
}

function Seccion({ s, abiertaAlInicio, refs, onArticulo, onIniciativa, onPreguntar }) {
  const [abierta, setAbierta] = useState(abiertaAlInicio);
  return (
    <Animated.View layout={LinearTransition.duration(200)} style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: RAYA, paddingTop: 10 }}>
      <Pressable onPress={() => { roce(); setAbierta((v) => !v); }} accessibilityRole="button" accessibilityState={{ expanded: abierta }}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 28, opacity: pressed ? 0.6 : 1 })}>
        <Text style={[ROTULO, { flex: 1 }]}>{`${s.titulo.toUpperCase()} · ${s.items.length}`}</Text>
        {abierta ? <ChevronUp size={14} color={INK.faint} /> : <ChevronDown size={14} color={INK.faint} />}
      </Pressable>
      {abierta ? (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(100)} style={{ gap: 10, marginTop: 6 }}>
          {s.items.map((x, i) => (
            <Animated.View key={i} entering={FadeInDown.duration(180).delay(i * 30)}>
              <Elemento seccion={s.key} x={x} n={i + 1} refs={refs} onArticulo={onArticulo} onIniciativa={onIniciativa} onPreguntar={onPreguntar} />
            </Animated.View>
          ))}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

function Elemento({ seccion, x, n, refs, onArticulo, onIniciativa, onPreguntar }) {
  const citas = x.refs?.length ? <Referencias lista={x.refs} refs={refs} onArticulo={onArticulo} onIniciativa={onIniciativa} /> : null;
  if (seccion === 'hechos') {
    const Icono = ICONO_HECHO[x.tipo] || CircleDot;
    return (
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Icono size={14} color={INK.meta} strokeWidth={2.2} style={{ marginTop: 3 }} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: INK.meta, letterSpacing: 0.4 }}>{[NOMBRE_HECHO[x.tipo], x.fecha].filter(Boolean).join(' · ').toUpperCase()}</Text>
          <Text style={{ fontSize: 13.5, lineHeight: 20, color: INK.title }}>{x.texto}</Text>
        </View>
      </View>
    );
  }
  if (seccion === 'leyes_aplicables' || seccion === 'iniciativas_relacionadas') {
    return (
      <View style={{ gap: 4 }}>
        {citas}
        <Text style={{ fontSize: 13.5, lineHeight: 20, color: INK.body }}>{x.por_que || x.relacion}</Text>
      </View>
    );
  }
  if (seccion === 'incertidumbres') {
    return (
      <View>
        <Text style={{ fontSize: 13.5, lineHeight: 20, fontWeight: '600', color: INK.title }}>{x.pregunta}</Text>
        <Text style={{ fontSize: 13, lineHeight: 19, color: INK.body, marginTop: 2 }}>{x.por_que}</Text>
      </View>
    );
  }
  if (seccion === 'preguntas') {
    return (
      <Pressable onPress={() => { roce(); onPreguntar?.(x.pregunta); }} accessibilityRole="button" accessibilityLabel={`preguntar: ${x.pregunta}`}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', minHeight: 30, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15, backgroundColor: 'rgba(47,74,122,0.07)', opacity: pressed ? 0.6 : 1 })}>
        <MessageCircleQuestionMark size={13} color={TINTA} strokeWidth={2.2} />
        <Text style={{ flexShrink: 1, fontSize: 12.5, fontWeight: '600', color: TINTA }}>{x.pregunta}</Text>
      </Pressable>
    );
  }
  // fundamentos, contraargumentos, contradicciones
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Text style={{ width: 18, fontSize: 12, fontWeight: '800', color: TINTA, marginTop: 2 }}>{n}</Text>
      <View style={{ flex: 1, gap: 4 }}>
        {x.entre ? <Text style={{ fontSize: 11, fontWeight: '700', color: INK.meta, letterSpacing: 0.4 }}>{(ENTRE[x.entre] || '').toUpperCase()}</Text> : null}
        <Text style={{ fontSize: 13.5, lineHeight: 20, color: INK.title }}>{x.afirmacion || x.descripcion}</Text>
        {citas}
      </View>
    </View>
  );
}

/** Las normas citadas: un artículo abre su ley parada en él; una iniciativa, su ficha. En la misma hoja. */
function Referencias({ lista, refs, onArticulo, onIniciativa }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {lista.map((ref) => {
        const r = refs.get(ref);
        if (!r) return null;
        const art = r.tipo === 'articulo';
        const Icono = art ? BookOpen : ScrollText;
        const etiqueta = art ? `Art. ${r.numero}${r.ley ? ` · ${r.ley}` : ''}` : `Iniciativa ${r.numero}${r.etapa ? ` · ${r.etapa}` : ''}`;
        return (
          <Pressable key={ref} onPress={() => { roce(); if (art) { if (r.normaId) onArticulo?.(r); } else onIniciativa?.(r.numero); }}
            accessibilityRole="link" accessibilityLabel={`abrir ${etiqueta}`}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(47,74,122,0.08)', opacity: pressed ? 0.6 : 1 })}>
            <Icono size={11.5} color={TINTA} strokeWidth={2.2} />
            <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 12, fontWeight: '600', color: TINTA }}>{etiqueta}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
