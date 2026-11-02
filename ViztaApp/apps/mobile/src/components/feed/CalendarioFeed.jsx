import { useMemo, useState } from 'react';
import { Dimensions, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useQuery } from '@tanstack/react-query';
import {
  BadgeCheck, CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Hourglass, Landmark, ListFilter, MessagesSquare, Sun, UserCheck, Vote, X,
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
 * Lo que marca un día en el mes. Lo de un solo día va en un círculo; lo que
 * dura varios días (una campaña, un concurso) va como una franja del color de
 * su tipo que corre de su inicio a su fin, para que se lea como un tramo y no
 * como muchas fechas sueltas.
 */
export const marcasDelDia = (fechas, d) => fechas.filter((f) => !f.fin && f.fecha === d);
export const tramoDelDia = (fechas, d) => fechas.find((f) => f.fin && d >= f.fecha && d <= f.fin) || null;
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
 * Cerrado es una pastilla con el ícono; con el feed filtrado, dice el día y
 * lleva su equis para volver a todos los días. Donde el título ya nombra el
 * día (`conFecha` en falso), la pastilla no lo repite.
 *
 * Abierto, el mes. Tocar un día solo lo muestra —sus fechas claves, abajo—;
 * el feed cambia recién con «filtrar el feed por este día». Mirar el
 * calendario no tiene que mover lo que se estaba leyendo.
 */
export default function CalendarioFeed({ feed, dia, onElegir, conFecha = true }) {
  const insets = useSafeAreaInsets();
  const [panel, setPanel] = useState(false);
  const [visto, setVisto] = useState(null); // el día tocado en el mes, filtre o no
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
    setVisto(dia);
    setPanel(true);
  };
  const ver = (d) => {
    roce();
    setVisto((v) => (v === d ? null : d));
  };
  const filtrar = (d) => {
    roce();
    onElegir?.(d);
    setPanel(false);
  };
  const mover = (paso) => {
    roce();
    setMes(({ anio, mes: m }) => {
      const n = new Date(anio, m + paso, 1);
      return { anio: n.getFullYear(), mes: n.getMonth() };
    });
  };

  const alto = Dimensions.get('window').height;
  const lista = visto ? delDia(fechas, visto) : proximas(fechas, hoy);

  return (
    <>
      <View>
        <Cristal radio={RADIUS.pill}>
          <View style={{ flexDirection: 'row', alignItems: 'center', height: 36 }}>
            <Pressable
              onPress={abrir}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={dia ? `Mostrando ${nombreLargo(dia)}. Abrir el calendario` : 'Calendario de fechas claves'}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingLeft: dia ? 11 : 10, paddingRight: dia ? 4 : 10, opacity: pressed ? 0.6 : 1 })}
            >
              <CalendarDays size={16} color={dia ? TINTA : INK.meta} strokeWidth={2.2} />
              {dia && conFecha ? <Text style={{ fontSize: 13, fontWeight: '700', color: TINTA }}>{fechaCorta(dia)}</Text> : null}
            </Pressable>
            {dia ? (
              <Pressable
                onPress={() => { roce(); onElegir?.(null); }}
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
                      <Mes anio={mes.anio} mes={mes.mes} hoy={hoy} visto={visto} filtrado={dia} fechas={fechas} publicados={publicados} onVer={ver} onMover={mover} />
                      <View style={{ height: 1, backgroundColor: 'rgba(28,43,34,0.08)', marginVertical: 12 }} />
                      <Text style={{ fontSize: 10, fontWeight: '800', color: INK.faint, letterSpacing: 1.2, marginBottom: 8 }}>
                        {(visto ? nombreLargo(visto) : 'próximas fechas claves').toUpperCase()}
                      </Text>
                      {lista.length ? (
                        lista.map((f) => (
                          <FilaFecha key={f.id} fecha={f} conDia={!visto} onPress={visto ? undefined : () => {
                            const [a, m] = f.fecha.split('-').map(Number);
                            setMes({ anio: a, mes: m - 1 });
                            ver(f.fecha);
                          }} />
                        ))
                      ) : (
                        <Text style={{ fontSize: 13, color: INK.meta, paddingVertical: 6 }}>
                          {visto ? 'Sin fechas claves este día.' : 'Sin fechas claves por delante.'}
                        </Text>
                      )}
                      {visto && visto !== dia ? (
                        <BotonFiltro onPress={() => filtrar(visto)} etiqueta="filtrar el feed por este día" />
                      ) : null}
                      {dia ? (
                        <Pressable onPress={() => filtrar(null)} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
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

/** El único control que cambia el feed desde el calendario. */
function BotonFiltro({ onPress, etiqueta }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        minHeight: 46, marginTop: 10, borderRadius: RADIUS.pill, backgroundColor: TINTA, opacity: pressed ? 0.8 : 1,
      })}
    >
      <ListFilter size={16} color="#FFFFFF" strokeWidth={2.4} />
      <Text style={{ fontSize: 14, fontWeight: '700', color: '#FFFFFF' }}>{etiqueta}</Text>
    </Pressable>
  );
}

function Mes({ anio, mes, hoy, visto, filtrado, fechas, publicados, onVer, onMover }) {
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
          {semana.map((d, i) => (d ? (
            <Dia key={d} dia={d} columna={i} ultimoDelMes={!semana[i + 1]} hoy={hoy} visto={d === visto} filtrado={d === filtrado}
              fechas={marcasDelDia(fechas, d)} tramo={tramoDelDia(fechas, d)} conTotal={delDia(fechas, d).length}
              publicado={publicados.has(d)} onPress={() => onVer(d)} />
          ) : <View key={i} style={{ flex: 1, height: 42 }} />))}
        </View>
      ))}
    </View>
  );
}

function Dia({ dia, columna, ultimoDelMes, hoy, visto, filtrado, fechas, tramo, conTotal, publicado, onPress }) {
  const numero = Number(dia.slice(8));
  const color = fechas.length ? TIPOS_FECHA[fechas[0].tipo].color : null;
  const colorTramo = tramo ? TIPOS_FECHA[tramo.tipo].color : null;
  // La franja se redondea donde empieza o termina el tramo, y también donde
  // la corta la semana o el mes.
  const abre = tramo && (dia === tramo.fecha || columna === 0 || numero === 1);
  const cierra = tramo && (dia === tramo.fin || columna === 6 || ultimoDelMes);
  const etiqueta = [
    nombreLargo(dia),
    conTotal ? `${conTotal} ${conTotal === 1 ? 'fecha clave' : 'fechas claves'}` : null,
    publicado ? 'con publicaciones' : null,
    filtrado ? 'el feed muestra este día' : null,
  ].filter(Boolean).join(', ');
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={etiqueta} accessibilityState={{ selected: visto }}
      style={{ flex: 1, height: 42, alignItems: 'center', justifyContent: 'center' }}>
      {tramo ? (
        <View style={{
          position: 'absolute', top: 5, bottom: 5, left: abre ? 3 : 0, right: cierra ? 3 : 0,
          backgroundColor: `${colorTramo}26`,
          borderTopLeftRadius: abre ? 16 : 0, borderBottomLeftRadius: abre ? 16 : 0,
          borderTopRightRadius: cierra ? 16 : 0, borderBottomRightRadius: cierra ? 16 : 0,
        }} />
      ) : null}
      <View style={{
        width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
        backgroundColor: visto ? TINTA : color ? `${color}2E` : 'transparent',
        borderWidth: filtrado && !visto ? 2 : dia === hoy && !visto ? 1.5 : 0, borderColor: filtrado ? TINTA : INK.title,
      }}>
        <Text style={{
          fontSize: 14,
          fontWeight: visto || dia === hoy ? '800' : publicado || color || tramo ? '600' : '400',
          color: visto ? '#FFFFFF' : color ? color : colorTramo ? colorTramo : publicado ? INK.title : INK.faint,
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
