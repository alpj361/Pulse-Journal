'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { _private } = require('./datasetCodexService');

const ITEMS = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'Bernardo Arévalo', aliases: ['Presidente Arévalo'], tipo: 'Actor' },
  { id: '22222222-2222-4222-8222-222222222222', name: 'Movimiento Semilla', aliases: ['Semilla'], tipo: 'Entidad' },
  { id: '33333333-3333-4333-8333-333333333333', name: 'Bernardo Arevalo', aliases: [], tipo: 'Actor' },
];

test('normalizeToken removes accents and normalizes whitespace', () => {
  assert.equal(_private.normalizeToken('  BERNARDO   Arévalo '), 'bernardo arevalo');
});

test('extractCellValue understands scalar and common cell wrappers', () => {
  assert.equal(_private.extractCellValue('Semilla'), 'Semilla');
  assert.equal(_private.extractCellValue({ name: 'Semilla' }), 'Semilla');
  assert.equal(_private.extractCellValue({ value: 42 }), 42);
  assert.deepEqual(_private.extractCellValue({ custom: true }), { custom: true });
});

test('stableStringify is deterministic for object key order', () => {
  assert.equal(
    _private.stableStringify({ b: 2, a: { z: 3, y: 1 } }),
    _private.stableStringify({ a: { y: 1, z: 3 }, b: 2 })
  );
});

test('matchRow reports ambiguous normalized names instead of choosing one', () => {
  const indexes = _private.buildItemIndexes(ITEMS);
  const match = _private.matchRow(
    { id: 'row-1', position: 0, values: { Nombre: 'Bernardo Arévalo' } },
    'Nombre',
    'name',
    ITEMS,
    indexes
  );
  assert.equal(match.status, 'ambiguous');
  assert.equal(match.candidates.length, 2);
});

test('matchRow accepts an exact alias but does not create an item', () => {
  const indexes = _private.buildItemIndexes(ITEMS);
  const match = _private.matchRow(
    { id: 'row-2', position: 1, values: { Nombre: 'Semilla' } },
    'Nombre',
    'alias',
    ITEMS,
    indexes
  );
  assert.equal(match.status, 'alias');
  assert.equal(match.candidates[0].codex_item_id, ITEMS[1].id);
});

test('matchRow uses only an existing UUID in id mode', () => {
  const indexes = _private.buildItemIndexes(ITEMS);
  const exact = _private.matchRow(
    { id: 'row-3', position: 2, values: { Codex: ITEMS[0].id } },
    'Codex',
    'id',
    ITEMS,
    indexes
  );
  const missing = _private.matchRow(
    { id: 'row-4', position: 3, values: { Codex: '44444444-4444-4444-8444-444444444444' } },
    'Codex',
    'id',
    ITEMS,
    indexes
  );
  assert.equal(exact.status, 'exact');
  assert.equal(missing.status, 'unmatched');
  assert.equal(missing.reason, 'CODEX_ID_NOT_FOUND');

  const wrapped = _private.matchRow(
    { id: 'row-5', position: 4, values: { Codex: { id: ITEMS[1].id, name: ITEMS[1].name } } },
    'Codex',
    'id',
    ITEMS,
    indexes
  );
  assert.equal(wrapped.status, 'exact');
  assert.equal(wrapped.candidates[0].codex_item_id, ITEMS[1].id);
});
