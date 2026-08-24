import { Platform } from 'react-native';

/**
 * La monoespaciada de la nota.
 *
 * Vive en su propio archivo porque la usan la hoja de escritura, el historial y
 * el panel de menciones. Estaba declarada dentro de CreateSnippetSheet, y las
 * otras dos páginas tendrían que importarla desde ahí — o, peor, redeclararla y
 * que un día dejen de coincidir.
 */
export const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });
