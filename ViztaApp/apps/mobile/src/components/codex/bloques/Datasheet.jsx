import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useStore } from 'zustand';
import { Database, Plus, RefreshCw } from 'lucide-react-native';
import { INK } from '../../theme';
import { MONO } from '../mono';
import { datasetDesdeTabla, datasheets, listarDatasets, textoDeCelda } from './datasheets';
import { useMedios } from './contexto';
import { roce, toque } from '../../../utils/haptics';

const CUERPO = 15;
const TENUE = 'rgba(28,43,34,0.38)';
const RAYA = 'rgba(28,43,34,0.12)';
const PAPEL_OSCURO = 'rgba(28,43,34,0.045)';
const ANCHO_CELDA = 132;
// Cuántas filas se pintan de entrada. Un dataset de cien filas en medio de
// una nota es una pared: se ve el principio y el resto se pide.
const PRIMERAS = 30;

/** Foco y desenfoque de una celda, avisados al editor (ver `Especiales`). */
const avisos = (editor, k, onSoltar, extra) => ({
  onFocus: () => editor.getState().enfocar(k),
  onBlur: () => {
    editor.getState().soltar(k);
    onSoltar?.(k);
    extra?.onBlur?.();
  },
});

/**
 * Un dataset de verdad en medio de la nota.
 *
 * A diferencia de la tabla simple, lo que se ve no vive en la nota: la nota
 * guarda solo cuál es (`dataset_id`) y las filas se leen de la base cada vez.
 * Editar una celda escribe en el dataset —el mismo que se ve en la pestaña de
 * datasets y en ThePulse—, así que solo se puede en los propios.
 */
export default function Datasheet({ k, b, editor, escribiendo, onSoltar }) {
  if (!b.dataset_id) {
    return <ElegirDataset k={k} editor={editor} escribiendo={escribiendo} onElegir={(id, nombre) => editor.getState().conectarDataset(k, id, nombre)} />;
  }
  return <TablaDeDataset k={k} id={b.dataset_id} nombre={b.nombre} editor={editor} escribiendo={escribiendo} onSoltar={onSoltar} />;
}

// ── Elegir ──────────────────────────────────────────────────────────────────

/**
 * Qué dataset va acá. Lo escrito busca entre los que hay y, si no coincide
 * con ninguno, es el nombre del nuevo.
 */
function ElegirDataset({ k, editor, escribiendo, onElegir }) {
  // El bloque recién puesto pide el foco: acá lo toma el buscador (autoFocus).
  const pedido = useStore(editor, (s) => (s.foco?.key === k ? s.foco : null));
  useEffect(() => {
    if (pedido) editor.getState().focoCumplido(pedido.n);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido?.n]);
  const [lista, setLista] = useState(null);
  const [error, setError] = useState(null);
  const [buscado, setBuscado] = useState('');
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    if (!escribiendo) return undefined;
    let vivo = true;
    listarDatasets()
      .then((l) => vivo && setLista(l))
      .catch(() => vivo && setError('No se pudieron traer los datasets.'));
    return () => {
      vivo = false;
    };
  }, [escribiendo]);

  const q = buscado.trim().toLowerCase();
  const visibles = useMemo(
    () => (lista || []).filter((d) => !q || d.nombre.toLowerCase().includes(q)).slice(0, 8),
    [lista, q],
  );

  const crear = async () => {
    setCreando(true);
    setError(null);
    try {
      const nombre = buscado.trim() || 'Tabla sin título';
      const id = await datasetDesdeTabla(nombre, [['Columna 1', 'Columna 2']]);
      toque();
      onElegir(id, nombre);
    } catch {
      setError('No se pudo crear el dataset.');
      setCreando(false);
    }
  };

  if (!escribiendo) {
    return (
      <View style={{ marginVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Database size={15} color={TENUE} />
        <Text style={{ fontFamily: MONO, fontSize: 13, color: TENUE }}>un dataset, por elegir</Text>
      </View>
    );
  }

  return (
    <View style={{ marginVertical: 6, padding: 12, borderRadius: 12, backgroundColor: PAPEL_OSCURO, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Database size={15} color={TENUE} />
        <TextInput
          value={buscado}
          onChangeText={setBuscado}
          placeholder="buscá un dataset o nombrá uno nuevo"
          placeholderTextColor="rgba(28,43,34,0.3)"
          autoFocus
          style={{ flex: 1, fontFamily: MONO, fontSize: 13, color: INK.title, padding: 0 }}
        />
      </View>
      {!lista && !error ? <ActivityIndicator size="small" color={TENUE} style={{ alignSelf: 'flex-start', marginVertical: 4 }} /> : null}
      {visibles.map((d) => (
        <Pressable
          key={d.id}
          onPress={() => {
            roce();
            onElegir(d.id, d.nombre);
          }}
          style={({ pressed }) => ({ flexDirection: 'row', gap: 8, paddingVertical: 6, opacity: pressed ? 0.5 : 1 })}
          accessibilityRole="button"
          accessibilityLabel={`Conectar ${d.nombre}`}
        >
          <Text style={{ flex: 1, fontFamily: MONO, fontSize: 13, color: INK.title }} numberOfLines={1}>
            {d.nombre}
          </Text>
          <Text style={{ fontFamily: MONO, fontSize: 11, color: TENUE }}>
            {d.filas} {d.filas === 1 ? 'fila' : 'filas'}
            {d.propio ? '' : ' · público'}
          </Text>
        </Pressable>
      ))}
      <Pressable
        onPress={crear}
        disabled={creando}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, opacity: pressed || creando ? 0.5 : 1 })}
        accessibilityRole="button"
      >
        <Plus size={14} color={INK.title} />
        <Text style={{ fontFamily: MONO, fontSize: 13, color: INK.title, fontWeight: '700' }}>
          {q ? `crear «${buscado.trim()}»` : 'uno nuevo'}
        </Text>
      </Pressable>
      {error ? <Text style={{ fontFamily: MONO, fontSize: 12, color: '#B5541C' }}>{error}</Text> : null}
    </View>
  );
}

// ── La tabla ────────────────────────────────────────────────────────────────

/**
 * La tabla de un dataset. Se usa en el bloque y, sin editar, en el panel de
 * una historia datasheet: ahí `onAbrirFila` hace que tocar una fila la abra
 * en la nota, y `filaAbierta` la marca.
 */
export function TablaDeDataset({ k, id, nombre, editor, escribiendo, onSoltar, onAbrirFila, filaAbierta }) {
  const { esHistoria, historiaDataset, usarComoHistoria } = useMedios();
  const entrada = useStore(datasheets, (s) => s.porId[id]);
  const datos = entrada?.datos;
  const [mostrar, setMostrar] = useState(PRIMERAS);
  const [editando, setEditando] = useState(null); // { fila, col, texto }
  const [columnaNueva, setColumnaNueva] = useState(null); // texto o null
  const [error, setError] = useState(null);

  // Se lee al aparecer, aunque ya esté en memoria: lo pudo haber cambiado
  // otra persona, u otra pestaña.
  useEffect(() => {
    datasheets.getState().cargar(id, { forzar: true });
  }, [id]);

  // Con el foco pedido (recién insertado o conectado), a escribir en la
  // primera celda.
  const pedido = useStore(editor, (s) => (k && s.foco?.key === k ? s.foco : null));
  useEffect(() => {
    if (!pedido) return;
    editor.getState().focoCumplido(pedido.n);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido?.n]);

  const puede = escribiendo && !!datos?.propio;
  const columnas = datos?.columnas || [];
  const filas = datos?.filas || [];
  const falla = (e) => setError(e?.message && !/[a-z]_[a-z]/.test(e.message) ? e.message : 'No se pudo guardar en el dataset.');

  const soltarCelda = () => {
    const e = editando;
    setEditando(null);
    if (!e) return;
    datasheets.getState().celda(id, e.fila, e.col, e.texto).catch(falla);
  };

  const opciones = (fila) => {
    if (!puede) return;
    toque();
    Alert.alert(datos?.nombre || 'Dataset', null, [
      { text: 'quitar fila', style: 'destructive', onPress: () => datasheets.getState().quitarFila(id, fila.id).catch(falla) },
      { text: 'cancelar', style: 'cancel' },
    ]);
  };

  const agregarFila = async () => {
    setError(null);
    try {
      const nueva = await datasheets.getState().filaNueva(id);
      setMostrar((m) => Math.max(m, filas.length + 1));
      if (columnas[0]) setEditando({ fila: nueva.id, col: columnas[0], texto: '' });
    } catch (e) {
      falla(e);
    }
  };

  const agregarColumna = async () => {
    const t = (columnaNueva || '').trim();
    setColumnaNueva(null);
    if (!t) return;
    setError(null);
    try {
      await datasheets.getState().columnaNueva(id, t);
    } catch (e) {
      falla(e);
    }
  };

  const titulo = datos?.nombre || nombre || 'Dataset';
  const estilo = { fontFamily: MONO, fontSize: CUERPO - 2, lineHeight: 20, color: INK.title, padding: 0 };

  return (
    <View style={{ marginVertical: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Database size={14} color={TENUE} />
        <Text style={{ flex: 1, fontFamily: MONO, fontSize: 12, color: 'rgba(28,43,34,0.62)', fontWeight: '700' }} numberOfLines={1}>
          {titulo}
        </Text>
        {datos ? (
          <Text style={{ fontFamily: MONO, fontSize: 11, color: TENUE }}>
            {datos.total} {datos.total === 1 ? 'fila' : 'filas'}
          </Text>
        ) : null}
        <Pressable
          onPress={() => {
            roce();
            setError(null);
            datasheets.getState().releer(id);
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Volver a leer el dataset"
        >
          {entrada?.cargando ? <ActivityIndicator size="small" color={TENUE} /> : <RefreshCw size={13} color={TENUE} />}
        </Pressable>
      </View>

      {!datos && entrada?.error ? <Text style={{ fontFamily: MONO, fontSize: 12, color: '#B5541C' }}>{entrada.error}</Text> : null}

      {datos ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={{ borderWidth: 1, borderColor: RAYA, borderRadius: 8, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', backgroundColor: PAPEL_OSCURO }}>
              {columnas.map((c, i) => (
                <View
                  key={c}
                  style={{ width: ANCHO_CELDA, paddingHorizontal: 8, paddingVertical: 8, borderRightWidth: i < columnas.length - 1 ? 1 : 0, borderColor: RAYA }}
                >
                  <Text style={[estilo, { fontWeight: '700' }]} numberOfLines={2}>
                    {c}
                  </Text>
                </View>
              ))}
              {puede ? (
                columnaNueva != null ? (
                  <View style={{ width: ANCHO_CELDA, paddingHorizontal: 8, paddingVertical: 8, borderLeftWidth: 1, borderColor: RAYA }}>
                    <TextInput
                      autoFocus
                      value={columnaNueva}
                      onChangeText={setColumnaNueva}
                      placeholder="nombre"
                      placeholderTextColor="rgba(28,43,34,0.3)"
                      submitBehavior="blurAndSubmit"
                      {...avisos(editor, k, onSoltar, { onBlur: agregarColumna })}
                      style={[estilo, { fontWeight: '700' }]}
                    />
                  </View>
                ) : (
                  <Pressable
                    onPress={() => setColumnaNueva('')}
                    hitSlop={6}
                    style={{ paddingHorizontal: 10, justifyContent: 'center' }}
                    accessibilityRole="button"
                    accessibilityLabel="Agregar columna"
                  >
                    <Plus size={14} color={TENUE} />
                  </Pressable>
                )
              ) : null}
            </View>

            {filas.slice(0, mostrar).map((fila) => (
              <View
                key={fila.id}
                style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: RAYA, backgroundColor: fila.id === filaAbierta ? 'rgba(75,79,166,0.07)' : 'transparent' }}
              >
                {columnas.map((c, i) => {
                  const esta = editando && editando.fila === fila.id && editando.col === c;
                  return (
                    <Pressable
                      key={c}
                      disabled={(!puede && !onAbrirFila) || esta}
                      onPress={() =>
                        puede
                          ? setEditando({ fila: fila.id, col: c, texto: textoDeCelda(fila.valores?.[c]) })
                          : onAbrirFila?.(fila.id)
                      }
                      onLongPress={() => opciones(fila)}
                      delayLongPress={380}
                      style={{ width: ANCHO_CELDA, minHeight: 36, paddingHorizontal: 8, paddingVertical: 8, borderRightWidth: i < columnas.length - 1 ? 1 : 0, borderColor: RAYA }}
                    >
                      {esta ? (
                        <TextInput
                          autoFocus
                          value={editando.texto}
                          multiline
                          scrollEnabled={false}
                          onChangeText={(t) => setEditando((e) => (e ? { ...e, texto: t } : e))}
                          submitBehavior="blurAndSubmit"
                          {...avisos(editor, k, onSoltar, { onBlur: soltarCelda })}
                          style={estilo}
                        />
                      ) : (
                        <Text style={estilo} numberOfLines={4}>
                          {textoDeCelda(fila.valores?.[c])}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      ) : !entrada?.error ? (
        <ActivityIndicator size="small" color={TENUE} style={{ alignSelf: 'flex-start', marginVertical: 8 }} />
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        {puede ? (
          <Pressable onPress={agregarFila} hitSlop={8} style={{ paddingVertical: 6 }} accessibilityRole="button" accessibilityLabel="Agregar fila">
            <Plus size={14} color={TENUE} />
          </Pressable>
        ) : null}
        {filas.length > mostrar ? (
          <Pressable onPress={() => setMostrar((m) => m + 200)} hitSlop={6} style={{ paddingVertical: 6 }} accessibilityRole="button">
            <Text style={{ fontFamily: MONO, fontSize: 12, color: TENUE }}>ver {Math.min(200, filas.length - mostrar)} más</Text>
          </Pressable>
        ) : null}
      </View>

      {/* En la nota principal de un espacio, este dataset puede ser la
          historia entera: cada fila, una entrada. */}
      {escribiendo && esHistoria && usarComoHistoria && historiaDataset !== id ? (
        <Pressable
          onPress={() => {
            toque();
            usarComoHistoria(id, titulo);
          }}
          hitSlop={6}
          style={({ pressed }) => ({ paddingVertical: 6, opacity: pressed ? 0.5 : 1, alignSelf: 'flex-start' })}
          accessibilityRole="button"
        >
          <Text style={{ fontFamily: MONO, fontSize: 12, color: 'rgba(75,79,166,0.85)' }}>usar como la historia</Text>
        </Pressable>
      ) : null}
      {escribiendo && datos && !datos.propio ? (
        <Text style={{ fontFamily: MONO, fontSize: 11.5, color: TENUE, marginTop: 2 }}>Este dataset es de otra persona: se lee, no se cambia.</Text>
      ) : null}
      {error ? <Text style={{ fontFamily: MONO, fontSize: 12, color: '#B5541C', marginTop: 2 }}>{error}</Text> : null}
    </View>
  );
}
