import { coincide, cuentaDe, cumple, facetasDe } from '../autofiltro';

const post = (author, extra = {}) => ({ id: author, name: `@${author} — algo`, details: { author, ...extra } });

describe('filtro por cuenta', () => {
  const posts = [
    post('Quorum', { author_handle: 'holaquorum' }),
    post('Quorum'),
    post('Raíces Guatemala 🌱'),
    post('raices guatemala'),
    post('Tan/Gente'),
    { id: 'x', name: 'sin cuenta', details: {} },
  ];

  test('sale aunque el post no esté analizado, una por nombre', () => {
    const f = facetasDe(posts).find((g) => g.id === 'cuenta');
    expect(f.buscable).toBe(true);
    expect(f.valores.map((v) => [v.etiqueta, v.posts])).toEqual([
      ['Quorum', 2],
      ['Raíces Guatemala 🌱', 2],
      ['Tan/Gente', 1],
    ]);
    expect(f.valores[0].usuario).toBe('holaquorum');
  });

  test('filtra los posts de esa cuenta', () => {
    const clave = cuentaDe(posts[2]).clave;
    expect(posts.filter((p) => cumple(p, { cuenta: clave })).length).toBe(2);
  });

  test('la cuenta sale del nombre del post si falta el autor', () => {
    expect(cuentaDe({ name: '@Neto Bran — Aquí explicó', details: {} }).etiqueta).toBe('Neto Bran');
    expect(cuentaDe({ name: 'nada', details: {} })).toBeNull();
  });

  test('el buscador encuentra por nombre o usuario, sin acentos', () => {
    expect(coincide({ etiqueta: 'Raíces Guatemala 🌱' }, 'raices')).toBe(true);
    expect(coincide({ etiqueta: 'Quorum', usuario: 'holaquorum' }, 'hola')).toBe(true);
    expect(coincide({ etiqueta: 'Quorum' }, 'tan')).toBe(false);
  });
});
