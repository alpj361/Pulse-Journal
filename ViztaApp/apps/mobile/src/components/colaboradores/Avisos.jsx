import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react-native';
import { INK } from '../theme';
import { marcarAvisoLeido } from './api';
import { agruparAvisos, esMerge, horaCorta, noLeidos, venceEn } from './logica';
import { Avatar, Boton, EstadoCentro, ROTULO, TONO, Refrescar } from './piezas';

/**
 * Avisos (pantalla 2): lo nuevo, agrupado por día. Cada aviso lleva a su
 * pantalla y queda leído al tocarlo. Solo se muestran los que tienen a dónde
 * llevar (`AVISOS_QUE_SE_VEN`).
 *
 * El backend guarda un texto genérico («Hay una solicitud de merge_item»);
 * la app arma el suyo con la solicitud y el nombre de quien la mandó.
 */
export default function Avisos({ consulta, solicitudes, titulos, quien, deChat, topInset, bottomInset, onVolver, onAbrir }) {
  const queryClient = useQueryClient();
  const [marcando, setMarcando] = useState(false);
  const grupos = agruparAvisos(consulta.data);
  const sinLeer = noLeidos(consulta.data);

  const marcarTodo = async () => {
    setMarcando(true);
    const pendientes = (consulta.data || []).filter((a) => !a.leida_at);
    await Promise.allSettled(pendientes.map((a) => marcarAvisoLeido(a.id)));
    await queryClient.invalidateQueries({ queryKey: ['colab-avisos'] });
    setMarcando(false);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingTop: topInset + 10, paddingHorizontal: 20, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Pressable
          onPress={onVolver}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Volver a Colaboradores"
          style={({ pressed }) => ({ width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}
        >
          <ChevronLeft size={24} color={INK.title} strokeWidth={2} />
        </Pressable>
        <Text style={{ flex: 1, fontSize: 28, fontWeight: '800', letterSpacing: -0.8, color: INK.title }} accessibilityRole="header">
          Avisos
        </Text>
        {sinLeer ? (
          <Pressable onPress={marcarTodo} disabled={marcando} hitSlop={8} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed || marcando ? 0.5 : 1 })}>
            <Text style={{ fontSize: 13.5, fontWeight: '600', color: TONO.verde }}>marcar todo leído</Text>
          </Pressable>
        ) : null}
      </View>

      {consulta.isLoading ? null : consulta.error ? (
        <EstadoCentro titulo="No se pudieron traer los avisos" texto="Revisá la conexión y probá de nuevo.">
          <Boton texto="probar de nuevo" onPress={() => consulta.refetch()} />
        </EstadoCentro>
      ) : !grupos.length ? (
        <EstadoCentro titulo="Estás al día" texto="Cuando un agente te escriba o te proponga algo, te avisamos acá." />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottomInset + 24, gap: 6 }}
          refreshControl={<Refrescar onRefresh={consulta.refetch} />}
        >
          {grupos.map((g) => (
            <View key={g.titulo} style={{ gap: 2, marginTop: 10 }}>
              <Text style={[ROTULO, { marginBottom: 4 }]}>{g.titulo}</Text>
              {g.avisos.map((a) => (
                <Fila
                  key={a.id}
                  aviso={a}
                  texto={textoDe(a, { solicitudes, titulos, quien, deChat })}
                  onPress={() => {
                    if (!a.leida_at) {
                      marcarAvisoLeido(a.id)
                        .then(() => queryClient.invalidateQueries({ queryKey: ['colab-avisos'] }))
                        .catch(() => {});
                    }
                    onAbrir(a);
                  }}
                />
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function Fila({ aviso, texto, onPress }) {
  const nuevo = !aviso.leida_at;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${texto.quien} ${texto.que}${nuevo ? ', sin leer' : ''}`}
      style={({ pressed }) => ({ flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 10, opacity: pressed ? 0.6 : 1 })}
    >
      <Avatar tipo={texto.tipo} nombre={texto.quien} size={40} />
      <View style={{ flex: 1, gap: 3 }}>
        {/* Lo que no leíste se ve en tinta; lo leído, más suave. Sin puntos. */}
        <Text style={{ fontSize: 14.5, lineHeight: 20, color: nuevo ? INK.title : INK.body }}>
          <Text style={{ fontWeight: '700' }}>{texto.quien}</Text> {texto.que}
          {texto.sobre ? <Text style={{ fontWeight: '700' }}> {texto.sobre}</Text> : null}
        </Text>
        <Text style={{ fontSize: 12, color: INK.meta }} numberOfLines={1}>
          {[horaCorta(aviso.created_at), texto.extra].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </Pressable>
  );
}

/** El texto de un aviso, armado con lo que la app ya sabe. */
function textoDe(a, { solicitudes, titulos, quien, deChat }) {
  const p = a.payload || {};
  if (a.tipo === 'mensaje') {
    const c = deChat(p.conversacion_id);
    return { quien: c?.nombre || 'Un agente', tipo: c?.tipo || 'agente', que: 'te escribió', extra: a.cuerpo ? a.cuerpo.replace(/\s+/g, ' ') : null };
  }
  if (a.tipo === 'seguimiento_hallazgo') {
    const nombre = quien('agente', p.agente_id).nombre;
    return { quien: nombre, tipo: 'agente', que: 'encontró algo urgente sobre', sobre: p.tema || null, extra: p.titulo || null };
  }
  if (a.tipo === 'seguimiento') {
    const nombre = quien('agente', p.agente_id).nombre;
    const cuantos = p.nuevos > 0 ? `${p.nuevos} ${p.nuevos === 1 ? 'cosa' : 'cosas'}` : 'algo';
    return { quien: nombre, tipo: 'agente', que: `encontró ${cuantos} sobre`, sobre: p.tema || null, extra: p.importantes > 0 ? `${p.importantes} ${p.importantes === 1 ? 'importante' : 'importantes'}` : null };
  }
  const s = (solicitudes || []).find((x) => x.id === p.solicitud_id);
  if (a.tipo === 'solicitud') {
    if (!s) return { quien: 'Tenés', tipo: 'agente', que: 'algo por aprobar' };
    const o = quien(s.solicitante_tipo, s.solicitante_id);
    const que = esMerge(s) ? 'quiere cambiar' : s.tipo === 'permiso' ? 'pide poder editar' : 'te pide acceso a';
    return { quien: o.nombre, tipo: o.tipo, que, sobre: titulos?.[s.recurso_id], extra: s.estado === 'pendiente' ? venceEn(s.vence_at) : null };
  }
  const o = s ? quien(s.destinatario_tipo, s.destinatario_id) : { nombre: 'Alguien', tipo: 'humano' };
  return { quien: o.nombre, tipo: o.tipo, que: a.tipo === 'solicitud_aprobada' ? 'aprobó lo que pediste' : 'no aprobó lo que pediste' };
}
