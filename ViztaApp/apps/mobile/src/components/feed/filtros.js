import { seccionDe } from './congreso';

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
