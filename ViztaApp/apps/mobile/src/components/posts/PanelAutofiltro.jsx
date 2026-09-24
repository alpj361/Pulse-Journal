import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { INK, RADIUS } from '../theme';
import { MONO } from '../codex/mono';
import { RESALTADOR, TENUE } from '../codex/piezasCarpeta';
import { roce } from '../../utils/haptics';

// Cuántos valores se ven de entrada por grupo. Con más posts los temas
// repetidos crecen, y un grupo abierto de treinta chips empuja la galería fuera
// de la pantalla justo cuando se quiere ver qué dejó el filtro.
const VISIBLES = 10;

/**
 * El panel del autofiltro: un renglón por grupo y sus valores como chips.
 *
 * Cada chip lleva cuántos posts tiene. No es decoración: es lo que dice si vale
 * la pena tocarlo, y lo que hace que «Guatemala 7 · Haití 1» cuente de un
 * vistazo de qué hablan los posts sin abrir ninguno.
 *
 * Tocar un valor lo elige; tocarlo de nuevo lo suelta. Un valor por grupo, y
 * los grupos se suman: país y tema a la vez son los posts que tienen los dos.
 */
export default function PanelAutofiltro({ facetas, seleccion, onElegir }) {
  const [abiertos, setAbiertos] = useState({});

  return (
    <View style={{ marginTop: 8, marginBottom: 4, gap: 18 }}>
      {facetas.map((f) => {
        const abierto = abiertos[f.id];
        // El elegido siempre a la vista, aunque esté más allá del corte: si no,
        // quedaría filtrando algo que no se ve en el panel.
        const visibles = abierto
          ? f.valores
          : f.valores.filter((v, i) => i < VISIBLES || seleccion[f.id] === v.clave);
        const restantes = f.valores.length - visibles.length;

        return (
          <View key={f.id}>
            <Text style={{ fontFamily: MONO, fontSize: 11.5, color: TENUE, marginBottom: 9 }}>{f.titulo}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
              {visibles.map((v) => {
                const activo = seleccion[f.id] === v.clave;
                return (
                  <Pressable
                    key={v.clave}
                    onPress={() => {
                      roce();
                      onElegir(f.id, activo ? null : v.clave);
                    }}
                    hitSlop={4}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: RADIUS.pill,
                      borderWidth: 1,
                      borderColor: activo ? 'rgba(28,43,34,0.3)' : 'rgba(28,43,34,0.1)',
                      backgroundColor: activo ? RESALTADOR : pressed ? 'rgba(28,43,34,0.04)' : 'transparent',
                    })}
                    accessibilityRole="button"
                    accessibilityState={{ selected: activo }}
                    accessibilityLabel={`${f.titulo}: ${v.etiqueta}, ${v.posts} ${v.posts === 1 ? 'post' : 'posts'}`}
                  >
                    <Text style={{ fontFamily: MONO, fontSize: 12, color: activo ? INK.title : INK.body }}>{v.etiqueta}</Text>
                    <Text style={{ fontFamily: MONO, fontSize: 11, color: TENUE }}>{v.posts}</Text>
                  </Pressable>
                );
              })}

              {restantes > 0 || abierto ? (
                <Pressable
                  onPress={() => {
                    roce();
                    setAbiertos((a) => ({ ...a, [f.id]: !a[f.id] }));
                  }}
                  hitSlop={6}
                  style={{ paddingHorizontal: 6, paddingVertical: 5, justifyContent: 'center' }}
                  accessibilityRole="button"
                  accessibilityLabel={abierto ? `Mostrar menos de ${f.titulo}` : `Mostrar ${restantes} más de ${f.titulo}`}
                >
                  <Text style={{ fontFamily: MONO, fontSize: 12, color: TENUE }}>
                    {abierto ? '— menos' : `+ ${restantes}`}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
