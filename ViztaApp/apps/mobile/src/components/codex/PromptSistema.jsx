import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { RotateCcw } from 'lucide-react-native';
import { INK } from '../theme';
import { MONO } from './mono';
import MorphingInfinity from '../MorphingInfinity';
import { leerSistema, guardarSistema } from '../../services/viztaRapido';
import { toque, roce, falla } from '../../utils/haptics';

const TENUE = 'rgba(28,43,34,0.34)';

/**
 * Las instrucciones con las que contesta Vizta.
 *
 * Vive en la mitad de abajo de la página derecha, donde en modo nota van los
 * detalles del snippet — título, fuente, etiquetas. **Arriba siguen los
 * mencionados**, que en el chat son los items del Codex que salieron en la
 * conversación: esa mitad no depende del modo, porque nombrar a alguien es
 * nombrarlo se esté escribiendo una nota o preguntando.
 *
 * Se guarda en `workshop_prompts`, que ya existía: es de donde la web levanta
 * los prompts propios, así que lo que se edita acá **también rige allá**. No
 * hay dos lugares donde configurar a Vizta, que es lo que hubiera pasado
 * creando una tabla nueva para el teléfono.
 *
 * **El texto reemplaza al de fábrica por completo.** Fue una decisión tomada a
 * conciencia, y conviene saber qué se pierde si el propio no lo repite: el de
 * fábrica pide avisar antes de crear, modificar o borrar, y con las
 * herramientas de escritura habilitadas esa línea es lo único que hace que un
 * borrado se anuncie. Por eso el editor arranca **con el de fábrica cargado**
 * en vez de en blanco: editar deja ver qué se está cambiando; escribir desde
 * cero hace fácil dejarse algo afuera sin notarlo.
 */
export default function PromptSistema() {
  const [texto, setTexto] = useState('');
  const [predeterminado, setPredeterminado] = useState('');
  const [id, setId] = useState(null);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [guardado, setGuardado] = useState(false);

  // Lo que había al cargar o al guardar. Sirve para saber si hay algo pendiente
  // sin comparar contra el de fábrica, que no es lo mismo.
  const limpio = useRef('');

  useEffect(() => {
    let vivo = true;

    leerSistema()
      .then(({ predeterminado: base, activo }) => {
        if (!vivo) return;
        const inicial = activo?.prompt_text || base;
        setPredeterminado(base);
        setTexto(inicial);
        setId(activo?.id || null);
        limpio.current = inicial;
      })
      .catch((e) => vivo && setError(e.message || 'No se pudo leer el prompt'))
      .finally(() => vivo && setCargando(false));

    return () => {
      vivo = false;
    };
  }, []);

  const sucio = texto !== limpio.current;

  const guardar = useCallback(async () => {
    if (!texto.trim() || guardando) return;

    setGuardando(true);
    setError(null);

    try {
      const fila = await guardarSistema(texto, id);
      // El id del recién creado se retiene: sin esto, guardar dos veces seguidas
      // dejaría dos prompts en la cuenta en vez de actualizar el mismo.
      if (fila?.id) setId(fila.id);
      limpio.current = texto;
      toque();
      setGuardado(true);
      setTimeout(() => setGuardado(false), 1800);
    } catch (e) {
      falla();
      setError(e.message || 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  }, [texto, id, guardando]);

  if (cargando) return <MorphingInfinity size={18} color={INK.title} />;

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
        <Text style={{ fontFamily: MONO, fontSize: 11.5, color: TENUE, flex: 1 }}>
          instrucciones
        </Text>

        {/* Volver al de fábrica. Solo aparece si el texto se apartó de él —
            ofrecer «restaurar» cuando ya estás en el original no hace nada. */}
        {texto !== predeterminado ? (
          <Pressable
            onPress={() => {
              roce();
              setTexto(predeterminado);
            }}
            hitSlop={10}
            style={({ pressed }) => ({ opacity: pressed ? 0.4 : 1, padding: 4 })}
            accessibilityRole="button"
            accessibilityLabel="Volver al prompt de fábrica"
          >
            <RotateCcw size={14} color={TENUE} />
          </Pressable>
        ) : null}
      </View>

      {/* El teclado no se abre solo, igual que en la nota: esto se lee tanto
          como se escribe. */}
      <TextInput
        value={texto}
        onChangeText={setTexto}
        multiline
        placeholder="Cómo tiene que contestar Vizta…"
        placeholderTextColor="rgba(28,43,34,0.22)"
        style={{
          fontFamily: MONO,
          fontSize: 13.5,
          lineHeight: 23,
          color: INK.title,
          minHeight: 300,
          textAlignVertical: 'top',
          padding: 0,
          marginTop: 10,
        }}
      />

      <View style={{ height: 1, backgroundColor: 'rgba(28,43,34,0.12)', marginTop: 16 }} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 }}>
        {sucio ? (
          <Pressable
            onPress={guardar}
            disabled={guardando}
            hitSlop={10}
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
          >
            {guardando ? (
              <MorphingInfinity size={16} color={INK.title} />
            ) : (
              <Text style={{ fontFamily: MONO, fontSize: 13.5, color: INK.title }}>guardar</Text>
            )}
          </Pressable>
        ) : guardado ? (
          <Animated.Text
            entering={FadeIn.duration(160)}
            style={{ fontFamily: MONO, fontSize: 12, color: TENUE }}
          >
            guardado
          </Animated.Text>
        ) : null}

        <View style={{ flex: 1 }} />
      </View>

      {error ? (
        <Text style={{ fontFamily: MONO, fontSize: 12, color: '#B91C1C', lineHeight: 20, marginTop: 12 }}>
          {error}
        </Text>
      ) : null}

      {/* Dónde vive esto. Sin decirlo, nadie adivina que el prompt del teléfono
          y el de la web son el mismo — y editarlo acá cambiaría el de allá por
          sorpresa. */}
      <Text style={{ fontFamily: MONO, fontSize: 10.5, color: TENUE, lineHeight: 18, marginTop: 22 }}>
        se guarda en tu cuenta y también rige en la web
      </Text>
    </View>
  );
}
