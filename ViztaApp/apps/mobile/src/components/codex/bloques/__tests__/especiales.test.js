import { lenguajeDe, resaltar } from '../resaltarCodigo';
import { caminoDeTrazo, simplificar, trazoParaGuardar } from '../trazos';

describe('resaltar código', () => {
  test('los tramos juntos son el texto tal cual', () => {
    const codigo = 'const a = "<b>" && 1; // fin';
    const tramos = resaltar(codigo, 'js');
    expect(tramos.map((t) => t.texto).join('')).toBe(codigo);
    expect(tramos.some((t) => t.color)).toBe(true);
  });

  test('alias y lenguaje desconocido', () => {
    expect(lenguajeDe('PY')).toBe('python');
    expect(lenguajeDe('cobol')).toBeNull();
    const t = resaltar('select 1', 'cobol');
    expect(t.map((x) => x.texto).join('')).toBe('select 1');
    expect(resaltar('', 'js')).toEqual([]);
  });
});

describe('trazos', () => {
  test('se guardan normalizados y con menos puntos', () => {
    const recta = Array.from({ length: 50 }, (_, i) => [i * 4, i * 2, 0.5]);
    const t = trazoParaGuardar(recta, 200, { color: '#000' });
    expect(t.puntos.length).toBe(2);
    expect(t.puntos[1]).toEqual([0.98, 0.49, 0.5]);
    expect(simplificar([[0, 0]])).toEqual([[0, 0]]);
  });

  test('un trazo se dibuja como un path cerrado', () => {
    const d = caminoDeTrazo({ puntos: [[0.1, 0.1, 0.5], [0.5, 0.3, 0.5]], grosor: 3 }, 300);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(caminoDeTrazo({ puntos: [] }, 300)).toBe('');
  });
});
