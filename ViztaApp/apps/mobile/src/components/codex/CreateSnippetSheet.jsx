import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  ActivityIndicator,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
  Alert,
  Platform,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Extrapolation,
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  ZoomIn,
  ZoomOut,
  interpolate,
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  X,
  Plus,
  Search,
  Send,
  ChevronDown,
  Camera,
  LocateFixed,
  Mic,
  MapPin,
  Type,
  Layers,
  Check,
  FileText,
} from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import { INK, MOTION } from '../theme';
import MorphingInfinity from '../MorphingInfinity';
import { PAPEL } from './Papel';
import { MONO } from './mono';
import { colorDe, tinta } from './tinta';
import { segmentar } from './menciones';
import useIndiceCodex from './useIndiceCodex';
import useItemsHidratados from './useItemsHidratados';
import HistorialSnippets from './HistorialSnippets';
import Espacios from './Espacios';
import CreateSpaceSheet from './CreateSpaceSheet';
import SegmentedSlider from '../SegmentedSlider';
import AutocompletarCodex from './AutocompletarCodex';
import HiloVizta from './HiloVizta';
import SelectorModelo from './SelectorModelo';
import { consultar, nuevoHilo } from '../../services/viztaRapido';
import { useModeloStore } from '../../state/modeloStore';
import { completar, mencionEn } from './buscarCodex';
import GlassButton from '../GlassButton';
import PanelSnippet from './PanelSnippet';
import PromptSistema from './PromptSistema';
import BandejaFotos from './BandejaFotos';
import { conFormato, estiloDePieza, aplicarFormato } from './formato';
import BarraFormato from './BarraFormato';
import Adjuntas, { VisorFoto } from './Adjuntas';
import { subirImagen, subirGrabacion, borrarMedio, firmarMedio } from '../../utils/subirMedio';
import { Audios } from './Audios';
import GrabadorVoz from './GrabadorVoz';
import Pista from '../Pista';
import { usePistasStore, PISTA } from '../../state/pistasStore';
import ItemDetailSheet from './ItemDetailSheet';
import DecidirMencion from './DecidirMencion';
import useVeredictos from './useVeredictos';
import { toque, roce, falla } from '../../utils/haptics';
import { EV, evento } from '../../utils/analitica';
import { supabase } from '../../utils/supabase';
import { geoDePunto } from './geo';
import { donde, pedirEnUso } from '../../services/ubicacion';
import MiniMapa from './MiniMapa';
import BuscarLugar from '../mapa/BuscarLugar';
import { addItemsToSpace, agregarHistoria, listSpaces, notaPrincipalDe, quitarHistoria } from '../../utils/codexSpaces';
import { indiceDeHistoria, renglonesHasta } from './historia';
import DocumentosNota from './DocumentosNota';
import { borrarDocumentoNota, firmarDocumentoNota, subirDocumentoNota } from '../../utils/subirDocumento';
import { useEspacioElegidoStore } from '../../state/espacioElegidoStore';
import { usePulseConnectionStore } from '../../state/pulseConnectionStore';
import { LinearGradient } from 'expo-linear-gradient';
import { KeyboardAwareScrollView, KeyboardProvider } from 'react-native-keyboard-controller';
import { useEditorBloques } from '../../utils/editorBloques';
import useEditorDeNota from './bloques/useEditorDeNota';
import EditorBloques from './bloques/EditorBloques';
import AutocompletarBloques from './bloques/AutocompletarBloques';
import { borrarBorrador } from './bloques/persistencia';
import BarraSeleccion from './bloques/BarraSeleccion';
import PanelFormato from './bloques/PanelFormato';
import PanelInsertar from './bloques/PanelInsertar';
import { ACCIONES as ACCIONES_A_MANO, useAMano } from './bloques/aMano';
import { indiceDelDocumento } from './bloques/indice';
import { firmaDeMedios, raizDe } from '../../documento/editor';
import { useStore } from 'zustand';
import { TablaDeDataset } from './bloques/Datasheet';
import { FilaDeHistoria, FilasDeHistoria } from './bloques/HistoriaDatasheet';
import { datasheets } from './bloques/datasheets';

// Las tres páginas. La nota va al medio para que las otras dos estén a un
// deslizamiento de distancia en cualquier dirección, y para que abrir la hoja
// caiga siempre en el lugar donde se escribe.
const HISTORIAL = 0;
const NOTA = 1;
const PANEL = 2;

/**
 * Dónde viven las fotos de una nota.
 *
 * En `details`, bajo una clave técnica y no bajo una etiqueta legible como
 * «Fuente» o «Fecha de captura». Las etiquetas de `details` son campos de
 * investigación y la ficha las pinta como renglones de texto: una lista de
 * objetos ahí se vería como un renglón de basura. Con prefijo `usr_` —el mismo
 * que ya usa `usr_sintetico`— y anotada en `INTERNAL_KEYS`, la ficha sabe que
 * no es un campo que deba escribir.
 */
const CLAVE_FOTOS = 'usr_imagenes';

/**
 * Los audios, en su propia clave.
 *
 * Hermana de `usr_imagenes` en vez de un `usr_medios` que unifique las dos. La
 * unificación sería más limpia de acá en adelante, pero obliga a migrar las
 * notas que ya tienen fotos —incluidas las que vivan en la web o en otro
 * teléfono— y eso es un riesgo que no paga la prolijidad.
 */
const CLAVE_AUDIOS = 'usr_audios';

/** Las fotos guardadas de una nota, en la forma que usa la hoja. */
/** Los audios guardados de una nota, en la forma que usa la hoja. */
/**
 * El punto de un `geo`, venga como `anchor` o como geometría.
 *
 * Las dos formas conviven en la base: `anchor` lo escribe `geoDePunto`, y la
 * geometría es lo que queda de un lugar guardado desde el mapa. Leer solo una
 * dejaría notas con ubicación mostrando «sin ubicación».
 */
function puntoDeGeo(geo) {
  const a = geo?.anchor;
  if (a && Number.isFinite(Number(a.lat)) && Number.isFinite(Number(a.lng))) {
    return { lat: Number(a.lat), lng: Number(a.lng) };
  }
  const c = geo?.geometry?.type === 'Point' ? geo.geometry.coordinates : null;
  if (Array.isArray(c) && Number.isFinite(Number(c[0])) && Number.isFinite(Number(c[1]))) {
    return { lat: Number(c[1]), lng: Number(c[0]) };
  }
  return null;
}

function audiosDe(nota) {
  const guardados = nota?.details?.[CLAVE_AUDIOS];
  if (!Array.isArray(guardados)) return [];
  return guardados
    .filter((a) => a && (typeof a.url === 'string' || typeof a.storage_path === 'string'))
    .map((a, i) => ({
      id: a.storage_path || `${a.url}-${i}`,
      local: null,
      url: a.url,
      storage_path: a.storage_path || null,
      nombre: a.nombre || 'Nota de voz',
      tamano: a.tamano || 0,
      duracion_ms: a.duracion_ms || 0,
      subiendo: false,
      error: false,
    }));
}

function fotosDe(nota) {
  const guardadas = nota?.details?.[CLAVE_FOTOS];
  if (!Array.isArray(guardadas)) return [];
  return guardadas
    .filter((f) => f && (typeof f.url === 'string' || typeof f.storage_path === 'string'))
    .map((f, i) => ({
      id: f.storage_path || `${f.url}-${i}`,
      local: null,
      url: f.url,
      storage_path: f.storage_path || null,
      ancho: f.ancho || null,
      alto: f.alto || null,
      subiendo: false,
      error: false,
    }));
}

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
 *  · **derecha, el panel** — a quién nombraste, y los datos de la nota. En modo
 *    chat los nombrados siguen siendo los nombrados —ahora los de la
 *    conversación— y lo que cambia es la mitad de abajo: los detalles del
 *    snippet dejan lugar a las instrucciones con las que Vizta contesta.
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
  /**
   * Dónde pasó esto: `{ lat, lng, nombre?, direccion?, lugarId? }`.
   *
   * Llega desde el mapa, al elegir «escribir una nota acá». La nota guarda su
   * propio punto —no una referencia a un lugar— porque una nota ubicada existe
   * aunque nadie haya guardado ese sitio: una esquina sin nombre es un dónde
   * perfectamente válido. Si el punto vino de un lugar guardado, se anota
   * además de cuál, sin que la nota dependa de él.
   */
  ubicacion: ubicacionInicial = null,
  /**
   * Abrir la hoja directo en la nota principal de un espacio: `{ id, name }`.
   * Lo usa la pestaña del Codex al abrir un espacio. Si todavía no tiene nota
   * principal, la hoja arranca una en blanco que al guardar queda marcada.
   */
  espacioPrincipal = null,
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
  // El cheque que reemplaza un momento a «guardar»: guardar ya no cierra la
  // hoja, así que algo tiene que decir que se guardó.
  const [guardadoOk, setGuardadoOk] = useState(false);
  const relojOk = useRef(null);
  useEffect(() => () => clearTimeout(relojOk.current), []);
  const [error, setError] = useState(null);
  // El aviso se va solo después de un rato: quedarse pegado sobre la nota
  // estorba más de lo que avisa.
  useEffect(() => {
    if (!error) return undefined;
    const t = setTimeout(() => setError(null), 7000);
    return () => clearTimeout(t);
  }, [error]);
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
  // Los dos botones de Espacios, adentro de un espacio: «+» suma algo del
  // Codex, la lupa busca entre lo que ya está. Solo tienen sentido con un
  // espacio abierto, así que se sabe cuál es.
  const [espacioAbierto, setEspacioAbierto] = useState(null);
  const [panelEspacio, setPanelEspacio] = useState(null); // null | 'agregar' | 'buscar'
  useEffect(() => {
    if (!espacioAbierto) setPanelEspacio(null);
  }, [espacioAbierto]);

  // Fotos adjuntas a la nota, y si la bandeja o la cámara están a la vista.
  const [fotos, setFotos] = useState([]);
  const [audios, setAudios] = useState([]);
  /**
   * Los documentos de la nota. Los que ya están guardados traen `id` (su fila
   * en `nota_documentos`); los recién subidos no, y se registran al guardar.
   * Quitar uno guardado se hace efectivo al guardar, igual que las fotos.
   */
  const [documentos, setDocumentos] = useState([]);
  const docsQuitados = useRef([]);
  const [mostrandoFotos, setMostrandoFotos] = useState(false);
  // La tira de formato. Vive donde la bandeja y la grabadora, y como ellas, es
  // excluyente: las tres ocupan el mismo hueco sobre el teclado.
  const [formateando, setFormateando] = useState(false);
  // El panel de `+`: lo que se agrega a la nota (solo con el editor de bloques).
  const [insertando, setInsertando] = useState(false);
  const [grabando, setGrabando] = useState(false);

  const marcarPista = usePistasStore((s) => s.marcar);

  // Foto a pantalla completa. Vive acá y no dentro de `Adjuntas` porque ahora
  // se abre desde dos lugares —la hoja y el panel— y el visor tiene que ser el
  // mismo: dos copias se desincronizan a la primera que se toque.
  const [fotoAbierta, setFotoAbierta] = useState(null);

  /**
   * Leer o escribir.
   *
   * La hoja arranca **leyendo** siempre — nota nueva incluida. Es lo mismo que
   * decidió el borrado de `autoFocus`, llevado hasta el final: el teclado no
   * aparece si nadie lo pidió, y pedirlo son dos toques.
   */
  const [escribiendo, setEscribiendo] = useState(false);

  /**
   * Dónde pasó esto.
   *
   * Empieza en lo que trajo quien abrió la hoja —el mapa manda un punto al
   * elegir «escribir una nota acá»— pero es estado, no prop fija: desde la nota
   * se puede poner, cambiar o quitar, y eso tiene que sobrevivir a que el mapa
   * no vuelva a decir nada.
   */
  const [ubicacion, setUbicacion] = useState(ubicacionInicial);
  const [eligiendoUbicacion, setEligiendoUbicacion] = useState(false);
  // Dónde se guarda la nota: la lista se pide al abrir el selector, no antes.
  const [eligiendoEspacio, setEligiendoEspacio] = useState(false);
  const [espaciosParaGuardar, setEspaciosParaGuardar] = useState(null);
  const [buscandoLugar, setBuscandoLugar] = useState(false);

  // Declarado acá y no más abajo, con el resto del bloque de Vizta: el
  // marcador de la hoja lo lee unas líneas más adelante, y un `const` usado
  // antes de su declaración es un error en tiempo de ejecución, no un aviso.
  const [preguntando, setPreguntando] = useState(false);

  /**
   * Qué dice la hoja cuando está en blanco.
   *
   * El mismo campo hace tres cosas —se escribe una nota, se busca en el Codex,
   * se le pregunta a Vizta— y el marcador es lo único que lo dice. Con un
   * «escribí lo que quieras…» fijo, encender la búsqueda o el chat no cambiaba
   * nada en pantalla salvo un botón teñido: el campo seguía invitando a
   * escribir una nota.
   *
   * Solo se ve con la hoja vacía, que es cuando un marcador se ve: apenas hay
   * texto, el modo se lee en lo que está pasando —las sugerencias flotando, el
   * hilo arriba— y no hace falta anunciarlo.
   */
  const marcador = preguntando
    ? 'preguntale a Vizta…'
    : buscando
      ? 'buscá un elemento…'
      : 'escribí lo que quieras…';

  /**
   * El foco va **después** de que el campo sea editable.
   *
   * `focus()` sobre un `TextInput` con `editable={false}` no hace nada, y en el
   * mismo ciclo en que se prende el estado el campo todavía no se re-renderizó.
   * Un cuadro después ya es editable y el foco entra.
   */
  useEffect(() => {
    if (!escribiendo) return;
    // Ya sabe cómo se escribe: la pista no vuelve.
    marcarPista(PISTA.ESCRIBIR);
    const t = setTimeout(() => campo.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [escribiendo, marcarPista]);

  // Al cambiar de página o entrar al chat, se vuelve a leer: el teclado abierto
  // en una página donde no se escribe es un teclado que sobra.
  useEffect(() => {
    if (pagina !== NOTA || preguntando) setEscribiendo(false);
  }, [pagina, preguntando]);

  /**
   * El switch de Notas/Espacios se encoge al escribir; no desaparece.
   *
   * Abierto no entra junto a guardar: la fila completa pide unos 411 puntos y
   * el teléfono da 374. Pero esconderlo entero borraba el dato de dónde estás
   * justo mientras escribís ahí. Así que se queda solo con el segmento activo
   * —una pastilla que dice «Notas»— y la pestaña de al lado se guarda detrás.
   * Encogido mide 77 y todo entra con aire.
   *
   * Encogido no solo mientras escribís: **siempre que guardar esté a la vista**,
   * porque los dos no entran juntos. Comparten el lugar. Ver `recogido`.
   */
  const switchAncho = 148;
  const switchSegmento = (switchAncho - 6) / 2; // la pista tiene 3 de aire por lado
  const switchRecogido = switchSegmento + 6;
  const navAbierto = useSharedValue(1);
  const yaEscribia = useRef(false);

  // La caja recorta con bordes redondos: el corte tiene que verse como el borde
  // de una pastilla, no como un switch serruchado a la mitad.
  const estiloSwitch = useAnimatedStyle(() => ({
    width: interpolate(navAbierto.value, [0, 1], [switchRecogido, switchAncho], Extrapolation.CLAMP),
  }));

  /**
   * Qué fotos ya están escritas en la nota que hay en la base.
   *
   * Sirve para saber cuáles quedarían huérfanas al descartar. Una foto se sube
   * apenas se toca —para que aparezca en el acto—, así que si después cerrás la
   * hoja sin guardar, esos bytes quedan en el bucket referenciados por nada, y
   * nadie los va a encontrar nunca para borrarlos. Es la misma limpieza que
   * `subirDocumento` hace cuando la fila no entra.
   */
  const yaEnLaBase = useRef(new Set());

  /**
   * Fotos quitadas de una nota **ya guardada**, esperando el próximo guardado.
   *
   * No se borran al quitarlas. La fila en la base todavía las menciona, así que
   * borrar el archivo ahí dejaba la nota apuntando a algo que ya no existe en
   * cuanto descartabas los cambios o fallaba el guardado — y eso no se puede
   * deshacer: la imagen queda rota para siempre. Se borran recién cuando el
   * guardado confirma que la nota dejó de nombrarlas.
   */
  const retiradas = useRef(new Set());

  /**
   * Fotos quitadas **mientras todavía subían**.
   *
   * Al quitarlas no hay `storage_path` que borrar —la subida no terminó— pero
   * termina igual y deja el archivo en el bucket sin que nada lo referencie.
   * `adjuntar` mira esta lista al terminar y lo borra ahí.
   */
  const canceladas = useRef(new Set());

  /**
   * Soltar las fotos que la hoja deja de referenciar.
   *
   * Se usa al cerrar y al cambiar de nota, que son los dos momentos en que el
   * estado se abandona entero.
   *
   * **Las que están subiendo se marcan, no se saltean.** Antes este recorrido
   * solo miraba `storage_path`, y una subida en curso todavía no lo tiene: se
   * la salteaba y acto seguido se vaciaba `canceladas`, así que al terminar
   * `adjuntar` no reconocía que nadie la quería y el archivo se quedaba en el
   * bucket para siempre. La marca tiene que **sobrevivir** a que la hoja se
   * cierre — por eso `canceladas` no se limpia acá: `adjuntar` la lee desde su
   * propio cierre, que sigue vivo aunque el componente ya no esté montado.
   *
   * Las **retiradas** sí se limpian: al abandonar sin guardar, la fila de la
   * base sigue siendo la vieja y sigue nombrándolas.
   */
  const soltarFotos = useCallback((lista) => {
    for (const f of lista) {
      if (f.subiendo) canceladas.current.add(f.id);
      else if (f.storage_path && !yaEnLaBase.current.has(f.storage_path)) borrarMedio(f.storage_path);
    }
    retiradas.current.clear();
  }, []);

  /** Los documentos subidos para esta nota y nunca guardados: sus archivos se van. */
  const soltarDocumentos = useCallback((lista) => {
    for (const d of lista || []) if (!d.id && d.storage_path) borrarDocumentoNota(d.storage_path);
    docsQuitados.current = [];
  }, []);

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

  /**
   * Los dos oficios de la hoja: escribir y mirar.
   *
   * No es una página más del pager. Las tres páginas de al lado
   * —historial, nota, panel— son tres vistas **de lo mismo que estás
   * escribiendo**, y se pasan de largo con el dedo justamente porque son
   * vecinas. Espacios no es vecino de nada: es la otra cosa que se puede hacer
   * acá. Por eso se cambia con un switch explícito y no deslizando, y por eso
   * reemplaza al pager entero en vez de sumarse a la fila.
   */
  /**
   * La pantalla con la que abre: donde la dejaste. Si la hoja se abre para
   * algo puntual —restaurar una nota, la historia de un espacio—, va a Notas,
   * que es lo que se pidió.
   */
  const abreEnAlgo = !!(restaurarId || espacioPrincipal?.id);
  const [modo, setModo] = useState(() =>
    abreEnAlgo ? 'notas' : useEspacioElegidoStore.getState().pantalla || 'notas'
  ); // 'notas' | 'espacios'
  const enNotas = modo === 'notas';

  // El recuerdo se lee del disco un instante después de arrancar la app. Si la
  // hoja se abrió antes, se corrige al llegar —solo si todavía no se tocó nada—.
  const modoTocado = useRef(false);
  useEffect(() => {
    if (abreEnAlgo || useEspacioElegidoStore.persist.hasHydrated()) return undefined;
    return useEspacioElegidoStore.persist.onFinishHydration((st) => {
      if (!modoTocado.current) setModo(st.pantalla || 'notas');
    });
  }, [abreEnAlgo]);

  // Se guarda solo con el recuerdo ya leído: antes, guardar «notas» pisaría en
  // el disco la pantalla que se estaba por restaurar.
  const recordarPantalla = useEspacioElegidoStore((st) => st.recordarPantalla);
  useEffect(() => {
    if (!useEspacioElegidoStore.persist.hasHydrated()) return;
    recordarPantalla(modo);
  }, [modo, recordarPantalla]);

  // Si el activo es el segundo segmento, la pista se corre para que el recorte
  // deje a la vista ese y no el primero. Hoy solo se escribe en Notas, así que
  // no pasa; queda para que el switch nunca muestre el segmento equivocado.
  const indiceModo = enNotas ? 0 : 1;
  const estiloSwitchInterior = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(
          navAbierto.value,
          [0, 1],
          [-switchSegmento * indiceModo, 0],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));

  // Espacio abierto encima de la hoja, y su caratúla de origen para el morph.
  const [creandoEspacio, setCreandoEspacio] = useState(false);
  const [recargaEspacios, setRecargaEspacios] = useState(0);
  // Si se tocó «una nota» estando adentro de un espacio, guardar la crea
  // y la deja adentro. `null` = nota suelta, como siempre.
  const [espacioDestino, setEspacioDestino] = useState(null);

  /**
   * De qué espacio es la nota principal la que está en la hoja, si lo es.
   *
   * El documento de un espacio ya no es un editor de bloques aparte: es una
   * nota, escrita en esta misma hoja, marcada como la principal del espacio.
   * Esto guarda de cuál, para marcarla al guardar si es nueva y para decirlo
   * arriba de la hoja.
   */
  const [principalDe, setPrincipalDe] = useState(null);
  // De qué espacio era historia la nota al abrirla. Si al guardar ya no lo es
  // —se desmarcó la casilla o se llevó a otro espacio—, se la saca de ahí.
  const [historiaAlAbrir, setHistoriaAlAbrir] = useState(null);

  const campo = useRef(null);
  const pager = useRef(null);

  // Menciones del Codex: se pintan los nombres de tus items mientras escribís.
  // El índice puede llegar vacío (sin sesión, o si falla la carga); en ese caso
  // `segmentar` devuelve un solo tramo sin color y la nota funciona igual.
  const { indice, refrescar } = useIndiceCodex();

  /**
   * El editor de bloques (STA-190), para quien tiene el interruptor.
   *
   * Reemplaza al campo único de la nota, salvo en el modo Vizta: ahí el campo
   * es la pregunta que se va a mandar, no la nota, y sigue siendo el simple.
   * La hoja sigue leyendo `cuerpo`; el editor lo mantiene al día.
   */
  const conBloques = useEditorBloques();
  const bloquesActivo = conBloques && !preguntando;
  const edicion = useEditorDeNota({
    activo: bloquesActivo,
    cuerpo,
    setCuerpo,
    notaId: editandoId,
    indice,
    onErrorGuardado: () => setError('No se pudo guardar. Lo escrito queda en el teléfono y se vuelve a intentar.'),
  });
  const refBloques = useRef(null);
  // Para los adjuntos, que viven en callbacks estables: si la foto nueva va
  // en medio del texto o abajo, como siempre.
  const bloquesActivoRef = useRef(bloquesActivo);
  bloquesActivoRef.current = bloquesActivo;
  const seleccionando = useStore(edicion.editor, (s) => s.seleccionando);
  const enRaizBloques = useStore(edicion.editor, (s) => s.estado.pagina === raizDe(s.estado.resto));

  // Lo que ya se ve en el texto no se repite en las listas de abajo. Con un
  // solo adjunto de más o de menos cambia la cadena; al escribir, no.
  const firmaMedios = useStore(edicion.editor, (s) => (bloquesActivo ? firmaDeMedios(s.estado) : ''));
  const enElTexto = useMemo(() => new Set(firmaMedios ? firmaMedios.split('\n') : []), [firmaMedios]);
  // Lo que el texto necesita para pintar un adjunto en su lugar. Estable
  // mientras no cambien las listas: cada bloque especial lo lee.
  // ── La historia como datasheet (F5) ──
  // Va en el documento de la nota principal de un espacio: cada fila del
  // dataset es una entrada. La nota muestra la fila abierta, el panel la
  // tabla y el historial las filas.
  const historiaDs = useStore(edicion.editor, (s) => (bloquesActivo ? s.estado.resto?.datasheet ?? null : null));
  const esHistoriaDs = !!(principalDe && historiaDs?.dataset_id);
  const [filaAbierta, setFilaAbierta] = useState(null);
  useEffect(() => setFilaAbierta(null), [historiaDs?.dataset_id, editandoId]);
  const usarComoHistoria = useCallback(
    (id, nombre) => edicion.editor.getState().historiaComoDatasheet(id ? { dataset_id: id, nombre } : null),
    [edicion.editor],
  );

  // La base parte la historia por filas, pero el trigger de la nota solo
  // mira el texto: al cambiar el dataset (o el modo) se le pide que la
  // rearme, unos segundos después del último cambio.
  const escritosHistoria = useStore(datasheets, (s) => (historiaDs?.dataset_id ? s.cambios[historiaDs.dataset_id] || 0 : 0));
  const rearmarDesde = useRef(null);
  useEffect(() => {
    if (!editandoId || !principalDe?.id) return undefined;
    const firma = `${historiaDs?.dataset_id || ''}:${historiaDs?.titulo || ''}:${escritosHistoria}`;
    // Al abrir la nota no hay nada que rearmar: se anota dónde se empezó.
    if (rearmarDesde.current?.nota !== editandoId) {
      rearmarDesde.current = { nota: editandoId, firma };
      return undefined;
    }
    if (rearmarDesde.current.firma === firma) return undefined;
    const t = setTimeout(async () => {
      rearmarDesde.current = { nota: editandoId, firma };
      try {
        await edicion.guardarYa();
        await supabase.rpc('historia_sincronizar_nota', { p_nota: editandoId });
      } catch (e) {
        console.warn('[historia] no se pudo rearmar', e?.message || e);
      }
    }, 3000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editandoId, principalDe?.id, historiaDs?.dataset_id, historiaDs?.titulo, escritosHistoria]);

  const mediosBloques = useMemo(
    () => ({
      fotos,
      audios,
      documentos,
      onVerFoto: setFotoAbierta,
      onAbrirDocumento: (d) => abrirDocumentoRef.current?.(d),
      esHistoria: !!principalDe,
      historiaDataset: historiaDs?.dataset_id || null,
      usarComoHistoria,
    }),
    [fotos, audios, documentos, principalDe, historiaDs?.dataset_id, usarComoHistoria],
  );
  const abrirDocumentoRef = useRef(null);
  const fuera = (...ids) => !ids.some((x) => x && enElTexto.has(x));

  // Estables a propósito: cada bloque es un `memo`, y una función nueva en
  // cada pintada de la hoja los volvería a pintar a todos.
  const alEscribirBloques = useCallback((v) => setEscribiendo(v !== false), []);
  // El `+` del renglón vacío abre el mismo panel que el de la cápsula. El
  // cursor sigue marcando ese renglón, así que lo agregado va ahí.
  const alAgregarBloques = useCallback(() => {
    Keyboard.dismiss();
    setInsertando(true);
    setFormateando(false);
    setMostrandoFotos(false);
    setGrabando(false);
    setBuscando(false);
  }, []);

  /**
   * Teclado o menú, nunca los dos, como en Craft: con un panel abierto (Aa o
   * `+`) el teclado se va y la pantalla queda para el panel; al volver a
   * escribir, el panel se va. Así ninguno tapa al otro.
   */
  const panelAbierto = bloquesActivo && (formateando || insertando);
  const aManoLista = useAMano();
  // Se vuelve a escribir cuando un bloque toma el foco (tocar el texto, o el
  // bloque nuevo que se acaba de agregar). No se escucha al teclado: iOS avisa
  // «se muestra» también con teclado físico y cerraba el panel al abrirlo.
  useEffect(() => {
    if (!bloquesActivo) return undefined;
    return edicion.editor.subscribe((s, antes) => {
      if (s.enfocado && s.enfocado !== antes.enfocado) {
        setFormateando(false);
        setInsertando(false);
      }
    });
  }, [bloquesActivo, edicion.editor]);
  const alMencionBloques = useCallback((item) => {
    evento(EV.MENCION_TOCADA, { tipo: item?.tipo || null });
    setItemAbierto(item);
  }, []);
  const alSeleccionBloques = useCallback((t) => setSeleccionado(t), []);
  const alDecidirBloques = useCallback((t, contexto) => {
    setDecidiendo({
      candidatos: t.candidatos?.length ? t.candidatos : [t.item],
      escrito: t.texto,
      contexto,
      firma: t.firma,
      firmaCorta: t.firmaCorta,
    });
  }, []);

  // Con bloques, el rastreo va por bloque (`useRastreoBloques`): el de la
  // nota entera se apaga para no preguntar dos veces lo mismo.
  const textoRastreado = bloquesActivo ? '' : cuerpo;
  const tramosReconocidos = useMemo(() => segmentar(textoRastreado, indice), [textoRastreado, indice]);
  // Y lo que cada nombre es según su contexto: «Vamos» el partido o el verbo.
  // Lo decide la base con las mismas reglas que cuentan las menciones en todos
  // lados; lo dudoso se pinta tenue y se decide con un toque.
  const { tramos: tramosCampo, releer: releerCampo } = useVeredictos(textoRastreado, tramosReconocidos, indice, editandoId);
  const tramos = bloquesActivo ? edicion.tramos : tramosCampo;
  const releerVeredictos = useCallback(() => {
    releerCampo();
    edicion.releer();
  }, [releerCampo, edicion.releer]);
  const [decidiendo, setDecidiendo] = useState(null);

  /** Lo que hace falta para preguntar por una mención dudosa. */
  const mencionParaDecidir = useCallback(
    (t, desde) => ({
      candidatos: t.candidatos?.length ? t.candidatos : [t.item],
      escrito: t.texto,
      // Los tramos del editor de bloques traen su frase; los del campo único
      // se cortan del cuerpo.
      contexto:
        t.contexto ?? (desde == null ? null : cuerpo.slice(Math.max(0, desde - 140), desde + t.texto.length + 140)),
      firma: t.firma,
      firmaCorta: t.firmaCorta,
    }),
    [cuerpo]
  );

  /** Las dudosas de la nota, una por lugar, para el panel. */
  const porConfirmar = useMemo(() => {
    const salida = [];
    const vistas = new Set();
    let desde = 0;
    for (const t of tramos) {
      if (t.item && t.estado === 'dudosa' && t.firma && !vistas.has(t.firma)) {
        vistas.add(t.firma);
        salida.push(mencionParaDecidir(t, desde));
      }
      desde += (t.texto || '').length;
    }
    return salida;
  }, [tramos, mencionParaDecidir]);

  /**
   * Los mismos tramos, subdivididos por formato.
   *
   * Van aparte y no en lugar de `tramos`: `mencionEn` y el índice del hilo
   * caminan los tramos crudos sumando largos, y meterles piezas de formato en
   * el medio los haría contar distinto. Esto es solo para pintar.
   */
  const tramosPintados = useMemo(() => conFormato(tramos), [tramos]);

  /**
   * Los items del Codex nombrados **en la conversación**.
   *
   * En modo chat la pregunta que se está escribiendo se vacía al enviar, así
   * que mirar solo `cuerpo` —como se hacía— dejaba el panel en blanco apenas
   * mandabas: los actores de los que venías hablando desaparecían del panel en
   * el momento exacto en que Vizta contestaba sobre ellos.
   *
   * Se segmenta aparte de `tramos` y no sobre el texto todo junto: `tramos`
   * cambia con cada tecla, y volver a recorrer una conversación larga en cada
   * pulsación sería trabajo repetido que crece con el hilo. Los turnos solo
   * cambian al enviar y al recibir.
   */
  const tramosDelHilo = useMemo(() => {
    if (!turnos.length) return [];
    return segmentar(turnos.map((t) => t.texto).join('\n\n'), indice);
  }, [turnos, indice]);

  // Sin repetir: nombrar a alguien tres veces no son tres chips.
  const mencionadosCrudos = useMemo(() => {
    const vistos = new Map();
    for (const t of [...tramosDelHilo, ...tramos]) {
      // Lo dudoso no es un mencionado hasta que se confirme.
      if (t.item && t.estado !== 'dudosa' && !vistos.has(t.item.id)) vistos.set(t.item.id, t.item);
    }
    return [...vistos.values()];
  }, [tramosDelHilo, tramos]);

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

      // Una mención dudosa no abre la ficha: pregunta si es ella.
      let desde = 0;
      for (const t of tramos) {
        const largo = (t.texto || '').length;
        if (t.item && t.estado === 'dudosa' && sel.start >= desde && sel.start < desde + largo) {
          roce();
          setDecidiendo(mencionParaDecidir(t, desde));
          return;
        }
        desde += largo;
      }

      const item = mencionEn(tramos, sel.start);
      if (item) {
        toque();
        evento(EV.MENCION_TOCADA, { tipo: item?.tipo || null });
        setItemAbierto(item);
      }
    },
    [cuerpo, buscando, tramos, mencionParaDecidir]
  );

  /**
   * Aplicar formato a lo seleccionado, desde la tira.
   *
   * Escribe por el mismo camino que el autocompletado —texto nuevo más cursor
   * impuesto— porque es el único que deja el cursor donde corresponde después
   * de cambiar el contenido. Sin eso, envolver una palabra en negrita mandaba
   * el cursor al final de la nota.
   */
  const formatear = useCallback(
    (accion) => {
      const r = aplicarFormato(cuerpo, seleccion, accion);
      setCuerpo(r.texto);
      setSeleccionado('');
      setSeleccion({ start: r.cursor, end: r.cursor });
      setCursorImpuesto({ start: r.cursor, end: r.cursor });
    },
    [cuerpo, seleccion]
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

  // Con bloques, el índice sale del documento: las páginas si las hay, y
  // cada sección apunta a su bloque. Se lee cuando cambia `cuerpo`, que el
  // editor mantiene al día —también al renombrar una página—.
  const indiceHistoria = useMemo(() => {
    if (!principalDe) return null;
    if (bloquesActivo) return enRaizBloques ? indiceDelDocumento(edicion.editor.getState().documento()) : null;
    return indiceDeHistoria(cuerpo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [principalDe, cuerpo, bloquesActivo, enRaizBloques]);

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

  /**
   * Un resto del arreglo anterior.
   *
   * Cuando el switch y guardar peleaban por el mismo lugar, tocar la pastilla
   * encogida era la forma de pedirlo abierto. Con las acciones abajo ya no se
   * encoge nunca, así que esto no cambia nada en pantalla; se conserva porque
   * los handlers del switch lo siguen limpiando y quitarlo a medias dejaría
   * llamadas a una función que no existe.
   */
  const [switchPedido, setSwitchPedido] = useState(false);

  /**
   * El switch ya no se recoge: ahora entran los dos.
   *
   * Se encogía porque la barra tenía además seis botones de acción. Con esos
   * abajo, sobre el teclado, la fila es cerrar + switch + guardar y sobra
   * espacio — esconder a medias dónde estás dejó de tener motivo.
   */
  const recogido = false;
  const mostrarAccion = enNotas && accionVisible;

  useEffect(() => {
    navAbierto.value = withSpring(recogido ? 0 : 1, MOTION.layout);
    if (recogido && !yaEscribia.current) roce();
    yaEscribia.current = recogido;
  }, [recogido, navAbierto]);

  /**
   * El ancho de guardar, animado.
   *
   * Es el par del switch: uno se recoge a la izquierda cuando empezás a escribir
   * y el otro se abre a la derecha cuando hay algo que guardar, con el mismo
   * resorte, así se leen como un solo movimiento. El texto aparece recién pasada
   * la mitad del recorrido —igual que el switch se apaga antes de cerrarse—
   * para que nunca se vea una palabra apretada contra su propio borde.
   */
  const accionAbierta = useSharedValue(mostrarAccion ? 1 : 0);
  const anchoAccion = useSharedValue(0);

  useEffect(() => {
    accionAbierta.value = withSpring(mostrarAccion ? 1 : 0, MOTION.layout);
  }, [mostrarAccion, accionAbierta]);

  // Se mide lo que ocupa el contenido y no se fija un número: «guardar»,
  // «enviar» y el infinito de cuando está guardando miden distinto, y un ancho
  // fijo recortaría a uno o dejaría aire de más en los otros.
  const medirAccion = useCallback(
    (w) => {
      if (w > 0) anchoAccion.value = withSpring(w, MOTION.layout);
    },
    [anchoAccion]
  );

  const separacionAccion = puedePreguntar ? 8 : 0;
  const estiloAccion = useAnimatedStyle(() => ({
    width: interpolate(accionAbierta.value, [0, 1], [0, anchoAccion.value], Extrapolation.CLAMP),
    marginLeft: interpolate(accionAbierta.value, [0, 1], [0, separacionAccion], Extrapolation.CLAMP),
    opacity: interpolate(accionAbierta.value, [0, 0.5, 1], [0, 0, 1], Extrapolation.CLAMP),
    transform: [
      { translateX: interpolate(accionAbierta.value, [0, 1], [8, 0], Extrapolation.CLAMP) },
    ],
  }));

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
    (nota, { principal = null } = {}) => {
      const cargar = async () => {
        // El editor de bloques necesita saber qué nota es y su documento
        // antes de ver el cuerpo nuevo: la hoja fija el id más abajo.
        edicion.alAbrir(nota);
        setCuerpo(nota.description || '');
        // El nombre guardado manda sobre la primera línea: si alguien le puso
        // un título propio, deducirlo de nuevo se lo pisaría.
        setTitulo(nota.name || '');
        setTituloTocado(true);
        setFuente(nota.details?.Fuente || '');
        setFecha(nota.details?.['Fecha de captura'] || '');
        setTags(Array.isArray(nota.tags) ? nota.tags.join(', ') : '');
        // Lo que se subió para la nota que se está dejando y nunca se guardó:
        // al reemplazar el estado, nada va a volver a referenciarlo.
        soltarFotos([...fotos, ...audios]);

        const resolverUrl = async (medio) => {
          const url = medio.storage_path
            ? await firmarMedio(medio.storage_path).catch(() => null)
            : medio.url;
          return { ...medio, url, error: !url };
        };
        const suyas = await Promise.all(fotosDe(nota).map(resolverUrl));
        const susAudios = await Promise.all(audiosDe(nota).map(resolverUrl));
        setFotos(suyas);
        setAudios(susAudios);

        soltarDocumentos(documentos);
        const { data: susDocs } = await supabase
          .from('nota_documentos')
          .select('id, storage_path, nombre, mime, tamano, estado, error, paginas, paginas_leidas')
          .eq('nota_id', nota.id)
          .order('created_at');
        setDocumentos((susDocs || []).map((d) => ({ ...d, clave: d.id })));
        yaEnLaBase.current = new Set(
          [...suyas, ...susAudios].map((m) => m.storage_path).filter(Boolean)
        );
        // La ubicación guardada vuelve con la nota. Si no tiene, se limpia: la
        // hoja se reutiliza, y heredar el punto de la nota anterior sería
        // ubicar en Antigua algo que pasó en Xela.
        const punto = puntoDeGeo(nota.geo);
        setUbicacion(
          punto
            ? {
                lat: punto.lat,
                lng: punto.lng,
                nombre: nota.details?.lugar_nota?.nombre || null,
                direccion: nota.details?.lugar_nota?.direccion || null,
                lugarId: nota.details?.lugar_nota?.desde_item || null,
              }
            : null
        );

        setSeleccionado('');
        setEditandoId(nota.id);
        setEspacioDestino(null);
        setPrincipalDe(principal);
        setHistoriaAlAbrir(principal);
        irA(NOTA);
        // Soltar el foco, no solo bajar el teclado.
        //
        // Sigue haciendo falta aunque el campo ya no se enfoque solo: la hoja
        // se reutiliza, así que se puede llegar acá con el campo enfocado de
        // una nota anterior. `Keyboard.dismiss()` bajaría el teclado dejando el
        // foco puesto, y el primer toque en cualquier parte lo devolvería.
        campo.current?.blur();
        refBloques.current?.soltarFoco();
      };

      // Cargar encima de un borrador sin guardar lo borraría sin aviso.
      //
      // Las fotos cuentan igual que el texto: adjuntar una y abrir otra nota
      // hacía desaparecer la subida sin decir nada, y encima dejaba el archivo
      // en el bucket sin dueño.
      if (!editandoId && (cuerpo.trim().length > 0 || fotos.length > 0 || audios.length > 0 || documentos.length > 0)) {
        Alert.alert(
          'Tenés una nota sin guardar',
          fotos.length && !cuerpo.trim()
            ? 'Si abrís esta, se pierden las fotos que adjuntaste.'
            : 'Si abrís esta, se pierde lo que escribiste.',
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Descartar y abrir',
              style: 'destructive',
              onPress: () => {
                // Descartada a propósito: el borrador local no la tiene que devolver.
                borrarBorrador(null);
                cargar();
              },
            },
          ]
        );
        return;
      }
      cargar();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cuerpo, editandoId, fotos, audios, documentos, edicion.alAbrir]
  );

  /**
   * Una nota nueva, dentro de un espacio o suelta.
   *
   * Pedida desde un espacio es una nota **nueva** que al guardar entra ahí. Una
   * del historial que estuviera cargada se deja, porque no es lo que se acaba
   * de pedir. Un borrador sin id se conserva y al guardar entra al espacio.
   * Desde la casa (sin espacio) solo se vuelve a escribir: no se toca lo que
   * ya estaba en la hoja.
   */
  const empezarNotaEn = (espacio) => {
    if (espacio?.id) {
      if (editandoId) {
        soltarFotos([...fotos, ...audios]);
        setCuerpo('');
        setTitulo('');
        setTituloTocado(false);
        setFuente('');
        setFecha('');
        setTags('');
        setFotos([]);
        setAudios([]);
        soltarDocumentos(documentos);
        setDocumentos([]);
        yaEnLaBase.current = new Set();
        setSeleccionado('');
        setEditandoId(null);
        setHistoriaAlAbrir(null);
      }
      setEspacioDestino({ id: espacio.id, name: espacio.name });
    } else {
      setEspacioDestino(null);
    }
    setModo('notas');
    irA(NOTA);
  };

  /**
   * Abrir un espacio: su nota principal.
   *
   * Antes abría un editor de bloques aparte —títulos, tablas, pendientes— que
   * guardaba en otro lado y no era una nota. Ahora el documento de un espacio
   * se escribe en esta misma hoja: si el espacio ya tiene nota principal, se
   * abre; si no, se empieza una que al guardar queda marcada como la suya.
   */
  const abrirPrincipal = async (espacio) => {
    if (!espacio?.id) return;
    const marca = { id: espacio.id, name: espacio.name };
    try {
      const id = await notaPrincipalDe(espacio.id);
      if (id) {
        const { data: nota } = await supabase
          .from('codex_universe_items')
          .select('id, name, tipo, description, tags, aliases, details, geo, created_at, thumbnail_url')
          .eq('id', id)
          .maybeSingle();
        if (nota) {
          setModo('notas');
          abrirNota(nota, { principal: marca });
          return;
        }
      }
    } catch (e) {
      console.warn('[espacio] no se pudo leer la nota principal', e?.message || e);
    }
    empezarNotaEn(espacio);
    setPrincipalDe(marca);
  };

  // Pedida desde afuera —la pestaña del Codex al abrir un espacio—.
  useEffect(() => {
    if (espacioPrincipal?.id) abrirPrincipal(espacioPrincipal);
    // Solo al montar con un espacio: abrirlo de nuevo con cada render pisaría
    // lo que se está escribiendo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [espacioPrincipal?.id]);

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
        .select('id, name, tipo, description, tags, aliases, details, geo, created_at, thumbnail_url')
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
    // Los dos modos se pelean por la misma superficie: el autocompletado y la
    // bandeja de fotos flotan justo donde va la respuesta.
    setBuscando(false);
    setMostrandoFotos(false);
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

  /**
   * Adjuntar una foto.
   *
   * Aparece en la nota **antes** de subir, con su copia local. Esperar a la URL
   * remota dejaría varios segundos de nada justo después del toque, que es
   * cuando la persona está mirando si registró — y es el momento en que uno
   * vuelve a tocar, y termina con la foto dos veces.
   *
   * Si la subida falla, la foto **se queda** marcada en rojo en vez de
   * desaparecer. Una foto que se esfuma sola no se distingue de una que nunca
   * se tocó, y lo que la persona necesita saber es cuál de las cuatro falló.
   */
  const adjuntar = useCallback(async ({ uri, ancho, alto }) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setFotos((f) => [...f, { id, local: uri, url: null, storage_path: null, ancho, alto, subiendo: true, error: false }]);
    // Con bloques, la foto entra en el texto donde está el cursor, no al final.
    if (bloquesActivoRef.current) edicion.editor.getState().insertarMedio({ tipo: 'foto', ref: id });

    try {
      const subida = await subirImagen(uri, { ancho, alto });

      // La quitaron mientras subía: el archivo ya existe y no lo referencia
      // nadie. Se borra acá, que es el primer momento en que hay ruta.
      if (canceladas.current.has(id)) {
        canceladas.current.delete(id);
        borrarMedio(subida.storage_path);
        return;
      }

      toque();
      setFotos((f) => f.map((x) => (x.id === id ? { ...x, ...subida, subiendo: false } : x)));
      edicion.editor.getState().actualizarMedio(id, { storage_path: subida.storage_path });
      evento(EV.NOTA_FOTO_ADJUNTA, { origen: 'bandeja' });
    } catch (e) {
      // Falló: no hay archivo que borrar, y la marca de cancelada ya no tiene a
      // qué referirse. Dejarla ahí no rompe nada, pero la limpia igual para que
      // el conjunto no acumule ids de subidas que nunca existieron.
      canceladas.current.delete(id);
      falla();
      setFotos((f) => f.map((x) => (x.id === id ? { ...x, subiendo: false, error: true } : x)));
      // Y se dice por qué: si es el límite del plan, es lo que hay que saber.
      setError(motivoDe(e, 'No se pudo subir la foto.'));
    }
  }, []);

  /**
   * Adjuntar una grabación.
   *
   * Aparece en la nota **antes** de subir, con la duración que ya se conoce:
   * acabás de verla contar. Esperar a la URL dejaría unos segundos de nada
   * justo después de tocar el visto, que es cuando uno mira si registró.
   */
  const adjuntarGrabacion = useCallback(async (uri, duracionMs) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    setAudios((a) => [
      ...a,
      {
        id,
        local: uri,
        url: null,
        storage_path: null,
        nombre: 'Nota de voz',
        duracion_ms: duracionMs,
        subiendo: true,
        error: false,
      },
    ]);
    if (bloquesActivoRef.current) edicion.editor.getState().insertarMedio({ tipo: 'audio', ref: id });

    try {
      const medio = await subirGrabacion(uri, { duracionMs });

      // La quitaron mientras subía: nadie referencia el archivo.
      if (canceladas.current.has(id)) {
        canceladas.current.delete(id);
        borrarMedio(medio.storage_path);
        return;
      }

      toque();
      setAudios((a) => a.map((x) => (x.id === id ? { ...x, ...medio, subiendo: false } : x)));
      edicion.editor.getState().actualizarMedio(id, { storage_path: medio.storage_path });
      evento(EV.NOTA_AUDIO_ADJUNTO, { segundos: Math.round((duracionMs || 0) / 1000) });
    } catch (e) {
      canceladas.current.delete(id);
      falla();
      setAudios((a) => a.map((x) => (x.id === id ? { ...x, subiendo: false, error: true } : x)));
      setError(motivoDe(e, 'No se pudo subir la grabación.'));
    }
  }, []);

  /**
   * Adjuntar un documento. Aparece en la nota apenas empieza la subida —no
   * mientras se elige—, con su nombre y un indicador. Se registra en la nota al
   * guardar; si la nota es una historia, el servidor lo lee después.
   */
  const agregarDocumento = useCallback(async () => {
    if (documentos.length >= 5) {
      falla();
      setError('Una nota tiene como máximo 5 documentos.');
      return;
    }
    const clave = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      const r = await subirDocumentoNota({
        alEmpezarSubida: ({ nombre, tamano }) => {
          setDocumentos((d) => [...d, { clave, nombre, tamano, subiendo: true }]);
          if (bloquesActivoRef.current) edicion.editor.getState().insertarMedio({ tipo: 'documento', ref: clave });
        },
      });
      if (r.cancelado) return;
      toque();
      setDocumentos((d) => d.map((x) => (x.clave === clave ? { ...x, ...r, subiendo: false } : x)));
      edicion.editor.getState().actualizarMedio(clave, { storage_path: r.storage_path });
    } catch (e) {
      falla();
      setDocumentos((d) => d.filter((x) => x.clave !== clave));
      edicion.editor.getState().quitarMedio(clave);
      setError(e.message || 'No se pudo subir el documento');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentos.length]);

  /** Quitar un documento: el recién subido se borra ya; el guardado, al guardar. */
  const quitarDocumento = useCallback((doc) => {
    setDocumentos((d) => d.filter((x) => x.clave !== doc.clave));
    // Si también estaba en el texto, sale de ahí.
    edicion.editor.getState().quitarMedio(doc.storage_path || doc.clave);
    if (doc.id) docsQuitados.current.push(doc);
    else if (doc.storage_path) borrarDocumentoNota(doc.storage_path);
  }, []);

  const abrirDocumento = useCallback(async (doc) => {
    try {
      const url = await firmarDocumentoNota(doc.storage_path);
      if (url) await WebBrowser.openBrowserAsync(url);
    } catch (e) {
      falla();
      setError('No se pudo abrir el documento');
    }
  }, []);

  abrirDocumentoRef.current = abrirDocumento;

  /** Quitar un audio. Mismo criterio que las fotos. */
  const quitarAudio = useCallback((audio) => {
    setAudios((a) => a.filter((x) => x.id !== audio.id));
    edicion.editor.getState().quitarMedio(audio.storage_path || audio.id);

    if (audio.subiendo) {
      canceladas.current.add(audio.id);
      return;
    }
    if (!audio.storage_path) return;

    if (yaEnLaBase.current.has(audio.storage_path)) retiradas.current.add(audio.storage_path);
    else borrarMedio(audio.storage_path);
  }, []);

  /**
   * Quitar una foto.
   *
   * Sale de la nota siempre. Del bucket, **depende de quién la referencia**:
   *
   *  · todavía subiendo → se anota para borrarla cuando la subida termine.
   *  · subida pero nunca guardada → nada la referencia, se borra ahora.
   *  · ya en la nota guardada → se posterga hasta el próximo guardado.
   *
   * Esa última distinción es la que importa: borrarla en el acto dejaba la fila
   * de la base apuntando a un archivo que ya no existía apenas descartaras los
   * cambios, y la imagen quedaba rota sin manera de recuperarla.
   */
  const quitar = useCallback((foto) => {
    setFotos((f) => f.filter((x) => x.id !== foto.id));
    edicion.editor.getState().quitarMedio(foto.storage_path || foto.id);

    if (foto.subiendo) {
      canceladas.current.add(foto.id);
      return;
    }

    if (!foto.storage_path) return;

    if (yaEnLaBase.current.has(foto.storage_path)) retiradas.current.add(foto.storage_path);
    else borrarMedio(foto.storage_path);
  }, []);

  // No se guarda a medias. Con una subida en curso, el botón espera: guardar
  // ahora escribiría la nota sin esa foto y la persona la vería desaparecer al
  // reabrirla, sin nada que explique por qué.
  const subiendoAlgo = fotos.some((f) => f.subiendo) || audios.some((a) => a.subiendo);

  /**
   * Cerrar la hoja, por donde sea.
   *
   * Vivía dentro del `onPress` de la «X», y el botón físico Atrás de Android
   * —que entra por `onRequestClose`— se saltaba la limpieza entera: cerrabas
   * por ahí después de adjuntar y el archivo quedaba en el bucket sin que nada
   * lo referenciara. Un solo camino evita que la próxima salida que se agregue
   * vuelva a olvidarse.
   *
   * Se borran las subidas que nunca llegaron a guardarse. Las **quitadas** de
   * una nota guardada no: al descartar, la fila de la base sigue siendo la
   * vieja y sigue nombrándolas.
   */
  const cerrar = useCallback(() => {
    // Con el editor de bloques, una nota que ya existe se guarda sola al
    // salir: es lo que promete el guardado automático. Una nueva que nunca se
    // guardó se descarta como siempre, y su borrador local con ella.
    if (bloquesActivo) {
      if (editandoId) edicion.guardarYa();
      else borrarBorrador(null);
    }
    soltarFotos([...fotos, ...audios]);
    soltarDocumentos(documentos);
    setEspacioDestino(null);
    setPrincipalDe(null);
    setHistoriaAlAbrir(null);

    // Distingue cerrar con algo escrito de cerrar en blanco: lo primero es
    // abandonar una nota, lo segundo es solo salir.
    evento(EV.NOTA_DESCARTADA, { tenia_texto: cuerpo.trim().length > 0 });
    onClose();
  }, [fotos, audios, documentos, cuerpo, onClose, soltarFotos, soltarDocumentos, bloquesActivo, editandoId, edicion]);

  /**
   * Poner dónde estoy.
   *
   * Pide el permiso la primera vez y nada más: si dicen que no, no hay aviso ni
   * insistencia — el botón queda como estaba y la nota sigue sin ubicación,
   * que es un estado perfectamente válido.
   */
  const ubicarAqui = async () => {
    try {
      const permiso = await pedirEnUso();
      if (permiso === 'ninguno') return;
      const aqui = await donde();
      setUbicacion({ lat: aqui.lat, lng: aqui.lng, nombre: null, direccion: null });
      roce();
    } catch {
      // Sin señal o con la ubicación apagada en el sistema: no se puede anotar
      // dónde, y eso no rompe nada de la nota.
    }
  };

  const guardar = async () => {
    if (subiendoAlgo) {
      setError('Esperá a que termine de subir lo adjunto.');
      return;
    }
    // Con bloques, el cuerpo de este instante —el de la hoja puede ir unos
    // milisegundos atrás de lo que se acaba de escribir— y su documento.
    const volcado = bloquesActivo ? edicion.volcar() : null;
    const texto = volcado ? volcado.md : cuerpo;
    const titular = tituloTocado
      ? titulo
      : (texto.split('\n').find((l) => l.trim()) || '').replace(/^#+\s*/, '').slice(0, 70);
    if (!texto.trim() || !titular.trim()) return;
    setGuardando(true);
    setError(null);
    try {
      // Una nota que ya existe pasa primero por el guardado que junta con lo
      // escrito en otro lado (web, otro teléfono): lo que se escribe acá
      // abajo ya es lo junto y no pisa nada.
      let final = volcado;
      if (volcado) {
        if (editandoId) {
          await edicion.guardarYa({ comprobar: true });
          final = edicion.volcar();
        } else {
          await edicion.esperarGuardado();
        }
      }
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

      // Las que efectivamente subieron. Una que falló no tiene URL que guardar,
      // y escribirla dejaría una referencia rota en la nota para siempre.
      const subidas = fotos
        .filter((f) => f.storage_path)
        .map((f) => ({ url: null, storage_path: f.storage_path, ancho: f.ancho, alto: f.alto }));

      if (subidas.length) details[CLAVE_FOTOS] = subidas;

      // La portada es la primera foto, guardada como ruta y no como enlace: las
      // fotos son privadas y un enlace firmado vence en una hora. Quien la
      // muestra la firma en el momento (`usePortada`). Sin fotos, sin portada.
      if (subidas.length) details.portada_path = subidas[0].storage_path;
      else delete details.portada_path;

      // Los audios, igual: solo los que subieron. Uno que falló no tiene URL, y
      // escribirlo dejaría una referencia rota en la nota para siempre.
      const sonidos = audios
        .filter((a) => a.storage_path)
        .map((a) => ({
          url: null,
          storage_path: a.storage_path,
          nombre: a.nombre,
          tamano: a.tamano,
          duracion_ms: a.duracion_ms || 0,
        }));

      if (sonidos.length) details[CLAVE_AUDIOS] = sonidos;

      // La ubicación, si la nota nació con una. `geoDePunto` es la misma forma
      // que usa un punto del Codex: el mapa no aprende un caso nuevo para
      // dibujarla.
      if (ubicacion && Number.isFinite(Number(ubicacion.lat)) && Number.isFinite(Number(ubicacion.lng))) {
        details.lugar_nota = {
          nombre: ubicacion.nombre || null,
          direccion: ubicacion.direccion || null,
          // De qué lugar guardado salió, cuando salió de uno. Es una pista, no
          // un vínculo: la nota se sostiene sola si ese lugar se borra.
          desde_item: ubicacion.lugarId || null,
        };
      }

      // El texto como bloques, junto a su markdown. `description` sigue siendo
      // lo que leen el indexador, el rastreo y la web.
      if (final) details.documento = final.doc;

      const campos = {
        tipo: 'Snippet',
        name: titular.trim(),
        description: (final ? final.md : texto).trim(),
        ...(etiquetas.length ? { tags: etiquetas } : {}),
        details,
        // `thumbnail_url` guarda enlaces públicos, y las fotos de las notas son
        // privadas: la portada va en `details.portada_path` (arriba) y la app
        // la firma al mostrarla. Se escribe `null` siempre para que no quede un
        // enlace público de antes apuntando a una foto que se quitó.
        thumbnail_url: null,
        ...(ubicacion && Number.isFinite(Number(ubicacion.lat)) && Number.isFinite(Number(ubicacion.lng))
          ? { geo: geoDePunto({ lat: Number(ubicacion.lat), lng: Number(ubicacion.lng) }) }
          : {}),
      };
      const columnas = 'id, name, tipo, description, tags, aliases, details, created_at, thumbnail_url';

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

      // Una nota nueva pedida desde un espacio entra directo a ese espacio.
      // Si la membresía falla, la nota igual quedó guardada: se puede agregar
      // después desde el historial. Fallar el guardado entero duplicaría al
      // reintentar, porque el insert ya corrió.
      // Una ya guardada entra solo si se eligió el espacio a propósito
      // (`marcar`); abrirla desde otro lado no la mueve.
      if (espacioDestino?.id && data?.id && (!editandoId || espacioDestino.marcar)) {
        try {
          await addItemsToSpace(espacioDestino.id, [data.id]);
          setRecargaEspacios((n) => n + 1);
        } catch (e) {
          console.warn('[nota] no se pudo poner en el espacio', e?.message || e);
          setError(`La nota se guardó, pero no entró a ${espacioDestino.name || 'el espacio'}.`);
        }
      }

      // Y si va como historia, se suma a las del espacio: si ya tenía una,
      // esta es la siguiente. Igual que la membresía: si esto falla, la nota
      // está guardada y en el espacio.
      if (principalDe?.id && data?.id && (!editandoId || principalDe.marcar)) {
        try {
          await agregarHistoria(principalDe.id, data.id);
        } catch (e) {
          console.warn('[nota] no se pudo sumar como historia', e?.message || e);
        }
      }

      // Era historia de un espacio y ya no lo es: sale de sus historias. La
      // nota sigue en el espacio como una nota normal.
      if (editandoId && historiaAlAbrir?.id && principalDe?.id !== historiaAlAbrir.id) {
        try {
          await quitarHistoria(historiaAlAbrir.id, editandoId);
          setRecargaEspacios((n) => n + 1);
        } catch (e) {
          console.warn('[nota] no se pudo dejar de usar como historia', e?.message || e);
        }
      }

      // Los documentos: los nuevos se registran en la nota —ahí se aplican los
      // límites del plan— y los quitados se borran. Si el plan no deja sumar
      // uno, la nota igual queda guardada y se avisa cuál no entró.
      if (data?.id) {
        const nuevos = documentos.filter((d) => !d.id && d.storage_path && !d.subiendo);
        const rechazados = [];
        for (const d of nuevos) {
          const { error: eDoc } = await supabase.from('nota_documentos').insert({
            user_id: userId,
            nota_id: data.id,
            storage_path: d.storage_path,
            nombre: d.nombre,
            mime: d.mime,
            tamano: d.tamano,
          });
          if (eDoc) {
            rechazados.push({ nombre: d.nombre, motivo: eDoc.message });
            borrarDocumentoNota(d.storage_path);
          }
        }
        for (const d of docsQuitados.current) {
          await supabase.from('nota_documentos').delete().eq('id', d.id);
          borrarDocumentoNota(d.storage_path);
        }
        docsQuitados.current = [];
        if (rechazados.length) {
          const porPlan = rechazados.some((r) => /DOCS_LIMITE_PLAN/.test(r.motivo));
          Alert.alert(
            'Un documento no entró',
            porPlan
              ? `Llegaste al máximo de documentos de tu plan. La nota se guardó sin ${rechazados.map((r) => `«${r.nombre}»`).join(', ')}.`
              : `La nota se guardó, pero no se pudo sumar ${rechazados.map((r) => `«${r.nombre}»`).join(', ')}.`
          );
        }
      }

      // Se manda el tamaño y la cantidad de menciones, nunca el texto.
      evento(EV.NOTA_GUARDADA, {
        editada: !!editandoId,
        caracteres: texto.trim().length,
        menciones: mencionados.length,
        con_detalles: !!(fuente.trim() || tags.trim() || fecha.trim()),
      });
      // Ya están escritas: descartar de acá en adelante no debe borrarlas.
      yaEnLaBase.current = new Set(
        [...subidas, ...sonidos].map((m) => m.storage_path).filter(Boolean)
      );

      // Y recién ahora las que se habían quitado: la fila guardada ya no las
      // menciona, así que el archivo dejó de tener quién lo referencie.
      for (const ruta of retiradas.current) borrarMedio(ruta);
      retiradas.current.clear();
      // El guardado automático no tiene que repetir lo que ya quedó escrito.
      if (final) edicion.marcarGuardado(final.doc, data.id);
      toque();
      onCreated?.(data);

      /**
       * Guardar no cierra: se queda en la nota.
       *
       * Antes la hoja se cerraba y volvía al menú, así que corregir algo
       * recién guardado era volver a buscar la nota. Ahora la nota queda
       * abierta, ya como guardada —el próximo guardado la actualiza en vez de
       * crear otra—, y el botón muestra un cheque un momento.
       */
      setEditandoId(data.id);
      // Si entró a un espacio o como historia, ya está: la próxima vez no se
      // vuelve a pedir. Si es historia, queda como la historia que se abrió,
      // para poder desmarcarla después.
      if (principalDe?.id) {
        const marca = { id: principalDe.id, name: principalDe.name };
        setPrincipalDe(marca);
        setHistoriaAlAbrir(marca);
      } else {
        setHistoriaAlAbrir(null);
      }
      setEspacioDestino(null);
      // Los documentos, con sus filas recién creadas: sin su id, quitarlos
      // después no los borraría de la nota.
      const { data: susDocs } = await supabase
        .from('nota_documentos')
        .select('id, storage_path, nombre, mime, tamano, estado, error, paginas, paginas_leidas')
        .eq('nota_id', data.id)
        .order('created_at');
      setDocumentos((susDocs || []).map((d) => ({ ...d, clave: d.id })));
      setGuardando(false);
      setGuardadoOk(true);
      clearTimeout(relojOk.current);
      relojOk.current = setTimeout(() => setGuardadoOk(false), 1600);
    } catch (e) {
      setError(motivoDe(e, 'No se pudo guardar la nota.'));
      setGuardando(false);
    }
  };

  // La ficha del Codex. Ver dónde se usa: puede colgar de la hoja o del espacio.
  const ficha = itemAbierto ? (
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
        // La ficha queda abierta. Si era nuevo, desde ahora es el item que ya
        // existe: si no, al volver a pintarse la hoja le mandaría otra vez el
        // borrador y la ficha volvería a «crear».
        setItemAbierto((prev) => (prev?._nuevo ? { ...guardado, _source: 'universe' } : prev));
      }}
      bottomInset={bottomInset}
    />
  ) : null;

  return (
    <Modal visible animationType="slide" onRequestClose={cerrar}>
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
              paddingHorizontal: 14,
              paddingBottom: 6,
              backgroundColor: PAPEL,
              zIndex: 2,
            }}
          >
            {/* Izquierda: contexto. Puede encogerse. La derecha —guardar—
                no: si esta fila se pasa de ancha, lo que desaparecía era
                justo la acción, empujada contra el borde del teléfono. */}
            <View
              style={{
                flex: 1,
                minWidth: 0,
                flexDirection: 'row',
                alignItems: 'center',
                marginRight: 8,
              }}
            >
              <Pressable
                onPress={cerrar}
                hitSlop={12}
                style={{ padding: 6, flexShrink: 0 }}
              >
                <X size={19} color={INK.faint} />
              </Pressable>

              {/* El switch, al lado de la X.
              
                  Va a la izquierda porque es contexto —qué estoy mirando— y no
                  una acción, y en esta barra la izquierda siempre fue el
                  contexto. En modo Vizta desaparece: ahí ese lugar lo ocupa el
                  modelo, y entre cambiar de pantalla a mitad de una pregunta y
                  ver con qué se está preguntando, lo segundo es lo que hace falta
                  en ese momento. */}
              {!preguntando ? (
                <Animated.View
                  style={[{ overflow: 'hidden', borderRadius: 999, marginLeft: 4 }, estiloSwitch]}
                >
                  <Animated.View pointerEvents={recogido ? 'none' : 'auto'} style={estiloSwitchInterior}>
                    <SegmentedSlider
                      valor={modo}
                      onReselect={() => setSwitchPedido(false)}
                      onChange={(m) => {
                        modoTocado.current = true;
                        setModo(m);
                        setPanelEspacio(null);
                        setSwitchPedido(false);
                        setEscribiendo(false);
                        // Lo que flota sobre el teclado pertenece a la nota. Al salir
                        // de Notas se apaga todo, porque si no la bandeja de fotos o
                        // la grabadora quedaban encendidas debajo de una pantalla que
                        // no tiene nada que ver con ellas.
                        setMostrandoFotos(false);
                        setGrabando(false);
                        setBuscando(false);
                        Keyboard.dismiss();
                      }}
                      tabs={[
                        { id: 'notas', label: 'Notas', accent: 'rgba(75,79,166,0.14)', ink: '#4B4FA6' },
                        { id: 'espacios', label: 'Espacios', accent: 'rgba(21,128,61,0.14)', ink: '#15803D' },
                      ]}
                      style={{ width: switchAncho }}
                    />
                  </Animated.View>

                  {/* Encogido, el switch entero es un solo botón: tocarlo lo pide
                      abierto y guardar se aparta. Adentro no se puede elegir una
                      pestaña que no se ve. */}
                  {recogido ? (
                    <Pressable
                      onPress={() => {
                        roce();
                        campo.current?.blur();
                        refBloques.current?.soltarFoco();
                        Keyboard.dismiss();
                        setEscribiendo(false);
                        setSwitchPedido(true);
                      }}
                      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                      accessibilityRole="button"
                      accessibilityLabel="Notas. Toca para dejar de escribir y cambiar de sección"
                    />
                  ) : null}
                </Animated.View>
              ) : null}

              {/* El modelo, al lado de la X. Es contexto de lo que se está
                  haciendo —con qué se va a preguntar— y el contexto vive a la
                  izquierda; la derecha son las acciones. */}
              {pagina === NOTA && preguntando ? (
                <Animated.View entering={FadeIn.duration(220)} style={{ flexShrink: 1, minWidth: 0 }}>
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
                      style={{ fontFamily: MONO, fontSize: 11, color: 'rgba(28,43,34,0.42)', maxWidth: 140 }}
                    >
                      {sinProveedor(nombreModelo)}
                    </Text>
                    <ChevronDown size={12} color="rgba(28,43,34,0.34)" />
                  </Pressable>
                </Animated.View>
              ) : null}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 0 }}>
              {/* La lupa, en las dos pantallas. En Notas enciende el
                  autocompletado del Codex —solo en la página de la nota: es lo
                  que se escribe lo que se busca—. En Espacios, adentro de un
                  espacio, busca en el Codex para sumarle cosas. */}
              {!enNotas && espacioAbierto ? (
                <>
                  <GlifoBarra
                    Icono={Search}
                    activo={panelEspacio === 'buscar'}
                    onPress={() => setPanelEspacio((p) => (p === 'buscar' ? null : 'buscar'))}
                  />
                  <GlifoBarra
                    Icono={Plus}
                    activo={panelEspacio === 'agregar'}
                    onPress={() => setPanelEspacio((p) => (p === 'agregar' ? null : 'agregar'))}
                  />
                </>
              ) : null}
              {enNotas && pagina === NOTA ? (
                <GlifoBarra
                  Icono={Search}
                  activo={buscando}
                  onPress={() => {
                    setBuscando((b) => {
                      const nuevo = !b;
                      // Encender la búsqueda **entra a escribir**. No es un
                      // atajo: el autocompletado completa lo que estás
                      // tecleando, y tocar un nombre ya escrito para abrir su
                      // ficha funciona moviendo el cursor. Las dos cosas piden
                      // un campo editable, así que dejarlo en modo lectura
                      // habría dado un botón que se prende y no hace nada.
                      if (nuevo) setEscribiendo(true);
                      return nuevo;
                    });
                    setMostrandoFotos(false);
                  }}
                />
              ) : null}

              {/* Preguntarle a Vizta. Es el mismo espacio de escritura: lo que se
                  escribe deja de ser una nota y pasa a ser una pregunta, y por eso
                  es un modo y no otra pantalla. */}
              {enNotas && pagina === NOTA && puedePreguntar ? (
                <GlifoBarra
                  Icono={Send}
                  activo={preguntando}
                  onPress={alternarVizta}
                />
              ) : null}

            {/* Guardar entra y sale con resorte, no de golpe.

                Antes aparecía con un fundido pero ocupaba su ancho entero en el
                primer frame: los botones de al lado saltaban de lugar y el
                fundido quedaba tapado por el salto. Ahora lo que crece es el
                ancho, con el mismo resorte con el que el switch se recoge a la
                izquierda, y la barra se reacomoda de a poco.

                La caja mide 44 de alto con margen negativo: en la fila ocupa lo
                mismo que los otros botones, pero conserva un área de toque
                cómoda, que el `overflow` de la animación si no recortaría. */}
            {enNotas ? (
              <Animated.View
                pointerEvents={mostrarAccion ? 'auto' : 'none'}
                accessibilityElementsHidden={!mostrarAccion}
                importantForAccessibility={mostrarAccion ? 'auto' : 'no-hide-descendants'}
                style={[{ height: 44, marginVertical: -6, overflow: 'hidden', flexShrink: 0 }, estiloAccion]}
              >
                {/* La medida se toma sobre una caja ancha fija y no sobre la que
                    se anima. React Native mide un hijo absoluto contra el ancho
                    que su padre tiene en ese momento, y ese ancho arranca en
                    cero: la palabra se partía en dos renglones, la medida salía
                    corta y en pantalla quedaba «guard», además más arriba que
                    los íconos. */}
                <View
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    right: 0,
                    width: 160,
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                  }}
                >
                  <Pressable
                    onLayout={(e) => medirAccion(e.nativeEvent.layout.width)}
                    onPress={preguntando ? preguntar : guardar}
                    disabled={guardando || (!preguntando && subiendoAlgo)}
                    hitSlop={12}
                    style={{ paddingVertical: 6, paddingHorizontal: 4 }}
                  >
                    {guardando ? (
                      <MorphingInfinity size={18} color={INK.title} />
                    ) : guardadoOk && !preguntando ? (
                      <Animated.View
                        entering={ZoomIn.springify().damping(12).stiffness(260)}
                        accessibilityLabel="Guardado"
                      >
                        <Check size={20} color="#15803D" strokeWidth={2.6} />
                      </Animated.View>
                    ) : (
                      <Text
                        numberOfLines={1}
                        style={{
                          fontFamily: MONO,
                          fontSize: 14,
                          color: INK.title,
                          letterSpacing: -0.2,
                          // Apagado mientras una foto sube. Sigue diciendo
                          // «guardar» y no «esperá»: el estado es momentáneo y
                          // cambiarle el texto al botón haría creer que es otro.
                          opacity: !preguntando && subiendoAlgo ? 0.32 : 1,
                        }}
                      >
                        {preguntando ? 'enviar' : 'guardar'}
                      </Text>
                    )}
                  </Pressable>
                </View>
              </Animated.View>
            ) : null}
            </View>
          </View>

          {/* Lo que salió mal, arriba y a la vista: al pie de la página quedaba
              debajo de fotos y mapa, y un guardado fallido parecía un botón que
              no hacía nada. Se va solo, o con un toque. */}
          {error ? (
            <Animated.View
              key={error}
              entering={FadeIn.duration(180)}
              exiting={FadeOut.duration(180)}
              style={{ position: 'absolute', top: topInset + 58, left: 18, right: 18, zIndex: 5, alignItems: 'flex-end' }}
            >
              <Pressable
                onPress={() => setError(null)}
                accessibilityRole="alert"
                accessibilityLabel={error}
                style={{
                  maxWidth: '100%',
                  paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
                  backgroundColor: '#FDECEC',
                  borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(185,28,28,0.3)',
                }}
              >
                <Text style={{ fontFamily: MONO, fontSize: 12.5, color: '#B91C1C', lineHeight: 18 }}>{error}</Text>
              </Pressable>
            </Animated.View>
          ) : null}

          {/* Fuera de Notas no hay pager, ni degradado, ni nada de lo que
              flota sobre el teclado: todo eso pertenece a la nota. Espacios
              ocupa el lugar completo, no una página más. */}
          {!enNotas ? (
            <Espacios
              bottomInset={bottomInset}
              onAbrirEspacio={(espacio) => abrirPrincipal(espacio)}
              onNuevoEspacio={() => setCreandoEspacio(true)}
              onAbrirItem={setItemAbierto}
              recarga={recargaEspacios}
              indice={indice}
              panel={panelEspacio}
              onCerrarPanel={() => setPanelEspacio(null)}
              onElegido={setEspacioAbierto}
              onNuevaNota={(espacio) => {
                // Una nota más del espacio, no la principal.
                setPrincipalDe(null);
                empezarNotaEn(espacio);
              }}
              onAbrirNota={(nota) => {
                setModo('notas');
                abrirNota(nota);
              }}
            />
          ) : (
          <>
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
                // Un elemento del Codex no se carga en la hoja: no es un texto
                // que se siga escribiendo, es una ficha con campos. Va a la
                // misma ficha que se abre desde un chip de la nota, y de paso
                // se hidrata sola — ver `aHidratar`.
                onAbrirItem={setItemAbierto}
                arriba={
                  esHistoriaDs ? (
                    <FilasDeHistoria
                      historia={historiaDs}
                      filaId={filaAbierta}
                      onAbrir={(id) => {
                        setFilaAbierta(id);
                        irA(NOTA);
                      }}
                    />
                  ) : null
                }
              />
            </View>

            <View style={{ width: W }}>
              <Nota
                campo={campo}
                bloques={
                  esHistoriaDs ? (
                    <FilaDeHistoria
                      historia={historiaDs}
                      filaId={filaAbierta}
                      onFila={setFilaAbierta}
                      onTitulo={(c) => edicion.editor.getState().historiaComoDatasheet({ ...historiaDs, titulo: c })}
                    />
                  ) : bloquesActivo ? (
                    <EditorBloques
                      ref={refBloques}
                      editor={edicion.editor}
                      rastreo={edicion.rastreo}
                      indice={indice}
                      escribiendo={escribiendo}
                      onEscribir={alEscribirBloques}
                      buscando={buscando}
                      marcador={marcador}
                      onMencion={alMencionBloques}
                      onDecidir={alDecidirBloques}
                      onSeleccion={alSeleccionBloques}
                      medios={mediosBloques}
                      onAgregar={alAgregarBloques}
                    />
                  ) : null
                }
                refBloques={refBloques}
                tramos={tramosPintados}
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
                fotos={enElTexto.size ? fotos.filter((f) => fuera(f.storage_path, f.id)) : fotos}
                onQuitarFoto={quitar}
                onVerFoto={setFotoAbierta}
                audios={enElTexto.size ? audios.filter((a) => fuera(a.storage_path, a.id)) : audios}
                onQuitarAudio={quitarAudio}
                documentos={enElTexto.size ? documentos.filter((d) => fuera(d.storage_path, d.clave)) : documentos}
                esHistoria={!!principalDe}
                onAbrirDocumento={abrirDocumento}
                onQuitarDocumento={quitarDocumento}
                escribiendo={escribiendo}
                vacio={!cuerpo.trim()}
                marcador={marcador}
                // La historia de un espacio se parte sola en secciones; el
                // índice sigue al texto mientras se escribe.
                indice={principalDe && !esHistoriaDs ? indiceHistoria : null}
                texto={cuerpo}
                destino={
                  principalDe?.name
                    ? `historia de ${principalDe.name}`
                    : espacioDestino?.name && (!editandoId || espacioDestino.marcar)
                      ? `se guarda en ${espacioDestino.name}`
                      : null
                }
                lugar={ubicacion}
                onLugar={() => setEligiendoUbicacion(true)}
                // Lo que flota sobre el teclado tapa el fondo de la hoja. La
                // bandeja de fotos cerrada mide 92; la grabadora y la barra de
                // formato, bastante menos.
                /**
                 * Lo que flota tapa el fondo de la hoja, así que se le reserva
                 * sitio. La cápsula de acciones está siempre, y por eso su alto
                 * es el piso: sin eso, la estampa del mapa quedaba justo debajo
                 * y se veía a medias por detrás de los glifos.
                 */
                reservaPie={72 + (mostrandoFotos ? 104 : grabando ? 96 : insertando ? 250 : formateando ? (bloquesActivo ? 196 : 56) : 0)}
                // `false` explícito viene del `onBlur` del campo; sin argumento
                // es el doble toque pidiendo entrar.
                onEscribir={(v) => setEscribiendo(v !== false)}
              />
            </View>

            {/* La página de la derecha cambia de oficio con el modo, igual que
                la del medio: en nota lleva los datos del snippet; en chat, las
                instrucciones con las que Vizta contesta. Es la misma idea que
                hace que el centro deje de ser nota y pase a ser conversación —
                mismo gesto, contenido según lo que se esté haciendo. */}
            <View style={{ width: W }}>
              <PanelSnippet
                items={mencionados}
                porConfirmar={porConfirmar}
                onDecidir={(m) => {
                  roce();
                  setDecidiendo(m);
                }}
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
                ubicacion={ubicacion}
                onUbicacion={() => setEligiendoUbicacion(true)}
                tags={tags}
                onTags={setTags}
                fecha={fecha}
                onFecha={setFecha}
                // En chat, la mitad de abajo son las instrucciones de Vizta en
                // lugar de los detalles del snippet. Los mencionados de arriba
                // se quedan en los dos modos.
                detalles={preguntando ? <PromptSistema /> : null}
                fotos={fotos}
                onVerFoto={setFotoAbierta}
                arriba={
                  esHistoriaDs && !preguntando ? (
                    <View style={{ marginBottom: 34 }}>
                      <TablaDeDataset
                        id={historiaDs.dataset_id}
                        nombre={historiaDs.nombre}
                        editor={edicion.editor}
                        escribiendo={false}
                        filaAbierta={filaAbierta}
                        onAbrirFila={(id) => {
                          roce();
                          setFilaAbierta(id);
                          irA(NOTA);
                        }}
                      />
                      <Pressable
                        onPress={() => {
                          roce();
                          usarComoHistoria(null);
                        }}
                        hitSlop={6}
                        style={({ pressed }) => ({ alignSelf: 'flex-start', paddingVertical: 6, opacity: pressed ? 0.5 : 1 })}
                        accessibilityRole="button"
                      >
                        <Text style={{ fontFamily: MONO, fontSize: 12, color: 'rgba(28,43,34,0.45)' }}>volver a escribir la historia como texto</Text>
                      </Pressable>
                    </View>
                  ) : null
                }
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
                { position: 'absolute', left: 22, right: 22, bottom: bottomInset + 112 },
                sobreTeclado,
              ]}
            >
              {bloquesActivo ? (
                <AutocompletarBloques
                  editor={edicion.editor}
                  indice={indice}
                  onAbrirItem={alMencionBloques}
                  bottomInset={bottomInset}
                />
              ) : (
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
              )}
            </Animated.View>
          ) : null}

          {/* La bandeja de fotos, sobre el teclado.

              Mismo anclaje que el autocompletado y por la misma razón: lo que
              se está escribiendo está justo arriba del teclado, y lo que se
              adjunta se adjunta ahí. Los dos nunca coinciden — encender uno
              apaga el otro. */}
          {pagina === NOTA && mostrandoFotos ? (
            <Animated.View
              pointerEvents="box-none"
              style={[
                { position: 'absolute', left: 0, right: 0, bottom: bottomInset + 108 },
                sobreTeclado,
              ]}
            >
              <BandejaFotos onFoto={adjuntar} />
            </Animated.View>
          ) : null}

          {/* La tira de formato, sobre el teclado. Mismo anclaje que la bandeja
              y la grabadora — y a diferencia de la grabadora, no baja el
              teclado: se formatea en medio de la frase y hay que poder seguir
              escribiendo sin volver a tocar la nota. */}
          {/* Elegir bloques: la barra de lo que se hace con ellos ocupa el
              mismo lugar que la de formato. No hay teclado —elegir y escribir
              no van juntos—, así que queda sobre la cápsula de acciones. */}
          {pagina === NOTA && bloquesActivo && seleccionando ? (
            <Animated.View
              pointerEvents="box-none"
              style={[{ position: 'absolute', left: 0, right: 0, bottom: bottomInset + 108 }, sobreTeclado]}
            >
              <BarraSeleccion editor={edicion.editor} />
            </Animated.View>
          ) : null}

          {pagina === NOTA && formateando && (escribiendo || bloquesActivo) ? (
            <Animated.View
              pointerEvents="box-none"
              style={[
                { position: 'absolute', left: 0, right: 0, bottom: bottomInset + (bloquesActivo ? 16 : 108) },
                sobreTeclado,
              ]}
            >
              {bloquesActivo ? (
                <PanelFormato editor={edicion.editor} onCerrar={() => setFormateando(false)} />
              ) : (
                <BarraFormato onAccion={formatear} onCerrar={() => setFormateando(false)} />
              )}
            </Animated.View>
          ) : null}

          {/* `+`: lo que se agrega a la nota. Mismo anclaje que el formato. */}
          {pagina === NOTA && bloquesActivo && insertando ? (
            <Animated.View
              pointerEvents="box-none"
              style={[{ position: 'absolute', left: 0, right: 0, bottom: bottomInset + (bloquesActivo ? 16 : 108) }, sobreTeclado]}
            >
              <PanelInsertar
                editor={edicion.editor}
                onCerrar={() => setInsertando(false)}
                onMedio={(tipo) => {
                  if (tipo === 'foto') {
                    setMostrandoFotos(true);
                  } else if (tipo === 'audio') {
                    Keyboard.dismiss();
                    setGrabando(true);
                  } else {
                    Keyboard.dismiss();
                    agregarDocumento();
                  }
                }}
              />
            </Animated.View>
          ) : null}

          {/* La grabadora, sobre el teclado. Mismo anclaje que la bandeja. */}
          {pagina === NOTA && grabando ? (
            <Animated.View
              pointerEvents="box-none"
              style={[
                { position: 'absolute', left: 0, right: 0, bottom: bottomInset + 108 },
                sobreTeclado,
              ]}
            >
              <GrabadorVoz
                onCerrar={() => setGrabando(false)}
                onListo={({ uri, duracionMs }) => {
                  setGrabando(false);
                  adjuntarGrabacion(uri, duracionMs);
                }}
              />
            </Animated.View>
          ) : null}

          {/* Crear un item con lo que seleccionaste. Aparece solo mientras hay
              selección y solo en la nota — en las otras páginas no hay texto
              del que sacarlo. Va abajo y no arriba para no pelearse con el menú
              de copiar/pegar que iOS pone sobre la selección. */}
          {/* Barra de abajo: o el botón de crear, o los puntos. Una sola capa
              que sube con el teclado, para que ninguno de los dos quede tapado. */}
          {/* Cómo se escribe. **Una vez, y solo cuando no es obvio.**
              
              Con la hoja en blanco no va: el marcador ya dice «escribí lo que
              quieras» y alcanza un toque, así que la pista repetiría lo que el
              campo afirma cuatro dedos más arriba.
              
              Con texto escrito sí, porque ahí hace falta un doble toque y un
              toque suelto no hace nada — eso no lo adivina nadie. Se marca hecha
              al entrar a escribir y no vuelve más. */}
          {pagina === NOTA && cuerpo.trim() && !escribiendo && !preguntando && !mostrandoFotos && !grabando ? (
            <Animated.View
              pointerEvents="none"
              style={[
                { position: 'absolute', left: 0, right: 0, bottom: bottomInset + 42 },
                sobreTeclado,
              ]}
            >
              <Pista clave={PISTA.ESCRIBIR}>Toca dos veces el texto para editarlo</Pista>
            </Animated.View>
          ) : null}

          {/* ── Las acciones, sobre el teclado ──
            *
            * Arriba quedaron el cierre, dónde estás y guardar; lo que se hace
            * con la nota —foto, formato, lugar, voz, buscar, preguntar— vive
            * acá abajo. No es una preferencia estética: la barra de arriba
            * tenía seis botones más un switch más guardar, y eso pide 402
            * puntos donde el teléfono da 374, así que la cámara terminaba
            * montada sobre la pastilla. Cualquier acción nueva volvía a
            * romperla.
            *
            * Abajo, además, están donde está la mano mientras se escribe —es lo
            * que hacen Notas y Bear— y la fila puede crecer sin pelearse con
            * nada: lo que se abre (la bandeja, el formato, la grabadora) sale
            * **encima** de esta tira, no en su lugar. */}
          {enNotas && pagina === NOTA && !panelAbierto ? (
            <Animated.View
              pointerEvents="box-none"
              style={[
                { position: 'absolute', left: 0, right: 0, bottom: bottomInset + 56 },
                sobreTeclado,
              ]}
            >
              <Capsula atenuada={mostrandoFotos || formateando || grabando || insertando}>
          {/* Fotos. Solo mientras se escribe una nota: en modo chat no va,
              porque lo que se le manda a Vizta es texto — adjuntar una foto
              ahí prometería que la va a mirar, y no la mira. */}
          {enNotas && pagina === NOTA && !preguntando && !bloquesActivo ? (
            <Glifo
              Icono={Camera}
              activo={mostrandoFotos}
              onPress={() => {
                setMostrandoFotos((m) => !m);
                // La bandeja, el autocompletado y la tira de formato ocupan el
                // mismo lugar sobre el teclado; no pueden estar los tres.
                setBuscando(false);
                setFormateando(false);
                setInsertando(false);
              }}
            />
          ) : null}

          {/* Un documento: PDF, Word o texto. En una historia el servidor lo
              lee y entra a su memoria; en una nota normal queda de apoyo. */}
          {enNotas && pagina === NOTA && !preguntando && !bloquesActivo ? (
            <Glifo
              Icono={FileText}
              activo={false}
              onPress={() => {
                Keyboard.dismiss();
                setMostrandoFotos(false);
                setGrabando(false);
                agregarDocumento();
              }}
            />
          ) : null}

          {/* Cómo se ve lo que se escribe.

              Solo mientras se escribe, y por eso cuelga de `escribiendo` y no
              de la página: leyendo una nota no hay nada que formatear, y un
              botón que no hace nada en la mitad de los casos enseña a
              ignorarlo. Es el único de la barra que aparece y desaparece con
              el teclado. */}
          {/* Aparece al entrar a escribir y se va al salir. Con la transición
              de disposición de la cápsula, los vecinos se corren en el mismo
              movimiento en vez de saltar de lugar. */}
          {enNotas && pagina === NOTA && !preguntando && escribiendo ? (
            <Glifo
              entrando
              Icono={Type}
              activo={formateando}
              onPress={() => {
                // Con bloques el panel toma el lugar del teclado.
                if (bloquesActivo) Keyboard.dismiss();
                setFormateando((f) => !f);
                setInsertando(false);
                setMostrandoFotos(false);
                setGrabando(false);
                setBuscando(false);
              }}
            />
          ) : null}

          {/* `+`: agregar a la nota —página, tabla, dataset, código, fórmula,
              dibujo, separadores, foto, audio, documento—. Con el editor de
              bloques reemplaza a la cámara, el documento y el micrófono, que
              pasan a estar adentro con su nombre. */}
          {enNotas && pagina === NOTA && !preguntando && bloquesActivo ? (
            <Glifo
              Icono={Plus}
              activo={insertando}
              onPress={() => {
                Keyboard.dismiss();
                setInsertando((v) => !v);
                setFormateando(false);
                setMostrandoFotos(false);
                setGrabando(false);
                setBuscando(false);
              }}
            />
          ) : null}

          {/* Lo que quedó a mano (ver `bloques/aMano.js`): mientras se
              escribe, al lado de Aa y `+`, actúa sin bajar el teclado. */}
          {enNotas && pagina === NOTA && !preguntando && bloquesActivo && escribiendo && !panelAbierto
            ? aManoLista.map((a) => {
                const def = ACCIONES_A_MANO[a];
                return def ? (
                  <Glifo key={a} entrando Icono={def.Icono} onPress={() => edicion.editor.getState().formatear(a)} />
                ) : null;
              })
            : null}

          {/* Dónde pasó.
            *
            * Un toque pone dónde estás ahora, que es el caso de casi todas
            * las veces: se anota algo en el lugar donde está pasando. Cambiar
            * el punto o buscar otro se hace desde la estampa del mapa, abajo
            * de la nota — ahí ya se está mirando el lugar, que es cuando se
            * decide si está bien. */}
          {enNotas && pagina === NOTA && !preguntando ? (
            <Glifo
              Icono={MapPin}
              activo={Boolean(ubicacion)}
              onPress={() => {
                // Interruptor, como el resto de la cápsula: si está puesta, el
                // toque la quita. Antes abría las opciones, y eso hacía que el
                // único botón encendido de la barra fuera el único que no se
                // podía apagar tocándolo.
                //
                // Cambiarla —a otro lugar, o a donde estoy ahora— se hace desde
                // la estampa del mapa, que es donde ya se está mirando el punto
                // y donde la decisión tiene el contexto a la vista.
                if (ubicacion) setUbicacion(null);
                else ubicarAqui();
              }}
            />
          ) : null}

          {/* Dónde se guarda: en un espacio, y si va como una de sus
              historias. Abierta una historia, la casilla viene marcada:
              desmarcarla la deja como una nota normal del espacio. */}
          {enNotas && pagina === NOTA && !preguntando ? (
            <Glifo
              Icono={Layers}
              activo={Boolean(principalDe || (espacioDestino && (!editandoId || espacioDestino.marcar)))}
              onPress={() => {
                Keyboard.dismiss();
                setEligiendoEspacio(true);
                listSpaces()
                  .then((es) => setEspaciosParaGuardar(es || []))
                  .catch(() => setEspaciosParaGuardar([]));
              }}
            />
          ) : null}

          {/* Grabar una nota de voz.
          
              Micrófono propio y no un casillero dentro de la bandeja de
              fotos: grabar no es elegir un archivo, y meterlo ahí lo dejaba
              pareciendo un tipo más de imagen. */}
          {enNotas && pagina === NOTA && !preguntando && !bloquesActivo ? (
            <Glifo
              Icono={Mic}
              activo={grabando}
              onPress={() => {
                setGrabando((g) => !g);
                // La grabadora, la bandeja y la tira de formato ocupan el
                // mismo lugar sobre el teclado; no pueden estar las tres.
                setMostrandoFotos(false);
                setFormateando(false);
                setInsertando(false);
                setBuscando(false);
                Keyboard.dismiss();
              }}
            />
          ) : null}

              </Capsula>
            </Animated.View>
          ) : null}

          <Animated.View
            pointerEvents={panelAbierto ? 'none' : 'box-none'}
            style={[
              { position: 'absolute', left: 0, right: 0, bottom: bottomInset + 16, alignItems: 'center' },
              panelAbierto && { opacity: 0 },
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
          </>
          )}
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

      <ElegirEspacio
        visible={eligiendoEspacio}
        espacios={espaciosParaGuardar}
        actual={principalDe?.id || espacioDestino?.id || null}
        comoHistoria={!!principalDe}
        bottomInset={bottomInset}
        // Elegir no cierra: la hoja queda abierta para decidir si va como
        // historia. Se cierra con «Listo» o tocando afuera.
        onElegir={(espacio, historia) => {
          const marca = { id: espacio.id, name: espacio.name, marcar: true };
          setEspacioDestino(marca);
          setPrincipalDe(historia ? marca : null);
        }}
        onQuitar={() => {
          setEspacioDestino(null);
          setPrincipalDe(null);
          setEligiendoEspacio(false);
        }}
        onClose={() => setEligiendoEspacio(false)}
      />

      {/* Cambiar el dónde: donde estoy, otro lugar por nombre, o ninguno. */}
      <OpcionesUbicacion
        visible={eligiendoUbicacion}
        ubicacion={ubicacion}
        bottomInset={bottomInset}
        onAqui={async () => {
          setEligiendoUbicacion(false);
          await ubicarAqui();
        }}
        onBuscar={() => {
          setEligiendoUbicacion(false);
          setBuscandoLugar(true);
        }}
        onQuitar={() => {
          setEligiendoUbicacion(false);
          setUbicacion(null);
        }}
        onClose={() => setEligiendoUbicacion(false)}
      />

      {/* El mismo buscador del mapa: es Apple Places contra el proxy del
          servidor, y tener dos buscadores de lugares sería tener dos formas de
          nombrar el mismo sitio. */}
      <BuscarLugar
        visible={buscandoLugar}
        centro={ubicacion || null}
        onElegir={(sugerencia) => {
          setBuscandoLugar(false);
          setUbicacion({
            lat: sugerencia.lat,
            lng: sugerencia.lng,
            nombre: sugerencia.name || null,
            direccion: sugerencia.address || null,
          });
          roce();
        }}
        onClose={() => setBuscandoLugar(false)}
      />

      <VisorFoto foto={fotoAbierta} onCerrar={() => setFotoAbierta(null)} />

      {/* La ficha de un item, cuando se toca un chip de la nota. Tenía dos
          padres posibles —la hoja y el editor de bloques del espacio—; con el
          editor fuera, el documento de un espacio es una nota más y la ficha
          cuelga siempre de la hoja. */}
      {ficha}

      {decidiendo ? (
        <DecidirMencion
          mencion={decidiendo}
          bottomInset={bottomInset}
          onClose={() => setDecidiendo(null)}
          onDecidido={() => {
            setDecidiendo(null);
            releerVeredictos();
          }}
        />
      ) : null}

      {creandoEspacio ? (
        <CreateSpaceSheet
          onClose={() => setCreandoEspacio(false)}
          bottomInset={bottomInset}
          onCreated={(espacio) => {
            setCreandoEspacio(false);
            setRecargaEspacios((n) => n + 1);
            // Se abre lo que se acaba de crear. Volver a la lista para buscarlo
            // ahí sería hacer dos pasos de lo que es uno solo: nadie crea un
            // espacio para mirarlo desde afuera.
            if (espacio) abrirPrincipal(espacio);
          }}
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
  bloques = null,
  refBloques = null,
  tramos,
  onChangeText,
  onSelectionChange,
  seleccion,
  topInset,
  bottomInset,
  error,
  hilo,
  desplazar,
  fotos,
  onQuitarFoto,
  onVerFoto,
  audios,
  onQuitarAudio,
  documentos,
  esHistoria,
  onAbrirDocumento,
  onQuitarDocumento,
  escribiendo,
  onEscribir,
  vacio,
  marcador,
  destino,
  indice,
  texto,
  lugar,
  onLugar,
  reservaPie = 0,
}) {
  const hoja = useRef(null);

  /**
   * Ir a una sección desde el índice.
   *
   * El campo es uno solo, así que no hay un elemento por sección al que
   * desplazarse. Pero la nota es monoespaciada: cuántos renglones hay antes de
   * la sección es aritmética (`renglonesHasta`), y con el alto de renglón eso
   * da la altura. Los títulos miden un poco más que el cuerpo, así que puede
   * quedar un renglón corrido; se deja aire arriba para que igual se vea.
   *
   * Con bloques no hace falta la cuenta: cada sección apunta a su bloque, y
   * el editor sabe dónde está. Una página se abre y se lee desde arriba.
   */
  const caja = useRef({ y: 0, ancho: 0 });
  const irA = useCallback(
    (sec) => {
      const arriba = topInset + 66 + caja.current.y;
      let y;
      if (sec.pagina && refBloques?.current) {
        refBloques.current.abrirPagina(sec.pagina);
        y = arriba;
      } else if (sec.bloque && refBloques?.current) {
        y = arriba + (refBloques.current.yDe(sec.bloque) ?? 0);
      } else {
        const porRenglon = Math.floor(caja.current.ancho / (15 * 0.6)) || 40;
        y = arriba + renglonesHasta(texto, sec.inicio, porRenglon) * 27;
      }
      hoja.current?.scrollTo({ y: Math.max(0, y - 36), animated: true });
      roce();
    },
    [texto, topInset, refBloques]
  );

  /**
   * Doble toque para escribir.
   *
   * La hoja es la misma para leer y para escribir, y con un solo toque
   * escribir ganaba siempre: cualquier roce al desplazar o al mirar una foto
   * levantaba el teclado y te tapaba media nota. Releer una nota larga era
   * bajarle el teclado cada dos pantallas.
   *
   * Con dos toques, leer es el estado natural y escribir es una decisión. Es la
   * misma idea de por qué `autoFocus` no está: leer no tiene que costar nada.
   *
   * **En una hoja en blanco alcanza un toque.** El doble toque existe para que
   * escribir no le gane a leer, y en una nota vacía no hay nada que leer: pedir
   * dos toques ahí sería fricción sin nada que proteger. Abrir una nota nueva y
   * tocar tiene que escribir, como en cualquier papel en blanco.
   *
   * Los 280 ms son el margen del sistema para un doble toque. Más corto deja
   * afuera al que toca despacio; más largo hace que dos toques a propósito en
   * lugares distintos se lean como uno doble.
   */
  const ultimo = useRef(0);

  const tocar = useCallback(() => {
    if (vacio) {
      onEscribir?.();
      return;
    }

    const ahora = Date.now();
    if (ahora - ultimo.current < 280) {
      ultimo.current = 0;
      onEscribir?.();
    } else {
      ultimo.current = ahora;
    }
  }, [onEscribir, vacio]);

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

  // Con bloques, cada Enter crea un campo nuevo más abajo, y ese campo tiene
  // que quedar a la vista por encima del teclado y de lo que flota sobre él.
  // El `ScrollView` de siempre no lo hace solo; el de keyboard-controller sí.
  const Hoja = bloques ? KeyboardAwareScrollView : ScrollView;

  const hojaEntera = (
    <Hoja
      ref={hoja}
      contentContainerStyle={{ flexGrow: 1, paddingTop: topInset + 66, paddingBottom: bottomInset + 70 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      {...(bloques ? { bottomOffset: reservaPie + 24 } : null)}
    >
      {/* Medida angosta y centrada en la pantalla; el texto, a la izquierda
          dentro de la columna. */}
      <View style={{ flex: 1, alignSelf: 'center', width: '100%', maxWidth: 420, paddingHorizontal: 30 }}>
        {/* Toda la zona vacía enfoca el campo: la página entera se siente
            escribible, no solo el renglón donde está el cursor. Leyendo una nota
            existente, el mismo toque es el que pasa a escribir — igual que en
            las notas de iOS, donde tocar el texto pone el cursor. */}
        {hilo}

        {destino ? (
          <Text
            style={{
              fontFamily: MONO,
              fontSize: 11.5,
              color: 'rgba(28,43,34,0.32)',
              marginBottom: 14,
            }}
          >
            {destino}
          </Text>
        ) : null}

        {/* El índice de la historia: solo leyendo, y solo si tiene más de una
            parte. Mientras se escribe no hace falta, y ocuparía el lugar del
            texto. */}
        {indice?.length >= 2 && !escribiendo ? (
          <Animated.View entering={FadeIn.duration(200)} style={{ marginBottom: 20 }}>
            {indice.map((sec, i) => (
              <Pressable
                key={`${i}-${sec.inicio ?? sec.bloque}`}
                onPress={() => irA(sec)}
                hitSlop={3}
                style={({ pressed }) => ({ flexDirection: 'row', gap: 10, paddingVertical: 4, opacity: pressed ? 0.5 : 1 })}
                accessibilityRole="button"
                accessibilityLabel={`Ir a ${sec.titulo}`}
              >
                <Text style={{ fontFamily: MONO, fontSize: 11.5, lineHeight: 18, color: 'rgba(75,79,166,0.45)', width: 16 }}>
                  {i + 1}
                </Text>
                <Text numberOfLines={1} style={{ flex: 1, fontFamily: MONO, fontSize: 12, lineHeight: 18, color: '#4B4FA6' }}>
                  {sec.titulo}
                </Text>
              </Pressable>
            ))}
          </Animated.View>
        ) : null}



        {/* Sin `flex: 1`. Lo llevaba, y con eso el campo se estiraba hasta el
            final de la página y empujaba las fotos al fondo, lejos del texto
            del que hablan. El relleno que hace que tocar el vacío enfoque la
            nota está abajo, después de las adjuntas. */}
        <View
          onLayout={(e) => {
            caja.current = { y: e.nativeEvent.layout.y, ancho: e.nativeEvent.layout.width };
          }}
        >
          {/* Con el interruptor del editor de bloques, el cuerpo son bloques;
              leen y escriben con las mismas reglas (ver `EditorBloques`). */}
          {bloques || (
          <>
          <TextInput
            ref={campo}
            // Leyendo, el campo no es editable: así ningún toque pone el cursor
            // ni levanta el teclado por accidente. En cuanto se entra a
            // escribir pasa a editable y todo vuelve a ser nativo — tocar
            // cualquier renglón mueve el cursor, se puede seleccionar, etc.
            editable={escribiendo}
            onBlur={() => onEscribir?.(false)}
            onChangeText={onChangeText}
            onSelectionChange={onSelectionChange}
            // Solo cuando el autocompletado acaba de mover el cursor. El resto
            // del tiempo va sin controlar, que es lo que deja escribir normal:
            // un `selection` fijo le clavaría el cursor en un lugar.
            selection={seleccion || undefined}
            placeholder={marcador}
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
              // El campo se achica a lo que se está escribiendo en cuanto hay
              // algo debajo suyo — el hilo de Vizta, o fotos adjuntas.
              //
              // Los 260 de reserva son para la hoja en blanco: dan sensación de
              // papel y de que hay lugar para escribir. Pero con una foto
              // abajo, esa reserva se vuelve un hueco: la foto quedaba flotando
              // a media pantalla, lejos del renglón del que habla. Sin ella, la
              // foto se apoya en la última línea escrita y baja sola a medida
              // que el texto crece, como una imagen en un documento.
              minHeight: hilo || fotos?.length || audios?.length || lugar ? 64 : 260,
              textAlignVertical: 'top',
              padding: 0,
            }}
          >
            {tramos.map((t, i) =>
              t.item || t.marca || t.titulo || t.negrita || t.cursiva || t.resaltado || t.codigo ? (
                // Sin `onPress`: un `Text` anidado dentro de un `TextInput` no
                // lo recibe —el campo se queda el toque para poner el cursor—.
                // Quién se tocó lo resuelve `alSeleccionar` mirando dónde quedó
                // ese cursor, que es el mismo dato por otro camino.
                //
                // El formato viaja en la misma pieza que la mención: negrita,
                // títulos y resaltados se pintan acá adentro, mientras se
                // escribe, sin separar lo que se ve de lo que se guarda.
                <Text
                  key={i}
                  style={[
                    estiloDePieza(t),
                    t.item ? { color: tinta(colorDe(t.item), (t.estado === 'dudosa' ? 0.55 : 1) * (t.alfa ?? 1)) } : null,
                    // Dudosa: el color apagado y un subrayado de puntos. Se
                    // ve que es un nombre, y que falta decir si es ese.
                    t.item && t.estado === 'dudosa'
                      ? {
                          textDecorationLine: 'underline',
                          textDecorationStyle: 'dotted',
                          textDecorationColor: tinta(colorDe(t.item), 0.55 * (t.alfa ?? 1)),
                        }
                      : null,
                  ]}
                >
                  {t.texto}
                </Text>
              ) : (
                t.texto
              )
            )}
          </TextInput>

          {/* La capa que se come los toques mientras se lee.
              
              Va encima del campo y no en su lugar: el texto de abajo sigue
              siendo el mismo `TextInput` con sus tramos de color, y al entrar a
              escribir esta capa desaparece sin que nada se remonte ni pierda el
              scroll. */}
          {!escribiendo ? (
            <Pressable
              onPress={tocar}
              style={StyleSheet.absoluteFillObject}
              accessibilityRole="button"
              accessibilityLabel="Tocá dos veces para escribir"
            />
          ) : null}
          </>
          )}
        </View>

        {/* El aire, **antes** del pie y no después.
          *
          * Es lo que hace que la hoja se vea como una hoja. Con el relleno al
          * final, las adjuntas quedaban pegadas al texto y el hueco sobraba
          * abajo: una nota con solo un mapa lo mostraba a media pantalla,
          * flotando, con vacío debajo. Poniéndolo acá, el hueco empuja — el
          * texto arriba, lo adjunto apoyado en el fondo — y cuando hay mucho
          * que mostrar se colapsa a su mínimo y todo scrollea como siempre.
          *
          * Dos toques acá también entran a escribir: la página entera es la
          * nota, no solo el renglón donde está el cursor. */}
        <Pressable
          onPress={
            bloques ? () => refBloques?.current?.tocarFinal() : escribiendo ? () => campo.current?.focus() : tocar
          }
          style={{ flex: 1, minHeight: 40 }}
        />

        {/* El pie de la nota: lo que acompaña al texto.
          *
          * Los tres van juntos y con transición de disposición para que
          * adjuntar una foto no sea un salto: el bloque crece desde abajo y el
          * mapa se encoge en el mismo movimiento, en vez de aparecer todo de
          * golpe en una posición nueva. */}
        <Animated.View layout={LinearTransition.springify().damping(22).stiffness(140)}>
          {/* El audio va **antes** que las fotos: una nota de voz se graba
              mientras se escribe —es parte del pensamiento en curso— y aparecer
              debajo de cuatro fotos la alejaba del renglón que la motivó. Las
              fotos son material que se mira después; el audio, algo que acabás
              de decir.

              Sobre la limitación: cae debajo del texto, no **dentro** de él.
              Partir el cuerpo en el cursor para meter el reproductor en medio
              pide reemplazar el `TextInput` único por un editor de bloques, y
              con él se caen el resaltado del Codex, el autocompletado, el toque
              en un nombre para abrir su ficha y el modo Vizta. */}
          <Audios audios={audios} onQuitar={onQuitarAudio} />

          <DocumentosNota
            documentos={documentos}
            esHistoria={esHistoria}
            onAbrir={onAbrirDocumento}
            onQuitar={onQuitarDocumento}
          />

          <Adjuntas fotos={fotos} onQuitar={onQuitarFoto} onVer={onVerFoto} />

          {/* Dónde pasó, al final: primero lo que se escribió, después el
              contexto. Es el orden en que se lee una nota — el lugar contesta
              una pregunta que recién aparece cuando ya se sabe qué dice. */}
          <MiniMapa
            ubicacion={lugar}
            onPress={onLugar}
            compacto={Boolean(fotos?.length || audios?.length)}
          />
        </Animated.View>


        {/* El sitio de lo que flota.
          *
          * La bandeja de fotos, la grabadora y la barra de formato se dibujan
          * **encima** de la hoja, ancladas al teclado. Sin reservarles lugar,
          * caían sobre el pie de la nota y lo tapaban — el mapa a medio ver por
          * debajo de la galería. Este espaciador es ese lugar: crece cuando
          * algo se abre y se va cuando se cierra, así que el pie sube en vez de
          * quedar debajo. */}
        <Reserva alto={reservaPie} />
      </View>
    </Hoja>
  );

  return bloques ? <KeyboardProvider>{hojaEntera}</KeyboardProvider> : hojaEntera;
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
/**
 * El mensaje de un error, para mostrarle a la persona.
 *
 * Los de cupo ya vienen escritos para ella («Te quedaste sin espacio de
 * almacenamiento.», ver `usoStore`); los técnicos de la base o del
 * almacenamiento no, y en su lugar va el de respaldo.
 */
function motivoDe(e, respaldo) {
  const m = String(e?.message || '');
  return /límite|almacenamiento|tu plan|créditos|cupo/i.test(m) ? m : respaldo;
}


/**
 * Las tres formas de decir dónde.
 *
 * Una hoja y no un menú flotante: hay que poder ver cuál está puesto ahora,
 * porque cambiar la ubicación a ciegas es peor que no poder cambiarla.
 */
function OpcionesUbicacion({ visible, ubicacion, bottomInset = 0, onAqui, onBuscar, onQuitar, onClose }) {
  if (!visible) return null;

  const actual = ubicacion
    ? ubicacion.nombre ||
      ubicacion.direccion ||
      `${Number(ubicacion.lat).toFixed(4)}, ${Number(ubicacion.lng).toFixed(4)}`
    : null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(20,28,22,0.4)', justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <Animated.View
          entering={FadeInDown.springify().damping(19).stiffness(180)}
          style={{
            backgroundColor: PAPEL,
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            paddingHorizontal: 20,
            paddingTop: 18,
            paddingBottom: bottomInset + 18,
          }}
        >
          <Text style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 0.08, color: 'rgba(28,43,34,0.45)' }}>
            DÓNDE PASÓ
          </Text>
          {actual ? (
            <Text numberOfLines={1} style={{ fontSize: 15, color: INK.title, marginTop: 6 }}>
              {actual}
            </Text>
          ) : null}

          <View style={{ marginTop: 16, gap: 8 }}>
            <OpcionLugar Icono={LocateFixed} texto="Donde estoy" onPress={onAqui} />
            <OpcionLugar Icono={Search} texto="Buscar otro lugar" onPress={onBuscar} />
            {/* Quitar va al final y en rojo: es el único que borra algo. */}
            {ubicacion ? <OpcionLugar Icono={X} texto="Quitar la ubicación" peligro onPress={onQuitar} /> : null}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

/**
 * Dónde se guarda la nota.
 *
 * Tocar un espacio lo elige, y la hoja queda abierta. Abajo, una casilla decide
 * si la nota es **una historia** de ese espacio o una nota más adentro: casi
 * siempre es una nota más, así que arranca sin marcar. Un espacio puede tener
 * varias historias; una nueva se suma después de las que ya tiene.
 */
function ElegirEspacio(props) {
  if (!props.visible) return null;
  return <HojaEspacio {...props} />;
}

function HojaEspacio({ espacios, actual, comoHistoria, bottomInset = 0, onElegir, onQuitar, onClose }) {
  const [elegidoId, setElegidoId] = useState(actual);
  const [historia, setHistoria] = useState(!!comoHistoria);
  const elegido = (espacios || []).find((e) => e.id === elegidoId) || null;

  // El tilde: cuánto está marcado (0–1).
  const marca = useSharedValue(comoHistoria ? 1 : 0);
  const estiloCaja = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + marca.value * 0.06 - marca.value * marca.value * 0.06 }],
    backgroundColor: marca.value > 0.5 ? '#4B4FA6' : 'transparent',
    borderColor: marca.value > 0.5 ? '#4B4FA6' : 'rgba(28,43,34,0.28)',
  }));
  const estiloTilde = useAnimatedStyle(() => ({
    opacity: marca.value,
    transform: [{ scale: 0.5 + marca.value * 0.5 }],
  }));

  const marcar = (v) => {
    marca.value = withSpring(v ? 1 : 0, { damping: 14, stiffness: 260 });
  };

  const elegir = (espacio) => {
    roce();
    setElegidoId(espacio.id);
    onElegir(espacio, historia);
  };

  const alternar = () => {
    const siguiente = !historia;
    toque();
    setHistoria(siguiente);
    marcar(siguiente);
    if (elegido) onElegir(elegido, siguiente);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(20,28,22,0.4)', justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <Animated.View
          entering={FadeInDown.springify().damping(19).stiffness(180)}
          style={{
            backgroundColor: PAPEL,
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            paddingHorizontal: 20,
            paddingTop: 18,
            paddingBottom: bottomInset + 18,
            maxHeight: '76%',
          }}
        >
          <Text style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 0.08, color: 'rgba(28,43,34,0.45)' }}>
            DÓNDE SE GUARDA
          </Text>

          {espacios === null ? (
            <ActivityIndicator size="small" color={INK.faint} style={{ marginVertical: 28 }} />
          ) : !espacios.length ? (
            <Text style={{ fontFamily: MONO, fontSize: 12.5, color: 'rgba(28,43,34,0.45)', marginVertical: 22 }}>
              todavía no tenés espacios.
            </Text>
          ) : (
            <ScrollView
              style={{ marginTop: 14, flexGrow: 0 }}
              contentContainerStyle={{ gap: 8 }}
              showsVerticalScrollIndicator={false}
            >
              {espacios.map((e) => {
                const esEste = elegidoId === e.id;
                return (
                  <Pressable
                    key={e.id}
                    onPress={() => elegir(e)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: esEste }}
                    accessibilityLabel={`Guardar en ${e.name}`}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      paddingVertical: 14,
                      paddingHorizontal: 15,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: esEste ? 'rgba(75,79,166,0.45)' : 'rgba(28,43,34,0.12)',
                      backgroundColor: pressed ? 'rgba(28,43,34,0.04)' : 'transparent',
                    })}
                  >
                    {esEste ? (
                      <Animated.View entering={ZoomIn.springify().damping(16)}>
                        <Check size={15} color="#4B4FA6" />
                      </Animated.View>
                    ) : null}
                    <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, color: esEste ? '#4B4FA6' : INK.body }}>
                      {e.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {/* La casilla: historia o nota más. */}
          <Pressable
            onPress={alternar}
            hitSlop={6}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: historia }}
            accessibilityLabel="Guardar como una historia del espacio"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 16, paddingVertical: 6 }}
          >
            <Animated.View
              style={[
                {
                  width: 20,
                  height: 20,
                  borderRadius: 6,
                  borderWidth: 1.5,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
                estiloCaja,
              ]}
            >
              <Animated.View style={estiloTilde}>
                <Check size={13} color={PAPEL} strokeWidth={3} />
              </Animated.View>
            </Animated.View>
            <Text style={{ flex: 1, fontSize: 15, color: INK.body }}>como historia</Text>
          </Pressable>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            {elegidoId ? (
              <View style={{ flex: 1 }}>
                <OpcionLugar Icono={X} texto="Ninguno" onPress={onQuitar} />
              </View>
            ) : null}
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Listo"
              style={({ pressed }) => ({
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 14,
                borderRadius: 12,
                backgroundColor: '#4B4FA6',
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ fontSize: 15, color: PAPEL, fontWeight: '600' }}>Listo</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function OpcionLugar({ Icono, texto, peligro, onPress }) {
  const color = peligro ? '#B91C1C' : INK.body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={texto}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 15,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: peligro ? 'rgba(185,28,28,0.18)' : 'rgba(28,43,34,0.12)',
        backgroundColor: pressed ? 'rgba(28,43,34,0.05)' : 'transparent',
      })}
    >
      <Icono size={17} color={color} />
      <Text style={{ fontSize: 15, color }}>{texto}</Text>
    </Pressable>
  );
}

/**
 * Un hueco que aparece y desaparece con lo que flota sobre el teclado.
 *
 * Animado y no un salto: lo dispara abrir una bandeja, y el contenido de la
 * hoja tiene que acompañar ese movimiento en vez de teletransportarse.
 */
function Reserva({ alto }) {
  const valor = useSharedValue(alto);

  useEffect(() => {
    valor.value = withTiming(alto, { duration: 220 });
  }, [alto, valor]);

  const estilo = useAnimatedStyle(() => ({ height: valor.value }));

  return <Animated.View pointerEvents="none" style={estilo} />;
}

/**
 * La cápsula que contiene las acciones.
 *
 * Una sola píldora con los glifos adentro, como la barra de formato de Notes:
 * seis botones sueltos sobre el papel se leen como seis cosas; dentro de una
 * cápsula se leen como una herramienta. Y al flotar sobre el texto, el fondo
 * propio es lo que los separa de lo escrito sin dibujar una línea.
 *
 * **Cede el lugar cuando algo se abre.** Al desplegar la bandeja, el formato o
 * la grabadora, la cápsula se hunde un poco y pierde presencia —no desaparece,
 * porque desde ahí se apaga lo que se acaba de abrir—. Es la misma idea que un
 * plano de fondo: lo que está atrás se ve atrás.
 */
function Capsula({ atenuada, children }) {
  const hundida = useSharedValue(0);

  useEffect(() => {
    hundida.value = withTiming(atenuada ? 1 : 0, { duration: 180 });
  }, [atenuada, hundida]);

  const estilo = useAnimatedStyle(() => ({
    opacity: 1 - hundida.value * 0.45,
    transform: [{ scale: 1 - hundida.value * 0.03 }],
  }));

  return (
    <Animated.View style={[{ alignItems: 'center' }, estilo]}>
      <Animated.View
        layout={LinearTransition.springify().damping(24).stiffness(260)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
          paddingHorizontal: 8,
          paddingVertical: 5,
          borderRadius: 999,
          backgroundColor: 'rgba(255,255,255,0.94)',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: 'rgba(28,43,34,0.08)',
          shadowColor: '#14201A',
          shadowOpacity: 0.1,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
}

/**
 * Un glifo de la cápsula.
 *
 * Sin píldora propia —la cápsula ya es el contenedor— y con el estado activo
 * puesto en el color, no en un fondo: dentro de una barra, seis rectángulos
 * teñidos compiten entre sí y con el texto de atrás.
 *
 * El toque se siente en el glifo mismo: se encoge apenas al presionar y vuelve
 * con resorte. Es la única animación que tiene, y dura lo que dura el dedo.
 */
function Glifo({ Icono, activo, onPress, entrando }) {
  const press = useSharedValue(0);

  const estilo = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.12 }],
  }));

  const Caja = entrando ? Animated.View : View;
  const animacion = entrando
    ? {
        // Se abre desde su propio centro, no aparece de la nada: 150 ms y un
        // resorte corto, que es lo que tarda el teclado en asentarse.
        entering: ZoomIn.springify().damping(20).stiffness(320).mass(0.6),
        exiting: ZoomOut.duration(130),
      }
    : {};

  return (
    <Caja {...animacion}>
      <Pressable
        onPressIn={() => {
          press.value = withTiming(1, { duration: 90 });
        }}
        onPressOut={() => {
          press.value = withSpring(0, MOTION.tap);
        }}
        onPress={() => {
          roce();
          onPress();
        }}
        hitSlop={6}
        accessibilityRole="button"
        style={{ width: 40, height: 38, alignItems: 'center', justifyContent: 'center' }}
      >
        <Animated.View style={estilo}>
          <Icono size={17} color={activo ? '#4B4FA6' : 'rgba(28,43,34,0.62)'} strokeWidth={activo ? 2.3 : 1.9} />
        </Animated.View>
      </Pressable>
    </Caja>
  );
}

/**
 * Los dos glifos que se quedaron arriba.
 *
 * Buscar en el Codex y preguntarle a Vizta **no son acciones sobre el texto**:
 * una abre el autocompletado y la otra cambia de modo la hoja entera. Las de
 * abajo —foto, formato, lugar, voz— le hacen algo a lo que se está escribiendo;
 * estas dos cambian con qué se está trabajando, y eso siempre vivió en la barra
 * de arriba.
 *
 * Mismo tamaño y mismo toque que los de la cápsula, sin fondo: en una barra
 * sobre papel, un botón que se dibuja a sí mismo pide más atención de la que
 * merece.
 */
function GlifoBarra({ Icono, activo, onPress }) {
  const press = useSharedValue(0);

  const estilo = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.12 }],
  }));

  return (
    <Pressable
      onPressIn={() => {
        press.value = withTiming(1, { duration: 90 });
      }}
      onPressOut={() => {
        press.value = withSpring(0, MOTION.tap);
      }}
      onPress={() => {
        roce();
        onPress();
      }}
      hitSlop={8}
      accessibilityRole="button"
      style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
    >
      <Animated.View style={estilo}>
        <Icono size={16} color={activo ? '#4B4FA6' : 'rgba(28,43,34,0.55)'} strokeWidth={activo ? 2.3 : 1.9} />
      </Animated.View>
    </Pressable>
  );
}
