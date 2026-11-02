import { useMemo, useState } from 'react';
import { Dimensions, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';
import {
  BadgeCheck, CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Hourglass, Landmark, MessagesSquare, Sun, UserCheck, Vote, X,
} from 'lucide-react-native';
import { INK, RADIUS } from '../theme';
import { Cristal } from './SelectorFeed';
import { roce } from '../../utils/haptics';
import {
  MESES, TIPOS_FECHA, delDia, delFeed, fechaCorta, proximas, rangoDe, semanasDelMes, traerDiasConPublicaciones, traerFechasClaves,
} from './fechasClaves';

const TINTA = '#2F4A7A';
const ICONO = {
  sesion: Landmark, periodo: CalendarRange, plazo: Hourglass, designacion: UserCheck,
  reunion: MessagesSquare, electoral: Vote, posesion: BadgeCheck, asueto: Sun,
};
const SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/**
 * Lo que marca un día en el mes. Lo que dura varios días (una campaña de tres
 * meses) marca su inicio y su fin, no cada día del medio: si no, el mes entero
 * queda pintado y no se distingue nada. Al tocar un día del medio igual aparece.
 */
const marcasDelDia = (fechas, d) => fechas.filter((f) => f.fecha === d || f.fin === d);
const hoyGT = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guatemala' });

export function useFechasClaves(feed) {
  const consulta = useQuery({ queryKey: ['fechas-claves'], queryFn: traerFechasClaves, staleTime: 30 * 60 * 1000 });
  const fechas = useMemo(() => delFeed(consulta.data || [], feed), [consulta.data, feed]);
  return { ...consulta, fechas };
}

/** «martes 3 de noviembre» */
function nombreLargo(dia) {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long' });
}

/**
 * El calendario del feed, al lado de «de dónde» se lee.
 *
 * Cerrado es una pastilla con el ícono; con un día elegido, dice cuál y lleva
 * su equis para volver a todos los días. Donde el título ya nombra el día
 * (`conFecha` en falso), la pastilla no lo repite. Abierto, el mes: los días con fechas
 * claves van con el círculo del color de su tipo, y los días con algo
 * publicado en tinta firme. Tocar un día filtra el feed y muestra sus fechas.
 */
export default function CalendarioFeed({ feed, dia, onElegir, conFecha = true }) {
  const insets = useSafeAreaInsets();
  const [panel, setPanel] = useState(false);
  const hoy = hoyGT();
  const base = (dia || hoy).split('-').map(Number);
  const [mes, setMes] = useState({ anio: base[0], mes: base[1] - 1 });
  const { fechas } = useFechasClaves(feed);
  const conPublicaciones = useQuery({
    queryKey: ['dias-con-publicaciones', feed],
    queryFn: () => traerDiasConPublicaciones(feed),
    enabled: !!panel,
    staleTime: 30 * 60 * 1000,
  });
  const publicados = useMemo(() => new Set(conPublicaciones.data || []), [conPublicaciones.data]);

  const abrir = () => {
    roce();
    const [a, m] = (dia || hoy).split('-').map(Number);
    setMes({ anio: a, mes: m - 1 });
    setPanel(true);
  };
  const elegir = (d) => {
    roce();
    onElegir?.(d === dia ? null : d);
  };
  const mover = (paso) => {
    roce();
    setMes(({ anio, mes: m }) => {
      const n = new Date(anio, m + paso, 1);
      return { anio: n.getFullYear(), mes: n.getMonth() };
    });
  };

  const alto = Dimensions.get('window').height;
  const lista = dia ? delDia(fechas, dia) : proximas(fechas, hoy);

  return (
    <>
      <View>
        <Cristal radio={RADIUS.pill}>
          <View style={{ flexDirection: 'row', alignItems: 'center', height: 36 }}>
            <Pressable
              onPress={abrir}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={dia ? `Mostrando ${nombreLargo(dia)}. Cambiar el día` : 'Calendario de fechas claves'}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingLeft: dia ? 11 : 10, paddingRight: dia ? 4 : 10, opacity: pressed ? 0.6 : 1 })}
            >
              <CalendarDays size={16} color={dia ? TINTA : INK.meta} strokeWidth={2.2} />
              {dia && conFecha ? <Text style={{ fontSize: 13, fontWeight: '700', color: TINTA }}>{fechaCorta(dia)}</Text> : null}
            </Pressable>
            {dia ? (
              <Pressable
                onPress={() => elegir(dia)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Mostrar todos los días"
                style={({ pressed }) => ({ height: 36, paddingLeft: 4, paddingRight: 10, justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
              >
                <X size={14} color={INK.meta} strokeWidth={2.4} />
              </Pressable>
            ) : null}
          </View>
        </Cristal>
      </View>

      {/* Sube desde abajo y no cuelga de la pastilla: el mes y sus fechas no
          caben debajo de un botón que está a media pantalla. */}
      <Modal visible={panel} transparent animationType="fade" onRequestClose={() => setPanel(false)}>
        <Pressable accessible={false} style={{ flex: 1, backgroundColor: 'rgba(28,43,34,0.16)' }} onPress={() => setPanel(false)}>
          {panel ? (
            <Animated.View
              entering={SlideInDown.springify().damping(20).stiffness(220).mass(0.7)}
              style={{ position: 'absolute', bottom: insets.bottom + 12, left: 12, right: 12 }}
            >
              {/* El panel se toca sin cerrarse: solo afuera cierra. */}
              <Pressable accessible={false} onPress={() => {}}>
                <Cristal radio={RADIUS.xl}>
                  <Animated.View entering={FadeIn.duration(140)}>
                    <ScrollView style={{ maxHeight: alto * 0.78 }} contentContainerStyle={{ padding: 14 }} showsVerticalScrollIndicator={false}>
                      <Mes anio={mes.anio} mes={mes.mes} hoy={hoy} dia={dia} fechas={fechas} publicados={publicados} onElegir={elegir} onMover={mover} />
                      <View style={{ height: 1, backgroundColor: 'rgba(28,43,34,0.08)', marginVertical: 12 }} />
                      <Text style={{ fontSize: 10, fontWeight: '800', color: INK.faint, letterSpacing: 1.2, marginBottom: 8 }}>
                        {(dia ? nombreLargo(dia) : 'próximas fechas claves').toUpperCase()}
                      </Text>
                      {lista.length ? (
                        lista.map((f) => (
                          <FilaFecha key={f.id} fecha={f} conDia={!dia} onPress={dia ? undefined : () => {
                            const [a, m] = f.fecha.split('-').map(Number);
                            setMes({ anio: a, mes: m - 1 });
                            elegir(f.fecha);
                          }} />
                        ))
                      ) : (
                        <Text style={{ fontSize: 13, color: INK.meta, paddingVertical: 6 }}>
                          {dia ? 'Sin fechas claves este día.' : 'Sin fechas claves por delante.'}
                        </Text>
                      )}
                      {dia ? (
                        <Pressable onPress={() => elegir(dia)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
                          <Text style={{ fontSize: 13, color: TINTA, fontWeight: '600' }}>mostrar todos los días</Text>
                        </Pressable>
                      ) : null}
                    </ScrollView>
                  </Animated.View>
                </Cristal>
              </Pressable>
            </Animated.View>
          ) : null}
        </Pressable>
      </Modal>
    </>
  );
}

function Mes({ anio, mes, hoy, dia, fechas, publicados, onElegir, onMover }) {
  const semanas = semanasDelMes(anio, mes);
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Pressable onPress={() => onMover(-1)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Mes anterior" style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          <ChevronLeft size={18} color={INK.meta} strokeWidth={2.2} />
        </Pressable>
        <Text style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '700', color: INK.title }}>{`${MESES[mes]} ${anio}`}</Text>
        <Pressable onPress={() => onMover(1)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Mes siguiente" style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          <ChevronRight size={18} color={INK.meta} strokeWidth={2.2} />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', marginBottom: 4 }}>
        {SEMANA.map((l, i) => (
          <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', color: INK.faint }}>{l}</Text>
        ))}
      </View>
      {semanas.map((semana, s) => (
        <View key={s} style={{ flexDirection: 'row' }}>
          {semana.map((d, i) => (d ? <Dia key={d} dia={d} hoy={hoy} elegido={d === dia} fechas={marcasDelDia(fechas, d)} publicado={publicados.has(d)} onPress={() => onElegir(d)} /> : <View key={i} style={{ flex: 1, height: 42 }} />))}
        </View>
      ))}
    </View>
  );
}

function Dia({ dia, hoy, elegido, fechas, publicado, onPress }) {
  const numero = Number(dia.slice(8));
  const color = fechas.length ? TIPOS_FECHA[fechas[0].tipo].color : null;
  const etiqueta = [
    nombreLargo(dia),
    fechas.length ? `${fechas.length} ${fechas.length === 1 ? 'fecha clave' : 'fechas claves'}` : null,
    publicado ? 'con publicaciones' : null,
  ].filter(Boolean).join(', ');
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={etiqueta} accessibilityState={{ selected: elegido }}
      style={{ flex: 1, height: 42, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
        backgroundColor: elegido ? TINTA : color ? `${color}2E` : 'transparent',
        borderWidth: dia === hoy && !elegido ? 1.5 : 0, borderColor: INK.title,
      }}>
        <Text style={{
          fontSize: 14,
          fontWeight: elegido || dia === hoy ? '800' : publicado || color ? '600' : '400',
          color: elegido ? '#FFFFFF' : color ? color : publicado ? INK.title : INK.faint,
        }}>{numero}</Text>
      </View>
    </Pressable>
  );
}

/** Una fecha clave: el ícono de su tipo, el título y lo que hace falta saber de ella. */
export function FilaFecha({ fecha: f, conDia, onPress }) {
  const tipo = TIPOS_FECHA[f.tipo];
  const Icono = ICONO[f.tipo] || CalendarDays;
  const meta = [conDia && !f.fin ? fechaCorta(f.fecha) : null, rangoDe(f), tipo.nombre, f.hora, f.prevista ? 'prevista' : null].filter(Boolean).join(' · ');
  const contenido = (
    <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 8 }}>
      <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: `${tipo.color}1F` }}>
        <Icono size={15} color={tipo.color} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, lineHeight: 19, fontWeight: '600', color: INK.title }}>{f.titulo}</Text>
        <Text style={{ fontSize: 11.5, color: INK.meta, marginTop: 2 }}>{meta}</Text>
        {f.detalle && !conDia ? <Text style={{ fontSize: 13, lineHeight: 19, color: INK.body, marginTop: 4 }}>{f.detalle}</Text> : null}
      </View>
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${f.titulo}, ${meta}`} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      {contenido}
    </Pressable>
  ) : contenido;
}

/**
 * Arriba del feed filtrado: las fechas claves de ese día. Si no tiene, no hay
 * renglón. `omitir` deja fuera los tipos que el día ya nombra abajo (la sesión,
 * cuando el encabezado del día dice «Sesión ordinaria 54»).
 */
export function FechasDelDia({ feed, dia, omitir = [], style }) {
  const { fechas } = useFechasClaves(feed);
  const lista = delDia(fechas, dia).filter((f) => !omitir.includes(f.tipo));
  if (!lista.length) return null;
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      <Text style={{ fontSize: 10, fontWeight: '800', color: INK.faint, letterSpacing: 1.2, marginBottom: 4 }}>FECHAS CLAVES</Text>
      {lista.map((f) => <FilaFecha key={f.id} fecha={f} />)}
    </View>
  );
}
