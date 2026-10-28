import { createContext, useContext } from 'react';

/**
 * Un post que se mira y no se toca: el que alguien compartió en un chat.
 * Se ve igual, pero sin pedir el análisis ni guardar o conectar nada; eso le
 * toca a quien lo guarda en su Codex.
 */
export const SoloLecturaPost = createContext(false);
export const useSoloLecturaPost = () => useContext(SoloLecturaPost);
