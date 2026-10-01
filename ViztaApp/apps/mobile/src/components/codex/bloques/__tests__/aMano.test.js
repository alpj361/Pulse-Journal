import { alternar, limpiar, MAXIMO } from '../aMano';

jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }));

describe('a mano', () => {
  test('poner, sacar y el tope', () => {
    expect(alternar(['negrita'], 'todo')).toEqual(['negrita', 'todo']);
    expect(alternar(['negrita', 'todo'], 'negrita')).toEqual(['todo']);
    const lleno = ['negrita', 'cursiva', 'todo', 'deshacer'];
    expect(lleno).toHaveLength(MAXIMO);
    // Si no hay lugar, sale la más vieja.
    expect(alternar(lleno, 'tabla')).toEqual(['cursiva', 'todo', 'deshacer', 'tabla']);
    expect(alternar(lleno, 'no-existe')).toBe(lleno);
  });

  test('lo guardado se limpia', () => {
    expect(limpiar(['negrita', 'negrita', 'vieja', 'tabla'])).toEqual(['negrita', 'tabla']);
    expect(limpiar(null)).toEqual([]);
  });
});
