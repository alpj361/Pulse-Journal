import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Renderer } from '@openuidev/react-lang';
import ItemDetailSheet from '../codex/ItemDetailSheet';
import { INK } from '../theme';
import MorphingInfinity from '../MorphingInfinity';
import { catalogo, VisualContexto } from './catalogo';
import { buscarItems, idsDe, traerItems } from './datos';

/**
 * Las herramientas que un programa puede llamar con `Query(...)`. Es lo que
 * hace a una vista viva: en vez de dejar la lista escrita, la vista vuelve a
 * buscar al abrirse (y cada tanto, si el agente le puso intervalo).
 */
export const HERRAMIENTAS = {
  codex_buscar: async (args = {}) => ({ items: await buscarItems(args) }),
  codex_items: async (args = {}) => ({ items: await traerItems(idsDe(args.ids)) }),
};

/**
 * Una vista de Vizta: un programa de OpenUI Lang dibujado con el catálogo
 * propio, en nativo. Tocar a alguien abre su ficha encima.
 */
export default function VistaVizta({ programa, entidades = null, relaciones = null, bottomInset = 0, enStreaming = false, onErrores }) {
  const [abierto, setAbierto] = useState(null);
  const contexto = useMemo(
    () => ({
      onEntidad: (item) => setAbierto(item),
      entidades: Array.isArray(entidades) && entidades.length ? new Map(entidades.map((e) => [e.id, e])) : null,
      relaciones: relaciones && typeof relaciones === 'object' ? relaciones : null,
    }),
    [entidades, relaciones]
  );

  return (
    <VisualContexto.Provider value={contexto}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: bottomInset + 32 }}>
        <Renderer
          response={programa}
          library={catalogo}
          isStreaming={enStreaming}
          toolProvider={HERRAMIENTAS}
          queryLoader={
            <View style={{ paddingVertical: 24, alignItems: 'center' }}>
              <MorphingInfinity size={24} color={INK.meta} />
            </View>
          }
          onError={onErrores}
        />
      </ScrollView>
      {abierto ? <ItemDetailSheet item={abierto} soloLectura bottomInset={bottomInset} onClose={() => setAbierto(null)} /> : null}
    </VisualContexto.Provider>
  );
}
