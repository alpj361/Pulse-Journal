import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Linking, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, ChevronLeft, ChevronRight, Radar } from 'lucide-react-native';
import { INK, SERIF } from '../theme';
import { roce } from '../../utils/haptics';
import { cambiarSeguimiento, hallazgosDe, marcarSeguimientoVisto, opinarHallazgo } from './api';
import { HorasDelTema } from './Enterarse';
import { estadoAvisos, registrarAvisos } from '../../utils/notificaciones';
import { avisaDe, cuandoMiro, cuandoMiraTexto, fuenteDe, horaCorta, resumenPlano, resumenSeguimiento, tituloHallazgo } from './logica';
import { Boton, EstadoCentro, ROTULO, TONO, Refrescar } from './piezas';
import MorphingInfinity from '../MorphingInfinity';

/**
 * Lo que sigue un agente: los temas que vigila por su cuenta (sus monitoreos)
 * y lo que va encontrando. Para la persona son «temas que sigue», no
 * monitores ni webhooks.
 *
 * La pestaña recibe la consulta ya hecha: el chat la muestra solo si el
 * backend la tiene (ver `seguimientosDe`).
 */
export function Sigue({ consulta, nombre, bottomInset, onAbrir }) {
  const lista = consulta.data || [];
  if (consulta.isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <MorphingInfinity size={28} color={INK.meta} />
      </View>
    );
  }
  if (consulta.error) {
    return (
      <EstadoCentro titulo="No se pudo traer lo que sigue" texto="Revisá la conexión y probá de nuevo.">
        <Boton texto="probar de nuevo" onPress={() => consulta.refetch()} />
      </EstadoCentro>
    );
  }
  if (!lista.length) {
    return (
      <EstadoCentro
        icono={<Radar size={30} color={TONO.verde} strokeWidth={1.6} />}
        titulo="Todavía no sigue nada"
        texto={`Pedile a ${nombre} que esté atento a un tema y te avisa cuando aparezca algo.`}
      />
    );
  }
  return (
    <ScrollView
      contentContainerStyle={{ padding: 20, paddingBottom: bottomInset + 24, gap: 10 }}
      refreshControl={<Refrescar onRefresh={consulta.refetch} />}
    >
      {lista.map((s) => (
        <Tema key={s.id} seguimiento={s} onPress={() => onAbrir(s)} />
      ))}
    </ScrollView>
  );
}

/** Un tema: su nombre, lo nuevo y cuándo miró por última vez. */
function Tema({ seguimiento: s, onPress }) {
  const resumen = resumenSeguimiento(s);
  const pausado = s.estado === 'pausado';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[s.tema, resumen, pausado ? 'en pausa' : null].filter(Boolean).join(', ')}
      style={({ pressed }) => ({
        backgroundColor: 'rgba(255,255,255,0.86)',
        borderWidth: 1,
        borderColor: s.importantes > 0 ? 'rgba(154,83,71,0.28)' : 'rgba(28,43,34,0.08)',
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        opacity: pressed ? 0.7 : pausado ? 0.6 : 1,
      })}
    >
      <View style={{ flex: 1, gap: 5 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', lineHeight: 21, color: INK.title }} numberOfLines={2}>
          {s.tema}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          {resumen ? <Text style={{ fontSize: 12.5, fontWeight: '700', color: s.importantes > 0 ? TONO.ladrillo : TONO.verde }}>{resumen}</Text> : null}
          <Text style={{ fontSize: 12, color: INK.meta }}>{pausado ? 'en pausa' : cuandoMiro(s.revisado_at)}</Text>
        </View>
      </View>
      <ChevronRight size={16} color={INK.meta} />
    </Pressable>
  );
}

const FILTROS = [
  { clave: null, texto: 'todo' },
  { clave: 'nuevos', texto: 'nuevo' },
  { clave: 'importantes', texto: 'importante' },
];

/**
 * Un tema abierto: lo que encontró, de lo más nuevo a lo más viejo. Cada
 * hallazgo se abre en su fuente y se marca «importa» o «no es»; así el agente
 * aprende qué le sirve a la persona. Al abrir, lo nuevo queda visto.
 */
export function Seguimiento({ colaborador, seguimiento: s, topInset, bottomInset, onVolver }) {
  const queryClient = useQueryClient();
  const [filtro, setFiltro] = useState(s.nuevos > 0 ? 'nuevos' : null);
  const estado = s.estado;
  const [modo, setModo] = useState(s.modo_aviso || 'urgentes');
  const [horas, setHoras] = useState(s.horas);
  const [viendoHoras, setViendoHoras] = useState(false);


  const consulta = useInfiniteQuery({
    queryKey: ['colab-hallazgos', colaborador.id, s.id, filtro],
    queryFn: ({ pageParam }) => hallazgosDe(colaborador.id, s.id, { limit: 30, antes: pageParam, solo: filtro || undefined }),
    initialPageParam: undefined,
    getNextPageParam: (ultima) => ultima?.next_cursor || undefined,
  });
  // El backend los manda como `items` (o `hallazgos`).
  const hallazgos = useMemo(() => (consulta.data?.pages || []).flatMap((p) => p.items || p.hallazgos || []), [consulta.data]);

  // Lo nuevo queda visto al abrir; la lista de temas se actualiza al volver.
  useEffect(() => {
    if (!(s.nuevos > 0)) return;
    marcarSeguimientoVisto(colaborador.id, s.id)
      .then(() => queryClient.invalidateQueries({ queryKey: ['colab-seguimientos', colaborador.id] }))
      .catch(() => {});
  }, [colaborador.id, s.id, s.nuevos, queryClient]);

  /** Guarda un cambio de avisos (`modo_aviso` u `horas`); si no sale, vuelve atrás. */
  const cambiarAvisos = async (cambios) => {
    const antes = { modo, horas };
    if (cambios.modo_aviso) setModo(cambios.modo_aviso);
    if (cambios.horas) setHoras(cambios.horas);
    try {
      await cambiarSeguimiento(colaborador.id, s.id, cambios);
      queryClient.invalidateQueries({ queryKey: ['colab-seguimientos', colaborador.id] });
      return true;
    } catch {
      setModo(antes.modo);
      setHoras(antes.horas);
      Alert.alert('No se pudo cambiar', 'Revisá la conexión y probá de nuevo.');
      return false;
    }
  };

  /**
   * Prender o apagar los avisos del tema. Al prenderlos se pide el permiso del
   * teléfono, que es cuando sirve; si están apagados para Vizta, se dice.
   */
  const alternarAvisos = async (prender) => {
    roce();
    const ok = await cambiarAvisos({ modo_aviso: prender ? (s.modo_aviso && s.modo_aviso !== 'silencio' ? s.modo_aviso : 'urgentes') : 'silencio' });
    if (!ok || !prender) return;
    let telefono = await estadoAvisos();
    if (telefono === 'sin_preguntar') {
      await registrarAvisos();
      telefono = await estadoAvisos();
    }
    if (telefono === 'no') {
      Alert.alert('Los avisos de Vizta están apagados', 'Prendelos en Ajustes para que te lleguen al teléfono.', [
        { text: 'ahora no', style: 'cancel' },
        { text: 'abrir Ajustes', onPress: () => Linking.openSettings().catch(() => {}) },
      ]);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingTop: topInset + 10, paddingHorizontal: 20, paddingBottom: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: TONO.raya }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Pressable
            onPress={onVolver}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Volver"
            style={({ pressed }) => ({ width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}
          >
            <ChevronLeft size={24} color={INK.title} strokeWidth={2} />
          </Pressable>
        </View>
        <Text style={{ fontFamily: SERIF, fontSize: 26, lineHeight: 30, color: INK.title }} accessibilityRole="header">
          {s.tema}
        </Text>
        {s.descripcion ? (
          <Text style={{ fontSize: 13.5, lineHeight: 19, color: INK.body }} numberOfLines={3}>
            {s.descripcion}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {avisaDe(modo) && estado !== 'pausado' ? (
            <Bell size={16} color={TONO.verde} strokeWidth={2} />
          ) : (
            <BellOff size={16} color={INK.meta} strokeWidth={2} />
          )}
          <Pressable
            onPress={() => setViendoHoras(true)}
            disabled={!horas || estado === 'pausado'}
            accessibilityRole={horas ? 'button' : undefined}
            accessibilityHint={horas ? 'Elegir a qué horas mira' : undefined}
            style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, opacity: pressed ? 0.55 : 1 })}
          >
            <Text style={{ fontSize: 13.5, color: INK.body, flexShrink: 1 }} numberOfLines={1}>
              {cuandoMiraTexto({ estado, horas })}
            </Text>
            {horas && estado !== 'pausado' ? <ChevronRight size={14} color={INK.meta} /> : null}
          </Pressable>
          <Switch
            value={avisaDe(modo)}
            onValueChange={alternarAvisos}
            trackColor={{ true: TONO.verde, false: 'rgba(28,43,34,0.14)' }}
            ios_backgroundColor="rgba(28,43,34,0.14)"
            accessibilityLabel="Avisarme de este tema"
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {FILTROS.map((f) => {
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
      </View>

      {consulta.isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <MorphingInfinity size={28} color={INK.meta} />
        </View>
      ) : consulta.error ? (
        <EstadoCentro titulo="No se pudo traer lo que encontró" texto="Revisá la conexión y probá de nuevo.">
          <Boton texto="probar de nuevo" onPress={() => consulta.refetch()} />
        </EstadoCentro>
      ) : !hallazgos.length ? (
        <EstadoCentro
          titulo={filtro ? 'Nada por acá' : 'Todavía no encontró nada'}
          texto={filtro ? 'Probá con «todo».' : 'Cuando aparezca algo sobre este tema, te avisa.'}
        />
      ) : (
        <FlatList
          data={hallazgos}
          keyExtractor={(h) => h.id}
          contentContainerStyle={{ padding: 20, paddingBottom: bottomInset + 24, gap: 10 }}
          onEndReached={() => consulta.hasNextPage && !consulta.isFetchingNextPage && consulta.fetchNextPage()}
          onEndReachedThreshold={0.4}
          refreshControl={<Refrescar onRefresh={consulta.refetch} />}
          ListFooterComponent={consulta.isFetchingNextPage ? <MorphingInfinity size={20} color={INK.meta} style={{ marginVertical: 12, alignSelf: 'center' }} /> : null}
          renderItem={({ item }) => <Hallazgo colaborador={colaborador} seguimientoId={s.id} hallazgo={item} />}
        />
      )}

      {viendoHoras && horas ? (
        <HorasDelTema
          seguimiento={{ ...s, horas }}
          bottomInset={bottomInset}
          onCambiar={cambiarAvisos}
          onCerrar={() => setViendoHoras(false)}
        />
      ) : null}
    </View>
  );
}

/** Algo que encontró: título, de dónde y cuándo; se abre en su fuente. */
function Hallazgo({ colaborador, seguimientoId, hallazgo: h }) {
  const [veredicto, setVeredicto] = useState(h.veredicto || null);
  const opinar = async (v) => {
    const antes = veredicto;
    const siguiente = veredicto === v ? null : v;
    if (!siguiente) return;
    roce();
    setVeredicto(siguiente);
    try {
      await opinarHallazgo(colaborador.id, seguimientoId, h.id, siguiente);
    } catch {
      setVeredicto(antes);
    }
  };
  const extracto = resumenPlano(h.extracto);
  const abrir = h.url ? () => Linking.openURL(h.url).catch(() => {}) : null;
  return (
    <View
      style={{
        backgroundColor: 'rgba(255,255,255,0.86)',
        borderWidth: 1,
        // Lo importante se nota en el borde, no en un punto.
        borderColor: h.fuerza === 'fuerte' ? 'rgba(154,83,71,0.28)' : 'rgba(28,43,34,0.08)',
        borderRadius: 16,
        padding: 14,
        gap: 8,
        opacity: veredicto === 'no_es' ? 0.5 : 1,
      }}
    >
      <Pressable onPress={abrir} disabled={!abrir} accessibilityRole={abrir ? 'link' : undefined} style={({ pressed }) => ({ gap: 6, opacity: pressed ? 0.6 : 1 })}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={ROTULO}>{fuenteDe(h).toUpperCase()}</Text>
          <View style={{ flex: 1 }} />
          <Text style={{ fontSize: 11.5, color: INK.meta }}>{horaCorta(h.fecha || h.created_at)}</Text>
        </View>
        <Text style={{ fontSize: 15, fontWeight: '700', lineHeight: 21, color: INK.title }} numberOfLines={3}>
          {tituloHallazgo(h)}
        </Text>
        {h.titulo && extracto ? (
          <Text style={{ fontSize: 13, lineHeight: 18, color: INK.body }} numberOfLines={3}>
            {extracto}
          </Text>
        ) : null}
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[
          ['si_importa', 'importa'],
          ['no_es', 'no es'],
        ].map(([v, texto]) => {
          const activo = veredicto === v;
          return (
            <Pressable
              key={v}
              onPress={() => opinar(v)}
              accessibilityRole="button"
              accessibilityState={{ selected: activo }}
              style={{
                height: 32,
                paddingHorizontal: 14,
                borderRadius: 10,
                justifyContent: 'center',
                backgroundColor: activo ? (v === 'si_importa' ? TONO.verde : 'rgba(28,43,34,0.12)') : 'transparent',
                borderWidth: activo ? 0 : 1,
                borderColor: TONO.borde,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: activo && v === 'si_importa' ? '#FFFFFF' : INK.body }}>{texto}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
