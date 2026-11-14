import { useState } from 'react';
import { Keyboard, Pressable, Text, TextInput, View } from 'react-native';
import { Search, X } from 'lucide-react-native';
import { INK, RADIUS } from '../theme';
import { MONO } from '../codex/mono';
import { RESALTADOR, TENUE } from '../codex/piezasCarpeta';
import { roce } from '../../utils/haptics';
import { coincide } from './autofiltro';

// Cuántos valores se ven de entrada por grupo. Con más posts los temas
// repetidos crecen, y un grupo abierto de treinta chips empuja la galería fuera
// de la pantalla justo cuando se quiere ver qué dejó el filtro.
const VISIBLES = 10;
// Un grupo con buscador (cuenta) muestra menos de entrada: las más repetidas, y
// el resto se encuentra escribiendo. Con decenas de cuentas de a un post, una
// pared de chips no se recorre; un nombre se escribe.
const VISIBLES_BUSCABLE = 6;
const MAX_ENCONTRADOS = 30;

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
  const [textos, setTextos] = useState({});

  return (
    <View style={{ marginTop: 8, marginBottom: 4, gap: 18 }}>
      {facetas.map((f) => {
        const abierto = abiertos[f.id];
        const texto = textos[f.id] || '';
        const buscador = f.buscable && f.valores.length > VISIBLES_BUSCABLE;
        // El elegido siempre a la vista, aunque esté más allá del corte: si no,
        // quedaría filtrando algo que no se ve en el panel.
        const elegido = (v) => seleccion[f.id] === v.clave;
        const visibles = texto.trim()
          ? f.valores.filter((v) => elegido(v) || coincide(v, texto)).slice(0, MAX_ENCONTRADOS)
          : abierto
            ? f.valores
            : f.valores.filter((v, i) => i < (buscador ? VISIBLES_BUSCABLE : VISIBLES) || elegido(v));
        const restantes = texto.trim() ? 0 : f.valores.length - visibles.length;

        return (
          <View key={f.id}>
            <Text style={{ fontFamily: MONO, fontSize: 11.5, color: TENUE, marginBottom: 9 }}>{f.titulo}</Text>
            {buscador ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 10,
                  paddingHorizontal: 10,
                  height: 34,
                  borderRadius: RADIUS.pill,
                  borderWidth: 1,
                  borderColor: 'rgba(28,43,34,0.1)',
                }}
              >
                <Search size={14} color={TENUE} />
                <TextInput
                  value={texto}
                  onChangeText={(t) => setTextos((x) => ({ ...x, [f.id]: t }))}
                  placeholder={`buscar entre ${f.valores.length} cuentas`}
                  placeholderTextColor={TENUE}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                  accessibilityLabel={`Buscar ${f.titulo}`}
                  style={{ flex: 1, fontFamily: MONO, fontSize: 12.5, color: INK.title, paddingVertical: 0 }}
                />
                {texto ? (
                  <Pressable onPress={() => setTextos((x) => ({ ...x, [f.id]: '' }))} hitSlop={8} accessibilityRole="button" accessibilityLabel="Borrar la búsqueda">
                    <X size={14} color={TENUE} />
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
              {visibles.map((v) => {
                const activo = seleccion[f.id] === v.clave;
                return (
                  <Pressable
                    key={v.clave}
                    onPress={() => {
                      roce();
                      // Elegida la cuenta, el teclado se va: lo que se quiere ver ahora son sus posts.
                      if (f.buscable) Keyboard.dismiss();
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

              {texto.trim() && !visibles.length ? (
                <Text style={{ fontFamily: MONO, fontSize: 12, color: TENUE, paddingVertical: 5 }}>ninguna cuenta con ese nombre</Text>
              ) : null}

              {restantes > 0 || (abierto && !texto.trim()) ? (
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
