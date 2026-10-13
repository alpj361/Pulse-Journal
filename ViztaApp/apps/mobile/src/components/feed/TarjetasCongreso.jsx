import { useMemo, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { INK, SERIF } from '../theme';
import { titular, traerVotos } from './congreso';

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
 */

// El color del Congreso en el feed, y los de un voto.
export const TINTA = '#2F4A7A';
export const RAYA = 'rgba(28,43,34,0.09)';
const VOTO = { favor: '#15803D', contra: '#B91C1C', ausente: 'rgba(28,43,34,0.28)', licencia: 'rgba(28,43,34,0.12)' };

const TOTAL = 160;
const MAYORIA = 81; // mayoría absoluta
const CALIFICADA = 107; // dos tercios

/** El rótulo chico de arriba: qué clase de cosa es. */
export function Rotulo({ children, color = TINTA }) {
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
export function Titulo({ children }) {
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
export function Camino({ etapa }) {
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
export function monto(cantidad, unidad) {
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

// ─── Cómo votó cada bloque ───────────────────────────────────────────────────

const CLAVE_VOTO = { 'A FAVOR': 'favor', 'EN CONTRA': 'contra', AUSENTE: 'ausente', LICENCIA: 'licencia' };
const ORDEN_VOTO = ['favor', 'contra', 'ausente', 'licencia'];

/** Los 160 votos, juntados por bloque, del bloque más grande al más chico. */
function porBloque(votos) {
  const bloques = new Map();
  for (const v of votos) {
    const nombre = v.bloque || 'Sin bloque';
    const b = bloques.get(nombre) || { nombre, total: 0, favor: 0, contra: 0, ausente: 0, licencia: 0 };
    const clave = CLAVE_VOTO[String(v.voto || '').toUpperCase()];
    if (clave) b[clave] += 1;
    b.total += 1;
    bloques.set(nombre, b);
  }
  return [...bloques.values()].sort((x, y) => y.total - x.total || x.nombre.localeCompare(y.nombre));
}

/** «VAMOS» → «Vamos»; las siglas cortas (UNE, PU, VOS) se quedan como están. */
const nombreDeBloque = (n) => (n.length <= 3 ? n : n.charAt(0) + n.slice(1).toLowerCase());

/**
 * Cada bloque, con cómo votaron los suyos.
 *
 * El largo de la barra es el tamaño del bloque y sus colores, el voto de cada
 * diputado: así se ve de un golpe quién votó junto y quién se partió. Sale de
 * los votos nominales, no de un resumen.
 */
function Bloques({ votacionId }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['congreso-votos', votacionId],
    queryFn: () => traerVotos(votacionId),
    staleTime: 60 * 60 * 1000,
  });
  const bloques = useMemo(() => porBloque(data || []), [data]);

  if (isLoading) return <Text style={{ fontSize: 12, color: INK.faint, marginTop: 12 }}>Trayendo los votos…</Text>;
  if (isError || !bloques.length) {
    return <Text style={{ fontSize: 12, color: INK.faint, marginTop: 12 }}>Los votos de cada diputado no están por ahora.</Text>;
  }
  const mayor = bloques[0].total;

  return (
    <View style={{ marginTop: 12, gap: 7 }}>
      {bloques.map((b) => (
        <View key={b.nombre} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text numberOfLines={1} style={{ width: 104, fontSize: 12, color: INK.title }}>
            {nombreDeBloque(b.nombre)}
          </Text>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', width: `${Math.max(4, (b.total / mayor) * 100)}%` }}>
              {ORDEN_VOTO.map((clave) => (b[clave] ? <View key={clave} style={{ flex: b[clave], backgroundColor: VOTO[clave] }} /> : null))}
            </View>
          </View>
          <Text style={{ width: 26, textAlign: 'right', fontSize: 11.5, color: INK.faint }}>{b.total}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Una votación del pleno, con sus 160 votos.
 *
 * Sale del registro de votaciones, no de una noticia: por eso trae el conteo
 * completo y se puede dibujar el hemiciclo entero. Al tocarla se abre cómo votó
 * cada bloque. `compacta` es la misma sin el hemiciclo, para cuando van muchas
 * seguidas.
 */
export function VotacionCongreso({ votacion: v, compacta = false }) {
  // El feed lleva 24 de margen a cada lado.
  const { width } = useWindowDimensions();
  const ancho = width - 48;
  const [abierta, setAbierta] = useState(false);
  const aprobada = v.resultado === 'aprobada';
  const Flecha = abierta ? ChevronUp : ChevronDown;
  return (
    <Pressable
      onPress={() => setAbierta((x) => !x)}
      accessibilityRole="button"
      accessibilityState={{ expanded: abierta }}
      style={{ paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: RAYA }}
    >
      <Rotulo color={aprobada ? VOTO.favor : VOTO.contra}>{aprobada ? 'VOTACIÓN · APROBADA' : 'VOTACIÓN · NO APROBADA'}</Rotulo>
      <Titulo>{v.asunto}</Titulo>
      {compacta ? null : (
        <View style={{ alignItems: 'center', marginTop: 14 }}>
          <Hemiciclo favor={v.a_favor} contra={v.en_contra} ausentes={v.ausentes} licencia={v.licencia} ancho={Math.min(ancho, 320)} />
        </View>
      )}
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: compacta ? 'flex-start' : 'center',
          columnGap: 16,
          rowGap: 6,
          marginTop: 10,
        }}
      >
        <Conteo color={VOTO.favor} cuantos={v.a_favor} nombre="a favor" />
        <Conteo color={VOTO.contra} cuantos={v.en_contra} nombre="en contra" />
        <Conteo color={VOTO.ausente} cuantos={v.ausentes} nombre="ausentes" />
        <Conteo color={VOTO.licencia} cuantos={v.licencia} nombre="con licencia" />
        <Flecha size={15} color={INK.faint} />
      </View>
      {abierta ? <Bloques votacionId={v.id} /> : null}
      {v.sesion && !compacta ? <Text style={{ fontSize: 11.5, color: INK.faint, textAlign: 'center', marginTop: 9 }}>{v.sesion}</Text> : null}
    </Pressable>
  );
}

/**
 * Las votaciones de un día.
 *
 * Van dos con su hemiciclo: un día puede traer veinte, y veinte hemiciclos
 * seguidos tapan todo lo demás. El resto se abre de un toque, en renglones sin
 * dibujo.
 */
export function VotacionesDelDia({ votaciones = [] }) {
  const [todas, setTodas] = useState(false);
  const resto = votaciones.slice(2);
  return (
    <>
      {votaciones.slice(0, 2).map((v) => (
        <VotacionCongreso key={v.id} votacion={v} />
      ))}
      {todas ? resto.map((v) => <VotacionCongreso key={v.id} votacion={v} compacta />) : null}
      {resto.length ? (
        <Pressable onPress={() => setTodas((x) => !x)} accessibilityRole="button" style={{ paddingVertical: 12 }}>
          <Text style={{ fontSize: 12.5, fontWeight: '600', color: TINTA }}>
            {todas ? 'Menos votaciones' : resto.length === 1 ? 'Una votación más ese día' : `${resto.length} votaciones más ese día`}
          </Text>
        </Pressable>
      ) : null}
    </>
  );
}

/**
 * Los votos a favor que cuenta una noticia, contra las dos mayorías.
 *
 * La noticia solo dice cuántos votaron a favor. No se dibujan curules en contra
 * ni ausentes que nadie contó: va una barra hasta donde llegó, con las marcas
 * de 81 y 107 para leer si alcanzó.
 */
export function AFavor({ cuantos }) {
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

export const ETAPA = {
  iniciativa_presentada: 'INICIATIVA PRESENTADA',
  en_comision: 'EN COMISIÓN',
  dictamen: 'DICTAMEN',
  primer_debate: 'PRIMER DEBATE',
  aprobado: 'APROBADO',
  eleccion: 'ELECCIÓN',
  citacion: 'CITACIÓN',
};

const mayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);

/**
 * El título y el resumen que se muestran.
 *
 * El sitio del Congreso corta sus títulos («…DE LA UNIVERSIDAD DA...») y el
 * entero no siempre quedó guardado. Un título a medias no se puede leer, así
 * que se busca algo que sí, en este orden: de qué trata la nota según el
 * monitor (`subject`), y si no, la primera oración de su resumen —que entonces
 * deja de repetirse abajo—. El cortado queda solo cuando no hay nada más.
 */
export function cabezaDe(item) {
  const d = item.card_data || {};
  // Un resumen que solo describe el tweet («el tuit anuncia…») no cuenta nada
  // del hecho: mejor el título solo.
  const resumen = /\btuit\b/i.test(item.summary || '') ? null : item.summary || null;
  const propio = titular(item.titulo);
  const cortado = /…\s*$/.test(propio);
  if (d.subject && (item.card_type === 'timeline' || cortado)) return { titulo: mayuscula(d.subject), resumen };
  if (!cortado || !resumen) return { titulo: propio, resumen };

  const fin = resumen.search(/[.!?](\s|$)/);
  const primera = fin === -1 ? resumen : resumen.slice(0, fin);
  if (primera.length < 30 || primera.length > 260) return { titulo: propio, resumen };
  return { titulo: primera.trim(), resumen: resumen.slice(fin + 1).trim() || null };
}

export const tituloDe = (item) => cabezaDe(item).titulo;

/** El rótulo de una nota: su etapa y, si la hay, su iniciativa. */
export function rotuloDe(item) {
  const numero = item.iniciativa_numero || item.card_data?.iniciativa_numero || null;
  return [ETAPA[item.stage] || null, numero ? `INICIATIVA ${numero}` : null].filter(Boolean).join(' · ');
}

export function ItemCongreso({ item, ultimo = false, onPress }) {
  const d = item.card_data || {};
  const numero = item.iniciativa_numero || d.iniciativa_numero || null;
  const rotulo = rotuloDe(item);
  const tipo = item.card_type;
  const cabeza = cabezaDe(item);
  // La persona y la cifra tienen su propio titular: ahí el resumen va entero.
  const propia = (tipo === 'ficha' && d.name) || (tipo === 'cifra' && monto(d.amount, d.unit));
  const resumen = propia ? /\btuit\b/i.test(item.summary || '') ? null : item.summary : cabeza.resumen;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        paddingVertical: 16,
        borderBottomWidth: ultimo ? 0 : 1,
        borderBottomColor: RAYA,
        opacity: pressed ? 0.6 : 1,
      })}
    >
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
          <Titulo>{cabeza.titulo}</Titulo>
          {tipo === 'hemiciclo' ? <AFavor cuantos={item.votes?.favor} /> : null}
          {/* El camino es el de una ley. Aprobar una agenda o citar a un
              ministro también tiene «etapa», pero no recorre ese camino. */}
          {tipo === 'timeline' && numero ? <Camino etapa={item.stage} /> : null}
          <Resumen>{resumen}</Resumen>
        </>
      )}
    </Pressable>
  );
}
