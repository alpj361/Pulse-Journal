import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AtSign, Bot, ChevronLeft, ChevronRight, Globe, Landmark, ListChecks, Newspaper, Plus } from 'lucide-react-native';
import { INK, SERIF } from '../theme';
import { roce } from '../../utils/haptics';
import { borrarTarea, calificarFuente, cambiarTarea, crearTarea, fuenteDe, fuentesDe, tareasDe } from './api';
import { Ficha as FichaItem } from './SuCodex';
import MorphingInfinity from '../MorphingInfinity';
import {
  estadoTarea,
  FILTROS_FUENTES,
  filtrarFuentes,
  resumenFuentes,
  resumenTareas,
  metaFuente,
  ordenarFuentes,
  repartirTareas,
  siguienteConfiabilidad,
} from './logica';
import { Avatar, ROTULO, TONO, nombreDe } from './piezas';

/**
 * El perfil de un agente: lo principal de él, no sus ajustes. Tareas (y qué
 * está haciendo) y las fuentes que usa (y si confiás en ellas), cada cosa con
 * su propia pantalla. Sus Espacios viven en «Su Codex», como en el tuyo. Los
 * permisos y los avisos quedan en ajustes (`Permisos`).
 *
 * Cada parte aparece solo si el backend ya la tiene.
 */

const CAJA = { backgroundColor: 'rgba(255,255,255,0.78)', borderWidth: 1, borderColor: 'rgba(28,43,34,0.08)', borderRadius: 18, overflow: 'hidden' };
const RAYA = { borderTopWidth: 1, borderTopColor: 'rgba(28,43,34,0.06)' };
const NO_SALIO = () => Alert.alert('No se pudo cambiar', 'Revisá la conexión y probá de nuevo.');

export const claveTareas = (id) => ['colab-tareas', id];

/** Ícono y color de cada fuente según su tipo; uno nuevo cae a sitio web. */
const ICONO_FUENTE = {
  medio: { Icono: Newspaper, tinta: TONO.ladrilloTinta, fondo: TONO.ladrilloLavado },
  red: { Icono: AtSign, tinta: '#3D5A80', fondo: 'rgba(61,90,128,0.12)' },
  oficial: { Icono: Landmark, tinta: TONO.verde, fondo: TONO.verdeLavado },
  bot: { Icono: Bot, tinta: TONO.arena, fondo: TONO.arenaLavado },
  web: { Icono: Globe, tinta: INK.body, fondo: 'rgba(28,43,34,0.06)' },
};

/** Las tres puertas del perfil, con su ícono. */
const PUERTAS = {
  tareas: { Icono: ListChecks, tinta: TONO.verde, fondo: TONO.verdeLavado },
  fuentes: { Icono: Newspaper, tinta: TONO.ladrilloTinta, fondo: TONO.ladrilloLavado },
};

function Icono({ estilo, size = 20, caja = 40 }) {
  const { Icono: I, tinta, fondo } = estilo;
  return (
    <View style={{ width: caja, height: caja, borderRadius: caja * 0.3, backgroundColor: fondo, alignItems: 'center', justifyContent: 'center' }} accessible={false}>
      <I size={size} color={tinta} strokeWidth={1.9} />
    </View>
  );
}

/** Qué hace ahora y lo que tiene pendiente. Se le puede pedir una tarea. */
export function Tareas({ colaborador }) {
  const queryClient = useQueryClient();
  const clave = claveTareas(colaborador.id);
  const consulta = useQuery({ queryKey: clave, queryFn: () => tareasDe(colaborador.id), staleTime: 1000 * 30, retry: false });
  const [nueva, setNueva] = useState('');
  const [verHechas, setVerHechas] = useState(false);
  const [creando, setCreando] = useState(false);
  if (!consulta.data) return null;
  const { ahora, abiertas, hechas } = repartirTareas(consulta.data);

  const refrescar = () => queryClient.invalidateQueries({ queryKey: clave });

  const pedir = async () => {
    const titulo = nueva.trim();
    if (!titulo || creando) return;
    roce();
    setCreando(true);
    try {
      await crearTarea(colaborador.id, { titulo });
      setNueva('');
      refrescar();
    } catch {
      NO_SALIO();
    } finally {
      setCreando(false);
    }
  };

  const opciones = (t) => {
    const cambiar = (cambios) => cambiarTarea(colaborador.id, t.id, cambios).then(refrescar, NO_SALIO);
    const botones = [];
    if (t.estado !== 'completada') botones.push({ text: 'marcar hecha', onPress: () => cambiar({ estado: 'completada' }) });
    if (t.estado === 'pausada') botones.push({ text: 'que siga', onPress: () => cambiar({ estado: 'pendiente' }) });
    else if (t.estado !== 'completada') botones.push({ text: 'pausar', onPress: () => cambiar({ estado: 'pausada' }) });
    botones.push({ text: 'borrar', style: 'destructive', onPress: () => borrarTarea(colaborador.id, t.id).then(refrescar, NO_SALIO) });
    botones.push({ text: 'cancelar', style: 'cancel' });
    Alert.alert(t.titulo, t.progreso_nota || null, botones);
  };

  return (
    <View style={{ gap: 8 }}>
      <Animated.View layout={LinearTransition} style={CAJA}>
        {ahora ? (
          <Pressable onPress={() => opciones(ahora)} accessibilityRole="button" style={({ pressed }) => ({ padding: 16, gap: 4, backgroundColor: TONO.verdeLavado, opacity: pressed ? 0.7 : 1 })}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: TONO.verde }}>haciendo ahora</Text>
            <Text style={{ fontSize: 15.5, fontWeight: '700', lineHeight: 21, color: INK.title }}>{ahora.titulo}</Text>
            {ahora.progreso_nota || ahora.espacio_nombre ? (
              <Text style={{ fontSize: 12.5, lineHeight: 17, color: INK.body }} numberOfLines={2}>
                {[ahora.progreso_nota, ahora.espacio_nombre].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
          </Pressable>
        ) : null}

        {abiertas.map((t, i) => (
          <FilaTarea key={t.id} tarea={t} borde={i > 0 || !!ahora} onPress={() => opciones(t)} />
        ))}

        {verHechas
          ? hechas.map((t) => <FilaTarea key={t.id} tarea={t} borde onPress={() => opciones(t)} />)
          : null}

        <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 6 }, ahora || abiertas.length || verHechas ? RAYA : null]}>
          <Plus size={16} color={INK.meta} strokeWidth={2} />
          <TextInput
            value={nueva}
            onChangeText={setNueva}
            onSubmitEditing={pedir}
            placeholder="pedirle una tarea"
            placeholderTextColor={INK.faint}
            returnKeyType="send"
            editable={!creando}
            maxLength={200}
            accessibilityLabel="Pedirle una tarea"
            style={{ flex: 1, height: 40, fontSize: 15, color: INK.title }}
          />
        </View>
      </Animated.View>
      {hechas.length ? (
        <Pressable onPress={() => setVerHechas((v) => !v)} hitSlop={8} accessibilityRole="button" style={({ pressed }) => ({ alignSelf: 'flex-start', opacity: pressed ? 0.5 : 1 })}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: INK.meta }}>
            {verHechas ? 'ocultar las hechas' : `ver las hechas (${hechas.length})`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function FilaTarea({ tarea: t, borde, onPress }) {
  const hecha = t.estado === 'completada';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${t.titulo}, ${estadoTarea(t)}`}
      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, opacity: pressed ? 0.6 : 1 }, borde ? RAYA : null]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{ fontSize: 15, fontWeight: '600', color: hecha ? INK.meta : INK.title, textDecorationLine: hecha ? 'line-through' : 'none' }}
          numberOfLines={2}
        >
          {t.titulo}
        </Text>
        <Text style={{ fontSize: 12.5, color: INK.meta }} numberOfLines={1}>
          {[estadoTarea(t), t.espacio_nombre, t.origen === 'humano' ? 'se lo pediste vos' : null].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </Pressable>
  );
}

/** Las fuentes que usa, las que más primero, y si confiás en cada una. */
export function Fuentes({ colaborador, onAbrir }) {
  const queryClient = useQueryClient();
  const clave = ['colab-fuentes', colaborador.id];
  const consulta = useQuery({ queryKey: clave, queryFn: () => fuentesDe(colaborador.id), staleTime: 1000 * 60, retry: false });
  const [filtro, setFiltro] = useState(null);
  if (!consulta.data) return null;
  const lista = ordenarFuentes(consulta.data.items);
  const visibles = filtrarFuentes(lista, filtro);

  const calificar = async (f, tocada) => {
    roce();
    const confiabilidad = siguienteConfiabilidad(f.confiabilidad, tocada);
    const antes = consulta.data;
    queryClient.setQueryData(clave, {
      ...antes,
      items: antes.items.map((x) => (x.clave === f.clave ? { ...x, confiabilidad } : x)),
    });
    try {
      await calificarFuente(colaborador.id, { clave: f.clave, nombre: f.nombre, tipo: f.tipo, confiabilidad });
    } catch {
      queryClient.setQueryData(clave, antes);
      NO_SALIO();
    }
  };

  return (
    <View style={{ gap: 12 }}>
      {lista.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {FILTROS_FUENTES.map((f) => {
            const activo = f.clave === filtro;
            return (
              <Pressable
                key={f.texto}
                onPress={() => {
                  roce();
                  setFiltro(f.clave);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: activo }}
                style={{
                  height: 30,
                  paddingHorizontal: 12,
                  borderRadius: 15,
                  justifyContent: 'center',
                  backgroundColor: activo ? INK.title : 'transparent',
                  borderWidth: activo ? 0 : 1,
                  borderColor: TONO.borde,
                }}
              >
                <Text style={{ fontSize: 12.5, fontWeight: '600', color: activo ? '#FFFFFF' : INK.body }}>{f.texto}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {!lista.length ? (
        <Text style={{ fontSize: 13.5, color: INK.body }}>Todavía no usó ninguna.</Text>
      ) : !visibles.length ? (
        <Text style={{ fontSize: 13.5, color: INK.body }}>Ninguna por acá.</Text>
      ) : (
        <Animated.View layout={LinearTransition} style={CAJA}>
          {visibles.map((f, i) => (
            <View key={f.clave || f.id} style={[{ paddingVertical: 12, paddingHorizontal: 16, gap: 8 }, i ? RAYA : null]}>
              <Pressable
                onPress={onAbrir ? () => onAbrir(f) : undefined}
                disabled={!onAbrir}
                accessibilityRole={onAbrir ? 'button' : undefined}
                accessibilityHint={onAbrir ? 'Ver dónde aparece' : undefined}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.6 : 1 })}
              >
                <Icono estilo={ICONO_FUENTE[f.tipo] || ICONO_FUENTE.web} size={17} caja={34} />
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: INK.title }} numberOfLines={1}>
                    {f.nombre}
                  </Text>
                  {metaFuente(f) ? <Text style={{ fontSize: 12.5, color: INK.meta }}>{metaFuente(f)}</Text> : null}
                </View>
                {onAbrir ? <ChevronRight size={16} color={INK.meta} /> : null}
              </Pressable>
              <View style={{ flexDirection: 'row', gap: 8, marginLeft: 46 }} accessibilityRole="radiogroup" accessibilityLabel={`¿Confiás en ${f.nombre}?`}>
                <Calificacion texto="confiable" activo={f.confiabilidad === 'confiable'} tono={TONO.verde} onPress={() => calificar(f, 'confiable')} />
                <Calificacion texto="no confiable" activo={f.confiabilidad === 'no_confiable'} tono={TONO.ladrillo} onPress={() => calificar(f, 'no_confiable')} />
              </View>
            </View>
          ))}
        </Animated.View>
      )}
    </View>
  );
}

function Calificacion({ texto, activo, tono, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: activo }}
      style={({ pressed }) => ({
        height: 32,
        paddingHorizontal: 12,
        borderRadius: 10,
        justifyContent: 'center',
        backgroundColor: activo ? tono : 'transparent',
        borderWidth: activo ? 0 : 1,
        borderColor: TONO.borde,
        transform: [{ scale: pressed ? 0.95 : 1 }],
      })}
    >
      <Text style={{ fontSize: 13, fontWeight: '600', color: activo ? '#FFFFFF' : INK.body }}>{texto}</Text>
    </Pressable>
  );
}

/** Una pantalla del perfil: volver, título grande y lo suyo debajo. */
function Pantalla({ titulo, topInset, bottomInset, onVolver, children }) {
  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingTop: topInset + 10, paddingHorizontal: 20, paddingBottom: 6 }}>
        <Pressable
          onPress={onVolver}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={({ pressed }) => ({ width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}
        >
          <ChevronLeft size={24} color={INK.title} strokeWidth={2} />
        </Pressable>
        <Text style={{ fontFamily: SERIF, fontSize: 32, lineHeight: 36, color: INK.title }} accessibilityRole="header">
          {titulo}
        </Text>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: bottomInset + 24, gap: 16 }}>
        {children}
      </ScrollView>
    </View>
  );
}

export const PantallaTareas = (p) => (
  <Pantalla titulo="Tareas" {...p}>
    <Tareas colaborador={p.colaborador} />
  </Pantalla>
);

export const PantallaFuentes = (p) => (
  <Pantalla titulo="Fuentes" {...p}>
    <Fuentes colaborador={p.colaborador} onAbrir={p.onAbrirFuente} />
  </Pantalla>
);

/**
 * La ficha de un medio o una cuenta: si confiás en él, dónde aparece en su
 * Codex (cada cosa abre su ficha) y lo que encontró de él en sus seguimientos.
 */
export function PantallaFuente({ colaborador, fuente: deLista, topInset, bottomInset, onVolver, onPedir }) {
  const queryClient = useQueryClient();
  const [abierto, setAbierto] = useState(null);
  const consulta = useQuery({
    queryKey: ['colab-fuente', colaborador.id, deLista.clave],
    queryFn: () => fuenteDe(colaborador.id, deLista.clave),
    staleTime: 1000 * 60,
    retry: false,
  });
  const lista = queryClient.getQueryData(['colab-fuentes', colaborador.id]);
  const f = { ...deLista, ...((lista?.items || []).find((x) => x.clave === deLista.clave) || {}), ...(consulta.data?.fuente || {}) };
  const apariciones = consulta.data?.apariciones || [];
  const hallazgos = consulta.data?.hallazgos || [];

  const calificar = async (tocada) => {
    roce();
    const confiabilidad = siguienteConfiabilidad(f.confiabilidad, tocada);
    const clave = ['colab-fuentes', colaborador.id];
    const antes = queryClient.getQueryData(clave);
    if (antes?.items) {
      queryClient.setQueryData(clave, { ...antes, items: antes.items.map((x) => (x.clave === f.clave ? { ...x, confiabilidad } : x)) });
    }
    try {
      await calificarFuente(colaborador.id, { clave: f.clave, nombre: f.nombre, tipo: f.tipo, confiabilidad });
      queryClient.invalidateQueries({ queryKey: ['colab-fuente', colaborador.id, f.clave] });
    } catch {
      if (antes) queryClient.setQueryData(clave, antes);
      NO_SALIO();
    }
  };

  return (
    <Pantalla titulo={f.nombre} topInset={topInset} bottomInset={bottomInset} onVolver={onVolver}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Icono estilo={ICONO_FUENTE[f.tipo] || ICONO_FUENTE.web} size={20} caja={42} />
        <Text style={{ flex: 1, fontSize: 13.5, color: INK.meta }}>{metaFuente(f)}</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel={`¿Confiás en ${f.nombre}?`}>
        <Calificacion texto="confiable" activo={f.confiabilidad === 'confiable'} tono={TONO.verde} onPress={() => calificar('confiable')} />
        <Calificacion texto="no confiable" activo={f.confiabilidad === 'no_confiable'} tono={TONO.ladrillo} onPress={() => calificar('no_confiable')} />
      </View>

      {f.url ? (
        <Pressable onPress={() => Linking.openURL(f.url).catch(() => {})} accessibilityRole="link" style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
          <Text style={{ fontSize: 14.5, fontWeight: '600', color: TONO.verde }} numberOfLines={1}>
            {String(f.url).replace(/^https?:\/\/(www\.)?/, '')}
          </Text>
        </Pressable>
      ) : null}

      {consulta.isLoading ? <MorphingInfinity size={24} color={INK.meta} style={{ alignSelf: 'center' }} /> : null}

      {apariciones.length ? (
        <View style={{ gap: 8 }}>
          <Text style={ROTULO}>DÓNDE APARECE</Text>
          <View style={CAJA}>
            {apariciones.map((a, i) => (
              <Pressable
                key={`${a.origen_tabla || 'u'}-${a.id}`}
                onPress={() => setAbierto(a)}
                accessibilityRole="button"
                style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 16, opacity: pressed ? 0.6 : 1 }, i ? RAYA : null]}
              >
                <View style={{ flex: 1, gap: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: INK.title }} numberOfLines={2}>
                    {a.titulo || a.name}
                  </Text>
                  {a.tipo ? <Text style={{ fontSize: 12.5, color: INK.meta }}>{String(a.tipo).toLowerCase()}</Text> : null}
                </View>
                <ChevronRight size={15} color={INK.meta} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {hallazgos.length ? (
        <View style={{ gap: 8 }}>
          <Text style={ROTULO}>LO QUE ENCONTRÓ</Text>
          <View style={CAJA}>
            {hallazgos.map((h, i) => (
              <Pressable
                key={h.id}
                onPress={h.url ? () => Linking.openURL(h.url).catch(() => {}) : undefined}
                disabled={!h.url}
                accessibilityRole={h.url ? 'link' : undefined}
                style={({ pressed }) => [{ paddingVertical: 12, paddingHorizontal: 16, gap: 2, opacity: pressed ? 0.6 : 1 }, i ? RAYA : null]}
              >
                <Text style={{ fontSize: 14.5, fontWeight: '600', color: INK.title }} numberOfLines={3}>
                  {h.titulo}
                </Text>
                {h.seguimiento_tema ? (
                  <Text style={{ fontSize: 12.5, color: INK.meta }} numberOfLines={1}>
                    {h.seguimiento_tema}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {abierto ? (
        <FichaItem
          colaborador={colaborador}
          item={abierto}
          bottomInset={bottomInset}
          onClose={() => setAbierto(null)}
          onPedir={onPedir}
        />
      ) : null}
    </Pantalla>
  );
}

/**
 * El perfil (se abre tocando su nombre en el chat): quién es, qué está
 * haciendo y la puerta a sus Tareas, Fuentes y Espacios.
 */
export function Perfil({ colaborador, topInset, bottomInset, onVolver, onAbrir }) {
  const id = colaborador.id;
  const tareas = useQuery({ queryKey: claveTareas(id), queryFn: () => tareasDe(id), staleTime: 1000 * 30, retry: false });
  const fuentes = useQuery({ queryKey: ['colab-fuentes', id], queryFn: () => fuentesDe(id), staleTime: 1000 * 60, retry: false });
  const nombre = nombreDe(colaborador);
  const ahora = tareas.data?.haciendo_ahora;

  const entradas = [
    { clave: 'tareas', titulo: 'Tareas', consulta: tareas, resumen: resumenTareas },
    { clave: 'fuentes', titulo: 'Fuentes', consulta: fuentes, resumen: resumenFuentes },
  ].filter((e) => e.consulta.data || e.consulta.isLoading);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingTop: topInset + 10, paddingHorizontal: 20 }}>
        <Pressable
          onPress={onVolver}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Volver al chat"
          style={({ pressed }) => ({ width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}
        >
          <ChevronLeft size={24} color={INK.title} strokeWidth={2} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottomInset + 24, gap: 18 }}>
        <View style={{ alignItems: 'center', gap: 8, paddingTop: 4 }}>
          <Avatar tipo={colaborador.cuenta_tipo} nombre={nombre} size={76} />
          <Text style={{ fontFamily: SERIF, fontSize: 30, color: INK.title }} accessibilityRole="header">
            {nombre}
          </Text>
        </View>

        {ahora ? (
          <Animated.View entering={FadeIn.duration(220)} style={{ backgroundColor: TONO.verdeLavado, borderRadius: 16, padding: 16, gap: 4 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: TONO.verde }}>haciendo ahora</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', lineHeight: 22, color: INK.title }}>{ahora.titulo}</Text>
            {ahora.progreso_nota ? (
              <Text style={{ fontSize: 13, lineHeight: 18, color: INK.body }} numberOfLines={3}>
                {ahora.progreso_nota}
              </Text>
            ) : null}
          </Animated.View>
        ) : null}

        <View style={{ gap: 10 }}>
          {entradas.map((e) => (
            <Pressable
              key={e.clave}
              onPress={() => {
                roce();
                onAbrir(e.clave);
              }}
              accessibilityRole="button"
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                backgroundColor: TONO.tarjeta,
                borderWidth: 1,
                borderColor: 'rgba(28,43,34,0.08)',
                borderRadius: 18,
                paddingVertical: 18,
                paddingHorizontal: 18,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}
            >
              <Icono estilo={PUERTAS[e.clave]} size={22} caja={46} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: INK.title }}>{e.titulo}</Text>
                <Text style={{ fontSize: 13, color: INK.meta }} numberOfLines={1}>
                  {e.consulta.data ? e.resumen(e.consulta.data) : ' '}
                </Text>
              </View>
              <ChevronRight size={18} color={INK.meta} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
