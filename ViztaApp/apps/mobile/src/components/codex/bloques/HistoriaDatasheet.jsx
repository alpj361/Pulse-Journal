import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from 'react-native';
import { useStore } from 'zustand';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react-native';
import { INK } from '../../theme';
import { MONO } from '../mono';
import { datasheets, textoDeCelda } from './datasheets';
import { roce, toque } from '../../../utils/haptics';

const TENUE = 'rgba(28,43,34,0.38)';
const ETIQUETA = { fontFamily: MONO, fontSize: 11.5, color: 'rgba(28,43,34,0.36)' };

/**
 * La historia como datasheet, en las tres vistas de la hoja:
 *
 * - **nota** (`FilaDeHistoria`): la fila abierta, como una ficha. El título es
 *   la columna que titula; el resto, un campo por columna.
 * - **historial** (`FilasDeHistoria`): las filas, una por renglón, para ir a
 *   cualquiera.
 * - **panel**: la tabla entera (`TablaDeDataset` en `Datasheet.jsx`).
 *
 * Lo que se escribe va al dataset —no a la nota— al soltar cada campo.
 */

/** La columna que titula: la elegida si existe, si no la primera. */
export const columnaTitulo = (datos, elegida) =>
  datos?.columnas?.includes(elegida) ? elegida : datos?.columnas?.[0] || null;

/** Lo que muestra una fila como título, con un nombre de repuesto. */
export const tituloDeFila = (fila, col, i) => textoDeCelda(fila?.valores?.[col]).trim() || `Fila ${i + 1}`;

export function useDatasetDeHistoria(id) {
  const entrada = useStore(datasheets, (s) => (id ? s.porId[id] : null));
  useEffect(() => {
    if (id) datasheets.getState().cargar(id);
  }, [id]);
  return entrada;
}

// ── Nota ────────────────────────────────────────────────────────────────────

export function FilaDeHistoria({ historia, filaId, onFila, onTitulo }) {
  const entrada = useDatasetDeHistoria(historia.dataset_id);
  const datos = entrada?.datos;
  const filas = datos?.filas || [];
  const i = Math.max(0, filas.findIndex((f) => f.id === filaId));
  const fila = filas[i];
  const col = columnaTitulo(datos, historia.titulo);
  const puede = !!datos?.propio;
  const [error, setError] = useState(null);

  // Sin fila elegida (o la elegida ya no está), la primera.
  useEffect(() => {
    if (fila && fila.id !== filaId) onFila(fila.id);
  }, [fila, filaId, onFila]);

  const guardar = (c, valor) =>
    datasheets
      .getState()
      .celda(historia.dataset_id, fila.id, c, valor)
      .then(() => setError(null))
      .catch(() => setError('No se pudo guardar en el dataset. Lo que ves es lo que tiene la base.'));

  const nueva = async () => {
    try {
      const f = await datasheets.getState().filaNueva(historia.dataset_id);
      toque();
      onFila(f.id);
    } catch {
      setError('No se pudo agregar la fila.');
    }
  };

  const elegirTitulo = (c) => {
    if (c === col) return;
    toque();
    Alert.alert(`«${c}» como título`, 'Cada entrada de la historia se va a llamar por esta columna.', [
      { text: 'cancelar', style: 'cancel' },
      { text: 'usar', onPress: () => onTitulo(c) },
    ]);
  };

  if (!datos) {
    return entrada?.error ? (
      <Text style={{ fontFamily: MONO, fontSize: 13, color: '#B5541C' }}>{entrada.error}</Text>
    ) : (
      <ActivityIndicator size="small" color={TENUE} style={{ alignSelf: 'flex-start', marginVertical: 12 }} />
    );
  }

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 18 }}>
        <Flecha Icono={ChevronLeft} etiqueta="Fila anterior" activo={i > 0} onPress={() => onFila(filas[i - 1].id)} />
        <Text style={{ fontFamily: MONO, fontSize: 12, color: TENUE }}>
          {filas.length ? `${i + 1} de ${filas.length}` : 'sin filas'}
        </Text>
        <Flecha Icono={ChevronRight} etiqueta="Fila siguiente" activo={i < filas.length - 1} onPress={() => onFila(filas[i + 1].id)} />
        <View style={{ flex: 1 }} />
        <Text style={{ fontFamily: MONO, fontSize: 11.5, color: TENUE, maxWidth: 170 }} numberOfLines={1}>
          {datos.nombre}
        </Text>
        {puede ? (
          <Pressable onPress={nueva} hitSlop={8} style={{ paddingLeft: 6 }} accessibilityRole="button" accessibilityLabel="Agregar una entrada">
            <Plus size={16} color={INK.title} />
          </Pressable>
        ) : null}
      </View>

      {fila ? (
        <View key={fila.id}>
          <Campo
            valor={textoDeCelda(fila.valores?.[col])}
            puede={puede}
            onGuardar={(v) => guardar(col, v)}
            marcador={`Fila ${i + 1}`}
            estilo={{ fontSize: 21, lineHeight: 29, fontWeight: '700' }}
          />
          {datos.columnas
            .filter((c) => c !== col)
            .map((c) => (
              <View key={c} style={{ marginTop: 18 }}>
                <Pressable onLongPress={() => elegirTitulo(c)} delayLongPress={380} hitSlop={4}>
                  <Text style={ETIQUETA}>{c.toLowerCase()}</Text>
                </Pressable>
                <Campo valor={textoDeCelda(fila.valores?.[c])} puede={puede} onGuardar={(v) => guardar(c, v)} marcador="—" />
              </View>
            ))}
        </View>
      ) : (
        <Text style={{ fontFamily: MONO, fontSize: 13, color: TENUE, lineHeight: 20 }}>
          {puede ? 'La historia todavía no tiene entradas. Con + sumás la primera.' : 'La historia todavía no tiene entradas.'}
        </Text>
      )}

      {!puede ? (
        <Text style={{ fontFamily: MONO, fontSize: 11.5, color: TENUE, marginTop: 22 }}>Este dataset es de otra persona: se lee, no se cambia.</Text>
      ) : null}
      {error ? <Text style={{ fontFamily: MONO, fontSize: 12, color: '#B5541C', marginTop: 12 }}>{error}</Text> : null}
    </View>
  );
}

/**
 * Un campo de la fila. Lo escrito se queda en el campo mientras se escribe y
 * va al dataset al soltarlo: una escritura por campo, no por tecla.
 */
function Campo({ valor, puede, onGuardar, marcador, estilo }) {
  const [texto, setTexto] = useState(valor);
  const [enfocado, setEnfocado] = useState(false);
  // Lo que llega de la base (otra fila, o una relectura) pisa lo local
  // solo si no se está escribiendo.
  useEffect(() => {
    if (!enfocado) setTexto(valor);
  }, [valor, enfocado]);

  return (
    <TextInput
      value={texto}
      editable={puede}
      multiline
      scrollEnabled={false}
      onChangeText={setTexto}
      onFocus={() => setEnfocado(true)}
      onBlur={() => {
        setEnfocado(false);
        if (texto !== valor) onGuardar(texto);
      }}
      placeholder={marcador}
      placeholderTextColor="rgba(28,43,34,0.22)"
      style={[{ fontFamily: MONO, fontSize: 15, lineHeight: 24, color: INK.title, padding: 0, marginTop: 4 }, estilo]}
    />
  );
}

function Flecha({ Icono, etiqueta, activo, onPress }) {
  return (
    <Pressable
      onPress={() => {
        roce();
        onPress();
      }}
      disabled={!activo}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
    >
      <Icono size={16} color={activo ? INK.title : 'rgba(28,43,34,0.2)'} />
    </Pressable>
  );
}

// ── Historial ───────────────────────────────────────────────────────────────

/** Las entradas de la historia, antes de las notas del historial. */
export function FilasDeHistoria({ historia, filaId, onAbrir }) {
  const entrada = useDatasetDeHistoria(historia.dataset_id);
  const datos = entrada?.datos;
  const col = columnaTitulo(datos, historia.titulo);
  const filas = useMemo(() => (datos?.filas || []).slice(0, 200), [datos]);

  return (
    <View style={{ marginBottom: 34 }}>
      <Text style={ETIQUETA}>{(datos?.nombre || historia.nombre || 'la historia').toLowerCase()}</Text>
      {!datos ? <ActivityIndicator size="small" color={TENUE} style={{ alignSelf: 'flex-start', marginTop: 12 }} /> : null}
      {filas.map((f, i) => (
        <Pressable
          key={f.id}
          onPress={() => {
            roce();
            onAbrir(f.id);
          }}
          style={({ pressed }) => ({ flexDirection: 'row', gap: 10, paddingVertical: 7, opacity: pressed ? 0.5 : 1 })}
          accessibilityRole="button"
        >
          <Text style={{ fontFamily: MONO, fontSize: 11.5, lineHeight: 20, color: 'rgba(75,79,166,0.45)', width: 22 }}>{i + 1}</Text>
          <Text
            style={{ flex: 1, fontFamily: MONO, fontSize: 14, lineHeight: 20, color: INK.title, fontWeight: f.id === filaId ? '700' : '400' }}
            numberOfLines={1}
          >
            {tituloDeFila(f, col, i)}
          </Text>
        </Pressable>
      ))}
      {datos && datos.filas.length > filas.length ? (
        <Text style={{ fontFamily: MONO, fontSize: 12, color: TENUE, marginTop: 6 }}>y {datos.filas.length - filas.length} más en el panel</Text>
      ) : null}
    </View>
  );
}
