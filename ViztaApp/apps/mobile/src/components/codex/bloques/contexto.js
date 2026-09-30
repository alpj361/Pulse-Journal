import { createContext, useContext } from 'react';

/**
 * Lo adjunto a la nota, para los bloques de medio: las fotos, los audios y
 * los documentos viven en la hoja (se suben, se firman, se quitan ahí), y el
 * bloque que los muestra en medio del texto los busca acá por su ruta.
 *
 * También lo que un bloque necesita saber de la nota entera: si es la
 * historia de un espacio y con qué dataset, para que un datasheet pueda
 * ofrecerse como la historia (`usarComoHistoria(id, nombre)`).
 */
export const MediosContexto = createContext({
  fotos: [],
  audios: [],
  documentos: [],
  onVerFoto: null,
  onAbrirDocumento: null,
  esHistoria: false,
  historiaDataset: null,
  usarComoHistoria: null,
});

export const useMedios = () => useContext(MediosContexto);
