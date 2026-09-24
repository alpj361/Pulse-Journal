import { useMemo, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { INK, RADIUS, SERIF } from '../theme';
import { MONO } from './mono';
import { PAPEL } from './Papel';
import { roce } from '../../utils/haptics';

/**
 * Una fecha se elige, no se teclea.
 *
 * El campo era un `TextInput` con «AAAA-MM-DD» de marcador: quien lo llenaba
 * tenía que saber el formato, escribir diez caracteres sin equivocarse y, si
 * ponía «15/03/2024», guardaba algo que el contrato rechaza. Con el calendario
 * el formato deja de ser problema de quien escribe — se toca un día y se
 * guarda ISO, que es lo único que el servidor acepta.
 *
 * **Es un calendario propio y no el del sistema** porque el selector nativo no
 * está en este binario, y agregarlo obliga a recompilar la app. Este pesa una
 * grilla de siete columnas y hace lo mismo para el caso que importa: elegir un
 * día, saltar de mes, y volver a hoy.
 */

const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** `2024-03-15` → Date local, sin que el huso mueva el día. */
function desdeISO(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date → `2024-03-15`. `toISOString` no sirve: convierte a UTC y cambia el día. */
function aISO(d) {
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

const esMismoDia = (a, b) =>
  a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export default function CampoFecha({ value, onChange, accent = INK.title }) {
  const [abierto, setAbierto] = useState(false);
  const elegida = desdeISO(value);
  const [mes, setMes] = useState(() => {
    const base = elegida || new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const hoy = new Date();

  // Los días del mes, precedidos por los huecos hasta el primer lunes: la
  // semana empieza en lunes acá, no en domingo.
  const celdas = useMemo(() => {
    const primero = new Date(mes.getFullYear(), mes.getMonth(), 1);
    const cuantos = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
    const huecos = (primero.getDay() + 6) % 7;
    return [
      ...Array.from({ length: huecos }, () => null),
      ...Array.from({ length: cuantos }, (_, i) => new Date(mes.getFullYear(), mes.getMonth(), i + 1)),
    ];
  }, [mes]);

  const mover = (paso) => {
    roce();
    setMes((m) => new Date(m.getFullYear(), m.getMonth() + paso, 1));
  };

  return (
    <>
      <Pressable
        onPress={() => {
          roce();
          setAbierto(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={elegida ? `Fecha: ${value}. Tocá para cambiarla` : 'Elegir una fecha'}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 9,
          paddingHorizontal: 13,
          paddingVertical: 12,
          borderRadius: RADIUS.sm,
          borderWidth: 1,
          borderColor: 'rgba(28,43,34,0.12)',
          backgroundColor: pressed ? 'rgba(28,43,34,0.05)' : 'transparent',
        })}
      >
        <CalendarDays size={15} color={elegida ? accent : INK.faint} />
        <Text style={{ flex: 1, fontSize: 14, color: elegida ? INK.title : INK.faint }}>
          {elegida ? `${elegida.getDate()} de ${MESES[elegida.getMonth()]} de ${elegida.getFullYear()}` : 'Elegir fecha'}
        </Text>
        {elegida ? (
          <Pressable
            onPress={() => {
              roce();
              onChange(null);
            }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Quitar la fecha"
          >
            <X size={14} color={INK.faint} />
          </Pressable>
        ) : null}
      </Pressable>

      <Modal visible={abierto} transparent animationType="fade" onRequestClose={() => setAbierto(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(20,28,22,0.4)', justifyContent: 'center', padding: 26 }}>
          <Pressable style={{ position: 'absolute', inset: 0 }} onPress={() => setAbierto(false)} />

          <Animated.View
            entering={FadeInDown.springify().damping(19).stiffness(180)}
            style={{ backgroundColor: PAPEL, borderRadius: 22, padding: 18 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ flex: 1, fontFamily: SERIF, fontSize: 21, color: INK.title }}>
                {MESES[mes.getMonth()]} {mes.getFullYear()}
              </Text>
              <Pressable onPress={() => mover(-1)} hitSlop={10} accessibilityLabel="Mes anterior" style={{ padding: 6 }}>
                <ChevronLeft size={18} color={INK.body} />
              </Pressable>
              <Pressable onPress={() => mover(1)} hitSlop={10} accessibilityLabel="Mes siguiente" style={{ padding: 6 }}>
                <ChevronRight size={18} color={INK.body} />
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', marginBottom: 6 }}>
              {DIAS.map((d, i) => (
                <Text
                  key={i}
                  style={{ flex: 1, textAlign: 'center', fontFamily: MONO, fontSize: 10.5, color: INK.faint }}
                >
                  {d}
                </Text>
              ))}
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {celdas.map((d, i) => {
                const activa = esMismoDia(d, elegida);
                const esHoy = esMismoDia(d, hoy);
                return (
                  <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}>
                    {d ? (
                      <Pressable
                        onPress={() => {
                          roce();
                          onChange(aISO(d));
                          setAbierto(false);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`${d.getDate()} de ${MESES[d.getMonth()]}`}
                        style={({ pressed }) => ({
                          flex: 1,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 10,
                          backgroundColor: activa ? accent : pressed ? 'rgba(28,43,34,0.07)' : 'transparent',
                          // Hoy se marca con un borde, no con relleno: el
                          // relleno ya significa «esta es la elegida».
                          borderWidth: esHoy && !activa ? 1 : 0,
                          borderColor: 'rgba(28,43,34,0.22)',
                        })}
                      >
                        <Text style={{ fontSize: 14, color: activa ? PAPEL : INK.body }}>{d.getDate()}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
              <Pressable
                onPress={() => {
                  roce();
                  onChange(aISO(hoy));
                  setAbierto(false);
                }}
                style={({ pressed }) => ({
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 12,
                  borderRadius: RADIUS.sm,
                  borderWidth: 1,
                  borderColor: 'rgba(28,43,34,0.12)',
                  backgroundColor: pressed ? 'rgba(28,43,34,0.05)' : 'transparent',
                })}
              >
                <Text style={{ fontFamily: MONO, fontSize: 12, color: INK.body }}>hoy</Text>
              </Pressable>
              <Pressable
                onPress={() => setAbierto(false)}
                style={({ pressed }) => ({
                  paddingHorizontal: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: RADIUS.sm,
                  backgroundColor: pressed ? 'rgba(28,43,34,0.10)' : 'rgba(28,43,34,0.06)',
                })}
              >
                <Text style={{ fontFamily: MONO, fontSize: 12, color: INK.body }}>cerrar</Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}
