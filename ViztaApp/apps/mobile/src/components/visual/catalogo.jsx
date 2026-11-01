import { createContext, useContext, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { createLibrary, defineComponent } from '@openuidev/react-lang';
import {
  ArrowRight,
  BarChart3,
  Building2,
  CalendarDays,
  Info,
  Landmark,
  MapPin,
  Network,
  Newspaper,
  Quote,
  TriangleAlert,
  UserRound,
  Users,
} from 'lucide-react-native';
import { INK, RADIUS, SERIF } from '../theme';
import { ROTULO, TONO } from '../colaboradores/piezas';
import { Hemiciclo as DibujoHemiciclo } from '../feed/TarjetasCongreso';
import usePortada from '../../utils/portada';
import MorphingInfinity from '../MorphingInfinity';
import { agrupar, cargoDe, idsDe, nombreCorto, partidoDe, traerItems, traerRelaciones } from './datos';

/**
 * El vocabulario visual de Vizta.
 *
 * Un agente no escribe HTML ni dibuja: arma una vista con estas piezas, en
 * OpenUI Lang. Las piezas que muestran a alguien llevan el id del Codex y no su
 * nombre ni su foto (ver `datos.js`). La descripción de cada una es lo que lee
 * el modelo para decidir cuál usar; por eso dice cuándo sirve.
 *
 * Tocar a un actor, una entidad o el otro extremo de una relación abre su ficha.
 */

// onEntidad abre una ficha; entidades y relaciones son lo que el servidor ya
// mandó con la vista (quien mira un dashboard compartido no ve ese Codex).
export const VisualContexto = createContext({ onEntidad: null, entidades: null, relaciones: null });

const ICONOS = {
  actores: Users,
  actor: UserRound,
  entidad: Building2,
  congreso: Landmark,
  relaciones: Network,
  tiempo: CalendarDays,
  noticias: Newspaper,
  cifras: BarChart3,
  lugar: MapPin,
  cita: Quote,
  info: Info,
};
const NOMBRES_ICONO = Object.keys(ICONOS);

const tinta = { title: INK.title, body: INK.body, meta: INK.meta };

// ─── Piezas de lectura ──────────────────────────────────────────────────────

const Texto = defineComponent({
  name: 'Texto',
  props: z.object({ texto: z.string(), tono: z.enum(['cuerpo', 'meta', 'destacado']).optional() }),
  description: 'Un párrafo corto. tono "destacado" para la idea principal, "meta" para aclaraciones.',
  component: ({ props }) => (
    <Text
      style={{
        fontSize: props.tono === 'destacado' ? 17 : props.tono === 'meta' ? 13 : 15,
        lineHeight: props.tono === 'destacado' ? 24 : props.tono === 'meta' ? 18 : 21,
        fontWeight: props.tono === 'destacado' ? '600' : '400',
        color: props.tono === 'meta' ? INK.meta : props.tono === 'destacado' ? INK.title : INK.body,
      }}
    >
      {props.texto}
    </Text>
  ),
});

const Cita = defineComponent({
  name: 'Cita',
  props: z.object({ texto: z.string(), quien: z.string().optional() }),
  description: 'Una frase literal de alguien, con quién la dijo.',
  component: ({ props }) => (
    <View style={{ borderLeftWidth: 3, borderLeftColor: TONO.borde, paddingLeft: 14, paddingVertical: 2, gap: 6 }}>
      <Text style={{ fontFamily: SERIF, fontSize: 21, lineHeight: 26, color: INK.title }}>«{props.texto}»</Text>
      {props.quien ? <Text style={{ fontSize: 13, color: INK.meta }}>{props.quien}</Text> : null}
    </View>
  ),
});

const Aviso = defineComponent({
  name: 'Aviso',
  props: z.object({ texto: z.string(), tono: z.enum(['info', 'alerta']).optional() }),
  description: 'Una advertencia sobre cómo leer los datos (datos incompletos, fechas, fuentes). Úsalo poco.',
  component: ({ props }) => {
    const alerta = props.tono === 'alerta';
    const Icono = alerta ? TriangleAlert : Info;
    return (
      <View style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: RADIUS.md, backgroundColor: alerta ? TONO.arenaLavado : 'rgba(28,43,34,0.04)' }}>
        <Icono size={17} color={alerta ? TONO.arena : INK.meta} style={{ marginTop: 1 }} />
        <Text style={{ flex: 1, fontSize: 13.5, lineHeight: 19, color: INK.body }}>{props.texto}</Text>
      </View>
    );
  },
});

const Cifra = defineComponent({
  name: 'Cifra',
  props: z.object({ valor: z.union([z.string(), z.number()]), etiqueta: z.string(), detalle: z.string().optional() }),
  description: 'Un número grande con lo que cuenta («27 partidos vigentes»).',
  component: ({ props }) => (
    <View style={{ minWidth: 96, flexGrow: 1, flexBasis: 96, padding: 12, borderRadius: RADIUS.md, backgroundColor: TONO.tarjeta, borderWidth: 1, borderColor: TONO.raya, gap: 2 }}>
      <Text style={{ fontFamily: SERIF, fontSize: 32, lineHeight: 36, color: INK.title }}>{String(props.valor)}</Text>
      <Text style={{ fontSize: 13, fontWeight: '600', color: INK.title }}>{props.etiqueta}</Text>
      {props.detalle ? <Text style={{ fontSize: 12, color: INK.meta }}>{props.detalle}</Text> : null}
    </View>
  ),
});

const Cifras = defineComponent({
  name: 'Cifras',
  props: z.object({ cifras: z.array(Cifra.ref) }),
  description: 'Una fila de cifras, de 2 a 4.',
  component: ({ props, renderNode }) => <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{renderNode(props.cifras)}</View>,
});

const Barra = defineComponent({
  name: 'Barra',
  props: z.object({ etiqueta: z.string(), valor: z.number() }),
  description: 'Una barra de Barras.',
  component: () => null,
});

const Barras = defineComponent({
  name: 'Barras',
  props: z.object({ barras: z.array(Barra.ref), unidad: z.string().optional() }),
  description: 'Comparar cantidades entre categorías (barras horizontales, de mayor a menor).',
  component: ({ props }) => {
    const barras = (props.barras || []).map((b) => b?.props || b).filter((b) => b && Number.isFinite(Number(b.valor)));
    const max = Math.max(1, ...barras.map((b) => Number(b.valor)));
    return (
      <View style={{ gap: 9 }}>
        {[...barras].sort((a, b) => b.valor - a.valor).map((b, i) => (
          <View key={`${b.etiqueta}-${i}`} style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 13.5, color: INK.title }}>{b.etiqueta}</Text>
              <Text style={{ fontSize: 13.5, fontWeight: '700', color: INK.title }}>
                {b.valor}
                {props.unidad ? <Text style={{ fontWeight: '400', color: INK.meta }}> {props.unidad}</Text> : null}
              </Text>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(28,43,34,0.06)' }}>
              <View style={{ width: `${(Number(b.valor) / max) * 100}%`, height: 8, borderRadius: 4, backgroundColor: TONO.verde }} />
            </View>
          </View>
        ))}
      </View>
    );
  },
});

const Hemiciclo = defineComponent({
  name: 'Hemiciclo',
  props: z.object({ favor: z.number(), contra: z.number().optional(), ausentes: z.number().optional(), titulo: z.string().optional() }),
  description: 'Una votación del Congreso (160 curules): votos a favor, en contra y ausentes. Solo con votos contados.',
  component: ({ props }) => {
    const { width } = useWindowDimensions();
    return (
      <View style={{ alignItems: 'center', gap: 6 }}>
        <DibujoHemiciclo favor={props.favor} contra={props.contra || 0} ausentes={props.ausentes || 0} ancho={Math.min(width - 64, 320)} />
        <Text style={{ fontSize: 13, color: INK.body }}>
          <Text style={{ fontWeight: '700', color: INK.title }}>{props.favor}</Text> a favor
          {props.contra ? `, ${props.contra} en contra` : ''}
          {props.titulo ? ` · ${props.titulo}` : ''}
        </Text>
      </View>
    );
  },
});

const Hito = defineComponent({
  name: 'Hito',
  props: z.object({ fecha: z.string(), titulo: z.string(), detalle: z.string().optional() }),
  description: 'Un momento de una LineaDeTiempo. fecha como se lee («12 oct 2026»).',
  component: () => null,
});

const LineaDeTiempo = defineComponent({
  name: 'LineaDeTiempo',
  props: z.object({ hitos: z.array(Hito.ref) }),
  description: 'Qué pasó y cuándo, en orden.',
  component: ({ props }) => {
    const hitos = (props.hitos || []).map((h) => h?.props || h).filter(Boolean);
    return (
      <View>
        {hitos.map((h, i) => (
          <View key={`${h.fecha}-${i}`} style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ alignItems: 'center', width: 12 }}>
              <View style={{ width: 9, height: 9, borderRadius: 5, marginTop: 5, backgroundColor: TONO.verde }} />
              {i < hitos.length - 1 ? <View style={{ flex: 1, width: 1.5, backgroundColor: TONO.borde, marginVertical: 3 }} /> : null}
            </View>
            <View style={{ flex: 1, paddingBottom: 16, gap: 2 }}>
              <Text style={[ROTULO, { color: INK.meta }]}>{String(h.fecha).toUpperCase()}</Text>
              <Text style={{ fontSize: 15, lineHeight: 20, fontWeight: '600', color: INK.title }}>{h.titulo}</Text>
              {h.detalle ? <Text style={{ fontSize: 13.5, lineHeight: 19, color: INK.body }}>{h.detalle}</Text> : null}
            </View>
          </View>
        ))}
      </View>
    );
  },
});

// ─── Piezas del Codex ───────────────────────────────────────────────────────

function useItems(lista) {
  const ids = useMemo(() => idsDe(lista), [lista]);
  const { entidades } = useContext(VisualContexto);
  // Si el servidor ya mandó todas, no se pide nada.
  const enviadas = useMemo(() => {
    if (!entidades || !ids.every((id) => entidades.has(id))) return null;
    return ids.map((id) => entidades.get(id));
  }, [entidades, ids]);
  const q = useQuery({
    queryKey: ['visual-items', ids.join(',')],
    queryFn: () => traerItems(ids),
    enabled: ids.length > 0 && !enviadas,
    staleTime: 1000 * 60 * 5,
  });
  return enviadas ? { data: enviadas, isLoading: false } : q;
}

function Cargando() {
  return (
    <View style={{ paddingVertical: 18, alignItems: 'center' }}>
      <MorphingInfinity size={22} color={INK.meta} />
    </View>
  );
}

/** La cara de un item: su foto o logo; sin imagen, sus iniciales sobre un lavado. */
function Cara({ item, size }) {
  const uri = usePortada(item);
  const entidad = item?.tipo === 'Entidad';
  const forma = { width: size, height: size, borderRadius: entidad ? size * 0.24 : size / 2 };
  if (uri) return <Image source={{ uri }} style={[forma, { backgroundColor: 'rgba(28,43,34,0.06)' }]} resizeMode={entidad ? 'contain' : 'cover'} />;
  const iniciales = nombreCorto(item)
    .split(/\s+/)
    .filter((w) => /^[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return (
    <View style={[forma, { alignItems: 'center', justifyContent: 'center', backgroundColor: entidad ? 'rgba(45,88,98,0.10)' : TONO.verdeLavado }]}>
      <Text style={{ fontSize: size * 0.34, fontWeight: '700', color: entidad ? '#2D5862' : TONO.verde }}>{iniciales || '?'}</Text>
    </View>
  );
}

function Tocable({ item, children, style }) {
  const { onEntidad } = useContext(VisualContexto);
  return (
    <Pressable
      onPress={onEntidad ? () => onEntidad(item) : undefined}
      disabled={!onEntidad}
      accessibilityRole={onEntidad ? 'button' : undefined}
      accessibilityLabel={`Abrir la ficha de ${nombreCorto(item)}`}
      style={({ pressed }) => [style, { opacity: pressed ? 0.6 : 1 }]}
    >
      {children}
    </Pressable>
  );
}

const Actor = defineComponent({
  name: 'Actor',
  props: z.object({ id: z.string(), nota: z.string().optional() }),
  description:
    'La ficha de UNA persona o entidad del Codex, por su id (búscalo antes con el Codex). Se ve su foto o logo, nombre, cargo y partido; se toca para abrir su ficha. nota: por qué está aquí, en una línea.',
  component: ({ props }) => {
    const q = useItems([props.id]);
    const item = q.data?.[0];
    if (q.isLoading) return <Cargando />;
    if (!item) return null;
    const linea = [cargoDe(item), partidoDe(item)].filter(Boolean).join(' · ');
    return (
      <Tocable item={item} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: RADIUS.lg, backgroundColor: TONO.tarjeta, borderWidth: 1, borderColor: TONO.raya }}>
        <Cara item={item} size={56} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: INK.title }} numberOfLines={2}>{nombreCorto(item)}</Text>
          {linea ? <Text style={{ fontSize: 13, color: INK.body }} numberOfLines={1}>{linea}</Text> : null}
          {props.nota ? <Text style={{ fontSize: 13, lineHeight: 18, color: INK.meta }} numberOfLines={2}>{props.nota}</Text> : null}
        </View>
        <ArrowRight size={16} color={INK.faint} />
      </Tocable>
    );
  },
});

const Actores = defineComponent({
  name: 'Actores',
  props: z.object({
    actores: z.array(z.union([z.string(), z.object({ id: z.string() }).passthrough()])),
    agruparPor: z.enum(['partido', 'tipo']).optional(),
    forma: z.enum(['rejilla', 'lista']).optional(),
  }),
  description:
    'Varias personas o entidades del Codex, por id (o los items de un Query), con sus caras. "rejilla" para mapear a muchos de un vistazo (precandidatos, una bancada); "lista" para leer su cargo y partido. agruparPor "partido" los junta por partido.',
  component: ({ props }) => {
    const q = useItems(props.actores);
    const { width } = useWindowDimensions();
    if (q.isLoading) return <Cargando />;
    const items = q.data || [];
    if (!items.length) return <Text style={{ fontSize: 13.5, color: INK.meta }}>Ninguno en tu Codex todavía.</Text>;
    const grupos = agrupar(items, props.agruparPor);
    const lista = props.forma === 'lista';
    const columnas = width > 600 ? 5 : 4;
    const celda = (width - 40 - (columnas - 1) * 10) / columnas;
    return (
      <View style={{ gap: 18 }}>
        {grupos.map((g) => (
          <View key={g.nombre || 'todos'} style={{ gap: 10 }}>
            {g.nombre ? (
              <Text style={ROTULO}>
                {g.nombre.toUpperCase()} · {g.items.length}
              </Text>
            ) : null}
            {lista ? (
              <View style={{ gap: 8 }}>
                {g.items.map((it) => {
                  const linea = [cargoDe(it), props.agruparPor === 'partido' ? null : partidoDe(it)].filter(Boolean).join(' · ');
                  return (
                    <Tocable key={it.id} item={it} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Cara item={it} size={42} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '600', color: INK.title }} numberOfLines={1}>{nombreCorto(it)}</Text>
                        {linea ? <Text style={{ fontSize: 12.5, color: INK.meta }} numberOfLines={1}>{linea}</Text> : null}
                      </View>
                    </Tocable>
                  );
                })}
              </View>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {g.items.map((it) => (
                  <Tocable key={it.id} item={it} style={{ width: celda, alignItems: 'center', gap: 6 }}>
                    <Cara item={it} size={Math.min(celda - 8, 72)} />
                    <Text style={{ fontSize: 11.5, lineHeight: 14, fontWeight: '600', color: INK.title, textAlign: 'center' }} numberOfLines={3}>
                      {nombreCorto(it)}
                    </Text>
                  </Tocable>
                ))}
              </View>
            )}
          </View>
        ))}
      </View>
    );
  },
});

const Relaciones = defineComponent({
  name: 'Relaciones',
  props: z.object({ id: z.string(), limite: z.number().optional() }),
  description: 'Con quién y con qué está vinculado un item del Codex (partidos, cargos, alianzas), leído de sus relaciones guardadas.',
  component: ({ props }) => {
    const { relaciones, entidades } = useContext(VisualContexto);
    const enviadas = relaciones?.[props.id];
    const q = useQuery({
      queryKey: ['visual-relaciones', props.id],
      queryFn: () => traerRelaciones(props.id),
      enabled: !enviadas,
      staleTime: 1000 * 60 * 5,
    });
    const lista = enviadas
      ? enviadas.map((r) => ({ ...r, otro: entidades?.get(r.otro_id) })).filter((r) => r.otro)
      : q.data || [];
    if (!enviadas && q.isLoading) return <Cargando />;
    const rels = lista.slice(0, props.limite || 12);
    if (!rels.length) return <Text style={{ fontSize: 13.5, color: INK.meta }}>Sin relaciones guardadas.</Text>;
    return (
      <View style={{ gap: 10 }}>
        {rels.map((r) => (
          <Tocable key={r.id} item={r.otro} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Cara item={r.otro} size={38} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12.5, color: INK.meta }} numberOfLines={1}>
                {r.sale ? r.verbo : `${r.verbo} (lo vincula)`}
              </Text>
              <Text style={{ fontSize: 15, fontWeight: '600', color: INK.title }} numberOfLines={1}>{nombreCorto(r.otro)}</Text>
            </View>
          </Tocable>
        ))}
      </View>
    );
  },
});

// ─── Estructura ─────────────────────────────────────────────────────────────

const Contenido = z.union([
  Texto.ref, Cita.ref, Aviso.ref, Cifras.ref, Barras.ref, Hemiciclo.ref,
  LineaDeTiempo.ref, Actor.ref, Actores.ref, Relaciones.ref,
]);

const Seccion = defineComponent({
  name: 'Seccion',
  props: z.object({ titulo: z.string(), contenido: z.array(Contenido), icono: z.enum(NOMBRES_ICONO).optional() }),
  description: `Un bloque con título. icono: ${NOMBRES_ICONO.join(', ')}.`,
  component: ({ props, renderNode }) => {
    const Icono = ICONOS[props.icono] || null;
    return (
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {Icono ? <Icono size={17} color={INK.title} /> : null}
          <Text style={{ fontSize: 18, fontWeight: '800', color: tinta.title }} accessibilityRole="header">{props.titulo}</Text>
        </View>
        <View style={{ gap: 12 }}>{renderNode(props.contenido)}</View>
      </View>
    );
  },
});

const Pestana = defineComponent({
  name: 'Pestana',
  props: z.object({ nombre: z.string(), contenido: z.array(z.union([Seccion.ref, Contenido])) }),
  description: 'Una pestaña de Pestanas.',
  component: () => null,
});

const Pestanas = defineComponent({
  name: 'Pestanas',
  props: z.object({ pestanas: z.array(Pestana.ref) }),
  description: 'Pestañas para separar vistas de lo mismo (por partido, por tema). De 2 a 5.',
  component: ({ props, renderNode }) => {
    const pestanas = (props.pestanas || []).map((p) => p?.props || p).filter(Boolean);
    const [elegida, setElegida] = useState(0);
    const actual = pestanas[Math.min(elegida, pestanas.length - 1)];
    return (
      <View style={{ gap: 16 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {pestanas.map((p, i) => {
            const activa = p === actual;
            return (
              <Pressable
                key={`${p.nombre}-${i}`}
                onPress={() => setElegida(i)}
                accessibilityRole="tab"
                accessibilityState={{ selected: activa }}
                style={{ paddingHorizontal: 14, height: 34, borderRadius: RADIUS.pill, justifyContent: 'center', backgroundColor: activa ? INK.title : 'rgba(28,43,34,0.05)' }}
              >
                <Text style={{ fontSize: 13.5, fontWeight: '700', color: activa ? '#FFFFFF' : INK.body }}>{p.nombre}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {actual ? <View style={{ gap: 22 }}>{renderNode(actual.contenido)}</View> : null}
      </View>
    );
  },
});

const Vista = defineComponent({
  name: 'Vista',
  props: z.object({
    titulo: z.string(),
    contenido: z.array(z.union([Seccion.ref, Pestanas.ref, Contenido])),
    bajada: z.string().optional(),
  }),
  description: 'La raíz: título, una bajada de una línea con lo que se ve, y su contenido.',
  component: ({ props, renderNode }) => (
    <View style={{ gap: 24 }}>
      <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: SERIF, fontSize: 32, lineHeight: 36, color: INK.title }} accessibilityRole="header">{props.titulo}</Text>
        {props.bajada ? <Text style={{ fontSize: 15, lineHeight: 21, color: INK.body }}>{props.bajada}</Text> : null}
      </View>
      {renderNode(props.contenido)}
    </View>
  ),
});

export const catalogo = createLibrary({
  root: 'Vista',
  components: [Vista, Seccion, Pestanas, Pestana, Texto, Cita, Aviso, Cifras, Cifra, Barras, Barra, Hemiciclo, LineaDeTiempo, Hito, Actor, Actores, Relaciones],
  componentGroups: [
    { name: 'Estructura', components: ['Vista', 'Seccion', 'Pestanas', 'Pestana'] },
    { name: 'Personas y entidades del Codex', components: ['Actor', 'Actores', 'Relaciones'], notes: ['Siempre por id del Codex: nunca escribas nombres ni fotos a mano.'] },
    { name: 'Datos', components: ['Cifras', 'Cifra', 'Barras', 'Barra', 'Hemiciclo', 'LineaDeTiempo', 'Hito'] },
    { name: 'Texto', components: ['Texto', 'Cita', 'Aviso'] },
  ],
});
