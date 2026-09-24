import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Camera, Check, FileUp, Link2, ScanFace, X } from 'lucide-react-native';
import { INK, RADIUS } from '../theme';
import { MONO } from './mono';
import { PAPEL } from './Papel';
import BandejaFotos from './BandejaFotos';
import { subirImagen, firmarMedio } from '../../utils/subirMedio';
import { elegirYSubirDocumento } from '../../utils/subirDocumento';
import { supabase } from '../../utils/supabase';
import { roce, toque, falla } from '../../utils/haptics';
import {
  fotoIndexada,
  indexarFoto,
  quitarFoto,
  useReconocimientoDisponible,
} from '../../utils/reconocimientoRostros';

/**
 * Una imagen se sube; no se pega su dirección.
 *
 * El control era una caja de texto que pedía «URL del archivo». Para el agente
 * que llena el Codex tiene sentido —el contrato guarda `{ id }`, la referencia
 * al archivo real— pero a una persona le pedía exactamente lo que no tiene a
 * mano: la foto está en su teléfono, no en internet.
 *
 * Ahora hay tres caminos, en el orden en que se usan: **subir una foto** del
 * carrete o de la cámara, **subir un archivo** cualquiera, y **pegar un enlace**
 * para el caso en que la imagen ya viva en otro lado. Los dos primeros crean el
 * item real en el Codex y guardan su `{ id }`, que es lo que el contrato pide;
 * el tercero guarda la cadena tal cual, que es lo que ya hacía.
 *
 * Y se ve: una miniatura en vez de una ruta. Un campo de imagen que no muestra
 * la imagen obliga a abrir el archivo para saber si es el correcto.
 */
export default function CampoArchivo({ value, onChange, soloImagen = true, accent = INK.title, reconocer = null }) {
  const [bandeja, setBandeja] = useState(false);
  const [pegando, setPegando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState(null);
  const [vista, setVista] = useState(null); // { url, nombre, ruta }

  const id = value && typeof value === 'object' ? value.id : null;
  const enlace = typeof value === 'string' ? value : value?.url || null;

  /**
   * Cómo se ve lo que está guardado.
   *
   * Con `{ id }` hay que ir a buscar el archivo: la ruta es privada y el enlace
   * se firma al momento, igual que las fotos de una nota. Con un enlace suelto,
   * ya está todo.
   */
  useEffect(() => {
    let vivo = true;
    (async () => {
      if (enlace) return setVista({ url: enlace, nombre: null });
      if (!id) return setVista(null);
      try {
        const { data } = await supabase
          .from('codex_items')
          .select('id, titulo, nombre_archivo, storage_path, url')
          .eq('id', id)
          .maybeSingle();
        if (!vivo) return;
        if (!data) return setVista(null);
        const url = data.url || (data.storage_path ? await firmarMedio(data.storage_path) : null);
        if (vivo) setVista({ url, nombre: data.titulo || data.nombre_archivo || null, ruta: data.storage_path || null });
      } catch {
        if (vivo) setVista(null);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [id, enlace]);

  /** Sube la foto elegida y la registra como archivo del Codex. */
  const guardarFoto = async (foto) => {
    setBandeja(false);
    setSubiendo(true);
    setError(null);
    try {
      const subida = await subirImagen(foto.uri, { ancho: foto.ancho, alto: foto.alto });
      const { data: sesion } = await supabase.auth.getSession();
      const userId = sesion?.session?.user?.id;
      if (!userId) throw new Error('Sin sesión activa');

      // El archivo existe en el Codex como cualquier otro documento: así la
      // referencia apunta a algo que se puede abrir, mover y borrar desde donde
      // se administran los archivos, y no a una ruta suelta dentro de un campo.
      const { data, error: err } = await supabase
        .from('codex_items')
        .insert({
          user_id: userId,
          tipo: 'documento',
          titulo: 'Imagen',
          nombre_archivo: subida.storage_path.split('/').pop(),
          tamano: subida.tamano,
          storage_path: subida.storage_path,
          url: null,
          fecha: new Date().toISOString().slice(0, 10),
          proyecto: 'Sin proyecto',
        })
        .select('id')
        .single();
      if (err) throw err;

      onChange({ id: data.id });
      roce();
    } catch (e) {
      setError(e?.message || 'No se pudo subir la imagen');
    } finally {
      setSubiendo(false);
    }
  };

  const subirArchivo = async () => {
    setSubiendo(true);
    setError(null);
    try {
      const r = await elegirYSubirDocumento({});
      if (!r.cancelado && r.item?.id) {
        onChange({ id: r.item.id });
        roce();
      }
    } catch (e) {
      setError(e?.message || 'No se pudo subir el archivo');
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <View style={{ gap: 9 }}>
      {vista?.url ? (
        <View style={{ borderRadius: RADIUS.sm, overflow: 'hidden', backgroundColor: 'rgba(28,43,34,0.05)' }}>
          <Image source={{ uri: vista.url }} style={{ width: '100%', height: 150 }} contentFit="cover" />
          {/* Solo sobre una foto subida —con `{ id }`— de un actor, y con la Beta.
              Un enlace pegado no se puede indexar: no es un archivo nuestro. */}
          {reconocer && id && vista?.ruta ? (
            <UsarParaReconocer
              actorId={reconocer.actorId}
              archivoId={id}
              ruta={vista.ruta}
              pendiente={reconocer.pendientes?.has(id) || false}
              onPendiente={reconocer.onPendiente}
              onError={setError}
            />
          ) : null}
          <Pressable
            onPress={() => {
              roce();
              onChange(null);
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Quitar la imagen"
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 26,
              height: 26,
              borderRadius: 13,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(20,28,22,0.55)',
            }}
          >
            <X size={14} color="#FFFFFF" />
          </Pressable>
        </View>
      ) : id ? (
        // Hay referencia pero no se pudo resolver: se dice, en vez de mostrar un
        // hueco que parece un error de dibujo.
        <Text style={{ fontFamily: MONO, fontSize: 11.5, color: INK.meta }}>
          archivo del Codex · {String(id).slice(0, 8)}
        </Text>
      ) : null}

      {vista?.nombre ? (
        <Text numberOfLines={1} style={{ fontFamily: MONO, fontSize: 11, color: INK.meta }}>
          {vista.nombre}
        </Text>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {soloImagen ? (
          <Boton Icono={Camera} texto="foto" onPress={() => setBandeja(true)} accent={accent} cargando={subiendo} />
        ) : null}
        <Boton Icono={FileUp} texto="archivo" onPress={subirArchivo} accent={accent} cargando={subiendo} />
        <Boton Icono={Link2} texto="enlace" onPress={() => setPegando((p) => !p)} accent={accent} />
      </View>

      {pegando ? (
        <TextInput
          value={enlace || ''}
          onChangeText={(t) => onChange(t === '' ? null : t)}
          placeholder="https://…"
          placeholderTextColor={INK.faint}
          autoCapitalize="none"
          autoFocus
          style={{
            paddingHorizontal: 13,
            paddingVertical: 11,
            borderRadius: RADIUS.sm,
            borderWidth: 1,
            borderColor: 'rgba(28,43,34,0.12)',
            fontSize: 13.5,
            color: INK.title,
          }}
        />
      ) : null}

      {error ? <Text style={{ fontSize: 12, color: '#B91C1C' }}>{error}</Text> : null}

      <Modal visible={bandeja} transparent animationType="slide" onRequestClose={() => setBandeja(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(20,28,22,0.4)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setBandeja(false)} />
          <Animated.View
            entering={FadeInDown.springify().damping(19).stiffness(180)}
            style={{ backgroundColor: PAPEL, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 12, paddingBottom: 18 }}
          >
            <BandejaFotos onFoto={guardarFoto} />
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

function Boton({ Icono, texto, onPress, accent, cargando }) {
  return (
    <Pressable
      onPress={cargando ? undefined : onPress}
      disabled={cargando}
      accessibilityRole="button"
      accessibilityLabel={texto}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        paddingVertical: 11,
        borderRadius: RADIUS.sm,
        borderWidth: 1,
        borderColor: 'rgba(28,43,34,0.12)',
        opacity: cargando ? 0.5 : 1,
        backgroundColor: pressed ? 'rgba(28,43,34,0.05)' : 'transparent',
      })}
    >
      <Icono size={14} color={accent} />
      <Text style={{ fontFamily: MONO, fontSize: 11.5, color: INK.body }}>{texto}</Text>
    </Pressable>
  );
}

/**
 * El chequecito de la cara, sobre la esquina de la foto.
 *
 * Solo un casillero y un ícono de cara: el ícono dice de qué se trata sin una
 * frase al lado, y la frase completa queda para el lector de pantalla.
 *
 * **Dos modos, según si el actor ya existe:**
 *   · En vivo —el actor tiene id—: marcar indexa la cara ya, desmarcar la
 *     quita. El estado sale de la base, no de un recuerdo local.
 *   · Pendiente —se está creando—: marcar solo anota la intención, porque
 *     todavía no hay actor al que asociarle la cara. La ficha la cumple al
 *     tocar «Crear», cuando el actor ya existe.
 *
 * Si algo falla, vuelve a como estaba y el motivo aparece debajo de la foto.
 */
function UsarParaReconocer({ actorId, archivoId, ruta, pendiente, onPendiente, onError }) {
  const disponible = useReconocimientoDisponible();
  const diferido = !actorId;
  const [marcado, setMarcado] = useState(false);
  const [listo, setListo] = useState(diferido);
  const [trabajando, setTrabajando] = useState(false);

  useEffect(() => {
    if (!disponible || diferido) return undefined;
    let vivo = true;
    fotoIndexada(actorId, ruta)
      .then((v) => vivo && setMarcado(v))
      .catch(() => {})
      .finally(() => vivo && setListo(true));
    return () => {
      vivo = false;
    };
  }, [disponible, diferido, actorId, ruta]);

  if (!disponible) return null;
  // Creando sin quién lo anote, no hay dónde guardar la intención.
  if (diferido && !onPendiente) return null;

  const activo = diferido ? pendiente : marcado;

  const alternar = async () => {
    if (!listo || trabajando) return;
    const quiere = !activo;
    roce();
    onError?.(null);

    if (diferido) {
      onPendiente(archivoId, quiere);
      return;
    }

    setTrabajando(true);
    try {
      if (quiere) await indexarFoto(actorId, archivoId);
      else await quitarFoto(actorId, archivoId);
      setMarcado(quiere);
      toque();
    } catch (e) {
      falla();
      onError?.(e.message);
    } finally {
      setTrabajando(false);
    }
  };

  return (
    <Pressable
      onPress={alternar}
      disabled={!listo || trabajando}
      hitSlop={8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: activo, busy: trabajando }}
      accessibilityLabel="Reconocer a esta persona en posts"
      style={({ pressed }) => ({
        position: 'absolute',
        left: 8,
        bottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 7,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: activo ? 'rgba(75,79,166,0.92)' : 'rgba(255,255,255,0.88)',
        opacity: !listo ? 0.5 : pressed ? 0.75 : 1,
      })}
    >
      <View
        style={{
          width: 16,
          height: 16,
          borderRadius: 5,
          borderWidth: 1.5,
          borderColor: activo ? '#FFFFFF' : 'rgba(28,43,34,0.4)',
          backgroundColor: activo ? '#FFFFFF' : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {activo ? <Check size={11} color="#4B4FA6" strokeWidth={3.2} /> : null}
      </View>
      <ScanFace size={16} color={activo ? '#FFFFFF' : 'rgba(28,43,34,0.7)'} strokeWidth={trabajando ? 1.4 : 2} />
    </Pressable>
  );
}
