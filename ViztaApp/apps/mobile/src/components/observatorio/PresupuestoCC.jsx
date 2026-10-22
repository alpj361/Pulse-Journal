import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { INK } from '../theme';
import { RAYA, Rotulo, TINTA } from '../feed/TarjetasCongreso';
import IconoCC from './IconoCC';
import { quetzales, traerPresupuesto } from './observatorio';

/**
 * El presupuesto del Estado, año por año.
 *
 * Una barra por año con lo que de verdad rigió (el vigente, con ampliaciones;
 * si no hay, el aprobado). Tocar un año abre su ficha: con qué decreto, en
 * qué estado, cuánto del PIB y a dónde fue. Un presupuesto que se aprobó y
 * quedó suspendido no cuenta en la serie —no rigió—: va en la ficha de su año,
 * no como barra. El proyecto del año que viene va sin relleno.
 */
const ESTADO_ICONO = {
  vigente: 'VIGENTE',
  reconducido: 'RECONDUCIDO',
  aprobado_suspendido: 'APROBADO_Y_SUSPENDIDO',
  proyecto: 'PROYECTO_EN_DISCUSION',
};

const INSTITUCION = {
  obligaciones: 'Obligaciones del Estado',
  mineduc: 'Educación',
  deuda: 'Deuda pública',
  mspas: 'Salud',
  micivi: 'Comunicaciones e infraestructura',
  mingob: 'Gobernación',
  mindef: 'Defensa',
  mides: 'Desarrollo Social',
  secretarias: 'Secretarías',
  mintrab: 'Trabajo',
  maga: 'Agricultura',
  minex: 'Relaciones Exteriores',
  mcd: 'Cultura y Deportes',
  mineco: 'Economía',
  minfin: 'Finanzas',
  marn: 'Ambiente',
  mem: 'Energía y Minas',
  pgn: 'PGN',
  presidencia: 'Presidencia',
};

const valorDe = (f) => Number(f.vigente ?? f.total) || 0;

export default function PresupuestoCC() {
  const { data: filas = [], isLoading, error } = useQuery({ queryKey: ['cc-presupuesto'], queryFn: traerPresupuesto, staleTime: 6 * 3600e3 });
  // La serie: un año, una barra. El proyecto del año que viene entra al final.
  const serie = useMemo(
    () => filas.filter((f) => f.cuenta_en_serie || f.estado === 'proyecto').sort((a, b) => a.anio - b.anio),
    [filas]
  );
  const [anio, setAnio] = useState(null);
  const elegido = serie.find((f) => f.anio === anio) || serie.filter((f) => f.estado !== 'proyecto').slice(-1)[0];

  if (isLoading) return <Text style={{ fontSize: 13, color: INK.faint, paddingVertical: 20 }}>Trayendo el presupuesto…</Text>;
  if (error || !serie.length) return <Text style={{ fontSize: 13, color: INK.faint, paddingVertical: 20 }}>No se pudo traer el presupuesto.</Text>;

  const mayor = Math.max(...serie.map(valorDe), 1);
  const otros = filas.filter((f) => f.anio === elegido?.anio && f !== elegido && !f.cuenta_en_serie && f.estado !== 'proyecto');

  return (
    <View style={{ marginTop: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 130, gap: 3 }}>
        {serie.map((f) => {
          const activo = f === elegido;
          const proyecto = f.estado === 'proyecto';
          return (
            <Pressable
              key={`${f.anio}-${f.decreto}`}
              onPress={() => setAnio(f.anio)}
              accessibilityRole="button"
              accessibilityLabel={`${f.anio}: ${quetzales(valorDe(f))}`}
              style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}
            >
              <View
                style={{
                  height: `${Math.max(3, (valorDe(f) / mayor) * 100)}%`,
                  borderRadius: 3,
                  borderWidth: proyecto ? 1.2 : 0,
                  borderStyle: 'dashed',
                  borderColor: TINTA,
                  backgroundColor: proyecto ? 'transparent' : activo ? TINTA : 'rgba(47,74,122,0.32)',
                }}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 }}>
        <Text style={{ fontSize: 10.5, color: INK.faint }}>{serie[0].anio}</Text>
        <Text style={{ fontSize: 10.5, color: INK.faint }}>{serie[serie.length - 1].anio}</Text>
      </View>

      {elegido ? <Ficha f={elegido} otros={otros} /> : null}
    </View>
  );
}

function Ficha({ f, otros }) {
  const instituciones = Object.entries(f.instituciones || {})
    .filter(([, v]) => Number(v) > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const mayor = instituciones[0]?.[1] || 1;
  return (
    <View style={{ marginTop: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconoCC codigo={ESTADO_ICONO[f.estado]} size={48} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 26, fontWeight: '800', color: INK.title, letterSpacing: -0.6 }}>{f.anio}</Text>
          <Text style={{ fontSize: 13, color: INK.body }}>
            {f.etiqueta}
            {f.decreto && f.decreto !== 'Proyecto' ? ` · Decreto ${f.decreto}` : ''}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 18, marginTop: 14 }}>
        <Cifra nombre={f.vigente ? 'Vigente' : 'Total'} valor={quetzales(valorDe(f))} />
        {f.pct_pib_vigente ?? f.pct_pib ? <Cifra nombre="Del PIB" valor={`${Number(f.pct_pib_vigente ?? f.pct_pib).toFixed(1)}%`} /> : null}
        {f.var_real_vigente != null ? (
          <Cifra nombre="Contra el año anterior" valor={`${f.var_real_vigente > 0 ? '+' : ''}${Number(f.var_real_vigente).toFixed(1)}% real`} />
        ) : null}
      </View>
      {f.ampliaciones_n ? (
        <Text style={{ fontSize: 12.5, color: INK.faint, marginTop: 8 }}>
          {f.ampliaciones_n} ampliaciones por {quetzales(f.ampliaciones)}
        </Text>
      ) : null}

      {f.nota ? <Text style={{ fontSize: 13.5, color: INK.body, lineHeight: 20, marginTop: 12 }}>{f.nota}</Text> : null}

      {otros.map((o) => (
        <View key={o.decreto} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, padding: 10, borderRadius: 12, backgroundColor: 'rgba(28,43,34,0.04)' }}>
          <IconoCC codigo={ESTADO_ICONO[o.estado]} size={32} />
          <Text style={{ flex: 1, fontSize: 12.5, color: INK.body, lineHeight: 18 }}>
            Decreto {o.decreto}: {String(o.etiqueta || '').toLowerCase()}, por {quetzales(o.total)}. No rigió.
          </Text>
        </View>
      ))}

      {instituciones.length ? (
        <View style={{ marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: RAYA }}>
          <Rotulo color={INK.faint}>A DÓNDE VA</Rotulo>
          {instituciones.map(([k, v]) => (
            <View key={k} style={{ marginTop: 8 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 13, color: INK.title }}>{INSTITUCION[k] || k}</Text>
                <Text style={{ fontSize: 12, color: INK.faint }}>{quetzales(v)}</Text>
              </View>
              <View style={{ height: 5, borderRadius: 3, backgroundColor: 'rgba(28,43,34,0.06)', marginTop: 4 }}>
                <View style={{ width: `${(v / mayor) * 100}%`, height: 5, borderRadius: 3, backgroundColor: TINTA }} />
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Cifra({ nombre, valor }) {
  return (
    <View>
      <Text style={{ fontSize: 16, fontWeight: '700', color: INK.title }}>{valor}</Text>
      <Text style={{ fontSize: 11.5, color: INK.faint }}>{nombre}</Text>
    </View>
  );
}
