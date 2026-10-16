import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import SegmentedSlider from '../components/SegmentedSlider';
import { ACCENT, INK } from '../components/theme';
import { useEsBeta } from './acceso';
import { COPY } from './copy';
import {
  buscarDiputados,
  listarIniciativas,
  listarIniciativasSinNumero,
  listarVotaciones,
  listarVotosDe,
  TAMANO_PAGINA,
  votosDeDiputado,
} from './consultas';
import { SECCION, VOTO_COLOR, estilos } from './estilos';
import {
  etiquetaEstado,
  etiquetaResultado,
  etiquetaVoto,
  fechaCorta,
  claveVoto,
  tituloLimpio,
} from './formateo';
import {
  CargarMas,
  Chip,
  ConteoVotos,
  Encabezado,
  EnlaceFuente,
  EstadoCaja,
  PuertaBeta,
} from './piezas';

const TINTA = SECCION.congreso.tinta;
const LAVADO = SECCION.congreso.lavado;
const BORDE = SECCION.congreso.borde;
const APROBADA = ACCENT.green;

const TABS = [
  { id: 'iniciativas', label: COPY.congreso.iniciativas, accent: LAVADO, ink: TINTA },
  { id: 'votaciones', label: COPY.congreso.votaciones, accent: LAVADO, ink: TINTA },
  { id: 'diputados', label: COPY.congreso.diputados, accent: LAVADO, ink: TINTA },
];

function useLista(cargarPrimera) {
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState('');
  const [hayMas, setHayMas] = useState(true);
  const largo = useRef(0);
  largo.current = items.length;

  const cargar = useCallback(
    async (reset = true) => {
      if (reset) {
        setCargando(true);
        setError('');
      } else {
        setCargandoMas(true);
      }
      try {
        const desde = reset ? 0 : largo.current;
        const pagina = await cargarPrimera(desde);
        setItems((prev) => (reset ? pagina : [...prev, ...pagina]));
        setHayMas(pagina.length >= TAMANO_PAGINA);
      } catch (e) {
        setError(e?.message || COPY.congreso.error);
      } finally {
        setCargando(false);
        setCargandoMas(false);
      }
    },
    [cargarPrimera]
  );

  return { items, cargando, cargandoMas, error, hayMas, cargar };
}

function FilaIniciativa({ item, ultimo, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [estilos.fila, ultimo && estilos.filaUltima, { opacity: pressed ? 0.65 : 1 }]}
    >
      <View style={estilos.filaMeta}>
        {item.numero ? (
          <Text style={[estilos.etiqueta, { color: TINTA }]}>INICIATIVA {item.numero}</Text>
        ) : (
          <Chip texto={COPY.congreso.sinNumero} tinta={TINTA} lavado={LAVADO} borde={BORDE} />
        )}
        {item.estado_actual || item.estado ? (
          <Chip
            texto={etiquetaEstado(item.estado_actual || item.estado)}
            tinta={TINTA}
            lavado={LAVADO}
            borde={BORDE}
          />
        ) : null}
      </View>
      <Text style={estilos.filaTitulo}>{tituloLimpio(item.titulo)}</Text>
      {item.fecha_presentacion ? (
        <Text style={estilos.filaPie}>{fechaCorta(item.fecha_presentacion)}</Text>
      ) : null}
    </Pressable>
  );
}

function DetalleIniciativa({ item, onCerrar }) {
  const eventos = Array.isArray(item.eventos_timeline) ? [...item.eventos_timeline] : [];
  eventos.sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')));

  return (
    <View style={estilos.detalleCaja}>
      <Pressable onPress={onCerrar} hitSlop={10} style={{ marginBottom: 12 }}>
        <Text style={[estilos.enlaceTexto, { color: TINTA }]}>← {COPY.comun.volver}</Text>
      </Pressable>
      {item.numero ? (
        <Text style={[estilos.etiqueta, { color: TINTA, marginBottom: 8 }]}>INICIATIVA {item.numero}</Text>
      ) : null}
      <Text style={estilos.detalleTitulo}>{tituloLimpio(item.titulo)}</Text>
      <View style={[estilos.chipsFila, { marginBottom: 12 }]}>
        {item.estado_actual || item.estado ? (
          <Chip
            texto={etiquetaEstado(item.estado_actual || item.estado)}
            tinta={TINTA}
            lavado={LAVADO}
            borde={BORDE}
          />
        ) : null}
        {item.fecha_presentacion ? (
          <Chip texto={fechaCorta(item.fecha_presentacion)} tinta={INK.body} lavado="rgba(28,43,34,0.05)" borde="rgba(28,43,34,0.08)" />
        ) : null}
      </View>
      {eventos.map((evento, i) => (
        <View key={`${evento.tipo}-${evento.fecha}-${i}`} style={estilos.timelineItem}>
          <View>
            <View style={[estilos.timelinePunto, { backgroundColor: TINTA }]} />
            {i < eventos.length - 1 ? (
              <View style={[estilos.timelineLinea, { backgroundColor: BORDE }]} />
            ) : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[estilos.etiqueta, { color: TINTA }]}>{etiquetaEstado(evento.tipo)}</Text>
            {evento.fecha ? <Text style={estilos.filaPie}>{fechaCorta(evento.fecha)}</Text> : null}
            {evento.detalle?.resumen || evento.detalle?.objetivo ? (
              <Text style={estilos.filaCuerpo}>{evento.detalle.resumen || evento.detalle.objetivo}</Text>
            ) : null}
          </View>
        </View>
      ))}
      <EnlaceFuente url={item.url_ficha || item.noticia_url} texto={COPY.congreso.verFuente} tinta={TINTA} />
    </View>
  );
}

function FilaVotacion({ item, ultimo, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [estilos.fila, ultimo && estilos.filaUltima, { opacity: pressed ? 0.65 : 1 }]}
    >
      <View style={estilos.filaMeta}>
        <Chip
          texto={etiquetaResultado(item.resultado) || 'Votación'}
          tinta={item.resultado === 'aprobada' ? APROBADA.ink : TINTA}
          lavado={item.resultado === 'aprobada' ? APROBADA.tint : LAVADO}
          borde={item.resultado === 'aprobada' ? APROBADA.tint : BORDE}
        />
        {item.fecha ? <Text style={estilos.filaPie}>{fechaCorta(item.fecha)}</Text> : null}
      </View>
      <Text style={estilos.filaTituloSans}>{tituloLimpio(item.asunto)}</Text>
      {item.sesion ? <Text style={estilos.filaPie}>{item.sesion}</Text> : null}
      <ConteoVotos
        aFavor={item.a_favor}
        enContra={item.en_contra}
        ausentes={item.ausentes}
        licencia={item.licencia}
      />
    </Pressable>
  );
}

function DetalleVotacion({ item, onCerrar }) {
  const [votos, setVotos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState('todos');

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    listarVotosDe(item.id)
      .then((filas) => {
        if (vivo) setVotos(filas);
      })
      .catch((e) => {
        if (vivo) setError(e?.message || COPY.congreso.error);
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [item.id]);

  const visibles = useMemo(() => {
    if (filtro === 'todos') return votos;
    return votos.filter((v) => claveVoto(v.voto) === filtro);
  }, [votos, filtro]);

  return (
    <View style={estilos.detalleCaja}>
      <Pressable onPress={onCerrar} hitSlop={10} style={{ marginBottom: 12 }}>
        <Text style={[estilos.enlaceTexto, { color: TINTA }]}>← {COPY.comun.volver}</Text>
      </Pressable>
      <Text style={estilos.detalleTitulo}>{tituloLimpio(item.asunto)}</Text>
      <Text style={estilos.filaPie}>
        {[fechaCorta(item.fecha), item.sesion].filter(Boolean).join(' · ')}
      </Text>
      <ConteoVotos
        aFavor={item.a_favor}
        enContra={item.en_contra}
        ausentes={item.ausentes}
        licencia={item.licencia}
      />
      <EnlaceFuente url={item.url_acta} texto={COPY.congreso.verActa} tinta={TINTA} />

      <Text style={[estilos.etiqueta, { color: TINTA, marginTop: 22, marginBottom: 10 }]}>
        {COPY.congreso.votos}
      </Text>
      <EstadoCaja
        cargando={cargando}
        error={error}
        vacio={!cargando && !votos.length ? COPY.congreso.sinVotos : ''}
      >
        <View style={[estilos.chipsFila, { marginBottom: 8 }]}>
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'a_favor', label: 'A favor' },
            { id: 'en_contra', label: 'En contra' },
            { id: 'ausente', label: 'Ausentes' },
            { id: 'licencia', label: 'Licencia' },
          ].map((f) => (
            <Pressable key={f.id} onPress={() => setFiltro(f.id)}>
              <Chip
                texto={f.label}
                tinta={filtro === f.id ? TINTA : INK.body}
                lavado={filtro === f.id ? LAVADO : 'rgba(28,43,34,0.04)'}
                borde={filtro === f.id ? BORDE : 'rgba(28,43,34,0.08)'}
              />
            </Pressable>
          ))}
        </View>
        {visibles.map((voto, i) => {
          const clave = claveVoto(voto.voto);
          const tono = VOTO_COLOR[clave];
          return (
            <View key={voto.id || i} style={[estilos.fila, i === visibles.length - 1 && estilos.filaUltima]}>
              <Text style={estilos.filaTituloSans}>{voto.diputado}</Text>
              <Text style={estilos.filaPie}>
                {[voto.bloque, voto.distrito].filter(Boolean).join(' · ')}
              </Text>
              <View style={{ marginTop: 6 }}>
                <Chip texto={etiquetaVoto(voto.voto)} tinta={tono.ink} lavado={tono.tint} borde={tono.tint} />
              </View>
            </View>
          );
        })}
      </EstadoCaja>
    </View>
  );
}

function PanelIniciativas({ activo }) {
  const lista = useLista(listarIniciativas);
  const [sinNumero, setSinNumero] = useState([]);
  const [detalle, setDetalle] = useState(null);

  useEffect(() => {
    if (!activo) return;
    lista.cargar(true);
    listarIniciativasSinNumero()
      .then(setSinNumero)
      .catch(() => {});
    // Primera carga al entrar a la pestaña.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo]);

  if (detalle) return <DetalleIniciativa item={detalle} onCerrar={() => setDetalle(null)} />;

  return (
    <EstadoCaja
      cargando={lista.cargando}
      error={lista.error ? COPY.congreso.error : ''}
      vacio={!lista.items.length && !sinNumero.length ? COPY.congreso.vacioIniciativas : ''}
      onReintentar={() => lista.cargar(true)}
    >
      {sinNumero.length ? (
        <View style={{ marginBottom: 10 }}>
          <Text style={[estilos.etiqueta, { color: TINTA, marginBottom: 6 }]}>
            {COPY.congreso.sinNumero}
          </Text>
          {sinNumero.map((item, i) => (
            <FilaIniciativa
              key={item.id}
              item={item}
              ultimo={i === sinNumero.length - 1 && !lista.items.length}
              onPress={() => setDetalle(item)}
            />
          ))}
        </View>
      ) : null}
      {lista.items.map((item, i) => (
        <FilaIniciativa
          key={item.numero}
          item={item}
          ultimo={i === lista.items.length - 1}
          onPress={() => setDetalle(item)}
        />
      ))}
      <CargarMas visible={lista.hayMas && !lista.cargandoMas} onPress={() => lista.cargar(false)} />
    </EstadoCaja>
  );
}

function PanelVotaciones({ activo }) {
  const lista = useLista(listarVotaciones);
  const [detalle, setDetalle] = useState(null);

  useEffect(() => {
    if (!activo) return;
    lista.cargar(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo]);

  if (detalle) return <DetalleVotacion item={detalle} onCerrar={() => setDetalle(null)} />;

  return (
    <EstadoCaja
      cargando={lista.cargando}
      error={lista.error ? COPY.congreso.error : ''}
      vacio={!lista.items.length ? COPY.congreso.vacioVotaciones : ''}
      onReintentar={() => lista.cargar(true)}
    >
      {lista.items.map((item, i) => (
        <FilaVotacion
          key={item.id}
          item={item}
          ultimo={i === lista.items.length - 1}
          onPress={() => setDetalle(item)}
        />
      ))}
      <CargarMas visible={lista.hayMas && !lista.cargandoMas} onPress={() => lista.cargar(false)} />
    </EstadoCaja>
  );
}

function PanelDiputados({ activo }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [detalle, setDetalle] = useState(null);
  const [votos, setVotos] = useState([]);

  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    const t = setTimeout(() => {
      setCargando(true);
      setError('');
      buscarDiputados(q)
        .then((filas) => {
          if (vivo) setItems(filas);
        })
        .catch((e) => {
          if (vivo) setError(e?.message || COPY.congreso.error);
        })
        .finally(() => {
          if (vivo) setCargando(false);
        });
    }, 220);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [q, activo]);

  useEffect(() => {
    if (!detalle) {
      setVotos([]);
      return;
    }
    let vivo = true;
    votosDeDiputado(detalle.nombre)
      .then((filas) => {
        if (vivo) setVotos(filas);
      })
      .catch(() => {
        if (vivo) setVotos([]);
      });
    return () => {
      vivo = false;
    };
  }, [detalle]);

  if (detalle) {
    return (
      <View style={estilos.detalleCaja}>
        <Pressable onPress={() => setDetalle(null)} hitSlop={10} style={{ marginBottom: 12 }}>
          <Text style={[estilos.enlaceTexto, { color: TINTA }]}>← {COPY.comun.volver}</Text>
        </Pressable>
        <Text style={estilos.detalleTitulo}>{detalle.nombre}</Text>
        <Text style={estilos.filaPie}>
          {[detalle.bloque, detalle.distrito].filter(Boolean).join(' · ')}
        </Text>
        <Text style={[estilos.etiqueta, { color: TINTA, marginTop: 22, marginBottom: 8 }]}>
          {COPY.congreso.votos}
        </Text>
        {votos.length === 0 ? (
          <Text style={estilos.estadoTexto}>{COPY.congreso.sinVotos}</Text>
        ) : (
          votos.map((voto, i) => {
            const votacion = voto.votaciones || {};
            const tono = VOTO_COLOR[claveVoto(voto.voto)];
            return (
              <View key={voto.id || i} style={[estilos.fila, i === votos.length - 1 && estilos.filaUltima]}>
                <Text style={estilos.filaTituloSans}>{tituloLimpio(votacion.asunto)}</Text>
                <Text style={estilos.filaPie}>
                  {[fechaCorta(votacion.fecha), votacion.sesion].filter(Boolean).join(' · ')}
                </Text>
                <View style={{ marginTop: 6 }}>
                  <Chip texto={etiquetaVoto(voto.voto)} tinta={tono.ink} lavado={tono.tint} borde={tono.tint} />
                </View>
              </View>
            );
          })
        )}
      </View>
    );
  }

  return (
    <View>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder={COPY.congreso.buscarDiputado}
        placeholderTextColor={INK.faint}
        style={[estilos.buscador, { marginHorizontal: 0 }]}
        autoCorrect={false}
        autoCapitalize="words"
      />
      <EstadoCaja
        cargando={cargando}
        error={error ? COPY.congreso.error : ''}
        vacio={!cargando && !items.length ? COPY.congreso.vacioDiputados : ''}
      >
        {items.map((item, i) => (
          <Pressable
            key={item.id}
            onPress={() => setDetalle(item)}
            style={({ pressed }) => [estilos.fila, i === items.length - 1 && estilos.filaUltima, { opacity: pressed ? 0.65 : 1 }]}
          >
            <Text style={estilos.filaTituloSans}>{item.nombre}</Text>
            <Text style={estilos.filaPie}>
              {[item.bloque, item.distrito].filter(Boolean).join(' · ')}
            </Text>
          </Pressable>
        ))}
      </EstadoCaja>
    </View>
  );
}

export default function CongresoPantalla() {
  const insets = useSafeAreaInsets();
  const { autenticado, esBeta } = useEsBeta();
  const [tab, setTab] = useState('iniciativas');

  if (!esBeta) {
    return (
      <View style={[estilos.pantalla, { paddingTop: insets.top + 12 }]}>
        <StatusBar style="dark" />
        <Encabezado titulo={COPY.congreso.titulo} bajada={COPY.congreso.bajada} tinta={TINTA} />
        <PuertaBeta autenticado={autenticado} />
      </View>
    );
  }

  return (
    <View style={estilos.pantalla}>
      <StatusBar style="dark" />
      <ScrollView
        style={estilos.cuerpo}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 80 }}
        keyboardShouldPersistTaps="handled"
      >
        <Encabezado titulo={COPY.congreso.titulo} bajada={COPY.congreso.bajada} tinta={TINTA} />
        <View style={estilos.segmentos}>
          <SegmentedSlider tabs={TABS} valor={tab} onChange={setTab} />
        </View>
        <View style={estilos.lista}>
          {tab === 'iniciativas' ? <PanelIniciativas activo={tab === 'iniciativas'} /> : null}
          {tab === 'votaciones' ? <PanelVotaciones activo={tab === 'votaciones'} /> : null}
          {tab === 'diputados' ? <PanelDiputados activo={tab === 'diputados'} /> : null}
        </View>
      </ScrollView>
    </View>
  );
}
