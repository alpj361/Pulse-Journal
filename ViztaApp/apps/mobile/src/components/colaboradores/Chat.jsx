import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ArrowUp, Plus, SlidersHorizontal } from 'lucide-react-native';
import { INK, MOTION } from '../theme';
import { EV, evento } from '../../utils/analitica';
import { supabase } from '../../utils/supabase';
import { abrirChat, chatDe, enviarMensaje, leerMensajes, seguimientosDe, tareasDe } from './api';
import { claveTareas } from './Ficha';
import { bloquesDe, esMio, esperandoAgente, haciendoAhora, seVe, unirMensajes } from './logica';
import Bloque from './Bloques';
import SuCodex from './SuCodex';
import Adjuntar from './Adjuntar';
import { Sigue } from './Seguimientos';
import { Cabecera, TONO, nombreDe } from './piezas';
import MorphingInfinity from '../MorphingInfinity';

const PESTANAS = [
  { clave: 'chat', texto: 'Chat' },
  { clave: 'codex', texto: 'Su Codex' },
  { clave: 'sigue', texto: 'Sigue' },
];

/**
 * Lo nuevo entra en vivo (Realtime sobre `mensajes`). La consulta periódica
 * queda de respaldo, por si el canal se corta.
 */
const CADA = 30000;

/**
 * El chat con un colaborador (pantallas 4 y 8): Chat y Su Codex, en pestañas.
 * «Compartido» entra con la fase de compartir.
 */
export default function Chat({ colaborador, yo, borrador, topInset, bottomInset, onVolver, onPermisos, onPerfil, onAbrirArtifact, onAbrirSeguimiento, pestanaInicial }) {
  const [pestana, setPestana] = useState(pestanaInicial || 'chat');
  // Qué está haciendo ahora, bajo su nombre. Sin backend, `null`.
  const tareas = useQuery({
    queryKey: claveTareas(colaborador.id),
    queryFn: () => tareasDe(colaborador.id),
    enabled: colaborador.cuenta_tipo === 'agente',
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
    retry: false,
  });
  // Lo que sigue el agente. `null`: el servidor todavía no lo tiene, y la
  // pestaña no aparece.
  const seguimientos = useQuery({
    queryKey: ['colab-seguimientos', colaborador.id],
    queryFn: () => seguimientosDe(colaborador.id),
    enabled: colaborador.cuenta_tipo === 'agente',
    staleTime: 1000 * 60,
    refetchInterval: 1000 * 60 * 2,
    retry: false,
  });
  const conSigue = seguimientos.data != null || (seguimientos.isLoading && pestana === 'sigue');
  const pestanas = PESTANAS.filter((p) => p.clave !== 'sigue' || conSigue);
  // Un pedido armado desde Su Codex (p. ej. «proponeme unirlo»): abre el chat
  // con el texto escrito, sin mandarlo.
  const [pedido, setPedido] = useState(null);
  const [abrirId, setAbrirId] = useState(null);
  const nombre = nombreDe(colaborador);
  const esAgente = colaborador.cuenta_tipo === 'agente';

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingBottom: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: TONO.raya }}>
        <Cabecera
          colaborador={colaborador}
          subtitulo={esAgente ? haciendoAhora(tareas.data) || 'agente · responde a vos' : null}
          onVolver={onVolver}
          volverLabel="Volver a Colaboradores"
          onTocar={esAgente ? onPerfil : undefined}
          topInset={topInset}
          derecha={
            <Pressable
              onPress={onPermisos}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Qué puede hacer ${nombre}`}
              style={({ pressed }) => ({ width: 44, height: 44, marginRight: -8, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}
            >
              <SlidersHorizontal size={20} color={INK.body} strokeWidth={1.8} />
            </Pressable>
          }
        />
        <View
          accessibilityRole="tablist"
          style={{ marginHorizontal: 20, flexDirection: 'row', gap: 4, padding: 4, backgroundColor: 'rgba(28,43,34,0.06)', borderRadius: 12 }}
        >
          {pestanas.map((p) => {
            const activa = p.clave === pestana;
            return (
              <Pressable
                key={p.clave}
                onPress={() => setPestana(p.clave)}
                accessibilityRole="tab"
                accessibilityState={{ selected: activa }}
                style={{ flex: 1, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: activa ? '#FFFFFF' : 'transparent' }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Text style={{ fontSize: 13.5, fontWeight: activa ? '700' : '600', color: activa ? INK.title : '#6B786F' }}>{p.texto}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {pestana === 'chat' ? (
        <Conversacion
          colaborador={colaborador}
          yo={yo}
          borrador={pedido || borrador}
          onAbrirSeguimiento={(sid) => {
            const s = (seguimientos.data || []).find((x) => x.id === sid);
            if (s) onAbrirSeguimiento?.(s);
            else setPestana('sigue');
          }}
          onAbrirArtifact={onAbrirArtifact}
          bottomInset={bottomInset}
          onAbrirItem={(id) => {
            setAbrirId(id);
            setPestana('codex');
          }}
        />
      ) : pestana === 'sigue' ? (
        <Sigue consulta={seguimientos} nombre={nombreDe(colaborador)} bottomInset={bottomInset} onAbrir={(s) => onAbrirSeguimiento?.(s)} />
      ) : (
        <SuCodex
          colaborador={colaborador}
          bottomInset={bottomInset}
          abrirId={abrirId}
          onAbierto={() => setAbrirId(null)}
          onPedir={(texto) => {
            setPedido(texto);
            setPestana('chat');
          }}
        />
      )}
    </View>
  );
}

function Conversacion({ colaborador, yo, borrador, bottomInset, onAbrirItem, onAbrirArtifact, onAbrirSeguimiento }) {
  const queryClient = useQueryClient();
  const nombre = nombreDe(colaborador);
  // Si la lista ya trae la conversación, se abre sin esperar a nada.
  const [convId, setConvId] = useState(() => colaborador?.ultimo_mensaje?.conversacion_id || null);
  const [resuelto, setResuelto] = useState(() => !!colaborador?.ultimo_mensaje?.conversacion_id);
  const [viejos, setViejos] = useState([]);
  // `undefined`: todavía no se pidió más atrás; `null`: no hay más.
  const [cursor, setCursor] = useState(undefined);
  const [cargandoViejos, setCargandoViejos] = useState(false);
  // Un borrador llega cuando se abre el chat para pedirle algo (p. ej. que
  // vuelva a proponer un cambio): queda escrito, no se manda solo.
  const [texto, setTexto] = useState(borrador || '');
  const [enviando, setEnviando] = useState(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    let vivo = true;
    chatDe(colaborador).then((id) => {
      if (!vivo) return;
      setConvId(id);
      setResuelto(true);
    });
    return () => {
      vivo = false;
    };
  }, [colaborador]);

  // Los mensajes que entraron en vivo: se animan al aparecer.
  const [llegados, setLlegados] = useState(() => new Set());

  // En vivo: cada mensaje nuevo de esta conversación entra sin reabrir el chat.
  useEffect(() => {
    if (!convId) return undefined;
    const canal = supabase
      .channel(`colab-chat-${convId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes', filter: `conversacion_id=eq.${convId}` }, ({ new: m }) => {
        if (!m?.id || m.ciphertext) return;
        setLlegados((prev) => new Set(prev).add(m.id));
        setViejos((prev) => unirMensajes(prev, [m]));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversaciones', filter: `id=eq.${convId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['colab-lista'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [convId, queryClient]);

  // Sin chat todavía: si el agente lo abre primero, se engancha solo.
  useEffect(() => {
    if (convId || !resuelto) return undefined;
    const canal = supabase
      .channel(`colab-chat-nuevo-${colaborador.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversacion_participantes', filter: `cuenta_id=eq.${colaborador.cuenta_id}` },
        ({ new: p }) => {
          if (p?.conversacion_id) setConvId(p.conversacion_id);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [convId, resuelto, colaborador.id, colaborador.cuenta_id]);

  const recientes = useQuery({
    queryKey: ['colab-mensajes', convId],
    queryFn: () => leerMensajes(convId, { limit: 30 }),
    enabled: !!convId,
    refetchInterval: CADA,
    staleTime: 0,
  });

  const mensajes = useMemo(() => {
    const base = unirMensajes(viejos, recientes.data?.mensajes);
    return enviando ? [...base, enviando] : base;
  }, [viejos, recientes.data, enviando]);

  const cursorActual = cursor === undefined ? recientes.data?.next_cursor : cursor;

  const cargarViejos = useCallback(async () => {
    if (!convId || !cursorActual || cargandoViejos) return;
    setCargandoViejos(true);
    try {
      const r = await leerMensajes(convId, { limit: 30, antes: cursorActual });
      setViejos((prev) => unirMensajes(r.mensajes, prev));
      setCursor(r.next_cursor || null);
    } catch {
      // Se vuelve a intentar al llegar otra vez arriba.
    } finally {
      setCargandoViejos(false);
    }
  }, [convId, cursorActual, cargandoViejos]);

  const [adjuntando, setAdjuntando] = useState(false);

  // Texto, adjuntos o los dos. Los adjuntos llegan de la hoja de adjuntar.
  const enviar = async (adjuntos = []) => {
    const limpio = texto.trim();
    if ((!limpio && !adjuntos.length) || enviando) return;
    setFallo(false);
    setTexto('');
    setEnviando({ id: 'enviando', autor_tipo: yo.tipo, autor_id: yo.id, cuerpo: limpio || null, adjuntos, created_at: new Date().toISOString() });
    try {
      const id = convId || (await abrirChat(colaborador));
      if (id !== convId) setConvId(id);
      const mensaje = await enviarMensaje(id, { texto: limpio, adjuntos });
      if (mensaje) setViejos((prev) => unirMensajes(prev, [mensaje]));
      evento(EV.COLAB_MENSAJE_ENVIADO, { a: colaborador.cuenta_tipo });
      queryClient.invalidateQueries({ queryKey: ['colab-mensajes', id] });
      queryClient.invalidateQueries({ queryKey: ['colab-lista'] });
    } catch {
      setTexto(limpio);
      setFallo(true);
    } finally {
      setEnviando(null);
    }
  };

  const espera = esperandoAgente(mensajes, yo, colaborador.cuenta_tipo);
  // Invertida: lo nuevo abajo y el teclado no lo tapa.
  const invertidos = useMemo(() => mensajes.filter(seVe).reverse(), [mensajes]);
  const cargando = !resuelto || (convId && recientes.isLoading);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {cargando ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <MorphingInfinity size={28} color={INK.meta} />
        </View>
      ) : !invertidos.length ? (
        <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 36 }}>
          <Text style={{ fontSize: 14, lineHeight: 20, color: INK.body, textAlign: 'center' }}>
            {colaborador.cuenta_tipo === 'agente'
              ? `Lo que le escribas a ${nombre} le llega cuando se conecte.`
              : `Todavía no se escribieron con ${nombre}.`}
          </Text>
        </View>
      ) : (
        <FlatList
          inverted
          data={invertidos}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ paddingHorizontal: 18, paddingVertical: 12 }}
          ItemSeparatorComponent={() => <View style={{ height: 9 }} />}
          ListHeaderComponent={espera ? <Pendiente /> : null}
          ListFooterComponent={cargandoViejos ? <MorphingInfinity size={20} color={INK.meta} style={{ marginVertical: 12, alignSelf: 'center' }} /> : null}
          onEndReached={cargarViejos}
          onEndReachedThreshold={0.3}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Mensaje
              mensaje={item}
              mio={esMio(item, yo)}
              onAbrirItem={onAbrirItem}
              onAbrirArtifact={onAbrirArtifact}
              onAbrirSeguimiento={onAbrirSeguimiento}
              enviando={item.id === 'enviando'}
              enVivo={llegados.has(item.id)}
            />
          )}
        />
      )}

      {fallo ? (
        <Text style={{ paddingHorizontal: 20, paddingTop: 6, fontSize: 12.5, color: TONO.rojo }}>No se pudo enviar. Probá de nuevo.</Text>
      ) : null}

      <View
        style={{
          paddingHorizontal: 14,
          paddingTop: 10,
          paddingBottom: bottomInset + 12,
          flexDirection: 'row',
          gap: 8,
          alignItems: 'flex-end',
          borderTopWidth: 1,
          borderTopColor: TONO.raya,
        }}
      >
        <Pressable
          onPress={() => setAdjuntando(true)}
          accessibilityRole="button"
          accessibilityLabel="Adjuntar"
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: TONO.borde,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Plus size={18} color={TONO.verde} strokeWidth={2.2} />
        </Pressable>
        <TextInput
          value={texto}
          onChangeText={setTexto}
          placeholder={`Escribile a ${nombre}`}
          placeholderTextColor={INK.faint}
          accessibilityLabel={`Escribile a ${nombre}`}
          multiline
          maxLength={20000}
          style={{
            flex: 1,
            minHeight: 44,
            maxHeight: 130,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: TONO.borde,
            backgroundColor: 'rgba(255,255,255,0.8)',
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: 12,
            fontSize: 15,
            color: INK.title,
          }}
        />
        <Pressable
          onPress={() => enviar()}
          disabled={!texto.trim() || !!enviando}
          accessibilityRole="button"
          accessibilityLabel="Enviar"
          accessibilityState={{ disabled: !texto.trim() || !!enviando }}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: TONO.verde,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: !texto.trim() || enviando ? 0.4 : pressed ? 0.7 : 1,
          })}
        >
          <ArrowUp size={18} color="#FFFFFF" strokeWidth={2.2} />
        </Pressable>
      </View>
      {adjuntando ? (
        <Adjuntar
          userId={yo.id}
          bottomInset={bottomInset}
          onCerrar={() => setAdjuntando(false)}
          onAdjuntar={(adjuntos) => {
            setAdjuntando(false);
            enviar(adjuntos);
          }}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

function Mensaje({ mensaje, mio, onAbrirItem, onAbrirArtifact, onAbrirSeguimiento, enviando, enVivo }) {
  const bloques = bloquesDe(mensaje);
  // Lo que llega en vivo sube desde abajo (la lista está invertida).
  return (
    <Animated.View
      entering={enVivo ? FadeInDown.springify().damping(MOTION.enter.damping).stiffness(MOTION.enter.stiffness) : undefined}
      style={{ gap: 6, opacity: enviando ? 0.55 : 1 }}
    >
      {bloques.map((b) => (
        <Bloque key={b.id} bloque={b} mio={mio} onAbrirItem={onAbrirItem} onAbrirArtifact={onAbrirArtifact} onAbrirSeguimiento={onAbrirSeguimiento} />
      ))}
    </Animated.View>
  );
}

/** El agente todavía no leyó lo último: lo hace cuando se conecte. */
function Pendiente() {
  const punto = { width: 5, height: 5, borderRadius: 3, backgroundColor: INK.faint };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10, paddingHorizontal: 2 }}>
      <View style={{ flexDirection: 'row', gap: 3 }} accessible={false}>
        <View style={punto} />
        <View style={punto} />
        <View style={punto} />
      </View>
      <Text style={{ fontSize: 12.5, color: INK.meta, fontStyle: 'italic' }}>Te responde cuando se conecte</Text>
    </View>
  );
}
