import { useStore } from 'zustand';
import { textoDe } from '../../../documento/editor';
import AutocompletarCodex from '../AutocompletarCodex';

/**
 * El autocompletado del Codex sobre el bloque donde está el cursor.
 *
 * Es el mismo panel de la nota vieja; cambia de dónde lee. Va en su propio
 * componente para que cada movimiento del cursor vuelva a pintar esto y no la
 * hoja entera.
 */
export default function AutocompletarBloques({ editor, indice, onAbrirItem, bottomInset }) {
  const cursor = useStore(editor, (s) => s.seleccion.start);
  const texto = useStore(editor, (s) => textoDe(s.estado.porKey[s.seleccion.key]?.children));
  return (
    <AutocompletarCodex
      indice={indice}
      texto={texto}
      cursor={cursor}
      onCompletar={(item) => editor.getState().completar(item?.name)}
      onAbrirItem={onAbrirItem}
      bottomInset={bottomInset}
    />
  );
}
