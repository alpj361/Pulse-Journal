import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import {
  Bold,
  Brush,
  Code,
  Database,
  FileText,
  Heading1,
  Heading2,
  Highlighter,
  IndentDecrease,
  IndentIncrease,
  Italic,
  List,
  ListCollapse,
  ListOrdered,
  ListTodo,
  Quote,
  Redo2,
  Sigma,
  SquareCode,
  SquareDashed,
  Strikethrough,
  Table,
  Type,
  Underline,
  Undo2,
} from 'lucide-react-native';

/**
 * Lo que queda a mano: los botones que cada quien usa tanto que no quiere
 * abrir un panel para llegar a ellos. Viven en la cápsula, al lado de Aa y
 * `+`, mientras se escribe, y actúan sin bajar el teclado.
 *
 * Se eligen en los paneles: mantener apretado un botón lo pone o lo saca.
 * Son pocos a propósito —la cápsula es una sola fila sobre el teclado—, y
 * van en el orden en que se eligieron.
 *
 * Se guardan en el teléfono, no en la cuenta: es cómo se acomoda cada uno
 * su teclado, y otro teléfono puede tener otra mano.
 */

export const MAXIMO = 4;
const CLAVE = 'editor-a-mano';
const DE_ENTRADA = ['negrita', 'resaltado', 'todo', 'deshacer'];

/** Todo lo que se puede dejar a mano: la acción del store, un ícono y su nombre. */
export const ACCIONES = {
  h1: { Icono: Heading1, etiqueta: 'Título' },
  h2: { Icono: Heading2, etiqueta: 'Subtítulo' },
  cuerpo: { Icono: Type, etiqueta: 'Cuerpo' },
  cita: { Icono: Quote, etiqueta: 'Foco' },
  bloque: { Icono: SquareDashed, etiqueta: 'Bloque' },
  negrita: { Icono: Bold, etiqueta: 'Negrita' },
  cursiva: { Icono: Italic, etiqueta: 'Cursiva' },
  subrayado: { Icono: Underline, etiqueta: 'Subrayado' },
  tachado: { Icono: Strikethrough, etiqueta: 'Tachado' },
  resaltado: { Icono: Highlighter, etiqueta: 'Resaltar' },
  codigo: { Icono: Code, etiqueta: 'Código' },
  todo: { Icono: ListTodo, etiqueta: 'Por hacer' },
  toggle: { Icono: ListCollapse, etiqueta: 'Plegable' },
  vineta: { Icono: List, etiqueta: 'Viñetas' },
  numerada: { Icono: ListOrdered, etiqueta: 'Numerada' },
  desangrar: { Icono: IndentDecrease, etiqueta: 'Menos sangría' },
  sangrar: { Icono: IndentIncrease, etiqueta: 'Más sangría' },
  deshacer: { Icono: Undo2, etiqueta: 'Deshacer' },
  rehacer: { Icono: Redo2, etiqueta: 'Rehacer' },
  pagina: { Icono: FileText, etiqueta: 'Página' },
  tabla: { Icono: Table, etiqueta: 'Tabla' },
  datasheet: { Icono: Database, etiqueta: 'Dataset' },
  'bloque-codigo': { Icono: SquareCode, etiqueta: 'Bloque de código' },
  formula: { Icono: Sigma, etiqueta: 'Fórmula' },
  dibujo: { Icono: Brush, etiqueta: 'Dibujo' },
};

// Mismo cuidado que el borrador: en la web no hay SQLite y un fallo acá no
// puede tumbar la hoja.
let almacen;
function kv() {
  if (almacen === undefined) {
    try {
      almacen = Platform.OS === 'web' ? null : require('expo-sqlite/kv-store').Storage;
    } catch {
      almacen = null;
    }
  }
  return almacen;
}

/** Solo lo que existe y sin repetir: lo guardado puede venir de otra versión. */
export const limpiar = (lista) =>
  [...new Set(Array.isArray(lista) ? lista : [])].filter((a) => ACCIONES[a]).slice(0, MAXIMO);

function leer() {
  try {
    const t = kv()?.getItemSync(CLAVE);
    if (t) return limpiar(JSON.parse(t));
  } catch {
    // Lo guardado no se entiende: se empieza de nuevo.
  }
  return DE_ENTRADA;
}

/** Poner o sacar una acción. La que entra va al final; si no hay lugar, sale la más vieja. */
export function alternar(lista, accion) {
  if (!ACCIONES[accion]) return lista;
  if (lista.includes(accion)) return lista.filter((a) => a !== accion);
  return [...lista, accion].slice(-MAXIMO);
}

export const aMano = createStore((set, get) => ({
  acciones: null, // se lee al usarse, no al importar
  lista: () => {
    const { acciones } = get();
    if (acciones) return acciones;
    const leidas = leer();
    set({ acciones: leidas });
    return leidas;
  },
  alternar: (accion) => {
    const nuevas = alternar(get().lista(), accion);
    set({ acciones: nuevas });
    try {
      kv()?.setItem(CLAVE, JSON.stringify(nuevas));
    } catch {
      // Sin almacén dura lo que dure la app abierta.
    }
    return nuevas.includes(accion);
  },
}));

/** La lista para pintar. Se lee del teléfono la primera vez que alguien la pide. */
export function useAMano() {
  const acciones = useStore(aMano, (s) => s.acciones);
  useEffect(() => {
    if (!acciones) aMano.getState().lista();
  }, [acciones]);
  return acciones || [];
}
