import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
  Alert,
  Platform,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedKeyboard,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { X, Plus, Search, Send, ChevronDown } from 'lucide-react-native';
import { INK, MOTION } from '../theme';
import MorphingInfinity from '../MorphingInfinity';
import { PAPEL } from './Papel';
import { MONO } from './mono';
import { TYPE_ACCENT, normalizeTipo } from './tipos';
import { segmentar } from './menciones';
import useIndiceCodex from './useIndiceCodex';
import useItemsHidratados from './useItemsHidratados';
import HistorialSnippets from './HistorialSnippets';
import AutocompletarCodex from './AutocompletarCodex';
import HiloVizta from './HiloVizta';
import SelectorModelo from './SelectorModelo';
import { consultar, nuevoHilo } from '../../services/viztaRapido';
import { useModeloStore } from '../../state/modeloStore';
import { completar, mencionEn } from './buscarCodex';
import GlassButton from '../GlassButton';
import PanelSnippet from './PanelSnippet';
import ItemDetailSheet from './ItemDetailSheet';
import { toque, roce, falla } from '../../utils/haptics';
import { EV, evento } from '../../utils/analitica';
import { supabase } from '../../utils/supabase';
import { usePulseConnectionStore } from '../../state/pulseConnectionStore';
import { LinearGradient } from 'expo-linear-gradient';

// Las tres páginas. La nota va al medio para que las otras dos estén a un
// deslizamiento de distancia en cualquier dirección, y para que abrir la hoja
// caiga siempre en el lugar donde se escribe.
const HISTORIAL = 0;
const NOTA = 1;
const PANEL = 2;

/**
 * El nombre del modelo sin el proveedor.
 *
 * OpenRouter los nombra «MoonshotAI: Kimi K2 0905», y en la barra eso se corta
 * justo donde importa —queda «MoonshotAI: Kimi K2 0…»— gastando la mitad del
 * ancho en un dato que ya se elige en el selector, donde el proveedor aparece
 * en su propia línea. Acá lo que hace falta saber es cuál modelo, no de quién.
 */
function sinProveedor(nombre) {
  const corte = String(nombre || '').indexOf(': ');
  return corte > 0 ? nombre.slice(corte + 2) : nombre;
}

/**
 * Escribir un fragmento.
 *
 * Un Snippet no se llena: se escribe. Así que esto no es una hoja con campos, es
 * una superficie de escritura — pantalla completa, papel, monoespaciada y mucho
 * aire.
 *
 * Alrededor de esa hoja hay dos páginas más, a un deslizamiento:
 *
 *  · **izquierda, el historial** — qué escribiste antes.
 *  · **derecha, el panel** — a quién nombraste, y los datos de la nota.
 *
 * Las tres viven en un ScrollView horizontal con `pagingEnabled` y no en una
 * librería de pestañas. Con tres páginas fijas, una librería solo agregaría una
 * dependencia y una barra de pestañas que le comería aire a la hoja. El costo
 * de esta decisión es que el gesto es invisible, y por eso abajo hay tres
 * puntos: son lo único que delata que la nota no está sola.
 *
 * Una nota sobre la referencia original: ahí el texto va centrado, y acá no.
 * Centrado se ve precioso en una carta estática, pero al escribir el cursor
 * salta de lugar con cada tecla y se pierde el renglón. Lo que da la sensación
 * de carta no es la centradura sino la medida angosta, el interlineado alto y la
 * monoespaciada — eso sí está.
 *
 * Se guarda como los Snippets que ya existen en la base: el cuerpo va en
 * `description` —con su markdown si lo trae— y el título en `name`. El preset
 * nominal pone el cuerpo en `details.Contenido`, pero ningún registro real lo
 * usa así, y romper esa consistencia dejaría los fragmentos del teléfono
 * invisibles para lo que ya lee la web.
 */
export default function CreateSnippetSheet({
  onClose,
  onCreated,
  // Nota que había abierta la última vez que se usó la app, para volver a ella.
  restaurarId = null,
  // Avisa hacia arriba qué nota está cargada, para que se pueda anotar el lugar.
  onNota,
  bottomInset = 0,
  topInset = 0,
}) {
  const { width: W } = useWindowDimensions();

  const [titulo, setTitulo] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [fuente, setFuente] = useState('');
  const [tags, setTags] = useState('');
  const [fecha, setFecha] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [pagina, setPagina] = useState(NOTA);

  /**
   * Autocompletado del Codex, encendido.
   *
   * No cambia de pantalla ni reemplaza la nota: se sigue escribiendo en la misma
   * hoja, y las coincidencias de lo que se está tecleando aparecen flotando
   * encima. Es un modo de la nota, no otro lugar.
   *
   * Está apagado por defecto porque no siempre se está escribiendo *sobre* el
   * Codex: tomando una nota suelta, un panel que aparece y desaparece con cada
   * palabra sería un parpadeo permanente. Se enciende cuando lo que se escribe
   * tiene nombres propios que uno quiere ir mirando.
   */
  const [buscando, setBuscando] = useState(false);

  /**
   * Modo Vizta: lo que se escribe es una pregunta, no una nota.
   *
   * Reusa la superficie de escritura entera —el mismo papel, la misma medida—
   * porque escribir una pregunta y escribir una nota es el mismo gesto. Lo
   * único que cambia es qué pasa al terminar: en vez de «guardar» dice
   * «enviar», y en vez de quedarse, la respuesta aparece debajo.
   *
   * El texto de la pregunta no se pierde al salir del modo: sigue en `cuerpo`,
   * así que una pregunta que resultó valer la pena se puede guardar como nota.
   */
  const [preguntando, setPreguntando] = useState(false);
  const [pensando, setPensando] = useState(false);
  const [errorVizta, setErrorVizta] = useState(null);
  const [eligiendoModelo, setEligiendoModelo] = useState(false);

  /**
   * La conversación: `{ rol: 'yo' | 'vizta', texto }` en orden.
   *
   * Acá vive solo lo que se muestra. El contexto que ve el modelo —con los
   * resultados de las herramientas— lo guarda el servidor contra `hiloId`, para
   * no traerle a la app el formato crudo del proveedor.
   */
  const [turnos, setTurnos] = useState([]);
  const [hiloId, setHiloId] = useState(null);

  /**
   * Empuja la vista al final del hilo.
   *
   * Es un contador y no un booleano: hay que desplazar en cada turno, y con un
   * booleano el segundo no dispararía nada porque el valor no cambió.
   */
  const [desplazar, setDesplazar] = useState(0);

  /**
   * Preguntarle a Vizta es solo para admins, igual que los posts.
   *
   * El rol se lee acá y no llega por prop: la hoja se abre desde el orbe y
   * desde el Codex, y con un prop habría que acordarse de pasarlo en cada
   * lugar nuevo — olvidarse una vez abriría el chat a cualquiera. Es el mismo
   * dato del perfil que ya guarda la sesión, así que no cuesta un viaje.
   */
  const puedePreguntar = usePulseConnectionStore((e) => e.connectedUser?.role) === 'admin';

  const modelo = useModeloStore((s) => s.modelo);
  const nombreModelo = useModeloStore((s) => s.nombre);

  // Cuál nota del historial se está editando. `null` = nota nueva.
  // De esto depende que guardar actualice en vez de crear un duplicado.
  const [editandoId, setEditandoId] = useState(null);

  /**
   * Leyendo una nota ya escrita, en vez de escribiendo una nueva.
   *
   * Una nota nueva abre el teclado sola: no hay nada que leer y lo único que se
   * puede hacer es escribir. Una nota existente es al revés — lo primero que uno
   * hace es leerla — y ahí el teclado tapa media pantalla, empuja el texto y
   * obliga a bajarlo a mano cada vez que se toca algo. Es lo mismo que hacen las
   * notas de iOS: se abre en lectura, y el teclado aparece recién cuando tocás
   * el texto para escribir.
   */

  // Item abierto encima de la hoja: puede ser una nota del historial, un
  // mencionado, o uno nuevo a partir del texto seleccionado.
  const [itemAbierto, setItemAbierto] = useState(null);

  const campo = useRef(null);
  const pager = useRef(null);

  // Menciones del Codex: se pintan los nombres de tus items mientras escribís.
  // El índice puede llegar vacío (sin sesión, o si falla la carga); en ese caso
  // `segmentar` devuelve un solo tramo sin color y la nota funciona igual.
  const { indice, refrescar } = useIndiceCodex();
  const tramos = useMemo(() => segmentar(cuerpo, indice), [cuerpo, indice]);

  // Los mencionados, sin repetir: nombrar a alguien tres veces en la nota no
  // son tres chips.
  const mencionadosCrudos = useMemo(() => {
    const vistos = new Map();
    for (const t of tramos) if (t.item && !vistos.has(t.item.id)) vistos.set(t.item.id, t.item);
    return [...vistos.values()];
  }, [tramos]);

  /**
   * Qué items hay que traer completos: los mencionados **y el que esté abierto**.
   *
   * El abierto no siempre es un mencionado. Desde el autocompletado se puede
   * abrir la ficha de alguien que todavía no aparece en el texto, y ese llega
   * del índice, que se baja recortado —`id, name, tipo, aliases`— porque solo
   * necesita reconocer nombres. Sin hidratarlo, la ficha se abría en blanco
   * diciendo «Ningún campo tiene dato todavía» sobre un actor con la ficha
   * llena en la base.
   *
   * Y hay un segundo efecto, peor que el visible: este hook es el que marca
   * `_source: 'universe'`. Un item que no pasa por acá llega a la ficha sin la
   * marca, y `useCamposEditables` lo toma por un item de wiki — el UPDATE se va
   * a `wiki_items` con un id del universo, no afecta ninguna fila, no da error,
   * y la pantalla dice que guardó. Pasar el abierto por acá cierra las dos.
   */
  const aHidratar = useMemo(() => {
    // Uno que se está creando todavía no existe en la base: no hay qué pedir.
    if (!itemAbierto || itemAbierto._nuevo) return mencionadosCrudos;
    if (mencionadosCrudos.some((m) => m.id === itemAbierto.id)) return mencionadosCrudos;
    return [...mencionadosCrudos, itemAbierto];
  }, [mencionadosCrudos, itemAbierto]);

  const { items: hidratados, actualizar } = useItemsHidratados(aHidratar);

  // El panel lista a quién nombraste, así que el item abierto desde el
  // autocompletado no va: hidratarlo no es lo mismo que haberlo mencionado, y
  // verlo aparecer ahí diría que está en la nota cuando no está.
  const mencionados = useMemo(
    () => hidratados.filter((h) => mencionadosCrudos.some((m) => m.id === h.id)),
    [hidratados, mencionadosCrudos]
  );

  /**
   * El item que ve la ficha: la copia del toque, completada con lo que haya
   * llegado después.
   *
   * `setItemAbierto(item)` congela el objeto tal como estaba al tocar el chip.
   * La hidratación es asíncrona, así que tocar apenas aparece el chip guardaba
   * la versión del índice —id, nombre, tipo y alias— y la ficha se quedaba con
   * ella: sin `geo`, mostrando «sin ubicación» para un municipio que tiene su
   * polígono oficial cargado.
   *
   * **Se fusiona en vez de reemplazar.** Tomar la versión de la lista tal cual
   * parece equivalente y no lo es: si por lo que sea la lista devolviera una
   * versión recortada, la ficha abierta se vaciaría de golpe. Al fusionar, las
   * claves que la recortada no trae —`geo`, `description`, `details`— quedan
   * las de la copia previa, así que este merge solo puede agregar información,
   * nunca quitarla.
   */
  const itemVivo = itemAbierto?._nuevo
    ? itemAbierto
    : { ...itemAbierto, ...(hidratados.find((m) => m.id === itemAbierto?.id) || {}) };

  // Selección de texto, para poder crear un item con ella.
  //
  // Se **retiene** la última selección real en vez de leerla en vivo. Sin esto
  // el botón desaparecía justo cuando ibas a tocarlo: cualquier toque fuera del
  // texto colapsa la selección, `onSelectionChange` avisa, y el botón se
  // desmontaba abajo del dedo. Retenida, el botón sigue ahí hasta que escribas
  // otra cosa — que es el único momento en que la selección vieja deja de
  // significar algo.
  const [seleccion, setSeleccion] = useState({ start: 0, end: 0 });
  const [seleccionado, setSeleccionado] = useState('');

  /**
   * Cursor impuesto por nosotros, no por el dedo.
   *
   * Solo lo usa el autocompletado: al reemplazar «bern» por «Bernardo Arévalo»
   * hay que dejar el cursor después del nombre, y para eso el campo tiene que
   * recibir la posición. `setNativeProps` no sirve — la app corre en la
   * arquitectura nueva, donde no es fiable— así que se controla por prop.
   *
   * Vale para un solo render y se suelta enseguida. Si quedara puesto, el campo
   * tendría el cursor clavado ahí y escribir sería imposible: cada tecla
   * volvería a mandarlo al mismo lugar.
   */
  const [cursorImpuesto, setCursorImpuesto] = useState(null);

  /**
   * Si el cursor se movió por una tecla y no por un dedo.
   *
   * Al escribir, `onSelectionChange` llega igual —el cursor avanza— y sin
   * distinguirlo, editar en medio de un nombre ya escrito abriría su ficha en
   * cada tecla. Solo un cursor movido a mano cuenta como «tocaste este nombre».
   */
  const tecleando = useRef(false);

  const alSeleccionar = useCallback(
    (e) => {
      const sel = e.nativeEvent.selection;
      setSeleccion(sel);
      // iOS ya confirmó la posición pedida: se devuelve el control al campo.
      setCursorImpuesto(null);

      const texto = cuerpo.slice(sel.start, sel.end).trim();
      if (texto.length >= 2) setSeleccionado(texto);

      const porTecla = tecleando.current;
      tecleando.current = false;

      // Con el autocompletado encendido, poner el cursor sobre un nombre ya
      // escrito abre su ficha. Se pide selección vacía: marcar un rango es para
      // copiar o para crear un item, no para navegar.
      if (!buscando || porTecla || sel.start !== sel.end) return;

      const item = mencionEn(tramos, sel.start);
      if (item) {
        toque();
        evento(EV.MENCION_TOCADA, { tipo: item?.tipo || null });
        setItemAbierto(item);
      }
    },
    [cuerpo, buscando, tramos]
  );

  const escribir = useCallback((t) => {
    tecleando.current = true;
    setCuerpo(t);
    // Al escribir, lo seleccionado antes ya no aplica.
    setSeleccionado('');
    // Cinturón: si por lo que sea no llegó un `onSelectionChange` después de
    // completar, escribir una tecla también libera el cursor. Sin esto, un
    // evento que no llega deja el campo trabado.
    setCursorImpuesto(null);
  }, []);

  /**
   * Completar con una sugerencia del autocompletado.
   *
   * Se escribe el nombre del Codex tal como está guardado —con sus tildes y sus
   * mayúsculas— porque es eso lo que después reconoce el resaltado de menciones.
   * Completar «bern» a mano escribiendo «bernardo arevalo» no se pintaría.
   */
  const completarCon = useCallback(
    (item) => {
      const r = completar(cuerpo, seleccion.start, item?.name);
      setCuerpo(r.texto);
      setSeleccionado('');
      setSeleccion({ start: r.cursor, end: r.cursor });
      setCursorImpuesto({ start: r.cursor, end: r.cursor });
    },
    [cuerpo, seleccion.start]
  );

  // El título se deduce del cuerpo mientras no se escriba uno propio.
  const [tituloTocado, setTituloTocado] = useState(false);
  const tituloEfectivo = tituloTocado
    ? titulo
    : (cuerpo.split('\n').find((l) => l.trim()) || '').replace(/^#+\s*/, '').slice(0, 70);

  const puedeGuardar = cuerpo.trim().length > 0 && tituloEfectivo.trim().length > 0;

  /**
   * Si hay algo que hacer con lo escrito.
   *
   * Guardar pide texto y título —una nota sin nombre no se encuentra después—.
   * Preguntar pide solo la pregunta: el título se deduce del cuerpo, y exigirlo
   * para poder enviar sería pedirle a alguien que titule su duda.
   */
  const accionVisible = preguntando
    ? cuerpo.trim().length > 0 && !pensando
    : puedeGuardar;

  // El teclado tapaba todo lo anclado abajo: los tres puntos desaparecían y el
  // botón de crear quedaba debajo. `KeyboardAvoidingView` no lo resuelve —
  // achica el contenido, pero los hijos absolutos se siguen posicionando contra
  // el borde de la pantalla. Se sube a mano con la altura real del teclado, que
  // Reanimated expone en el hilo de UI para que acompañe la animación de subida
  // en vez de saltar cuando termina.
  const teclado = useAnimatedKeyboard();
  const sobreTeclado = useAnimatedStyle(() => {
    const alto = teclado.height.value;
    // La altura del teclado ya incluye el área segura de abajo; sin restarla,
    // la barra quedaría flotando ese tanto de más.
    return { transform: [{ translateY: alto > 0 ? -(alto - bottomInset) : 0 }] };
  });

  const irA = useCallback(
    (p) => {
      Keyboard.dismiss();
      pager.current?.scrollTo({ x: p * W, animated: true });
    },
    [W]
  );

  /**
   * Abrir una nota del historial **en la hoja**, no en la ficha del Codex.
   *
   * Antes esto abría `ItemDetailSheet`: la ficha de campos, tipos de dato y
   * relaciones. Para un Snippet eso es la vista equivocada — un fragmento no
   * tiene campos, es un texto que se lee y se sigue escribiendo. Ahora la nota
   * se carga en la misma superficie donde se escribió y la hoja se desliza
   * hasta ella.
   */
  const abrirNota = useCallback(
    (nota) => {
      const cargar = () => {
        setCuerpo(nota.description || '');
        // El nombre guardado manda sobre la primera línea: si alguien le puso
        // un título propio, deducirlo de nuevo se lo pisaría.
        setTitulo(nota.name || '');
        setTituloTocado(true);
        setFuente(nota.details?.Fuente || '');
        setFecha(nota.details?.['Fecha de captura'] || '');
        setTags(Array.isArray(nota.tags) ? nota.tags.join(', ') : '');
        setSeleccionado('');
        setEditandoId(nota.id);
        irA(NOTA);
        // Soltar el foco, no solo bajar el teclado.
        //
        // Sigue haciendo falta aunque el campo ya no se enfoque solo: la hoja
        // se reutiliza, así que se puede llegar acá con el campo enfocado de
        // una nota anterior. `Keyboard.dismiss()` bajaría el teclado dejando el
        // foco puesto, y el primer toque en cualquier parte lo devolvería.
        campo.current?.blur();
      };

      // Cargar encima de un borrador sin guardar lo borraría sin aviso.
      if (!editandoId && cuerpo.trim().length > 0) {
        Alert.alert(
          'Tenés una nota sin guardar',
          'Si abrís esta, se pierde lo que escribiste.',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Descartar y abrir', style: 'destructive', onPress: cargar },
          ]
        );
        return;
      }
      cargar();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cuerpo, editandoId]
  );

  // Qué nota está cargada. Se avisa hacia arriba para que quede anotado el
  // lugar: es el único que lo sabe, porque el id nace acá al abrir del
  // historial.
  useEffect(() => {
    onNota?.(editandoId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editandoId]);

  /**
   * Volver a la nota que estaba abierta al cerrar la app.
   *
   * Se pide por id en vez de guardarse el texto: si la nota se editó desde la
   * web mientras el teléfono estaba cerrado, lo que aparece es la versión de
   * ahora y no una copia vieja que al guardar pisaría los cambios.
   *
   * Si ya no está —borrada desde otro lado— la hoja se queda como una nota
   * nueva, en blanco. Es lo correcto: no hay a dónde volver, y avisar de una
   * nota que la persona quizá borró a propósito sería ruido.
   */
  useEffect(() => {
    if (!restaurarId) return;
    let vivo = true;

    (async () => {
      const { data } = await supabase
        .from('codex_universe_items')
        .select('id, name, tipo, description, tags, aliases, details, created_at')
        .eq('id', restaurarId)
        .maybeSingle();

      if (vivo && data) abrirNota(data);
    })();

    return () => {
      vivo = false;
    };
    // Solo al montar con un id: `abrirNota` cambia con cada tecla y volver a
    // cargar la nota encima de lo que se está escribiendo sería borrarlo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurarId]);

  /**
   * Entrar y salir del modo Vizta.
   *
   * Al salir se limpia la respuesta pero **no la pregunta**: el texto es de la
   * persona, no del modo, y borrarlo al apagar el botón perdería lo escrito por
   * tocar algo que parecía un interruptor de vista.
   */
  const alternarVizta = useCallback(() => {
    setPreguntando((p) => {
      if (p) {
        // Al salir, la conversación se pliega al cuerpo de la nota. Es el pago
        // de que el hilo sea un documento y no un chat: una sesión de
        // investigación con Vizta se puede guardar como Snippet del Codex, con
        // sus menciones ya resaltadas. Si se borrara, el trabajo se perdería
        // por apagar un botón.
        setTurnos((previos) => {
          if (previos.length) {
            const texto = previos
              .map((t) => (t.rol === 'yo' ? t.texto : t.texto.replace(/^/gm, '> ')))
              .join('\n\n');
            setCuerpo((c) => (c.trim() ? `${texto}\n\n${c}` : texto));
          }
          return [];
        });
        setHiloId(null);
        setErrorVizta(null);
      } else {
        // Hilo nuevo por cada vez que se enciende: encender y apagar es cómo se
        // empieza una conversación de cero.
        setHiloId(nuevoHilo());
      }
      return !p;
    });
    // Los dos modos se pelean por la misma superficie: el autocompletado flota
    // justo donde va la respuesta.
    setBuscando(false);
  }, []);

  const preguntar = useCallback(async () => {
    const pregunta = cuerpo.trim();
    if (!pregunta || pensando) return;

    setPensando(true);
    setErrorVizta(null);

    // La pregunta pasa al hilo y el campo queda limpio, listo para la
    // siguiente. Eso es lo que hace que continuar sea seguir escribiendo: no
    // hay que borrar lo anterior a mano.
    setTurnos((t) => [...t, { rol: 'yo', texto: pregunta }]);
    setCuerpo('');
    setDesplazar((n) => n + 1);

    try {
      const r = await consultar(pregunta, modelo, hiloId);
      toque();

      // Una respuesta vacía es un modelo que no contestó, no un acierto: se
      // dice, en vez de dejar la pantalla en blanco pareciendo que se colgó.
      if (r.text.trim()) {
        // `nueva` marca cuál se escribe a máquina. Sin la marca, cualquier
        // render volvería a animar la última y reaparecería sola.
        setTurnos((t) => [
          ...t.map((x) => (x.nueva ? { ...x, nueva: false } : x)),
          { rol: 'vizta', texto: r.text, nueva: true, herramientas: r.herramientas },
        ]);
      } else {
        setErrorVizta('El modelo no devolvió nada. Probá con otro.');
      }
    } catch (e) {
      falla();
      setErrorVizta(e.message || 'No se pudo preguntar');
    } finally {
      setPensando(false);
      setDesplazar((n) => n + 1);
    }
  }, [cuerpo, modelo, pensando, hiloId]);

  const guardar = async () => {
    if (!puedeGuardar) return;
    setGuardando(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) throw new Error('Sin sesión activa');

      const details = {};
      if (fuente.trim()) details['Fuente'] = fuente.trim();
      if (fecha.trim()) details['Fecha de captura'] = fecha.trim();

      const etiquetas = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const campos = {
        tipo: 'Snippet',
        name: tituloEfectivo.trim(),
        description: cuerpo.trim(),
        ...(etiquetas.length ? { tags: etiquetas } : {}),
        details,
      };
      const columnas = 'id, name, tipo, description, tags, aliases, details, created_at';

      // Editar una nota existente **actualiza**; si no, cada vez que abrieras
      // una del historial y tocaras guardar aparecería una copia nueva.
      const { data, error: insertError } = editandoId
        ? await supabase
            .from('codex_universe_items')
            .update(campos)
            .eq('id', editandoId)
            .select(columnas)
            .single()
        : await supabase
            .from('codex_universe_items')
            .insert({ user_id: userId, ...campos })
            .select(columnas)
            .single();

      if (insertError) throw insertError;
      // Se manda el tamaño y la cantidad de menciones, nunca el texto.
      evento(EV.NOTA_GUARDADA, {
        editada: !!editandoId,
        caracteres: cuerpo.trim().length,
        menciones: mencionados.length,
        con_detalles: !!(fuente.trim() || tags.trim() || fecha.trim()),
      });
      toque();
      onCreated?.(data);
      onClose();
    } catch (e) {
      setError(e.message || 'No se pudo guardar');
      setGuardando(false);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: PAPEL }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          {/* Barra mínima, compartida por las tres páginas. Guardar aparece
              solo cuando hay algo que guardar: un botón permanentemente
              apagado es ruido que nunca sirve. */}
          {/* La barra que te acompaña.
              
              Lleva fondo de papel y un degradado corto abajo, y eso es lo que
              la vuelve una barra en vez de unos íconos flotando. Antes el texto
              pasaba **por detrás** de los controles al desplazar: con la «X»
              sola se toleraba —es un glifo, se lee como una capa encima— pero
              con el hilo la hoja se vuelve larga enseguida y ahí los renglones
              se enredaban con la etiqueta del modelo hasta no poder leer
              ninguna de las dos.
              
              Con el papel detrás, el contenido se desvanece antes de llegar y
              la barra viaja limpia sobre el hilo. Sigue estando encima de la
              hoja, que es lo que mantiene la sensación de una sola superficie:
              no es una cabecera separada con su costura. */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingTop: topInset + 12,
              paddingHorizontal: 18,
              paddingBottom: 6,
              backgroundColor: PAPEL,
              zIndex: 2,
            }}
          >
            <Pressable
              onPress={() => {
                // Distingue cerrar con algo escrito de cerrar en blanco: lo
                // primero es abandonar una nota, lo segundo es solo salir.
                evento(EV.NOTA_DESCARTADA, { tenia_texto: cuerpo.trim().length > 0 });
                onClose();
              }}
              hitSlop={12}
              style={{ padding: 6 }}
            >
              <X size={19} color={INK.faint} />
            </Pressable>

            {/* El modelo, al lado de la X. Es contexto de lo que se está
                haciendo —con qué se va a preguntar— y el contexto vive a la
                izquierda; la derecha son las acciones. */}
            {pagina === NOTA && preguntando ? (
              <Animated.View entering={FadeIn.duration(220)}>
                <Pressable
                  onPress={() => {
                    roce();
                    setEligiendoModelo(true);
                  }}
                  hitSlop={8}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 5,
                    paddingHorizontal: 8,
                    paddingVertical: 5,
                    opacity: pressed ? 0.5 : 1,
                  })}
                  accessibilityRole="button"
                  accessibilityLabel={`Modelo: ${nombreModelo}. Tocá para cambiarlo`}
                >
                  <Text
                    numberOfLines={1}
                    style={{ fontFamily: MONO, fontSize: 11, color: 'rgba(28,43,34,0.42)', maxWidth: 168 }}
                  >
                    {sinProveedor(nombreModelo)}
                  </Text>
                  <ChevronDown size={12} color="rgba(28,43,34,0.34)" />
                </Pressable>
              </Animated.View>
            ) : null}

            <View style={{ flex: 1 }} />

            {/* Enciende el autocompletado del Codex. Solo en la página de la
                nota: es lo que se escribe lo que se busca, y en el historial y
                en el panel no hay nada escribiéndose. */}
            {pagina === NOTA ? (
              <GlassButton
                Icon={Search}
                activo={buscando}
                size={34}
                iconSize={15}
                radius={11}
                onPress={() => setBuscando((b) => !b)}
                style={{ marginRight: 10 }}
              />
            ) : null}

            {/* Preguntarle a Vizta. Es el mismo espacio de escritura: lo que se
                escribe deja de ser una nota y pasa a ser una pregunta, y por eso
                es un modo y no otra pantalla. */}
            {pagina === NOTA && puedePreguntar ? (
              <GlassButton
                Icon={Send}
                activo={preguntando}
                size={34}
                iconSize={15}
                radius={11}
                onPress={alternarVizta}
                style={{ marginRight: accionVisible ? 12 : 0 }}
              />
            ) : null}

            {accionVisible ? (
              <Animated.View entering={FadeIn.duration(200)}>
                <Pressable
                  onPress={preguntando ? preguntar : guardar}
                  disabled={guardando}
                  hitSlop={12}
                  style={{ padding: 6 }}
                >
                  {guardando ? (
                    <MorphingInfinity size={18} color={INK.title} />
                  ) : (
                    <Text style={{ fontFamily: MONO, fontSize: 14, color: INK.title, letterSpacing: -0.2 }}>
                      {preguntando ? 'enviar' : 'guardar'}
                    </Text>
                  )}
                </Pressable>
              </Animated.View>
            ) : null}
          </View>

          {/* El desvanecido. `pointerEvents="none"` porque es pintura: si se
              quedara los toques, robaría la primera línea de texto. */}
          <LinearGradient
            pointerEvents="none"
            // El transparente tiene que ser **el mismo papel con alfa 0**. Con
            // cualquier otro RGB, el degradado interpola hacia ese color y deja
            // un tinte gris en la mitad del recorrido.
            colors={[PAPEL, 'rgba(255,253,248,0)']}
            style={{ height: 20, marginBottom: -20, zIndex: 2 }}
          />

          <ScrollView
            ref={pager}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentOffset={{ x: W, y: 0 }} // arranca en la nota
            onMomentumScrollEnd={(e) => {
              const p = Math.round(e.nativeEvent.contentOffset.x / W);
              if (p !== pagina) {
                setPagina(p);
                roce();
                evento(EV.NOTA_PAGINA_VISTA, {
                  pagina: p === HISTORIAL ? 'historial' : p === PANEL ? 'panel' : 'nota',
                });
              }
            }}
            style={{ flex: 1, marginTop: -46 }}
          >
            <View style={{ width: W }}>
              <HistorialSnippets
                topInset={topInset}
                bottomInset={bottomInset}
                onAbrir={abrirNota}
              />
            </View>

            <View style={{ width: W }}>
              <Nota
                campo={campo}
                tramos={tramos}
                onChangeText={escribir}
                onSelectionChange={alSeleccionar}
                seleccion={cursorImpuesto}
                topInset={topInset}
                bottomInset={bottomInset}
                error={error}
                // El hilo va **arriba** del campo, no abajo: la hoja se lee de
                // arriba a abajo como cualquier documento, y lo que se está
                // escribiendo es lo último. Al revés habría que leer para
                // atrás.
                hilo={
                  preguntando ? (
                    <HiloVizta turnos={turnos} pensando={pensando} error={errorVizta} />
                  ) : null
                }
                desplazar={desplazar}
              />
            </View>

            <View style={{ width: W }}>
              <PanelSnippet
                items={mencionados}
                onAbrirItem={(item) => {
            evento(EV.MENCION_TOCADA, { tipo: item?.tipo || null });
            setItemAbierto(item);
          }}
                titulo={tituloTocado ? titulo : tituloEfectivo}
                tituloPlaceholder={tituloEfectivo}
                onTitulo={(t) => {
                  setTituloTocado(true);
                  setTitulo(t);
                }}
                fuente={fuente}
                onFuente={setFuente}
                tags={tags}
                onTags={setTags}
                fecha={fecha}
                onFecha={setFecha}
                topInset={topInset}
                bottomInset={bottomInset}
              />
            </View>
          </ScrollView>

          {/* El autocompletado, flotando sobre la nota.

              Va anclado abajo y sube con el teclado, en la misma capa que los
              puntos pero por encima: lo que se acaba de escribir está justo
              arriba del teclado, así que las sugerencias tienen que aparecer
              ahí y no al otro extremo de la hoja.

              `pointerEvents="box-none"` para que el papel de al lado del panel
              siga enfocando el campo: el panel es angosto y no tiene por qué
              robarse los toques de la nota que sigue debajo. */}
          {pagina === NOTA && buscando ? (
            <Animated.View
              pointerEvents="box-none"
              style={[
                { position: 'absolute', left: 22, right: 22, bottom: bottomInset + 62 },
                sobreTeclado,
              ]}
            >
              <AutocompletarCodex
                indice={indice}
                texto={cuerpo}
                cursor={seleccion.start}
                onCompletar={completarCon}
                onAbrirItem={(item) => {
                  evento(EV.MENCION_TOCADA, { tipo: item?.tipo || null });
                  setItemAbierto(item);
                }}
                bottomInset={bottomInset}
              />
            </Animated.View>
          ) : null}

          {/* Crear un item con lo que seleccionaste. Aparece solo mientras hay
              selección y solo en la nota — en las otras páginas no hay texto
              del que sacarlo. Va abajo y no arriba para no pelearse con el menú
              de copiar/pegar que iOS pone sobre la selección. */}
          {/* Barra de abajo: o el botón de crear, o los puntos. Una sola capa
              que sube con el teclado, para que ninguno de los dos quede tapado. */}
          <Animated.View
            pointerEvents="box-none"
            style={[
              { position: 'absolute', left: 0, right: 0, bottom: bottomInset + 16, alignItems: 'center' },
              sobreTeclado,
            ]}
          >
          {pagina === NOTA && seleccionado.length >= 2 ? (
            <Animated.View entering={FadeInDown.duration(220).springify().damping(20)}>
              <Pressable
                onPress={() => {
                  roce();
                  Keyboard.dismiss();
                  evento(EV.ITEM_CREADO_DESDE_SELECCION, { largo: seleccionado.length });
                  setItemAbierto({ _nuevo: true, tipo: 'Actor', name: seleccionado, description: '', details: {} });
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 7,
                  paddingHorizontal: 15,
                  paddingVertical: 10,
                  borderRadius: 999,
                  backgroundColor: INK.title,
                  opacity: pressed ? 0.8 : 1,
                })}
                accessibilityRole="button"
                accessibilityLabel={`Crear item del Codex con «${seleccionado}»`}
              >
                <Plus size={14} color={PAPEL} />
                <Text numberOfLines={1} style={{ fontFamily: MONO, fontSize: 12.5, color: PAPEL, maxWidth: 230 }}>
                  crear «{seleccionado}»
                </Text>
              </Pressable>
            </Animated.View>
          ) : (
            <Puntos actual={pagina} onIr={irA} />
          )}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>

      {/* Ficha del Codex encima de la hoja: una nota del historial, un
          mencionado, o uno nuevo salido de la selección. */}
      {/* Elegir modelo. Va antes que la ficha porque iOS presenta un Modal a la
          vez, y desde el selector no se abre ninguna ficha. */}
      {eligiendoModelo ? (
        <SelectorModelo
          onCerrar={() => setEligiendoModelo(false)}
          topInset={topInset}
          bottomInset={bottomInset}
        />
      ) : null}

      {itemAbierto ? (
        <ItemDetailSheet
          item={itemVivo}
          creando={!!itemAbierto._nuevo}
          onClose={() => setItemAbierto(null)}
          onSaved={(guardado) => {
            // El item nuevo tiene que pintarse en la nota en el acto; si no, el
            // nombre se queda en negro hasta cerrar y volver a abrir la hoja.
            refrescar();
            // Y el editado se deja en el cache con lo recién guardado. Ver
            // `actualizar`: borrarlo para forzar la relectura dejaba una ventana
            // en la que el chip volvía a estar recortado.
            actualizar(guardado);
            setItemAbierto(null);
          }}
          bottomInset={bottomInset}
        />
      ) : null}
    </Modal>
  );
}

/**
 * La hoja.
 *
 * El texto va como hijos y no como `value`. Es la única forma de pintar tramos
 * sueltos adentro de un TextInput en React Native: `value` acepta una cadena, y
 * una cadena no lleva color por pedazos. Con hijos, cada mención es su propio
 * <Text> con su color, y el resto sigue siendo texto normal — todo dentro del
 * mismo campo editable, sin capas superpuestas que se desalineen al scrollear.
 */
function Nota({
  campo,
  tramos,
  onChangeText,
  onSelectionChange,
  seleccion,
  topInset,
  bottomInset,
  error,
  hilo,
  desplazar,
}) {
  const hoja = useRef(null);

  /**
   * Seguir el hilo hacia abajo.
   *
   * Sin esto, el tercer o cuarto turno deja el campo por debajo del borde de la
   * pantalla y cada pregunta empieza con un desplazamiento a mano. Se dispara
   * al mandar y al recibir, que son los dos momentos en que la hoja crece.
   *
   * El retraso es por el orden de las cosas: el efecto corre cuando React ya
   * aplicó el cambio de estado, pero el `ScrollView` todavía no midió el
   * contenido nuevo, así que desplazarse en ese instante llega al final
   * *anterior*. Un cuadro después ya hay a dónde ir.
   */
  useEffect(() => {
    if (!desplazar) return;
    const t = setTimeout(() => hoja.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [desplazar]);

  return (
    <ScrollView
      ref={hoja}
      contentContainerStyle={{ flexGrow: 1, paddingTop: topInset + 66, paddingBottom: bottomInset + 70 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    >
      {/* Medida angosta y centrada en la pantalla; el texto, a la izquierda
          dentro de la columna. */}
      <View style={{ flex: 1, alignSelf: 'center', width: '100%', maxWidth: 420, paddingHorizontal: 30 }}>
        {/* Toda la zona vacía enfoca el campo: la página entera se siente
            escribible, no solo el renglón donde está el cursor. Leyendo una nota
            existente, el mismo toque es el que pasa a escribir — igual que en
            las notas de iOS, donde tocar el texto pone el cursor. */}
        {hilo}

        <Pressable
          onPress={() => {
            campo.current?.focus();
          }}
          style={{ flex: 1 }}
        >
          <TextInput
            ref={campo}
            onChangeText={onChangeText}
            onSelectionChange={onSelectionChange}
            // Solo cuando el autocompletado acaba de mover el cursor. El resto
            // del tiempo va sin controlar, que es lo que deja escribir normal:
            // un `selection` fijo le clavaría el cursor en un lugar.
            selection={seleccion || undefined}
            placeholder="escribí lo que quieras…"
            placeholderTextColor="rgba(28,43,34,0.22)"
            multiline
            // El teclado no se abre solo, ni siquiera en una nota nueva.
            //
            // Antes `autoFocus` lo levantaba al montar la hoja, y como la hoja
            // es la misma para escribir y para leer, abrir una nota del
            // historial para releerla también lo traía: media pantalla tapada
            // por un teclado que nadie pidió, y había que bajarlo a mano cada
            // vez. Escribir cuesta un toque más; leer deja de costar uno.
            scrollEnabled={false}
            style={{
              fontFamily: MONO,
              fontSize: 15,
              lineHeight: 27,
              color: INK.title,
              // Con el hilo arriba, el campo se achica a lo que se está
              // escribiendo: con los 260 de siempre, quedaría un hueco en
              // blanco enorme entre la última respuesta y el cursor.
              minHeight: hilo ? 64 : 260,
              textAlignVertical: 'top',
              padding: 0,
            }}
          >
            {tramos.map((t, i) =>
              t.item ? (
                // Sin `onPress`: un `Text` anidado dentro de un `TextInput` no
                // lo recibe —el campo se queda el toque para poner el cursor—.
                // Quién se tocó lo resuelve `alSeleccionar` mirando dónde quedó
                // ese cursor, que es el mismo dato por otro camino.
                <Text key={i} style={{ color: colorDe(t.item) }}>
                  {t.texto}
                </Text>
              ) : (
                t.texto
              )
            )}
          </TextInput>
        </Pressable>

        {error ? (
          <Animated.View entering={FadeIn.duration(200)} style={{ marginTop: 22 }}>
            <Text style={{ fontFamily: MONO, fontSize: 12.5, color: '#B91C1C', lineHeight: 19 }}>{error}</Text>
          </Animated.View>
        ) : null}
      </View>
    </ScrollView>
  );
}

/**
 * Tres puntos.
 *
 * El deslizamiento lateral no se ve, y una hoja en blanco no da ninguna pista
 * de que tiene páginas al lado. Estos puntos son esa pista — y además son
 * tocables, que es la salida para quien nunca prueba deslizar.
 */
function Puntos({ actual, onIr }) {
  return (
    <View
      pointerEvents="box-none"
      style={{ flexDirection: 'row', justifyContent: 'center', gap: 7 }}
    >
      {[HISTORIAL, NOTA, PANEL].map((p) => (
        <Punto key={p} activo={p === actual} onPress={() => onIr(p)} />
      ))}
    </View>
  );
}

function Punto({ activo, onPress }) {
  const animado = useAnimatedStyle(() => ({
    width: withSpring(activo ? 15 : 5, MOTION.tap),
    opacity: withTiming(activo ? 0.42 : 0.16, { duration: 220 }),
  }));

  return (
    <Pressable onPress={onPress} hitSlop={14} accessibilityRole="button">
      <Animated.View style={[{ height: 5, borderRadius: 3, backgroundColor: INK.title }, animado]} />
    </Pressable>
  );
}

/**
 * Color de una mención.
 *
 * Sale de `TYPE_ACCENT`, la misma paleta con la que el Codex ya distingue sus
 * tipos: un Actor se ve del mismo color acá que en su ficha. Inventar una
 * paleta nueva solo para la nota habría hecho que el mismo item tenga dos
 * colores según dónde lo mires.
 */
function colorDe(item) {
  return TYPE_ACCENT[normalizeTipo(item?.tipo)] || '#4B4FA6';
}
