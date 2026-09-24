/**
 * Taxonomía de tipos del universo.
 *
 * Vivía dentro de SpacesStack, pero la importan cinco archivos — y cuando
 * SpacesStack pasó a importar WordSelector, que a su vez la necesitaba, quedó un
 * ciclo. Acá no depende de nada, así que nadie puede cerrar un círculo con ella.
 * SpacesStack la sigue reexportando para no tocar los imports existentes.
 */

// `tipo` viene con capitalización inconsistente ('Post' y 'post' conviven en la
// base), así que se normaliza antes de agrupar.
export const TYPE_ORDER = [
  'Actor',
  'Entidad',
  'Territorio',
  'Evento',
  'Concepto',
  'Documento',
  'Evidencia',
  'Historia',
  'Objeto',
  'Artefacto',
  'Ref',
  'Snippet',
  'Post',
];

export const TYPE_ACCENT = {
  Actor: '#4B4FA6',
  Entidad: '#0E7490',
  Territorio: '#15803D',
  Evento: '#B45309',
  Concepto: '#92400E',
  Documento: '#1B5E8F',
  Evidencia: '#9D2A6B',
  Historia: '#9D2A6B',
  Objeto: '#6B21A8',
  Artefacto: '#3F3A38',
  Snippet: '#5A6B60',
  Post: '#E1306C',
  // Un hecho guardado de un post. Tinta neutra y oscura: es un dato, no una
  // categoría que compita en color con las entidades de alrededor.
  Fact: '#374151',
  // Algo que existe en tu universo de información pero no en el modelo
  // analítico: una película, un libro. Tinta cálida y apagada; el color fuerte
  // lo pone su material.
  Ref: '#57534E',
};

// wiki_items guarda la subcategoría en inglés y en español legacy; los tipos
// del universo vienen ya en español. Se unifican para que no se muestre
// «PERSON» y «Actor» como si fueran cosas distintas.
const TIPO_ALIAS = {
  person: 'Actor',
  people: 'Actor',
  persona: 'Actor',
  actor: 'Actor',
  organization: 'Entidad',
  org: 'Entidad',
  entity: 'Entidad',
  organización: 'Entidad',
  entidad: 'Entidad',
  location: 'Territorio',
  place: 'Territorio',
  lugar: 'Territorio',
  territorio: 'Territorio',
  event: 'Evento',
  evento: 'Evento',
  concept: 'Concepto',
  concepto: 'Concepto',
  biblioteca: 'Concepto',
  document: 'Documento',
  documento: 'Documento',
  evidence: 'Evidencia',
  evidencia: 'Evidencia',
  fuente: 'Evidencia',
};

export function normalizeTipo(tipo) {
  if (!tipo) return 'Otros';
  const t = String(tipo).trim();
  const alias = TIPO_ALIAS[t.toLowerCase()];
  if (alias) return alias;
  const match = TYPE_ORDER.find((k) => k.toLowerCase() === t.toLowerCase());
  return match || t.charAt(0).toUpperCase() + t.slice(1);
}
