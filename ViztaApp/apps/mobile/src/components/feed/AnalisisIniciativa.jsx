import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown, Ban, ChevronDown as ChevronDownIcon, ChevronUp as ChevronUpIcon, CircleQuestionMark, CircleSlash, ClipboardCheck, Coins,
  Eraser, FileClock, FileText, Gavel, GitCompare, KeyRound, Landmark, ListChecks, Merge, MessageCircleQuestionMark, PenLine, Plus,
  ScanSearch, Sparkles, Split, Target, TrendingDown, TrendingUp, UserX, Users,
} from 'lucide-react-native';
import MorphingInfinity from '../MorphingInfinity';
import { INK, RADIUS, SERIF } from '../theme';
import { TEMAS } from './temas';
import { Plegable, RAYA, TINTA } from './TarjetasCongreso';
import {
  PASOS_ANALISIS, cifraLegible, comparables, deCadaCien, esperaDeCache, estadoDelAnalisis, pedirAnalisis, traerVigente,
} from './lecturaDelAnalisis';

/**
 * El análisis de una iniciativa, plegado en su tarjeta como «su análisis» (STA-337).
 *
 * Pensar con quien lee: qué propone, a quién toca y qué conviene revisar, cada
 * cosa con su cita y sin decir si está bien o mal.
 *
 * Cómo se lee (PJ, 13-nov-2026): la estructura la pone la vista, con reglas
 * fijas y las piezas de Vizta (cifras, barras, tonos del catálogo), no el modelo.
 * Cada sección agrupa sus puntos —por acción, por efecto, por tipo— con un
 * rótulo y un ícono, y dentro de cada grupo los puntos van numerados. Una cifra
 * nunca va sola: un porcentaje lleva su medidor, el dinero su diagrama de dónde
 * sale y a dónde va. Lo que falta no se anuncia.
 *
 * Se pide a mano (PJ, 12-nov-2026): la tarjeta ofrece «analizar» y la persona
 * lo ve hacerse. Si alguien ya lo había pedido, sale de la caché, pero igual se
 * espera unos segundos: el pedido es suyo y queda guardado como suyo.
 */

// Los tonos y el rótulo de las piezas de Vizta (colaboradores/piezas, catálogo visual).
const TONO = {
  verde: TEMAS.Social.tinta,
  verdeLavado: TEMAS.Social.lavado[0],
  ladrilloTinta: TEMAS.Violencia.tinta,
  arenaLavado: TEMAS.Economía.lavado[0],
  raya: 'rgba(28,43,34,0.07)',
  borde: 'rgba(28,43,34,0.12)',
  tarjeta: 'rgba(255,255,255,0.86)',
};
const ROTULO = { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.1, color: INK.faint };

const ICONOS = {
  problema: Target,
  que_hace: ListChecks,
  cambios_ley_vigente: GitCompare,
  quien_gana_quien_asume: Users,
  dinero: Coins,
  para_revisar: ScanSearch,
};

// Los grupos de cada sección, en orden fijo, con su rótulo e ícono.
const GRUPOS_ACCION = [
  ['crea', 'Crea', Plus], ['obliga', 'Obliga', ClipboardCheck], ['prohibe', 'Prohíbe', Ban], ['faculta', 'Da facultades', KeyRound],
  ['sanciona', 'Sanciona', Gavel], ['modifica', 'Modifica', PenLine], ['deroga', 'Deroga', Eraser], ['otro', 'Además', ListChecks],
];
const GRUPOS_EFECTO = [
  ['beneficio', 'Reciben algo', TrendingUp, TONO.verde], ['poder', 'Ganan decisión', Landmark, TINTA],
  ['obligacion', 'Quedan obligados', ClipboardCheck, INK.title], ['carga', 'Asumen un costo', TrendingDown, TONO.ladrilloTinta],
  ['restriccion', 'Dejan de poder', Ban, TONO.ladrilloTinta],
];
const GRUPOS_REVISAR = [
  ['contradiccion_interna', 'Contradicciones internas', Split], ['termino_sin_definir', 'Términos sin definir', CircleQuestionMark],
  ['remite_a_reglamento', 'Queda para un reglamento', FileClock], ['sin_responsable', 'Sin responsable', UserX],
  ['sin_consecuencia', 'Sin consecuencia', CircleSlash], ['choque_con_otra_norma', 'Se cruza con otra norma', Merge], ['otro', 'Además', ScanSearch],
];

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * El análisis de una iniciativa para esta persona: en qué está y cómo pedirlo.
 * `disponible` es falso sin sesión o si el servicio no la reconoce: entonces la
 * tarjeta no ofrece nada.
 */
export function useAnalisisIniciativa(numero) {
  const cliente = useQueryClient();
  const clave = ['analisis-iniciativa', numero];
  const q = useQuery({
    queryKey: clave,
    queryFn: () => estadoDelAnalisis(numero),
    enabled: !!numero,
    staleTime: 10 * 60 * 1000,
    retry: 1,
    // Mientras corre de verdad, se mira cada pocos segundos hasta que esté.
    refetchInterval: (query) => (query.state.data?.estado === 'en_curso' ? 4000 : false),
  });
  const [esperando, setEsperando] = useState(false);
  const pedir = async () => {
    if (esperando) return;
    setEsperando(true);
    try {
      const inicio = Date.now();
      const r = await pedirAnalisis(numero);
      // De la caché llega al instante; igual se ve hacerse.
      if (r?.estado === 'listo') await dormir(Math.max(0, esperaDeCache() - (Date.now() - inicio)));
      cliente.setQueryData(clave, r || { estado: 'fallido', analisis: null });
    } catch {
      cliente.setQueryData(clave, { estado: 'fallido', analisis: null });
    } finally {
      setEsperando(false);
    }
  };
  const estado = esperando ? 'en_curso' : q.data?.estado || 'sin_pedir';
  return { estado, analisis: q.data?.analisis || null, pedir, disponible: q.data != null || esperando };
}

/** Mientras se analiza: el loader de Vizta y lo que va haciendo, en orden. */
export function Analizando() {
  const [paso, setPaso] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPaso((p) => Math.min(p + 1, PASOS_ANALISIS.length - 1)), 1600);
    return () => clearInterval(t);
  }, []);
  return (
    <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}>
      <MorphingInfinity size={22} color={TINTA} />
      <Text style={{ fontSize: 13, color: INK.body }}>{PASOS_ANALISIS[paso]}</Text>
    </View>
  );
}

/**
 * El botón de la tarjeta, al lado de «su recorrido»: «analizar» si no lo ha
 * pedido (o «analizar de nuevo» si falló) y «su análisis» cuando está listo.
 */
export function BotonAnalisis({ estado, abierto, onAbrir, onPedir, numero, deLaIniciativa = false }) {
  if (estado === 'listo') {
    const Flecha = abierto ? ChevronUpIcon : ChevronDownIcon;
    return (
      <Pressable onPress={onAbrir} accessibilityRole="button" accessibilityState={{ expanded: abierto }} accessibilityLabel={`su análisis, iniciativa ${numero}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 44 }}>
        <Sparkles size={13} color={TINTA} />
        <Text style={{ fontSize: 12, color: TINTA, fontWeight: '600' }}>{abierto ? 'cerrar análisis' : 'su análisis'}</Text>
        <Flecha size={13} color={TINTA} />
      </Pressable>
    );
  }
  if (estado === 'en_curso') return null;
  return (
    <Pressable onPress={onPedir} accessibilityRole="button" accessibilityLabel={`analizar la iniciativa ${numero}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 44 }}>
      <Sparkles size={13} color={TINTA} />
      <Text style={{ fontSize: 12, color: TINTA, fontWeight: '600' }}>{estado === 'fallido' ? 'analizar de nuevo' : deLaIniciativa ? `analizar la iniciativa ${numero}` : 'analizar'}</Text>
    </Pressable>
  );
}

/** Abre el análisis solo cuando termina de hacerse delante de la persona. */
export function useAbrirAlTerminar(estado, abrir) {
  const antes = useRef(estado);
  useEffect(() => {
    if (antes.current === 'en_curso' && estado === 'listo') abrir();
    antes.current = estado;
  }, [estado, abrir]);
}

// ─── El análisis ───────────────────────────────────────────────────────────────

/** Lo que se ve al abrir «su análisis» en la tarjeta de la iniciativa. */
export default function AnalisisIniciativa({ analisis: a }) {
  if (!a) return null;
  return (
    <View style={{ marginTop: 6, gap: 4 }}>
      {a.frase ? (
        <View style={{ padding: 14, borderRadius: RADIUS.md, backgroundColor: TONO.verdeLavado, gap: 4 }}>
          <Text style={ROTULO}>EN UNA FRASE</Text>
          <Text style={{ fontFamily: SERIF, fontSize: 21, lineHeight: 26, color: INK.title }}>{a.frase}</Text>
        </View>
      ) : null}
      <View style={{ marginTop: 6 }}>
        {a.secciones.map((s) => <Seccion key={s.key} seccion={s} />)}
      </View>
      {a.preguntas.length ? (
        <View style={{ marginTop: 10, padding: 14, borderRadius: RADIUS.md, borderWidth: 1, borderColor: TONO.borde, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <MessageCircleQuestionMark size={17} color={TINTA} />
            <Text style={{ fontSize: 14, fontWeight: '700', color: INK.title }}>Preguntas para leerla</Text>
          </View>
          {a.preguntas.map((p, i) => (
            <Numerado key={i} n={i + 1}><Text style={{ fontSize: 14, lineHeight: 20, color: INK.title }}>{p}</Text></Numerado>
          ))}
        </View>
      ) : null}
      <Text style={{ fontSize: 11, color: INK.faint, marginTop: 10 }}>
        {a.escaneo ? 'Lectura automática de un documento escaneado; cada punto lleva su cita.' : 'Lectura automática del texto; cada punto lleva su cita.'}
      </Text>
    </View>
  );
}

function Seccion({ seccion }) {
  const [abierta, setAbierta] = useState(false);
  const [citas, setCitas] = useState(false);
  const Icono = ICONOS[seccion.key] || ListChecks;
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: RAYA }}>
      <Pressable onPress={() => setAbierta((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: abierta }}
        accessibilityLabel={`${seccion.titulo}, ${seccion.items.length}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50 }}>
        <Icono size={18} color={TINTA} />
        <Text style={{ flex: 1, fontSize: 14.5, fontWeight: '700', color: INK.title }}>{seccion.titulo}</Text>
        <Text style={{ fontSize: 13, color: INK.meta, fontVariant: ['tabular-nums'] }}>{seccion.items.length}</Text>
        {abierta ? <ChevronUpIcon size={15} color={INK.meta} /> : <ChevronDownIcon size={15} color={INK.meta} />}
      </Pressable>
      {abierta ? (
        <View style={{ paddingBottom: 14, gap: 16 }}>
          <Contenido seccion={seccion} />
          {seccion.citas.length ? (
            <View>
              <Plegable abierto={citas} onPress={() => setCitas((v) => !v)} texto="en el texto" color={INK.meta} />
              {citas ? seccion.citas.map((c, i) => <Cita key={i}>{c}</Cita>) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Contenido({ seccion: s }) {
  if (s.key === 'problema') return <Problema items={s.items} />;
  if (s.key === 'que_hace') return <Agrupado items={s.items} grupos={GRUPOS_ACCION} por="accion" Item={PuntoQueHace} />;
  if (s.key === 'quien_gana_quien_asume') return <Agrupado items={s.items} grupos={GRUPOS_EFECTO} por="efecto" Item={PuntoQuien} />;
  if (s.key === 'para_revisar') return <Agrupado items={s.items} grupos={GRUPOS_REVISAR} por="tipo" Item={PuntoSimple} />;
  if (s.key === 'dinero') return <Dinero items={s.items} />;
  if (s.key === 'cambios_ley_vigente') return <View style={{ gap: 14 }}>{s.items.map((it, i) => <Numerado key={i} n={i + 1}><Cambio item={it} /></Numerado>)}</View>;
  return <View style={{ gap: 10 }}>{s.items.map((it, i) => <Numerado key={i} n={i + 1}><PuntoSimple item={it} /></Numerado>)}</View>;
}

// ─── Piezas comunes ────────────────────────────────────────────────────────────

/** Un punto con su número a la izquierda: se sabe dónde empieza cada uno. */
function Numerado({ n, children }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(47,74,122,0.10)', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
        <Text style={{ fontSize: 11.5, fontWeight: '800', color: TINTA, fontVariant: ['tabular-nums'] }}>{n}</Text>
      </View>
      <View style={{ flex: 1, gap: 3 }}>{children}</View>
    </View>
  );
}

/** Los puntos de una sección, agrupados en orden fijo: rótulo con ícono y cuántos, y debajo, numerados. */
function Agrupado({ items, grupos, por, Item }) {
  const visibles = grupos.map(([clave, nombre, Icono, color]) => [nombre, Icono, color, items.filter((i) => (i[por] || 'otro') === clave)])
    .filter(([, , , lista]) => lista.length);
  const sueltos = items.filter((i) => !grupos.some(([clave]) => clave === (i[por] || 'otro')));
  return (
    <View style={{ gap: 16 }}>
      {visibles.map(([nombre, Icono, color, lista]) => (
        <View key={nombre} style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <Icono size={15} color={color || INK.title} />
            <Text style={[ROTULO, { color: color || INK.meta }]}>{nombre.toUpperCase()} · {lista.length}</Text>
          </View>
          {lista.map((it, i) => <Numerado key={i} n={i + 1}><Item item={it} /></Numerado>)}
        </View>
      ))}
      {sueltos.map((it, i) => <Numerado key={`s${i}`} n={i + 1}><Item item={it} /></Numerado>)}
    </View>
  );
}

const Nota = ({ children }) => (children ? <Text style={{ fontSize: 11.5, color: INK.meta }}>{children}</Text> : null);

function PuntoSimple({ item }) {
  return (
    <>
      <Text style={{ fontSize: 14, lineHeight: 20, color: INK.title }}>{item.texto}</Text>
      <Nota>{item.nota}</Nota>
    </>
  );
}

function PuntoQueHace({ item }) {
  return (
    <>
      <Text style={{ fontSize: 14, lineHeight: 20, color: INK.title }}>{item.texto}</Text>
      <Nota>{[item.quien, item.nota].filter(Boolean).join(' · ')}</Nota>
    </>
  );
}

function PuntoQuien({ item }) {
  return (
    <>
      <Text style={{ fontSize: 14, fontWeight: '700', color: INK.title }}>{item.titulo}</Text>
      <Text style={{ fontSize: 13.5, lineHeight: 19, color: INK.body }}>{item.texto}</Text>
      <Nota>{item.nota}</Nota>
    </>
  );
}

function Cita({ children, apagada = false }) {
  return (
    <Text style={{ fontSize: 12.5, lineHeight: 19, color: apagada ? INK.meta : INK.body, fontStyle: 'italic', borderLeftWidth: 2, borderLeftColor: RAYA, paddingLeft: 9, marginTop: 4 }}>
      {children}
    </Text>
  );
}

function Etiqueta({ children }) {
  return (
    <View style={{ alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.05)' }}>
      <Text style={{ fontSize: 11, color: INK.body }}>{children}</Text>
    </View>
  );
}

// ─── El problema ───────────────────────────────────────────────────────────────
// Arriba lo que dice que resuelve; debajo, los datos que usa, cada uno con su
// cifra dibujada: un porcentaje con su medidor de 100, otra cifra en su tarjeta.

function Problema({ items }) {
  const planteamientos = items.filter((i) => i.tipo !== 'dato');
  const datos = items.filter((i) => i.tipo === 'dato');
  return (
    <View style={{ gap: 18 }}>
      {planteamientos.length ? (
        <View style={{ padding: 14, borderRadius: RADIUS.md, backgroundColor: 'rgba(47,74,122,0.06)', gap: 10 }}>
          <Text style={ROTULO}>LO QUE DICE QUE RESUELVE</Text>
          {planteamientos.map((p, i) => (
            planteamientos.length > 1
              ? <Numerado key={i} n={i + 1}><Text style={{ fontSize: 14.5, lineHeight: 21, color: INK.title }}>{p.texto}</Text></Numerado>
              : <Text key={i} style={{ fontSize: 15, lineHeight: 22, color: INK.title }}>{p.texto}</Text>
          ))}
        </View>
      ) : null}
      {datos.length ? (
        <View style={{ gap: 12 }}>
          <Text style={ROTULO}>LOS DATOS QUE USA · {datos.length}</Text>
          {datos.map((d, i) => <Dato key={i} n={i + 1} dato={d} />)}
        </View>
      ) : null}
    </View>
  );
}

// El dinero se dibuja en «Dinero»; en los datos del problema un monto queda en su texto.
const ES_DINERO = new Set(['quetzales', 'dolares']);

/**
 * Un dato del problema: siempre numerado, como los demás. Si es un porcentaje,
 * debajo su medidor de 100 con la cifra; un monto no se agranda aquí.
 */
function Dato({ n, dato }) {
  const c = dato.cifraDato && !ES_DINERO.has(dato.cifraDato.unidad) ? dato.cifraDato : null;
  return (
    <View style={{ padding: 12, borderRadius: RADIUS.md, backgroundColor: TONO.tarjeta, borderWidth: 1, borderColor: TONO.raya }}>
      <Numerado n={n}>
        <Text style={{ fontSize: 14, lineHeight: 20, color: INK.title }}>{dato.texto}</Text>
        {c ? <Medidor cifra={c} /> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
          <FileText size={12} color={INK.meta} />
          <Text style={{ flex: 1, fontSize: 11.5, color: INK.meta }} numberOfLines={2}>{dato.fuente || 'la iniciativa no da la fuente'}</Text>
        </View>
      </Numerado>
    </View>
  );
}

/** La cifra con su forma: un porcentaje llena su barra de 100; otra cifra va grande con lo que cuenta. */
/** Un porcentaje, debajo del texto del dato: su barra de 100 y la cifra al lado. Otras cifras no se dibujan. */
function Medidor({ cifra }) {
  if (cifra.unidad !== 'porcentaje' || cifra.valor < 0 || cifra.valor > 100) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
      <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: 'rgba(28,43,34,0.07)', overflow: 'hidden' }}>
        <View style={{ width: `${Math.max(1.5, cifra.valor)}%`, height: 8, borderRadius: 4, backgroundColor: TINTA }} />
      </View>
      <Text style={{ fontSize: 12.5, fontWeight: '700', color: INK.title, fontVariant: ['tabular-nums'] }}>{cifraLegible(cifra)}</Text>
    </View>
  );
}

// ─── Dinero ────────────────────────────────────────────────────────────────────
// Cada partida es un diagrama de arriba abajo: de dónde sale, la cifra, a dónde
// va. Un porcentaje se dice también «de cada 100»; si se reparte, una barra con
// sus partes; si hay varios montos en quetzales, barras que los comparan.

// Solo el dinero que se gasta sale de algún lado; en una exención o un impuesto
// se dice sobre qué es y a favor de quién.
const SALE_DE_ALGUN_LADO = new Set(['gasto', 'asignacion', 'transferencia', 'fondo']);
const REPARTO = [TINTA, '#7C93B8', '#B7C6DD', '#5E7A66', '#A9BFAE', '#C9B98F', '#8C7B6B', '#D8D2C4'];

const plana = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const baseRepetida = (item) => item.base && item.de && plana(item.base).includes(plana(item.de));

function Dinero({ items }) {
  const barras = comparables(items);
  const conCifra = items.filter((i) => i.cifra);
  const sinCifra = items.filter((i) => !i.cifra);
  return (
    <View style={{ gap: 16 }}>
      {barras.length ? <Comparacion barras={barras} /> : null}
      {conCifra.map((it, i) => <Diagrama key={i} item={it} />)}
      {sinCifra.length ? (
        <View style={{ gap: 10 }}>
          <Text style={ROTULO}>SIN MONTO EN EL TEXTO · {sinCifra.length}</Text>
          {sinCifra.map((it, i) => (
            <Numerado key={i} n={i + 1}>
              <Text style={{ fontSize: 14, lineHeight: 20, color: INK.title }}>{it.texto}</Text>
              <Ruta item={it} />
              <Nota>{[it.etiqueta, it.nota].filter(Boolean).join(' · ')}</Nota>
            </Numerado>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const rotulosDe = (item) => (SALE_DE_ALGUN_LADO.has(item.tipo) ? ['SALE DE', 'VA A'] : ['SOBRE', 'A FAVOR DE']);

/** De dónde sale → cifra → a dónde va, en cajas unidas por flechas. */
function Diagrama({ item }) {
  const [rDe, rPara] = rotulosDe(item);
  const de = item.de || (SALE_DE_ALGUN_LADO.has(item.tipo) ? null : undefined);
  const pctExplicado = item.unidad === 'porcentaje' ? deCadaCien(item.cantidad) : null;
  return (
    <View style={{ gap: 6, padding: 10, borderRadius: RADIUS.lg, backgroundColor: 'rgba(28,43,34,0.035)' }}>
      {de !== undefined ? <Caja rotulo={rDe} texto={de || 'la iniciativa no lo dice'} apagada={!de} /> : null}
      {de !== undefined ? <Flecha /> : null}
      <View style={{ padding: 14, borderRadius: RADIUS.md, backgroundColor: TONO.arenaLavado, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <Text style={{ flexShrink: 1, fontFamily: SERIF, fontSize: 30, lineHeight: 32, color: INK.title }}>{item.cifra}</Text>
          {item.etiqueta && item.tipo !== 'otro' ? <Etiqueta>{item.etiqueta}</Etiqueta> : null}
        </View>
        {pctExplicado ? (
          <Text style={{ fontSize: 13, color: INK.title }}>
            {pctExplicado}{item.base && !baseRepetida(item) ? ` ${item.base}` : item.de ? ` de ${item.de}` : ''}
          </Text>
        ) : item.base ? <Text style={{ fontSize: 13, color: INK.title }}>{item.base}</Text> : null}
        <Text style={{ fontSize: 13, lineHeight: 19, color: INK.body }}>{item.texto}</Text>
      </View>
      {item.para ? <Flecha /> : null}
      {item.para ? <Caja rotulo={rPara} texto={item.para} /> : null}
      {item.reparto ? <Reparto partes={item.reparto} /> : null}
      <Nota>{item.nota}</Nota>
    </View>
  );
}

function Caja({ rotulo, texto, apagada = false }) {
  return (
    <View style={{ paddingHorizontal: 12, paddingVertical: 9, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: apagada ? TONO.raya : TONO.borde, borderStyle: apagada ? 'dashed' : 'solid', backgroundColor: TONO.tarjeta, gap: 2 }}>
      <Text style={ROTULO}>{rotulo}</Text>
      <Text style={{ fontSize: 13.5, lineHeight: 19, color: apagada ? INK.meta : INK.title, fontStyle: apagada ? 'italic' : 'normal' }}>{texto}</Text>
    </View>
  );
}

const Flecha = () => (
  <View style={{ alignItems: 'center' }}><ArrowDown size={16} color={INK.meta} /></View>
);

/** Para lo que no tiene monto: el mismo recorrido, en una línea. */
function Ruta({ item }) {
  const [rDe, rPara] = rotulosDe(item);
  const partes = [item.de ? `${rDe.toLowerCase()} ${item.de}` : null, item.para ? `${rPara.toLowerCase()} ${item.para}` : null].filter(Boolean);
  return partes.length ? <Text style={{ fontSize: 12.5, lineHeight: 18, color: INK.body }}>{partes.join(' → ')}</Text> : null;
}

/** Varios montos en quetzales, a escala del mayor. */
function Comparacion({ barras }) {
  return (
    <View style={{ gap: 9, padding: 14, borderRadius: RADIUS.md, backgroundColor: 'rgba(28,43,34,0.04)' }}>
      <Text style={ROTULO}>CUÁNTO VA A CADA COSA</Text>
      {barras.map((b, i) => (
        <View key={i} style={{ gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
            <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, color: INK.title }}>{b.para || b.texto}</Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: INK.title, fontVariant: ['tabular-nums'] }}>{b.cifra}</Text>
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(28,43,34,0.07)', overflow: 'hidden' }}>
            <View style={{ width: `${Math.max(3, Math.round(b.proporcion * 100))}%`, height: 8, borderRadius: 4, backgroundColor: TONO.verde }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Cómo se reparte: una barra con cada parte a su tamaño y, debajo, cada parte con su porcentaje. */
function Reparto({ partes }) {
  const total = partes.reduce((n, p) => n + p.porcentaje, 0) || 1;
  return (
    <View style={{ gap: 8, marginTop: 6, padding: 12, borderRadius: RADIUS.md, backgroundColor: 'rgba(28,43,34,0.04)' }}>
      <Text style={ROTULO}>CÓMO SE REPARTE</Text>
      <View style={{ flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.06)' }}>
        {partes.map((p, i) => (
          <View key={i} style={{ width: `${(p.porcentaje / Math.max(100, total)) * 100}%`, backgroundColor: REPARTO[i % REPARTO.length] }} />
        ))}
      </View>
      {partes.map((p, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: REPARTO[i % REPARTO.length] }} />
          <Text style={{ flex: 1, fontSize: 13, color: INK.body }}>{p.parte}</Text>
          <Text style={{ fontSize: 13, fontWeight: '700', color: INK.title, fontVariant: ['tabular-nums'] }}>{p.porcentaje} %</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Qué cambia de la ley vigente ──────────────────────────────────────────────

/** Un artículo que se toca: el propuesto, y al abrir, el de hoy desde la base de leyes. */
function Cambio({ item }) {
  const [antes, setAntes] = useState(false);
  const vigente = useQuery({
    queryKey: ['articulo-vigente', item.ley.decreto, item.ley.articulo],
    queryFn: () => traerVigente(item.ley),
    enabled: antes && !!item.ley.decreto,
    staleTime: 60 * 60 * 1000,
  });
  const puedeComparar = !!item.ley.decreto && item.etiqueta !== 'adiciona';
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        {item.etiqueta ? <Etiqueta>{item.etiqueta}</Etiqueta> : null}
        <Text style={{ flexShrink: 1, fontSize: 14, fontWeight: '700', color: INK.title }}>art. {item.ley.articulo}</Text>
        <Text style={{ flexShrink: 1, fontSize: 12.5, color: INK.body }}>{item.ley.nombre || item.nota}</Text>
      </View>
      {item.propuesto ? (
        <View style={{ gap: 3 }}>
          <Text style={ROTULO}>CÓMO QUEDARÍA</Text>
          <Cita>{item.propuesto}</Cita>
        </View>
      ) : null}
      {puedeComparar ? <Plegable abierto={antes} onPress={() => setAntes((v) => !v)} texto="cómo está hoy" color={INK.meta} /> : null}
      {antes && vigente.data ? <Cita apagada>{vigente.data.texto}</Cita> : null}
      {antes && vigente.isSuccess && !vigente.data ? <Text style={{ fontSize: 12, color: INK.meta }}>Ese artículo no está en la biblioteca de leyes.</Text> : null}
    </View>
  );
}
