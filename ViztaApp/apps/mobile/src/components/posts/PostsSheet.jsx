import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  ChevronLeft,
  Folder,
  HelpCircle,
  ListFilter,
  FolderInput,
  FolderMinus,
  FolderPlus,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
  FlaskConical,
} from 'lucide-react-native';
import { INK, MOTION, RADIUS } from '../theme';
import { PAPEL } from '../codex/Papel';
import { MONO } from '../codex/mono';
import { Nombrador, Opcion, TENUE, etiquetaConteo } from '../codex/piezasCarpeta';
import PostDetailSheet from './PostDetailSheet';
import { avisoDeBorrado, fichasHijas, limpiarLienzos } from './borrarPost';
import { registrarAvisos } from '../../utils/notificaciones';
import CasosDeMuestra from './CasosDeMuestra';
import agregarPost, { enlaceDePost, reintentarPost, seCorto } from './agregarPost';
import usePostsEnCurso from './usePostsEnCurso';
import AnalizandoImagen, { TextoAnalizando } from './AnalizandoImagen';
import { MarcaCarrusel } from './CarruselPost';
import PanelAutofiltro from './PanelAutofiltro';
import { cumple, facetasDe } from './autofiltro';
import Pista from '../Pista';
import { usePistasStore, PISTA } from '../../state/pistasStore';
import * as Clipboard from 'expo-clipboard';
import MorphingInfinity from '../MorphingInfinity';
import { supabase } from '../../utils/supabase';
import { ponerFila, useEnVivo, useFilasEnVivo } from '../../utils/enVivo';
import {
  POST,
  crearCarpeta,
  eliminarCarpeta,
  listarCarpetas,
  moverItem,
  renombrarCarpeta,
} from '../../utils/carpetas';
import { roce, toque, agarre, falla } from '../../utils/haptics';
import { EV, evento } from '../../utils/analitica';

const MENU_ANCHO = 190;
const CAMPOS_POST = 'id, name, tipo, description, tags, thumbnail_url, details, aliases, created_at, folder_id';

/**
 * Posts — la página que aparece al empujar el orbe hacia arriba.
 *
 * Existía ya una vista de posts dentro de `codex.jsx`, pero está escrita sobre
 * fondo oscuro y arrastra medio archivo consigo. Así que esta es una vista nueva
 * y corta: la galería, en papel. Lo que un post tiene para mostrar de un vistazo
 * es su miniatura, quién lo publicó y su primera línea; todo lo demás vive en su
 * ficha, que se abre al tocarlo.
 *
 * Sobre el tema claro: las miniaturas de Instagram son imágenes ajenas, casi
 * siempre oscuras y saturadas. Sobre papel eso se ve como manchas, así que cada
 * una va con una esquina redondeada y un borde de un pelo — suficiente para que
 * la imagen termine en algún lado en vez de sangrar contra el fondo.
 *
 * **La biblioteca** son las carpetas, y no se ven como los posts a propósito:
 * una carpeta en forma de tarjeta grande compite con el contenido y encima
 * miente, porque no tiene una imagen propia que mostrar. Van como renglones
 * finos arriba de la galería — un estante sobre la pila.
 *
 * **El buscador está plegado** detrás de la lupa. Una galería se mira, no se
 * consulta: el caso normal es entrar y recorrer, y un campo de texto siempre
 * abierto ocupa una línea permanente para algo que se usa de vez en cuando.
 */
export default function PostsSheet({ onClose, abrirId = null, topInset = 0, bottomInset = 0 }) {
  const { width: W, height: H } = useWindowDimensions();

  const [posts, setPosts] = useState(null); // null = cargando
  const [recarga, setRecarga] = useState(0); // se sube para volver a pedir todo
  const [carpetas, setCarpetas] = useState([]);
  const [error, setError] = useState(null);

  const [buscando, setBuscando] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  // Autofiltro: grupos que salen de los análisis. `seleccion` guarda un valor
  // por grupo —{ pais: 'guatemala', tema: 'elecciones' }— y los grupos suman.
  const [filtrando, setFiltrando] = useState(false);
  const [seleccion, setSeleccion] = useState({});
  const activos = Object.values(seleccion).filter(Boolean).length;
  const [abierta, setAbierta] = useState(null); // carpeta abierta
  const [abierto, setAbierto] = useState(null); // post abierto
  const [muestras, setMuestras] = useState(false); // galería de casos (solo en desarrollo)

  const [agregando, setAgregando] = useState(false); // caja de enlace abierta
  const [enlace, setEnlace] = useState('');
  const [trayendo, setTrayendo] = useState(false);
  const [ayuda, setAyuda] = useState(false); // el «?» de qué enlaces entran

  /**
   * Los posts que el servidor todavía está trayendo se completan solos.
   *
   * La fila se reemplaza entera con lo que llegó: `update` sobre la fila trae
   * todas las columnas, así que quedarse solo con `details` dejaría el nombre y
   * la miniatura con los valores del marcador de posición.
   */
  // Si hay alguno trayéndose ahora. Alimenta la pista de una sola vez.
  const hayEnCurso = (posts || []).some((p) => p?.details?.carga === 'procesando');

  const marcarPista = usePistasStore((s) => s.marcar);

  // Mientras haya algo trayéndose, la hora se refresca: es lo que deja notar
  // que uno se quedó colgado y ofrecer traerlo de nuevo.
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    if (!hayEnCurso) return undefined;
    const reloj = setInterval(() => setAhora(Date.now()), 20000);
    return () => clearInterval(reloj);
  }, [hayEnCurso]);

  /** Volver a traer uno que falló o se cortó, en la misma tarjeta. */
  const reintentar = async (p) => {
    roce();
    try {
      const details = await reintentarPost(p);
      setAhora(Date.now());
      setPosts((prev) => (prev || []).map((x) => (x.id === p.id ? { ...x, details } : x)));
      registrarAvisos();
    } catch (e) {
      falla();
      const details = { ...(p.details || {}), carga: 'error', carga_error: e.message || 'No se pudo volver a traer' };
      setPosts((prev) => (prev || []).map((x) => (x.id === p.id ? { ...x, details } : x)));
    }
  };

  // Se llegó tocando un aviso: se abre ese post apenas está en la lista.
  const abiertoPorAviso = useRef(null);
  useEffect(() => {
    if (!abrirId || !posts || abiertoPorAviso.current === abrirId) return;
    const post = posts.find((x) => x.id === abrirId);
    if (post) {
      abiertoPorAviso.current = abrirId;
      setAbierto(post);
    }
  }, [abrirId, posts]);

  usePostsEnCurso(posts, (fila) => {
    setPosts((prev) => (prev || []).map((p) => (p.id === fila.id ? { ...p, ...fila } : p)));
    // Y el detalle, si es ese el que está abierto.
    //
    // `abierto` guarda su propia copia del post, no una referencia a la fila de
    // la lista. Sin esta línea, abrir una tarjeta mientras todavía se estaba
    // trayendo dejaba el detalle congelado en el marcador —sin descripción, sin
    // transcripción, sin imágenes— aunque la grilla detrás ya se hubiera
    // completado. Había que cerrar y volver a abrir para ver el post.
    setAbierto((a) => (a && a.id === fila.id ? { ...a, ...fila } : a));
    // Se completó uno: ya vio que el trabajo termina solo.
    if (fila?.details?.carga !== 'procesando') marcarPista(PISTA.POST_EN_CURSO);
  });
  const [errorAlta, setErrorAlta] = useState(null);
  // Si al abrir la caja hay que enfocar el campo. Ver `abrirAlta`.
  const [enfocarEnlace, setEnfocarEnlace] = useState(true);

  const [menu, setMenu] = useState(null); // { clase, item, x, y, vista }
  const [nombrando, setNombrando] = useState(null); // { modo, carpeta?, post? }

  /**
   * Abrir la caja del enlace, ya con el enlace puesto.
   *
   * Agregar un post siempre empieza igual: se copia el enlace en Instagram o en
   * X y se vuelve a Vizta. Cuando se llega acá el enlace ya está en el
   * portapapeles, así que pedir que lo peguen a mano es pedir dos toques —
   * mantener presionado, «Pegar»— para poner algo que la app ya podía saber.
   *
   * Solo se pega si es de una plataforma conocida; `enlaceDePost` explica por
   * qué. Si no lo es, la caja se abre como antes, vacía y con el teclado
   * arriba, porque ahí sí hay algo que escribir.
   *
   * Y por eso el foco es condicional: con el enlace ya puesto lo único que
   * queda es tocar «traer», y abrir el teclado para nada sería taparle media
   * pantalla a quien no va a escribir.
   *
   * El portapapeles se lee antes de abrir la caja, no después: `autoFocus` se
   * evalúa cuando el campo se monta, así que decidirlo más tarde no llegaría a
   * tiempo. La lectura es local y tarda milésimas.
   */
  const abrirAlta = async () => {
    roce();
    setErrorAlta(null);
    if (agregando) {
      setAgregando(false);
      return;
    }

    let url = null;
    try {
      url = enlaceDePost(await Clipboard.getStringAsync());
    } catch {
      // Sin portapapeles —o negado— la caja se abre igual, a mano.
    }

    if (url) setEnlace(url);
    setEnfocarEnlace(!url);
    setAgregando(true);
  };

  const traer = async () => {
    if (trayendo || !enlace.trim()) return;
    setTrayendo(true);
    setErrorAlta(null);
    try {
      // Vuelve a medio llenar, con `details.carga === 'procesando'`. Se pinta
      // ya mismo y `usePostsEnCurso` la ve completarse.
      const nuevo = await agregarPost(enlace);
      // Traerlo tarda: es el momento de ofrecer el aviso de cuando esté.
      registrarAvisos();
      // La plataforma sale del propio enlace; el enlace no se manda.
      evento(EV.POST_AGREGADO, {
        plataforma: /x\.com|twitter\.com/.test(enlace) ? 'x' : 'instagram',
        es_reel: enlace.includes('/reel/'),
      });

      // Si se agregó estando dentro de una carpeta, va adentro. Traer un post
      // parado en una carpeta y que aparezca en cualquier otro lado se lee como
      // que no se guardó.
      let fila = nuevo;
      if (abierta) {
        await moverItem(nuevo.id, abierta.id);
        fila = { ...nuevo, folder_id: abierta.id };
      }

      toque();
      setPosts((prev) => [fila, ...(prev || [])]);
      setEnlace('');
      setAgregando(false);
    } catch (e) {
      falla();
      // Al panel va la categoría y el status, nunca el texto del servicio: ese
      // puede traer detalles de infraestructura, y ya no se muestra ni en
      // pantalla, así que menos todavía tiene por qué salir de la app.
      evento(EV.POST_AGREGADO_FALLO, { categoria: e.categoria || 'desconocido', status: e.status || 0 });
      setErrorAlta(e.message || 'No se pudo agregar');
    } finally {
      setTrayendo(false);
    }
  };

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const [{ data, error: e }, cs] = await Promise.all([
          supabase
            .from('codex_universe_items')
            .select(CAMPOS_POST)
            .eq('tipo', 'post')
            .order('created_at', { ascending: false })
            .limit(200),
          listarCarpetas(POST),
        ]);
        if (e) throw e;
        if (!vivo) return;
        setPosts(data || []);
        setCarpetas(cs);
      } catch (e) {
        if (vivo) {
          setError(e.message || 'No se pudieron cargar');
          setPosts([]);
        }
      }
    })();
    return () => {
      vivo = false;
    };
  }, [recarga]);

  // Un post que llega desde «Compartir» o desde otro teléfono, uno que se
  // borra o cambia de carpeta: aparece acá sin volver a abrir.
  useFilasEnVivo(
    'codex_universe_items',
    CAMPOS_POST,
    ({ id, fila }) => {
      setPosts((prev) => (prev ? ponerFila(prev, id, fila, (f) => f.tipo === 'post') : prev));
      if (fila) setAbierto((a) => (a?.id === id ? { ...a, ...fila } : a));
    },
    () => setRecarga((n) => n + 1)
  );
  useEnVivo(['post_folders'], () => {
    listarCarpetas(POST).then(setCarpetas).catch(() => {});
  });

  const conteo = useMemo(() => {
    const m = new Map();
    for (const p of posts || []) {
      if (p.folder_id) m.set(p.folder_id, (m.get(p.folder_id) || 0) + 1);
    }
    return m;
  }, [posts]);

  /**
   * Sobre qué posts se arman los grupos del autofiltro.
   *
   * Dentro de una carpeta, sus posts. En la raíz, **la biblioteca entera**, no
   * solo los sueltos: casi todo lo analizado vive dentro de carpetas, y filtrar
   * por país en la raíz mirando solo lo suelto dejaba afuera justo lo que se
   * había ordenado. La grilla sin filtro sigue mostrando solo lo suelto.
   */
  const alcance = useMemo(
    () => (!posts ? [] : abierta ? posts.filter((p) => p.folder_id === abierta.id) : posts),
    [posts, abierta]
  );
  const facetas = useMemo(() => facetasDe(alcance), [alcance]);

  // Cada carpeta tiene sus propios grupos: un filtro elegido afuera no significa
  // nada adentro, y dejarlo puesto escondería posts sin razón visible.
  useEffect(() => {
    setSeleccion({});
  }, [abierta?.id]);

  /**
   * Lo que se ve en la grilla: dentro de una carpeta, sus posts; afuera, los
   * que no están en ninguna. Guardar un post en una carpeta lo saca de la
   * galería suelta — si no, archivar no ordenaría nada y las carpetas serían
   * decoración.
   */
  const filtrados = useMemo(() => {
    if (!posts) return [];
    const base = activos
      ? alcance.filter((p) => cumple(p, seleccion))
      : abierta
        ? alcance
        : posts.filter((p) => !p.folder_id);

    const q = busqueda.trim().toLowerCase();
    if (!q) return base;
    return base.filter((p) => {
      const campos = [p.name, p.description, p.details?.author, ...(p.tags || [])];
      return campos.some((c) => String(c || '').toLowerCase().includes(q));
    });
  }, [posts, busqueda, abierta, alcance, seleccion, activos]);

  // ─── Acciones de carpeta ────────────────────────────────────────────────────

  const abrirMenu = (clase, item, ev) => {
    agarre();
    const { pageX = 0, pageY = 0 } = ev?.nativeEvent || {};
    setMenu({
      clase,
      item,
      vista: 'acciones',
      x: Math.min(Math.max(pageX - MENU_ANCHO / 2, 14), W - MENU_ANCHO - 14),
      y: Math.min(pageY + 8, H - 300),
    });
  };

  const mover = async (post, carpetaId) => {
    setMenu(null);
    const antes = posts;
    setPosts((ps) => (ps || []).map((x) => (x.id === post.id ? { ...x, folder_id: carpetaId } : x)));

    try {
      await moverItem(post.id, carpetaId);
      toque();
    } catch {
      falla();
      setPosts(antes);
      setError('No se pudo mover el post.');
    }
  };

  const borrarCarpeta = (carpeta) => {
    setMenu(null);
    const cuantos = conteo.get(carpeta.id) || 0;

    Alert.alert(
      `Eliminar "${carpeta.name}"`,
      cuantos > 0
        ? `Los ${cuantos} posts que tiene adentro vuelven a la galería. No se borra ninguno.`
        : 'La carpeta está vacía.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const antesC = carpetas;
            const antesP = posts;
            setCarpetas((c) => c.filter((x) => x.id !== carpeta.id));
            // La foreign key es ON DELETE SET NULL: en la base los posts quedan
            // sueltos solos. Acá se espeja para no tener que recargar.
            setPosts((ps) => (ps || []).map((x) => (x.folder_id === carpeta.id ? { ...x, folder_id: null } : x)));
            if (abierta?.id === carpeta.id) setAbierta(null);

            try {
              await eliminarCarpeta(carpeta.id);
              toque();
            } catch {
              falla();
              setCarpetas(antesC);
              setPosts(antesP);
              setError('No se pudo eliminar la carpeta.');
            }
          },
        },
      ]
    );
  };

  /**
   * Borrar un post, con confirmación. Lo que cuelga de él —vínculos con
   * fichas, menciones, fuentes— se va con él en la base (ON DELETE CASCADE),
   * y el video y las fotos son enlaces de la red social, no archivos nuestros.
   * Lo único que la base no limpia son los lienzos, que guardan ids dentro de
   * un JSON: eso lo hace `limpiarLienzos`.
   */
  const borrarPost = async (post) => {
    setMenu(null);
    // Las fichas hijas se cuentan antes de preguntar: se van con el post, y
    // eso se dice en la confirmación, no después.
    const hijas = await fichasHijas(post.id);
    Alert.alert('Eliminar post', avisoDeBorrado(hijas.length), [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          const antes = posts;
          setPosts((ps) => (ps || []).filter((x) => x.id !== post.id));
          if (abierto?.id === post.id) setAbierto(null);
          try {
            // Con `select` se sabe si de verdad se borró: si la base no lo
            // deja, `delete` no da error, solo no borra nada.
            const { data, error } = await supabase
              .from('codex_universe_items')
              .delete()
              .eq('id', post.id)
              .select('id');
            if (error || !data?.length) throw error || new Error('sin filas');
            toque();
            // Lo que quedaba apuntando al post o a sus fichas en los lienzos.
            limpiarLienzos([post.id, ...hijas]);
          } catch {
            falla();
            setPosts(antes);
            setError('No se pudo eliminar el post.');
          }
        },
      },
    ]);
  };

  const confirmarNombre = async (texto) => {
    const destino = nombrando;
    setNombrando(null);
    Keyboard.dismiss();

    try {
      if (destino.modo === 'renombrar') {
        const r = await renombrarCarpeta(destino.carpeta.id, texto);
        setCarpetas((c) => c.map((x) => (x.id === r.id ? { ...x, name: r.name } : x)));
        if (abierta?.id === r.id) setAbierta((a) => ({ ...a, name: r.name }));
      } else {
        const nueva = await crearCarpeta(texto, carpetas, POST);
        setCarpetas((c) => [...c, nueva]);
        if (destino.post) await mover(destino.post, nueva.id);
      }
      toque();
    } catch (e) {
      falla();
      setError(e.message === 'sin permiso' ? 'No tenés permiso para eso.' : 'No se pudo guardar la carpeta.');
    }
  };

  const alternarBusqueda = () => {
    roce();
    setBuscando((b) => {
      // Al plegarse se limpia: una galería filtrada sin el campo a la vista deja
      // posts escondidos sin nada que explique por qué faltan.
      if (b) {
        setBusqueda('');
        Keyboard.dismiss();
      }
      return !b;
    });
    setAgregando(false);
  };

  const alternarFiltro = () => {
    roce();
    setFiltrando((f) => {
      // Igual que la búsqueda: plegar el panel suelta el filtro, porque una
      // grilla filtrada sin el panel a la vista esconde posts sin explicar por qué.
      if (f) setSeleccion({});
      return !f;
    });
    setAgregando(false);
  };

  // Dos columnas. El ancho se calcula acá y no con flex para que la miniatura
  // pueda tener una relación de aspecto exacta: los reels son 9:16 y cualquier
  // redondeo distinto por columna se nota como un escalón entre las dos.
  const COL = (W - 30 * 2 - 12) / 2;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: PAPEL }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingTop: topInset + 12,
            paddingHorizontal: 18,
            paddingBottom: 4,
          }}
        >
          <Pressable onPress={onClose} hitSlop={12} style={{ padding: 6 }}>
            <X size={19} color={INK.faint} />
          </Pressable>

          <View style={{ flex: 1 }} />

          {posts?.length ? (
            <Text style={{ fontFamily: MONO, fontSize: 11.5, color: TENUE, paddingRight: 4 }}>
              {filtrados.length}
            </Text>
          ) : null}

          {/* El filtro solo aparece si hay algo por qué filtrar: sin posts
              analizados, o sin nada que se repita, sería un botón que abre un
              panel vacío. */}
          {facetas.length || filtrando ? (
            <Pressable
              onPress={alternarFiltro}
              hitSlop={12}
              style={{ padding: 6 }}
              accessibilityRole="button"
              accessibilityState={{ expanded: filtrando }}
              accessibilityLabel={filtrando ? 'Cerrar el filtro' : 'Filtrar por lo que hablan los posts'}
            >
              <ListFilter size={18} color={filtrando ? INK.title : INK.faint} />
            </Pressable>
          ) : null}

          <Pressable
            onPress={alternarBusqueda}
            hitSlop={12}
            style={{ padding: 6 }}
            accessibilityRole="button"
            accessibilityState={{ expanded: buscando }}
            accessibilityLabel={buscando ? 'Cerrar la búsqueda' : 'Buscar'}
          >
            <Search size={18} color={buscando ? INK.title : INK.faint} />
          </Pressable>

          {/* Casos de muestra del análisis: solo en desarrollo. */}
          {__DEV__ ? (
            <Pressable
              onPress={() => setMuestras(true)}
              hitSlop={12}
              style={{ padding: 6, marginRight: 4 }}
              accessibilityRole="button"
              accessibilityLabel="Casos de muestra"
            >
              <FlaskConical size={17} color={INK.faint} />
            </Pressable>
          ) : null}

          <Pressable
            onPress={abrirAlta}
            hitSlop={12}
            style={{ padding: 6 }}
            accessibilityRole="button"
            accessibilityLabel="Agregar un post"
          >
            <Plus size={19} color={INK.title} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 30, paddingTop: 20, paddingBottom: bottomInset + 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          scrollEnabled={!menu && !nombrando}
        >
          {abierta ? (
            <Pressable
              onPress={() => {
                roce();
                setAbierta(null);
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                marginBottom: 18,
                opacity: pressed ? 0.5 : 1,
              })}
              accessibilityRole="button"
              accessibilityLabel={`Volver a la galería desde ${abierta.name}`}
            >
              <ChevronLeft size={15} color="rgba(28,43,34,0.4)" />
              <Cuadro color={abierta.color} tamano={22} />
              <Text numberOfLines={1} style={{ fontFamily: MONO, fontSize: 11.5, color: INK.title, flex: 1 }}>
                {abierta.name}
              </Text>
              <Text style={{ fontFamily: MONO, fontSize: 11, color: 'rgba(28,43,34,0.26)' }}>
                {etiquetaConteo(conteo.get(abierta.id) || 0, 'post', 'posts')}
              </Text>
            </Pressable>
          ) : (
            <Text style={{ fontFamily: MONO, fontSize: 11.5, color: TENUE, marginBottom: 18 }}>posts</Text>
          )}

          {agregando ? (
            <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(140)} style={{ marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TextInput
                  value={enlace}
                  onChangeText={setEnlace}
                  placeholder="pegá el enlace del post o del reel"
                  placeholderTextColor="rgba(28,43,34,0.22)"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  autoFocus={enfocarEnlace}
                  onSubmitEditing={traer}
                  returnKeyType="go"
                  style={{ flex: 1, fontFamily: MONO, fontSize: 13, color: INK.title, padding: 0 }}
                />
                {trayendo ? (
                  <MorphingInfinity size={16} color={INK.title} />
                ) : enlace.trim() ? (
                  <Pressable onPress={traer} hitSlop={10}>
                    <Text style={{ fontFamily: MONO, fontSize: 13, color: INK.title }}>traer</Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={{ height: 1, marginTop: 9, backgroundColor: 'rgba(28,43,34,0.14)' }} />

              {/* Traer un reel puede tardar: baja el video y lo transcribe. Sin
                  decirlo, la espera se lee como que se colgó. */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 9 }}>
                <Text style={{ fontFamily: MONO, fontSize: 11, color: TENUE, lineHeight: 17, flexShrink: 1 }}>
                  {errorAlta ||
                    (trayendo
                      ? 'bajando y transcribiendo… puede tardar'
                      : abierta
                        ? `se guarda en ${abierta.name}`
                        : 'instagram, reels y X')}
                </Text>

                {/* Qué entra y qué no.
                
                    «instagram, reels y X» alcanza para saber por dónde empezar,
                    pero no dice que de X van los posts y no los videos, ni que
                    un reel de baile se va a transcribir igual que uno con datos
                    y va a costar lo mismo sin servir para nada. Eso es
                    demasiado para un renglón bajo un campo, y esconderlo del
                    todo hace que se aprenda pegando enlaces que fallan.
                
                    Un signo de interrogación es el término medio: no ocupa
                    lugar y está donde surge la duda. */}
                {!errorAlta && !trayendo ? (
                  <Pressable
                    onPress={() => {
                      roce();
                      setAyuda((a) => !a);
                    }}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="Qué enlaces se pueden traer"
                    style={({ pressed }) => ({ opacity: pressed ? 0.4 : 1, marginTop: -1 })}
                  >
                    <HelpCircle size={13} color={ayuda ? INK.title : TENUE} />
                  </Pressable>
                ) : null}
              </View>

              {ayuda ? (
                <Animated.View
                  entering={FadeIn.duration(200)}
                  exiting={FadeOut.duration(140)}
                  style={{
                    marginTop: 13,
                    paddingLeft: 12,
                    borderLeftWidth: 2,
                    borderLeftColor: 'rgba(28,43,34,0.12)',
                  }}
                >
                  <Linea titulo="instagram">reels y carruseles</Linea>
                  <Linea titulo="X">solo posts</Linea>
                  <Linea titulo="para qué">
                    información — notas, análisis, declaraciones. No está pensada para
                    entretenimiento.
                  </Linea>
                </Animated.View>
              ) : null}
            </Animated.View>
          ) : null}

          {buscando ? (
            <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={{ marginBottom: 4 }}>
              <Buscador value={busqueda} onChangeText={setBusqueda} onCerrar={alternarBusqueda} />
            </Animated.View>
          ) : null}

          {filtrando ? (
            <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} style={{ marginBottom: 6 }}>
              <PanelAutofiltro
                facetas={facetas}
                seleccion={seleccion}
                onElegir={(faceta, clave) =>
                  setSeleccion((s) => {
                    const siguiente = { ...s };
                    if (clave) siguiente[faceta] = clave;
                    else delete siguiente[faceta];
                    return siguiente;
                  })
                }
              />
            </Animated.View>
          ) : null}

          {/* La biblioteca solo existe en la raíz: dentro de una carpeta no hay
              carpetas, y repetir el estante adentro del estante confunde. Con un
              filtro puesto tampoco: lo filtrado ya incluye lo que está dentro
              de las carpetas, y el estante encima haría creer que no. */}
          {!abierta && !activos ? (
            <Biblioteca
              carpetas={carpetas}
              conteo={conteo}
              menu={menu}
              onAbrir={(c) => {
                roce();
                setBusqueda('');
                setAbierta(c);
              }}
              onMenu={(c, ev) => abrirMenu('carpeta', c, ev)}
              onNueva={() => {
                roce();
                setNombrando({ modo: 'crear' });
              }}
            />
          ) : null}

          {/* Que el trabajo sobrevive a cerrar la app. **Una vez.**
          
              Estaba dentro de cada tarjeta en curso: con tres trayéndose a la
              vez, el mismo aviso aparecía tres veces, y seguía apareciendo el
              post número cuarenta. Acá arriba se dice una sola vez, y se apaga
              en cuanto uno se completa — ahí ya se vio que funciona. */}
          {hayEnCurso ? (
            <Pista clave={PISTA.POST_EN_CURSO} style={{ marginTop: 14 }}>
              Puedes cerrar la app: seguiremos trayendo el post
            </Pista>
          ) : null}

          {posts === null ? (
            <ActivityIndicator size="small" color={INK.faint} style={{ marginTop: 40 }} />
          ) : filtrados.length === 0 ? (
            <Text style={{ fontFamily: MONO, fontSize: 12.5, color: TENUE, lineHeight: 20, marginTop: 24 }}>
              {error || vacio(abierta, busqueda, activos)}
            </Text>
          ) : (
            <Animated.View
              layout={LinearTransition.springify().damping(22)}
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 22 }}
            >
              {filtrados.map((p, i) => (
                <Tarjeta
                  key={p.id}
                  post={p}
                  ancho={COL}
                  indice={i}
                  ahora={ahora}
                  onReintentar={() => reintentar(p)}
                  atenuada={!!menu && menu.item.id !== p.id}
                  onPress={() => {
                    roce();
                    evento(EV.POST_ABIERTO, { ya_analizado: !!p.details?.analysis });
                    setAbierto(p);
                  }}
                  onLongPress={(ev) => abrirMenu('post', p, ev)}
                />
              ))}
            </Animated.View>
          )}
        </ScrollView>

        {menu ? (
          <>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenu(null)} />

            <Animated.View
              entering={FadeIn.duration(130)}
              exiting={FadeOut.duration(100)}
              style={{
                position: 'absolute',
                left: menu.x,
                top: menu.y,
                width: MENU_ANCHO,
                maxHeight: 268,
                borderRadius: RADIUS.md,
                backgroundColor: PAPEL,
                borderWidth: 1,
                borderColor: 'rgba(28,43,34,0.10)',
                shadowColor: '#1E3326',
                shadowOpacity: 0.16,
                shadowRadius: 20,
                shadowOffset: { width: 0, height: 8 },
                elevation: 10,
                overflow: 'hidden',
              }}
            >
              {menu.vista === 'mover' ? (
                <ScrollView keyboardShouldPersistTaps="handled">
                  <Opcion
                    icono={<FolderPlus size={15} color={INK.title} />}
                    texto="carpeta nueva"
                    onPress={() => {
                      const post = menu.item;
                      setMenu(null);
                      setNombrando({ modo: 'crear', post });
                    }}
                  />
                  {carpetas
                    .filter((c) => c.id !== menu.item.folder_id)
                    .map((c) => (
                      <Opcion key={c.id} lomo={c.color} texto={c.name} onPress={() => mover(menu.item, c.id)} />
                    ))}
                </ScrollView>
              ) : menu.clase === 'carpeta' ? (
                <>
                  <Opcion
                    icono={<Pencil size={15} color={INK.title} />}
                    texto="renombrar"
                    onPress={() => {
                      const carpeta = menu.item;
                      setMenu(null);
                      setNombrando({ modo: 'renombrar', carpeta });
                    }}
                  />
                  <Opcion
                    icono={<Trash2 size={15} color="#B91C1C" />}
                    texto="eliminar carpeta"
                    peligro
                    onPress={() => borrarCarpeta(menu.item)}
                  />
                </>
              ) : (
                <>
                  <Opcion
                    icono={<FolderInput size={15} color={INK.title} />}
                    texto="mover a…"
                    onPress={() => setMenu((m) => ({ ...m, vista: 'mover' }))}
                  />
                  {menu.item.folder_id ? (
                    <Opcion
                      icono={<FolderMinus size={15} color={INK.title} />}
                      texto="sacar de la carpeta"
                      onPress={() => mover(menu.item, null)}
                    />
                  ) : null}
                  <Opcion
                    icono={<Trash2 size={15} color="#B91C1C" />}
                    texto="eliminar post"
                    peligro
                    onPress={() => borrarPost(menu.item)}
                  />
                </>
              )}
            </Animated.View>
          </>
        ) : null}

        {nombrando ? (
          <Nombrador
            modo={nombrando.modo}
            inicial={nombrando.carpeta?.name || ''}
            topInset={topInset}
            onCancel={() => {
              Keyboard.dismiss();
              setNombrando(null);
            }}
            onConfirm={confirmarNombre}
          />
        ) : null}
      </View>

      {muestras ? (
        <CasosDeMuestra onClose={() => setMuestras(false)} topInset={topInset} bottomInset={bottomInset} />
      ) : null}

      {abierto ? (
        <PostDetailSheet
          post={abierto}
          onClose={() => setAbierto(null)}
          onActualizado={(p) => {
            // El análisis recién hecho tiene que quedar en la lista: si no, al
            // reabrir el post el ojo volvería a ofrecer extraer lo ya extraído.
            setAbierto(p);
            setPosts((prev) => (prev || []).map((x) => (x.id === p.id ? p : x)));
          }}
          topInset={topInset}
          bottomInset={bottomInset}
        />
      ) : null}
    </Modal>
  );
}

// ─── Biblioteca ───────────────────────────────────────────────────────────────

/**
 * El estante de carpetas, arriba de la galería.
 *
 * Deliberadamente **no** tiene la forma de un post: son renglones finos con un
 * cuadrito de color. Una carpeta con el tamaño de una miniatura competiría con
 * el contenido y además prometería una imagen que no tiene.
 *
 * La cabecera se dibuja aunque no haya ninguna carpeta. Es el único lugar donde
 * se puede crear la primera: el `+` de arriba ya significa «agregar un post», y
 * dos signos de más en la misma pantalla queriendo decir cosas distintas es
 * exactamente lo que hace que nadie toque ninguno.
 */
function Biblioteca({ carpetas, conteo, menu, onAbrir, onMenu, onNueva }) {
  return (
    <View style={{ marginTop: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <Text style={{ fontFamily: MONO, fontSize: 11.5, color: TENUE, flex: 1 }}>biblioteca</Text>
        <Pressable
          onPress={onNueva}
          hitSlop={12}
          style={({ pressed }) => ({ opacity: pressed ? 0.4 : 1 })}
          accessibilityRole="button"
          accessibilityLabel="Carpeta nueva"
        >
          <FolderPlus size={16} color={TENUE} />
        </Pressable>
      </View>

      {carpetas.length === 0 ? (
        <Text style={{ fontFamily: MONO, fontSize: 11.5, color: 'rgba(28,43,34,0.24)', lineHeight: 18 }}>
          sin carpetas todavía.
        </Text>
      ) : (
        carpetas.map((c) => (
          <Animated.View key={c.id} entering={FadeIn.duration(220)} exiting={FadeOut.duration(160)} layout={LinearTransition.springify().damping(22)}>
            <Pressable
              onPress={() => onAbrir(c)}
              onLongPress={(ev) => onMenu(c, ev)}
              delayLongPress={380}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 10,
                opacity: menu && menu.item.id !== c.id ? 0.35 : pressed ? 0.55 : 1,
              })}
              accessibilityRole="button"
              accessibilityLabel={`Carpeta ${c.name}, ${etiquetaConteo(conteo.get(c.id) || 0, 'post', 'posts')}`}
              accessibilityHint="Mantené presionado para más acciones"
            >
              <Cuadro color={c.color} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontFamily: MONO, fontSize: 13, color: INK.title }}>
                  {c.name}
                </Text>
                <Text style={{ fontFamily: MONO, fontSize: 11, color: 'rgba(28,43,34,0.26)', marginTop: 3 }}>
                  {etiquetaConteo(conteo.get(c.id) || 0, 'post', 'posts')}
                </Text>
              </View>
              <Text style={{ fontFamily: MONO, fontSize: 13, color: 'rgba(28,43,34,0.22)' }}>›</Text>
            </Pressable>
            <View style={{ height: 1, backgroundColor: 'rgba(28,43,34,0.07)' }} />
          </Animated.View>
        ))
      )}
    </View>
  );
}

/** El cuadrito de la carpeta: su color al 12% con el icono encima, en el color. */
function Cuadro({ color, tamano = 36 }) {
  return (
    <View
      style={{
        width: tamano,
        height: tamano,
        borderRadius: tamano * 0.28,
        backgroundColor: `${color}1F`,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Folder size={tamano * 0.44} color={color} strokeWidth={1.8} />
    </View>
  );
}

// ─── Buscador ─────────────────────────────────────────────────────────────────

function Buscador({ value, onChangeText, onCerrar }) {
  const foco = useSharedValue(0);

  const linea = useAnimatedStyle(() => ({
    backgroundColor: `rgba(28,43,34,${0.07 + foco.value * 0.13})`,
  }));

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 8 }}>
        <Search size={14} color="rgba(28,43,34,0.28)" />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="buscar"
          placeholderTextColor="rgba(28,43,34,0.22)"
          autoCapitalize="none"
          autoFocus
          returnKeyType="search"
          style={{ flex: 1, fontFamily: MONO, fontSize: 13, color: INK.title, padding: 0 }}
          onFocus={() => {
            foco.value = withTiming(1, { duration: 160 });
          }}
          onBlur={() => {
            foco.value = withSpring(0, MOTION.tap);
          }}
        />
        <Pressable onPress={onCerrar} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cerrar la búsqueda">
          <X size={14} color="rgba(28,43,34,0.35)" />
        </Pressable>
      </View>
      <Animated.View style={[{ height: 1, borderRadius: RADIUS.sm }, linea]} />
    </View>
  );
}

// ─── Tarjeta ──────────────────────────────────────────────────────────────────

/**
 * Un post.
 *
 * La miniatura manda: es lo que hace reconocible un reel. Debajo, quién lo
 * publicó y la primera línea del texto — no el `name`, que viene armado como
 * «@autor — caption» y repetiría el autor que ya está arriba.
 *
 * No lleva insignia de play. La tenía, y era una promesa falsa: la tarjeta abre
 * la ficha del post, no reproduce nada. Un triángulo de play es el símbolo más
 * literal que existe para «esto se reproduce acá», y ponerlo donde no se
 * reproduce nada gasta la confianza en todos los demás iconos de la pantalla.
 */
function Tarjeta({ post, ancho, indice, atenuada, ahora, onPress, onLongPress, onReintentar }) {
  const [rota, setRota] = useState(false);
  const press = useSharedValue(0);

  // El servidor todavía lo está trayendo, o no pudo.
  const carga = post.details?.carga;
  // Lleva demasiado «trayéndose»: ya nadie lo está trayendo.
  const cortado = seCorto(post, ahora);
  const trayendo = carga === 'procesando' && !cortado;
  const fallado = carga === 'error' || cortado;
  const analizando = !trayendo && post.details?.analysis_estado === 'procesando';

  const uri = post.thumbnail_url || post.details?.thumbnail_url || post.details?.images?.[0];

  // Cuántas imágenes trae. Se deduplica igual que en la hoja: la portada suele
  // ser la primera del carrusel y contarla aparte daría un número de más.
  const cuantasImagenes = new Set([uri, ...(post.details?.images || [])].filter(Boolean)).size;
  const autor = post.details?.author || (post.name || '').match(/^@([^—]+)/)?.[1]?.trim();

  // El caption sin el «@autor — » que el nombre trae adelante.
  const texto = (post.description || post.name || '').replace(/^@[^—]+—\s*/, '').trim();

  const animado = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.03 }],
  }));

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={380}
      onPressIn={() => {
        press.value = withTiming(1, MOTION.press);
      }}
      onPressOut={() => {
        press.value = withSpring(0, MOTION.tap);
      }}
      accessibilityRole="button"
      accessibilityLabel={autor ? `Post de ${autor}` : 'Post'}
      accessibilityHint="Mantené presionado para moverlo a una carpeta"
    >
      <Animated.View
        entering={FadeIn.duration(240).delay(Math.min(indice, 10) * 24)}
        style={[{ width: ancho, opacity: atenuada ? 0.35 : 1 }, animado]}
      >
        <View
          style={{
            width: ancho,
            height: ancho * 1.35,
            borderRadius: RADIUS.md,
            overflow: 'hidden',
            backgroundColor: 'rgba(28,43,34,0.06)',
            borderWidth: 1,
            borderColor: 'rgba(28,43,34,0.08)',
          }}
        >
          {trayendo ? (
            /* Trayéndolo.
            
               La tarjeta aparece apenas se pega el enlace, con el escaneo en
               lugar de la miniatura. Antes no había tarjeta hasta que todo
               terminaba —y un reel tarda cerca de un minuto entre bajar el
               audio y transcribirlo—, así que pegar el enlace no daba señal de
               nada y la salida obvia era volver a pegarlo.
            
               La línea de abajo dice que **sigue aunque cierres la app**. No es
               adorno: sin eso, una espera larga se lee como un cuelgue, y matar
               la app era justo lo que antes rompía el trabajo. Ahora no, y
               decirlo es lo que vuelve útil el cambio. */
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }}>
              <AnalizandoImagen size={26} color="rgba(28,43,34,0.45)" />
              <View style={{ marginTop: 11 }}>
                <TextoAnalizando>trayendo…</TextoAnalizando>
              </View>
            </View>
          ) : fallado ? (
            /* No se pudo. Se queda la tarjeta en vez de desaparecer: el post
               que pegaste tiene que seguir estando para poder borrarlo, y una
               tarjeta que se esfuma sola no se distingue de una que nunca se
               creó. */
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 }}>
              <Text
                style={{
                  fontFamily: MONO,
                  fontSize: 10,
                  color: '#B91C1C',
                  textAlign: 'center',
                  lineHeight: 16,
                }}
              >
                {cortado ? 'Se cortó mientras lo traíamos.' : post.details?.carga_error || 'No se pudo traer.'}
              </Text>
              {/* El post sigue acá, con su enlace: se puede volver a traer sin
                  pegarlo otra vez. */}
              <Pressable
                onPress={onReintentar}
                hitSlop={10}
                style={({ pressed }) => ({
                  marginTop: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: RADIUS.pill,
                  backgroundColor: 'rgba(28,43,34,0.07)',
                  opacity: pressed ? 0.55 : 1,
                })}
                accessibilityRole="button"
                accessibilityLabel="Volver a traer el post"
              >
                <Text style={{ fontFamily: MONO, fontSize: 11, color: INK.title }}>volver a traer</Text>
              </Pressable>
            </View>
          ) : uri && !rota ? (
            <>
              <Image source={{ uri }} onError={() => setRota(true)} style={{ width: '100%', height: '100%' }} />
              {/* Que hay más de una. Sin esto, un carrusel se ve idéntico a
                  una foto suelta y nadie lo abre para descubrir que había seis. */}
              <MarcaCarrusel cuantas={cuantasImagenes} />
            </>
          ) : texto ? (
            /* Sin imagen: la tarjeta **es** el texto.
            
               Hoy los tweets vienen solo con texto, y antes eso daba una inicial
               gigante sobre un rectángulo gris: una letra que no dice nada,
               ocupando la mitad de la tarjeta, con el contenido real apretado en
               dos renglones abajo. Puesto acá, el mismo espacio muestra el post.
            
               Cuando vuelva a haber imágenes, esta rama no estorba: solo entra
               si no hay ninguna. */
            <View style={{ flex: 1, padding: 13, justifyContent: 'flex-start' }}>
              <Text
                numberOfLines={9}
                style={{ fontFamily: MONO, fontSize: 11.5, lineHeight: 18, color: 'rgba(28,43,34,0.72)' }}
              >
                {texto}
              </Text>
            </View>
          ) : (
            /* Ni imagen ni texto: la inicial, para que la tarjeta no sea un
               hueco gris idéntico a los demás. Es el último recurso, no el
               caso normal. */
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: MONO, fontSize: 30, color: 'rgba(28,43,34,0.16)' }}>
                {(autor || '?').trim().charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          {/* Analizándose. La tarjeta sigue mostrando el post y arriba va la
              marca: el análisis corre aunque se cierre la hoja o la app, y al
              volver la marca ya no está. Sin esto, salir del post a mitad se
              sentía como cancelarlo. */}
          {analizando ? (
            <View
              style={{
                position: 'absolute',
                left: 8,
                bottom: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 9,
                paddingVertical: 5,
                borderRadius: RADIUS.pill,
                backgroundColor: 'rgba(253,252,247,0.94)',
              }}
            >
              <MorphingInfinity size={12} color={INK.title} />
              <Text style={{ fontFamily: MONO, fontSize: 10.5, color: INK.title }}>analizando</Text>
            </View>
          ) : null}
        </View>

        {autor ? (
          <Text numberOfLines={1} style={{ fontFamily: MONO, fontSize: 11.5, color: INK.title, marginTop: 8 }}>
            {autor}
          </Text>
        ) : null}

        {/* El texto, solo si la tarjeta mostró una imagen. Con la tarjeta de
            texto ya está arriba, y repetirlo cuatro dedos más abajo es decir
            dos veces lo mismo en la misma pantalla. */}
        {texto && uri && !rota ? (
          <Text numberOfLines={2} style={{ fontFamily: MONO, fontSize: 11, color: 'rgba(28,43,34,0.42)', lineHeight: 17, marginTop: 3 }}>
            {texto}
          </Text>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

function vacio(abierta, busqueda, activos) {
  if (busqueda || activos) return 'nada con eso.';
  if (abierta) return 'esta carpeta está vacía.';
  return 'todavía no hay posts.';
}

/**
 * Un renglón de la ayuda.
 *
 * Etiqueta angosta a la izquierda y el texto a la derecha, la misma forma que
 * los detalles de una nota. Sin la columna fija, «instagram» y «X» quedaban a
 * distinta altura y las tres líneas no se leían como una lista.
 */
function Linea({ titulo, children }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 7 }}>
      <Text style={{ fontFamily: MONO, fontSize: 10.5, color: 'rgba(28,43,34,0.3)', width: 62 }}>
        {titulo}
      </Text>
      <Text
        style={{
          fontFamily: MONO,
          fontSize: 10.5,
          color: 'rgba(28,43,34,0.5)',
          lineHeight: 16,
          flex: 1,
        }}
      >
        {children}
      </Text>
    </View>
  );
}
