import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Landmark, Scale } from 'lucide-react-native';
import { COPY } from '../congreso/copy';
import { SECCION, estilos } from '../congreso/estilos';

/**
 * Entrada pública a Congreso y CC, al lado del selector del feed.
 *
 * Van acá y no en otra carpeta porque el feed ya es el lugar de «salir hacia
 * otra lectura» —eso hace SelectorFeed—. Las dos pastillas son destinos, no
 * filtros: llevan a su pestaña, no cambian lo que se lee en esta.
 */
const DESTINOS = [
  { clave: 'congreso', ruta: '/congreso', texto: COPY.congreso.titulo, Icono: Landmark },
  { clave: 'cc', ruta: '/cc', texto: COPY.cc.titulo, Icono: Scale },
];

export default function EnlacesInstitucionales() {
  const router = useRouter();

  return (
    <View style={estilos.enlaces}>
      {DESTINOS.map((d) => {
        const paleta = SECCION[d.clave];
        return (
          <Pressable
            key={d.clave}
            onPress={() => router.push(d.ruta)}
            accessibilityRole="button"
            accessibilityLabel={d.texto}
            style={({ pressed }) => [
              estilos.enlaceChip,
              {
                backgroundColor: paleta.lavado,
                borderColor: paleta.borde,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <d.Icono size={14} color={paleta.tinta} strokeWidth={2.2} />
            <Text style={[estilos.enlaceChipTexto, { color: paleta.tinta }]}>{d.texto}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
