import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { INK } from '../../components/theme';
import { COPY } from '../../components/congreso/copy';
import { listarResoluciones, TAMANO_PAGINA } from '../../components/cc/consultas';
import { SECCION, estilos } from '../../components/congreso/estilos';
import { anioActual, etiquetaTipoCc, fechaCorta, tituloLimpio } from '../../components/congreso/formateo';
import {
  CargarMas,
  Chip,
  ChipFiltro,
  Encabezado,
  EnlaceFuente,
  EstadoCaja,
} from '../../components/congreso/piezas';

const TINTA = SECCION.cc.tinta;
const LAVADO = SECCION.cc.lavado;
const BORDE = SECCION.cc.borde;

function rangoDe(clave) {
  const anio = anioActual();
  if (clave === 'este') return { desde: `${anio}-01-01`, hasta: `${anio}-12-31` };
  if (clave === 'anterior') return { desde: `${anio - 1}-01-01`, hasta: `${anio - 1}-12-31` };
  return { desde: '', hasta: '' };
}

export default function CC() {
  const insets = useSafeAreaInsets();
  const [busqueda, setBusqueda] = useState('');
  const [busquedaAplicada, setBusquedaAplicada] = useState('');
  const [tipo, setTipo] = useState('');
  const [fechaClave, setFechaClave] = useState('todas');
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState('');
  const [hayMas, setHayMas] = useState(true);
  const [detalle, setDetalle] = useState(null);

  const traer = useCallback(
    async (reset = true) => {
      if (reset) {
        setCargando(true);
        setError('');
      } else {
        setCargandoMas(true);
      }
      try {
        const { desde, hasta } = rangoDe(fechaClave);
        const pagina = await listarResoluciones({
          desde: reset ? 0 : items.length,
          busqueda: busquedaAplicada,
          tipo,
          fechaDesde: desde,
          fechaHasta: hasta,
        });
        setItems(reset ? pagina : [...items, ...pagina]);
        setHayMas(pagina.length >= TAMANO_PAGINA);
      } catch (e) {
        setError(e?.message || COPY.cc.error);
      } finally {
        setCargando(false);
        setCargandoMas(false);
      }
    },
    [busquedaAplicada, fechaClave, items, tipo]
  );

  useEffect(() => {
    const t = setTimeout(() => setBusquedaAplicada(busqueda.trim()), 280);
    return () => clearTimeout(t);
  }, [busqueda]);

  useEffect(() => {
    traer(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busquedaAplicada, tipo, fechaClave]);

  return (
    <View style={estilos.pantalla}>
      <StatusBar style="dark" />
      <ScrollView
        style={estilos.cuerpo}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 80 }}
        keyboardShouldPersistTaps="handled"
      >
        <Encabezado titulo={COPY.cc.titulo} bajada={COPY.cc.bajada} tinta={TINTA} />

        {detalle ? (
          <View style={estilos.detalleCaja}>
            <Pressable onPress={() => setDetalle(null)} hitSlop={10} style={{ marginBottom: 12 }}>
              <Text style={[estilos.enlaceTexto, { color: TINTA }]}>← {COPY.comun.volver}</Text>
            </Pressable>
            <View style={[estilos.chipsFila, { marginBottom: 8 }]}>
              {detalle.expediente ? (
                <Chip texto={detalle.expediente} tinta={TINTA} lavado={LAVADO} borde={BORDE} />
              ) : null}
              {detalle.tipo_decision ? (
                <Chip
                  texto={etiquetaTipoCc(detalle.tipo_decision)}
                  tinta={TINTA}
                  lavado={LAVADO}
                  borde={BORDE}
                />
              ) : null}
              {detalle.fecha ? (
                <Chip
                  texto={fechaCorta(detalle.fecha)}
                  tinta={INK.body}
                  lavado="rgba(28,43,34,0.05)"
                  borde="rgba(28,43,34,0.08)"
                />
              ) : null}
            </View>
            <Text style={estilos.detalleTitulo}>{tituloLimpio(detalle.titulo)}</Text>
            {detalle.resumen ? <Text style={estilos.filaCuerpo}>{detalle.resumen}</Text> : null}
            {detalle.criterio_juridico ? (
              <Text style={estilos.filaCuerpo}>{detalle.criterio_juridico}</Text>
            ) : null}
            {detalle.source_url ? (
              <EnlaceFuente url={detalle.source_url} texto={COPY.cc.verFuente} tinta={TINTA} />
            ) : (
              <Text style={[estilos.filaPie, { marginTop: 16 }]}>{COPY.cc.sinEnlace}</Text>
            )}
          </View>
        ) : (
          <>
            <TextInput
              value={busqueda}
              onChangeText={setBusqueda}
              placeholder={COPY.cc.buscar}
              placeholderTextColor={INK.faint}
              style={estilos.buscador}
              autoCorrect={false}
              autoCapitalize="none"
            />
            <View style={estilos.filtros}>
              <View style={estilos.chipsFila}>
                <ChipFiltro
                  texto={COPY.cc.todos}
                  activo={!tipo}
                  tinta={TINTA}
                  lavado={LAVADO}
                  onPress={() => setTipo('')}
                />
                <ChipFiltro
                  texto={COPY.cc.sentencia}
                  activo={tipo === 'SENTENCIA'}
                  tinta={TINTA}
                  lavado={LAVADO}
                  onPress={() => setTipo('SENTENCIA')}
                />
                <ChipFiltro
                  texto={COPY.cc.auto}
                  activo={tipo === 'AUTO'}
                  tinta={TINTA}
                  lavado={LAVADO}
                  onPress={() => setTipo('AUTO')}
                />
              </View>
              <View style={estilos.chipsFila}>
                <ChipFiltro
                  texto={COPY.cc.todas}
                  activo={fechaClave === 'todas'}
                  tinta={TINTA}
                  lavado={LAVADO}
                  onPress={() => setFechaClave('todas')}
                />
                <ChipFiltro
                  texto={COPY.cc.esteAnio}
                  activo={fechaClave === 'este'}
                  tinta={TINTA}
                  lavado={LAVADO}
                  onPress={() => setFechaClave('este')}
                />
                <ChipFiltro
                  texto={COPY.cc.anioAnterior}
                  activo={fechaClave === 'anterior'}
                  tinta={TINTA}
                  lavado={LAVADO}
                  onPress={() => setFechaClave('anterior')}
                />
              </View>
            </View>
            <View style={estilos.lista}>
              <EstadoCaja
                cargando={cargando}
                error={error ? COPY.cc.error : ''}
                vacio={!items.length ? COPY.cc.vacio : ''}
                onReintentar={() => traer(true)}
              >
                {items.map((item, i) => (
                  <Pressable
                    key={`${item.expediente}-${item.fecha}-${i}`}
                    onPress={() => setDetalle(item)}
                    style={({ pressed }) => [
                      estilos.fila,
                      i === items.length - 1 && estilos.filaUltima,
                      { opacity: pressed ? 0.65 : 1 },
                    ]}
                  >
                    <View style={estilos.filaMeta}>
                      {item.expediente ? (
                        <Text style={[estilos.etiqueta, { color: TINTA }]}>{item.expediente}</Text>
                      ) : null}
                      {item.tipo_decision ? (
                        <Chip
                          texto={etiquetaTipoCc(item.tipo_decision)}
                          tinta={TINTA}
                          lavado={LAVADO}
                          borde={BORDE}
                        />
                      ) : null}
                    </View>
                    <Text style={estilos.filaTitulo} numberOfLines={3}>
                      {tituloLimpio(item.titulo)}
                    </Text>
                    {item.resumen ? (
                      <Text style={estilos.filaCuerpo} numberOfLines={3}>
                        {item.resumen}
                      </Text>
                    ) : null}
                    <Text style={estilos.filaPie}>{fechaCorta(item.fecha)}</Text>
                  </Pressable>
                ))}
                <CargarMas visible={hayMas && !cargandoMas} onPress={() => traer(false)} />
              </EstadoCaja>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
