import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { useStore } from 'zustand';
import { INK } from '../../theme';
import { MONO } from '../mono';
import { contadorDeListas } from '../../../documento/aMarkdown';
import { conTexto, textoDe, visible } from '../../../documento/editor';
import Bloque, { CUERPO } from './Bloque';

// Cuántos bloques se montan de una vez. Una nota de 5.000 palabras tiene unos
// cuatrocientos: montarlos todos juntos se nota al abrir. Se muestran los
// primeros enseguida —lo que entra en pantalla y un poco más— y el resto en
// los cuadros siguientes.
const PRIMEROS = 40;
const POR_CUADRO = 80;

// Doble toque: el mismo margen que la nota vieja.
const DOBLE_MS = 280;

/**
 * El cuerpo de la nota como bloques.
 *
 * Reemplaza al `TextInput` único de la nota cuando el interruptor
 * `editor_bloques` está prendido. Conserva sus reglas:
 *
 * - **Leer es el estado natural.** Mientras no se escribe, los campos no son
 *   editables y dos toques entran a escribir en el bloque tocado; en una nota
 *   vacía alcanza uno. Las casillas de los to-do y las flechas de los toggles
 *   sí responden leyendo: marcar algo hecho no es escribir.
 * - **Salir de escribir** es soltar el foco sin que lo tome otro bloque:
 *   pasar de un bloque a otro no cuenta como salir.
 *
 * Solo se vuelve a pintar entera cuando cambia la forma del documento
 * (`estructura`); al escribir se pinta el bloque tocado.
 */
function EditorBloques(
  { editor, rastreo, indice, escribiendo, onEscribir, buscando, marcador, onMencion, onDecidir, onSeleccion },
  ref,
) {
  useStore(editor, (s) => s.estructura);
  const { estado } = editor.getState();

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
  // Otra nota: se vuelve a empezar de a poco.
  useEffect(() => setCuantos(PRIMEROS), [estado.resto]);
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

  /** El toque en el aire de abajo de la nota: escribir al final. */
  const tocarFinal = useCallback(() => {
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

  useImperativeHandle(ref, () => ({ tocarFinal, soltarFoco }), [tocarFinal, soltarFoco]);

  return (
    <View>
      {filas.slice(0, cuantos).map(({ k, numero, nivel }, i) => {
        const b = estado.porKey[k];
        if (conTexto(b)) {
          return (
            <Bloque
              key={k}
              k={k}
              editor={editor}
              rastreo={rastreo}
              indice={indice}
              numero={numero}
              nivelVisual={nivel}
              escribiendo={escribiendo}
              buscando={buscando}
              marcador={i === 0 && vacio ? marcador : undefined}
              onMencion={onMencion}
              onDecidir={onDecidir}
              onSeleccion={onSeleccion}
              onSoltar={onSoltar}
              onTocarLeyendo={tocarLeyendo}
              registrar={registrar}
            />
          );
        }
        return <Especial key={k} k={k} editor={editor} escribiendo={escribiendo} nivel={nivel} onSoltar={onSoltar} />;
      })}
    </View>
  );
}

/**
 * Lo que no es texto corrido. En esta fase se muestra y se conserva; editarlo
 * de verdad (tablas, fórmulas, dibujo) llega con los bloques especiales. El
 * código sí se puede corregir: es texto.
 */
const Especial = memo(function Especial({ k, editor, escribiendo, nivel, onSoltar }) {
  const b = useStore(editor, (s) => s.estado.porKey[k]);
  if (!b) return null;
  const sangria = { marginLeft: nivel * 18 };

  switch (b._type) {
    case 'separador':
      return <View style={[sangria, { height: 1, backgroundColor: 'rgba(28,43,34,0.14)', marginVertical: 13 }]} />;
    case 'codigo':
      return (
        <View style={[sangria, { backgroundColor: 'rgba(28,43,34,0.05)', borderRadius: 8, padding: 10, marginVertical: 4 }]}>
          <TextInput
            editable={escribiendo}
            multiline
            scrollEnabled={false}
            value={b.texto}
            onChangeText={(t) => editor.getState().escribirCodigo(k, t)}
            // Cuenta como un bloque más: pasar de un párrafo al código no es
            // dejar de escribir.
            onFocus={() => editor.getState().enfocar(k)}
            onBlur={() => {
              editor.getState().soltar(k);
              onSoltar?.(k);
            }}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            style={{ fontFamily: MONO, fontSize: CUERPO - 2, lineHeight: 21, color: INK.title, padding: 0 }}
          />
        </View>
      );
    case 'tabla':
      // Como en `markdown.js`: una tabla en cuarenta caracteres no es una
      // tabla; las celdas separadas por un punto medio sí se leen.
      return (
        <View style={[sangria, { marginVertical: 4 }]}>
          {(b.filas || []).map((f, i) => (
            <Text
              key={i}
              style={{
                fontFamily: MONO,
                fontSize: CUERPO - 1,
                lineHeight: 24,
                color: INK.title,
                fontWeight: i === 0 && b.encabezado ? '700' : '400',
              }}
            >
              {f.filter(Boolean).join('  ·  ').replace(/\*\*|__|==|`/g, '')}
            </Text>
          ))}
        </View>
      );
    case 'formula':
      return (
        <Text style={[sangria, { fontFamily: MONO, fontSize: CUERPO, lineHeight: 27, color: INK.title }]}>{b.latex}</Text>
      );
    default:
      return null;
  }
});

export default memo(forwardRef(EditorBloques));
