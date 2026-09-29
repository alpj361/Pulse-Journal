import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useStore } from 'zustand';
import { Check, ChevronRight } from 'lucide-react-native';
import { INK } from '../../theme';
import { MONO } from '../mono';
import { colorDe, tinta } from '../tinta';
import { textoDe, tipoDe } from '../../../documento/editor';
import { anotar, lugaresDe, memoriaNueva, mencionEnTramos, piezas, tramosDeBloque } from './rastreo';
import { roce, toque } from '../../../utils/haptics';

export const CUERPO = 15;
const RENGLON = 27;
const SANGRIA = 18;
const PASO_MS = 60;

/**
 * El tamaño de cada estilo, desde el del cuerpo: cambiar la tipografía de la
 * hoja no deja los títulos sueltos. Son los mismos saltos que `estiloDePieza`
 * en `formato.js`, más uno para el título chico.
 */
function estiloDeBloque(tipo) {
  switch (tipo) {
    case 'h1':
      return { fontSize: CUERPO + 6, lineHeight: RENGLON + 6, fontWeight: '700' };
    case 'h2':
      return { fontSize: CUERPO + 2.5, lineHeight: RENGLON + 3, fontWeight: '700' };
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return { fontSize: CUERPO + 1, lineHeight: RENGLON + 1, fontWeight: '700' };
    case 'cita':
      return { color: 'rgba(28,43,34,0.72)' };
    default:
      return null;
  }
}

/** El estilo de una pieza: sus marcas y, si es un nombre, su color. */
function estiloDePieza(p, defs) {
  const e = {};
  const lineas = [];
  for (const m of p.marcas) {
    if (m === 'strong') e.fontWeight = '700';
    else if (m === 'em') e.fontStyle = 'italic';
    else if (m === 'code') e.backgroundColor = 'rgba(28,43,34,0.06)';
    else if (m === 'strike') lineas.push('line-through');
    else if (m === 'underline') lineas.push('underline');
    else {
      const d = defs.get(m);
      if (d?._type === 'resaltado') e.backgroundColor = `${d.color || '#F5C842'}61`;
      else if (d?._type === 'link') {
        e.color = '#4B4FA6';
        lineas.push('underline');
      }
    }
  }
  if (lineas.length) e.textDecorationLine = [...new Set(lineas)].join(' ');

  const m = p.mencion;
  if (m?.item) {
    const presencia = (m.estado === 'dudosa' ? 0.55 : 1) * (m.alfa ?? 1);
    e.color = tinta(colorDe(m.item), presencia);
    // Dudosa: el color apagado y un subrayado de puntos. Se ve que es un
    // nombre, y que falta decir si es ese.
    if (m.estado === 'dudosa') {
      e.textDecorationLine = 'underline';
      e.textDecorationStyle = 'dotted';
      e.textDecorationColor = tinta(colorDe(m.item), 0.55 * (m.alfa ?? 1));
    }
  }
  return e;
}

/** Lo que va a la izquierda del texto: viñeta, número, casilla, flecha. */
function Marcador({ b, tipo, numero, onHecho, onAbierto }) {
  const nivel = b.level || 1;
  const base = { width: SANGRIA + 4, height: RENGLON, justifyContent: 'center' };
  if (tipo === 'bullet') {
    return (
      <View style={base}>
        <Text style={{ fontFamily: MONO, fontSize: CUERPO, color: 'rgba(28,43,34,0.55)' }}>
          {['•', '◦', '▪'][(nivel - 1) % 3]}
        </Text>
      </View>
    );
  }
  if (tipo === 'number') {
    return (
      <View style={[base, { width: undefined, minWidth: SANGRIA + 4, paddingRight: 6 }]}>
        <Text style={{ fontFamily: MONO, fontSize: CUERPO, color: 'rgba(28,43,34,0.55)' }}>{numero}.</Text>
      </View>
    );
  }
  if (tipo === 'todo') {
    return (
      <Pressable
        onPress={onHecho}
        hitSlop={8}
        style={base}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: !!b.hecho }}
        accessibilityLabel={b.hecho ? 'hecho' : 'por hacer'}
      >
        <View
          style={{
            width: 15,
            height: 15,
            borderRadius: 4,
            borderWidth: 1.5,
            borderColor: b.hecho ? INK.title : 'rgba(28,43,34,0.35)',
            backgroundColor: b.hecho ? INK.title : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {b.hecho ? <Check size={11} color="#fff" strokeWidth={3} /> : null}
        </View>
      </Pressable>
    );
  }
  if (tipo === 'toggle') {
    const abierto = b.abierto !== false;
    return (
      <Pressable
        onPress={onAbierto}
        hitSlop={8}
        style={base}
        accessibilityRole="button"
        accessibilityState={{ expanded: abierto }}
        accessibilityLabel={abierto ? 'plegar' : 'desplegar'}
      >
        <View style={{ transform: [{ rotate: abierto ? '90deg' : '0deg' }] }}>
          <ChevronRight size={15} color="rgba(28,43,34,0.55)" strokeWidth={2.2} />
        </View>
      </Pressable>
    );
  }
  if (tipo === 'cita') {
    return <View style={{ width: 2, marginRight: 12, marginVertical: 4, borderRadius: 1, backgroundColor: 'rgba(28,43,34,0.22)' }} />;
  }
  return null;
}

/**
 * Un bloque de texto: su marcador y su `TextInput`.
 *
 * El texto va como hijos del campo y no como `value`, igual que en la nota
 * vieja: es la única forma de pintar pedazos con estilo propio adentro de un
 * campo editable. La diferencia es que acá los hijos no llevan marcadores: el
 * formato viene de los spans, y la concatenación de las piezas es el texto
 * tal cual.
 *
 * Se suscribe solo a su propio bloque y a lo que la base dijo de él: al
 * escribir se vuelve a pintar este bloque, no la nota.
 */
function Bloque({
  k,
  editor,
  rastreo,
  indice,
  numero,
  nivelVisual,
  escribiendo,
  buscando,
  marcador,
  onMencion,
  onDecidir,
  onSeleccion,
  onFoco,
  onSoltar,
  onTocarLeyendo,
  onMantener,
  registrar,
}) {
  const b = useStore(editor, (s) => s.estado.porKey[k]);
  const pedido = useStore(editor, (s) => (s.foco?.key === k ? s.foco : null));
  const hash = useStore(rastreo, (s) => s.hashPorKey[k]);
  const textoRastreado = useStore(rastreo, (s) => s.textoPorKey[k]);
  const filas = useStore(rastreo, (s) => (hash ? s.filas.get(hash) : undefined));
  const guardadas = useStore(rastreo, (s) => s.guardadas);
  const fallo = useStore(rastreo, (s) => s.fallo);

  const campo = useRef(null);
  useEffect(() => registrar?.(k, campo.current), [k, registrar]);

  const texto = textoDe(b?.children);
  const tipo = tipoDe(b);

  // ── Menciones ──
  const reconocidos = tramosDeBloque(b, indice);
  const lugares = useMemo(
    () => (filas && textoRastreado === texto ? lugaresDe(filas, guardadas) : null),
    [filas, textoRastreado, texto, guardadas],
  );
  const memoria = useRef(null);
  if (!memoria.current) memoria.current = memoriaNueva();
  const { tramos, entrando } = anotar(reconocidos, lugares, memoria.current, { fallo, porId: indice?.porId });

  // El fundido va en pasos: un texto dentro de un campo editable no se puede
  // animar de forma continua, pero cuatro o cinco pasos en un cuarto de
  // segundo se ven como un aparecer suave.
  const [, setPulso] = useState(0);
  useEffect(() => {
    if (!entrando) return undefined;
    const t = setTimeout(() => setPulso((n) => n + 1), PASO_MS);
    return () => clearTimeout(t);
  });

  const defs = useMemo(() => new Map((b?.markDefs || []).map((d) => [d._key, d])), [b?.markDefs]);
  const trozos = useMemo(() => piezas(b?.children, tramos), [b?.children, tramos]);

  // ── Cursor pedido por una operación (Enter, borrar, deshacer…) ──
  //
  // Vale para un solo render y se suelta cuando el campo confirma la
  // posición: si quedara puesto, cada tecla volvería a mandar el cursor ahí.
  const [impuesta, setImpuesta] = useState(null);
  useEffect(() => {
    if (!pedido) return;
    const largo = texto.length;
    const pos = Math.min(pedido.pos ?? largo, largo);
    const desde = Math.min(pedido.desde ?? pos, largo);
    setImpuesta({ start: desde, end: pos });
    // Se anota ya dónde queda el cursor, sin esperar a que el campo avise: el
    // primer «borrar» en un bloque recién creado tiene que saber que está al
    // principio.
    editor.getState().seleccionar(k, desde, pos);
    campo.current?.focus();
    editor.getState().focoCumplido(pedido.n);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido?.n]);

  // Si el cursor se movió por una tecla y no por un dedo: escribir en medio de
  // un nombre no tiene que abrir su ficha en cada letra.
  const tecleando = useRef(false);
  const tramosRef = useRef(tramos);
  tramosRef.current = tramos;

  const alCambiar = useCallback(
    (t) => {
      tecleando.current = true;
      editor.getState().escribir(k, t);
      // Al escribir, lo que estaba marcado antes ya no aplica.
      onSeleccion?.('');
    },
    [editor, k, onSeleccion],
  );

  const alSeleccionar = useCallback(
    (e) => {
      const { start, end } = e.nativeEvent.selection;
      editor.getState().seleccionar(k, start, end);
      setImpuesta(null);
      const porTecla = tecleando.current;
      tecleando.current = false;
      // Lo marcado con el dedo sirve para crear una ficha con ese nombre.
      if (start !== end) {
        const t = textoDe(editor.getState().estado.porKey[k]?.children).slice(start, end).trim();
        if (t.length >= 2) onSeleccion?.(t);
      }
      if (!buscando || porTecla || start !== end) return;
      const m = mencionEnTramos(tramosRef.current, start);
      if (!m) return;
      if (m.tramo.estado === 'dudosa') {
        // Una mención dudosa no abre la ficha: pregunta si es ella, con la
        // frase alrededor para poder decidir.
        roce();
        const t = textoDe(editor.getState().estado.porKey[k]?.children);
        onDecidir?.(m.tramo, t.slice(Math.max(0, m.desde - 140), m.desde + m.tramo.texto.length + 140));
      } else {
        toque();
        onMencion?.(m.tramo.item);
      }
    },
    [editor, k, buscando, onDecidir, onMencion, onSeleccion],
  );

  const alTecla = useCallback(
    (e) => {
      if (e.nativeEvent.key !== 'Backspace') return;
      const s = editor.getState().seleccion;
      if (s.key === k && s.start === 0 && s.end === 0) editor.getState().borrarAlInicio(k);
    },
    [editor, k],
  );

  if (!b) return null;

  const estiloTexto = estiloDeBloque(tipo);
  const hecho = tipo === 'todo' && b.hecho;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingLeft: ((b.level || 1) - 1) * SANGRIA + nivelVisual * SANGRIA,
        marginTop: tipo === 'h1' ? 8 : tipo === 'h2' ? 4 : 0,
      }}
    >
      <Marcador
        b={b}
        tipo={tipo}
        numero={numero}
        onHecho={() => {
          roce();
          editor.getState().alternarHecho(k);
        }}
        onAbierto={() => {
          roce();
          editor.getState().alternarAbierto(k);
        }}
      />
      <Pressable
        style={{ flex: 1 }}
        disabled={escribiendo}
        onPress={() => onTocarLeyendo?.(k)}
        // Mantener apretado un bloque, leyendo, empieza a elegir bloques.
        onLongPress={onMantener ? () => onMantener(k) : undefined}
        delayLongPress={380}
      >
        <View pointerEvents={escribiendo ? 'auto' : 'none'}>
          <TextInput
            ref={campo}
            editable={escribiendo}
            multiline
            scrollEnabled={false}
            // Enter parte el bloque: no mete un salto adentro del campo.
            submitBehavior="submit"
            onSubmitEditing={() => editor.getState().enter(k)}
            onChangeText={alCambiar}
            onSelectionChange={alSeleccionar}
            onKeyPress={alTecla}
            onFocus={() => {
              editor.getState().enfocar(k);
              onFoco?.(k);
            }}
            onBlur={() => {
              editor.getState().soltar(k);
              onSoltar?.(k);
            }}
            selection={impuesta || undefined}
            placeholder={marcador}
            placeholderTextColor="rgba(28,43,34,0.22)"
            style={[
              {
                fontFamily: MONO,
                fontSize: CUERPO,
                lineHeight: RENGLON,
                color: INK.title,
                padding: 0,
                textAlignVertical: 'top',
              },
              estiloTexto,
              hecho ? { color: 'rgba(28,43,34,0.4)', textDecorationLine: 'line-through' } : null,
            ]}
          >
            {trozos.map((p, i) =>
              p.marcas.length || p.mencion ? (
                <Text key={i} style={estiloDePieza(p, defs)}>
                  {p.texto}
                </Text>
              ) : (
                p.texto
              ),
            )}
          </TextInput>
        </View>
      </Pressable>
    </View>
  );
}

export default memo(Bloque);
