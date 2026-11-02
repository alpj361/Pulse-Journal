import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronDown, ChevronUp, FolderPlus, PencilLine, Plus, Trash2 } from 'lucide-react-native';
import { INK } from '../theme';
import { TONO } from './piezas';
import { horaCorta } from './logica';
import { textoDeGrupo } from './actividad';

const ICONO = { crear: Plus, editar: PencilLine, borrar: Trash2, sumar: FolderPlus };
const VISIBLES = 4;

/**
 * Lo que hizo el agente, contado en el chat entre los mensajes: un renglón
 * con su ícono («Creó 5 elementos en tu Codex») y, debajo, cada cosa con su
 * enlace. No es un mensaje: no lleva globo.
 */
export default function AccionAgente({ grupo, onAbrir }) {
  const [todas, setTodas] = useState(false);
  const Icono = ICONO[grupo.verbo] || PencilLine;
  const una = grupo.cosas.length === 1 ? grupo.cosas[0] : null;
  const texto = textoDeGrupo(grupo);
  const lista = una ? [] : grupo.cosas;
  const vistas = todas ? lista : lista.slice(0, VISIBLES);
  return (
    <View style={{ flexDirection: 'row', gap: 9, alignItems: 'flex-start', paddingVertical: 2, paddingRight: 30 }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: TONO.verdeLavado, marginTop: 1 }}>
        <Icono size={12} color={TONO.verde} strokeWidth={2.4} />
      </View>
      <View style={{ flex: 1, gap: 5 }}>
        <Text style={{ fontSize: 13, lineHeight: 18, color: INK.body }}>
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
        </Text>
        {vistas.map((c) =>
          c.ref ? (
            <Pressable key={c.id} onPress={() => onAbrir(c.ref, c.titulo)} accessibilityRole="link" accessibilityLabel={`Abrir ${c.titulo || 'sin título'}`} hitSlop={4}>
              <Text numberOfLines={1} style={{ fontSize: 13, color: TONO.verde, fontWeight: '600', textDecorationLine: 'underline' }}>
                {c.titulo || 'sin título'}
              </Text>
            </Pressable>
          ) : c.titulo ? (
            <Text key={c.id} numberOfLines={1} style={{ fontSize: 13, color: INK.meta }}>{c.titulo}</Text>
          ) : null
        )}
        {lista.length > VISIBLES ? (
          <Pressable onPress={() => setTodas((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: todas }} hitSlop={6}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' }}>
            <Text style={{ fontSize: 12.5, color: INK.meta }}>{todas ? 'ocultar' : `${lista.length - VISIBLES} más`}</Text>
            {todas ? <ChevronUp size={14} color={INK.meta} /> : <ChevronDown size={14} color={INK.meta} />}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
