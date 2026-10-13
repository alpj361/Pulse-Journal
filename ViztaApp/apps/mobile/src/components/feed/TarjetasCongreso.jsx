import { useMemo } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { INK, SERIF } from '../theme';
import { titular } from './congreso';

/**
 * Lo del Congreso, cada cosa con la forma que le toca.
 *
 * El monitor ya dice qué es cada noticia (`card_type`): un texto, una cifra, una
 * persona elegida, una votación, o un paso en el camino de una ley. Acá cada
 * una se dibuja distinto, para que al bajar por el día se reconozca qué pasó
 * antes de leerlo.
 *
 * Todo sale de lo que el monitor guardó. Nada se calcula ni se completa: una
 * votación que solo trae los votos a favor muestra eso, sin inventar el resto.
 *
 * PRUEBA DE DISEÑO (STA-232): por aprobar con PJ antes de extenderlo.
 */

// El color del Congreso en el feed, y los de un voto.
const TINTA = '#2F4A7A';
const RAYA = 'rgba(28,43,34,0.09)';
const VOTO = { favor: '#15803D', contra: '#B91C1C', ausente: 'rgba(28,43,34,0.28)', licencia: 'rgba(28,43,34,0.12)' };

const TOTAL = 160;
const MAYORIA = 81; // mayoría absoluta
const CALIFICADA = 107; // dos tercios

/** El rótulo chico de arriba: qué clase de cosa es. */
function Rotulo({ children, color = TINTA }) {
  return <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 0.9, color, marginBottom: 5 }}>{children}</Text>;
}

/**
 * El título, entero.
 *
 * Nunca se corta: uno largo se achica para caber en pocos renglones en vez de
 * terminar en puntos suspensivos. El asunto de una votación puede pasar de 160
 * letras («Aprobación del Capítulo I que consta de los artículos 1 al 12…»), y
 * a tamaño de titular ocuparía media pantalla.
 */
function Titulo({ children }) {
  const largo = String(children || '').length;
  const [tamano, renglon] = largo <= 48 ? [20, 25] : largo <= 85 ? [17.5, 22] : largo <= 130 ? [15.5, 20] : [14.5, 19];
  return (
    <Text style={{ fontFamily: SERIF, fontSize: tamano, color: INK.title, lineHeight: renglon, letterSpacing: largo <= 48 ? -0.2 : -0.1 }}>
      {children}
    </Text>
  );
}

function Resumen({ children, lineas = 3 }) {
  if (!children) return null;
  return (
    <Text numberOfLines={lineas} style={{ fontSize: 13.5, color: INK.body, lineHeight: 20, marginTop: 7 }}>
      {children}
    </Text>
  );
}

// ─── El camino de una ley ────────────────────────────────────────────────────

const CAMINO = [
  ['iniciativa_presentada', 'presentada'],
  ['en_comision', 'comisión'],
  ['dictamen', 'dictamen'],
  ['primer_debate', 'debate'],
  ['aprobado', 'aprobada'],
];

/**
 * Dónde va: las paradas del camino, con la de hoy marcada.
 *
 * Es una posición, no una historia: el monitor sabe en qué etapa está lo que
 * cuenta la noticia, no cuándo pasó por las anteriores. Por eso no lleva fechas
 * ni une las paradas ya recorridas como si constaran.
 */
function Camino({ etapa }) {
  const actual = CAMINO.findIndex(([clave]) => clave === etapa);
  if (actual === -1) return null;
  return (
    <View style={{ flexDirection: 'row', marginTop: 13 }}>
      {CAMINO.map(([clave, nombre], i) => {
        const esta = i === actual;
        return (
          <View key={clave} style={{ flex: 1, alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', height: 12 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: i === 0 ? 'transparent' : RAYA }} />
              <View
                style={{
                  width: esta ? 11 : 7,
                  height: esta ? 11 : 7,
                  borderRadius: 6,
                  backgroundColor: esta ? TINTA : 'rgba(28,43,34,0.18)',
                }}
              />
              <View style={{ flex: 1, height: 1, backgroundColor: i === CAMINO.length - 1 ? 'transparent' : RAYA }} />
            </View>
            <Text style={{ fontSize: 10, marginTop: 5, color: esta ? TINTA : INK.faint, fontWeight: esta ? '700' : '400' }}>{nombre}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Una cifra ───────────────────────────────────────────────────────────────

/** 100000000 con «Q» → «Q100 millones». */
function monto(cantidad, unidad) {
  const n = Number(cantidad);
  if (!Number.isFinite(n)) return null;
  const u = unidad || '';
  const pegada = u.length <= 3; // «Q», «US$», «%»
  const con = (texto) => (u ? (pegada && u !== '%' ? `${u}${texto}` : `${texto}${u === '%' ? '%' : ` ${u}`}`) : texto);
  if (n >= 1e9) return con(`${+(n / 1e9).toFixed(1)} mil millones`);
  if (n >= 1e6) return con(`${+(n / 1e6).toFixed(1)} millones`);
  return con(n.toLocaleString('es-GT'));
}

// ─── Una votación ────────────────────────────────────────────────────────────

/**
 * Las 160 curules, en media luna, pintadas por cómo se votó.
 *
 * Es un conteo, no un plano: los colores van juntos de izquierda a derecha —a
 * favor, licencia, ausentes, en contra— para que el tamaño de cada grupo se vea
 * de un golpe. No dice dónde se sienta nadie.
 */
function Hemiciclo({ favor = 0, contra = 0, ausentes = 0, licencia = 0, ancho = 300 }) {
  const curules = useMemo(() => {
    const FILAS = [16, 18, 20, 22, 26, 28, 30]; // de adentro hacia afuera; suma 160
    const puntos = [];
    const R0 = 0.42;
    const paso = (1 - R0) / (FILAS.length - 1);
    FILAS.forEach((cuantas, f) => {
      const r = R0 + paso * f;
      for (let i = 0; i < cuantas; i += 1) {
        const a = Math.PI - (Math.PI * (i + 0.5)) / cuantas;
        puntos.push({ x: Math.cos(a) * r, y: Math.sin(a) * r, a });
      }
    });
    // De izquierda a derecha, y dentro de cada ángulo de adentro hacia afuera.
    return puntos.sort((p, q) => q.a - p.a);
  }, []);

  const alto = ancho / 2 + 6;
  const R = ancho / 2 - 5;
  const cortes = [favor, favor + licencia, favor + licencia + ausentes];
  const colorDe = (i) => (i < cortes[0] ? VOTO.favor : i < cortes[1] ? VOTO.licencia : i < cortes[2] ? VOTO.ausente : i < cortes[2] + contra ? VOTO.contra : VOTO.licencia);

  return (
    <Svg width={ancho} height={alto}>
      {curules.map((p, i) => (
        <Circle key={i} cx={ancho / 2 + p.x * R} cy={alto - 4 - p.y * R} r={ancho / 110} fill={colorDe(i)} />
      ))}
    </Svg>
  );
}

function Conteo({ color, cuantos, nombre }) {
  if (!cuantos) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ fontSize: 12, color: INK.body }}>
        <Text style={{ fontWeight: '700', color: INK.title }}>{cuantos}</Text> {nombre}
      </Text>
    </View>
  );
}

/**
 * Una votación del pleno, con sus 160 votos.
 *
 * Sale del registro de votaciones, no de una noticia: por eso trae el conteo
 * completo y se puede dibujar el hemiciclo entero.
 */
export function VotacionCongreso({ votacion: v }) {
  // El feed lleva 24 de margen a cada lado.
  const { width } = useWindowDimensions();
  const ancho = width - 48;
  const aprobada = v.resultado === 'aprobada';
  return (
    <View style={{ paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: RAYA }}>
      <Rotulo color={aprobada ? VOTO.favor : VOTO.contra}>{aprobada ? 'VOTACIÓN · APROBADA' : 'VOTACIÓN · NO APROBADA'}</Rotulo>
      <Titulo>{v.asunto}</Titulo>
      <View style={{ alignItems: 'center', marginTop: 14 }}>
        <Hemiciclo favor={v.a_favor} contra={v.en_contra} ausentes={v.ausentes} licencia={v.licencia} ancho={Math.min(ancho, 320)} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 16, rowGap: 6, marginTop: 10 }}>
        <Conteo color={VOTO.favor} cuantos={v.a_favor} nombre="a favor" />
        <Conteo color={VOTO.contra} cuantos={v.en_contra} nombre="en contra" />
        <Conteo color={VOTO.ausente} cuantos={v.ausentes} nombre="ausentes" />
        <Conteo color={VOTO.licencia} cuantos={v.licencia} nombre="con licencia" />
      </View>
      {v.sesion ? <Text style={{ fontSize: 11.5, color: INK.faint, textAlign: 'center', marginTop: 9 }}>{v.sesion}</Text> : null}
    </View>
  );
}

/**
 * Los votos a favor que cuenta una noticia, contra las dos mayorías.
 *
 * La noticia solo dice cuántos votaron a favor. No se dibujan curules en contra
 * ni ausentes que nadie contó: va una barra hasta donde llegó, con las marcas
 * de 81 y 107 para leer si alcanzó.
 */
function AFavor({ cuantos }) {
  const n = Number(cuantos);
  if (!Number.isFinite(n) || n <= 0) return null;
  const marca = (m) => `${(m / TOTAL) * 100}%`;
  return (
    <View style={{ marginTop: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
        <Text style={{ fontSize: 26, fontWeight: '700', letterSpacing: -0.6, color: INK.title }}>{n}</Text>
        <Text style={{ fontSize: 12.5, color: INK.body }}>votos a favor, de {TOTAL}</Text>
      </View>
      <View style={{ height: 18, justifyContent: 'center', marginTop: 4 }}>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(28,43,34,0.08)' }}>
          <View style={{ height: 6, borderRadius: 3, width: `${Math.min(100, (n / TOTAL) * 100)}%`, backgroundColor: VOTO.favor }} />
        </View>
        {[MAYORIA, CALIFICADA].map((m) => (
          <View key={m} style={{ position: 'absolute', left: marca(m), width: 1, height: 14, backgroundColor: 'rgba(28,43,34,0.45)' }} />
        ))}
      </View>
      {/* Las dos marcas quedan cerca: el nombre de la primera va a su
          izquierda y el de la segunda a su derecha, para que no se pisen. */}
      <View style={{ height: 14 }}>
        <Text style={{ position: 'absolute', right: `${100 - (MAYORIA / TOTAL) * 100}%`, marginRight: 4, fontSize: 9.5, color: INK.faint }}>
          mayoría · {MAYORIA}
        </Text>
        <Text style={{ position: 'absolute', left: marca(CALIFICADA), marginLeft: 4, fontSize: 9.5, color: INK.faint }}>
          {CALIFICADA} · dos tercios
        </Text>
      </View>
    </View>
  );
}

// ─── Una noticia del día ─────────────────────────────────────────────────────

const ETAPA = {
  iniciativa_presentada: 'INICIATIVA PRESENTADA',
  en_comision: 'EN COMISIÓN',
  dictamen: 'DICTAMEN',
  primer_debate: 'PRIMER DEBATE',
  aprobado: 'APROBADO',
  eleccion: 'ELECCIÓN',
  citacion: 'CITACIÓN',
};

export function ItemCongreso({ item, ultimo = false }) {
  const d = item.card_data || {};
  const numero = item.iniciativa_numero || d.iniciativa_numero || null;
  const rotulo = [ETAPA[item.stage] || null, numero ? `INICIATIVA ${numero}` : null].filter(Boolean).join(' · ');
  const tipo = item.card_type;
  // Un resumen que solo describe el tweet («el tuit anuncia…») no cuenta nada
  // del hecho: mejor el título solo.
  const resumen = /\btuit\b/i.test(item.summary || '') ? null : item.summary;

  return (
    <View style={{ paddingVertical: 16, borderBottomWidth: ultimo ? 0 : 1, borderBottomColor: RAYA }}>
      {rotulo ? <Rotulo>{rotulo}</Rotulo> : null}

      {tipo === 'ficha' && d.name ? (
        /* Alguien fue elegido o nombrado: la persona es la noticia. */
        <>
          <Titulo>{d.name}</Titulo>
          <Text style={{ fontSize: 13.5, color: INK.body, marginTop: 4 }}>
            {[d.role, d.result].filter(Boolean).join(' · ')}
          </Text>
          <AFavor cuantos={item.votes?.favor} />
          <Resumen>{resumen}</Resumen>
        </>
      ) : tipo === 'cifra' && monto(d.amount, d.unit) ? (
        /* Lo que importa es el número: va grande, con de qué es al lado. */
        <>
          <Text style={{ fontSize: 30, fontWeight: '700', letterSpacing: -0.8, color: INK.title }}>{monto(d.amount, d.unit)}</Text>
          {d.subject ? <Text style={{ fontSize: 13.5, color: TINTA, lineHeight: 19, marginTop: 2 }}>{d.subject}</Text> : null}
          <Resumen>{resumen}</Resumen>
        </>
      ) : (
        <>
          <Titulo>{tipo === 'timeline' && d.subject ? d.subject.charAt(0).toUpperCase() + d.subject.slice(1) : titular(item.titulo)}</Titulo>
          {tipo === 'hemiciclo' ? <AFavor cuantos={item.votes?.favor} /> : null}
          {/* El camino es el de una ley. Aprobar una agenda o citar a un
              ministro también tiene «etapa», pero no recorre ese camino. */}
          {tipo === 'timeline' && numero ? <Camino etapa={item.stage} /> : null}
          <Resumen>{resumen}</Resumen>
        </>
      )}
    </View>
  );
}
