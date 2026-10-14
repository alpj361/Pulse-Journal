import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { INK } from '../theme';
import { SECCIONES, diaCorto, organizar, traerLeyes } from './congreso';
import { Camino, Origen, RAYA, Rotulo, TINTA, Titulo, cabezaDe, rotuloDe } from './TarjetasCongreso';

/**
 * Lo del Congreso de la semana, ordenado por lo que es.
 *
 * El tablero cuenta los días en el orden en que pasaron; esto junta lo mismo
 * por tema: iniciativas, comisiones, pleno, fiscalización y leyes. Una
 * iniciativa que salió varias veces es una sola entrada, con su etapa más
 * avanzada y los días en que se movió.
 */
export default function CongresoOrganizado({ dias, onAbrir }) {
  const secciones = useMemo(() => organizar(dias), [dias]);
  const { data: leyes = [] } = useQuery({ queryKey: ['congreso-leyes'], queryFn: traerLeyes, staleTime: 6 * 60 * 60 * 1000 });

  return (
    <View style={{ marginTop: 14 }}>
      {SECCIONES.map(([clave, nombre]) => {
        const lista = secciones[clave] || [];
        const publicadas = clave === 'leyes' ? leyes : [];
        if (!lista.length && !publicadas.length) return null;
        return (
          <View key={clave} style={{ marginBottom: 26 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', letterSpacing: 1.1, color: INK.title }}>{nombre.toUpperCase()}</Text>
              {lista.length ? <Text style={{ fontSize: 12, color: INK.faint }}>{lista.length}</Text> : null}
            </View>
            {lista.map((item, i) => (
              <Entrada key={item.id} item={item} conCamino={clave === 'iniciativas'} ultima={i === lista.length - 1 && !publicadas.length} onPress={() => onAbrir(item)} />
            ))}
            {publicadas.length ? <Publicadas leyes={publicadas} /> : null}
          </View>
        );
      })}
    </View>
  );
}

function Entrada({ item, conCamino, ultima, onPress }) {
  const { titulo, resumen } = cabezaDe(item);
  const rotulo = rotuloDe(item);
  const pasos = item._pasos || [];
  // Los días en que se movió, sin repetir: «lun 6 · jue 8 · lun 12».
  const dias = [...new Set(pasos.map((p) => p.fecha))].map(diaCorto);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({ paddingVertical: 14, borderBottomWidth: ultima ? 0 : 1, borderBottomColor: RAYA, opacity: pressed ? 0.6 : 1 })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flex: 1 }}>{rotulo ? <Rotulo>{rotulo}</Rotulo> : null}</View>
        <Text style={{ fontSize: 11, color: INK.faint, marginBottom: 5 }}>{dias.join(' · ')}</Text>
      </View>
      <Titulo>{titulo}</Titulo>
      {conCamino ? <Camino etapa={item.stage} /> : null}
      {resumen ? (
        <Text numberOfLines={2} style={{ fontSize: 13, color: INK.body, lineHeight: 19, marginTop: 7 }}>
          {resumen}
        </Text>
      ) : null}
      <Origen item={item} />
    </Pressable>
  );
}

/** Lo último publicado como ley o acuerdo, del registro de normas. */
function Publicadas({ leyes }) {
  return (
    <View style={{ marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: RAYA }}>
      <Rotulo color={INK.faint}>LO ÚLTIMO PUBLICADO</Rotulo>
      {leyes.map((ley) => (
        <View key={ley.id} style={{ paddingVertical: 9 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
            <Text style={{ fontSize: 12.5, fontWeight: '700', color: TINTA }}>{ley.decreto}</Text>
            {ley.fecha_publicacion ? <Text style={{ fontSize: 11, color: INK.faint }}>{ley.fecha_publicacion}</Text> : null}
          </View>
          <Text numberOfLines={3} style={{ fontSize: 13.5, color: INK.title, lineHeight: 19, marginTop: 3 }}>
            {ley.titulo}
          </Text>
        </View>
      ))}
    </View>
  );
}
