import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePulseConnectionStore } from '../../state/pulseConnectionStore';
import { EV, evento } from '../../utils/analitica';
import { NoDisponible, itemsDeColaborador, leerChats, leerMensajes, listarAvisos, listarColaboradores, listarSolicitudes, seguimientosDe, tareasDe, titulosDeRecursos } from './api';
import { claveTareas } from './Ficha';
import { colaboradorDeAviso, esMerge, noLeidos, repartirSolicitudes, visibles } from './logica';
import { nombreDe } from './piezas';
import Lista from './Lista';
import Chat from './Chat';
import Permisos from './Permisos';
import ConectarAgente from './ConectarAgente';
import Bandeja from './Bandeja';
import Solicitud from './Solicitud';
import Avisos from './Avisos';
import Artifact from './Artifact';
import { Seguimiento } from './Seguimientos';
import { PantallaEspacios, PantallaFuentes, PantallaTareas, Perfil } from './Ficha';

/** Cada cuánto se refrescan la lista, las solicitudes y los avisos mientras se ven. */
const CADA = 1000 * 30;

/**
 * Colaboradores (STA-259). Se abre desde el encabezado del feed y vive en un
 * Modal, como el mapa: no es una pestaña, es una lente sobre la cuenta.
 *
 * Fase 1: la lista y sus estados, conectar un agente, el chat, su Codex y los
 * permisos. Fase 2: por aprobar, la propuesta campo por campo y los avisos.
 *
 * La navegación es una pila interna (lista → chat → permisos → por aprobar…)
 * porque un Modal de React Native no tiene pila propia.
 */
export default function ColaboradoresSheet({ inicial, onClose, onEntrar, topInset = 0, bottomInset = 0 }) {
  const usuario = usePulseConnectionStore((s) => s.connectedUser);
  const yo = useMemo(() => ({ tipo: 'humano', id: usuario?.id }), [usuario?.id]);
  // `inicial: 'avisos'` cuando se abre desde un aviso del teléfono.
  const [pila, setPila] = useState(() => (inicial === 'avisos' ? [{ tipo: 'lista' }, { tipo: 'avisos' }] : [{ tipo: 'lista' }]));
  const [sumando, setSumando] = useState(false);
  const [chats, setChats] = useState({});
  const vista = pila[pila.length - 1];
  const ir = (v) => setPila((p) => [...p, v]);
  const volver = () => setPila((p) => (p.length > 1 ? p.slice(0, -1) : p));
  const aLaLista = () => setPila([{ tipo: 'lista' }]);
  const enLista = vista.tipo === 'lista';

  // `solo_beta` y `colab_apagado` son respuestas, no fallas: no se reintentan.
  const reintentar = (n, e) => !e?.motivo && n < 1;

  const consulta = useQuery({
    queryKey: ['colab-lista', usuario?.id],
    queryFn: async () => {
      // Sin sesión no hay a quién pedirle la lista: la pantalla pide entrar.
      if (!usuario?.id) throw new NoDisponible('sesion');
      return visibles(await listarColaboradores(), usuario.id);
    },
    staleTime: CADA,
    refetchInterval: enLista ? CADA : false,
    retry: reintentar,
  });
  const habilitado = !!usuario?.id && !consulta.error;

  // Con la lista a la vista se adelanta lo que se ve al abrir un chat (los
  // mensajes, su Codex, lo que sigue, lo que está haciendo): al tocarlo ya está.
  const queryClient = useQueryClient();
  const idsLista = (consulta.data || []).map((c) => c.id).join(',');
  useEffect(() => {
    for (const c of (consulta.data || []).slice(0, 6)) {
      const conv = c.ultimo_mensaje?.conversacion_id;
      if (conv) {
        queryClient.prefetchQuery({ queryKey: ['colab-mensajes', conv], queryFn: () => leerMensajes(conv, { limit: 30 }), staleTime: CADA });
      }
      if (c.cuenta_tipo === 'agente') {
        queryClient.prefetchQuery({ queryKey: ['colab-seguimientos', c.id], queryFn: () => seguimientosDe(c.id), staleTime: CADA, retry: false });
        queryClient.prefetchQuery({ queryKey: claveTareas(c.id), queryFn: () => tareasDe(c.id), staleTime: CADA, retry: false });
        queryClient.prefetchQuery({ queryKey: ['colab-items', c.id], queryFn: () => itemsDeColaborador(c.id, { limit: 100 }), staleTime: CADA });
      }
    }
    // Solo cuando cambia quiénes están, no en cada consulta periódica.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsLista, queryClient]);

  const solicitudes = useQuery({
    queryKey: ['colab-solicitudes', usuario?.id],
    queryFn: listarSolicitudes,
    enabled: habilitado,
    staleTime: CADA,
    refetchInterval: enLista || vista.tipo === 'bandeja' ? CADA : false,
    retry: reintentar,
  });
  const avisos = useQuery({
    queryKey: ['colab-avisos', usuario?.id],
    queryFn: listarAvisos,
    enabled: habilitado,
    staleTime: CADA,
    refetchInterval: enLista || vista.tipo === 'avisos' ? CADA : false,
    retry: reintentar,
  });
  const idsRecursos = (solicitudes.data || []).map((s) => s.recurso_id).filter(Boolean).sort().join(',');
  const titulos = useQuery({
    queryKey: ['colab-titulos', idsRecursos],
    queryFn: () => titulosDeRecursos(solicitudes.data),
    enabled: !!idsRecursos,
    staleTime: CADA,
  });

  useEffect(() => {
    evento(EV.COLAB_ABIERTO);
    leerChats().then(setChats);
  }, []);

  // Quién es una cuenta, para nombrarla: un colaborador de la lista o, si no
  // está, «Un agente» / «Alguien».
  const quien = useCallback(
    (tipo, id) => {
      const c = (consulta.data || []).find((x) => x.cuenta_tipo === tipo && x.cuenta_id === id);
      return c ? { nombre: nombreDe(c), tipo, colaborador: c } : { nombre: tipo === 'agente' ? 'Un agente' : 'Alguien', tipo };
    },
    [consulta.data]
  );
  // El colaborador de un chat: por su último mensaje o por lo que este teléfono abrió.
  const deChat = useCallback(
    (convId) => {
      const lista = consulta.data || [];
      const c = lista.find((x) => x.ultimo_mensaje?.conversacion_id === convId) || lista.find((x) => chats[x.id] === convId);
      return c ? { nombre: nombreDe(c), tipo: c.cuenta_tipo, colaborador: c } : null;
    },
    [consulta.data, chats]
  );

  // Lo que se abrió se mantiene al día con la lista: permisos, pendientes y el
  // último mensaje cambian mientras tanto.
  const vigente = vista.colaborador
    ? (consulta.data || []).find((c) => c.id === vista.colaborador.id) || vista.colaborador
    : null;

  const tePiden = repartirSolicitudes(solicitudes.data, yo).tePiden;
  const sinLeer = noLeidos(avisos.data);

  const abrirAviso = (a) => {
    const p = a.payload || {};
    if (a.tipo === 'mensaje') {
      const c = deChat(p.conversacion_id);
      if (c) ir({ tipo: 'chat', colaborador: c.colaborador });
      return;
    }
    if (a.tipo === 'seguimiento' || a.tipo === 'seguimiento_hallazgo') {
      const c = colaboradorDeAviso(consulta.data, p);
      if (c) ir({ tipo: 'chat', colaborador: c, pestana: 'sigue' });
      return;
    }
    const s = (solicitudes.data || []).find((x) => x.id === p.solicitud_id);
    if (a.tipo === 'solicitud' && s && s.estado === 'pendiente' && esMerge(s)) ir({ tipo: 'solicitud', solicitud: s });
    else ir({ tipo: 'bandeja' });
  };

  const cerrar = () => {
    if (sumando) return setSumando(false);
    if (pila.length > 1) return volver();
    return onClose();
  };

  let pantalla;
  if (vista.tipo === 'chat' && vigente) {
    pantalla = (
      <Chat
        key={vigente.id}
        colaborador={vigente}
        yo={yo}
        borrador={vista.borrador}
        topInset={topInset}
        bottomInset={bottomInset}
        onVolver={volver}
        onPermisos={() => ir({ tipo: 'permisos', colaborador: vigente })}
        onPerfil={() => ir({ tipo: 'perfil', colaborador: vigente })}
        onAbrirArtifact={(id) => ir({ tipo: 'artifact', id })}
        onAbrirSeguimiento={(s) => ir({ tipo: 'seguimiento', colaborador: vigente, seguimiento: s })}
        pestanaInicial={vista.pestana}
      />
    );
  } else if (vista.tipo === 'permisos' && vigente) {
    pantalla = (
      <Permisos
        colaborador={vigente}
        porAprobar={tePiden.filter((s) => s.solicitante_id === vigente.cuenta_id).length}
        topInset={topInset}
        bottomInset={bottomInset}
        onVolver={volver}
        onPorAprobar={() => ir({ tipo: 'bandeja', soloDe: vigente })}
        onQuitado={aLaLista}
      />
    );
  } else if (vista.tipo === 'perfil' && vigente) {
    pantalla = (
      <Perfil
        colaborador={vigente}
        topInset={topInset}
        bottomInset={bottomInset}
        onVolver={volver}
        onAbrir={(que) => ir({ tipo: que, colaborador: vigente })}
      />
    );
  } else if (['tareas', 'fuentes', 'espacios'].includes(vista.tipo) && vigente) {
    const P = { tareas: PantallaTareas, fuentes: PantallaFuentes, espacios: PantallaEspacios }[vista.tipo];
    pantalla = <P colaborador={vigente} topInset={topInset} bottomInset={bottomInset} onVolver={volver} />;
  } else if (vista.tipo === 'bandeja') {
    pantalla = (
      <Bandeja
        consulta={solicitudes}
        titulos={titulos.data}
        quien={quien}
        yo={yo}
        soloDe={vista.soloDe}
        topInset={topInset}
        bottomInset={bottomInset}
        onVolver={volver}
        onAbrir={(s) => ir({ tipo: 'solicitud', solicitud: s })}
      />
    );
  } else if (vista.tipo === 'solicitud') {
    const s = vista.solicitud;
    const otro = quien(s.solicitante_tipo, s.solicitante_id);
    const titulo = titulos.data?.[s.recurso_id];
    pantalla = (
      <Solicitud
        solicitud={s}
        titulo={titulo}
        otro={otro}
        topInset={topInset}
        bottomInset={bottomInset}
        onVolver={volver}
        onPedirDeNuevo={
          otro.colaborador
            ? () =>
                ir({
                  tipo: 'chat',
                  colaborador: otro.colaborador,
                  borrador: `${titulo ? `«${titulo}»` : 'La nota'} cambió después de tu propuesta. ¿Me la volvés a proponer sobre la versión de ahora?`,
                })
            : null
        }
      />
    );
  } else if (vista.tipo === 'seguimiento' && vigente) {
    pantalla = (
      <Seguimiento colaborador={vigente} seguimiento={vista.seguimiento} topInset={topInset} bottomInset={bottomInset} onVolver={volver} />
    );
  } else if (vista.tipo === 'artifact') {
    pantalla = <Artifact id={vista.id} quien={quien} topInset={topInset} bottomInset={bottomInset} onVolver={volver} />;
  } else if (vista.tipo === 'avisos') {
    pantalla = (
      <Avisos
        consulta={avisos}
        solicitudes={solicitudes.data}
        titulos={titulos.data}
        quien={quien}
        deChat={deChat}
        topInset={topInset}
        bottomInset={bottomInset}
        onVolver={volver}
        onAbrir={abrirAviso}
      />
    );
  } else {
    pantalla = (
      <Lista
        consulta={consulta}
        porAprobar={tePiden.length}
        sinLeer={sinLeer}
        topInset={topInset}
        bottomInset={bottomInset}
        onCerrar={onClose}
        onEntrar={onEntrar}
        onAbrir={(c) => ir({ tipo: 'chat', colaborador: c })}
        onPorAprobar={(c) => ir({ tipo: 'bandeja', soloDe: c || null })}
        onAvisos={() => ir({ tipo: 'avisos' })}
        onSumar={() => setSumando(true)}
      />
    );
  }

  return (
    <Modal visible animationType="slide" onRequestClose={cerrar}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="dark" />
        <LinearGradient colors={['#F4F3EE', '#EEF2EC']} style={StyleSheet.absoluteFill} />

        <View style={{ flex: 1 }}>{pantalla}</View>

        {sumando ? (
          <ConectarAgente
            antes={consulta.data}
            miId={usuario?.id}
            bottomInset={bottomInset}
            onCerrar={() => setSumando(false)}
            onListo={(c) => {
              setSumando(false);
              consulta.refetch();
              setPila([{ tipo: 'lista' }, { tipo: 'chat', colaborador: c }, { tipo: 'permisos', colaborador: c }]);
            }}
          />
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
}
