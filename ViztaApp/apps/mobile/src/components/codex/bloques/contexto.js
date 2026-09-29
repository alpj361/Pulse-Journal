import { createContext, useContext } from 'react';

/**
 * Lo adjunto a la nota, para los bloques de medio: las fotos, los audios y
 * los documentos viven en la hoja (se suben, se firman, se quitan ahí), y el
 * bloque que los muestra en medio del texto los busca acá por su ruta.
 */
export const MediosContexto = createContext({
  fotos: [],
  audios: [],
  documentos: [],
  onVerFoto: null,
  onAbrirDocumento: null,
});

export const useMedios = () => useContext(MediosContexto);
