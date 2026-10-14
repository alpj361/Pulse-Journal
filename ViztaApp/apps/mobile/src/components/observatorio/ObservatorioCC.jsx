import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { INK } from '../theme';
import { Burbujas } from '../feed/CongresoOrganizado';
import { RAYA, Rotulo, TINTA, Titulo } from '../feed/TarjetasCongreso';
import IconoCC from './IconoCC';
import DetalleCC from './DetalleCC';
import PresupuestoCC from './PresupuestoCC';
import ActoresCC from './ActoresCC';
import {
  SinAcceso,
  contarResoluciones,
  contraQuien,
  mesCorto,
  quienPidio,
  rangoDeMes,
  tonoDe,
  traerFaceta,
  traerResoluciones,
} from './observatorio';

/**
 * El Observatorio de la Corte de Constitucionalidad, con la misma forma que el
 * Congreso: un tablero que cuenta lo reciente en el orden en que pasó, y lo
 * mismo organizado por materia para encontrar algo sin recorrer mes por mes.
 * Aparte, el presupuesto del Estado año por año y los actores públicos.
 */
const VISTAS = [
  ['tablero', 'Tablero'],
  ['organizado', 'Organizado'],
  ['presupuesto', 'Presupuesto'],
  ['actores', 'Actores'],
];

export default function ObservatorioCC() {
  const [vista, setVista] = useState('tablero');
  const [abierta, setAbierta] = useState(null);

  return (
    <View>
      <Pestanas valor={vista} onCambiar={setVista} />
      {vista === 'tablero' ? <Tablero onAbrir={setAbierta} /> : null}
      {vista === 'organizado' ? <Organizado onAbrir={setAbierta} /> : null}
      {vista === 'presupuesto' ? <PresupuestoCC /> : null}
      {vista === 'actores' ? <ActoresCC /> : null}
      <DetalleCC resolucion={abierta} onClose={() => setAbierta(null)} />
    </View>
  );
}

function Pestanas({ valor, onCambiar }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignSelf: 'flex-start',
        marginTop: 14,
        marginBottom: 6,
        padding: 3,
        borderRadius: 12,
        backgroundColor: 'rgba(28,43,34,0.06)',
      }}
    >
      {VISTAS.map(([clave, nombre]) => {
        const activo = valor === clave;
        return (
          <Pressable
            key={clave}
            onPress={() => onCambiar(clave)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activo }}
            style={{ paddingVertical: 6, paddingHorizontal: 11, borderRadius: 9, backgroundColor: activo ? '#FFFFFF' : 'transparent' }}
          >
            <Text style={{ fontSize: 13, fontWeight: activo ? '700' : '500', color: activo ? INK.title : INK.meta }}>{nombre}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Tablero ─────────────────────────────────────────────────────────────────

/**
 * Lo reciente, mes por mes. Arriba, cuántas resolvió la Corte cada mes: tocar
 * una barra deja solo ese mes, tocarla otra vez vuelve a todo.
 */
function Tablero({ onAbrir }) {
  const [mes, setMes] = useState(null);
  const { data: meses = [] } = useQuery({ queryKey: ['cc-faceta', 'mes'], queryFn: () => traerFaceta('mes'), staleTime: 6 * 3600e3 });
  const ultimos = useMemo(
    () => meses.filter((m) => /^\d{4}-\d{2}$/.test(m.valor)).sort((a, b) => (a.valor < b.valor ? -1 : 1)).slice(-12),
    [meses]
  );
  return (
    <View>
      {ultimos.length ? <BarrasMeses meses={ultimos} elegido={mes} onElegir={(m) => setMes((x) => (x === m ? null : m))} /> : null}
      <Lista filtros={mes ? rangoDeMes(mes) : {}} porMes onAbrir={onAbrir} />
    </View>
  );
}

function BarrasMeses({ meses, elegido, onElegir }) {
  const mayor = Math.max(...meses.map((m) => m.conteo), 1);
  return (
    <View style={{ marginTop: 14, marginBottom: 6 }}>
      <Text style={{ fontSize: 12, color: INK.faint, marginBottom: 8 }}>
        {elegido ? `${mesCorto(elegido)} · ${meses.find((m) => m.valor === elegido)?.conteo || 0} resoluciones` : 'Resoluciones por mes'}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 74, gap: 4 }}>
        {meses.map((m) => {
          const activo = elegido === m.valor;
          return (
            <Pressable
              key={m.valor}
              onPress={() => onElegir(m.valor)}
              accessibilityRole="button"
              accessibilityLabel={`${mesCorto(m.valor)}, ${m.conteo} resoluciones`}
              style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}
            >
              <View
                style={{
                  height: `${Math.max(4, (m.conteo / mayor) * 100)}%`,
                  borderRadius: 3,
                  backgroundColor: activo ? TINTA : elegido ? 'rgba(47,74,122,0.18)' : 'rgba(47,74,122,0.45)',
                }}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={{ fontSize: 10.5, color: INK.faint }}>{mesCorto(meses[0].valor)}</Text>
        <Text style={{ fontSize: 10.5, color: INK.faint }}>{mesCorto(meses[meses.length - 1].valor)}</Text>
      </View>
    </View>
  );
}

// ─── Organizado ──────────────────────────────────────────────────────────────

/**
 * Por materia. Las burbujas son las mismas del Congreso, con el ícono de cada
 * materia. Elegida una, arriba va cómo le fue a quien pidió amparo en esa
 * materia —tocar un tramo deja solo esos— y un filtro de amparo provisional.
 */
function Organizado({ onAbrir }) {
  const [materia, setMateria] = useState(null);
  const [abierto, setAbierto] = useState(true);
  const [resultado, setResultado] = useState(null);
  const [provisional, setProvisional] = useState(false);
  const { data: materias = [] } = useQuery({ queryKey: ['cc-faceta', 'materia'], queryFn: () => traerFaceta('materia'), staleTime: 6 * 3600e3 });
  const orden = useMemo(() => [...materias].sort((a, b) => b.conteo - a.conteo), [materias]);
  const secciones = orden.map((m) => [m.valor, m.etiqueta]);
  const cuantas = (v) => orden.find((m) => m.valor === v)?.conteo || 0;

  const filtros = { materia: materia || undefined, resultado: resultado || undefined, cautelar: provisional ? 'OTORGADO' : undefined };

  return (
    <View style={{ marginTop: 14 }}>
      <Burbujas
        secciones={secciones}
        cuantas={cuantas}
        elegida={materia}
        onElegir={(v) => {
          // Son 22: elegida una, se pliegan para que se vea lo de esa materia.
          if (materia !== v) setAbierto(false);
          setMateria((x) => (x === v ? null : v));
          setResultado(null);
        }}
        abierto={abierto}
        onAbrir={() => setAbierto((x) => !x)}
        icono={(v) => <IconoCC codigo={v} size={34} />}
        todas="Todas las materias"
      />
      {materia ? <Resultados materia={materia} elegido={resultado} onElegir={(r) => setResultado((x) => (x === r ? null : r))} /> : null}
      <Pressable
        onPress={() => setProvisional((x) => !x)}
        accessibilityRole="switch"
        accessibilityState={{ checked: provisional }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          gap: 6,
          paddingLeft: 4,
          paddingRight: 12,
          paddingVertical: 3,
          marginBottom: 6,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: provisional ? TINTA : 'rgba(28,43,34,0.10)',
          backgroundColor: provisional ? 'rgba(47,74,122,0.08)' : 'rgba(255,255,255,0.7)',
        }}
      >
        <IconoCC codigo="OTORGADO" size={26} />
        <Text style={{ fontSize: 12.5, fontWeight: provisional ? '700' : '500', color: provisional ? TINTA : INK.title }}>
          Con amparo provisional
        </Text>
      </Pressable>
      <Lista filtros={filtros} onAbrir={onAbrir} />
    </View>
  );
}

const RESULTADOS = [
  ['AMPARO_OTORGADO', 'Otorgado', '#15803D'],
  ['AMPARO_OTORGADO_PARCIALMENTE', 'En parte', '#86B88F'],
  ['AMPARO_DENEGADO', 'Denegado', '#B91C1C'],
];

/** Cómo le fue a quien pidió amparo en la materia: una barra que se toca. */
function Resultados({ materia, elegido, onElegir }) {
  const { data } = useQuery({
    queryKey: ['cc-resultados', materia],
    queryFn: async () => {
      const [total, ...partes] = await Promise.all([
        contarResoluciones({ materia }),
        ...RESULTADOS.map(([r]) => contarResoluciones({ materia, resultado: r })),
      ]);
      return { total, partes };
    },
    staleTime: 3600e3,
  });
  if (!data?.total) return null;
  const otras = Math.max(0, data.total - data.partes.reduce((a, b) => a + b, 0));
  const tramos = [...RESULTADOS.map(([r, n, c], i) => [r, n, c, data.partes[i]]), [null, 'Otro', 'rgba(28,43,34,0.18)', otras]].filter((t) => t[3] > 0);
  return (
    <View style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', gap: 2 }}>
        {tramos.map(([r, n, c, k]) => (
          <Pressable
            key={n}
            disabled={!r}
            onPress={() => onElegir(r)}
            accessibilityRole="button"
            accessibilityLabel={`${n}: ${k}`}
            style={{ flex: k, backgroundColor: c, opacity: elegido && elegido !== r ? 0.3 : 1 }}
          />
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4, marginTop: 8 }}>
        {tramos.map(([r, n, c, k]) => (
          <Pressable key={n} disabled={!r} onPress={() => onElegir(r)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} />
            <Text style={{ fontSize: 12, color: elegido && elegido === r ? INK.title : INK.body, fontWeight: elegido && elegido === r ? '700' : '400' }}>
              {n} <Text style={{ color: INK.faint }}>{Math.round((k / data.total) * 100)}%</Text>
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── La lista ────────────────────────────────────────────────────────────────

/** Las resoluciones con esos filtros, de a 25, con «ver más» al pie. */
function Lista({ filtros, porMes = false, onAbrir }) {
  const clave = JSON.stringify(filtros);
  const q = useInfiniteQuery({
    queryKey: ['cc-resoluciones', clave],
    queryFn: ({ pageParam = 1 }) => traerResoluciones(filtros, pageParam),
    getNextPageParam: (ultima) => (ultima.page * ultima.limit < ultima.total ? ultima.page + 1 : undefined),
    staleTime: 600e3,
  });
  const filas = (q.data?.pages || []).flatMap((p) => p.data || []);
  const total = q.data?.pages?.[0]?.total;

  if (q.isLoading) return <Text style={{ fontSize: 13, color: INK.faint, paddingVertical: 20 }}>Trayendo las resoluciones…</Text>;
  if (q.error instanceof SinAcceso) return <Text style={{ fontSize: 13, color: INK.faint, paddingVertical: 20 }}>Esta sección está en Beta.</Text>;
  if (q.error) return <Text style={{ fontSize: 13, color: INK.faint, paddingVertical: 20 }}>No se pudo traer el observatorio.</Text>;
  if (!filas.length) return <Text style={{ fontSize: 13, color: INK.faint, paddingVertical: 20 }}>No hay resoluciones con eso.</Text>;

  let mesAntes = null;
  return (
    <View>
      {filas.map((r, i) => {
        const mes = String(r.fecha || '').slice(0, 7);
        const cabeza = porMes && mes !== mesAntes;
        mesAntes = mes;
        return (
          <View key={`${r.expediente}-${i}`}>
            {cabeza ? (
              <Text style={{ fontSize: 10, fontWeight: '800', color: INK.faint, letterSpacing: 1.2, marginTop: 18, marginBottom: 2 }}>
                {mesCorto(mes).toUpperCase()}
              </Text>
            ) : null}
            <Fila r={r} onPress={() => onAbrir(r)} />
          </View>
        );
      })}
      {q.hasNextPage ? (
        <Pressable onPress={() => q.fetchNextPage()} disabled={q.isFetchingNextPage} accessibilityRole="button" style={{ paddingVertical: 14 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: TINTA }}>
            {q.isFetchingNextPage ? 'Trayendo…' : `Ver más · ${filas.length} de ${total}`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Fila({ r, onPress }) {
  const quien = quienPidio(r);
  const contra = contraQuien(r);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({ flexDirection: 'row', gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: RAYA, opacity: pressed ? 0.6 : 1 })}
    >
      <IconoCC codigo={r.materia} size={40} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Rotulo>{[r.materia_etiqueta, r.via_etiqueta].filter(Boolean).join(' · ').toUpperCase()}</Rotulo>
          </View>
          <Text style={{ fontSize: 11, color: INK.faint }}>{r.expediente?.split(';')[0]}</Text>
        </View>
        <Titulo>{r.titulo}</Titulo>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
          <IconoCC codigo={r.resultado} size={22} />
          <Text style={{ fontSize: 12.5, fontWeight: '700', color: tonoDe(r.resultado) }}>{r.resultado_etiqueta}</Text>
          {r.tiene_cautelar || r.cautelar === 'OTORGADO' || r.cautelar === 'DECRETADA' ? (
            <Text style={{ fontSize: 11.5, color: INK.faint }}>· con amparo provisional</Text>
          ) : null}
        </View>
        {quien.texto || contra ? (
          <Text style={{ fontSize: 12, color: INK.faint, marginTop: 5, lineHeight: 17 }} numberOfLines={2}>
            {quien.texto ? <Text style={{ fontStyle: quien.reservado ? 'italic' : 'normal' }}>{quien.texto}</Text> : null}
            {contra ? ` contra ${contra}` : ''}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
