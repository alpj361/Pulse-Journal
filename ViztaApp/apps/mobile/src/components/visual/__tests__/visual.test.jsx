import React from 'react';
import fs from 'fs';
import path from 'path';
import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createParser } from '@openuidev/react-lang';
import { supabase } from '../../../utils/supabase';
import { agrupar, idsDe, nombreCorto, partidoDe, verboLegible } from '../datos';

jest.mock('../../../utils/supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('../../codex/ItemDetailSheet', () => {
  const { Text } = require('react-native');
  return ({ item }) => <Text>ficha de {item.name}</Text>;
});
jest.mock('../../feed/TarjetasCongreso', () => ({ Hemiciclo: () => null }));
jest.mock('../../../utils/portada', () => () => null);
jest.mock('../../MorphingInfinity', () => () => null);

const { catalogo } = require('../catalogo');
const VistaVizta = require('../VistaVizta').default;

const ITEMS = [
  { id: 'a1', name: 'Roberto Arzú García-Granados (Roberto Arzú)', tipo: 'Actor', details: { Partido: { id: 'p1', name: 'Podemos (PODEMOS)', tipo: 'Entidad' } } },
  { id: 'a2', name: 'Sandra Torres', tipo: 'Actor', details: { Partido: { id: 'p2', name: 'Unidad Nacional de la Esperanza (UNE)' } } },
  { id: 'a3', name: 'Carlos Pineda', tipo: 'Actor', details: {} },
];

/** Un supabase de mentira: `in('id', ids)` devuelve esos items. */
function conItems(items) {
  supabase.from.mockImplementation(() => {
    const q = {
      select: () => q,
      in: (_c, ids) => Promise.resolve({ data: items.filter((i) => ids.includes(i.id)), error: null }),
    };
    return q;
  });
}

const textos = (r) => r.root.findAllByType(Text).map((t) => [].concat(t.props.children).flat().join(''));

async function dibujar(programa, entidades, relaciones) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let r;
  await act(async () => {
    r = TestRenderer.create(
      <QueryClientProvider client={cliente}>
        <VistaVizta programa={programa} entidades={entidades} relaciones={relaciones} />
      </QueryClientProvider>
    );
  });
  await act(async () => {
    await new Promise((res) => setTimeout(res, 20));
  });
  return r;
}

describe('datos de una vista', () => {
  test('ids de una lista mezclada, sin repetir', () => {
    expect(idsDe(['a', { id: 'b' }, 'a', null, { name: 'x' }])).toEqual(['a', 'b']);
  });
  test('nombre corto y sigla del partido', () => {
    expect(nombreCorto(ITEMS[0])).toBe('Roberto Arzú');
    expect(partidoDe(ITEMS[1])).toBe('UNE');
    expect(partidoDe({ details: { Partido: 'Vamos por una Guatemala Diferente - VAMOS' } })).toBe('VAMOS');
    expect(nombreCorto({ name: 'Ronald Yomelfy Portillo Cordón' })).toBe('Ronald Yomelfy Portillo Cordón');
    expect(verboLegible('secretario_general_de')).toBe('secretario general de');
  });
  test('agrupar por partido deja lo que no tiene al final', () => {
    const g = agrupar(ITEMS, 'partido');
    expect(g.map((x) => x.nombre)).toEqual(['PODEMOS', 'UNE', 'Sin partido']);
  });
});

describe('el catálogo', () => {
  test('lee un programa de piezas de Vizta sin errores', () => {
    const r = createParser(catalogo.toJSONSchema(), 'Vista').parse(
      [
        'root = Vista("Precandidatos 2027", [s1, cifras], "Quiénes son y con qué partido")',
        's1 = Seccion("Quiénes son", [mapa], "actores")',
        'mapa = Actores(["a1", "a2", "a3"], "partido", "rejilla")',
        'cifras = Cifras([Cifra(27, "partidos vigentes"), Cifra(3, "precandidatos")])',
      ].join('\n')
    );
    expect(r.meta.errors).toEqual([]);
    expect(r.root.typeName).toBe('Vista');
  });

  test('una pieza que no existe se reporta', () => {
    const r = createParser(catalogo.toJSONSchema(), 'Vista').parse('root = Vista("x", [g])\ng = GraficoInventado(1)');
    expect(r.meta.errors.length + r.meta.unresolved.length).toBeGreaterThan(0);
  });
});

/**
 * El backend revisa los programas y arma las instrucciones del agente con
 * `docs/visual/catalogo-visual.json`. Si el catálogo cambia, se regenera con
 * `ACTUALIZAR_CATALOGO=1 npx jest src/components/visual` y se copia a
 * ExtractorW (server/services/colaboraciones/catalogo-visual.json).
 */
describe('el archivo del catálogo', () => {
  const ARCHIVO = path.join(__dirname, '../../../../docs/visual/catalogo-visual.json');
  const actual = () => JSON.parse(JSON.stringify({ version: 1, root: 'Vista', schema: catalogo.toJSONSchema(), spec: catalogo.toSpec() }));
  test('está al día con el catálogo', () => {
    if (process.env.ACTUALIZAR_CATALOGO) {
      fs.mkdirSync(path.dirname(ARCHIVO), { recursive: true });
      fs.writeFileSync(ARCHIVO, `${JSON.stringify(actual(), null, 2)}\n`);
    }
    expect(JSON.parse(fs.readFileSync(ARCHIVO, 'utf8'))).toEqual(actual());
  });
});

describe('VistaVizta', () => {
  test('dibuja a los actores del Codex por su id, agrupados por partido', async () => {
    conItems(ITEMS);
    const r = await dibujar(
      ['root = Vista("Precandidatos 2027", [s1])', 's1 = Seccion("Quiénes son", [mapa], "actores")', 'mapa = Actores(["a1", "a2", "a3"], "partido")'].join('\n')
    );
    const t = textos(r);
    expect(t).toEqual(expect.arrayContaining(['Precandidatos 2027', 'Quiénes son', 'Roberto Arzú', 'Sandra Torres', 'Carlos Pineda']));
    expect(t).toEqual(expect.arrayContaining(['PODEMOS · 1', 'UNE · 1', 'SIN PARTIDO · 1']));
  });

  test('tocar a un actor abre su ficha', async () => {
    conItems(ITEMS);
    const r = await dibujar('root = Vista("x", [Actor("a2", "Lidera la UNE")])');
    const boton = r.root.findAll((n) => n.props.accessibilityLabel === 'Abrir la ficha de Sandra Torres')[0];
    await act(async () => boton.props.onPress());
    expect(textos(r)).toContain('ficha de Sandra Torres');
  });

  test('con las fichas que mandó el servidor no le pide nada a la base', async () => {
    supabase.from.mockClear();
    supabase.from.mockImplementation(() => {
      throw new Error('no debería consultar');
    });
    const r = await dibujar('root = Vista("x", [Actores(["a1", "a2"]), Relaciones("a1")])', ITEMS, {
      a1: [{ id: 'r1', verbo: 'figura principal de', sale: true, otro_id: 'a3', fecha: null }],
    });
    expect(textos(r)).toEqual(expect.arrayContaining(['Roberto Arzú', 'Sandra Torres', 'figura principal de', 'Carlos Pineda']));
    expect(supabase.from).not.toHaveBeenCalled();
  });

  test('un id que no está en el Codex no dibuja a nadie', async () => {
    conItems(ITEMS);
    const r = await dibujar('root = Vista("x", [Actor("inventado")])');
    expect(textos(r)).toEqual(['x']);
  });
});

describe('las piezas de un post', () => {
  // Un Pressable aparece en varias capas del árbol: se cuenta una vez por su onPress.
  const botones = (r, etiqueta) => {
    const vistos = new Set();
    return r.root.findAll((n) => n.props?.accessibilityRole === 'button' && String(n.props?.accessibilityLabel || '').includes(etiqueta) && typeof n.props.onPress === 'function')
      .filter((n) => (vistos.has(n.props.onPress) ? false : vistos.add(n.props.onPress)));
  };

  test('ofrecen guardar lo que falta, y no lo que ya está; sin acciones, solo se leen', async () => {
    conItems(ITEMS);
    const programa = [
      'root = Vista("x", [Personas([Persona("Sandra Torres", "a2", "Actor"), Persona("Juan Nadie")]), r1, r2, h1])',
      'r1 = Relacion("Jev", "es desarrollado por", "TypeSafe AI")',
      'r2 = Relacion("UNE", "postula a", "Sandra Torres")',
      'h1 = Hecho("h0", "Algo pasó.")',
    ].join('\n');
    const post = {
      menciones: [{ texto: 'Sandra Torres', codex: { id: 'a2' } }, { texto: 'Juan Nadie', tipo: 'Actor', codex: null }],
      relaciones: [
        { a: 'Jev', verbo: 'es desarrollado por', b: 'TypeSafe AI' },
        { a: 'UNE', verbo: 'postula a', b: 'Sandra Torres', relation_id: 'rel1' },
      ],
      hechos: [{ id: 'h0', texto: 'Algo pasó.' }],
    };
    const acciones = { ocupado: null, agregarMencion: jest.fn(), conectar: jest.fn(), guardarHecho: jest.fn() };
    const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    let r;
    await act(async () => {
      r = TestRenderer.create(
        <QueryClientProvider client={cliente}>
          <VistaVizta programa={programa} post={post} acciones={acciones} enLinea />
        </QueryClientProvider>
      );
    });
    await act(async () => { await new Promise((res) => setTimeout(res, 20)); });

    expect(botones(r, 'Agregar Juan Nadie')).toHaveLength(1);
    expect(botones(r, 'Agregar Sandra Torres')).toHaveLength(0); // ya está en el Codex
    act(() => botones(r, 'Agregar Juan Nadie')[0].props.onPress());
    expect(acciones.agregarMencion).toHaveBeenCalledWith(post.menciones[1]);

    act(() => botones(r, 'Guardar el vínculo: Jev')[0].props.onPress());
    expect(acciones.conectar).toHaveBeenCalledWith(post.relaciones[0]);
    // Lo ya guardado se marca y no se puede volver a guardar.
    expect(r.root.findAll((n) => String(n.props?.accessibilityLabel || '') === 'Guardar el vínculo: UNE postula a Sandra Torres: ya está en tu Codex').length).toBeGreaterThan(0);
    expect(botones(r, 'Guardar el vínculo: UNE')).toHaveLength(0);

    act(() => botones(r, 'Guardar el hecho')[0].props.onPress());
    expect(acciones.guardarHecho).toHaveBeenCalledWith(post.hechos[0]);

    // La misma vista sin acciones (el chat, un dashboard): sin botones de guardar.
    let solo;
    await act(async () => {
      solo = TestRenderer.create(
        <QueryClientProvider client={cliente}>
          <VistaVizta programa={programa} enLinea />
        </QueryClientProvider>
      );
    });
    expect(botones(solo, 'Agregar')).toHaveLength(0);
    expect(botones(solo, 'Guardar')).toHaveLength(0);
  });
});
