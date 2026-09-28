import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { INK, ACCENT } from '../theme';
import { supabase } from '../../utils/supabase';
import { roce, falla } from '../../utils/haptics';
import { rastreoDe } from './menciones';
import { invalidarIndice } from './useIndiceCodex';

/**
 * Los ajustes de un item: cómo se lo encuentra en lo que se escribe.
 *
 * Tres interruptores, los mismos que lee la base (`codex_terminos_de`) y el
 * resaltado de las notas (`menciones.js`), así que lo que se marca acá cambia
 * a la vez el color en la nota, la pestaña «Menciones» y el grafo.
 *
 * Cada cambio se guarda en el acto: es un ajuste, no un campo de la ficha, y
 * no tiene sentido que dependa de «Guardar».
 */
export default function AjustesItem({ dbId, nombre, rastreoInicial, onCambio }) {
  const [rastreo, setRastreo] = useState(() => rastreoDe({ rastreo: rastreoInicial }));
  const [listo, setListo] = useState(!!rastreoInicial);
  const [error, setError] = useState(null);

  // Las listas no traen `rastreo`; se lee de la fila para no mostrar un valor
  // por defecto que no es el guardado.
  useEffect(() => {
    if (!dbId) return undefined;
    let vivo = true;
    supabase
      .from('codex_universe_items')
      .select('rastreo')
      .eq('id', dbId)
      .maybeSingle()
      .then(({ data }) => {
        if (!vivo) return;
        if (data) setRastreo(rastreoDe(data));
        setListo(true);
      });
    return () => {
      vivo = false;
    };
  }, [dbId]);

  const cambiar = async (clave, valor) => {
    roce();
    const antes = rastreo;
    const nuevo = { ...rastreo, [clave]: valor };
    setRastreo(nuevo);
    setError(null);
    const { error: err } = await supabase.from('codex_universe_items').update({ rastreo: nuevo }).eq('id', dbId);
    if (err) {
      falla();
      setRastreo(antes);
      setError('No se pudo guardar el cambio');
      return;
    }
    // Las notas abiertas después de esto ya lo resaltan con la regla nueva.
    invalidarIndice();
    onCambio?.(nuevo);
  };

  const enMinuscula = String(nombre || '').toLowerCase();
  const ejemplo = nombre && enMinuscula !== nombre ? `«${nombre}», no «${enMinuscula}»` : null;

  return (
    <View>
      <Fila
        titulo="encontrarlo cuando se lo menciona"
        valor={rastreo.activo}
        onCambiar={(v) => cambiar('activo', v)}
        disabled={!listo}
      />
      <Fila
        titulo="también por sus otros nombres"
        valor={rastreo.alias}
        onCambiar={(v) => cambiar('alias', v)}
        disabled={!listo || !rastreo.activo}
      />
      <Fila
        titulo="solo si está escrito con las mismas mayúsculas"
        detalle={ejemplo}
        valor={rastreo.mayusculas}
        onCambiar={(v) => cambiar('mayusculas', v)}
        disabled={!listo || !rastreo.activo}
        ultima
      />
      {error ? <Text style={{ fontSize: 12.5, color: '#B91C1C', marginTop: 10 }}>{error}</Text> : null}
    </View>
  );
}

function Fila({ titulo, detalle, valor, onCambiar, disabled, ultima }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 13,
        borderBottomWidth: ultima ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: 'rgba(28,43,34,0.08)',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14.5, color: INK.body }}>{titulo}</Text>
        {detalle ? <Text style={{ fontSize: 12, color: INK.faint, marginTop: 3 }}>{detalle}</Text> : null}
      </View>
      <Switch
        value={valor}
        onValueChange={onCambiar}
        disabled={disabled}
        trackColor={{ false: 'rgba(28,43,34,0.14)', true: ACCENT.indigo.ink }}
        thumbColor="#FFFFFF"
        accessibilityLabel={titulo}
      />
    </View>
  );
}
