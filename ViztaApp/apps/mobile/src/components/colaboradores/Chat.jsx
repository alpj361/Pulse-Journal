import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { ArrowUp, FolderOpen, Plus, SlidersHorizontal } from 'lucide-react-native';
import { INK, MOTION } from '../theme';
import { EV, evento } from '../../utils/analitica';
import { falla, roce, toque } from '../../utils/haptics';
import { useEnVivo } from '../../utils/enVivo';
import { supabase } from '../../utils/supabase';
import { abrirChat, chatDe, enviarMensaje, leerMensajes, seguimientosDe, tareasDe } from './api';
import { claveTareas } from './Ficha';
import { bloquesDe, esContacto, esMio, haciendoAhora, seVe, unirMensajes } from './logica';
import Bloque from './Bloques';
import SuCodex from './SuCodex';
import Adjuntar from './Adjuntar';
import { Sigue } from './Seguimientos';
import AbrirMio from './AbrirMio';
import Reenviar from './Reenviar';
import Compartido from './Compartido';
import Monitoreo from './Monitoreo';
import { Cabecera, TONO, nombreDe } from './piezas';
import MorphingInfinity from '../MorphingInfinity';
import AccionAgente, { Escribiendo } from './AccionAgente';
import { aparecer, correrse, llegaMensaje, quedaEnviado } from './movimiento';
import { agruparAcciones, idsDeAgente, traerAccionesDe, useTrabajando } from './actividad';

const PESTANAS = [
  { clave: 'chat', texto: 'Chat' },
  { clave: 'codex', texto: 'Su Codex' },
  { clave: 'sigue', texto: 'Sigue' },
];
/** Con una persona no hay Codex suyo: está lo que se compartieron. */
const PESTANAS_PERSONA = [
  { clave: 'chat', texto: 'Chat' },
  { clave: 'compartido', texto: 'Compartido' },
];


/**
 * La última pestaña que se vio de cada colaborador: al volver a su chat se
 * abre donde quedó (Su Codex, Sigue), mientras la app siga abierta.
 */
const ULTIMA_PESTANA = new Map();

/**
 * Lo nuevo entra en vivo (Realtime sobre `mensajes`). La consulta periódica
 * queda de respaldo, por si el canal se corta.
 */
const CADA = 30000;

/** Hasta cuánto un mensaje sin respuesta cuenta como «te está escribiendo». */
const POR_RESPONDER_MS = 10 * 60 * 1000;

/**
 * El chat con un colaborador (pantallas 4 y 8). Con un agente tuyo: Chat, Su
 * Codex y Sigue. Con una persona: Chat y Compartido. Con el agente de otra
 * persona (contacto): solo el chat.
 */
export default function Chat({ colaborador, yo, borrador, topInset, bottomInset, onVolver, onPermisos, onPerfil, onAbrirEspacio, onAbrirArtifact, onAbrirSeguimiento, onAbrirContacto, pestanaInicial }) {
  const esPersona = colaborador.cuenta_tipo === 'humano';
  const contacto = esContacto(colaborador);
  const [pestana, setPestanaLocal] = useState(() => (contacto ? 'chat' : pestanaInicial || ULTIMA_PESTANA.get(colaborador.id) || 'chat'));
  // Un monitoreo que llegó por el chat o en «Compartido».
  const [monitoreo, setMonitoreo] = useState(null);
  const [abriendoCompartido, setAbriendoCompartido] = useState(null);
  const setPestana = useCallback(
    (p) => {
      ULTIMA_PESTANA.set(colaborador.id, p);
      setPestanaLocal(p);
    },
    [colaborador.id],
  );
  // Qué está haciendo ahora, bajo su nombre. Sin backend, `null`.
  const tareas = useQuery({
    queryKey: claveTareas(colaborador.id),
    queryFn: () => tareasDe(colaborador.id),
    enabled: colaborador.cuenta_tipo === 'agente' && !contacto,
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
    retry: false,
  });
  // Lo que sigue el agente. `null`: el servidor todavía no lo tiene, y la
  // pestaña no aparece.
  const seguimientos = useQuery({
    queryKey: ['colab-seguimientos', colaborador.id],
    queryFn: () => seguimientosDe(colaborador.id),
    enabled: colaborador.cuenta_tipo === 'agente' && !contacto,
    staleTime: 1000 * 60,
    refetchInterval: 1000 * 60 * 2,
    retry: false,
  });
  const conSigue = seguimientos.data != null || (seguimientos.isLoading && pestana === 'sigue');
  const pestanas = contacto ? [] : esPersona ? PESTANAS_PERSONA : PESTANAS.filter((p) => p.clave !== 'sigue' || conSigue);
  // Si quedó en «Sigue» y el agente ya no sigue nada, vuelve al chat.
  useEffect(() => {
    if (pestana === 'sigue' && !conSigue) setPestana('chat');
  }, [pestana, conSigue, setPestana]);
  // Un pedido armado desde Su Codex (p. ej. «proponeme unirlo»): abre el chat
  // con el texto escrito, sin mandarlo.
  const [pedido, setPedido] = useState(null);
  const [abrirId, setAbrirId] = useState(null);
  const nombre = nombreDe(colaborador);
  const esAgente = colaborador.cuenta_tipo === 'agente' && !contacto;
  const trabajando = useTrabajando(esAgente ? colaborador : null, tareas.data);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingBottom: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: TONO.raya }}>
        <Cabecera
          colaborador={colaborador}
          subtitulo={esAgente ? haciendoAhora(tareas.data) : contacto && colaborador.owner_nombre ? `de ${colaborador.owner_nombre}` : null}
          trabajando={trabajando}
          onVolver={onVolver}
          volverLabel="Volver a Colaboradores"
          topInset={topInset}
          derecha={
            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: -8 }}>
              {/* La carpeta abre lo suyo (tareas, fuentes, espacios); los ajustes, solo permisos y avisos. */}
              {esAgente ? (
                <Pressable
                  onPress={onPerfil}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`Tareas, fuentes y espacios de ${nombre}`}
                  style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}
                >
                  <FolderOpen size={21} color={INK.body} strokeWidth={1.8} />
                </Pressable>
              ) : null}
              {contacto ? null : (
              <Pressable
                onPress={onPermisos}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`Qué puede hacer ${nombre}`}
                style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}
              >
                <SlidersHorizontal size={20} color={INK.body} strokeWidth={1.8} />
              </Pressable>
              )}
            </View>
          }
        />
        {pestanas.length ? (
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
        ) : null}
      </View>

      {pestana === 'chat' ? (
        <Conversacion
          colaborador={colaborador}
          yo={yo}
          topInset={topInset}
          borrador={pedido || borrador}
          onAbrirSeguimiento={(sid) => {
            const s = (seguimientos.data || []).find((x) => x.id === sid);
            if (s) onAbrirSeguimiento?.(s);
            else setPestana('sigue');
          }}
          onAbrirArtifact={onAbrirArtifact}
          onAbrirEspacio={onAbrirEspacio}
          conAcciones={esAgente}
          trabajando={trabajando}
          onAbrirMonitoreo={setMonitoreo}
          onAbrirContacto={onAbrirContacto}
          bottomInset={bottomInset}
          // Lo de un agente tuyo se abre en Su Codex; lo de una persona o de un
          // agente ajeno, en lectura ahí mismo.
          onAbrirItem={
            esAgente
              ? (id) => {
                  setAbrirId(id);
                  setPestana('codex');
                }
              : null
          }
        />
      ) : pestana === 'compartido' ? (
        <Compartido
          colaborador={colaborador}
          bottomInset={bottomInset}
          onAbrirArtifact={onAbrirArtifact}
          onAbrirMonitoreo={setMonitoreo}
          onAbrirItem={(id, ajeno) => setAbriendoCompartido({ id, ajeno })}
        />
      ) : pestana === 'sigue' ? (
        <Sigue consulta={seguimientos} nombre={nombreDe(colaborador)} bottomInset={bottomInset} onAbrir={(s) => onAbrirSeguimiento?.(s)} />
      ) : (
        <SuCodex
          colaborador={colaborador}
          bottomInset={bottomInset}
          abrirId={abrirId}
          onAbierto={() => setAbrirId(null)}
          onAbrirEspacio={onAbrirEspacio}
          onAbrirArtifact={onAbrirArtifact}
          onPedir={(texto) => {
            setPedido(texto);
            setPestana('chat');
          }}
        />
      )}
      {abriendoCompartido ? (
        <AbrirMio id={abriendoCompartido.id} ajeno={abriendoCompartido.ajeno} topInset={topInset} bottomInset={bottomInset} onClose={() => setAbriendoCompartido(null)} />
      ) : null}
      {monitoreo ? <Monitoreo id={monitoreo} bottomInset={bottomInset} onCerrar={() => setMonitoreo(null)} /> : null}
    </View>
  );
}

function Conversacion({ colaborador, yo, borrador, topInset, bottomInset, onAbrirItem, onAbrirArtifact, onAbrirEspacio, conAcciones, trabajando, onAbrirSeguimiento, onAbrirMonitoreo, onAbrirContacto }) {
  // Algo mío que le compartí: se abre con su propia pantalla.
  const [mioAbierto, setMioAbierto] = useState(null);
  // Mantener presionado un adjunto: reenviarlo a otro chat.
  const [reenviando, setReenviando] = useState(null);
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

  // Los mensajes que entraron en vivo: se animan al aparecer. Los tuyos, ya
  // guardados, solo terminan de encenderse (`confirmados`): no vuelven a entrar.
  const [llegados, setLlegados] = useState(() => new Set());
  const [confirmados, setConfirmados] = useState(() => new Set());

  // En vivo: cada mensaje nuevo de esta conversación entra sin reabrir el chat.
  useEffect(() => {
    if (!convId) return undefined;
    const canal = supabase
      .channel(`colab-chat-${convId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes', filter: `conversacion_id=eq.${convId}` }, ({ new: m }) => {
        if (!m?.id || m.ciphertext) return;
        if (esMio(m, yo)) {
          setConfirmados((prev) => new Set(prev).add(m.id));
        } else {
          setLlegados((prev) => new Set(prev).add(m.id));
          // Lo que llega con el chat abierto se siente, apenas.
          roce();
        }
        setViejos((prev) => unirMensajes(prev, [m]));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversaciones', filter: `id=eq.${convId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['colab-lista'] });
      })
      // Lo que el agente te debe contestar: entra al mandarle algo, sale al responder.
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cola_agente_chat', filter: `conversacion_id=eq.${convId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['colab-por-responder', convId] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [convId, queryClient, yo]);

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
    toque();
    setEnviando({ id: 'enviando', autor_tipo: yo.tipo, autor_id: yo.id, cuerpo: limpio || null, adjuntos, created_at: new Date().toISOString() });
    try {
      const id = convId || (await abrirChat(colaborador));
      if (id !== convId) setConvId(id);
      const mensaje = await enviarMensaje(id, { texto: limpio, adjuntos });
      if (mensaje) {
        setConfirmados((prev) => new Set(prev).add(mensaje.id));
        setViejos((prev) => unirMensajes(prev, [mensaje]));
      }
      evento(EV.COLAB_MENSAJE_ENVIADO, { a: colaborador.cuenta_tipo });
      queryClient.invalidateQueries({ queryKey: ['colab-mensajes', id] });
      queryClient.invalidateQueries({ queryKey: ['colab-lista'] });
      queryClient.invalidateQueries({ queryKey: ['colab-por-responder', id] });
    } catch {
      setTexto(limpio);
      setFallo(true);
      falla();
    } finally {
      setEnviando(null);
    }
  };

  // Lo que el agente hizo (creó, editó, sumó a un espacio), contado entre
  // los mensajes, con enlace a cada cosa. Sale de su actividad por MCP.
  const idsAgente = conAcciones ? idsDeAgente(colaborador) : [];
  const acciones = useQuery({
    queryKey: ['colab-acciones', idsAgente.join(',')],
    queryFn: () => traerAccionesDe(idsAgente, new Date(Date.now() - 30 * 86400000).toISOString()),
    enabled: idsAgente.length > 0,
    staleTime: 10 * 1000,
    // Mientras trabaja se mira seguido; quieto, de vez en cuando. Lo que toca
    // en vivo (`colab_cambios`) llega antes por el canal.
    refetchInterval: trabajando ? 5 * 1000 : 30 * 1000,
    retry: false,
  });
  // El servidor anota la acción al terminar la herramienta, un poco después
  // del cambio: se pide al momento y otra vez enseguida.
  const pedirAcciones = acciones.refetch;
  useEnVivo(['colab_cambios'], () => {
    pedirAcciones();
    setTimeout(() => pedirAcciones(), 2500);
  }, { espera: 600, activo: idsAgente.length > 0 });
  // Escribiendo: te debe una respuesta reciente (tu mensaje sigue en su cola
  // desde hace menos de 10 minutos) y está activo. Lo que quedó sin contestar
  // de otro día no cuenta, y si solo crea o edita cosas no está escribiendo:
  // eso se ve en el diamante de arriba, al lado de su nombre.
  const porResponder = useQuery({
    queryKey: ['colab-por-responder', convId],
    queryFn: async () => {
      const { data } = await supabase.from('cola_agente_chat').select('id').eq('conversacion_id', convId).eq('estado', 'pendiente')
        .gte('created_at', new Date(Date.now() - POR_RESPONDER_MS).toISOString()).limit(1);
      return !!data?.length;
    },
    enabled: !!convId && !!conAcciones,
    staleTime: 10 * 1000,
    refetchInterval: 30 * 1000,
    retry: false,
  });
  const escribiendo = !!conAcciones && !!trabajando && !!porResponder.data;
  const abrirCosa = (ref, titulo) => {
    roce();
    if (ref.tabla === 'spaces') onAbrirEspacio?.({ id: ref.id, name: titulo, nombre: titulo });
    else if (ref.tabla === 'artifacts') onAbrirArtifact?.(ref.id);
    else setMioAbierto({ id: ref.id, ajeno: false });
  };

  const visibles = useMemo(() => mensajes.filter(seVe), [mensajes]);
  const grupos = useMemo(() => {
    // Si hay mensajes más viejos sin cargar, las acciones de antes esperan a
    // que lleguen: si no, quedarían arriba de una conversación cortada.
    const desde = cursorActual && visibles.length ? visibles[0].created_at : '';
    return agruparAcciones(
      (acciones.data || []).filter((a) => a.en >= desde),
      visibles.map((m) => m.created_at),
    ).map((g) => ({ ...g, created_at: g.hasta, _accion: true }));
  }, [visibles, acciones.data, cursorActual]);

  // Qué acciones son nuevas: las que llegan después de abrir el chat. Las que
  // ya estaban no se animan; las nuevas entran, y un renglón que crece suma
  // sus cosas una a una.
  const conocidas = useRef(null);
  const [frescas, setFrescas] = useState({ grupos: new Set(), cosas: new Set() });
  const claveCosa = (c) => c.ref?.id || c.id;
  useEffect(() => {
    if (!acciones.isSuccess) return;
    if (!conocidas.current) {
      conocidas.current = { grupos: new Set(grupos.map((g) => g.id)), cosas: new Set(grupos.flatMap((g) => g.cosas.map(claveCosa))) };
      return;
    }
    const nuevosGrupos = grupos.filter((g) => !conocidas.current.grupos.has(g.id)).map((g) => g.id);
    const nuevasCosas = grupos.flatMap((g) => g.cosas.map(claveCosa)).filter((k) => !conocidas.current.cosas.has(k));
    if (!nuevosGrupos.length && !nuevasCosas.length) return;
    nuevosGrupos.forEach((id) => conocidas.current.grupos.add(id));
    nuevasCosas.forEach((k) => conocidas.current.cosas.add(k));
    setFrescas((f) => ({ grupos: new Set([...f.grupos, ...nuevosGrupos]), cosas: new Set([...f.cosas, ...nuevasCosas]) }));
    roce();
  }, [grupos, acciones.isSuccess]);

  // Invertida: lo nuevo abajo y el teclado no lo tapa.
  const invertidos = useMemo(
    () =>
      [...visibles, ...grupos]
        .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0))
        .reverse(),
    [visibles, grupos],
  );
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
        <Animated.View entering={aparecer} style={{ flex: 1 }}>
        <Animated.FlatList
          inverted
          data={invertidos}
          keyExtractor={(m) => m.id}
          // Lo que ya estaba se corre con resorte cuando entra algo abajo.
          itemLayoutAnimation={correrse}
          // En la lista invertida, el encabezado queda abajo: ahí va el globo
          // de «escribiendo», donde aparecerá su respuesta.
          ListHeaderComponent={escribiendo ? <View style={{ marginTop: 9 }}><Escribiendo nombre={nombre} /></View> : null}
          contentContainerStyle={{ paddingHorizontal: 18, paddingVertical: 12 }}
          ItemSeparatorComponent={() => <View style={{ height: 9 }} />}
          ListFooterComponent={cargandoViejos ? <MorphingInfinity size={20} color={INK.meta} style={{ marginVertical: 12, alignSelf: 'center' }} /> : null}
          onEndReached={cargarViejos}
          onEndReachedThreshold={0.3}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => item._accion ? (
            <AccionAgente grupo={item} onAbrir={abrirCosa} nuevo={frescas.grupos.has(item.id)} nuevas={frescas.cosas} />
          ) : (
            <Mensaje
              mensaje={item}
              mio={esMio(item, yo)}
              onAbrirItem={onAbrirItem || ((id) => setMioAbierto({ id, ajeno: true }))}
              onAbrirMio={(id) => setMioAbierto({ id, ajeno: false })}
              onAbrirMonitoreo={onAbrirMonitoreo}
              onAbrirContacto={onAbrirContacto}
              onReenviar={(a) => {
                roce();
                setReenviando(a);
              }}
              onAbrirArtifact={onAbrirArtifact}
              onAbrirSeguimiento={onAbrirSeguimiento}
              enviando={item.id === 'enviando'}
              enVivo={llegados.has(item.id)}
              confirmado={confirmados.has(item.id)}
            />
          )}
        />
        </Animated.View>
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
        <BotonEnviar activo={!!texto.trim() && !enviando} onPress={() => enviar()} />
      </View>
      {adjuntando ? (
        <Adjuntar
          userId={yo.id}
          conPersona={colaborador.cuenta_tipo === 'humano'}
          bottomInset={bottomInset}
          onCerrar={() => setAdjuntando(false)}
          onAdjuntar={(adjuntos) => {
            setAdjuntando(false);
            enviar(adjuntos);
          }}
        />
      ) : null}
      {reenviando ? <Reenviar adjunto={reenviando} excluir={colaborador.id} bottomInset={bottomInset} onCerrar={() => setReenviando(null)} /> : null}
      {mioAbierto ? <AbrirMio id={mioAbierto.id} ajeno={mioAbierto.ajeno} topInset={topInset} bottomInset={bottomInset} onClose={() => setMioAbierto(null)} /> : null}
    </KeyboardAvoidingView>
  );
}

function Mensaje({ mensaje, mio, onAbrirItem, onAbrirMio, onAbrirArtifact, onAbrirSeguimiento, onAbrirMonitoreo, onAbrirContacto, onReenviar, enviando, enVivo, confirmado }) {
  const bloques = bloquesDe(mensaje);
  // Lo que llega en vivo sube y crece desde su esquina (la del otro a la
  // izquierda, la tuya a la derecha). Lo tuyo entra a media tinta mientras se
  // envía y, guardado, solo termina de encenderse.
  const entrada = enviando ? llegaMensaje(0.55) : enVivo ? llegaMensaje(1) : confirmado ? quedaEnviado : undefined;
  return (
    <Animated.View
      entering={entrada}
      style={{ gap: 6, opacity: enviando ? 0.55 : 1, transformOrigin: mio ? 'right bottom' : 'left bottom' }}
    >
      {bloques.map((b) => (
        <Bloque key={b.id} bloque={b} mio={mio} onAbrirItem={onAbrirItem} onAbrirMio={onAbrirMio} onAbrirArtifact={onAbrirArtifact} onAbrirSeguimiento={onAbrirSeguimiento} onAbrirMonitoreo={onAbrirMonitoreo} onAbrirContacto={onAbrirContacto} onReenviar={onReenviar} />
      ))}
    </Animated.View>
  );
}


/**
 * Enviar: se enciende con un pequeño rebote cuando hay algo escrito, y se
 * hunde al tocarlo. Apagado queda chico y a media tinta.
 */
function BotonEnviar({ activo, onPress }) {
  const encendido = useSharedValue(activo ? 1 : 0);
  const hundido = useSharedValue(0);
  useEffect(() => {
    encendido.value = withSpring(activo ? 1 : 0, { damping: 13, stiffness: 320, mass: 0.6 });
  }, [activo, encendido]);
  const estilo = useAnimatedStyle(() => ({
    opacity: 0.4 + 0.6 * encendido.value,
    transform: [{ scale: (0.88 + 0.12 * encendido.value) * (1 - 0.08 * hundido.value) }],
  }));
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => { hundido.value = withTiming(1, MOTION.press); }}
      onPressOut={() => { hundido.value = withSpring(0, MOTION.tap); }}
      disabled={!activo}
      accessibilityRole="button"
      accessibilityLabel="Enviar"
      accessibilityState={{ disabled: !activo }}
    >
      <Animated.View style={[{ width: 44, height: 44, borderRadius: 22, backgroundColor: TONO.verde, alignItems: 'center', justifyContent: 'center' }, estilo]}>
        <ArrowUp size={18} color="#FFFFFF" strokeWidth={2.2} />
      </Animated.View>
    </Pressable>
  );
}
