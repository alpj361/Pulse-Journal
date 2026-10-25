import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { INK } from '../theme';
import { listo } from '../../utils/haptics';
import { aprobarSolicitud, rechazarSolicitud } from './api';
import { camposEnPalabras, esMerge, repartirSolicitudes, vencio, venceEn } from './logica';
import { Avatar, Boton, EstadoCentro, ROTULO, TONO } from './piezas';

/**
 * Por aprobar (pantalla 15): lo que te piden, lo que pediste y lo vencido.
 *
 * Un cambio a una nota (merge) se abre para verlo campo por campo. Pedir
 * permiso o acceso se decide ahí mismo. «Pediste» aparece solo si pediste
 * algo; hoy la app no pide nada por su cuenta.
 */
export default function Bandeja({ consulta, titulos, quien, yo, soloDe, topInset, bottomInset, onVolver, onAbrir }) {
  const [pestana, setPestana] = useState('tePiden');
  const todas = repartirSolicitudes(consulta.data, yo);
  const filtrar = (lista) => (soloDe ? lista.filter((s) => s.solicitante_id === soloDe.cuenta_id || s.destinatario_id === soloDe.cuenta_id) : lista);
  const tePiden = filtrar(todas.tePiden);
  const pediste = filtrar(todas.pediste);
  const vencidas = filtrar(todas.vencidas);
  const lista = pestana === 'pediste' ? pediste : tePiden;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingTop: topInset + 10, paddingHorizontal: 20, paddingBottom: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: TONO.raya }}>
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
          <Text style={{ fontSize: 28, fontWeight: '800', letterSpacing: -0.8, color: INK.title }} accessibilityRole="header">
            Por aprobar
          </Text>
        </View>
        {pediste.length ? (
          <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 4, padding: 4, backgroundColor: 'rgba(28,43,34,0.06)', borderRadius: 12 }}>
            {[
              ['tePiden', `Te piden · ${tePiden.length}`],
              ['pediste', `Pediste · ${pediste.length}`],
            ].map(([clave, texto]) => {
              const activa = clave === pestana;
              return (
                <Pressable
                  key={clave}
                  onPress={() => setPestana(clave)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activa }}
                  style={{ flex: 1, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: activa ? '#FFFFFF' : 'transparent' }}
                >
                  <Text style={{ fontSize: 13.5, fontWeight: activa ? '700' : '600', color: activa ? INK.title : '#6B786F' }}>{texto}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      {consulta.isLoading ? null : consulta.error ? (
        <EstadoCentro titulo="No se pudo traer lo que tenés por aprobar" texto="Revisá la conexión y probá de nuevo.">
          <Boton texto="probar de nuevo" onPress={() => consulta.refetch()} />
        </EstadoCentro>
      ) : !lista.length && !(pestana === 'tePiden' && vencidas.length) ? (
        <EstadoCentro titulo="No tenés nada por aprobar" texto="Cuando un agente quiera cambiar algo tuyo, te llega acá." />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: bottomInset + 24, gap: 10 }}
          refreshControl={<RefreshControl refreshing={consulta.isRefetching} onRefresh={consulta.refetch} tintColor={INK.meta} />}
        >
          {lista.map((s) => (
            <Fila
              key={s.id}
              solicitud={s}
              titulo={titulos?.[s.recurso_id]}
              otro={pestana === 'pediste' ? quien(s.destinatario_tipo, s.destinatario_id) : quien(s.solicitante_tipo, s.solicitante_id)}
              pedida={pestana === 'pediste'}
              onAbrir={() => onAbrir(s)}
            />
          ))}
          {pestana === 'tePiden' && vencidas.length ? (
            <>
              <Text style={[ROTULO, { marginTop: 12 }]}>VENCIDAS</Text>
              {vencidas.map((s) => (
                <View key={s.id} style={{ backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 16, padding: 14, gap: 4 }}>
                  <Text style={{ fontSize: 14, color: INK.body }}>
                    <Text style={{ fontWeight: '700' }}>{quien(s.solicitante_tipo, s.solicitante_id).nombre}</Text> {queria(s)}
                    {titulos?.[s.recurso_id] ? ` ${titulos[s.recurso_id]}` : ''}
                  </Text>
                  <Text style={{ fontSize: 12, color: INK.meta }}>{vencio(s)}</Text>
                </View>
              ))}
            </>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

/** Qué pide, en palabras. */
const pide = (s) => (esMerge(s) ? 'quiere cambiar' : s.tipo === 'permiso' ? 'pide poder editar' : 'te pide acceso a');
const lePediste = (s) => (esMerge(s) ? 'Le propusiste cambiar' : s.tipo === 'permiso' ? 'Le pediste poder editar' : 'Le pediste acceso a');
const queria = (s) => (esMerge(s) ? 'quería cambiar' : s.tipo === 'permiso' ? 'quería poder editar' : 'quería acceso a');

function Fila({ solicitud: s, titulo, otro, pedida, onAbrir }) {
  const queryClient = useQueryClient();
  const [ocupado, setOcupado] = useState(null);
  const merge = esMerge(s);
  const motivo = s.payload?.motivo || s.payload?.mensaje;

  const decidir = async (aprobar) => {
    setOcupado(aprobar ? 'si' : 'no');
    try {
      await (aprobar ? aprobarSolicitud(s.id) : rechazarSolicitud(s.id));
      if (aprobar) listo();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['colab-solicitudes'] }),
        queryClient.invalidateQueries({ queryKey: ['colab-lista'] }),
      ]);
    } catch {
      setOcupado(null);
      Alert.alert('No se pudo completar', 'Revisá la conexión y probá de nuevo.');
    }
  };

  const cuerpo = (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Avatar tipo={otro.tipo} nombre={otro.nombre} size={30} />
        <Text style={{ flex: 1, fontSize: 14, color: INK.title }} numberOfLines={2}>
          {pedida ? (
            lePediste(s)
          ) : (
            <>
              <Text style={{ fontWeight: '700' }}>{otro.nombre}</Text> {pide(s)}
            </>
          )}
        </Text>
        <Text style={{ fontSize: 12, color: INK.meta }}>{venceEn(s.vence_at)}</Text>
      </View>
      {titulo ? (
        <Text style={{ fontSize: 15.5, fontWeight: '700', lineHeight: 21, color: INK.title }} numberOfLines={2}>
          {titulo}
        </Text>
      ) : null}
      {merge ? <Text style={{ fontSize: 12.5, color: INK.meta }}>{camposEnPalabras(s)}</Text> : null}
      {!merge && motivo ? <Text style={{ fontSize: 13.5, lineHeight: 19, color: INK.body, fontStyle: 'italic' }}>«{motivo}»</Text> : null}
    </>
  );

  const caja = { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: pedida ? 'rgba(28,43,34,0.08)' : 'rgba(154,83,71,0.28)', borderRadius: 16, padding: 14, gap: 8 };

  if (merge && !pedida) {
    return (
      <Pressable onPress={onAbrir} accessibilityRole="button" style={({ pressed }) => [caja, { opacity: pressed ? 0.7 : 1 }]}>
        {cuerpo}
        <View style={{ position: 'absolute', right: 12, bottom: 14 }} accessible={false}>
          <ChevronRight size={16} color={INK.meta} />
        </View>
      </Pressable>
    );
  }

  return (
    <View style={caja}>
      {cuerpo}
      {pedida ? null : (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
          <Boton
            texto={s.tipo === 'permiso' ? 'darle permiso' : 'compartir'}
            primario
            alto={40}
            style={{ flex: 1 }}
            onPress={() => decidir(true)}
            cargando={ocupado === 'si'}
            disabled={!!ocupado}
          />
          <Boton texto="no" alto={40} onPress={() => decidir(false)} cargando={ocupado === 'no'} disabled={!!ocupado} />
        </View>
      )}
    </View>
  );
}
