import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { ChevronDown, ChevronUp, FolderPlus, PencilLine, Plus, Trash2 } from 'lucide-react-native';
import { INK } from '../theme';
import { TONO } from './piezas';
import { horaCorta } from './logica';
import { textoDeGrupo } from './actividad';
import Diamante from '../Diamante';
import { cambiaTexto, entraDiamante, llegaAccion, llegaEnlace, saltaIcono, seVa } from './movimiento';

const ICONO = { crear: Plus, editar: PencilLine, borrar: Trash2, sumar: FolderPlus };
const VISIBLES = 4;

/**
 * Lo que hizo el agente, contado en el chat entre los mensajes: un renglón
 * con su ícono («Creó 5 elementos en tu Codex») y, debajo, cada cosa con su
 * enlace. No es un mensaje: no lleva globo.
 *
 * `nuevo`: llegó con el chat abierto, y entra con su animación. `nuevas`: las
 * cosas que se sumaron a un renglón que ya estaba, que aparecen una a una.
 */
export default function AccionAgente({ grupo, onAbrir, nuevo = false, nuevas }) {
  const [todas, setTodas] = useState(false);
  const Icono = ICONO[grupo.verbo] || PencilLine;
  const una = grupo.cosas.length === 1 ? grupo.cosas[0] : null;
  const texto = textoDeGrupo(grupo);
  const lista = una ? [] : grupo.cosas;
  const vistas = todas ? lista : lista.slice(0, VISIBLES);
  const creciendo = !!nuevas && grupo.cosas.some((c) => nuevas.has(c.ref?.id || c.id));
  return (
    <Animated.View entering={nuevo ? llegaAccion : undefined} style={{ flexDirection: 'row', gap: 9, alignItems: 'flex-start', paddingVertical: 2, paddingRight: 30 }}>
      <Animated.View entering={nuevo ? saltaIcono : undefined} style={{ width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: TONO.verdeLavado, marginTop: 1 }}>
        <Icono size={12} color={TONO.verde} strokeWidth={2.4} />
      </Animated.View>
      <View style={{ flex: 1, gap: 5 }}>
        {/* Si el renglón creció («Creó 4…» → «Creó 5…»), el texto se funde al nuevo. */}
        <Animated.Text key={creciendo ? texto : 'fijo'} entering={creciendo ? cambiaTexto : undefined} style={{ fontSize: 13, lineHeight: 18, color: INK.body }}>
          {una?.ref && una.titulo ? (
            <>
              {texto.split(`«${una.titulo}»`)[0]}
              <Text onPress={() => onAbrir(una.ref, una.titulo)} accessibilityRole="link" style={{ color: TONO.verde, fontWeight: '600', textDecorationLine: 'underline' }}>
                {una.titulo}
              </Text>
              {texto.split(`«${una.titulo}»`)[1]}
            </>
          ) : (
            texto
          )}
          <Text style={{ fontSize: 11, color: INK.faint }}>{`  ${horaCorta(grupo.hasta)}`}</Text>
        </Animated.Text>
        {vistas.map((c) => (
          <Animated.View key={c.id} entering={nuevas?.has(c.ref?.id || c.id) && !nuevo ? llegaEnlace : undefined}>
            {c.ref ? (
              <Pressable onPress={() => onAbrir(c.ref, c.titulo)} accessibilityRole="link" accessibilityLabel={`Abrir ${c.titulo || 'sin título'}`} hitSlop={4}>
                <Text numberOfLines={1} style={{ fontSize: 13, color: TONO.verde, fontWeight: '600', textDecorationLine: 'underline' }}>
                  {c.titulo || 'sin título'}
                </Text>
              </Pressable>
            ) : c.titulo ? (
              <Text numberOfLines={1} style={{ fontSize: 13, color: INK.meta }}>{c.titulo}</Text>
            ) : null}
          </Animated.View>
        ))}
        {lista.length > VISIBLES ? (
          <Pressable onPress={() => setTodas((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: todas }} hitSlop={6}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' }}>
            <Text style={{ fontSize: 12.5, color: INK.meta }}>{todas ? 'ocultar' : `${lista.length - VISIBLES} más`}</Text>
            {todas ? <ChevronUp size={14} color={INK.meta} /> : <ChevronDown size={14} color={INK.meta} />}
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

/**
 * Al final del chat, solo mientras el agente te está respondiendo: un globo
 * suyo, todavía sin texto, con el diamante adentro. Cuando llega la
 * respuesta, el globo se va y entra el mensaje. Lo que hace sin responderte
 * (crear, editar) no va acá: el diamante va arriba, al lado de su nombre.
 */
export function Escribiendo({ nombre }) {
  return (
    <Animated.View
      entering={entraDiamante}
      exiting={seVa}
      style={{
        alignSelf: 'flex-start',
        backgroundColor: TONO.tarjeta,
        borderWidth: 1,
        borderColor: 'rgba(28,43,34,0.08)',
        borderRadius: 18,
        borderBottomLeftRadius: 6,
        paddingVertical: 12,
        paddingHorizontal: 16,
        transformOrigin: 'left bottom',
      }}
    >
      <Diamante size={12} color={TONO.verde} accessibilityLabel={`${nombre} está escribiendo`} />
    </Animated.View>
  );
}
