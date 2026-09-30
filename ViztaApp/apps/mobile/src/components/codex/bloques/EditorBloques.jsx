import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useStore } from 'zustand';
import { Check, ChevronLeft, GripVertical } from 'lucide-react-native';
import { INK } from '../../theme';
import { MONO } from '../mono';
import { contadorDeListas } from '../../../documento/aMarkdown';
import { conTexto, paginaMadre, raizDe, textoDe, visible } from '../../../documento/editor';
import Bloque, { CUERPO } from './Bloque';
import Especial from './Especiales';
import { MediosContexto } from './contexto';
import { roce, toque } from '../../../utils/haptics';

// Cuántos bloques se montan de una vez. Una nota de 5.000 palabras tiene unos
// cuatrocientos: montarlos todos juntos se nota al abrir. Se muestran los
// primeros enseguida —lo que entra en pantalla y un poco más— y el resto en
// los cuadros siguientes.
const PRIMEROS = 40;
const POR_CUADRO = 80;

// Doble toque: el mismo margen que la nota vieja.
const DOBLE_MS = 280;

const TENUE = 'rgba(28,43,34,0.38)';

/**
 * El cuerpo de la nota como bloques.
 *
 * Reemplaza al `TextInput` único de la nota cuando el interruptor
 * `editor_bloques` está prendido. Conserva sus reglas:
 *
 * - **Leer es el estado natural.** Mientras no se escribe, los campos no son
 *   editables y dos toques entran a escribir en el bloque tocado; en una nota
 *   vacía alcanza uno. Las casillas de los to-do, las flechas de los toggles
 *   y las páginas sí responden leyendo: marcar algo hecho no es escribir.
 * - **Salir de escribir** es soltar el foco sin que lo tome otro bloque:
 *   pasar de un bloque a otro no cuenta como salir.
 *
 * Y suma lo que el campo único no podía:
 *
 * - **Páginas.** Se muestra una a la vez; adentro de una subpágina, arriba
 *   va la vuelta a la de arriba y el título.
 * - **Seleccionar bloques.** Mantener apretado un bloque, leyendo, entra al
 *   modo: se eligen bloques, se arrastran de la manija, y la barra de abajo
 *   los sube, baja, copia o borra.
 *
 * Solo se vuelve a pintar entera cuando cambia la forma del documento
 * (`estructura`); al escribir se pinta el bloque tocado.
 */
function EditorBloques(
  { editor, rastreo, indice, escribiendo, onEscribir, buscando, marcador, onMencion, onDecidir, onSeleccion, medios, onAgregar },
  ref,
) {
  useStore(editor, (s) => s.estructura);
  const cargas = useStore(editor, (s) => s.cargas);
  const seleccionando = useStore(editor, (s) => s.seleccionando);
  const { estado } = editor.getState();
  const enRaiz = estado.pagina === raizDe(estado.resto);

  // Lo que se ve, en orden, con el número de cada renglón numerado. La
  // numeración se cuenta por grupo de hermanos, como en el markdown.
  const filas = useMemo(() => {
    const salida = [];
    const cuentas = new Map();
    for (const k of estado.orden) {
      if (!visible(estado, k)) continue;
      const padre = estado.padre[k] ?? null;
      if (!cuentas.has(padre)) cuentas.set(padre, contadorDeListas());
      const numero = cuentas.get(padre)(estado.porKey[k]);
      let nivel = 0;
      for (let p = estado.padre[k]; p; p = estado.padre[p]) nivel++;
      salida.push({ k, numero, nivel });
    }
    return salida;
  }, [estado]);

  // ── Montar de a poco ──
  const [cuantos, setCuantos] = useState(PRIMEROS);
  // Otra nota u otra página: se vuelve a empezar de a poco.
  useEffect(() => setCuantos(PRIMEROS), [cargas, estado.pagina]);
  useEffect(() => {
    if (cuantos >= filas.length) return undefined;
    const id = requestAnimationFrame(() => setCuantos((n) => n + POR_CUADRO));
    return () => cancelAnimationFrame(id);
  }, [cuantos, filas.length]);

  // ── Campos, para enfocar sin esperar un render ──
  const campos = useRef(new Map());
  const registrar = useCallback((k, c) => {
    campos.current.set(k, c);
    return () => {
      if (campos.current.get(k) === c) campos.current.delete(k);
    };
  }, []);

  // Dónde está cada fila, para arrastrar y para ir a un bloque desde el índice.
  const posiciones = useRef(new Map());

  // ── Salir de escribir ──
  const salida = useRef(null);
  const onSoltar = useCallback(() => {
    clearTimeout(salida.current);
    salida.current = setTimeout(() => {
      if (!editor.getState().enfocado) onEscribir?.(false);
    }, 120);
  }, [editor, onEscribir]);
  useEffect(() => () => clearTimeout(salida.current), []);

  // ── Entrar a escribir ──
  const vacio = filas.length <= 1 && !textoDe(estado.porKey[filas[0]?.k]?.children);
  const ultimoToque = useRef({ t: 0, k: null });
  const entrarEn = useRef(null);

  const tocarLeyendo = useCallback(
    (k) => {
      const ahora = Date.now();
      const doble = ahora - ultimoToque.current.t < DOBLE_MS;
      ultimoToque.current = doble ? { t: 0, k: null } : { t: ahora, k };
      if (!vacio && !doble) return;
      entrarEn.current = k;
      onEscribir?.();
    },
    [vacio, onEscribir],
  );

  /** El último bloque de texto que se ve. */
  const ultimoDeTexto = useCallback(() => {
    const { estado: e } = editor.getState();
    return [...e.orden].reverse().find((x) => conTexto(e.porKey[x]) && visible(e, x)) || null;
  }, [editor]);

  // Recién cuando los campos son editables se puede poner el cursor. Si se
  // entró a escribir sin tocar un bloque —el botón de nota nueva—, el cursor
  // va al final, como en el campo único.
  useEffect(() => {
    if (!escribiendo) return;
    const k = entrarEn.current || (!editor.getState().enfocado ? ultimoDeTexto() : null);
    entrarEn.current = null;
    if (!k) return;
    const b = editor.getState().estado.porKey[k];
    editor.getState().pedirFoco(k, textoDe(b?.children).length);
  }, [escribiendo, editor, ultimoDeTexto]);

  // Elegir bloques y escribir no van juntos.
  useEffect(() => {
    if (seleccionando && escribiendo) {
      const k = editor.getState().enfocado;
      if (k) campos.current.get(k)?.blur();
      onEscribir?.(false);
    }
  }, [seleccionando, escribiendo, editor, onEscribir]);

  /** El toque en el aire de abajo de la nota: escribir al final. */
  const tocarFinal = useCallback(() => {
    if (editor.getState().seleccionando) return;
    const k = ultimoDeTexto();
    if (!k) return;
    if (!escribiendo) {
      tocarLeyendo(k);
      return;
    }
    editor.getState().pedirFoco(k, textoDe(editor.getState().estado.porKey[k].children).length);
  }, [editor, escribiendo, tocarLeyendo, ultimoDeTexto]);

  /** Soltar el teclado desde afuera: cambiar de página, abrir otra nota. */
  const soltarFoco = useCallback(() => {
    const k = editor.getState().enfocado;
    if (k) campos.current.get(k)?.blur();
  }, [editor]);

  useImperativeHandle(
    ref,
    () => ({
      tocarFinal,
      soltarFoco,
      /** Dónde empieza un bloque, desde arriba del editor. */
      yDe: (k) => posiciones.current.get(k)?.y ?? null,
      abrirPagina: (k) => editor.getState().abrirPagina(k),
    }),
    [tocarFinal, soltarFoco, editor],
  );

  // ── Arrastrar ──
  /**
   * Se soltó una fila a `dy` puntos de donde estaba: va antes de la primera
   * fila cuyo centro quede por debajo. Si la fila arrastrada está elegida,
   * viaja con todas las elegidas.
   */
  const alSoltar = useCallback(
    (k, dy) => {
      const { seleccionados } = editor.getState();
      const keys = seleccionados.includes(k) ? seleccionados : [k];
      const p = posiciones.current.get(k);
      if (!p) return;
      const y = p.y + p.alto / 2 + dy;
      const destino = filas.find(({ k: x }) => {
        if (keys.includes(x)) return false;
        const q = posiciones.current.get(x);
        return q && q.y + q.alto / 2 > y;
      });
      toque();
      editor.getState().soltarSeleccionEn(keys, destino ? destino.k : null);
    },
    [editor, filas],
  );

  const entrarSeleccion = useCallback(
    (k) => {
      if (escribiendo) return;
      toque();
      editor.getState().entrarSeleccion(k);
    },
    [editor, escribiendo],
  );

  return (
    <MediosContexto.Provider value={medios || MEDIOS_VACIOS}>
      <GestureHandlerRootView style={{}}>
        {!enRaiz ? <EncabezadoPagina editor={editor} escribiendo={escribiendo} onEscribir={onEscribir} onSoltar={onSoltar} /> : null}
        {filas.slice(0, cuantos).map(({ k, numero, nivel }, i) => {
          const b = estado.porKey[k];
          return (
            <Fila
              key={k}
              k={k}
              editor={editor}
              posiciones={posiciones}
              escribiendo={escribiendo}
              onMantener={entrarSeleccion}
              onSoltarArrastre={alSoltar}
            >
              {conTexto(b) ? (
                <Bloque
                  k={k}
                  editor={editor}
                  rastreo={rastreo}
                  indice={indice}
                  numero={numero}
                  nivelVisual={nivel}
                  escribiendo={escribiendo && !seleccionando}
                  buscando={buscando}
                  marcador={i === 0 && vacio && enRaiz ? marcador : undefined}
                  onMencion={onMencion}
                  onDecidir={onDecidir}
                  onSeleccion={onSeleccion}
                  onSoltar={onSoltar}
                  onTocarLeyendo={tocarLeyendo}
                  onMantener={entrarSeleccion}
                  onAgregar={onAgregar}
                  registrar={registrar}
                />
              ) : (
                <Especial k={k} editor={editor} escribiendo={escribiendo && !seleccionando} nivel={nivel} onSoltar={onSoltar} />
              )}
            </Fila>
          );
        })}
      </GestureHandlerRootView>
    </MediosContexto.Provider>
  );
}

const MEDIOS_VACIOS = { fotos: [], audios: [], documentos: [] };

/**
 * Una fila de la lista: mide dónde está y, en el modo de elegir bloques,
 * se vuelve un renglón que se elige con un toque y se arrastra de la manija.
 */
const Fila = memo(function Fila({ k, editor, posiciones, escribiendo, onMantener, onSoltarArrastre, children }) {
  const seleccionando = useStore(editor, (s) => s.seleccionando);
  const elegido = useStore(editor, (s) => s.seleccionados.includes(k));
  // El bloque donde se está escribiendo muestra su manija: se puede mover
  // sin entrar al modo de elegir.
  const activo = useStore(editor, (s) => s.enfocado === k);
  const conManija = seleccionando || activo;
  const dy = useSharedValue(0);
  const [arrastrando, setArrastrando] = useState(false);

  const arrastre = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .onBegin(() => setArrastrando(true))
        .onUpdate((e) => {
          dy.value = e.translationY;
        })
        .onEnd((e) => onSoltarArrastre(k, e.translationY))
        .onFinalize(() => {
          dy.value = withSpring(0, { damping: 20, stiffness: 240 });
          setArrastrando(false);
        }),
    [k, dy, onSoltarArrastre],
  );
  const mover = useAnimatedStyle(() => ({ transform: [{ translateY: dy.value }] }));

  return (
    <Animated.View
      onLayout={(e) => posiciones.current.set(k, { y: e.nativeEvent.layout.y, alto: e.nativeEvent.layout.height })}
      style={[
        { flexDirection: 'row', alignItems: 'center' },
        arrastrando ? { zIndex: 10, opacity: 0.85 } : null,
        mover,
      ]}
    >
      {seleccionando ? (
        <View
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            marginRight: 10,
            borderWidth: 1.5,
            borderColor: elegido ? INK.title : 'rgba(28,43,34,0.3)',
            backgroundColor: elegido ? INK.title : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {elegido ? <Check size={11} color="#fff" strokeWidth={3} /> : null}
        </View>
      ) : null}

      <View style={{ flex: 1 }}>
        {seleccionando ? (
          <View>
            <View pointerEvents="none">{children}</View>
            <Pressable
              onPress={() => {
                roce();
                editor.getState().alternarSeleccion(k);
              }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: elegido }}
            />
          </View>
        ) : (
          // Leyendo, mantener apretado un bloque que no es texto también
          // entra al modo de elegir (los de texto lo hacen desde su campo).
          <Pressable disabled={escribiendo} onLongPress={() => onMantener(k)} delayLongPress={400}>
            {children}
          </Pressable>
        )}
      </View>

      {conManija ? (
        <GestureDetector gesture={arrastre}>
          <View style={{ paddingLeft: 10, paddingVertical: 6 }} accessibilityLabel="Arrastrar para mover">
            <GripVertical size={16} color={TENUE} />
          </View>
        </GestureDetector>
      ) : null}
    </Animated.View>
  );
});

/**
 * Arriba de una subpágina: volver a la de arriba y el título de esta.
 */
function EncabezadoPagina({ editor, escribiendo, onEscribir, onSoltar }) {
  const pagina = useStore(editor, (s) => s.estado.pagina);
  const titulo = useStore(editor, (s) => s.estado.resto.paginas.find((p) => p._key === s.estado.pagina)?.titulo ?? '');
  const madre = useStore(editor, (s) => {
    const doc = s.estado.resto;
    const m = paginaMadre(doc, s.estado.pagina);
    return !m || m._key === raizDe(doc) ? null : m.titulo || 'sin título';
  });
  const pedido = useStore(editor, (s) => (s.foco?.titulo ? s.foco : null));
  const campo = useRef(null);
  useEffect(() => {
    if (!pedido) return;
    // La página nueva se abre para escribir, empezando por su título.
    if (!escribiendo) onEscribir?.();
    setTimeout(() => campo.current?.focus(), 0);
    editor.getState().focoCumplido(pedido.n);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido?.n]);

  return (
    <View style={{ marginBottom: 14 }}>
      <Pressable
        onPress={() => {
          roce();
          editor.getState().volver();
        }}
        hitSlop={8}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10, opacity: pressed ? 0.5 : 1 })}
        accessibilityRole="button"
        accessibilityLabel={`Volver a ${madre || 'la nota'}`}
      >
        <ChevronLeft size={15} color={TENUE} />
        <Text style={{ fontFamily: MONO, fontSize: 12, color: TENUE }}>{madre || 'la nota'}</Text>
      </Pressable>
      <Pressable disabled={escribiendo} onPress={() => onEscribir?.()}>
        <View pointerEvents={escribiendo ? 'auto' : 'none'}>
          <TextInput
            ref={campo}
            editable={escribiendo}
            value={titulo}
            onChangeText={(t) => editor.getState().renombrarPagina(pagina, t)}
            onFocus={() => editor.getState().enfocar('titulo')}
            onBlur={() => {
              editor.getState().soltar('titulo');
              onSoltar?.();
            }}
            submitBehavior="blurAndSubmit"
            placeholder="sin título"
            placeholderTextColor="rgba(28,43,34,0.22)"
            style={{ fontFamily: MONO, fontSize: CUERPO + 6, lineHeight: 33, fontWeight: '700', color: INK.title, padding: 0 }}
          />
        </View>
      </Pressable>
    </View>
  );
}

export default memo(forwardRef(EditorBloques));

/** Para la hoja: si hay una subpágina abierta y cuál es la raíz. */
export const enSubpagina = (editor) => {
  const { estado } = editor.getState();
  return estado.pagina !== raizDe(estado.resto);
};
