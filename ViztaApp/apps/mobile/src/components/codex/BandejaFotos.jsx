import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  FlatList,
  StyleSheet,
  Keyboard,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import {
  Camera as CamaraIcono,
  Images,
  ChevronDown,
  ChevronUp,
  SwitchCamera,
  Zap,
  ZapOff,
} from 'lucide-react-native';
import { MONO } from './mono';
import { MOTION } from '../theme';
import { toque, roce, falla } from '../../utils/haptics';

const LADO = 92;
const HUECO = 8;
const RADIO = 13;
const TENUE = 'rgba(28,43,34,0.34)';
const BLANCO = '#FFF';

// Cuántas fotos recientes trae la tira. Más que esto no es «lo último», es
// carrete — y para eso está la galería, que se abre acá mismo.
const CUANTAS = 45;

// De a cuántas crece la galería al bajar. Una pantalla y media por tirón: pedir
// menos hace que el scroll se frene a cada rato, y pedir mucho más tarda en
// aparecer sobre carretes largos.
const PAGINA = 60;

const COLUMNAS = 4;
const MARGEN = 22;

/**
 * Las fotos, sin salir de la nota.
 *
 * Una bandeja anclada abajo que **se levanta**, en tres estados: plegada es una
 * tira de fotos recientes con la cámara de primera; con la cámara desplegada
 * ocupa la bandeja entera y se dispara desde ahí; y con la galería desplegada
 * muestra el carrete completo en grilla. La nota **nunca deja de verse** — la
 * bandeja crece hacia arriba y le come espacio, no la tapa.
 *
 * Que la cámara y la galería vivan acá y no en una capa a pantalla completa es
 * la diferencia entre tomar o buscar una foto *para* la nota y salir a buscar
 * una foto. Arriba seguís viendo lo que escribiste, que es de lo que la foto va
 * a hablar.
 *
 * **Esto no es `expo-image-picker` y no puede serlo.** Ese módulo presenta la
 * hoja de fotos del sistema y la cámara del sistema, las dos como modales del
 * SO encima de la app: no expone ningún componente para montar adentro. Lo de
 * acá son las dos piezas que sí se montan — `CameraView` de `expo-camera` para
 * la cámara, y `expo-media-library` para leer el carrete y pintar la grilla uno
 * mismo.
 *
 * El casillero plegado trae **preview en vivo**, no un ícono. Es la diferencia
 * entre «acá hay un botón de cámara» y «la cámara ya está abierta». Se monta
 * solo mientras la bandeja está a la vista: una `CameraView` viva consume
 * batería y no tiene por qué seguir encendida debajo de una nota que nadie está
 * mirando.
 *
 * **Hay una sola `CameraView` en todo el componente**, que cambia de tamaño con
 * la bandeja. iOS da una sola sesión de captura por vez: dos vivas se pelean
 * por ella y una de las dos sale negra, según cuál ganó la carrera de montaje.
 *
 * Sobre los permisos: se piden **al abrir la bandeja**, no al arrancar la app.
 * Un diálogo del sistema pidiendo tus fotos sin que hayas pedido nada es lo que
 * enseña a decir que no.
 */
export default function BandejaFotos({ onFoto }) {
  const { height: H, width: W } = useWindowDimensions();

  const [permisoCamara, pedirCamara] = useCameraPermissions();
  const [permisoFotos, pedirFotos] = MediaLibrary.usePermissions();

  const [assets, setAssets] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Paginado del carrete. El cursor lo da la propia librería; sin él, pedir
  // «las siguientes» devolvería otra vez las mismas primeras.
  const [cursor, setCursor] = useState(null);
  const [hayMas, setHayMas] = useState(false);
  const [trayendo, setTrayendo] = useState(false);

  // Cámara desplegada.
  const [abierta, setAbierta] = useState(false);
  // Galería desplegada. Son estados distintos y excluyentes: la cámara necesita
  // toda la bandeja y la grilla también.
  const [galeria, setGaleria] = useState(false);
  const [frente, setFrente] = useState(false);
  const [flash, setFlash] = useState(false);
  const [lista, setLista] = useState(false);
  const [tomando, setTomando] = useState(false);
  const camara = useRef(null);

  // Cuánto se levanta. Proporcional a la pantalla y con techo: la bandeja tiene
  // que crecer lo suficiente para que la cámara se vea, y dejar arriba lo que
  // se escribió — si se come la nota entera, es una capa a pantalla completa
  // con otro nombre.
  const ALTO_ABIERTA = Math.min(400, H * 0.46);
  // La galería puede algo más que la cámara —una grilla con dos filas y media
  // se busca mejor que con una—, pero sigue dejando la nota a la vista.
  const ALTO_GALERIA = Math.min(460, H * 0.54);

  const LADO_GRILLA = Math.floor((W - MARGEN * 2 - HUECO * (COLUMNAS - 1)) / COLUMNAS);

  const alto = useSharedValue(LADO);
  const caja = useAnimatedStyle(() => ({ height: alto.value }));

  useEffect(() => {
    const destino = galeria ? ALTO_GALERIA : abierta ? ALTO_ABIERTA : LADO;
    alto.value = withSpring(destino, MOTION.layout);
  }, [abierta, galeria, ALTO_ABIERTA, ALTO_GALERIA, alto]);

  const concedidoFotos = !!permisoFotos?.granted;
  // iOS deja elegir «solo estas fotos». No es un permiso a medias que haya que
  // arreglar: es una respuesta legítima, y la bandeja funciona igual con las
  // que sí compartió.
  const parcial = permisoFotos?.accessPrivileges === 'limited';

  useEffect(() => {
    if (!concedidoFotos) {
      setCargando(false);
      return;
    }

    let vivo = true;

    (async () => {
      try {
        const pagina = await MediaLibrary.getAssetsAsync({
          first: CUANTAS,
          mediaType: 'photo',
          sortBy: [MediaLibrary.SortBy.creationTime],
        });
        if (!vivo) return;
        setAssets(pagina?.assets || []);
        setCursor(pagina?.endCursor || null);
        setHayMas(!!pagina?.hasNextPage);
      } catch {
        if (vivo) setAssets([]);
      } finally {
        if (vivo) setCargando(false);
      }
    })();

    return () => {
      vivo = false;
    };
    // `accessPrivileges` cambia si la persona amplía la selección desde el
    // sistema; recargar ahí es lo que hace aparecer las fotos recién compartidas.
  }, [concedidoFotos, permisoFotos?.accessPrivileges]);

  /**
   * Traer la siguiente tanda del carrete.
   *
   * Se llama al llegar al final de la grilla, no al abrirla: quien busca la
   * foto de hace un rato la encuentra en la primera pantalla y nunca paga el
   * costo de leer el carrete entero.
   */
  const cargarMas = useCallback(async () => {
    if (!hayMas || trayendo || !cursor) return;
    setTrayendo(true);
    try {
      const pagina = await MediaLibrary.getAssetsAsync({
        first: PAGINA,
        after: cursor,
        mediaType: 'photo',
        sortBy: [MediaLibrary.SortBy.creationTime],
      });
      setAssets((previas) => {
        // La librería puede devolver algo ya visto si el carrete cambió
        // mientras tanto; repetir una foto en la grilla se ve como un error.
        const vistas = new Set(previas.map((a) => a.id));
        return [...previas, ...(pagina?.assets || []).filter((a) => !vistas.has(a.id))];
      });
      setCursor(pagina?.endCursor || null);
      setHayMas(!!pagina?.hasNextPage);
    } catch {
      setHayMas(false);
    } finally {
      setTrayendo(false);
    }
  }, [cursor, hayMas, trayendo]);

  /**
   * Abrir la cámara en la bandeja.
   *
   * Baja el teclado al abrir. No es limpieza: la bandeja levantada más el
   * teclado no entran juntos en la pantalla, y bajarlo es lo que deja ver la
   * nota arriba de la cámara — que es el punto de que la cámara viva acá.
   */
  const abrir = useCallback(async () => {
    roce();

    if (!permisoCamara?.granted) {
      // Se abre en cuanto concede, sin pedir un segundo toque. Tocar «cámara»,
      // decir que sí y volver a un casillero que sigue pareciendo apagado se
      // lee como que no funcionó.
      const r = await pedirCamara();
      if (!r?.granted) return;
    }

    Keyboard.dismiss();
    setGaleria(false);
    // La sesión de captura empieza de cero cada vez que se abre la bandeja, así
    // que el disparador vuelve a esperar su `onCameraReady`. Sin esto, `lista`
    // se quedaba en `true` desde la primera vez y en la segunda apertura el
    // disparador quedaba habilitado antes de que la cámara existiera: la foto
    // salía negra o fallaba. En el simulador no se ve nunca, porque ahí
    // `onCameraReady` no dispara.
    setLista(false);
    setAbierta(true);
  }, [permisoCamara?.granted, pedirCamara]);

  /** Abrir la galería: la tira se levanta y se vuelve grilla. */
  const abrirGaleria = useCallback(async () => {
    roce();

    if (!concedidoFotos) {
      const r = await pedirFotos();
      if (!r?.granted) return;
    }

    Keyboard.dismiss();
    setAbierta(false);
    setLista(false);
    setGaleria(true);
  }, [concedidoFotos, pedirFotos]);

  const disparar = useCallback(async () => {
    // `lista` es la espera del `onCameraReady` que el módulo pide explícitamente
    // antes de disparar; sin ella, el primer toque puede salir en negro.
    if (!lista || tomando) return;

    setTomando(true);
    try {
      const foto = await camara.current?.takePictureAsync({
        quality: 0.9,
        // La foto se reencoda al subir de todas formas (ver `subirImagen`), así
        // que pedir el EXIF acá sería cargar metadatos que se pierden después.
        exif: false,
      });

      if (!foto?.uri) throw new Error('sin foto');

      toque();
      onFoto?.({ uri: foto.uri, ancho: foto.width, alto: foto.height });
      // La bandeja se pliega sola: la foto ya está en la nota, y quedarse en la
      // cámara taparía justo lo que se acaba de adjuntar.
      setAbierta(false);
      setLista(false);
    } catch {
      falla();
    } finally {
      setTomando(false);
    }
  }, [lista, tomando, onFoto]);

  /**
   * Del carrete a un archivo que se pueda leer.
   *
   * En iOS el `uri` de un asset es `ph://<id>`, que es un identificador del
   * álbum y no una ruta: abrirlo con `File` falla. `getAssetInfoAsync` devuelve
   * `localUri`, el `file://` real, que es lo único que la subida puede leer.
   *
   * La galería **no se pliega al elegir**, al revés que la cámara: tomar una
   * foto es un acto que termina, elegir del carrete suele venir de a varias.
   * La nota se ve arriba, así que la foto adjuntada aparece igual.
   */
  const elegir = useCallback(
    async (asset) => {
      roce();
      try {
        const info = await MediaLibrary.getAssetInfoAsync(asset);
        const uri = info?.localUri || asset.uri;
        onFoto?.({ uri, ancho: asset.width, alto: asset.height });
      } catch {
        falla();
      }
    },
    [onFoto]
  );

  /** Ampliar la selección cuando se compartieron solo algunas fotos. */
  const ampliar = useCallback(() => {
    roce();
    MediaLibrary.presentPermissionsPickerAsync();
  }, []);

  return (
    <Animated.View entering={FadeIn.duration(200)} style={caja}>
      {abierta ? (
        /* ── La cámara, ocupando la bandeja ─────────────────────────────── */
        <Animated.View
          entering={FadeIn.duration(200).delay(80)}
          exiting={FadeOut.duration(120)}
          style={{
            flex: 1,
            marginHorizontal: MARGEN,
            borderRadius: 20,
            overflow: 'hidden',
            backgroundColor: '#000',
          }}
        >
          <CameraView
            ref={camara}
            style={StyleSheet.absoluteFillObject}
            facing={frente ? 'front' : 'back'}
            flash={flash ? 'on' : 'off'}
            onCameraReady={() => setLista(true)}
          />

          {/* Plegar. Un chevron hacia abajo y no una «X»: la bandeja baja, no
              se cierra una pantalla. */}
          <Pressable
            onPress={() => {
              roce();
              setAbierta(false);
              setLista(false);
            }}
            hitSlop={12}
            style={{ position: 'absolute', top: 10, left: 12, padding: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Bajar la cámara"
          >
            <ChevronDown size={20} color={BLANCO} />
          </Pressable>

          <Pressable
            onPress={() => {
              roce();
              setFlash((f) => !f);
            }}
            hitSlop={12}
            style={{ position: 'absolute', top: 10, right: 12, padding: 8 }}
            accessibilityRole="button"
            accessibilityLabel={flash ? 'Apagar el flash' : 'Encender el flash'}
          >
            {flash ? <Zap size={18} color={BLANCO} /> : <ZapOff size={18} color="rgba(255,255,255,0.6)" />}
          </Pressable>

          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 18,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 40,
            }}
          >
            <View style={{ width: 40 }} />

            {/* El disparador. Anillo afuera y disco adentro: es la forma que ya
                significa «tomar la foto», y no hace falta rotularla. */}
            <Pressable
              onPress={disparar}
              disabled={!lista || tomando}
              style={({ pressed }) => ({
                width: 64,
                height: 64,
                borderRadius: 32,
                borderWidth: 3,
                borderColor: BLANCO,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: lista ? 1 : 0.4,
                transform: [{ scale: pressed ? 0.92 : 1 }],
              })}
              accessibilityRole="button"
              accessibilityLabel="Tomar la foto"
            >
              <View
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  backgroundColor: tomando ? 'rgba(255,255,255,0.45)' : BLANCO,
                }}
              />
            </Pressable>

            <Pressable
              onPress={() => {
                roce();
                // Girar la cámara arranca otra sesión: hasta que la nueva avise
                // que está lista, el disparador espera.
                setLista(false);
                setFrente((f) => !f);
              }}
              hitSlop={12}
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(0,0,0,0.35)',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.6 : 1,
              })}
              accessibilityRole="button"
              accessibilityLabel="Cambiar de cámara"
            >
              <SwitchCamera size={17} color={BLANCO} />
            </Pressable>
          </View>

          {!lista ? (
            <View style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ fontFamily: MONO, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                abriendo la cámara…
              </Text>
            </View>
          ) : null}
        </Animated.View>
      ) : galeria ? (
        /* ── La galería, ocupando la bandeja ────────────────────────────── */
        <Animated.View
          entering={FadeIn.duration(200).delay(60)}
          exiting={FadeOut.duration(120)}
          style={{
            flex: 1,
            marginHorizontal: MARGEN,
            borderRadius: 20,
            overflow: 'hidden',
            backgroundColor: 'rgba(255,255,255,0.96)',
          }}
        >
          {/* La misma barra de la cámara: chevron abajo para plegar. Acá vive
              también «elegir más», que solo tiene sentido con permiso parcial. */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 10,
              paddingVertical: 8,
            }}
          >
            <Pressable
              onPress={() => {
                roce();
                setGaleria(false);
              }}
              hitSlop={12}
              style={{ padding: 6 }}
              accessibilityRole="button"
              accessibilityLabel="Bajar la galería"
            >
              <ChevronDown size={20} color={TENUE} />
            </Pressable>

            <View style={{ flex: 1 }} />

            {parcial ? (
              <Pressable
                onPress={ampliar}
                hitSlop={10}
                style={({ pressed }) => ({ paddingHorizontal: 8, paddingVertical: 4, opacity: pressed ? 0.6 : 1 })}
                accessibilityRole="button"
                accessibilityLabel="Elegir más fotos para compartir con Vizta"
              >
                <Text style={{ fontFamily: MONO, fontSize: 11, color: TENUE }}>elegir más</Text>
              </Pressable>
            ) : null}
          </View>

          <FlatList
            data={assets}
            keyExtractor={(a) => a.id}
            numColumns={COLUMNAS}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 14, gap: HUECO }}
            columnWrapperStyle={{ gap: HUECO }}
            onEndReachedThreshold={0.6}
            onEndReached={cargarMas}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => elegir(item)}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                accessibilityRole="button"
                accessibilityLabel="Adjuntar esta foto"
              >
                <Image
                  source={{ uri: item.uri }}
                  style={{
                    width: LADO_GRILLA,
                    height: LADO_GRILLA,
                    borderRadius: 10,
                    backgroundColor: 'rgba(28,43,34,0.06)',
                  }}
                  contentFit="cover"
                  cachePolicy="memory"
                  transition={120}
                />
              </Pressable>
            )}
            ListFooterComponent={
              trayendo ? (
                <Text
                  style={{
                    fontFamily: MONO,
                    fontSize: 11,
                    color: TENUE,
                    textAlign: 'center',
                    paddingVertical: 12,
                  }}
                >
                  trayendo más…
                </Text>
              ) : null
            }
          />
        </Animated.View>
      ) : (
        /* ── Plegada: la tira ───────────────────────────────────────────── */
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(100)}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: HUECO, paddingHorizontal: MARGEN }}
          >
            {/* La cámara, de primera. Es el gesto más caro de los dos —tomar
                una foto nueva— y por eso va donde el pulgar ya está. */}
            <Pressable
              onPress={abrir}
              style={({ pressed }) => ({
                width: LADO,
                height: LADO,
                borderRadius: RADIO,
                overflow: 'hidden',
                backgroundColor: 'rgba(28,43,34,0.06)',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.75 : 1,
              })}
              accessibilityRole="button"
              accessibilityLabel="Abrir la cámara"
            >
              {permisoCamara?.granted ? (
                <>
                  <CameraView style={{ width: LADO, height: LADO }} facing="back" />
                  {/* El glifo encima del preview: sin él, el casillero se lee
                      como una foto más del carrete y nadie descubre que es la
                      cámara. */}
                  <View
                    style={{
                      ...StyleSheet.absoluteFillObject,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'rgba(28,43,34,0.22)',
                    }}
                  >
                    <CamaraIcono size={20} color={BLANCO} />
                  </View>
                </>
              ) : (
                <>
                  <CamaraIcono size={19} color={TENUE} />
                  <Text style={{ fontFamily: MONO, fontSize: 9.5, color: TENUE, marginTop: 6 }}>
                    cámara
                  </Text>
                </>
              )}
            </Pressable>

            {/* Abrir la galería. Va segundo y no al final de la tira: al final
                solo llega quien ya recorrió 45 fotos de lado, que es
                exactamente quien no encontró la suya y más lo necesita.
                El chevron hacia arriba dice lo que hace —la bandeja sube— con
                el mismo vocabulario que el chevron hacia abajo de la cámara. */}
            {concedidoFotos ? (
              <Pressable
                onPress={abrirGaleria}
                style={({ pressed }) => ({
                  width: LADO,
                  height: LADO,
                  borderRadius: RADIO,
                  backgroundColor: 'rgba(28,43,34,0.06)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.75 : 1,
                })}
                accessibilityRole="button"
                accessibilityLabel="Ver todas tus fotos"
              >
                <ChevronUp size={18} color={TENUE} />
                <Text style={{ fontFamily: MONO, fontSize: 9.5, color: TENUE, marginTop: 5 }}>
                  ver todas
                </Text>
              </Pressable>
            ) : null}

            {/* El carrete. Sin permiso todavía, un solo casillero que lo pide —
                y dice para qué, que es lo que el diálogo del sistema no alcanza
                a explicar. */}
            {!concedidoFotos ? (
              <Pressable
                onPress={() => {
                  roce();
                  pedirFotos();
                }}
                style={({ pressed }) => ({
                  height: LADO,
                  paddingHorizontal: 18,
                  borderRadius: RADIO,
                  backgroundColor: 'rgba(28,43,34,0.06)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.75 : 1,
                })}
                accessibilityRole="button"
                accessibilityLabel="Permitir ver tus fotos recientes"
              >
                <Images size={18} color={TENUE} />
                <Text
                  style={{
                    fontFamily: MONO,
                    fontSize: 10.5,
                    color: TENUE,
                    marginTop: 7,
                    textAlign: 'center',
                  }}
                >
                  ver tus fotos{'\n'}recientes
                </Text>
              </Pressable>
            ) : null}

            {assets.slice(0, CUANTAS).map((a) => (
              <Pressable
                key={a.id}
                onPress={() => elegir(a)}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                accessibilityRole="button"
                accessibilityLabel="Adjuntar esta foto"
              >
                <Image
                  source={{ uri: a.uri }}
                  style={{
                    width: LADO,
                    height: LADO,
                    borderRadius: RADIO,
                    backgroundColor: 'rgba(28,43,34,0.06)',
                  }}
                  contentFit="cover"
                  // El carrete es local: cachear en disco copiaría las fotos del
                  // teléfono a otra carpeta del teléfono, sin ganar nada.
                  cachePolicy="memory"
                  transition={120}
                />
              </Pressable>
            ))}

            {/* Ampliar la selección, cuando se compartieron solo algunas. Va al
                final y no al principio: quien eligió compartir cuatro fotos
                quiere ver esas cuatro primero. */}
            {parcial ? (
              <Pressable
                onPress={ampliar}
                style={({ pressed }) => ({
                  height: LADO,
                  paddingHorizontal: 16,
                  borderRadius: RADIO,
                  backgroundColor: 'rgba(28,43,34,0.06)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.75 : 1,
                })}
                accessibilityRole="button"
                accessibilityLabel="Elegir más fotos para compartir con Vizta"
              >
                <Text style={{ fontFamily: MONO, fontSize: 10.5, color: TENUE, textAlign: 'center' }}>
                  elegir{'\n'}más
                </Text>
              </Pressable>
            ) : null}

            {concedidoFotos && !cargando && assets.length === 0 ? (
              <View style={{ height: LADO, justifyContent: 'center', paddingHorizontal: 6 }}>
                <Text style={{ fontFamily: MONO, fontSize: 11, color: TENUE }}>
                  no hay fotos recientes
                </Text>
              </View>
            ) : null}
          </ScrollView>
        </Animated.View>
      )}
    </Animated.View>
  );
}
