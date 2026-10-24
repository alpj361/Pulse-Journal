import { seccionDe } from './congreso';
import { categoriaDe, temaDe } from './temas';

export const FILTROS_CONGRESO = [
  ['todo', 'todo'], ['comisiones', 'comisiones'], ['pleno', 'pleno'],
  ['votaciones', 'votaciones'], ['fiscalizacion', 'fiscalización y actividad'],
];

export function filtrarDias(dias = [], seccion = 'todo') {
  if (seccion === 'todo') return dias;
  return dias.map((dia) => ({
    ...dia,
    items: seccion === 'votaciones' ? [] : dia.items.filter((i) => i.tipo !== 'noticiero' && seccionDe(i) === seccion),
    votaciones: seccion === 'votaciones' ? dia.votaciones || [] : [],
  })).filter((dia) => dia.items.length || dia.votaciones.length);
}

export function opcionesCongreso(dias = []) {
  return FILTROS_CONGRESO.map(([clave, nombre]) => ({ clave, nombre,
    cuenta: filtrarDias(dias, clave).reduce((n, d) => n + d.items.filter((i) => i.tipo !== 'noticiero').length + (d.votaciones || []).length, 0),
  }));
}

export function opcionesTemas(cards = []) {
  const cuentas = new Map();
  for (const card of cards) {
    const tema = temaDe(categoriaDe(card));
    cuentas.set(tema, (cuentas.get(tema) || 0) + 1);
  }
  return [{ clave: 'todo', nombre: 'todo', cuenta: cards.length },
    ...[...cuentas].sort((a, b) => b[1] - a[1]).map(([clave, cuenta]) => ({ clave, nombre: clave, cuenta }))];
}
