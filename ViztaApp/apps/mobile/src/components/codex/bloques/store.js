import { createStore } from 'zustand/vanilla';
import { crearDocumento } from '../../../documento';
import {
  aDocumento,
  abrirPagina,
  alternarAbierto,
  alternarHecho,
  borrarAlInicio,
  borrarBloques,
  bloqueEspecial,
  copiarBloques,
  actualizarMedio,
  agregarColumna,
  agregarFila,
  editarBloque,
  reemplazarEspecial,
  editarCelda,
  insertarBloque,
  quitarColumna,
  quitarFila,
  quitarMedio,
  moverBloques,
  moverUnPaso,
  nuevaPagina,
  renombrarPagina,
  volver,
  crearHistorial,
  desdeDocumento,
  escribir,
  escribirCodigo,
  marcar,
  partir,
  ponerTipo,
  reemplazarRango,
  sangrar,
  textoDe,
  tipoDe,
} from '../../../documento/editor';
import { tramoDePalabra } from '../buscarCodex';

/**
 * El estado del editor de una nota.
 *
 * Un store por hoja, no uno global: la hoja se reutiliza para abrir otras
 * notas, pero lo que se carga reemplaza todo y deshacer no tiene que cruzar
 * de una nota a otra.
 *
 * Cada bloque se suscribe solo a su `porKey[key]`, así que al escribir se
 * vuelve a pintar el bloque tocado y nada más. La lista entera se suscribe a
 * `estructura`, que cambia solo cuando cambia la forma —se agrega o se quita
 * un bloque, cambia un tipo, un bloque pasa de vacío a tener texto (la
 * numeración depende de eso)—.
 *
 *   estado      el documento plano (ver `documento/editor/estado.js`)
 *   foco        adónde tiene que ir el cursor después de una operación:
 *               `{ key, pos, desde?, n }`; `n` cambia en cada pedido
 *   seleccion   dónde está el cursor ahora: `{ key, start, end }`
 *   enfocado    qué bloque tiene el teclado
 *   version     cambia con cada cambio de contenido (guardar, borrador)
 */
export function crearEditor(doc = crearDocumento()) {
  const historial = crearHistorial();
  let pedidos = 0;

  const store = createStore((set, get) => {
    /**
     * Aplicar una operación: estado nuevo, historial y avisos. `op` recibe el
     * estado actual y devuelve `{ estado, foco }` como las operaciones puras.
     */
    const aplicar = (tipo, key, op) => {
      const s = get();
      const antes = s.estado;
      const r = op(antes);
      if (!r) return;
      const cambio = r.estado !== antes;
      if (!cambio && !r.foco) return;

      const foco = r.foco ? { ...r.foco, n: ++pedidos } : s.foco;
      if (cambio) {
        historial.anotar({
          antes,
          despues: r.estado,
          focoAntes: s.seleccion?.key ? { key: s.seleccion.key, pos: s.seleccion.start } : null,
          focoDespues: r.foco || null,
          tipo,
          key,
        });
      }
      set({
        estado: r.estado,
        foco,
        version: cambio ? s.version + 1 : s.version,
        estructura: cambio && cambioDeForma(antes, r.estado, key, tipo) ? s.estructura + 1 : s.estructura,
      });
    };

    const sel = (key) => {
      const s = get().seleccion;
      return s?.key === key ? s : null;
    };

    return {
      estado: desdeDocumento(doc),
      foco: null,
      seleccion: { key: null, start: 0, end: 0 },
      enfocado: null,
      version: 0,
      estructura: 0,
      // Modo «seleccionar bloques»: qué bloques están elegidos.
      seleccionando: false,
      seleccionados: [],
      // Cuántas veces se cargó otra nota: la lista vuelve a montarse de a poco.
      cargas: 0,

      /** Reemplaza todo: otra nota, o el cuerpo cambiado desde afuera del editor. */
      cargar(nuevoDoc) {
        historial.limpiar();
        set((s) => ({
          estado: desdeDocumento(nuevoDoc || crearDocumento()),
          foco: null,
          seleccion: { key: null, start: 0, end: 0 },
          seleccionando: false,
          seleccionados: [],
          version: s.version + 1,
          estructura: s.estructura + 1,
          cargas: s.cargas + 1,
        }));
      },

      documento: () => aDocumento(get().estado),

      /**
       * Lo que resultó de juntar con otra versión (ver `fusion.js`). Se queda
       * en la página que se está mirando, y se puede deshacer como cualquier
       * otro cambio.
       */
      fusionarCon: (doc) => aplicar('fusion', null, (e) => ({ estado: { ...desdeDocumento(doc, e.pagina), pendiente: null } })),

      // ── Páginas ──
      abrirPagina: (key) => {
        historial.cortar();
        aplicar('pagina', null, (e) => abrirPagina(e, key));
        // Lo elegido era de la otra página.
        set({ seleccionando: false, seleccionados: [] });
      },
      volver: () => {
        historial.cortar();
        aplicar('pagina', null, (e) => volver(e));
        set({ seleccionando: false, seleccionados: [] });
      },
      /** Una página nueva después del bloque del cursor, abierta y lista para ponerle título. */
      nuevaPagina: () => {
        historial.cortar();
        const { seleccion, estado } = get();
        const despuesDe = seleccion.key && estado.porKey[seleccion.key] ? seleccion.key : estado.orden[estado.orden.length - 1];
        aplicar('pagina', null, (e) => nuevaPagina(e, despuesDe));
      },
      renombrarPagina: (key, titulo) => aplicar('titulo', key, (e) => renombrarPagina(e, key, titulo)),

      // ── Seleccionar bloques ──
      entrarSeleccion: (key) => {
        const { estado } = get();
        set({ seleccionando: true, seleccionados: key && estado.porKey[key] ? [key] : [] });
      },
      salirSeleccion: () => set({ seleccionando: false, seleccionados: [] }),
      alternarSeleccion: (key) => {
        const { seleccionados } = get();
        set({
          seleccionados: seleccionados.includes(key) ? seleccionados.filter((k) => k !== key) : [...seleccionados, key],
        });
      },
      moverSeleccion: (delta) => {
        const { seleccionados } = get();
        if (seleccionados.length) aplicar('mover', null, (e) => moverUnPaso(e, seleccionados, delta));
      },
      /** Soltar lo arrastrado antes de `antesDe` (o al final). */
      soltarSeleccionEn: (keys, antesDe) => aplicar('mover', null, (e) => moverBloques(e, keys, antesDe)),
      borrarSeleccion: () => {
        const { seleccionados } = get();
        if (!seleccionados.length) return;
        aplicar('borrar', null, (e) => borrarBloques(e, seleccionados));
        set({ seleccionados: [] });
      },
      /** El markdown de lo elegido, para el portapapeles. */
      copiarSeleccion: () => copiarBloques(get().estado, get().seleccionados),

      // ── Bloques especiales ──
      /**
       * Meter un bloque especial después del bloque del cursor: `codigo`,
       * `formula`, `dibujo`, `tabla`, `separador`. El foco va al bloque nuevo.
       */
      insertar: (tipo) => {
        historial.cortar();
        const { seleccion, estado } = get();
        const despuesDe = seleccion.key && estado.porKey[seleccion.key] ? seleccion.key : estado.orden[estado.orden.length - 1];
        aplicar('insertar', null, (e) => insertarBloque(e, despuesDe, bloqueEspecial(tipo)));
      },
      /** El datasheet elige su dataset (o la tabla simple pasa a ser uno). */
      conectarDataset: (key, dataset_id, nombre) =>
        aplicar('especial', key, (e) => {
          const b = e.porKey[key];
          if (b?._type === 'tabla') {
            return reemplazarEspecial(e, key, { _type: 'datasheet', dataset_id, nombre, vista: 'tabla' });
          }
          return editarBloque(e, key, { dataset_id, nombre });
        }),
      editarBloque: (key, cambios, tipo = 'especial') => aplicar(tipo, key, (e) => editarBloque(e, key, cambios)),
      editarCelda: (key, f, c, texto) => aplicar('escribir', `${key}:${f}:${c}`, (e) => editarCelda(e, key, f, c, texto)),
      /** Escribir en un especial (código, LaTeX): se agrupa para deshacer como el texto. */
      escribirEspecial: (key, cambios) => aplicar('escribir', key, (e) => editarBloque(e, key, cambios)),
      agregarFila: (key) => aplicar('tabla', key, (e) => agregarFila(e, key)),
      agregarColumna: (key) => aplicar('tabla', key, (e) => agregarColumna(e, key)),
      quitarFila: (key, f) => aplicar('tabla', key, (e) => quitarFila(e, key, f)),
      quitarColumna: (key, c) => aplicar('tabla', key, (e) => quitarColumna(e, key, c)),

      /**
       * Una foto, un audio o un documento en medio del texto, apenas se
       * adjunta: `ref` es el id de la subida, hasta que tenga su ruta.
       */
      insertarMedio: (datos) => {
        const { seleccion, estado } = get();
        const despuesDe = seleccion.key && estado.porKey[seleccion.key] ? seleccion.key : estado.orden[estado.orden.length - 1];
        aplicar('insertar', null, (e) => {
          const r = insertarBloque(e, despuesDe, bloqueEspecial('medio', undefined, datos));
          // El cursor se queda donde estaba: se sigue escribiendo.
          return { estado: r.estado };
        });
      },
      actualizarMedio: (ref, datos) => aplicar('medio', null, (e) => actualizarMedio(e, ref, datos)),
      quitarMedio: (ref) => aplicar('medio', null, (e) => quitarMedio(e, ref)),

      // ── Lo que hace el teclado ──
      escribir: (key, texto) => aplicar('escribir', key, (e) => escribir(e, key, texto, sel(key))),
      enter: (key) => {
        const s = sel(key) || { start: textoDe(get().estado.porKey[key]?.children).length };
        historial.cortar();
        aplicar('partir', key, (e) => partir(e, key, s.start, s.end ?? s.start));
      },
      borrarAlInicio: (key) => aplicar('borrar', key, (e) => borrarAlInicio(e, key)),
      escribirCodigo: (key, texto) => aplicar('escribir', key, (e) => escribirCodigo(e, key, texto)),

      // ── Lo que hacen los botones ──
      /** Una acción de la barra: formato en línea o tipo de bloque. */
      formatear: (accion) => {
        if (accion === 'deshacer') return get().deshacer();
        if (accion === 'rehacer') return get().rehacer();
        // Lo que mete un bloque nuevo o cambia de modo no necesita cursor:
        // sin él, va al final.
        if (accion === 'pagina') return get().nuevaPagina();
        const especial = { tabla: 'tabla', formula: 'formula', dibujo: 'dibujo', 'bloque-codigo': 'codigo', separador: 'separador', datasheet: 'datasheet' }[accion];
        if (especial) return get().insertar(especial);
        if (accion === 'seleccionar') return get().entrarSeleccion(get().seleccion?.key);
        const s = get().seleccion;
        if (!s?.key) return;
        if (accion === 'sangrar' || accion === 'desangrar') {
          aplicar('sangria', s.key, (e) => sangrar(e, s.key, accion === 'sangrar' ? 1 : -1));
          return;
        }
        const tipo = { h1: 'h1', h2: 'h2', h3: 'h3', cuerpo: 'normal', cita: 'cita', vineta: 'bullet', numerada: 'number', todo: 'todo', toggle: 'toggle' }[accion];
        if (tipo) {
          // «Cuerpo» no es un interruptor: siempre deja el bloque como párrafo.
          const actual = tipoDe(get().estado.porKey[s.key]);
          if (tipo === 'normal' && actual === 'normal') return;
          aplicar('tipo', s.key, (e) => ponerTipo(e, s.key, tipo === 'normal' ? actual : tipo));
          return;
        }
        aplicar('marca', s.key, (e) => marcar(e, s.key, s.start, s.end, accion));
      },
      sangrar: (key, delta) => aplicar('sangria', key, (e) => sangrar(e, key, delta)),
      alternarHecho: (key) => aplicar('hecho', key, (e) => alternarHecho(e, key)),
      alternarAbierto: (key) => aplicar('abierto', key, (e) => alternarAbierto(e, key)),

      /**
       * Completar con una sugerencia del Codex: la palabra a medio escribir
       * pasa a ser el nombre como está guardado, con un espacio detrás. Es lo
       * mismo que hace `completar` en `buscarCodex.js` sobre la nota vieja.
       */
      completar: (nombre) => {
        const s = get().seleccion;
        const limpio = String(nombre || '').trim();
        if (!s?.key || !limpio) return;
        const texto = textoDe(get().estado.porKey[s.key]?.children);
        const { ini, fin } = tramoDePalabra(texto, s.start);
        const propio = /^\s/.test(texto.slice(fin)) ? '' : ' ';
        historial.cortar();
        aplicar('completar', s.key, (e) => {
          // El cursor queda pasando el separador —el propio o el que ya
          // estaba—, nunca pegado al nombre: pegado, el autocompletado leería
          // otra vez la última palabra y volvería a sugerir lo mismo.
          const r = reemplazarRango(e, s.key, ini, fin, limpio + propio);
          return { ...r, foco: { key: s.key, pos: ini + limpio.length + 1 } };
        });
      },

      deshacer: () => {
        const r = historial.deshacer();
        if (!r) return;
        set((s) => ({ estado: r.estado, foco: r.foco ? { ...r.foco, n: ++pedidos } : null, version: s.version + 1, estructura: s.estructura + 1 }));
      },
      rehacer: () => {
        const r = historial.rehacer();
        if (!r) return;
        set((s) => ({ estado: r.estado, foco: r.foco ? { ...r.foco, n: ++pedidos } : null, version: s.version + 1, estructura: s.estructura + 1 }));
      },
      puedeDeshacer: () => historial.puedeDeshacer,
      puedeRehacer: () => historial.puedeRehacer,

      // ── Cursor ──
      seleccionar: (key, start, end = start) => {
        const s = get().seleccion;
        if (s.key === key && s.start === start && s.end === end) return;
        set({ seleccion: { key, start, end } });
      },
      enfocar: (key) => set({ enfocado: key }),
      soltar: (key) => {
        if (get().enfocado === key) set({ enfocado: null });
      },
      /** El bloque ya puso el cursor donde se le pidió. */
      focoCumplido: (n) => {
        if (get().foco?.n === n) set({ foco: null });
      },
      /** Pedir el cursor en un bloque, sin cambiar nada: tocar un renglón vacío, entrar a escribir. */
      pedirFoco: (key, pos) => set({ foco: { key, pos, n: ++pedidos } }),
    };
  });

  return store;
}

/**
 * ¿Cambió la forma del documento y no solo el texto de un bloque? Es lo que
 * decide si la lista entera se vuelve a pintar.
 */
function cambioDeForma(antes, despues, key, tipo) {
  if (tipo !== 'escribir') return true;
  if (antes.orden !== despues.orden) return true;
  const a = antes.porKey[key];
  const b = despues.porKey[key];
  // Escribir en una celda (`key:fila:col`) o en un bloque que no es texto
  // no cambia la forma: se vuelve a pintar ese bloque solo.
  if (!a || !b) return antes.orden !== despues.orden;
  if (tipoDe(a) !== tipoDe(b) || a.level !== b.level) return true;
  return !textoDe(a.children).trim() !== !textoDe(b.children).trim();
}
