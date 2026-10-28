'use strict';

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const {
  canonicalItemType,
  getMergedSchema,
  prepareFieldPatch,
} = require('./codexContractV4');
const { UNIVERSE_ITEM_TYPES } = require('./codexSchema');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_ALIGNMENT_ROWS = 10000;
const PAGE_SIZE = 1000;
const ALIGNABLE_TYPES = new Set(UNIVERSE_ITEM_TYPES);

class DatasetContractError extends Error {
  constructor(code, message, details = {}, status = 400) {
    super(message);
    this.name = 'DatasetContractError';
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new DatasetContractError(
      'DATASET_SERVICE_NOT_CONFIGURED',
      'ExtractorW requiere SUPABASE_URL y una service role key para sincronizar datasets.',
      {},
      503
    );
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function assertUuid(value, fieldName) {
  if (!UUID_RE.test(String(value || ''))) {
    throw new DatasetContractError('INVALID_UUID', `${fieldName} debe ser un UUID válido.`, { field: fieldName });
  }
}

function normalizeToken(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function extractCellValue(cell) {
  if (cell === null || cell === undefined) return cell;
  if (typeof cell !== 'object' || Array.isArray(cell)) return cell;
  if (cell.name !== undefined) return cell.name;
  if (cell.value !== undefined) return cell.value;
  if (cell.label !== undefined) return cell.label;
  return cell;
}

function isEmptyValue(value) {
  return value === null || value === undefined || value === '';
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = stableValue(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function sha256(value) {
  return crypto.createHash('sha256').update(stableStringify(value)).digest('hex');
}

function tokenSimilarity(left, right) {
  const a = new Set(normalizeToken(left).split(/[^a-z0-9]+/).filter(Boolean));
  const b = new Set(normalizeToken(right).split(/[^a-z0-9]+/).filter(Boolean));
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

function canonicalDatasetType(rawType) {
  const canonical = canonicalItemType(rawType);
  if (!canonical || !ALIGNABLE_TYPES.has(canonical)) {
    throw new DatasetContractError(
      'INVALID_ROW_CODEX_TYPE',
      'El tipo de fila debe ser un ítem oficial de Codex.',
      { received: rawType, allowed: [...ALIGNABLE_TYPES] }
    );
  }
  return canonical;
}

async function loadDataset(supabase, datasetId, userId, options = {}) {
  assertUuid(datasetId, 'dataset_id');
  const { data, error } = await supabase
    .from('datasets')
    .select('id, user_id, name, description, visibility, project_id, schema_definition, row_count, row_codex_type, connection_mode, match_config, tags, source, metadata, legacy_source, last_codex_sync, created_at, updated_at, deleted_at')
    .eq('id', datasetId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new DatasetContractError('DATASET_READ_FAILED', error.message, {}, 500);
  if (!data) throw new DatasetContractError('DATASET_NOT_FOUND', 'Conjunto de datos no encontrado.', {}, 404);

  const canReadPublic = options.allowPublicRead && data.visibility === 'public';
  if (data.user_id !== userId && !canReadPublic) {
    throw new DatasetContractError('DATASET_FORBIDDEN', 'No puedes modificar este conjunto de datos.', {}, 403);
  }
  return data;
}

async function loadAllRows(supabase, datasetId, maxRows = MAX_ALIGNMENT_ROWS) {
  const rows = [];
  for (let offset = 0; offset < maxRows; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('dataset_rows')
      .select('id, dataset_id, source_row_key, position, values, revision, created_at, updated_at')
      .eq('dataset_id', datasetId)
      .is('deleted_at', null)
      .order('position', { ascending: true })
      .range(offset, Math.min(offset + PAGE_SIZE - 1, maxRows - 1));
    if (error) throw new DatasetContractError('DATASET_ROWS_READ_FAILED', error.message, {}, 500);
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  if (rows.length >= maxRows) {
    const { count, error } = await supabase
      .from('dataset_rows')
      .select('id', { count: 'exact', head: true })
      .eq('dataset_id', datasetId)
      .is('deleted_at', null);
    if (error) throw new DatasetContractError('DATASET_ROWS_COUNT_FAILED', error.message, {}, 500);
    if ((count || 0) > maxRows) {
      throw new DatasetContractError(
        'ALIGNMENT_ROW_LIMIT_EXCEEDED',
        `La alineación admite hasta ${maxRows} filas por operación.`,
        { row_count: count, max_rows: maxRows },
        413
      );
    }
  }
  return rows;
}

async function loadCodexItems(supabase, userId, itemType) {
  const items = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('codex_universe_items')
      .select('id, tipo, name, aliases, details, field_keys, preset_keys, updated_at')
      .eq('user_id', userId)
      .eq('tipo', itemType)
      .order('name', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new DatasetContractError('CODEX_ITEMS_READ_FAILED', error.message, {}, 500);
    items.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return items;
}

function schemaColumnKeys(dataset) {
  return new Set((dataset.schema_definition || []).map((column) => column?.key || column?.name).filter(Boolean));
}

async function resolveBindings(supabase, dataset, userId, rawBindings = []) {
  if (!Array.isArray(rawBindings)) {
    throw new DatasetContractError('BINDINGS_ARRAY_REQUIRED', 'bindings debe ser una lista.');
  }

  const columnKeys = schemaColumnKeys(dataset);
  const itemType = canonicalDatasetType(dataset.row_codex_type);
  const schema = await getMergedSchema(supabase, userId, itemType);
  const fieldsByKey = new Map(schema.fields.map((field) => [field.field_key, field]));
  const fieldsByStorageToken = new Map(schema.fields.flatMap((field) => (
    [field.storage_key, field.label]
      .filter(Boolean)
      .map((key) => [normalizeToken(key), field])
  )));
  const seen = new Set();
  const seenTargets = new Set();

  return rawBindings.map((binding, index) => {
    const columnKey = String(binding?.column_key || '').trim();
    const targetKind = binding?.target_kind;
    const targetKey = String(binding?.target_key || '').trim();
    const direction = binding?.direction || 'both';
    const emptyPolicy = binding?.empty_policy || 'ignore_empty';

    if (!columnKey || !targetKey) {
      throw new DatasetContractError('INVALID_BINDING', 'Cada asignación necesita column_key y target_key.', { index });
    }
    if (columnKey.length > 256 || targetKey.length > 256) {
      throw new DatasetContractError('BINDING_KEY_TOO_LONG', 'Las claves de una asignación admiten hasta 256 caracteres.', { index });
    }
    if (columnKeys.size && !columnKeys.has(columnKey)) {
      throw new DatasetContractError('UNKNOWN_DATASET_COLUMN', `Columna desconocida: ${columnKey}`, { index, column_key: columnKey });
    }
    if (seen.has(columnKey)) {
      throw new DatasetContractError('DUPLICATE_COLUMN_BINDING', `La columna ${columnKey} aparece más de una vez.`, { index });
    }
    seen.add(columnKey);

    if (!['field', 'details'].includes(targetKind)) {
      throw new DatasetContractError('INVALID_BINDING_TARGET', 'target_kind debe ser field o details.', { index });
    }
    if (!['both', 'dataset_to_codex', 'codex_to_dataset'].includes(direction)) {
      throw new DatasetContractError('INVALID_BINDING_DIRECTION', `Dirección inválida: ${direction}`, { index });
    }
    if (!['ignore_empty', 'propagate_empty', 'confirm_clear'].includes(emptyPolicy)) {
      throw new DatasetContractError('INVALID_EMPTY_POLICY', `Política de vacío inválida: ${emptyPolicy}`, { index });
    }

    const targetIdentity = `${targetKind}:${normalizeToken(targetKey)}`;
    if (seenTargets.has(targetIdentity)) {
      throw new DatasetContractError(
        'DUPLICATE_TARGET_BINDING',
        `Más de una columna intenta controlar el destino ${targetKey}.`,
        { index, target_kind: targetKind, target_key: targetKey }
      );
    }
    seenTargets.add(targetIdentity);

    let targetStorageKey = targetKey;
    let targetLabel = targetKey;
    let fieldType = null;
    if (targetKind === 'field') {
      const field = fieldsByKey.get(targetKey);
      if (!field) {
        throw new DatasetContractError('UNKNOWN_FIELD_KEY', `Campo de Codex desconocido: ${targetKey}`, { index, target_key: targetKey });
      }
      targetStorageKey = field.storage_key || field.label || field.field_key;
      targetLabel = field.label;
      fieldType = field.field_type;
    } else {
      const catalogField = fieldsByKey.get(targetKey) || fieldsByStorageToken.get(normalizeToken(targetKey));
      if (catalogField) {
        throw new DatasetContractError(
          'DETAIL_KEY_IS_CATALOG_FIELD',
          `${targetKey} ya existe en el catálogo de ${itemType}; asígnalo como field con la clave ${catalogField.field_key}.`,
          { index, field_key: catalogField.field_key }
        );
      }
    }

    return {
      column_key: columnKey,
      target_kind: targetKind,
      target_key: targetKey,
      target_storage_key: targetStorageKey,
      target_label: targetLabel,
      field_type: fieldType,
      direction: direction,
      empty_policy: emptyPolicy,
    };
  });
}

function buildItemIndexes(items) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const byName = new Map();
  const byAlias = new Map();
  for (const item of items) {
    const nameKey = normalizeToken(item.name);
    if (nameKey) {
      if (!byName.has(nameKey)) byName.set(nameKey, []);
      byName.get(nameKey).push(item);
    }
    for (const alias of item.aliases || []) {
      const aliasKey = normalizeToken(alias);
      if (!aliasKey) continue;
      if (!byAlias.has(aliasKey)) byAlias.set(aliasKey, []);
      byAlias.get(aliasKey).push(item);
    }
  }
  return { byId, byName, byAlias };
}

function candidateSummary(item, method, score = 1) {
  return {
    codex_item_id: item.id,
    name: item.name,
    tipo: item.tipo,
    method,
    score: Number(score.toFixed(3)),
  };
}

function matchRow(row, matchColumn, matchType, items, indexes) {
  const rawCell = row.values?.[matchColumn];
  const displayValue = matchType === 'id'
    && rawCell
    && typeof rawCell === 'object'
    && !Array.isArray(rawCell)
    && rawCell.id !== undefined
    ? rawCell.id
    : extractCellValue(rawCell);
  const token = normalizeToken(displayValue);

  if (isEmptyValue(displayValue)) {
    return { row_id: row.id, position: row.position, display_value: displayValue, status: 'unmatched', candidates: [], reason: 'EMPTY_MATCH_VALUE' };
  }

  if (matchType === 'id' && UUID_RE.test(String(displayValue))) {
    const item = indexes.byId.get(String(displayValue));
    return item
      ? { row_id: row.id, position: row.position, display_value: displayValue, status: 'exact', candidates: [candidateSummary(item, 'id')] }
      : { row_id: row.id, position: row.position, display_value: displayValue, status: 'unmatched', candidates: [], reason: 'CODEX_ID_NOT_FOUND' };
  }

  const exact = indexes.byName.get(token) || [];
  if (exact.length === 1) {
    return { row_id: row.id, position: row.position, display_value: displayValue, status: 'exact', candidates: [candidateSummary(exact[0], 'exact')] };
  }
  if (exact.length > 1) {
    return { row_id: row.id, position: row.position, display_value: displayValue, status: 'ambiguous', candidates: exact.map((item) => candidateSummary(item, 'exact')) };
  }

  const aliases = indexes.byAlias.get(token) || [];
  if (aliases.length === 1) {
    return { row_id: row.id, position: row.position, display_value: displayValue, status: 'alias', candidates: [candidateSummary(aliases[0], 'alias')] };
  }
  if (aliases.length > 1) {
    return { row_id: row.id, position: row.position, display_value: displayValue, status: 'ambiguous', candidates: aliases.map((item) => candidateSummary(item, 'alias')) };
  }

  const suggested = items
    .map((item) => ({ item, score: tokenSimilarity(displayValue, item.name) }))
    .filter((entry) => entry.score >= 0.6 && entry.score < 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((entry) => candidateSummary(entry.item, 'agent_suggested', entry.score));

  return {
    row_id: row.id,
    position: row.position,
    display_value: displayValue,
    status: suggested.length ? 'suggested' : 'unmatched',
    candidates: suggested,
  };
}

async function previewAlignment(params, userId) {
  const supabase = getSupabaseAdmin();
  const dataset = await loadDataset(supabase, params.dataset_id, userId);
  const itemType = canonicalDatasetType(params.item_type || dataset.row_codex_type);
  const matchColumn = String(params.match_column || dataset.match_config?.column || '').trim();
  const matchType = params.match_type || dataset.match_config?.type || 'name';
  if (!matchColumn) throw new DatasetContractError('MATCH_COLUMN_REQUIRED', 'Debes elegir la columna que identifica cada fila.');
  if (!['name', 'alias', 'id'].includes(matchType)) {
    throw new DatasetContractError('INVALID_MATCH_TYPE', 'match_type debe ser name, alias o id.');
  }
  const columns = schemaColumnKeys(dataset);
  if (columns.size && !columns.has(matchColumn)) {
    throw new DatasetContractError('UNKNOWN_MATCH_COLUMN', `Columna desconocida: ${matchColumn}`);
  }

  const normalizedDataset = { ...dataset, row_codex_type: itemType };
  const [rows, items, currentBindings] = await Promise.all([
    loadAllRows(supabase, dataset.id),
    loadCodexItems(supabase, userId, itemType),
    loadCurrentBindings(supabase, dataset.id),
  ]);
  const bindings = await resolveBindings(supabase, normalizedDataset, userId, params.bindings || []);
  const indexes = buildItemIndexes(items);
  const matches = rows.map((row) => matchRow(row, matchColumn, matchType, items, indexes));
  const summary = matches.reduce((acc, match) => {
    acc[match.status] = (acc[match.status] || 0) + 1;
    return acc;
  }, { rows: rows.length, exact: 0, alias: 0, suggested: 0, ambiguous: 0, unmatched: 0 });
  summary.potential_new_items = summary.unmatched;

  const previewToken = sha256({
    dataset_id: dataset.id,
    dataset_updated_at: dataset.updated_at,
    item_type: itemType,
    match_column: matchColumn,
    match_type: matchType,
    rows: rows.map((row) => ({ id: row.id, revision: row.revision })),
    codex_items: items.map((item) => ({ id: item.id, updated_at: item.updated_at })),
    current_bindings: currentBindings.map((binding) => ({ id: binding.id, updated_at: binding.approved_at, active: binding.active })),
    bindings,
  });

  return {
    success: true,
    preview_only: true,
    requires_confirmation: true,
    preview_token: previewToken,
    dataset: {
      id: dataset.id,
      name: dataset.name,
      visibility: dataset.visibility,
      row_count: rows.length,
      row_codex_type: itemType,
      connection_mode: dataset.connection_mode,
    },
    config: { item_type: itemType, match_column: matchColumn, match_type: matchType },
    current_bindings: currentBindings,
    bindings,
    matches,
    summary,
    legacy_mappings_pending_review: dataset.metadata?.legacy_column_mappings || [],
  };
}

async function saveBindings(supabase, dataset, userId, bindings) {
  if (!bindings.length) return [];
  const payload = bindings.map((binding) => ({
    user_id: userId,
    dataset_id: dataset.id,
    column_key: binding.column_key,
    target_kind: binding.target_kind,
    target_key: binding.target_key,
    target_storage_key: binding.target_storage_key,
    direction: binding.direction,
    empty_policy: binding.empty_policy,
    approved_by: userId,
    approved_at: new Date().toISOString(),
    active: true,
  }));
  const { data, error } = await supabase
    .from('dataset_field_bindings')
    .upsert(payload, { onConflict: 'dataset_id,column_key' })
    .select('*');
  if (error) throw new DatasetContractError('BINDINGS_SAVE_FAILED', error.message, {}, 500);
  return data || [];
}

async function loadCurrentBindings(supabase, datasetId) {
  const { data, error } = await supabase
    .from('dataset_field_bindings')
    .select('id, column_key, target_kind, target_key, target_storage_key, direction, empty_policy, approved_at, active')
    .eq('dataset_id', datasetId)
    .eq('active', true)
    .order('column_key', { ascending: true });
  if (error) throw new DatasetContractError('BINDINGS_READ_FAILED', error.message, {}, 500);
  return data || [];
}

async function replaceBindings(supabase, dataset, userId, bindings) {
  const current = await loadCurrentBindings(supabase, dataset.id);
  const approvedColumns = new Set(bindings.map((binding) => binding.column_key));
  const staleIds = current
    .filter((binding) => !approvedColumns.has(binding.column_key))
    .map((binding) => binding.id);
  if (staleIds.length) {
    const { error } = await supabase
      .from('dataset_field_bindings')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('dataset_id', dataset.id)
      .eq('user_id', userId)
      .in('id', staleIds);
    if (error) throw new DatasetContractError('BINDINGS_REPLACE_FAILED', error.message, {}, 500);
  }
  return saveBindings(supabase, dataset, userId, bindings);
}

async function loadActiveLink(supabase, rowId) {
  const { data, error } = await supabase
    .from('dataset_row_codex_links')
    .select('id, user_id, dataset_row_id, codex_item_id, status, match_method, match_score')
    .eq('dataset_row_id', rowId)
    .in('status', ['pending', 'confirmed'])
    .maybeSingle();
  if (error) throw new DatasetContractError('LINK_READ_FAILED', error.message, {}, 500);
  return data;
}

async function confirmLink(supabase, row, item, userId, method, score) {
  const existing = await loadActiveLink(supabase, row.id);
  const payload = {
    user_id: userId,
    dataset_row_id: row.id,
    codex_item_id: item.id,
    status: 'confirmed',
    match_method: method || 'manual',
    match_score: score ?? null,
    confirmed_by: userId,
    confirmed_at: new Date().toISOString(),
  };
  if (existing) {
    const { data, error } = await supabase
      .from('dataset_row_codex_links')
      .update(payload)
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw new DatasetContractError('LINK_UPDATE_FAILED', error.message, {}, 500);
    return data;
  }
  const { data, error } = await supabase
    .from('dataset_row_codex_links')
    .insert(payload)
    .select('*')
    .single();
  if (error) throw new DatasetContractError('LINK_CREATE_FAILED', error.message, {}, 500);
  return data;
}

async function loadOwnedCodexItem(supabase, itemId, userId, itemType) {
  assertUuid(itemId, 'codex_item_id');
  const { data, error } = await supabase
    .from('codex_universe_items')
    .select('id, user_id, tipo, name, aliases, details, field_keys, preset_keys')
    .eq('id', itemId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new DatasetContractError('CODEX_ITEM_READ_FAILED', error.message, {}, 500);
  if (!data) throw new DatasetContractError('CODEX_ITEM_NOT_FOUND', 'Ítem de Codex no encontrado.', { codex_item_id: itemId }, 404);
  if (canonicalItemType(data.tipo) !== itemType) {
    throw new DatasetContractError('CODEX_ITEM_TYPE_MISMATCH', `El ítem ${data.name} no es de tipo ${itemType}.`, { codex_item_id: itemId });
  }
  return data;
}

async function createCodexItem(supabase, userId, itemType, name) {
  const cleanName = String(name || '').trim();
  if (!cleanName) throw new DatasetContractError('CODEX_ITEM_NAME_REQUIRED', 'No se puede crear un ítem sin nombre.');
  const { data, error } = await supabase
    .from('codex_universe_items')
    .insert({
      user_id: userId,
      tipo: itemType,
      name: cleanName,
      aliases: [],
      tags: [],
      details: {},
      field_keys: [],
      preset_keys: [],
      is_profile: false,
    })
    .select('id, user_id, tipo, name, aliases, details, field_keys, preset_keys')
    .single();
  if (error) throw new DatasetContractError('CODEX_ITEM_CREATE_FAILED', error.message, {}, 500);
  return data;
}

async function recordSyncEvent(supabase, event) {
  const { error } = await supabase.from('codex_sync_events').insert(event);
  if (error && error.code !== '23505') {
    throw new DatasetContractError('SYNC_EVENT_WRITE_FAILED', error.message, {}, 500);
  }
}

function eventPayload({ operationId, userId, originKind, originId, sourceKind, sourceId, targetKind, targetId, fieldKey, previousValue, nextValue, status = 'applied', error = null, metadata = {} }) {
  return {
    operation_id: operationId,
    user_id: userId,
    origin_kind: originKind,
    origin_id: originId || null,
    source_kind: sourceKind,
    source_id: sourceId,
    target_kind: targetKind,
    target_id: targetId,
    field_key: fieldKey || null,
    previous_value: previousValue === undefined ? null : previousValue,
    next_value: nextValue === undefined ? null : nextValue,
    status,
    error,
    applied_at: status === 'applied' ? new Date().toISOString() : null,
    metadata,
  };
}

async function syncRowToCodexWithClient(supabase, dataset, row, userId, operationId, originKind = 'dataset') {
  if (dataset.connection_mode !== 'sync') {
    return { applied: 0, conflicts: 0, skipped: 0, reason: 'CONNECTION_MODE_NOT_SYNC' };
  }
  const link = await loadActiveLink(supabase, row.id);
  if (!link || link.status !== 'confirmed') {
    return { applied: 0, conflicts: 0, skipped: 0, reason: 'ROW_NOT_LINKED' };
  }

  const [{ data: bindings, error: bindingError }, item] = await Promise.all([
    supabase
      .from('dataset_field_bindings')
      .select('*')
      .eq('dataset_id', dataset.id)
      .eq('active', true)
      .in('direction', ['both', 'dataset_to_codex']),
    loadOwnedCodexItem(supabase, link.codex_item_id, userId, canonicalDatasetType(dataset.row_codex_type)),
  ]);
  if (bindingError) throw new DatasetContractError('BINDINGS_READ_FAILED', bindingError.message, {}, 500);

  const fieldInput = {};
  const detailsDelta = {};
  const candidates = [];
  let conflicts = 0;
  let skipped = 0;

  for (const binding of bindings || []) {
    const hasColumn = Object.prototype.hasOwnProperty.call(row.values || {}, binding.column_key);
    if (!hasColumn) {
      skipped++;
      continue;
    }
    const value = row.values[binding.column_key];
    if (isEmptyValue(value) && binding.empty_policy === 'ignore_empty') {
      skipped++;
      continue;
    }
    if (isEmptyValue(value) && binding.empty_policy === 'confirm_clear') {
      conflicts++;
      await recordSyncEvent(supabase, eventPayload({
        operationId,
        userId,
        originKind,
        originId: row.id,
        sourceKind: 'dataset_row',
        sourceId: row.id,
        targetKind: 'codex_item',
        targetId: item.id,
        fieldKey: binding.target_key,
        previousValue: item.details?.[binding.target_storage_key || binding.target_key],
        nextValue: value,
        status: 'conflict',
        error: 'CLEAR_REQUIRES_CONFIRMATION',
        metadata: { dataset_id: dataset.id, column_key: binding.column_key },
      }));
      continue;
    }

    if (binding.target_kind === 'field') fieldInput[binding.target_key] = value;
    else detailsDelta[binding.target_key] = value;
    candidates.push(binding);
  }

  let prepared = { storageDelta: {}, fieldKeys: [] };
  if (Object.keys(fieldInput).length) {
    prepared = await prepareFieldPatch(supabase, userId, item.tipo, fieldInput);
  }
  const nextDetails = { ...(item.details || {}), ...prepared.storageDelta, ...detailsDelta };
  const nextFieldKeys = [...new Set([...(item.field_keys || []), ...prepared.fieldKeys])];

  if (stableStringify(nextDetails) === stableStringify(item.details || {})
      && stableStringify(nextFieldKeys) === stableStringify(item.field_keys || [])) {
    return { applied: 0, conflicts, skipped: skipped + candidates.length, codex_item_id: item.id };
  }

  const { error: updateError } = await supabase
    .from('codex_universe_items')
    .update({ details: nextDetails, field_keys: nextFieldKeys, updated_at: new Date().toISOString() })
    .eq('id', item.id)
    .eq('user_id', userId);
  if (updateError) throw new DatasetContractError('CODEX_SYNC_UPDATE_FAILED', updateError.message, {}, 500);

  let applied = 0;
  for (const binding of candidates) {
    const storageKey = binding.target_storage_key || binding.target_key;
    const previousValue = item.details?.[storageKey];
    const nextValue = binding.target_kind === 'field'
      ? prepared.storageDelta?.[storageKey]
      : detailsDelta[binding.target_key];
    if (stableStringify(previousValue) === stableStringify(nextValue)) {
      skipped++;
      continue;
    }
    applied++;
    await recordSyncEvent(supabase, eventPayload({
      operationId,
      userId,
      originKind,
      originId: row.id,
      sourceKind: 'dataset_row',
      sourceId: row.id,
      targetKind: 'codex_item',
      targetId: item.id,
      fieldKey: binding.target_key,
      previousValue,
      nextValue,
      metadata: { dataset_id: dataset.id, column_key: binding.column_key },
    }));
  }

  await supabase.from('datasets').update({ last_codex_sync: new Date().toISOString() }).eq('id', dataset.id);
  return { applied, conflicts, skipped, codex_item_id: item.id };
}

async function syncRowToCodex(params, userId) {
  const supabase = getSupabaseAdmin();
  const dataset = await loadDataset(supabase, params.dataset_id, userId);
  assertUuid(params.row_id, 'row_id');
  const { data: row, error } = await supabase
    .from('dataset_rows')
    .select('*')
    .eq('id', params.row_id)
    .eq('dataset_id', dataset.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw new DatasetContractError('DATASET_ROW_READ_FAILED', error.message, {}, 500);
  if (!row) throw new DatasetContractError('DATASET_ROW_NOT_FOUND', 'Fila no encontrada.', {}, 404);
  const operationId = params.operation_id || crypto.randomUUID();
  assertUuid(operationId, 'operation_id');
  return {
    success: true,
    operation_id: operationId,
    ...(await syncRowToCodexWithClient(supabase, dataset, row, userId, operationId, params.origin_kind || 'api')),
  };
}

async function setDatasetConnection(supabase, dataset, config) {
  const now = new Date().toISOString();
  const matchConfig = { column: config.match_column, type: config.match_type };
  const { error } = await supabase
    .from('datasets')
    .update({
      row_codex_type: config.item_type,
      connection_mode: config.connection_mode,
      match_config: matchConfig,
      updated_at: now,
    })
    .eq('id', dataset.id)
    .eq('user_id', dataset.user_id);
  if (error) throw new DatasetContractError('DATASET_CONNECTION_UPDATE_FAILED', error.message, {}, 500);

  const legacyPayload = {
    codex_item_type: config.item_type,
    codex_connection_mode: config.connection_mode,
    codex_match_column: config.match_column,
    codex_match_type: config.match_type,
    updated_at: now,
  };
  if (dataset.legacy_source === 'private_datasets') {
    const { error: legacyError } = await supabase.from('private_datasets').update(legacyPayload).eq('id', dataset.id);
    if (legacyError) throw new DatasetContractError('LEGACY_DATASET_UPDATE_FAILED', legacyError.message, {}, 500);
  } else if (dataset.legacy_source === 'public_datasets') {
    const { error: legacyError } = await supabase.from('public_datasets').update(legacyPayload).eq('id', dataset.id);
    if (legacyError) throw new DatasetContractError('LEGACY_DATASET_UPDATE_FAILED', legacyError.message, {}, 500);
  }
}

async function applyAlignment(params, userId) {
  const operationId = params.operation_id || crypto.randomUUID();
  assertUuid(operationId, 'operation_id');
  if (params.confirmed !== true) {
    throw new DatasetContractError('CONFIRMATION_REQUIRED', 'Debes enviar confirmed=true después de revisar la vista previa.');
  }
  if (!params.preview_token) throw new DatasetContractError('PREVIEW_TOKEN_REQUIRED', 'Debes confirmar una vista previa vigente.');
  if (!Array.isArray(params.decisions)) throw new DatasetContractError('DECISIONS_ARRAY_REQUIRED', 'decisions debe ser una lista.');
  if (!Array.isArray(params.bindings)) {
    throw new DatasetContractError('BINDINGS_ARRAY_REQUIRED', 'Debes reenviar la lista completa de bindings revisada, aunque esté vacía.');
  }

  const supabase = getSupabaseAdmin();
  const dataset = await loadDataset(supabase, params.dataset_id, userId);
  const { data: marker, error: markerReadError } = await supabase
    .from('codex_sync_events')
    .select('id, status, metadata')
    .eq('operation_id', operationId)
    .eq('field_key', '__alignment__')
    .maybeSingle();
  if (markerReadError) throw new DatasetContractError('IDEMPOTENCY_READ_FAILED', markerReadError.message, {}, 500);
  if (marker?.status === 'applied') {
    return { success: true, idempotent_replay: true, operation_id: operationId, result: marker.metadata?.result || null };
  }
  if (marker?.status === 'pending') {
    throw new DatasetContractError('OPERATION_IN_PROGRESS', 'La operación ya está en curso.', { operation_id: operationId }, 409);
  }

  const preview = await previewAlignment(params, userId);
  if (preview.preview_token !== params.preview_token) {
    throw new DatasetContractError(
      'PREVIEW_STALE',
      'El conjunto o Codex cambió después de la vista previa. Genera una nueva antes de aplicar.',
      { expected: preview.preview_token, received: params.preview_token },
      409
    );
  }

  const itemType = preview.config.item_type;
  const connectionMode = params.connection_mode || 'track';
  if (!['track', 'sync'].includes(connectionMode)) {
    throw new DatasetContractError('INVALID_CONNECTION_MODE', 'connection_mode debe ser track o sync.');
  }

  const resolvedBindings = await resolveBindings(
    supabase,
    { ...dataset, row_codex_type: itemType },
    userId,
    params.bindings || []
  );
  const rows = await loadAllRows(supabase, dataset.id);
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  const matchesByRow = new Map(preview.matches.map((match) => [match.row_id, match]));
  const seenDecisionRows = new Set();
  const validatedDecisions = [];
  for (const decision of params.decisions) {
    const row = rowsById.get(decision?.row_id);
    if (!row) throw new DatasetContractError('DECISION_ROW_NOT_FOUND', `Fila desconocida: ${decision?.row_id}`);
    if (seenDecisionRows.has(row.id)) {
      throw new DatasetContractError('DUPLICATE_ROW_DECISION', `La fila ${row.id} tiene más de una decisión.`);
    }
    seenDecisionRows.add(row.id);
    const action = decision.action || 'skip';
    if (!['skip', 'link', 'create'].includes(action)) {
      throw new DatasetContractError('INVALID_DECISION_ACTION', `Acción desconocida: ${action}`);
    }
    if (action === 'create' && params.allow_create !== true) {
      throw new DatasetContractError('CREATE_NOT_CONFIRMED', 'allow_create=true es requerido para crear ítems.');
    }
    if (action === 'create') {
      const previewMatch = matchesByRow.get(row.id);
      if (['exact', 'alias', 'ambiguous'].includes(previewMatch?.status)) {
        throw new DatasetContractError(
          'CODEX_MATCH_ALREADY_EXISTS',
          `La fila ${row.id} coincide con uno o más ítems existentes; vincula o descarta en vez de crear un duplicado.`,
          { row_id: row.id, candidates: previewMatch.candidates }
        );
      }
      const proposedName = String(decision.name || previewMatch?.display_value || '').trim();
      if (!proposedName) throw new DatasetContractError('CODEX_ITEM_NAME_REQUIRED', `La fila ${row.id} no tiene nombre para crear el ítem.`);
      validatedDecisions.push({ decision, row, action, proposedName });
      continue;
    }
    if (action === 'link') {
      const previewMatch = matchesByRow.get(row.id);
      const acceptedCandidate = params.accept_exact === true
        && ['exact', 'alias'].includes(previewMatch?.status)
        && previewMatch.candidates.length === 1
        ? previewMatch.candidates[0]
        : null;
      const itemId = decision.codex_item_id || acceptedCandidate?.codex_item_id;
      if (!itemId) throw new DatasetContractError('CODEX_ITEM_ID_REQUIRED', `La fila ${row.id} necesita codex_item_id.`);
      const item = await loadOwnedCodexItem(supabase, itemId, userId, itemType);
      validatedDecisions.push({ decision, row, action, item, acceptedCandidate });
      continue;
    }
    validatedDecisions.push({ decision, row, action });
  }

  if (marker) {
    const { error } = await supabase.from('codex_sync_events').update({ status: 'pending', error: null }).eq('id', marker.id);
    if (error) throw new DatasetContractError('IDEMPOTENCY_UPDATE_FAILED', error.message, {}, 500);
  } else {
    await recordSyncEvent(supabase, eventPayload({
      operationId,
      userId,
      originKind: params.origin_kind || 'api',
      originId: dataset.id,
      sourceKind: 'dataset',
      sourceId: dataset.id,
      targetKind: 'dataset',
      targetId: dataset.id,
      fieldKey: '__alignment__',
      previousValue: null,
      nextValue: { preview_token: params.preview_token },
      status: 'pending',
      metadata: { dataset_id: dataset.id },
    }));
  }

  const result = { linked: 0, created: 0, skipped: 0, synced_fields: 0, conflicts: 0, rows: [], errors: [] };
  let savedBindings = [];
  try {
    savedBindings = await replaceBindings(supabase, dataset, userId, resolvedBindings);
    await setDatasetConnection(supabase, dataset, {
      ...preview.config,
      connection_mode: connectionMode,
    });
    const activeDataset = { ...dataset, row_codex_type: itemType, connection_mode: connectionMode };

    for (const plan of validatedDecisions) {
      const { decision, row, action } = plan;
      if (action === 'skip') {
        result.skipped++;
        result.rows.push({ row_id: row.id, action: 'skip' });
        continue;
      }

      let item = plan.item;
      let method = decision.match_method || 'manual';
      let score = decision.match_score ?? null;
      if (action === 'create') {
        const existingLink = await loadActiveLink(supabase, row.id);
        if (existingLink?.status === 'confirmed') {
          item = await loadOwnedCodexItem(supabase, existingLink.codex_item_id, userId, itemType);
        } else {
          item = await createCodexItem(supabase, userId, itemType, plan.proposedName);
          result.created++;
        }
        method = 'manual';
      } else if (action === 'link') {
        if (!decision.codex_item_id && plan.acceptedCandidate) {
          method = plan.acceptedCandidate.method;
          score = plan.acceptedCandidate.score;
        }
      }

      await confirmLink(supabase, row, item, userId, method, score);
      result.linked++;
      result.rows.push({ row_id: row.id, action, codex_item: { id: item.id, name: item.name, tipo: item.tipo } });
      if (connectionMode === 'sync' && savedBindings.length) {
        const syncResult = await syncRowToCodexWithClient(supabase, activeDataset, row, userId, operationId, params.origin_kind || 'api');
        result.synced_fields += syncResult.applied;
        result.conflicts += syncResult.conflicts;
      }
    }

    const { error: markerError } = await supabase
      .from('codex_sync_events')
      .update({ status: 'applied', applied_at: new Date().toISOString(), metadata: { dataset_id: dataset.id, result } })
      .eq('operation_id', operationId)
      .eq('field_key', '__alignment__');
    if (markerError) throw new DatasetContractError('IDEMPOTENCY_FINALIZE_FAILED', markerError.message, {}, 500);
    return { success: true, operation_id: operationId, bindings: savedBindings, result };
  } catch (error) {
    await supabase
      .from('codex_sync_events')
      .update({ status: 'failed', error: error.message, metadata: { dataset_id: dataset.id, partial_result: result } })
      .eq('operation_id', operationId)
      .eq('field_key', '__alignment__');
    throw error;
  }
}

async function listRows(params, userId) {
  const supabase = getSupabaseAdmin();
  const dataset = await loadDataset(supabase, params.dataset_id, userId, { allowPublicRead: true });
  const limit = Math.min(Math.max(Number(params.limit) || 100, 1), 500);
  const offset = Math.max(Number(params.offset) || 0, 0);
  const { data: rows, error, count } = await supabase
    .from('dataset_rows')
    .select('id, source_row_key, position, values, revision, updated_at', { count: 'exact' })
    .eq('dataset_id', dataset.id)
    .is('deleted_at', null)
    .order('position', { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw new DatasetContractError('DATASET_ROWS_READ_FAILED', error.message, {}, 500);

  const rowIds = (rows || []).map((row) => row.id);
  let links = [];
  let codexItems = [];
  if (rowIds.length && dataset.user_id === userId) {
    const { data, error: linkError } = await supabase
      .from('dataset_row_codex_links')
      .select('id, dataset_row_id, codex_item_id, status, match_method, match_score')
      .in('dataset_row_id', rowIds)
      .in('status', ['pending', 'confirmed']);
    if (linkError) throw new DatasetContractError('LINKS_READ_FAILED', linkError.message, {}, 500);
    links = data || [];
    const itemIds = [...new Set(links.map((link) => link.codex_item_id))];
    if (itemIds.length) {
      const { data: itemData, error: itemError } = await supabase
        .from('codex_universe_items')
        .select('id, name, tipo')
        .eq('user_id', userId)
        .in('id', itemIds);
      if (itemError) throw new DatasetContractError('CODEX_ITEMS_READ_FAILED', itemError.message, {}, 500);
      codexItems = itemData || [];
    }
  }
  const itemsById = new Map(codexItems.map((item) => [item.id, item]));
  const linksByRow = new Map(links.map((link) => [link.dataset_row_id, link]));
  return {
    success: true,
    dataset: { id: dataset.id, name: dataset.name, visibility: dataset.visibility, connection_mode: dataset.connection_mode, row_codex_type: dataset.row_codex_type },
    rows: (rows || []).map((row) => {
      const link = linksByRow.get(row.id) || null;
      return {
        ...row,
        codex_link: link ? { ...link, codex_item: itemsById.get(link.codex_item_id) || null } : null,
      };
    }),
    pagination: { offset, limit, total: count || 0, returned: rows?.length || 0 },
  };
}

async function updateRow(params, userId) {
  const supabase = getSupabaseAdmin();
  const dataset = await loadDataset(supabase, params.dataset_id, userId);
  assertUuid(params.row_id, 'row_id');
  const updates = params.updates || params.values;
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
    throw new DatasetContractError('ROW_UPDATES_REQUIRED', 'updates debe ser un objeto.');
  }
  const columns = schemaColumnKeys(dataset);
  const unknown = columns.size ? Object.keys(updates).filter((key) => !columns.has(key)) : [];
  if (unknown.length) throw new DatasetContractError('UNKNOWN_DATASET_COLUMNS', 'Hay columnas desconocidas.', { columns: unknown });

  const { data: current, error: readError } = await supabase
    .from('dataset_rows')
    .select('*')
    .eq('id', params.row_id)
    .eq('dataset_id', dataset.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (readError) throw new DatasetContractError('DATASET_ROW_READ_FAILED', readError.message, {}, 500);
  if (!current) throw new DatasetContractError('DATASET_ROW_NOT_FOUND', 'Fila no encontrada.', {}, 404);
  if (params.expected_revision !== undefined
      && params.expected_revision !== null
      && Number(params.expected_revision) !== Number(current.revision)) {
    throw new DatasetContractError('ROW_REVISION_CONFLICT', 'La fila cambió desde la última lectura.', { expected: params.expected_revision, current: current.revision }, 409);
  }

  const nextValues = { ...(current.values || {}), ...updates };
  const { data: updated, error } = await supabase
    .from('dataset_rows')
    .update({ values: nextValues })
    .eq('id', current.id)
    .eq('revision', current.revision)
    .select('*')
    .maybeSingle();
  if (error) throw new DatasetContractError('DATASET_ROW_UPDATE_FAILED', error.message, {}, 500);
  if (!updated) throw new DatasetContractError('ROW_REVISION_CONFLICT', 'Otra operación modificó la fila.', {}, 409);

  const operationId = params.operation_id || crypto.randomUUID();
  assertUuid(operationId, 'operation_id');
  const sync = await syncRowToCodexWithClient(supabase, dataset, updated, userId, operationId, params.origin_kind || 'api');
  return { success: true, operation_id: operationId, row: updated, sync };
}

async function bindColumn(params, userId) {
  if (params.confirmed !== true) throw new DatasetContractError('CONFIRMATION_REQUIRED', 'Debes enviar confirmed=true para aprobar la asignación.');
  const supabase = getSupabaseAdmin();
  const dataset = await loadDataset(supabase, params.dataset_id, userId);
  if (!dataset.row_codex_type) throw new DatasetContractError('ROW_CODEX_TYPE_REQUIRED', 'Configura primero el tipo de Codex del conjunto.');
  const bindings = await resolveBindings(supabase, dataset, userId, [params.binding || params]);
  const saved = await saveBindings(supabase, dataset, userId, bindings);
  return { success: true, binding: saved[0], requires_initial_sync: dataset.connection_mode === 'sync' };
}

async function unbindColumn(params, userId) {
  if (params.confirmed !== true) throw new DatasetContractError('CONFIRMATION_REQUIRED', 'Debes enviar confirmed=true para desactivar la asignación.');
  const supabase = getSupabaseAdmin();
  const dataset = await loadDataset(supabase, params.dataset_id, userId);
  let query = supabase.from('dataset_field_bindings').update({ active: false, updated_at: new Date().toISOString() }).eq('dataset_id', dataset.id).eq('user_id', userId);
  if (params.binding_id) {
    assertUuid(params.binding_id, 'binding_id');
    query = query.eq('id', params.binding_id);
  } else if (params.column_key) query = query.eq('column_key', params.column_key);
  else throw new DatasetContractError('BINDING_IDENTIFIER_REQUIRED', 'Envía binding_id o column_key.');
  const { data, error } = await query.select('*').maybeSingle();
  if (error) throw new DatasetContractError('BINDING_DISABLE_FAILED', error.message, {}, 500);
  if (!data) throw new DatasetContractError('BINDING_NOT_FOUND', 'Asignación no encontrada.', {}, 404);
  return { success: true, binding: data };
}

async function detachRow(params, userId) {
  if (params.confirmed !== true) throw new DatasetContractError('CONFIRMATION_REQUIRED', 'Debes enviar confirmed=true para separar la fila de Codex.');
  const supabase = getSupabaseAdmin();
  const dataset = await loadDataset(supabase, params.dataset_id, userId);
  assertUuid(params.row_id, 'row_id');
  const { data: row, error: rowError } = await supabase
    .from('dataset_rows')
    .select('id')
    .eq('id', params.row_id)
    .eq('dataset_id', dataset.id)
    .maybeSingle();
  if (rowError) throw new DatasetContractError('DATASET_ROW_READ_FAILED', rowError.message, {}, 500);
  if (!row) throw new DatasetContractError('DATASET_ROW_NOT_FOUND', 'Fila no encontrada.', {}, 404);
  const { data, error } = await supabase
    .from('dataset_row_codex_links')
    .update({ status: 'detached', updated_at: new Date().toISOString() })
    .eq('dataset_row_id', row.id)
    .eq('user_id', userId)
    .in('status', ['pending', 'confirmed'])
    .select('*')
    .maybeSingle();
  if (error) throw new DatasetContractError('LINK_DETACH_FAILED', error.message, {}, 500);
  if (!data) throw new DatasetContractError('ACTIVE_LINK_NOT_FOUND', 'La fila no tiene un vínculo activo.', {}, 404);
  return { success: true, link: data };
}

async function getSyncStatus(params, userId) {
  const supabase = getSupabaseAdmin();
  const dataset = await loadDataset(supabase, params.dataset_id, userId);
  const rows = await loadAllRows(supabase, dataset.id);
  const rowIds = rows.map((row) => row.id);
  const linkQuery = rowIds.length
    ? supabase.from('dataset_row_codex_links').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'confirmed').in('dataset_row_id', rowIds)
    : Promise.resolve({ count: 0, error: null });
  const [links, bindings, conflicts] = await Promise.all([
    linkQuery,
    supabase.from('dataset_field_bindings').select('id, column_key, target_kind, target_key, direction, empty_policy, approved_at').eq('dataset_id', dataset.id).eq('active', true).order('column_key'),
    supabase.from('codex_sync_events').select('id', { count: 'exact', head: true }).eq('user_id', userId).contains('metadata', { dataset_id: dataset.id }).in('status', ['conflict', 'failed']),
  ]);
  for (const response of [links, bindings, conflicts]) {
    if (response.error) throw new DatasetContractError('SYNC_STATUS_READ_FAILED', response.error.message, {}, 500);
  }
  return {
    success: true,
    dataset: {
      id: dataset.id,
      name: dataset.name,
      connection_mode: dataset.connection_mode,
      row_codex_type: dataset.row_codex_type,
      row_count: dataset.row_count,
      last_codex_sync: dataset.last_codex_sync,
    },
    confirmed_links: links.count || 0,
    active_bindings: bindings.data?.length || 0,
    bindings: bindings.data || [],
    unresolved_events: conflicts.count || 0,
  };
}

async function listSyncEvents(params, userId, forcedStatuses = null) {
  const supabase = getSupabaseAdmin();
  const dataset = await loadDataset(supabase, params.dataset_id, userId);
  const limit = Math.min(Math.max(Number(params.limit) || 50, 1), 200);
  const allowedStatuses = new Set(['pending', 'applied', 'skipped', 'conflict', 'failed']);
  const requestedStatuses = forcedStatuses || params.statuses || [];
  if (!Array.isArray(requestedStatuses)) {
    throw new DatasetContractError('SYNC_STATUSES_ARRAY_REQUIRED', 'statuses debe ser una lista.');
  }
  const statuses = [...new Set(requestedStatuses)].filter((status) => allowedStatuses.has(status));
  if (requestedStatuses.length && statuses.length !== requestedStatuses.length) {
    throw new DatasetContractError('INVALID_SYNC_STATUS', 'Hay estados de sincronización no válidos.', {
      allowed: [...allowedStatuses],
    });
  }
  let query = supabase
    .from('codex_sync_events')
    .select('*')
    .eq('user_id', userId)
    .contains('metadata', { dataset_id: dataset.id })
    .order('occurred_at', { ascending: false });
  if (statuses.length) query = query.in('status', statuses);
  const { data, error } = await query.limit(limit);
  if (error) throw new DatasetContractError('SYNC_EVENTS_READ_FAILED', error.message, {}, 500);
  const events = data || [];
  const rowIds = [...new Set(events.flatMap((event) => [
    event.source_kind === 'dataset_row' ? event.source_id : null,
    event.target_kind === 'dataset_row' ? event.target_id : null,
  ]).filter(Boolean))];
  const itemIds = [...new Set(events.flatMap((event) => [
    event.source_kind === 'codex_item' ? event.source_id : null,
    event.target_kind === 'codex_item' ? event.target_id : null,
  ]).filter(Boolean))];
  const [rowResponse, itemResponse] = await Promise.all([
    rowIds.length
      ? supabase.from('dataset_rows').select('id, position, source_row_key').eq('dataset_id', dataset.id).in('id', rowIds)
      : Promise.resolve({ data: [], error: null }),
    itemIds.length
      ? supabase.from('codex_universe_items').select('id, name, tipo').eq('user_id', userId).in('id', itemIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (rowResponse.error) throw new DatasetContractError('SYNC_EVENT_ROWS_READ_FAILED', rowResponse.error.message, {}, 500);
  if (itemResponse.error) throw new DatasetContractError('SYNC_EVENT_ITEMS_READ_FAILED', itemResponse.error.message, {}, 500);
  const rowsById = new Map((rowResponse.data || []).map((row) => [row.id, row]));
  const itemsById = new Map((itemResponse.data || []).map((item) => [item.id, item]));
  const summaryFor = (kind, id) => {
    if (kind === 'dataset_row') return rowsById.get(id) || { id };
    if (kind === 'codex_item') return itemsById.get(id) || { id };
    if (kind === 'dataset') return { id: dataset.id, name: dataset.name };
    return { id };
  };
  const hydrated = events.map((event) => ({
    ...event,
    source: summaryFor(event.source_kind, event.source_id),
    target: summaryFor(event.target_kind, event.target_id),
  }));
  return { success: true, dataset_id: dataset.id, events: hydrated, total: hydrated.length };
}

async function listConflicts(params, userId) {
  const result = await listSyncEvents(params, userId, ['conflict', 'failed']);
  return { ...result, conflicts: result.events };
}

module.exports = {
  DatasetContractError,
  previewAlignment,
  applyAlignment,
  listRows,
  updateRow,
  bindColumn,
  unbindColumn,
  detachRow,
  getSyncStatus,
  listSyncEvents,
  listConflicts,
  syncRowToCodex,
  _private: {
    normalizeToken,
    extractCellValue,
    tokenSimilarity,
    stableStringify,
    buildItemIndexes,
    matchRow,
  },
};
