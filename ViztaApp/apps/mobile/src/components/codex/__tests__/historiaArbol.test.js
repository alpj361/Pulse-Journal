import { comienzoDe, contiene, entradaDeSeccion, resumen } from '../historiaArbol';
import { contar, nivelesDe } from '../ontologia';

jest.mock('../../../utils/supabase', () => ({ supabase: { rpc: jest.fn() } }));

const indice = [
  { titulo: 'Charla Importancia sobre formación de partidos Políticos', bloque: 'a' },
  { titulo: '¿Para qué existen los partidos?', bloque: 'b' },
  { titulo: 'Dónde está el poder?', bloque: 'c' },
];

describe('árbol de la historia', () => {
  test('la sección se encuentra por título aunque la base lo haya cortado', () => {
    expect(entradaDeSeccion(indice, { titulo: 'Charla Importancia sobre formación de partidos Políticos…', orden: 2 }).bloque).toBe('a');
    expect(entradaDeSeccion(indice, { titulo: 'Donde esta el poder?', orden: 0 }).bloque).toBe('c');
  });

  test('si ningún título coincide, por el lugar; si no hay, nada', () => {
    expect(entradaDeSeccion(indice, { titulo: 'Otra cosa', orden: 1 }).bloque).toBe('b');
    expect(entradaDeSeccion(indice, { titulo: 'Otra cosa', orden: 9 })).toBeNull();
    expect(entradaDeSeccion([], { titulo: 'x', orden: 0 })).toBeNull();
  });

  test('un párrafo se encuentra por su comienzo, sin marcas', () => {
    const c = comienzoDe('Antes había organización partidaria en cada cuadra, y eso cambió.');
    expect(contiene('**Antes había** organizacion partidaria en cada cuadra, y eso', c)).toBe(true);
    expect(contiene('Otra cosa', c)).toBe(false);
  });

  test('los nombres siguen al tipo de espacio', () => {
    expect(nivelesDe(['ficcion'])[0]).toEqual(['capítulo', 'capítulos']);
    expect(nivelesDe(['legal'])[0][0]).toBe('expediente');
    // Híbrido o sin tipo: los de siempre.
    expect(nivelesDe(['ficcion', 'legal'])[0][0]).toBe('parte');
    expect(nivelesDe([], false)[1][1]).toBe('secciones');
    const arbol = { historias: [{ secciones: [{}, {}] }, { secciones: [{}] }] };
    expect(resumen(arbol, nivelesDe(['ficcion']), contar)).toBe('2 capítulos · 3 escenas');
    expect(resumen({ historias: [{ secciones: [] }] }, nivelesDe([]), contar)).toBe('1 parte');
  });
});
