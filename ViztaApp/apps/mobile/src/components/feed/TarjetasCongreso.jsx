import { monto } from './cifras';
export { monto } from './cifras';
import { useMemo, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, CircleCheck, CircleDashed, CircleX, Landmark, UserRound } from 'lucide-react-native';
import { INK, SERIF } from '../theme';
import { supabase } from '../../utils/supabase';
import { normalizar, resultadoVotacion } from './organizacion';
import { origenDe, titular } from './congreso';
import { COLOR_VOTO, curulesDelHemiciclo, traerDiputados } from './diputados';
import { VotosDelPleno } from './PlenoDiputados';
import { CLASES, claseDe, mayoriaDe, repartirActores } from './clasesCongreso';
import Pegatina from './Pegatina';
import { TIPOS_VOTACION, agruparVotaciones, legible, nombreDeLey, nombrePasos, pasoCorto } from './votaciones';

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
const VOTO = COLOR_VOTO;

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
  // Los tres debates son la misma parada del camino.
  const parada = /_debate$/.test(etapa || '') ? 'primer_debate' : etapa;
  const actual = CAMINO.findIndex(([clave]) => clave === parada);
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
// ─── Una votación ────────────────────────────────────────────────────────────

/**
 * Las 160 curules, en media luna, pintadas por cómo se votó.
 *
 * Es un conteo, no un plano: los colores van juntos de izquierda a derecha —a
 * favor, licencia, ausentes, en contra— para que el tamaño de cada grupo se vea
 * de un golpe. No dice dónde se sienta nadie.
 */
function Hemiciclo({ favor = 0, contra = 0, ausentes = 0, licencia = 0, ancho = 300 }) {
  const curules = useMemo(() => curulesDelHemiciclo(), []);

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
 * completo y se puede dibujar el hemiciclo entero. Al tocarla se abre cómo votó
 * cada bloque. `compacta` es la misma sin el hemiciclo, para cuando van muchas
 * seguidas.
 */
export function VotacionCongreso({ votacion: v, compacta = false, ley = null, tipo = null }) {
  // El feed lleva 24 de margen a cada lado.
  const { width } = useWindowDimensions();
  const ancho = width - 48;
  const [abierta, setAbierta] = useState(false);
  const resultado = resultadoVotacion(v);
  const aprobada = resultado === 'aprobada';
  const Flecha = abierta ? ChevronUp : ChevronDown;
  return (
    <Pressable
      onPress={() => setAbierta((x) => !x)}
      accessibilityRole="button"
      accessibilityState={{ expanded: abierta }}
      style={{ paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: RAYA }}
    >
      {compacta ? null : (
        <Pegatina texto="Votación" paleta={(aprobada ? CLASES.aprobacion : resultado === 'no_aprobada' ? CLASES.interpelacion : CLASES.noticia).paleta} sticker="congreso-votacion" respaldo="votaciones" id={v.id} style={{ marginBottom: 8 }} />
      )}
      {/* El resultado lo dice el ícono; el rótulo queda para qué se votó. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        <IconoResultado resultado={resultado} />
        <Text style={{ flex: 1, fontSize: 10, fontWeight: '800', letterSpacing: 0.9, color: TINTA }}>
          {(ley ? [pasoCorto(v.asunto).toUpperCase(), `INICIATIVA ${ley.numero}`] : [TIPOS_VOTACION[tipo]?.rotulo]).filter(Boolean).join(' · ')}
        </Text>
      </View>
      {/* De una ley se lee su nombre; el paso que se votó ya va en el rótulo. */}
      <Titulo>{ley ? ley.nombre || legible(v.asunto) : v.asunto}</Titulo>
      {/* Cerrada, el hemiciclo de conteos. Abierta, el de cada diputado lo
          reemplaza (se tocan sus curules y sus votos); el de conteos queda
          solo mientras llegan esos votos o si no están. */}
      {abierta ? (
        <VotosDelPleno votacionId={v.id} resumen={<ConteoDelPleno v={v} compacta={compacta} ancho={ancho} />} />
      ) : (
        <ConteoDelPleno v={v} compacta={compacta} ancho={ancho} />
      )}
      <View style={{ alignItems: compacta ? 'flex-start' : 'center', marginTop: 6 }}>
        <Flecha size={15} color={INK.faint} />
      </View>
    </Pressable>
  );
}

/** El hemiciclo de conteos y sus cifras: cuántos a favor, en contra, ausentes y con licencia. */
function ConteoDelPleno({ v, compacta, ancho }) {
  return (
    <>
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
      </View>
    </>
  );
}

/** Los nombres de las leyes que se votaron, del registro de iniciativas. */
export function useNombresDeLeyes(numeros = []) {
  const lista = [...new Set(numeros.filter(Boolean))].sort();
  return useQuery({
    queryKey: ['congreso-nombres-de-leyes', lista.join(',')],
    enabled: lista.length > 0,
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('iniciativas_app_view').select('numero, titulo').in('numero', lista);
      if (error) throw error;
      return Object.fromEntries((data || []).map((i) => [Number(i.numero), nombreDeLey(i.titulo)]));
    },
  });
}

/** Aprobada, no aprobada o sin confirmar: un ícono, sin palabras. */
export function IconoResultado({ resultado, size = 15 }) {
  if (resultado === 'aprobada') return <CircleCheck size={size} color={VOTO.favor} accessibilityLabel="aprobada" />;
  if (resultado === 'no_aprobada') return <CircleX size={size} color={VOTO.contra} accessibilityLabel="no aprobada" />;
  return <CircleDashed size={size} color={INK.meta} accessibilityLabel="resultado sin confirmar" />;
}

/** El número que acompaña al ícono: a favor si se aprobó, en contra si no. */
function cifraDe(v) {
  const resultado = resultadoVotacion(v);
  if (resultado === 'aprobada' && v.a_favor != null) return `${v.a_favor} a favor`;
  if (resultado === 'no_aprobada' && v.en_contra != null) return `${v.en_contra} en contra`;
  return null;
}

/** Desplegar y plegar: el texto con su flecha. */
export function Plegable({ abierto, onPress, texto, color = TINTA }) {
  const Flecha = abierto ? ChevronUp : ChevronDown;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ expanded: abierto }} accessibilityLabel={abierto ? `ocultar, ${texto}` : texto}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 }}>
      <Flecha size={15} color={color} />
      <Text style={{ fontSize: 12.5, fontWeight: '600', color }}>{abierto ? 'ocultar' : texto}</Text>
    </Pressable>
  );
}

/**
 * Una votación con las que van con ella.
 *
 * De una ley se ve la votación que la decide, con el nombre de la ley; los
 * artículos, enmiendas y la redacción final quedan plegados debajo. De una
 * elección, quien ganó, y los demás candidatos plegados. El trámite de un día
 * es solo su rótulo y lo plegado.
 */
export function GrupoVotacion({ grupo, nombres = {}, compacta = false }) {
  const [abierto, setAbierto] = useState(false);
  const ley = grupo.tipo === 'ley' && grupo.iniciativa ? { numero: grupo.iniciativa, nombre: nombres[grupo.iniciativa] || null } : null;
  const pasos = nombrePasos(grupo);
  return (
    <View style={grupo.principal ? null : { paddingTop: 12 }}>
      {grupo.principal ? <VotacionCongreso votacion={grupo.principal} compacta={compacta} ley={ley} tipo={grupo.tipo} />
        : <Rotulo color={INK.meta}>{TIPOS_VOTACION[grupo.tipo].rotulo}</Rotulo>}
      {pasos ? <Plegable abierto={abierto} onPress={() => setAbierto((x) => !x)} texto={pasos} color={grupo.principal ? TINTA : INK.meta} /> : null}
      {abierto ? grupo.pasos.map((v) => <Paso key={v.id} votacion={v} corto={grupo.tipo !== 'eleccion' && grupo.tipo !== 'acuerdo'} />) : null}
    </View>
  );
}

/** Un paso plegado: qué se votó, y el ícono del resultado con su número. */
function Paso({ votacion: v, corto }) {
  const resultado = resultadoVotacion(v);
  const cifra = cifraDe(v);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: RAYA }}>
      <Text style={{ flex: 1, fontSize: 13, lineHeight: 18, color: INK.title }}>{corto ? pasoCorto(v.asunto) : v.asunto}</Text>
      <IconoResultado resultado={resultado} size={14} />
      {cifra ? <Text style={{ fontSize: 11.5, color: INK.meta, minWidth: 70 }}>{cifra}</Text> : null}
    </View>
  );
}

/**
 * Las votaciones de un día, juntas por lo que decidieron.
 *
 * Una ley aprobada son quince votaciones: va una, la que la decide, y el resto
 * plegado bajo ella. Van dos con su hemiciclo: veinte medias lunas seguidas
 * tapan todo lo demás. El trámite del día (orden del día, actas, mociones)
 * nunca va con dibujo: es un renglón plegado al final.
 */
export function VotacionesDelDia({ votaciones = [] }) {
  const [mas, setMas] = useState(false);
  const grupos = useMemo(() => agruparVotaciones(votaciones), [votaciones]);
  const nombres = useNombresDeLeyes(grupos.map((g) => g.iniciativa)).data || {};
  const decisivos = grupos.filter((g) => g.tipo !== 'tramite');
  const tramite = grupos.find((g) => g.tipo === 'tramite');
  const resto = decisivos.slice(2);
  return (
    <>
      {decisivos.slice(0, 2).map((g) => <GrupoVotacion key={g.clave} grupo={g} nombres={nombres} />)}
      {mas ? resto.map((g) => <GrupoVotacion key={g.clave} grupo={g} nombres={nombres} compacta />) : null}
      {resto.length ? <Plegable abierto={mas} onPress={() => setMas((x) => !x)}
        texto={resto.length === 1 ? 'una votación más ese día' : `${resto.length} votaciones más ese día`} /> : null}
      {tramite ? <GrupoVotacion grupo={tramite} /> : null}
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
  segundo_debate: 'SEGUNDO DEBATE',
  tercer_debate: 'TERCER DEBATE',
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

export function ItemCongreso({ item, ultimo = false, onPress, onEntidad }) {
  const d = item.card_data || {};
  const numero = item.iniciativa_numero || d.iniciativa_numero || null;
  const clase = claseDe(item);
  const c = CLASES[clase];
  const tipo = item.card_type;
  const cabeza = cabezaDe(item);
  const diputados = useDiputados();
  const reparto = useMemo(() => repartirActores(item.actors, diputados), [item.actors, diputados]);
  // La persona y la cifra tienen su propio titular: ahí el resumen va entero.
  const propia = (tipo === 'ficha' && d.name) || (tipo === 'cifra' && monto(d.amount, d.unit));
  const resumen = propia ? /\btuit\b/i.test(item.summary || '') ? null : item.summary : cabeza.resumen;
  // La etiqueta ya dice la clase: el rótulo queda para lo que agrega (la
  // etapa si es otra, el número de iniciativa).
  const extra = rotuloDe(item)
    .split(' · ')
    .filter((r) => r && !normalizar(r).includes(normalizar(c.nombre)))
    .join(' · ');
  const conCitados = clase === 'citacion' || clase === 'interpelacion';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        paddingVertical: 18,
        borderBottomWidth: ultimo ? 0 : 1,
        borderBottomColor: RAYA,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Pegatina texto={c.nombre} paleta={c.paleta} sticker={c.sticker} respaldo={c.respaldo} id={item.id} style={{ marginBottom: extra ? 8 : 11 }} />
      {extra ? <Rotulo color={c.paleta.tinta}>{extra}</Rotulo> : null}

      {tipo === 'ficha' && d.name ? (
        /* Alguien fue elegido o nombrado: la persona es la noticia. */
        <>
          <Titulo>{d.name}</Titulo>
          <Text style={{ fontSize: 13.5, color: INK.body, marginTop: 4 }}>{[d.role, d.result].filter(Boolean).join(' · ')}</Text>
        </>
      ) : (
        <Titulo>{tipo === 'cifra' && monto(d.amount, d.unit) ? d.subject || cabeza.titulo : cabeza.titulo}</Titulo>
      )}

      {/* El monto va como etiqueta, no como titular: un número de 30 puntos
          pesaba más que la noticia. */}
      {tipo === 'cifra' && monto(d.amount, d.unit) ? (
        <View style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(28,43,34,0.06)', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, marginTop: 7 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: TINTA }}>{monto(d.amount, d.unit)}</Text>
        </View>
      ) : null}

      {Number(item.votes?.favor) > 0 && (clase === 'aprobacion' || clase === 'eleccion') ? <Aprobacion favor={item.votes.favor} /> : null}
      {conCitados ? <Citados clase={clase} reparto={reparto} paleta={c.paleta} onEntidad={onEntidad} /> : null}
      {/* El camino es el de una ley. Aprobar una agenda o citar a un ministro
          también tiene «etapa», pero no recorre ese camino. */}
      {tipo === 'timeline' && numero && clase !== 'aprobacion' ? <Camino etapa={item.stage} /> : null}

      <Resumen>{resumen}</Resumen>
      {conCitados ? null : <QuienFue reparto={reparto} tinta={c.paleta.tinta} onEntidad={onEntidad} />}
      <Origen item={item} />
    </Pressable>
  );
}

/**
 * Los 160 diputados con su bloque, para saber quién de los nombrados es uno.
 * Salen del dataset «Congreso de Guatemala», la misma lista del hemiciclo.
 */
export function useDiputados() {
  const { data } = useQuery({ queryKey: ['congreso-diputados'], queryFn: traerDiputados, staleTime: 6 * 60 * 60 * 1000 });
  return useMemo(() => (data ? data.map((d) => ({ nombre: d.nombre, bloque: d.sigla === 'IND' ? 'INDEPENDIENTE' : d.sigla })) : SIN_DIPUTADOS), [data]);
}
const SIN_DIPUTADOS = [];

/**
 * Lo aprobado, con su hemiciclo.
 *
 * La nota casi nunca trae más que los votos a favor: esos se pintan en verde y
 * el resto de las curules queda en gris claro, sin inventar en contra ni
 * ausentes que nadie contó. Sin votos no se llega acá: es una nota.
 */
export function Aprobacion({ favor }) {
  const { width } = useWindowDimensions();
  const n = Number(favor);
  const alcance = mayoriaDe(n);
  return (
    <View style={{ alignItems: 'center', marginTop: 14 }}>
      <Hemiciclo favor={n} ancho={Math.min(width - 48, 250)} />
      <Text style={{ fontSize: 12.5, color: INK.body, marginTop: 8, textAlign: 'center' }}>
        <Text style={{ fontWeight: '700', color: VOTO.favor }}>{n}</Text> a favor, de {TOTAL}
        {alcance ? ` · ${alcance}` : ''}
      </Text>
    </View>
  );
}

/** Un nombre que se puede tocar para ver su ficha, como en las noticias. */
function Nombre({ nombre, extra, tinta, onEntidad, fuerte = false }) {
  return (
    <Pressable
      onPress={(ev) => {
        // Sin esto, tocar el nombre abre su ficha y también la nota de atrás.
        ev.stopPropagation();
        onEntidad?.(nombre);
      }}
      hitSlop={{ top: 6, bottom: 6 }}
      accessibilityRole="link"
      style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
    >
      <Text style={{ fontSize: fuerte ? 14 : 12.5, fontWeight: fuerte ? '600' : '400', color: tinta, textDecorationLine: 'underline', textDecorationColor: `${tinta}55` }}>
        {nombre}
        {extra ? <Text style={{ textDecorationLine: 'none', color: INK.faint, fontWeight: '400' }}>{` · ${extra}`}</Text> : null}
      </Text>
    </Pressable>
  );
}

/**
 * Quién fue, al pie: los diputados con su bloque primero, después las
 * instituciones y las personas. Como en las noticias del país, subrayados.
 */
function QuienFue({ reparto, tinta, onEntidad }) {
  const todos = [
    ...reparto.diputados.map((p) => ({ ...p, extra: p.bloque })),
    ...reparto.instituciones,
    ...reparto.personas,
  ];
  if (!todos.length) return null;
  const visibles = todos.slice(0, 4);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 14, rowGap: 6, marginTop: 12 }}>
      {visibles.map((p) => (
        <Nombre key={p.nombre} nombre={p.nombre} extra={p.extra} tinta={tinta} onEntidad={onEntidad} />
      ))}
      {todos.length > visibles.length ? <Text style={{ fontSize: 12, color: INK.faint }}>+{todos.length - visibles.length}</Text> : null}
    </View>
  );
}

/**
 * A quién citan (o interpelan) y quién lo pidió. En una citación lo que
 * importa es quién tuvo que ir a rendir cuentas: va primero y más grande; el
 * diputado que citó, abajo.
 */
function Citados({ clase, reparto, paleta, onEntidad }) {
  const citados = [...reparto.instituciones.map((p) => ({ ...p, Icono: Landmark })), ...reparto.personas.map((p) => ({ ...p, Icono: UserRound }))];
  const quien = reparto.diputados;
  if (!citados.length && !quien.length) return null;
  const visibles = citados.slice(0, 4);
  return (
    <View style={{ marginTop: 12, borderRadius: 12, backgroundColor: paleta.lavado[0], paddingHorizontal: 12, paddingVertical: 11, gap: 8 }}>
      {visibles.length ? (
        <>
          <Text style={{ fontSize: 10, fontWeight: '800', letterSpacing: 0.9, color: paleta.tinta }}>{clase === 'interpelacion' ? 'INTERPELADOS' : 'CITADOS'}</Text>
          {visibles.map(({ nombre, Icono }) => (
            <View key={nombre} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icono size={15} color={paleta.tinta} strokeWidth={2} />
              <View style={{ flex: 1 }}>
                <Nombre nombre={nombre} tinta={INK.title} onEntidad={onEntidad} fuerte />
              </View>
            </View>
          ))}
          {citados.length > visibles.length ? <Text style={{ fontSize: 12, color: INK.meta }}>y {citados.length - visibles.length} más</Text> : null}
        </>
      ) : null}
      {quien.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10, rowGap: 4, borderTopWidth: visibles.length ? 1 : 0, borderTopColor: RAYA, paddingTop: visibles.length ? 8 : 0 }}>
          <Text style={{ fontSize: 12, color: INK.meta }}>{clase === 'interpelacion' ? 'Interpeló' : 'Citó'}</Text>
          {quien.slice(0, 3).map((p) => (
            <Nombre key={p.nombre} nombre={p.nombre} extra={p.bloque} tinta={paleta.tinta} onEntidad={onEntidad} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** De dónde sale la nota, chico y al pie: la comisión o el órgano. */
export function Origen({ item, style }) {
  const origen = origenDe(item);
  if (!origen) return null;
  return <Text style={[{ fontSize: 11.5, color: INK.faint, marginTop: 8 }, style]}>{origen}</Text>;
}
