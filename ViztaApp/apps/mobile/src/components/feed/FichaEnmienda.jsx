import { useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ChevronDown, ChevronUp, FileText, Landmark, MessageSquareText, Play, Scale, ScrollText, Users, X } from 'lucide-react-native';
import { INK, SERIF } from '../theme';
import { PAPEL } from '../codex/Papel';
import { ROTULO } from '../colaboradores/piezas';
import MorphingInfinity from '../MorphingInfinity';
import { roce } from '../../utils/haptics';
import { COLOR_VOTO } from './diputados';
import { normalizar, resultadoVotacion } from './organizacion';
import { legible } from './votaciones';
import { enlaceAlMomento, partesResaltadas, traerEnmienda, tramiteDe } from './enmiendas';
import { PillEstado } from './CaminoDecreto';

const TINTA = '#2F4A7A';
const RAYA = 'rgba(28,43,34,0.09)';
// Con año: el trámite de una iniciativa puede empezar años antes de la votación.
const fecha = (f) => (f ? new Date(`${String(f).slice(0, 10)}T12:00:00`).toLocaleDateString('es-GT', { day: 'numeric', month: 'short', year: 'numeric' }) : null);

const NOMBRE_RESULTADO = { aprobada: 'aprobada', no_aprobada: 'rechazada', sin_resultado: 'resultado sin confirmar' };
const ESTADO_LEY = { vigente: 'vigente', vetado: 'vetada', pendiente_sancion: 'pendiente de sanción', vigencia_diferida: 'vigencia diferida', derogada: 'derogada' };

/**
 * La ficha de una enmienda: a qué iniciativa, ley y artículo pertenece, quién
 * la propuso, qué decía antes, qué se propuso, qué significa y en qué quedó.
 *
 * Lo que la ficha de Poder Ciudadano no trae se dice que no está: no se
 * completa con otra cosa. El hemiciclo de su votación va al final, de apoyo.
 *
 * `apoyo` es la tarjeta de la votación; viene de quien abre la ficha para no
 * dibujar aquí otra versión de ella.
 */
export default function FichaEnmienda({ votacion, apoyo = null, onClose }) {
  if (!votacion) return null;
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <Ficha votacion={votacion} apoyo={apoyo} onClose={onClose} />
    </Modal>
  );
}

function Ficha({ votacion: v, apoyo, onClose }) {
  const insets = useSafeAreaInsets();
  const q = useQuery({ queryKey: ['enmienda', v.id], queryFn: () => traerEnmienda(v), staleTime: 30 * 60 * 1000 });
  const [ley, setLey] = useState(null);
  const d = q.data;
  const f = d?.ficha;
  const resultado = resultadoVotacion(v);
  return (
    <View style={{ flex: 1, backgroundColor: PAPEL }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 16, paddingHorizontal: 18, minHeight: 44 }}>
        <Text style={[ROTULO, { flex: 1 }]}>ENMIENDA</Text>
        <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cerrar" style={{ padding: 6 }}>
          <X size={19} color={INK.faint} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: insets.bottom + 40 }}>
        <Text accessibilityRole="header" style={{ fontFamily: SERIF, fontSize: 24, lineHeight: 29, color: INK.title, marginTop: 6 }}>
          {f?.titulo || legible(v.asunto)}
        </Text>
        <Resultado resultado={resultado} v={v} />

        {q.isLoading ? (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}><MorphingInfinity size={28} color={INK.meta} /></View>
        ) : q.isError ? (
          <Text style={{ fontSize: 13.5, color: INK.meta, marginTop: 18 }}>No se pudo traer la ficha. Puede intentarse de nuevo.</Text>
        ) : (
          <>
            {/* Verla en la sesión va siempre, arriba: es lo que hay aunque falte lo demás. */}
            {d?.video ? (
              <Pressable onPress={() => { roce(); Linking.openURL(enlaceAlMomento(d.video, f?.video_seg)).catch(() => {}); }}
                accessibilityRole="link" accessibilityLabel={f?.video_seg ? 'ver el momento en el video de la sesión' : 'ver el video de la sesión'}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 46, paddingHorizontal: 12, marginTop: 18, borderWidth: 1, borderColor: RAYA, borderRadius: 10, opacity: pressed ? 0.6 : 1 })}>
                <Play size={17} color={TINTA} />
                <Text style={{ color: TINTA, fontSize: 13, fontWeight: '600', flex: 1 }}>{f?.video_seg ? 'ver el momento en la sesión' : 'ver la sesión'}</Text>
              </Pressable>
            ) : null}
            {f?.resumen ? (
              <>
                <Seccion Icono={MessageSquareText}>EN SENCILLO</Seccion>
                <Text style={{ fontSize: 15.5, lineHeight: 23, color: INK.body }}>
                  {partesResaltadas(f.resumen).map((p, i) => (p.marca ? <Text key={i} style={{ fontWeight: '700', color: INK.title }}>{p.texto}</Text> : p.texto))}
                </Text>
              </>
            ) : null}

            {/* Cada parte va solo si hay algo que decir: lo que falta no se anuncia. */}
            <Pertenece d={d} onLey={setLey} />

            {(f?.proponentes || []).filter(Boolean).length ? (
              <>
                <Seccion Icono={Users}>PROPUESTA POR</Seccion>
                <Proponentes nombres={f.proponentes} />
              </>
            ) : null}

            {f?.texto_antes || f?.texto_propuesto ? (
              <>
                <Seccion Icono={FileText}>EL TEXTO</Seccion>
                <View style={{ gap: 12 }}>
                  {f.texto_antes ? <Bloque etiqueta={f.t_dice || 'Lo que decía antes'} texto={f.texto_antes} /> : null}
                  {f.texto_propuesto ? <Bloque etiqueta="Lo que se propuso" texto={f.texto_propuesto} propuesto /> : null}
                </View>
              </>
            ) : null}

            {f?.efecto ? (
              <>
                <Seccion Icono={Scale}>EFECTO</Seccion>
                <Text style={{ fontSize: 14.5, lineHeight: 21, color: INK.body }}>{f.efecto}</Text>
              </>
            ) : null}

            <Tramite iniciativa={d?.iniciativa} />

          </>
        )}

        {apoyo ? (
          <>
            <Seccion Icono={Landmark}>LA VOTACIÓN</Seccion>
            {apoyo}
          </>
        ) : null}
      </ScrollView>
      {ley ? <FichaLey normaId={ley} onClose={() => setLey(null)} /> : null}
    </View>
  );
}

// El buscador legal importa la parte del Congreso; se trae al abrir la ley
// para no cerrar un ciclo de importaciones.
function FichaLey(props) {
  const { FichaDeLey } = require('./BuscadorLegal'); // eslint-disable-line global-require
  return <FichaDeLey {...props} />;
}

function Seccion({ Icono, children }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 22, marginBottom: 8 }}>
      <Icono size={12} color={INK.faint} strokeWidth={2.4} />
      <Text style={ROTULO}>{children}</Text>
    </View>
  );
}

/** En qué quedó: el ícono del resultado, los votos y el día. */
function Resultado({ resultado, v }) {
  const color = resultado === 'aprobada' ? COLOR_VOTO.favor : resultado === 'no_aprobada' ? COLOR_VOTO.contra : INK.meta;
  const votos = [v.a_favor != null ? `${v.a_favor} a favor` : null, v.en_contra != null ? `${v.en_contra} en contra` : null].filter(Boolean).join(', ');
  return (
    <Text style={{ fontSize: 13, color: INK.meta, marginTop: 10 }}>
      <Text style={{ color, fontWeight: '700' }}>{NOMBRE_RESULTADO[resultado]}</Text>
      {[votos, fecha(v.fecha)].filter(Boolean).map((t) => ` · ${t}`).join('')}
    </Text>
  );
}

/**
 * La iniciativa, la ley y el artículo. Cada uno sale de la ficha o del asunto
 * de la votación; si ninguno lo dice, se dice que no está identificado.
 */
function Pertenece({ d, onLey }) {
  const ini = d?.iniciativa;
  const articulo = d?.ficha?.articulo || d?.asunto?.articulo;
  const norma = ini?.norma;
  const filas = [
    d?.numero ? <Fila key="ini" etiqueta="Iniciativa">{`${d.numero}${ini?.titulo ? ` · ${limpiar(ini.titulo)}` : ''}`}</Fila> : null,
    ini?.decreto_resultante ? (
      <View key="ley" style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <Text style={{ width: 70, fontSize: 12.5, color: INK.meta }}>Ley</Text>
        <Text style={{ fontSize: 14, color: INK.title }}>{`Decreto ${ini.decreto_resultante}`}</Text>
        {norma?.estado ? <PillEstado estado={norma.estado}>{ESTADO_LEY[norma.estado] || norma.estado}</PillEstado> : null}
      </View>
    ) : null,
    articulo ? <Fila key="art" etiqueta="Artículo">{`${articulo} del proyecto`}</Fila> : null,
    d?.asunto?.clase ? <Fila key="tipo" etiqueta="Tipo">{`enmienda ${d.asunto.clase}`}</Fila> : null,
  ].filter(Boolean);
  if (!filas.length) return null;
  return (
    <>
      <Seccion Icono={ScrollText}>A QUÉ PERTENECE</Seccion>
      <View style={{ gap: 8 }}>
        {filas}
        {norma?.id && norma.indexado ? (
          <Pressable onPress={() => { roce(); onLey(norma.id); }} accessibilityRole="button" accessibilityLabel={`abrir la ficha del Decreto ${ini.decreto_resultante}`}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, alignSelf: 'flex-start', opacity: pressed ? 0.5 : 1 })}>
            <Text style={{ fontSize: 13, color: TINTA, fontWeight: '600' }}>ficha de la ley</Text>
            <ArrowRight size={14} color={TINTA} />
          </Pressable>
        ) : null}
      </View>
    </>
  );
}

const limpiar = (t) => String(t || '').replace(/^iniciativa que dispone aprobar\s+/i, '').replace(/\.$/, '').replace(/^./, (c) => c.toUpperCase());

function Fila({ etiqueta, children }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Text style={{ width: 70, fontSize: 12.5, color: INK.meta, paddingTop: 1 }}>{etiqueta}</Text>
      <Text style={{ flex: 1, fontSize: 14, lineHeight: 20, color: INK.title }}>{children}</Text>
    </View>
  );
}

const VISIBLES = 3;

function Proponentes({ nombres }) {
  const [todos, setTodos] = useState(false);
  const lista = (nombres || []).filter(Boolean);
  if (!lista.length) return null;
  const vistos = todos ? lista : lista.slice(0, VISIBLES);
  const Flecha = todos ? ChevronUp : ChevronDown;
  return (
    <View>
      <Text style={{ fontSize: 14, lineHeight: 21, color: INK.title }}>{vistos.join(' · ')}</Text>
      {lista.length > VISIBLES ? (
        <Pressable onPress={() => setTodos(!todos)} accessibilityRole="button" accessibilityState={{ expanded: todos }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, alignSelf: 'flex-start' }}>
          <Text style={{ fontSize: 12, color: INK.meta }}>{todos ? 'ocultar' : `${lista.length - VISIBLES} más`}</Text>
          <Flecha size={13} color={INK.meta} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Un texto con su etiqueta; lo propuesto, con la raya en tinta. */
function Bloque({ etiqueta, texto, propuesto = false }) {
  return (
    <View style={{ borderLeftWidth: 2, borderLeftColor: propuesto ? TINTA : RAYA, paddingLeft: 12 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.4, color: propuesto ? TINTA : INK.faint }}>{etiqueta.toUpperCase()}</Text>
      <Text selectable style={{ fontSize: 14.5, lineHeight: 21, color: propuesto ? INK.title : INK.meta, marginTop: 4 }}>{texto}</Text>
    </View>
  );
}

/**
 * El trámite de la iniciativa: lo de comisión (hasta el dictamen) aparte de
 * lo del pleno. Un paso que solo cuenta la prensa lo dice.
 */
function Tramite({ iniciativa }) {
  const { comision, pleno } = tramiteDe(iniciativa?.eventos_timeline);
  if (!comision.length && !pleno.length) return null;
  return (
    <>
      <Seccion Icono={ScrollText}>TRÁMITE DE LA INICIATIVA</Seccion>
      {comision.length ? <Pasos titulo="Hasta el dictamen" pasos={comision} /> : null}
      {pleno.length ? <Pasos titulo="Después del dictamen" pasos={pleno} /> : null}
    </>
  );
}

function Pasos({ titulo, pasos }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: INK.meta, marginBottom: 4 }}>{titulo}</Text>
      {pasos.map((p) => (
        <View key={`${p.tipo}-${p.fecha}`} style={{ flexDirection: 'row', gap: 10, paddingVertical: 3 }}>
          <Text style={{ width: 92, fontSize: 12, color: INK.faint }}>{fecha(p.fecha)}</Text>
          <Text style={{ flex: 1, fontSize: 13, lineHeight: 18, color: INK.title }}>
            {p.nombre}
            {p.comision && normalizar(p.nombre).includes('comision') ? <Text style={{ color: INK.meta }}>{` · ${p.comision}`}</Text> : null}
            {p.prensa ? <Text style={{ color: INK.faint }}> · según prensa</Text> : null}
          </Text>
        </View>
      ))}
    </View>
  );
}
