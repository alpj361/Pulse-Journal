import { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import GlassCard from '../GlassCard';
import { INK, ACCENT } from '../theme';
import { useUsoStore, refrescarUso } from '../../state/usoStore';

/**
 * Cuánto llevás usado.
 *
 * Dos grupos, porque son dos cosas distintas: lo que se gasta y vuelve cada
 * semana (posts que traés, análisis, minutos de video, búsquedas, Vizta) y lo
 * que se va juntando (posts guardados, espacios, almacenamiento). Mezclados en
 * una sola lista, un «5 de 50» al lado de un «77» no se entiende.
 *
 * La base decide qué filas hay (`get_my_usage`): a quien su plan no le da cupo
 * por semana no le aparece ese grupo. Cada fila dice cuánto va de cuánto; un
 * área sin tope muestra el número solo, porque una barra que nunca se llena no
 * dice nada. Los admins tienen los mismos topes que cualquiera.
 */

const NOMBRE = { posts: 'Posts guardados', espacios: 'Espacios', almacenamiento: 'Almacenamiento' };

const NOMBRE_SEMANA = {
  posts: 'Posts nuevos',
  analisis: 'Análisis',
  minutos: 'Video y audio',
  busquedas: 'Búsquedas',
  vizta: 'Vizta',
};

/** Bytes en algo que se lee de un vistazo. */
function pesa(bytes) {
  const n = Number(bytes) || 0;
  if (n >= 1073741824) return `${(n / 1073741824).toFixed(1)} GB`;
  if (n >= 1048576) return `${Math.round(n / 1048576)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

/** «5 de 50», «12 MB de 300 MB», «40 de 75 min», o el número solo si no hay tope. */
function cuanto(area, deLaSemana) {
  const usado = Number(area.usado) || 0;
  // Vizta se mide en costo, que no es un número para mostrarle a nadie.
  if (deLaSemana && area.clave === 'vizta') return `${area.porcentaje ?? 0}%`;
  if (area.clave === 'almacenamiento') {
    return area.limite != null ? `${pesa(usado)} de ${pesa(area.limite)}` : pesa(usado);
  }
  if (area.limite == null) return String(usado);
  const cola = deLaSemana && area.clave === 'minutos' ? ' min' : '';
  return `${Math.min(usado, area.limite)} de ${area.limite}${cola}`;
}

function Fila({ area, deLaSemana }) {
  const nombre = (deLaSemana ? NOMBRE_SEMANA : NOMBRE)[area.clave] || area.clave;
  return (
    <View style={{ marginTop: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text style={{ flex: 1, fontSize: 14, color: INK.title }}>{nombre}</Text>
        <Text style={{ fontSize: 13, fontWeight: '700', color: INK.title }}>{cuanto(area, deLaSemana)}</Text>
      </View>
      {area.porcentaje != null ? (
        <View
          style={{
            height: 6,
            borderRadius: 3,
            backgroundColor: 'rgba(28,43,34,0.08)',
            marginTop: 8,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              // Con cero no se pinta nada: un pedacito de barra diría que ya gastaste.
              width: area.porcentaje > 0 ? `${Math.max(2, area.porcentaje)}%` : 0,
              height: '100%',
              borderRadius: 3,
              backgroundColor: area.porcentaje >= 90 ? ACCENT.red.ink : ACCENT.indigo.ink,
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

function Grupo({ titulo, nota, children }) {
  return (
    <View style={{ marginTop: titulo ? 18 : 2 }}>
      {titulo ? (
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: INK.meta, letterSpacing: 1.1 }}>
            {titulo}
          </Text>
          {nota ? <Text style={{ fontSize: 12, color: INK.faint }}>{nota}</Text> : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** «hasta el lunes»: el día en que la semana vuelve a empezar. */
function hasta(reinicia) {
  if (!reinicia) return null;
  const dia = new Date(reinicia).toLocaleDateString('es-GT', { weekday: 'long' });
  return `hasta el ${dia}`;
}

export default function SeccionUso() {
  const [abierto, setAbierto] = useState(false);
  const uso = useUsoStore((s) => s.uso);

  useEffect(() => {
    if (abierto) refrescarUso({ forzar: true });
  }, [abierto]);

  const areas = uso?.areas || [];
  const semana = uso?.semana || [];
  // Lo más gastado resume el renglón plegado; sin topes, no se resume nada.
  const tope = [...semana, ...areas].reduce(
    (alto, a) => (a.porcentaje != null && a.porcentaje > alto ? a.porcentaje : alto),
    -1,
  );

  return (
    <View style={{ marginBottom: 24 }}>
      <GlassCard radius={16}>
        <TouchableOpacity
          onPress={() => setAbierto((v) => !v)}
          style={{ flexDirection: 'row', alignItems: 'center', padding: 18 }}
          activeOpacity={0.7}
        >
          <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: INK.title, lineHeight: 20 }}>Uso</Text>
          {tope >= 0 ? (
            <Text style={{ fontSize: 13, color: INK.faint, marginRight: 10 }}>{tope}%</Text>
          ) : null}
          {abierto ? <ChevronUp size={17} color={INK.meta} /> : <ChevronDown size={17} color={INK.meta} />}
        </TouchableOpacity>

        {abierto && (
          <View
            style={{
              paddingHorizontal: 18,
              paddingBottom: 18,
              borderTopWidth: 1,
              borderColor: 'rgba(28,43,34,0.08)',
            }}
          >
            {semana.length ? (
              <Grupo titulo="ESTA SEMANA" nota={hasta(uso?.reinicia)}>
                {semana.map((area) => (
                  <Fila key={area.clave} area={area} deLaSemana />
                ))}
              </Grupo>
            ) : null}
            <Grupo titulo={semana.length ? 'EN TOTAL' : null}>
              {areas.map((area) => (
                <Fila key={area.clave} area={area} />
              ))}
            </Grupo>
          </View>
        )}
      </GlassCard>
    </View>
  );
}
