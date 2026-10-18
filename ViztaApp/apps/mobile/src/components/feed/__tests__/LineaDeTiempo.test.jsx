import { Text } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import LineaDeTiempo from '../LineaDeTiempo';

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const cadena = () => {
    const api = {
      damping: () => api,
      stiffness: () => api,
      mass: () => api,
      duration: () => api,
      springify: () => api,
    };
    return api;
  };
  return {
    __esModule: true,
    default: { View },
    LinearTransition: cadena(),
    useReducedMotion: () => false,
  };
});

const TITULO = 'Ataque en Campo Marte deja dos muertos, incluido Solórzano Foppa';

function cardCon(n) {
  const desarrollos = Array.from({ length: n }, (_, i) => ({
    id: `dev_news:${n - i}`,
    ts: `2026-10-17T${String(20 - i).padStart(2, '0')}:33:50-06:00`,
    tipo: i === 0 ? 'desarrollo' : i === n - 1 ? 'hecho_base' : 'desarrollo',
    texto: i === 0 ? TITULO : `Desarrollo ${i}`,
    detalle: i === 2 ? null : `Detalle ${i}`,
    fuente: 'Prensa Libre',
    url: 'https://www.prensalibre.com/nota',
    corregido: false,
    correccion: null,
  }));
  return {
    titulo: TITULO,
    resumen: 'Un ataque armado en Campo Marte.',
    fuentes: { independientes: 12 },
    desarrollos,
  };
}

const textoDel = (renderer) =>
  renderer.root
    .findAllByType(Text)
    .map((n) => {
      const c = n.props.children;
      if (typeof c === 'string') return c;
      if (Array.isArray(c)) return c.filter((x) => typeof x === 'string').join('');
      return '';
    })
    .join(' | ');

describe('LineaDeTiempo', () => {
  test('si no hay desarrollos, no se pinta nada', () => {
    let r;
    act(() => {
      r = TestRenderer.create(<LineaDeTiempo card={{ titulo: TITULO, resumen: 'x' }} />);
    });
    expect(r.toJSON()).toBeNull();
  });

  test('pinta cómo avanzó, los medios una vez, y no repite el titular', () => {
    let r;
    act(() => {
      r = TestRenderer.create(<LineaDeTiempo card={cardCon(3)} />);
    });
    const plano = textoDel(r);
    expect(plano).toContain('CÓMO AVANZÓ');
    expect(plano).toContain('12 medios');
    expect(plano).toContain('Desarrollo 1');
    expect(plano.match(/Ataque en Campo Marte deja dos muertos/g)).toBeNull();
    expect(plano).toContain('8:33 p. m.');
  });

  test('ver más abre el resto en la misma ficha', () => {
    let r;
    act(() => {
      r = TestRenderer.create(<LineaDeTiempo card={cardCon(6)} />);
    });
    expect(textoDel(r)).toContain('ver más');
    expect(textoDel(r)).not.toContain('Desarrollo 4');
    const boton = r.root.findAll((n) => n.props?.accessibilityLabel === 'ver más')[0];
    expect(boton).toBeTruthy();
    act(() => {
      boton.props.onPress();
    });
    expect(textoDel(r)).toContain('Desarrollo 4');
    expect(textoDel(r)).toContain('ver menos');
  });
});
