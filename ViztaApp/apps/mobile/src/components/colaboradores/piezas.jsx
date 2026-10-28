import { useState } from 'react';
import { Pressable, RefreshControl, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { INK, SERIF } from '../theme';
import { TEMAS } from '../feed/temas';
import MorphingInfinity from '../MorphingInfinity';

export const TONO = {
  verde: TEMAS.Social.tinta,
  verdeLavado: TEMAS.Social.lavado[0],
  ladrillo: TEMAS.Violencia.marca,
  ladrilloTinta: TEMAS.Violencia.tinta,
  ladrilloLavado: TEMAS.Violencia.lavado[0],
  rojo: '#B23A2E',
  arena: TEMAS.Economía.tinta,
  arenaLavado: TEMAS.Economía.lavado[0],
  raya: 'rgba(28,43,34,0.07)',
  borde: 'rgba(28,43,34,0.12)',
  tarjeta: 'rgba(255,255,255,0.86)',
};
/**
 * «Tirar para refrescar» que gira solo cuando la persona tira. Las consultas
 * se actualizan solas cada tanto; si la ruedita siguiera a esas, la pantalla
 * saltaría sola.
 */
export function Refrescar({ onRefresh, ...props }) {
  const [tirando, setTirando] = useState(false);
  const refrescar = async () => {
    setTirando(true);
    try {
      await onRefresh?.();
    } finally {
      setTirando(false);
    }
  };
  return <RefreshControl refreshing={tirando} onRefresh={refrescar} tintColor={INK.meta} {...props} />;
}

export const ROTULO = { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.1, color: INK.faint };

/**
 * Quién ve la puerta a Colaboradores: con sesión y rol alfa, beta o admin. Es
 * el mismo criterio del servidor (`esAlfaOBetaOAdmin`), que tampoco cuenta el
 * «alpha» en inglés. El servidor corta igual.
 */
export function puedeColaborar(usuario) {
  if (!usuario?.id) return false;
  const lista = [usuario.role, ...(usuario.roles || [])].filter(Boolean).map((r) => String(r).toLowerCase());
  return lista.some((r) => ['alfa', 'beta', 'admin'].includes(r));
}

/** Iniciales para el avatar: «Investigador» → «In». */
export const iniciales = (nombre) => String(nombre || '?').trim().slice(0, 2);

/** Agente: cuadro con iniciales. Persona: círculo. */
export function Avatar({ tipo, nombre, size = 50 }) {
  const persona = tipo === 'humano';
  const tema = persona ? TEMAS.Economía : TEMAS.Política;
  return (
    <View
      accessible={false}
      style={{
        width: size,
        height: size,
        borderRadius: persona ? size / 2 : size * 0.28,
        backgroundColor: tema.lavado[1],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: SERIF, fontSize: size * 0.5, color: tema.tinta }}>{iniciales(nombre)}</Text>
    </View>
  );
}

/** El nombre que se muestra: el de la cuenta, o qué es. */
export const nombreDe = (c) => c?.nombre || (c?.cuenta_tipo === 'humano' ? 'Colega' : 'Agente');

/** Volver, avatar, nombre y una acción a la derecha. */
export function Cabecera({ colaborador, subtitulo, onVolver, volverLabel = 'Volver', derecha, onTocar, topInset = 0 }) {
  return (
    <View style={{ paddingTop: topInset + 10, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Pressable
        onPress={onVolver}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={volverLabel}
        style={({ pressed }) => ({ width: 44, height: 44, marginLeft: -10, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}
      >
        <ChevronLeft size={24} color={INK.title} strokeWidth={2} />
      </Pressable>
      {/* Con `onTocar`, el nombre abre su perfil. */}
      <Pressable
        onPress={onTocar}
        disabled={!onTocar}
        accessibilityRole={onTocar ? 'button' : undefined}
        accessibilityHint={onTocar ? 'Abrir su perfil' : undefined}
        style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.6 : 1 })}
      >
        <Avatar tipo={colaborador?.cuenta_tipo} nombre={nombreDe(colaborador)} size={40} />
        <View style={{ flex: 1, gap: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: INK.title, flexShrink: 1 }} numberOfLines={1}>
              {nombreDe(colaborador)}
            </Text>
            {onTocar ? <ChevronRight size={16} color={INK.meta} strokeWidth={2} /> : null}
          </View>
          {subtitulo ? (
            <Text style={{ fontSize: 12, color: INK.meta }} numberOfLines={1}>
              {subtitulo}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {derecha}
    </View>
  );
}

/** Botón de la app: `primario` en tinta, el resto con borde. `Icono` va después del texto. */
export function Boton({ texto, onPress, primario, peligro, cargando, disabled, alto = 46, style, accessibilityLabel, Icono }) {
  const apagado = disabled || cargando;
  return (
    <Pressable
      onPress={onPress}
      disabled={apagado}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || texto}
      accessibilityState={{ disabled: !!apagado, busy: !!cargando }}
      style={({ pressed }) => [
        {
          height: alto,
          paddingHorizontal: 18,
          borderRadius: 14,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: primario ? INK.title : 'transparent',
          borderWidth: primario || peligro ? 0 : 1,
          borderColor: 'rgba(28,43,34,0.16)',
          opacity: apagado ? 0.45 : pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      {cargando ? (
        <MorphingInfinity size={18} color={primario ? '#FFFFFF' : INK.title} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 15, fontWeight: primario ? '700' : '600', color: primario ? '#FFFFFF' : peligro ? TONO.rojo : INK.title }}>
            {texto}
          </Text>
          {Icono ? <Icono size={16} strokeWidth={2} color={primario ? '#FFFFFF' : peligro ? TONO.rojo : INK.title} /> : null}
        </View>
      )}
    </Pressable>
  );
}

/** Chip chico de estado: «2 por aprobar», «conexión antigua». */
export function Chip({ texto, tinta = TONO.ladrilloTinta, fondo = TONO.ladrilloLavado }) {
  return (
    <View style={{ backgroundColor: fondo, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: tinta }}>{texto}</Text>
    </View>
  );
}

/** Estado de pantalla entera: título en serif, una línea y, si hay, una acción. */
export function EstadoCentro({ icono, titulo, texto, children }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 28 }}>
      {icono}
      <Text style={{ fontFamily: SERIF, fontSize: 25, lineHeight: 29, color: INK.title, textAlign: 'center' }}>{titulo}</Text>
      {texto ? (
        <Text style={{ fontSize: 14, lineHeight: 20, color: INK.body, textAlign: 'center' }}>{texto}</Text>
      ) : null}
      {children ? <View style={{ marginTop: 6, gap: 8, alignItems: 'center' }}>{children}</View> : null}
    </View>
  );
}
