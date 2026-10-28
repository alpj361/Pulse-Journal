const {
  SCHEMA_VERSION,
  CODEX_FIELD_TYPES,
  CODEX_PRESETS,
  CODEX_SPECIAL_PRESETS,
  getFieldsForTipo,
  PRESET_TIPO_ALIAS,
  TIPOS_VALIDOS,
  UNIVERSE_ITEM_TYPES,
  AUXILIARY_CONTENT_TYPES,
  RESOURCE_TYPES,
  STORAGE_TYPES,
  normalizeTipo,
  resolvePresetTipo,
  slugFieldPart,
  systemFieldKey,
  getTypeDefinition,
} = require('./codexSchema');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KEY_RE = /^[a-z][a-z0-9_]{2,95}$/;
const REF_TYPES = new Set(['ref', 'refs', 'archivo', 'imagen']);
const STRING_TYPES = new Set(['texto', 'parrafo', 'hora', 'telefono', 'id']);

class CodexContractError extends Error {
  constructor(code, message, details = {}, status = 400) {
    super(message);
    this.name = 'CodexContractError';
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

function canonicalItemType(value) {
  return normalizeTipo(value).tipo || resolvePresetTipo(value);
}

function fieldConfig(field) {
  const config = {};
  if (Array.isArray(field.options)) config.options = field.options;
  if (Array.isArray(field.poles)) config.poles = field.poles;
  if (Array.isArray(field.cols)) config.cols = field.cols;
  if (field.formula) config.formula = field.formula;
  return config;
}

function getSystemFields(tipo) {
  const entries = tipo
    ? [[canonicalItemType(tipo), getFieldsForTipo(canonicalItemType(tipo))]]
    : Object.keys(CODEX_PRESETS).map((itemType) => [itemType, getFieldsForTipo(itemType)]);
  return entries.flatMap(([itemType, fields]) => fields.map((field) => ({
    field_key: field.field_key || systemFieldKey(itemType, field.label),
    label: field.label,
    field_type: field.type,
    config: fieldConfig(field),
    item_types: [itemType],
    origin: 'system',
    readonly: Boolean(field.readonly || field.type === 'formula'),
    storage_key: field.label,
  })));
}

function getSystemPresets() {
  const bases = Object.entries(CODEX_PRESETS).map(([tipo, fields]) => ({
    preset_key: `sys_base_${slugFieldPart(tipo)}`,
    label: `${tipo} · Base`,
    description: `Campos base sugeridos para ${tipo}`,
    item_types: [tipo],
    field_keys: fields.map((field) => field.field_key || systemFieldKey(tipo, field.label)),
    origin: 'system',
  }));
  return [...bases, ...CODEX_SPECIAL_PRESETS.map((preset) => ({ ...preset, origin: 'system' }))];
}

async function loadUserFields(supabase, userId, options = {}) {
  if (!userId) return [];
  let query = supabase
    .from('codex_user_fields')
    .select('id, field_key, label, field_type, config, item_types, reason, created_by, active, created_at, updated_at')
    .eq('user_id', userId)
    .order('label');
  if (!options.includeInactive) query = query.eq('active', true);
  const { data, error } = await query;
  if (error) throw new CodexContractError('CATALOG_READ_FAILED', error.message, {}, 500);
  return (data || []).map((field) => ({
    ...field,
    config: field.config || {},
    item_types: field.item_types || [],
    origin: 'user',
    readonly: false,
    storage_key: field.field_key,
  }));
}

async function loadUserPresets(supabase, userId, options = {}) {
  if (!userId) return [];
  let query = supabase
    .from('codex_user_presets')
    .select('id, preset_key, label, description, item_types, field_keys, active, created_at, updated_at')
    .eq('user_id', userId)
    .order('label');
  if (!options.includeInactive) query = query.eq('active', true);
  const { data, error } = await query;
  if (error) throw new CodexContractError('PRESET_READ_FAILED', error.message, {}, 500);
  return (data || []).map((preset) => ({ ...preset, origin: 'user' }));
}

async function getMergedSchema(supabase, userId = null, tipo = null) {
  const canon = tipo ? canonicalItemType(tipo) : null;
  const [userFields, userPresets] = await Promise.all([
    loadUserFields(supabase, userId),
    loadUserPresets(supabase, userId),
  ]);
  const applies = (itemTypes) => !canon || !itemTypes?.length || itemTypes.includes(canon);
  const systemFields = getSystemFields(canon);
  const systemPresets = getSystemPresets().filter((preset) => applies(preset.item_types));
  const visibleUserFields = userFields.filter((field) => applies(field.item_types));
  const visibleUserPresets = userPresets.filter((preset) => applies(preset.item_types));
  const baseKey = canon ? `sys_base_${slugFieldPart(canon)}` : null;
  const base = canon ? systemPresets.find((preset) => preset.preset_key === baseKey) : null;
  return {
    version: SCHEMA_VERSION,
    itemTypes: [...UNIVERSE_ITEM_TYPES],
    auxiliaryTypes: [...AUXILIARY_CONTENT_TYPES],
    resourceTypes: [...RESOURCE_TYPES],
    storageTypes: [...STORAGE_TYPES],
    typeDefinitions: [...STORAGE_TYPES, ...RESOURCE_TYPES]
      .map((itemType) => getTypeDefinition(itemType)),
    fieldTypes: CODEX_FIELD_TYPES,
    tipoAlias: PRESET_TIPO_ALIAS,
    fields: [...systemFields, ...visibleUserFields],
    presetDefinitions: [...systemPresets, ...visibleUserPresets],
    baseFieldKeys: base?.field_keys || [],
    // Compatibilidad de lectura para clientes v3: móvil todavía espera un
    // objeto tipo -> campos bajo `presets`.
    presets: CODEX_PRESETS,
    legacyPresets: CODEX_PRESETS,
  };
}

function normalizeToken(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function similarity(query, candidate) {
  if (!query || !candidate) return 0;
  if (query === candidate) return 1;
  if (candidate.includes(query) || query.includes(candidate)) return 0.8;
  const left = new Set(query.split(/\s+/).filter(Boolean));
  const right = new Set(candidate.split(/\s+/).filter(Boolean));
  const common = [...left].filter((part) => right.has(part)).length;
  return common ? common / Math.max(left.size, right.size) : 0;
}

async function resolveField(supabase, userId, input = {}) {
  const schema = await getMergedSchema(supabase, userId, input.tipo);
  const key = String(input.field_key || '').trim().toLowerCase();
  const label = normalizeToken(input.label || input.field_label);
  const requestedType = input.field_type || null;
  const ranked = schema.fields
    .map((field) => {
      const keyExact = key && field.field_key === key;
      const labelScore = label ? similarity(label, normalizeToken(field.label)) : 0;
      const typePenalty = requestedType && requestedType !== field.field_type ? 0.2 : 0;
      return { field, score: keyExact || labelScore === 1 ? 1 : Math.max(0, labelScore - typePenalty) };
    })
    .filter((entry) => entry.score >= 0.34)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
  const exact = ranked.find((entry) => entry.score === 1)?.field || null;
  return {
    status: exact ? 'matched' : ranked.length ? 'candidates' : 'not_found',
    exact,
    candidates: ranked.map(({ field, score }) => ({ ...field, score: Number(score.toFixed(2)) })),
    can_create: !exact,
  };
}

function validateItemTypes(raw) {
  const values = Array.isArray(raw) ? [...new Set(raw.map(canonicalItemType))] : [];
  if (!values.length || values.some((tipo) => !TIPOS_VALIDOS.includes(tipo))) {
    throw new CodexContractError('INVALID_ITEM_TYPES', `item_types debe contener tipos válidos: ${TIPOS_VALIDOS.join(', ')}`);
  }
  return values;
}

function canonicalUserKey(raw, prefix = 'usr') {
  const proposed = slugFieldPart(raw);
  const key = proposed.startsWith(`${prefix}_`) ? proposed : `${prefix}_${proposed}`;
  if (!KEY_RE.test(key) || key.startsWith('sys_')) {
    throw new CodexContractError('INVALID_FIELD_KEY', 'La clave debe usar letras minúsculas, números y guiones bajos.', { proposed: raw });
  }
  return key;
}

function normalizeFieldConfig(fieldType, raw = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new CodexContractError('INVALID_FIELD_CONFIG', 'config debe ser un objeto');
  }
  const allowedByType = {
    dropdown: ['options'],
    eje: ['poles'],
    repetible: ['cols'],
    formula: ['formula'],
  };
  const allowed = allowedByType[fieldType] || [];
  const unknown = Object.keys(raw).filter((key) => !allowed.includes(key));
  if (unknown.length) {
    throw new CodexContractError('INVALID_FIELD_CONFIG', `config contiene propiedades no válidas para ${fieldType}.`, { unknown, allowed });
  }
  if (fieldType === 'dropdown') {
    const options = Array.isArray(raw.options) ? [...new Set(raw.options.map((value) => String(value).trim()).filter(Boolean))] : [];
    if (!options.length) throw new CodexContractError('FIELD_OPTIONS_REQUIRED', 'dropdown requiere config.options');
    return { options };
  }
  if (fieldType === 'eje') {
    const poles = Array.isArray(raw.poles) ? raw.poles.map((value) => String(value).trim()) : [];
    if (poles.length !== 2 || poles.some((value) => !value)) throw new CodexContractError('FIELD_POLES_REQUIRED', 'eje requiere exactamente dos config.poles');
    return { poles };
  }
  if (fieldType === 'repetible') {
    const cols = Array.isArray(raw.cols) ? raw.cols.map((value) => String(value).trim()).filter(Boolean) : [];
    if (!cols.length) throw new CodexContractError('FIELD_COLS_REQUIRED', 'repetible requiere config.cols');
    return { cols };
  }
  if (fieldType === 'formula') {
    const formula = String(raw.formula || '').trim();
    if (!formula) throw new CodexContractError('FIELD_FORMULA_REQUIRED', 'formula requiere config.formula');
    return { formula };
  }
  return {};
}

async function createUserField(supabase, userId, input = {}, createdBy = 'user') {
  if (!userId) throw new CodexContractError('UNAUTHENTICATED', 'Usuario no autenticado', {}, 401);
  const label = String(input.label || input.field_label || '').trim();
  const fieldType = String(input.field_type || '').trim();
  const reason = String(input.reason || input.field_reason || '').trim();
  if (!label) throw new CodexContractError('FIELD_LABEL_REQUIRED', 'label es requerido');
  if (!CODEX_FIELD_TYPES.includes(fieldType)) {
    throw new CodexContractError('INVALID_FIELD_TYPE', `field_type inválido: ${fieldType}`, { allowed: CODEX_FIELD_TYPES });
  }
  if (!reason) throw new CodexContractError('FIELD_REASON_REQUIRED', 'reason es requerido para crear un campo');
  const itemTypes = validateItemTypes(input.item_types || (input.tipo ? [input.tipo] : []));
  const resolution = await resolveField(supabase, userId, { tipo: itemTypes[0], label, field_type: fieldType });
  if (resolution.exact) {
    throw new CodexContractError('FIELD_ALREADY_EXISTS', 'Ya existe un campo equivalente; reutiliza su field_key.', { field: resolution.exact }, 409);
  }
  const fieldKey = canonicalUserKey(input.field_key || label);
  const config = normalizeFieldConfig(fieldType, input.config || {});
  const { data, error } = await supabase
    .from('codex_user_fields')
    .insert({
      user_id: userId,
      field_key: fieldKey,
      label,
      field_type: fieldType,
      config,
      item_types: itemTypes,
      reason,
      created_by: ['agent', 'migration'].includes(createdBy) ? createdBy : 'user',
    })
    .select('id, field_key, label, field_type, config, item_types, reason, created_by')
    .single();
  if (error?.code === '23505') {
    throw new CodexContractError('FIELD_KEY_CONFLICT', 'La clave ya existe para este usuario.', { field_key: fieldKey }, 409);
  }
  if (error) throw new CodexContractError('FIELD_CREATE_FAILED', error.message, {}, 500);
  return { ...data, origin: 'user', readonly: false, storage_key: data.field_key };
}

async function updateUserField(supabase, userId, fieldKey, input = {}) {
  if (!userId) throw new CodexContractError('UNAUTHENTICATED', 'Usuario no autenticado', {}, 401);
  const { data: current, error: readError } = await supabase
    .from('codex_user_fields')
    .select('id, field_key, label, field_type, config, item_types, reason, created_by, active')
    .eq('user_id', userId)
    .eq('field_key', fieldKey)
    .maybeSingle();
  if (readError) throw new CodexContractError('FIELD_READ_FAILED', readError.message, {}, 500);
  if (!current) throw new CodexContractError('FIELD_NOT_FOUND', 'Campo personal no encontrado.', { field_key: fieldKey }, 404);
  if (input.field_key && input.field_key !== fieldKey) throw new CodexContractError('FIELD_KEY_IMMUTABLE', 'field_key no se puede cambiar.', {}, 409);
  if (input.field_type && input.field_type !== current.field_type) {
    throw new CodexContractError('FIELD_TYPE_IMMUTABLE', 'El tipo de un campo existente no cambia: crea un campo nuevo y migra sus valores.', { current: current.field_type, requested: input.field_type }, 409);
  }
  const label = input.label !== undefined || input.field_label !== undefined
    ? String(input.label || input.field_label || '').trim()
    : current.label;
  if (!label) throw new CodexContractError('FIELD_LABEL_REQUIRED', 'label es requerido');
  const itemTypes = input.item_types !== undefined
    ? validateItemTypes(input.item_types)
    : current.item_types;
  const config = input.config !== undefined
    ? normalizeFieldConfig(current.field_type, input.config)
    : current.config;
  const reason = input.reason !== undefined || input.field_reason !== undefined
    ? String(input.reason || input.field_reason || '').trim()
    : current.reason;
  if (!reason) throw new CodexContractError('FIELD_REASON_REQUIRED', 'reason no puede quedar vacío');
  const schema = await getMergedSchema(supabase, userId);
  const conflict = schema.fields.find((field) => field.field_key !== fieldKey && normalizeToken(field.label) === normalizeToken(label));
  if (conflict) throw new CodexContractError('FIELD_ALREADY_EXISTS', 'Ya existe un campo con ese label; reutiliza su field_key.', { field: conflict }, 409);
  const patch = {
    label,
    item_types: itemTypes,
    config,
    reason,
    active: input.active === undefined ? current.active : Boolean(input.active),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('codex_user_fields')
    .update(patch)
    .eq('user_id', userId)
    .eq('field_key', fieldKey)
    .select('id, field_key, label, field_type, config, item_types, reason, created_by, active, created_at, updated_at')
    .single();
  if (error) throw new CodexContractError('FIELD_UPDATE_FAILED', error.message, {}, 500);
  return { ...data, origin: 'user', readonly: false, storage_key: data.field_key };
}

async function deactivateUserField(supabase, userId, fieldKey) {
  return updateUserField(supabase, userId, fieldKey, { active: false });
}

async function validatePresetDefinition(supabase, userId, itemTypes, fieldKeys) {
  if (!fieldKeys.length) throw new CodexContractError('PRESET_FIELDS_REQUIRED', 'field_keys debe incluir al menos un campo');
  const schema = await getMergedSchema(supabase, userId);
  const known = new Map(schema.fields.map((field) => [field.field_key, field]));
  const unknown = fieldKeys.filter((key) => !known.has(key));
  if (unknown.length) throw new CodexContractError('UNKNOWN_FIELD_KEYS', 'El preset contiene claves desconocidas.', { unknown });
  const wrongScope = fieldKeys.filter((key) => {
    const applies = known.get(key)?.item_types || [];
    return applies.length && !itemTypes.some((tipo) => applies.includes(tipo));
  });
  if (wrongScope.length) throw new CodexContractError('FIELD_SCOPE_MISMATCH', 'Hay campos que no aplican a los tipos del preset.', { field_keys: wrongScope });
}

async function createUserPreset(supabase, userId, input = {}) {
  if (!userId) throw new CodexContractError('UNAUTHENTICATED', 'Usuario no autenticado', {}, 401);
  const label = String(input.label || input.preset_label || '').trim();
  if (!label) throw new CodexContractError('PRESET_LABEL_REQUIRED', 'label es requerido');
  const itemTypes = validateItemTypes(input.item_types || (input.tipo ? [input.tipo] : []));
  const fieldKeys = [...new Set(Array.isArray(input.field_keys) ? input.field_keys : [])];
  await validatePresetDefinition(supabase, userId, itemTypes, fieldKeys);
  const presetKey = canonicalUserKey(input.preset_key || label, 'usr_preset');
  const { data, error } = await supabase
    .from('codex_user_presets')
    .insert({
      user_id: userId,
      preset_key: presetKey,
      label,
      description: String(input.description || '').trim() || null,
      item_types: itemTypes,
      field_keys: fieldKeys,
    })
    .select('id, preset_key, label, description, item_types, field_keys')
    .single();
  if (error?.code === '23505') throw new CodexContractError('PRESET_KEY_CONFLICT', 'La clave del preset ya existe.', { preset_key: presetKey }, 409);
  if (error) throw new CodexContractError('PRESET_CREATE_FAILED', error.message, {}, 500);
  return { ...data, origin: 'user' };
}

async function updateUserPreset(supabase, userId, presetKey, input = {}) {
  if (!userId) throw new CodexContractError('UNAUTHENTICATED', 'Usuario no autenticado', {}, 401);
  const { data: current, error: readError } = await supabase
    .from('codex_user_presets')
    .select('id, preset_key, label, description, item_types, field_keys, active')
    .eq('user_id', userId)
    .eq('preset_key', presetKey)
    .maybeSingle();
  if (readError) throw new CodexContractError('PRESET_READ_FAILED', readError.message, {}, 500);
  if (!current) throw new CodexContractError('PRESET_NOT_FOUND', 'Preset personal no encontrado.', { preset_key: presetKey }, 404);
  if (input.preset_key && input.preset_key !== presetKey) throw new CodexContractError('PRESET_KEY_IMMUTABLE', 'preset_key no se puede cambiar.', {}, 409);
  const label = input.label !== undefined || input.preset_label !== undefined
    ? String(input.label || input.preset_label || '').trim()
    : current.label;
  if (!label) throw new CodexContractError('PRESET_LABEL_REQUIRED', 'label es requerido');
  const itemTypes = input.item_types !== undefined ? validateItemTypes(input.item_types) : current.item_types;
  const fieldKeys = input.field_keys !== undefined
    ? [...new Set(Array.isArray(input.field_keys) ? input.field_keys : [])]
    : current.field_keys;
  await validatePresetDefinition(supabase, userId, itemTypes, fieldKeys);
  const { data, error } = await supabase
    .from('codex_user_presets')
    .update({
      label,
      description: input.description === undefined ? current.description : String(input.description || '').trim() || null,
      item_types: itemTypes,
      field_keys: fieldKeys,
      active: input.active === undefined ? current.active : Boolean(input.active),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('preset_key', presetKey)
    .select('id, preset_key, label, description, item_types, field_keys, active, created_at, updated_at')
    .single();
  if (error) throw new CodexContractError('PRESET_UPDATE_FAILED', error.message, {}, 500);
  return { ...data, origin: 'user' };
}

async function deactivateUserPreset(supabase, userId, presetKey) {
  return updateUserPreset(supabase, userId, presetKey, { active: false });
}

function invalid(field, expected, received, correction) {
  throw new CodexContractError('INVALID_FIELD_SHAPE', `Shape inválido para ${field.field_key}.`, {
    field_key: field.field_key,
    field_type: field.field_type,
    expected,
    received,
    correction,
  });
}

function hasOnlyKeys(value, allowed) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).every((key) => allowed.includes(key));
}

function validateFieldValue(field, value) {
  const type = field.field_type;
  const config = field.config || {};
  if (value === null) return null;
  if (field.readonly || type === 'formula') invalid(field, 'campo derivado de solo lectura', value, 'No envíes este campo.');
  if (STRING_TYPES.has(type)) {
    if (typeof value !== 'string') invalid(field, 'string', value, 'Envía texto.');
    return value;
  }
  if (type === 'fecha') {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid(field, 'YYYY-MM-DD', value, 'Usa una fecha ISO.');
    return value;
  }
  if (type === 'link') {
    if (typeof value !== 'string' || !/^https?:\/\//i.test(value)) invalid(field, 'URL http(s)', value, 'Usa una URL completa.');
    return value;
  }
  if (type === 'email') {
    if (typeof value !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) invalid(field, 'email válido', value, 'Usa correo@dominio.');
    return value;
  }
  if (type === 'numero') {
    if (typeof value !== 'number' || !Number.isFinite(value)) invalid(field, 'number finito', value, 'Envía un número sin unidades.');
    return value;
  }
  if (type === 'porcentaje') {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) invalid(field, 'número 0..100', value, '25% se envía como 25.');
    return value;
  }
  if (type === 'escala') {
    if (!Number.isInteger(value) || value < 1 || value > 5) invalid(field, 'entero 1..5', value, 'Envía un entero entre 1 y 5.');
    return value;
  }
  if (type === 'booleano') {
    if (typeof value !== 'boolean') invalid(field, 'boolean', value, 'Envía true o false.');
    return value;
  }
  if (type === 'dropdown') {
    if (typeof value !== 'string' || (config.options?.length && !config.options.includes(value))) invalid(field, config.options || 'string', value, 'Usa una opción declarada.');
    return value;
  }
  if (type === 'tags') {
    if (!Array.isArray(value) || value.some((tag) => typeof tag !== 'string' || !tag.trim())) invalid(field, 'string[]', value, 'Envía una lista de etiquetas no vacías.');
    return [...new Set(value.map((tag) => tag.trim()))];
  }
  if (type === 'moneda') {
    if (!hasOnlyKeys(value, ['amount', 'cur']) || !('amount' in value) || !/^[A-Z]{3}$/.test(String(value.cur || ''))) invalid(field, '{ amount, cur }', value, 'Ejemplo: {"amount":"5000","cur":"GTQ"}.');
    return { amount: String(value.amount), cur: String(value.cur).toUpperCase() };
  }
  if (type === 'rango') {
    if (!hasOnlyKeys(value, ['from', 'to', 'gran']) || (typeof value.from !== 'string' && typeof value.to !== 'string')) invalid(field, '{ from, to, gran? }', value, 'Envía al menos from o to como texto de fecha.');
    return { ...(typeof value.from === 'string' ? { from: value.from } : {}), ...(typeof value.to === 'string' ? { to: value.to } : {}), ...(value.gran ? { gran: value.gran } : {}) };
  }
  if (type === 'eje') {
    if (!hasOnlyKeys(value, ['value']) || !Number.isInteger(value.value) || value.value < -100 || value.value > 100) invalid(field, '{ value: entero -100..100 }', value, 'Los polos viven en config; envía solo value.');
    return { value: value.value };
  }
  if (type === 'geo') {
    if (!hasOnlyKeys(value, ['lat', 'lng']) || !Number.isFinite(value.lat) || !Number.isFinite(value.lng) || Math.abs(value.lat) > 90 || Math.abs(value.lng) > 180) invalid(field, '{ lat, lng }', value, 'Envía coordenadas válidas.');
    return { lat: value.lat, lng: value.lng };
  }
  if (type === 'ref' || type === 'archivo' || type === 'imagen') {
    if (!hasOnlyKeys(value, ['id']) || !UUID_RE.test(String(value.id || ''))) invalid(field, '{ id: UUID_REAL }', value, 'Busca primero el item del Codex y usa solamente su UUID.');
    return { id: value.id };
  }
  if (type === 'refs') {
    if (!Array.isArray(value) || value.some((entry) => !hasOnlyKeys(entry, ['id']) || !UUID_RE.test(String(entry.id || '')))) invalid(field, '[{ id: UUID_REAL }]', value, 'Usa solamente UUIDs reales del Codex.');
    return value.map((entry) => ({ id: entry.id }));
  }
  if (type === 'repetible') {
    const cols = config.cols || [];
    const rows = value?.rows;
    if (!hasOnlyKeys(value, ['rows']) || !Array.isArray(rows) || rows.some((row) => !Array.isArray(row) || row.some((cell) => typeof cell !== 'string') || (cols.length && row.length !== cols.length))) invalid(field, `{ rows: string[][]${cols.length ? `; ${cols.length} columnas` : ''} }`, value, 'Cada fila debe respetar las columnas del campo.');
    return { rows };
  }
  if (type === 'color') {
    if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) invalid(field, '#RRGGBB', value, 'Envía un color hexadecimal.');
    return value.toUpperCase();
  }
  invalid(field, type, value, 'Consulta /api/codex/schema para el contrato vigente.');
}

function idsFromValue(type, value) {
  if (value == null) return [];
  if (type === 'refs') return value.map((entry) => entry.id);
  return REF_TYPES.has(type) ? [value.id] : [];
}

function canonicalReadValue(field, value) {
  if (value == null) return value;
  if (field.field_type === 'refs' && Array.isArray(value)) return value.map((entry) => ({ id: entry.id }));
  if (REF_TYPES.has(field.field_type) && value?.id) return { id: value.id };
  if (field.field_type === 'eje' && value?.value != null) return { value: value.value };
  return value;
}

async function prepareFieldPatch(supabase, userId, tipo, fieldValues = {}) {
  if (!fieldValues || typeof fieldValues !== 'object' || Array.isArray(fieldValues)) {
    throw new CodexContractError('FIELDS_OBJECT_REQUIRED', 'fields debe ser un objeto keyed por field_key');
  }
  const schema = await getMergedSchema(supabase, userId, tipo);
  const byKey = new Map(schema.fields.map((field) => [field.field_key, field]));
  const normalized = {};
  const refs = new Set();
  for (const [fieldKey, rawValue] of Object.entries(fieldValues)) {
    const field = byKey.get(fieldKey);
    if (!field) throw new CodexContractError('UNKNOWN_FIELD_KEY', `Campo desconocido: ${fieldKey}`, { field_key: fieldKey });
    const value = validateFieldValue(field, rawValue);
    normalized[fieldKey] = { field, value };
    for (const id of idsFromValue(field.field_type, value)) refs.add(id);
  }
  let hydrated = new Map();
  if (refs.size) {
    const { data, error } = await supabase
      .from('codex_universe_items')
      .select('id, name, tipo')
      .eq('user_id', userId)
      .in('id', [...refs]);
    if (error) throw new CodexContractError('REF_LOOKUP_FAILED', error.message, {}, 500);
    hydrated = new Map((data || []).map((item) => [item.id, item]));
    const missing = [...refs].filter((id) => !hydrated.has(id));
    if (missing.length) throw new CodexContractError('INVALID_CODEX_REFS', 'Hay referencias inexistentes o ajenas al usuario.', { ids: missing });
  }
  const storageDelta = {};
  const canonicalValues = {};
  for (const [fieldKey, entry] of Object.entries(normalized)) {
    const { field, value } = entry;
    canonicalValues[fieldKey] = value;
    let stored = value;
    // Puente de lectura para frontends v3: contract v4 acepta solo {id}, pero
    // details conserva temporalmente name/tipo hasta que los clientes hidraten.
    if (value !== null && field.field_type === 'refs') stored = value.map(({ id }) => hydrated.get(id));
    else if (value !== null && REF_TYPES.has(field.field_type)) stored = hydrated.get(value.id);
    storageDelta[field.storage_key || field.label || field.field_key] = stored;
  }
  return { storageDelta, canonicalValues, fieldKeys: Object.keys(normalized), schema };
}

async function applyPresetKeys(supabase, userId, tipo, requested = []) {
  const schema = await getMergedSchema(supabase, userId, tipo);
  const byKey = new Map(schema.presetDefinitions.map((preset) => [preset.preset_key, preset]));
  const presetKeys = [...new Set(requested || [])];
  const unknown = presetKeys.filter((key) => !byKey.has(key));
  if (unknown.length) throw new CodexContractError('UNKNOWN_PRESET_KEYS', 'Hay presets desconocidos.', { unknown });
  const fieldKeys = [...new Set(presetKeys.flatMap((key) => byKey.get(key).field_keys || []))];
  return { presetKeys, fieldKeys };
}

const MIGRATION_ALIASES = {
  Actor: { profesion: 'Profesión' },
  Territorio: { lider: 'Quién controla' },
  Evento: { resultado: 'Resultado / desenlace' },
};

function fieldKeysFromDetails(details, tipo, userFields = []) {
  const canon = canonicalItemType(tipo);
  const fields = [...getSystemFields(canon), ...userFields.filter((field) => !field.item_types?.length || field.item_types.includes(canon))];
  const byLabel = new Map(fields.map((field) => [normalizeToken(field.label), field.field_key]));
  const aliases = MIGRATION_ALIASES[canon] || {};
  const result = [];
  for (const rawKey of Object.keys(details || {})) {
    const aliased = aliases[rawKey] || rawKey;
    const fieldKey = byLabel.get(normalizeToken(aliased));
    if (fieldKey) result.push(fieldKey);
  }
  return [...new Set(result)];
}

async function resolveItemFields(supabase, userId, item) {
  const schema = await getMergedSchema(supabase, userId, item.tipo);
  const byKey = new Map(schema.fields.map((field) => [field.field_key, field]));
  const inferred = fieldKeysFromDetails(item.details || {}, item.tipo, schema.fields.filter((field) => field.origin === 'user'));
  const presetByKey = new Map(schema.presetDefinitions.map((preset) => [preset.preset_key, preset]));
  const currentPresetFieldKeys = [...new Set((item.preset_keys || [])
    .flatMap((presetKey) => presetByKey.get(presetKey)?.field_keys || []))];
  const newPresetFieldKeys = currentPresetFieldKeys.filter((fieldKey) => !(item.field_keys || []).includes(fieldKey));
  const stalePresetKeys = (item.preset_keys || []).filter((presetKey) => !presetByKey.has(presetKey));
  const keys = [...new Set([...(item.field_keys || []), ...inferred, ...currentPresetFieldKeys])];
  const fields = keys.map((fieldKey) => {
    const field = byKey.get(fieldKey);
    if (!field) return null;
    const storageKey = field.storage_key || field.label || field.field_key;
    const stored = item.details?.[storageKey] ?? item.details?.[field.field_key] ?? item.details?.[field.label];
    let status = 'valid';
    if (stored !== undefined) {
      try { validateFieldValue(field, canonicalReadValue(field, stored)); } catch (_) { status = 'legacy_invalid'; }
    }
    return {
      ...field,
      value: canonicalReadValue(field, stored),
      has_value: stored !== undefined && stored !== null && stored !== '',
      new_from_preset: newPresetFieldKeys.includes(fieldKey),
      status,
    };
  }).filter(Boolean);
  return { fields, schema, newPresetFieldKeys, stalePresetKeys };
}

module.exports = {
  CodexContractError,
  canonicalItemType,
  getSystemFields,
  getSystemPresets,
  loadUserFields,
  loadUserPresets,
  getMergedSchema,
  resolveField,
  createUserField,
  updateUserField,
  deactivateUserField,
  createUserPreset,
  updateUserPreset,
  deactivateUserPreset,
  validateFieldValue,
  normalizeFieldConfig,
  prepareFieldPatch,
  applyPresetKeys,
  fieldKeysFromDetails,
  resolveItemFields,
};
