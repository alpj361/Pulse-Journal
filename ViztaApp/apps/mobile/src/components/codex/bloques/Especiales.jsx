import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useStore } from 'zustand';
import { Image } from 'expo-image';
import { SvgXml } from 'react-native-svg';
import { Canvas, Path } from '@shopify/react-native-skia';
import { ChevronRight, FileText, Plus } from 'lucide-react-native';
import { INK } from '../../theme';
import { MONO } from '../mono';
import Audio from '../Audios';
import DocumentosNota from '../DocumentosNota';
import { leerEnLinea, textoDe } from '../../../documento';
import { LENGUAJES_A_MANO, resaltar } from './resaltarCodigo';
import { dibujarFormula } from './formula';
import { caminoDeTrazo } from './trazos';
import { useMedios } from './contexto';
import LienzoDibujo from './LienzoDibujo';
import Datasheet from './Datasheet';
import { datasetDesdeTabla } from './datasheets';
import { roce, toque } from '../../../utils/haptics';

const CUERPO = 15;
const TENUE = 'rgba(28,43,34,0.38)';
const PAPEL_OSCURO = 'rgba(28,43,34,0.045)';

/**
 * Los bloques que no son texto corrido.
 *
 * Cada uno se suscribe a su propio bloque, como los de texto. Los que tienen
 * un campo (código, fórmula, celdas) avisan foco y desenfoque al editor: pasar
 * de un párrafo a una celda no es dejar de escribir.
 */
function Especial({ k, editor, escribiendo, nivel = 0, onSoltar }) {
  const b = useStore(editor, (s) => s.estado.porKey[k]);
  if (!b) return null;
  const props = { k, b, editor, escribiendo, onSoltar };
  const contenido = (() => {
    switch (b._type) {
      case 'separador':
        return <View style={{ height: 1, backgroundColor: 'rgba(28,43,34,0.14)', marginVertical: 13 }} />;
      case 'codigo':
        return <Codigo {...props} />;
      case 'formula':
        return <Formula {...props} />;
      case 'tabla':
        return <Tabla {...props} />;
      case 'dibujo':
        return <Dibujo {...props} />;
      case 'medio':
        return <Medio b={b} />;
      case 'pagina':
        return <Pagina k={k} b={b} editor={editor} />;
      case 'datasheet':
        return <Datasheet {...props} />;
      default:
        return null;
    }
  })();
  return <View style={{ marginLeft: nivel * 18 }}>{contenido}</View>;
}

export default memo(Especial);

/** Foco y desenfoque de un campo adentro de un especial, avisados al editor. */
const avisos = (editor, k, onSoltar, extra) => ({
  onFocus: () => {
    editor.getState().enfocar(k);
    extra?.onFocus?.();
  },
  onBlur: () => {
    editor.getState().soltar(k);
    onSoltar?.(k);
    extra?.onBlur?.();
  },
});

// ── Código ──────────────────────────────────────────────────────────────────

/**
 * Monoespaciado, con su lenguaje, y coloreado **al salir** del bloque:
 * mientras se escribe se ve en un solo color.
 */
function Codigo({ k, b, editor, escribiendo, onSoltar }) {
  const [enfocado, setEnfocado] = useState(false);
  const [eligiendo, setEligiendo] = useState(false);
  const campo = useRef(null);
  const pedido = useStore(editor, (s) => (s.foco?.key === k ? s.foco : null));
  useEffect(() => {
    if (!pedido) return;
    campo.current?.focus();
    editor.getState().focoCumplido(pedido.n);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido?.n]);

  const colores = useMemo(() => (enfocado ? null : resaltar(b.texto, b.lenguaje)), [enfocado, b.texto, b.lenguaje]);

  return (
    <View style={{ backgroundColor: PAPEL_OSCURO, borderRadius: 8, padding: 10, marginVertical: 4 }}>
      <Pressable
        onPress={() => {
          roce();
          setEligiendo((v) => !v);
        }}
        hitSlop={8}
        style={{ alignSelf: 'flex-end', marginBottom: 4 }}
        accessibilityRole="button"
        accessibilityLabel="Elegir el lenguaje"
      >
        <Text style={{ fontFamily: MONO, fontSize: 10.5, color: TENUE }}>{b.lenguaje || 'código'}</Text>
      </Pressable>
      {eligiendo ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always" style={{ marginBottom: 6 }}>
          {LENGUAJES_A_MANO.map(([corto]) => (
            <Pressable
              key={corto}
              onPress={() => {
                roce();
                editor.getState().editarBloque(k, { lenguaje: corto === b.lenguaje ? '' : corto });
                setEligiendo(false);
              }}
              style={{
                paddingHorizontal: 9,
                paddingVertical: 4,
                marginRight: 6,
                borderRadius: 999,
                backgroundColor: corto === b.lenguaje ? INK.title : 'rgba(28,43,34,0.07)',
              }}
            >
              <Text style={{ fontFamily: MONO, fontSize: 11, color: corto === b.lenguaje ? '#fff' : INK.title }}>{corto}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      <TextInput
        ref={campo}
        editable={escribiendo}
        multiline
        scrollEnabled={false}
        onChangeText={(t) => editor.getState().escribirEspecial(k, { texto: t })}
        {...avisos(editor, k, onSoltar, { onFocus: () => setEnfocado(true), onBlur: () => setEnfocado(false) })}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        placeholder="código"
        placeholderTextColor={TENUE}
        style={{ fontFamily: MONO, fontSize: CUERPO - 2, lineHeight: 21, color: INK.title, padding: 0 }}
      >
        {colores
          ? colores.map((t, i) =>
              t.color ? (
                <Text key={i} style={{ color: t.color }}>
                  {t.texto}
                </Text>
              ) : (
                t.texto
              ),
            )
          : b.texto}
      </TextInput>
    </View>
  );
}

// ── Fórmula ─────────────────────────────────────────────────────────────────

/**
 * LaTeX mientras se escribe; al salir se pide el dibujo al servidor y se
 * guarda en el bloque. Sin dibujo —sin conexión, o el servidor todavía no lo
 * hace—, se ve el LaTeX tal cual.
 */
function Formula({ k, b, editor, escribiendo, onSoltar }) {
  const [editando, setEditando] = useState(!b.latex);
  const [aviso, setAviso] = useState(null);
  const [ancho, setAncho] = useState(0);
  const campo = useRef(null);
  const pedido = useStore(editor, (s) => (s.foco?.key === k ? s.foco : null));
  useEffect(() => {
    if (!pedido) return;
    setEditando(true);
    setTimeout(() => campo.current?.focus(), 0);
    editor.getState().focoCumplido(pedido.n);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido?.n]);

  // Pedir el dibujo cuando hay LaTeX sin dibujo (recién escrito, o de
  // una vez anterior en que el servidor no estaba).
  const pidiendo = useRef(null);
  const dibujar = async (latex) => {
    if (!latex.trim() || pidiendo.current === latex) return;
    pidiendo.current = latex;
    try {
      const r = await dibujarFormula(latex);
      // Si mientras tanto se cambió la fórmula, este dibujo ya no es suyo.
      if (editor.getState().estado.porKey[k]?.latex !== latex) return;
      editor.getState().editarBloque(k, { svg: r.svg, ancho: r.ancho, alto: r.alto });
      setAviso(null);
    } catch (e) {
      // Un error de escritura se dice; uno de conexión no: la fórmula se ve
      // como texto y se vuelve a pedir la próxima vez.
      setAviso(
        /error|brace|missing|undefined|extra|misplaced/i.test(e.message)
          ? 'Hay un error en la fórmula; se ve como texto hasta corregirlo.'
          : null,
      );
    } finally {
      pidiendo.current = null;
    }
  };

  const mostrarDibujo = !editando && b.svg;
  const escala = b.ancho && ancho ? Math.min(1, ancho / b.ancho) : 1;

  return (
    <View onLayout={(e) => setAncho(e.nativeEvent.layout.width)} style={{ marginVertical: 6 }}>
      {mostrarDibujo ? (
        <Pressable
          disabled={!escribiendo}
          onPress={() => {
            setEditando(true);
            setTimeout(() => campo.current?.focus(), 0);
          }}
          style={{ alignItems: 'center' }}
          accessibilityLabel={`Fórmula: ${b.latex}`}
        >
          <SvgXml xml={b.svg} width={(b.ancho || 100) * escala} height={(b.alto || 24) * escala} color={INK.title} />
        </Pressable>
      ) : (
        <View style={{ backgroundColor: PAPEL_OSCURO, borderRadius: 8, padding: 10 }}>
          <TextInput
            ref={campo}
            editable={escribiendo}
            value={b.latex}
            multiline
            scrollEnabled={false}
            onChangeText={(t) => editor.getState().escribirEspecial(k, { latex: t, svg: null, ancho: null, alto: null })}
            {...avisos(editor, k, onSoltar, {
              onBlur: () => {
                setEditando(false);
                dibujar(editor.getState().estado.porKey[k]?.latex || '');
              },
            })}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            placeholder="E = mc^2"
            placeholderTextColor={TENUE}
            style={{ fontFamily: MONO, fontSize: CUERPO - 1, lineHeight: 22, color: INK.title, padding: 0 }}
          />
        </View>
      )}
      {aviso ? <Text style={{ fontFamily: MONO, fontSize: 11, color: '#B5541C', marginTop: 4 }}>{aviso}</Text> : null}
      <DibujarAlAbrir b={b} dibujar={dibujar} />
    </View>
  );
}

/** Una fórmula guardada sin dibujo se pide al mostrarla, una vez. */
function DibujarAlAbrir({ b, dibujar }) {
  const hecho = useRef(false);
  useEffect(() => {
    if (hecho.current || b.svg || !b.latex) return;
    hecho.current = true;
    dibujar(b.latex);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

// ── Tabla ───────────────────────────────────────────────────────────────────

const ANCHO_CELDA = 116;

/**
 * Una grilla con scroll horizontal. Cada celda es texto hasta que se la
 * toca: una tabla de 20 × 10 no monta doscientos campos.
 */
function Tabla({ k, b, editor, escribiendo, onSoltar }) {
  const [editando, setEditando] = useState(null); // { f, c }
  const pedido = useStore(editor, (s) => (s.foco?.key === k ? s.foco : null));
  useEffect(() => {
    if (!pedido) return;
    setEditando({ f: 0, c: 0 });
    editor.getState().focoCumplido(pedido.n);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido?.n]);

  const filas = b.filas || [];
  const n = Math.max(1, ...filas.map((f) => f.length));

  const opciones = (f, c) => {
    if (!escribiendo) return;
    toque();
    Alert.alert('Tabla', null, [
      { text: 'quitar fila', onPress: () => editor.getState().quitarFila(k, f) },
      { text: 'quitar columna', onPress: () => editor.getState().quitarColumna(k, c) },
      { text: 'convertir en dataset', onPress: convertir },
      { text: 'cancelar', style: 'cancel' },
    ]);
  };

  /**
   * La tabla pasa a ser un dataset propio: la fila de encabezado da las
   * columnas y el resto, las filas. Se llama como el título más cercano de
   * arriba, que suele ser de qué trata la tabla.
   */
  const convertir = async () => {
    const { estado } = editor.getState();
    let nombre = '';
    for (let i = estado.orden.indexOf(k) - 1; i >= 0 && !nombre; i--) {
      const x = estado.porKey[estado.orden[i]];
      if (['h1', 'h2', 'h3'].includes(x?.style)) nombre = textoDe(x.children).trim();
    }
    try {
      const id = await datasetDesdeTabla(nombre || 'Tabla sin título', b.filas || [], { encabezado: b.encabezado !== false });
      toque();
      editor.getState().conectarDataset(k, id, nombre || 'Tabla sin título');
    } catch {
      Alert.alert('No se pudo convertir la tabla', 'Queda como estaba. Probá de nuevo en un rato.');
    }
  };

  return (
    <View style={{ marginVertical: 6 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View>
          {filas.map((fila, f) => (
            <View key={f} style={{ flexDirection: 'row' }}>
              {Array.from({ length: n }, (_, c) => {
                const texto = fila[c] ?? '';
                const esta = editando && editando.f === f && editando.c === c;
                const cabeza = f === 0 && b.encabezado;
                const estilo = {
                  fontFamily: MONO,
                  fontSize: CUERPO - 2,
                  lineHeight: 20,
                  color: INK.title,
                  fontWeight: cabeza ? '700' : '400',
                  padding: 0,
                };
                return (
                  <Pressable
                    key={c}
                    disabled={!escribiendo || esta}
                    onPress={() => setEditando({ f, c })}
                    onLongPress={() => opciones(f, c)}
                    style={{
                      width: ANCHO_CELDA,
                      minHeight: 36,
                      paddingHorizontal: 8,
                      paddingVertical: 8,
                      borderColor: 'rgba(28,43,34,0.12)',
                      borderRightWidth: c < n - 1 ? 1 : 0,
                      borderBottomWidth: f < filas.length - 1 ? 1 : 0,
                      backgroundColor: cabeza ? PAPEL_OSCURO : 'transparent',
                    }}
                  >
                    {esta ? (
                      <TextInput
                        autoFocus
                        value={texto}
                        multiline
                        scrollEnabled={false}
                        onChangeText={(t) => editor.getState().editarCelda(k, f, c, t)}
                        submitBehavior="submit"
                        onSubmitEditing={() => setEditando(c + 1 < n ? { f, c: c + 1 } : f + 1 < filas.length ? { f: f + 1, c: 0 } : null)}
                        {...avisos(editor, k, onSoltar, { onBlur: () => setEditando((e) => (e && e.f === f && e.c === c ? null : e)) })}
                        style={estilo}
                      />
                    ) : (
                      // Lo que se escribió con marcas de markdown se lee sin ellas.
                      <Text style={estilo}>{textoDe(leerEnLinea(texto).children)}</Text>
                    )}
                  </Pressable>
                );
              })}
              {f === 0 && escribiendo ? (
                <MasChico onPress={() => editor.getState().agregarColumna(k)} etiqueta="Agregar columna" />
              ) : null}
            </View>
          ))}
        </View>
      </ScrollView>
      {escribiendo ? <MasChico onPress={() => editor.getState().agregarFila(k)} etiqueta="Agregar fila" /> : null}
    </View>
  );
}

function MasChico({ onPress, etiqueta }) {
  return (
    <Pressable
      onPress={() => {
        roce();
        onPress();
      }}
      hitSlop={8}
      style={{ padding: 6, alignSelf: 'flex-start' }}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
    >
      <Plus size={14} color={TENUE} />
    </Pressable>
  );
}

// ── Dibujo ──────────────────────────────────────────────────────────────────

/** El dibujo guardado, del ancho de la nota. Tocarlo abre el lienzo. */
function Dibujo({ k, b, editor, escribiendo }) {
  const [ancho, setAncho] = useState(0);
  const [abierto, setAbierto] = useState(false);
  const pedido = useStore(editor, (s) => (s.foco?.key === k ? s.foco : null));
  useEffect(() => {
    if (!pedido) return;
    setAbierto(true);
    editor.getState().focoCumplido(pedido.n);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido?.n]);

  const alto = ancho * (b.alto || 0.6);
  const caminos = useMemo(
    () => (ancho ? (b.trazos || []).map((t) => ({ d: caminoDeTrazo(t, ancho), color: t.color || INK.title })) : []),
    [b.trazos, ancho],
  );

  return (
    <View onLayout={(e) => setAncho(e.nativeEvent.layout.width)} style={{ marginVertical: 6 }}>
      <Pressable
        disabled={!escribiendo}
        onPress={() => setAbierto(true)}
        style={{ height: alto || 120, borderRadius: 10, backgroundColor: PAPEL_OSCURO, overflow: 'hidden' }}
        accessibilityRole="button"
        accessibilityLabel={b.trazos?.length ? 'Dibujo' : 'Dibujar'}
      >
        {ancho ? (
          <Canvas style={{ width: ancho, height: alto }}>
            {caminos.map((c, i) => (
              <Path key={i} path={c.d} color={c.color} />
            ))}
          </Canvas>
        ) : null}
        {!b.trazos?.length && escribiendo ? (
          <Text style={{ position: 'absolute', alignSelf: 'center', top: '42%', fontFamily: MONO, fontSize: 12, color: TENUE }}>
            dibujar
          </Text>
        ) : null}
      </Pressable>
      {abierto ? (
        <LienzoDibujo
          trazos={b.trazos || []}
          proporcion={b.alto || 0.6}
          onListo={(trazos) => {
            setAbierto(false);
            editor.getState().editarBloque(k, { trazos });
          }}
          onCerrar={() => setAbierto(false)}
        />
      ) : null}
    </View>
  );
}

// ── Medios ──────────────────────────────────────────────────────────────────

/**
 * Una foto, un audio o un documento en medio del texto. Lo adjunto se sigue
 * manejando en la hoja; acá se muestra en su lugar.
 */
function Medio({ b }) {
  const { fotos, audios, documentos, onVerFoto, onAbrirDocumento } = useMedios();
  const es = (x) => x && ((b.storage_path && x.storage_path === b.storage_path) || (b.ref && (x.id === b.ref || x.clave === b.ref)));

  if (b.tipo === 'foto') {
    const f = fotos.find(es);
    if (!f) return null;
    const proporcion = f.ancho && f.alto ? f.alto / f.ancho : 0.75;
    return (
      <Pressable onPress={() => onVerFoto?.(f)} style={{ marginVertical: 8 }} accessibilityRole="imagebutton" accessibilityLabel="Ver la foto">
        <Image
          source={{ uri: f.url || f.local }}
          style={{ width: '100%', aspectRatio: 1 / proporcion, borderRadius: 10, opacity: f.subiendo ? 0.6 : 1 }}
          contentFit="cover"
          transition={150}
        />
      </Pressable>
    );
  }
  if (b.tipo === 'audio') {
    const a = audios.find(es);
    return a ? (
      <View style={{ marginVertical: 6 }}>
        <Audio audio={a} />
      </View>
    ) : null;
  }
  if (b.tipo === 'documento') {
    const d = documentos.find(es);
    return d ? <DocumentosNota documentos={[d]} onAbrir={onAbrirDocumento} /> : null;
  }
  return null;
}

// ── Página ──────────────────────────────────────────────────────────────────

/** El renglón que abre una subpágina: su título y una flecha. */
function Pagina({ k, b, editor }) {
  const titulo = useStore(editor, (s) => s.estado.resto.paginas.find((p) => p._key === b.pagina)?.titulo);
  return (
    <Pressable
      onPress={() => {
        roce();
        editor.getState().abrirPagina(b.pagina);
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 8,
        opacity: pressed ? 0.55 : 1,
      })}
      accessibilityRole="button"
      accessibilityLabel={`Abrir ${titulo || 'la página'}`}
    >
      <FileText size={16} color="rgba(28,43,34,0.55)" />
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          fontFamily: MONO,
          fontSize: CUERPO,
          lineHeight: 27,
          color: titulo ? INK.title : TENUE,
          textDecorationLine: 'underline',
          textDecorationColor: 'rgba(28,43,34,0.18)',
        }}
      >
        {titulo || 'sin título'}
      </Text>
      <ChevronRight size={15} color={TENUE} />
    </Pressable>
  );
}
