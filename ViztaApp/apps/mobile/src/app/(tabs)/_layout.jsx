import { useEffect, useRef, useState } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Alert, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppBackground from '../../components/AppBackground';
import NavOrb from '../../components/NavOrb';
import CreateSnippetSheet from '../../components/codex/CreateSnippetSheet';
import PostsSheet from '../../components/posts/PostsSheet';
import { alTocarAvisoDePost, prepararNotificaciones } from '../../utils/notificaciones';
import { prepararCompartir } from '../../utils/compartir';

// Una vez, al cargar: con la app abierta, un post que termina no saca cartel.
prepararNotificaciones();
import { usePulseConnectionStore } from '../../state/pulseConnectionStore';
import { useCapacidadesStore, refrescarCapacidades } from '../../state/capacidadesStore';
import {
  useUltimoLugarStore,
  useRecordarLugar,
  useLugarHidratado,
} from '../../state/ultimoLugarStore';
import { EV, evento, identificar } from '../../utils/analitica';

// ─── Medidas ──────────────────────────────────────────────────────────────────
const ORB_SIZE = 68;

/** Lo que la hoja de notas puede borrar del registro de «dónde me quedé». */
const TIPOS_NOTA = ['nota'];

/** Los lugares que viven en la pestaña del Codex, y hay que ir hasta allá. */
const EN_CODEX = ['item', 'espacio'];

/**
 * Ya no hay barra: solo el orbe.
 *
 * La píldora tenía dos botones —Feed y Ajustes— y un hueco en el medio para el
 * orbe. Se fue entera. Feed no necesita botón porque es la pantalla de partida:
 * se vuelve a ella cerrando lo que se haya abierto encima, que es el gesto que
 * ya se venía usando para salir de una nota.
 *
 * Las rutas siguen registradas abajo —`codex`, `orbit`, `settings`—: la barra
 * era la puerta, no la pantalla. `navigation.navigate(…)` las alcanza igual, y
 * Ajustes va a entrar por otro lado.
 *
 * Lo que queda es un solo control, y por eso ya no necesita distinguir entre
 * «dónde estoy» y «qué hago»: el orbe es siempre lo segundo.
 */
function BarraOrbe() {
  const insets = useSafeAreaInsets();
  const [escribiendo, setEscribiendo] = useState(false);
  const [viendoPosts, setViendoPosts] = useState(false);
  // El post del aviso que se tocó: la hoja de Posts lo abre al cargar.
  const [postDelAviso, setPostDelAviso] = useState(null);

  useEffect(
    () =>
      alTocarAvisoDePost((postId) => {
        setPostDelAviso(postId);
        setViendoPosts(true);
      }),
    []
  );

  // Qué nota tiene la hoja cargada, para poder volver a ella. La hoja lo avisa
  // porque el id es suyo: nace cuando se abre una del historial.
  const [notaId, setNotaId] = useState(null);
  // La nota que hay que volver a abrir en este arranque, si había una.
  const [notaARestaurar, setNotaARestaurar] = useState(null);

  // Sin sesión no hay dónde guardar: el insert de `codex_universe_items` pide
  // `user_id`. El orbe igual se muestra —esconderlo dejaría un agujero en medio
  // de la píldora y haría que la app se vea distinta según el estado de la
  // cuenta— pero avisa antes de abrir la hoja. El aviso va primero y no después
  // de escribir: descubrir que no hay dónde guardar recién al tocar «guardar»
  // significa perder el párrafo que acabás de escribir.
  const conectado = usePulseConnectionStore((s) => s.isConnected);

  // La hoja de «Compartir» necesita su llave mientras haya sesión, y que se
  // borre al salir de la cuenta.
  useEffect(() => {
    prepararCompartir(conectado);
  }, [conectado]);

  // Posts depende del plan, no del rol: lo trae Weekly, y en Free se paga con
  // créditos. Lo decide la base —la misma respuesta que usa el servidor para
  // dejar pasar el gasto—, así que la app no tiene que saber las reglas.
  const esAdmin = usePulseConnectionStore((s) => s.connectedUser?.role) === 'admin';
  const puedePosts = useCapacidadesStore((s) => !!s.capacidades?.posts);
  const userId = usePulseConnectionStore((s) => s.connectedUser?.id);

  useEffect(() => {
    evento(EV.APP_ABIERTA, { admin: esAdmin, conectado });
    // Solo una vez por arranque: esto cuenta aperturas, no renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Solo el id. Ni correo ni nombre: para medir uso alcanza con saber que es
  // la misma persona, no quién es.
  useEffect(() => {
    if (userId) identificar(userId, { admin: esAdmin });
  }, [userId, esAdmin]);

  // Al entrar y cada vez que cambia de cuenta.
  useEffect(() => {
    refrescarCapacidades({ forzar: true });
  }, [userId]);

  // Se anota la nota abierta solo cuando tiene id. Una nota nueva todavía no es
  // un lugar: no existe en la base, así que no hay nada que volver a pedir.
  useRecordarLugar(escribiendo && notaId ? { tipo: 'nota', id: notaId } : null, TIPOS_NOTA);

  // Volver a la nota donde se quedó.
  //
  // No se consume al montar sino cuando el encargo aparece: los efectos corren
  // de adentro hacia afuera, así que esta barra se monta —y correría su
  // efecto— antes de que el layout de arriba alcance a leer el disco. Mirando
  // `porRestaurar` como cualquier otro estado, el orden deja de importar.
  const porRestaurar = useUltimoLugarStore((s) => s.porRestaurar);
  const consumir = useUltimoLugarStore((s) => s.consumir);

  useEffect(() => {
    if (porRestaurar?.tipo !== 'nota') return;
    // La nota se trae de la cuenta; sin sesión no hay de dónde. Se espera en vez
    // de descartar: la sesión suele resolverse un instante después del arranque.
    if (!conectado) return;

    const lugar = consumir('nota');
    if (!lugar?.id) return;
    setNotaARestaurar(lugar.id);
    setEscribiendo(true);
  }, [porRestaurar?.tipo, conectado, consumir]);

  const abrirNota = () => {
    if (!conectado) {
      Alert.alert(
        'Conectá tu cuenta',
        'Las notas se guardan en tu cuenta. Podés conectarla desde Ajustes.'
      );
      return;
    }
    evento(EV.NOTA_ABIERTA);
    setEscribiendo(true);
  };

  return (
    // `box-none`: sin píldora detrás, todo lo que no sea el orbe tiene que
    // dejar pasar el toque al contenido. Sin esto quedaría una franja invisible
    // al pie de la pantalla comiéndose los taps de lo que está debajo.
    <View
      pointerEvents="box-none"
      style={{
        backgroundColor: 'transparent',
        alignItems: 'center',
        paddingTop: 10,
        paddingBottom: Math.max(insets.bottom, 14),
      }}
    >
      {/* El único control de la app. `focused` en false: el orbe no es una
          pestaña donde se pueda estar parado, sino una acción. */}
      <NavOrb
        size={ORB_SIZE}
        focused={false}
        etiqueta="Nota nueva"
        onPress={abrirNota}
        // La palanca solo existe si hay a dónde ir: para quien no es admin el
        // orbe sigue siendo un botón, sin un gesto que no lleva a nada.
        onArriba={
          puedePosts && conectado
            ? () => {
                evento(EV.POSTS_ABIERTOS);
                setViendoPosts(true);
              }
            : undefined
        }
        etiquetaArriba="posts"
      />

      {/* Las hojas son Modales, así que se dibujan sobre toda la app aunque
          vivan acá. Colgarlas del orbe las deja disponibles en cualquier
          pantalla, igual que el botón. */}
      {escribiendo && (
        <CreateSnippetSheet
          onClose={() => {
            setEscribiendo(false);
            setNotaId(null);
            setNotaARestaurar(null);
          }}
          restaurarId={notaARestaurar}
          onNota={setNotaId}
          topInset={insets.top}
          bottomInset={insets.bottom}
        />
      )}

      {viendoPosts && (
        <PostsSheet
          abrirId={postDelAviso}
          onClose={() => {
            setViendoPosts(false);
            setPostDelAviso(null);
          }}
          topInset={insets.top}
          bottomInset={insets.bottom}
        />
      )}
    </View>
  );
}

// ─── Layout ────────────────────────────────────────────────────────────────────
export default function TabsLayout() {
  const hidratado = useLugarHidratado();
  const iniciarRestauracion = useUltimoLugarStore((s) => s.iniciarRestauracion);
  const router = useRouter();
  const arrancado = useRef(false);

  // Una sola vez por arranque, en cuanto el disco contestó.
  //
  // Acá solo se abre el encargo y, si hace falta, se cambia de pestaña: cada
  // pantalla se restaura a sí misma. Las pestañas se montan cuando se visitan,
  // así que un item guardado no se restauraría nunca si nadie va al Codex — y
  // por eso la navegación no puede vivir dentro del Codex.
  useEffect(() => {
    if (!hidratado || arrancado.current) return;
    arrancado.current = true;

    const lugar = iniciarRestauracion();
    if (lugar && EN_CODEX.includes(lugar.tipo)) router.navigate('/codex');
  }, [hidratado, iniciarRestauracion, router]);

  return (
    // El fondo vive aquí, detrás de las pantallas y de la tab bar, para que no
    // haya costura entre el área de contenido y la barra flotante.
    <View style={{ flex: 1 }}>
      <AppBackground />
      <Tabs
        tabBar={() => <BarraOrbe />}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: 'transparent' },
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Feed' }} />
        <Tabs.Screen name="orbit" options={{ title: 'Orbit' }} />
        <Tabs.Screen name="codex" options={{ title: 'Codex' }} />
        <Tabs.Screen name="settings" options={{ title: 'Ajustes' }} />
      </Tabs>
    </View>
  );
}
