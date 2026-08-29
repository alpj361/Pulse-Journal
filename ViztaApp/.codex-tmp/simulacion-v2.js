/**
 * Motor de simulación multiagente persistente.
 *
 * El modelo llamante interpreta a las personas. Este servicio conserva el
 * escenario, snapshots, red, cola determinista y eventos en Supabase.
 */

const crypto = require('crypto');
const { resolveItemFields } = require('./codexContractV4');

const TIPOS = new Set(['publicar', 'responder', 'amplificar', 'callar', 'otra']);
const RASGOS = ['escéptico', 'entusiasta', 'cauto', 'confrontativo', 'analítico', 'emotivo', 'pragmático', 'idealista', 'irónico', 'conciliador'];
const TONOS = ['formal', 'coloquial', 'técnico', 'directo', 'sarcástico'];
const IMPLICACION = ['sigue el tema de cerca', 'se entera de refilón', 'le afecta directamente', 'lo ve como espectador', 'tiene interés profesional en el tema'];
const MIN_CONEXIONES = 3;
const VENTANA = 10;
const ITEM_COLUMNS = 'id, user_id, tipo, is_profile, name, description, details, field_keys, preset_keys';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const cleanIds = (values) => [...new Set((Array.isArray(values) ? values : []).filter(Boolean).map(String))];

function fail(error, code = 'SIMULATION_ERROR', details = undefined) {
  return { success: false, error, code, ...(details ? { details } : {}) };
}

function seededRandom(seed) {
  const digest = crypto.createHash('sha256').update(String(seed)).digest();
  let state = digest.readUInt32LE(0) || 0x6d2b79f5;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') return null;
  if (Array.isArray(value)) {
    const rendered = value.map(formatValue).filter(Boolean);
    return rendered.length ? rendered.join(', ') : null;
  }
  if (typeof value !== 'object') return String(value);
  if (value.name) return String(value.name);
  if (value.value !== undefined && Array.isArray(value.poles)) {
    return `${value.value} en el eje ${value.poles[0] || '−'}↔${value.poles[1] || '+'}`;
  }
  if (value.id) return String(value.id);
  return JSON.stringify(value);
}

function syntheticPerson(idx, group, position, count) {
  const posture = count > 1 ? Math.round(-100 + (200 * position) / (count - 1)) : 0;
  return {
    id: `p${idx}`,
    nombre: `${group.etiqueta || 'Persona'} ${position + 1}`,
    origen: 'sintetica',
    codexId: null,
    tipo: 'Sintética',
    isProfile: true,
    profileSourceIds: [],
    perfil: {
      descripcion: group.perfil || 'Participante del debate público',
      campos: [
        `Rasgo dominante: ${RASGOS[position % RASGOS.length]}`,
        `Tono: ${TONOS[position % TONOS.length]}`,
        `Relación con el tema: ${IMPLICACION[position % IMPLICACION.length]}`,
        `Postura: ${posture} en el eje (-100 = un extremo · 0 = neutro · +100 = el otro)`,
      ],
    },
    postura: posture,
    partido: null,
    actividad: 0.3 + ((position * 7) % 10) / 14,
    sigue: [],
  };
}

function rawFieldValue(item, field) {
  const details = item.details && typeof item.details === 'object' ? item.details : {};
  return details[field.storage_key] ?? details[field.field_key] ?? details[field.label] ?? field.value;
}

async function profileFromCodex(item, supabase, userId) {
  const resolved = await resolveItemFields(supabase, userId, item);
  const fields = resolved.fields.filter((field) => field.has_value);
  const readable = fields.map((field) => {
    const rendered = formatValue(rawFieldValue(item, field));
    return rendered ? `${field.label}: ${rendered}` : null;
  }).filter(Boolean);
  const byKey = new Map(fields.map((field) => [field.field_key, field.value]));
  const profileSourceIds = (Array.isArray(byKey.get('sys_actor_profile_sources'))
    ? byKey.get('sys_actor_profile_sources')
    : [])
    .map((value) => typeof value === 'string' ? value : value?.id)
    .filter(Boolean);
  const axes = fields.filter((field) => field.field_type === 'eje');
  const firstAxis = axes.find((field) => typeof field.value?.value === 'number');
  const party = fields.find((field) => /partido|afiliaci[oó]n/i.test(field.label));
  return {
    perfil: { descripcion: item.description || null, campos: readable },
    postura: Number(firstAxis?.value?.value) || 0,
    partido: formatValue(party?.value),
    profileSourceIds,
  };
}

async function resolvePeople(spec, user, supabase) {
  const people = [];
  let index = 0;
  for (const group of spec) {
    if (group.fuente === 'codex') {
      let ids = cleanIds(group.ids);
      if (!ids.length && (group.dataset_id || group.tipo || group.filtro)) {
        let query = supabase.from('codex_universe_items').select('id').eq('user_id', user.id);
        if (group.dataset_id) query = query.contains('details', { datasets: [group.dataset_id] });
        if (group.tipo) query = query.eq('tipo', group.tipo);
        const { data, error } = await query.limit(200);
        if (error) throw new Error(`No se pudieron resolver participantes: ${error.message}`);
        ids = (data || []).map((row) => row.id);
      }
      if (!ids.length) continue;
      const { data: items, error } = await supabase
        .from('codex_universe_items')
        .select(ITEM_COLUMNS)
        .eq('user_id', user.id)
        .in('id', ids.slice(0, 200));
      if (error) throw new Error(`No se pudieron leer participantes: ${error.message}`);
      const byId = new Map((items || []).map((item) => [item.id, item]));
      for (const id of ids) {
        const item = byId.get(id);
        if (!item) continue;
        if (group.filtro && typeof group.filtro === 'object') {
          const details = item.details || {};
          const passes = Object.entries(group.filtro).every(([key, expected]) => {
            const value = formatValue(details[key]);
            return String(value || '').toLowerCase().includes(String(expected).toLowerCase());
          });
          if (!passes) continue;
        }
        const snapshot = await profileFromCodex(item, supabase, user.id);
        people.push({
          id: `p${index++}`,
          nombre: item.name,
          origen: 'codex',
          codexId: item.id,
          tipo: item.tipo,
          isProfile: Boolean(item.is_profile),
          profileSourceIds: snapshot.profileSourceIds,
          perfil: snapshot.perfil,
          postura: snapshot.postura,
          partido: snapshot.partido,
          actividad: 0.6,
          sigue: [],
        });
      }
    } else if (group.fuente === 'sintetica') {
      const count = clamp(parseInt(group.n, 10) || 10, 1, 150);
      for (let position = 0; position < count; position++) {
        people.push(syntheticPerson(index++, group, position, count));
      }
    }
  }
  return people;
}

async function resolveSources(explicitIds, people, user, supabase) {
  const ids = cleanIds([
    ...cleanIds(explicitIds),
    ...people.flatMap((person) => person.profileSourceIds || []),
  ]);
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from('codex_universe_items')
    .select(ITEM_COLUMNS)
    .eq('user_id', user.id)
    .eq('tipo', 'Source')
    .in('id', ids);
  if (error) throw new Error(`No se pudieron leer Sources: ${error.message}`);
  const byId = new Map((data || []).map((item) => [item.id, item]));
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length) {
    const errorMissing = new Error('Uno o más source_ids no existen, no son Source o pertenecen a otro usuario.');
    errorMissing.code = 'INVALID_SOURCE_IDS';
    errorMissing.details = { source_ids: missing };
    throw errorMissing;
  }
  const snapshots = [];
  for (const id of ids) {
    const item = byId.get(id);
    const resolved = await resolveItemFields(supabase, user.id, item);
    snapshots.push({
      id: item.id,
      name: item.name,
      description: item.description,
      fields: Object.fromEntries(resolved.fields
        .filter((field) => field.has_value)
        .map((field) => [field.field_key, field.value])),
    });
  }
  return snapshots;
}

async function buildNetwork(people, user, supabase) {
  const connect = (left, right) => {
    if (!left || !right || left.id === right.id) return;
    if (!left.sigue.includes(right.id)) left.sigue.push(right.id);
    if (!right.sigue.includes(left.id)) right.sigue.push(left.id);
  };
  let fromCodex = 0;
  const codexPeople = people.filter((person) => person.codexId);
  if (codexPeople.length >= 2) {
    const byCodex = new Map(codexPeople.map((person) => [person.codexId, person]));
    const ids = codexPeople.map((person) => person.codexId);
    const { data, error } = await supabase
      .from('codex_relations')
      .select('subject_id, object_id')
      .eq('user_id', user.id)
      .in('subject_id', ids);
    if (error) throw new Error(`No se pudo construir la red: ${error.message}`);
    for (const relation of data || []) {
      const left = byCodex.get(relation.subject_id);
      const right = byCodex.get(relation.object_id);
      if (left && right) {
        connect(left, right);
        fromCodex++;
      }
    }
  }
  for (const person of people) {
    if (person.sigue.length >= MIN_CONEXIONES) continue;
    const candidates = people
      .filter((other) => other.id !== person.id && !person.sigue.includes(other.id))
      .map((other) => {
        let distance = Math.abs((other.postura || 0) - (person.postura || 0));
        if (person.partido && other.partido && person.partido === other.partido) distance -= 120;
        return { other, distance };
      })
      .sort((a, b) => a.distance - b.distance || a.other.id.localeCompare(b.other.id));
    for (const candidate of candidates) {
      if (person.sigue.length >= MIN_CONEXIONES) break;
      connect(person, candidate.other);
    }
  }
  const edges = people.reduce((sum, person) => sum + person.sigue.length, 0) / 2;
  return {
    origen: fromCodex > 0 ? 'relaciones del Codex + afinidad' : 'afinidad',
    aristas: Math.round(edges),
    deCodex: fromCodex,
  };
}

function buildQueue(people, turns, seed) {
  const random = seededRandom(seed);
  const shuffled = [...people];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
  }
  const queue = [];
  let cursor = 0;
  while (queue.length < turns) {
    const person = shuffled[cursor % shuffled.length];
    const firstPass = cursor < shuffled.length;
    if (firstPass || random() < person.actividad) queue.push(person.id);
    cursor++;
    if (cursor > turns * 50) break;
  }
  return queue.slice(0, turns);
}

function rowStatus(status) {
  return ({ active: 'activa', completed: 'completada', failed: 'fallida', cancelled: 'cancelada', archived: 'archivada' })[status] || status;
}

function eventFromRow(event) {
  return {
    id: event.payload?.logical_id || event.id,
    dbId: event.id,
    autor: event.participant_id,
    autorNombre: event.participant_name,
    tipo: event.action_type,
    texto: event.content,
    descripcion: event.description,
    a: event.payload?.reply_to_logical_id || event.reply_to_event_id || null,
    publico: event.is_public,
    turno: event.turn_number,
  };
}

function simulationFromRow(row, eventRows = []) {
  const runtime = row.runtime_state || {};
  return {
    id: row.id,
    userId: row.user_id,
    titulo: row.title,
    escenario: row.scenario,
    personas: row.participants_snapshot || [],
    sources: row.sources_snapshot || [],
    red: row.network_snapshot || {},
    cola: runtime.queue || [],
    cursor: Number(runtime.cursor) || 0,
    batch: Number(runtime.batch || row.config?.batch) || 1,
    pending: runtime.pending || null,
    seed: runtime.seed || row.config?.seed,
    timeline: eventRows.map(eventFromRow),
    status: rowStatus(row.status),
    dbStatus: row.status,
    version: row.version,
    analysis: row.analysis,
    metrics: row.metrics,
    createdAt: row.created_at,
  };
}

async function loadSimulation(supabase, userId, simulationId, includeEvents = true) {
  if (!userId) return { error: fail('Usuario no autenticado', 'UNAUTHENTICATED') };
  if (!simulationId) return { error: fail('sim_id es requerido', 'SIM_ID_REQUIRED') };
  const { data: row, error } = await supabase
    .from('codex_simulations')
    .select('*')
    .eq('id', simulationId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`No se pudo leer la simulación: ${error.message}`);
  if (!row) return { error: fail('sim_id no encontrado o ajeno al usuario.', 'SIMULATION_NOT_FOUND') };
  let events = [];
  if (includeEvents) {
    const result = await supabase
      .from('codex_simulation_events')
      .select('*')
      .eq('simulation_id', simulationId)
      .order('turn_number', { ascending: true })
      .order('created_at', { ascending: true });
    if (result.error) throw new Error(`No se pudieron leer los eventos: ${result.error.message}`);
    events = result.data || [];
  }
  return { row, events, sim: simulationFromRow(row, events) };
}

function contextFor(sim, person) {
  const follows = new Set(person.sigue || []);
  const own = sim.timeline.filter((event) => follows.has(event.autor));
  const rest = sim.timeline.filter((event) => !follows.has(event.autor) && event.autor !== person.id);
  return [...own.slice(-VENTANA), ...rest.slice(-Math.max(0, VENTANA - own.length))]
    .sort((a, b) => a.turno - b.turno)
    .slice(-VENTANA)
    .map((event) => ({
      id: event.id,
      de: event.autorNombre,
      tipo: event.tipo,
      texto: event.texto || event.descripcion || null,
      responde_a: event.a || undefined,
    }));
}

function turnPayload(sim, personId) {
  const person = sim.personas.find((candidate) => candidate.id === personId);
  if (!person) return null;
  return {
    persona_id: person.id,
    nombre: person.nombre,
    origen: person.origen,
    es_perfil: Boolean(person.isProfile),
    perfil: {
      descripcion: person.perfil?.descripcion || null,
      datos: person.perfil?.campos || [],
    },
    ve: contextFor(sim, person),
  };
}

function issueNext(sim) {
  if (sim.pending) return sim.pending;
  const from = sim.cursor;
  const participantIds = sim.cola.slice(from, from + sim.batch);
  if (!participantIds.length) return null;
  const to = from + participantIds.length;
  const tokenHash = crypto.createHash('sha256')
    .update(`${sim.id || 'new'}:${sim.seed}:${from}:${participantIds.join(',')}`)
    .digest('hex').slice(0, 16);
  sim.cursor = to;
  sim.pending = { token: `turn_${from + 1}_${tokenHash}`, from, to, participant_ids: participantIds };
  return sim.pending;
}

function currentBatch(sim) {
  return (sim.pending?.participant_ids || []).map((id) => turnPayload(sim, id)).filter(Boolean);
}

function instruction(sim, batch) {
  const remaining = sim.cola.length - sim.cursor;
  if (!batch.length) {
    return `SIMULACIÓN COMPLETA (${sim.cola.length} turnos). Llama simular con operation="reporte" y sim_id="${sim.id}".`;
  }
  const people = batch.map((turn) => `${turn.nombre} (persona_id="${turn.persona_id}")`).join(', ');
  return `TU TURNO: actúa como ${people}. Usa su perfil y solamente lo que esa persona ve. ` +
    `Luego llama simular con operation="actuar", sim_id="${sim.id}", turn_token="${sim.pending.token}" y una acción por persona. ` +
    `Quedan ${remaining} turno(s) después de este lote. Continúa hasta que la simulación indique que está completa.`;
}

function runtimeState(sim) {
  return {
    queue: sim.cola,
    cursor: sim.cursor,
    batch: sim.batch,
    seed: sim.seed,
    pending: sim.pending,
  };
}

async function crear(args, user, supabase) {
  if (!user?.id) return fail('Usuario no autenticado', 'UNAUTHENTICATED');
  const scenario = String(args.escenario || '').trim();
  if (!scenario) return fail('escenario es requerido.', 'SCENARIO_REQUIRED');
  const specs = Array.isArray(args.personas) ? args.personas : [];
  if (!specs.length) return fail('personas es requerido.', 'PARTICIPANTS_REQUIRED');
  const people = await resolvePeople(specs, user, supabase);
  if (people.length < 2) {
    return fail(`Se necesitan al menos 2 personas para simular (se resolvieron ${people.length}).`, 'INSUFFICIENT_PARTICIPANTS');
  }
  const sources = await resolveSources(args.source_ids, people, user, supabase);
  if (args.parent_simulation_id) {
    const parent = await loadSimulation(supabase, user.id, args.parent_simulation_id, false);
    if (parent.error) return fail('parent_simulation_id no existe o es ajeno al usuario.', 'INVALID_PARENT_SIMULATION');
  }
  const network = await buildNetwork(people, user, supabase);
  const turns = clamp(parseInt(args.turnos, 10) || 20, 1, 200);
  const batchSize = clamp(parseInt(args.batch, 10) || 1, 1, 10);
  const seed = String(args.seed || crypto.randomUUID());
  const simulationId = crypto.randomUUID();
  const sim = {
    id: simulationId,
    userId: user.id,
    titulo: String(args.titulo || args.title || scenario).trim().slice(0, 160),
    escenario: scenario,
    personas: people,
    sources,
    red: network,
    cola: buildQueue(people, turns, seed),
    cursor: 0,
    batch: batchSize,
    pending: null,
    seed,
    timeline: [],
    status: 'activa',
    version: 1,
  };
  issueNext(sim);
  const contextIds = cleanIds([
    ...cleanIds(args.context_item_ids),
    ...people.map((person) => person.codexId).filter(Boolean),
  ]);
  const { data: inserted, error } = await supabase
    .from('codex_simulations')
    .insert({
      id: simulationId,
      user_id: user.id,
      title: sim.titulo,
      scenario,
      status: 'active',
      engine_version: 'oasis_v2',
      version: 1,
      config: { turns, batch: batchSize, seed },
      participant_specs: specs,
      participants_snapshot: people,
      sources_snapshot: sources,
      network_snapshot: network,
      runtime_state: runtimeState(sim),
      context_item_ids: contextIds,
      source_ids: sources.map((source) => source.id),
      parent_simulation_id: args.parent_simulation_id || null,
    })
    .select('id, created_at')
    .single();
  if (error) throw new Error(`No se pudo guardar la simulación: ${error.message}`);
  sim.createdAt = inserted.created_at;
  const batch = currentBatch(sim);
  return {
    success: true,
    action: 'simular',
    operation: 'crear',
    sim_id: sim.id,
    turn_token: sim.pending?.token,
    escenario: sim.escenario,
    reproducibilidad: { seed, engine_version: 'oasis_v2', snapshots: true },
    resumen: {
      personas: people.length,
      perfiles: people.filter((person) => person.isProfile).length,
      del_codex: people.filter((person) => person.origen === 'codex').length,
      sinteticas: people.filter((person) => person.origen === 'sintetica').length,
      sources: sources.length,
      red: network.origen,
      conexiones: network.aristas,
      turnos_totales: sim.cola.length,
      por_llamada: sim.batch,
    },
    turno: batch,
    siguiente_paso: instruction(sim, batch),
    metadata: { service: 'simulacion', persisted: true },
  };
}

function normalizeActions(args) {
  return Array.isArray(args.acciones) ? args.acciones : (args.accion ? [args.accion] : []);
}

async function actuar(args, user, supabase) {
  const loaded = await loadSimulation(supabase, user?.id, args.sim_id, true);
  if (loaded.error) return loaded.error;
  const { sim, events } = loaded;
  if (args.turn_token && events.some((event) => event.turn_token === args.turn_token)) {
    const batch = currentBatch(sim);
    return {
      success: true,
      action: 'simular',
      operation: 'actuar',
      sim_id: sim.id,
      version: sim.version,
      idempotent: true,
      registradas: 0,
      turn_token: sim.pending?.token || null,
      turnos_restantes: sim.cola.length - sim.cursor,
      turno: batch,
      siguiente_paso: instruction(sim, batch),
      metadata: { service: 'simulacion', persisted: true },
    };
  }
  if (sim.dbStatus !== 'active') return fail(`La simulación está ${sim.status}.`, 'SIMULATION_NOT_ACTIVE');
  if (!sim.pending) return fail('La simulación no tiene un turno pendiente.', 'NO_PENDING_TURN');
  if (args.turn_token && args.turn_token !== sim.pending.token) {
    return fail('turn_token no corresponde al turno pendiente.', 'TURN_TOKEN_MISMATCH', { expected: sim.pending.token });
  }
  const actions = normalizeActions(args);
  if (!actions.length) return fail('acciones es requerido.', 'ACTIONS_REQUIRED');
  const expectedIds = sim.pending.participant_ids;
  const byPerson = new Map(actions.map((action) => [action.persona_id, action]));
  const missing = expectedIds.filter((id) => !byPerson.has(id));
  const unexpected = actions.map((action) => action.persona_id).filter((id) => !expectedIds.includes(id));
  if (missing.length || unexpected.length || byPerson.size !== actions.length) {
    return fail('Debe enviarse exactamente una acción por persona del turno pendiente.', 'INVALID_TURN_ACTIONS', { missing, unexpected });
  }
  const existingByLogical = new Map(events.map((event) => [event.payload?.logical_id, event.id]).filter(([id]) => id));
  const eventPayloads = expectedIds.map((participantId, offset) => {
    const action = byPerson.get(participantId);
    const person = sim.personas.find((candidate) => candidate.id === participantId);
    const type = TIPOS.has(action.tipo) ? action.tipo : 'otra';
    const logicalId = `evt_${sim.pending.from + offset + 1}`;
    const replyRaw = action.a || action.reply_to || null;
    const replyDbId = replyRaw && (existingByLogical.get(replyRaw) || events.find((event) => event.id === replyRaw)?.id);
    return {
      turn_number: sim.pending.from + offset + 1,
      participant_id: participantId,
      participant_name: person?.nombre || participantId,
      action_type: type,
      content: action.texto ? String(action.texto).slice(0, 2000) : null,
      description: action.descripcion ? String(action.descripcion).slice(0, 500) : null,
      reply_to_event_id: replyDbId || null,
      is_public: action.publico !== false,
      payload: { logical_id: logicalId, reply_to_logical_id: replyRaw },
    };
  });
  sim.pending = null;
  issueNext(sim);
  const nextStatus = sim.pending ? 'active' : 'completed';
  const { data: advanced, error } = await supabase.rpc('advance_codex_simulation', {
    p_simulation_id: sim.id,
    p_expected_version: sim.version,
    p_turn_token: args.turn_token || loaded.sim.pending.token,
    p_events: eventPayloads,
    p_runtime_state: runtimeState(sim),
    p_status: nextStatus,
    p_owner_id: user.id,
  });
  if (error) {
    const conflict = /version|conflict/i.test(error.message);
    return fail(error.message, conflict ? 'SIMULATION_VERSION_CONFLICT' : 'SIMULATION_ADVANCE_FAILED');
  }
  const refreshed = await loadSimulation(supabase, user.id, sim.id, true);
  if (refreshed.error) return refreshed.error;
  const current = refreshed.sim;
  const batch = currentBatch(current);
  return {
    success: true,
    action: 'simular',
    operation: 'actuar',
    sim_id: current.id,
    version: current.version,
    idempotent: Boolean(advanced?.idempotent),
    registradas: Number(advanced?.inserted_events ?? eventPayloads.length),
    turn_token: current.pending?.token || null,
    turnos_restantes: current.cola.length - current.cursor,
    turno: batch,
    siguiente_paso: instruction(current, batch),
    metadata: { service: 'simulacion', persisted: true },
  };
}

function calculateReport(sim) {
  const byType = {};
  const byAuthor = {};
  const amplified = {};
  for (const event of sim.timeline) {
    byType[event.tipo] = (byType[event.tipo] || 0) + 1;
    byAuthor[event.autorNombre] = (byAuthor[event.autorNombre] || 0) + 1;
    if (event.tipo === 'amplificar' && event.a) amplified[event.a] = (amplified[event.a] || 0) + 1;
    if (event.tipo === 'responder' && event.a) amplified[event.a] = (amplified[event.a] || 0) + 0.5;
  }
  const followers = {};
  for (const person of sim.personas) {
    for (const followed of person.sigue || []) followers[followed] = (followers[followed] || 0) + 1;
  }
  const mostPropagated = Object.entries(amplified)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([id, score]) => {
      const event = sim.timeline.find((candidate) => candidate.id === id);
      return event ? { id, de: event.autorNombre, texto: event.texto, eco: score } : null;
    }).filter(Boolean);
  return {
    metrics: {
      turnos_ejecutados: sim.timeline.length,
      acciones: sim.timeline.length,
      por_tipo: byType,
      mas_activos: Object.entries(byAuthor)
        .sort((left, right) => right[1] - left[1])
        .slice(0, 8)
        .map(([person, count]) => ({ persona: person, acciones: count })),
      silencios: byType.callar || 0,
      alcance_potencial: Object.keys(followers).length,
    },
    mostPropagated,
  };
}

async function reporte(args, user, supabase) {
  const loaded = await loadSimulation(supabase, user?.id, args.sim_id, true);
  if (loaded.error) return loaded.error;
  const { sim } = loaded;
  const report = calculateReport(sim);
  const { error } = await supabase
    .from('codex_simulations')
    .update({ metrics: report.metrics })
    .eq('id', sim.id)
    .eq('user_id', user.id);
  if (error) throw new Error(`No se pudieron guardar las métricas: ${error.message}`);
  return {
    success: true,
    action: 'simular',
    operation: 'reporte',
    sim_id: sim.id,
    escenario: sim.escenario,
    status: sim.status,
    reproducibilidad: { seed: sim.seed, version: sim.version, snapshots: true },
    metricas: report.metrics,
    mensajes_mas_propagados: report.mostPropagated,
    linea_de_tiempo: sim.timeline.map((event) => ({
      id: event.id,
      turno: event.turno,
      de: event.autorNombre,
      tipo: event.tipo,
      texto: event.texto || event.descripcion,
      responde_a: event.a || undefined,
    })),
    siguiente_paso: 'Redacta el análisis distinguiendo lo que la simulación muestra de lo que inferís. Después puedes guardarlo con operation="guardar_analisis".',
    metadata: { service: 'simulacion', persisted: true },
  };
}

async function estado(args, user, supabase) {
  const loaded = await loadSimulation(supabase, user?.id, args.sim_id, true);
  if (loaded.error) return loaded.error;
  const { sim } = loaded;
  const batch = currentBatch(sim);
  return {
    success: true,
    action: 'simular',
    operation: 'estado',
    sim_id: sim.id,
    status: sim.status,
    version: sim.version,
    turn_token: sim.pending?.token || null,
    turnos_emitidos: sim.cursor,
    turnos_totales: sim.cola.length,
    acciones: sim.timeline.length,
    turno: batch,
    siguiente_paso: sim.dbStatus === 'completed'
      ? `Llama simular operation="reporte" sim_id="${sim.id}".`
      : instruction(sim, batch),
    metadata: { service: 'simulacion', persisted: true, read_only: true },
  };
}

async function listar(args, user, supabase) {
  if (!user?.id) return fail('Usuario no autenticado', 'UNAUTHENTICATED');
  const limit = clamp(parseInt(args.limit, 10) || 50, 1, 100);
  let query = supabase
    .from('codex_simulations')
    .select('id, title, scenario, status, engine_version, version, config, metrics, analysis, context_item_ids, source_ids, created_at, updated_at, completed_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (args.status) query = query.eq('status', args.status);
  const { data, error } = await query;
  if (error) throw new Error(`No se pudieron listar las simulaciones: ${error.message}`);
  return { success: true, action: 'simular', operation: 'listar', simulations: data || [], metadata: { service: 'simulacion' } };
}

async function obtener(args, user, supabase) {
  const loaded = await loadSimulation(supabase, user?.id, args.sim_id, true);
  if (loaded.error) return loaded.error;
  return {
    success: true,
    action: 'simular',
    operation: 'obtener',
    simulation: loaded.row,
    events: loaded.events,
    metadata: { service: 'simulacion' },
  };
}

async function guardarAnalisis(args, user, supabase) {
  if (!String(args.analisis || '').trim()) return fail('analisis es requerido.', 'ANALYSIS_REQUIRED');
  const loaded = await loadSimulation(supabase, user?.id, args.sim_id, false);
  if (loaded.error) return loaded.error;
  const { data, error } = await supabase
    .from('codex_simulations')
    .update({ analysis: String(args.analisis).trim() })
    .eq('id', args.sim_id)
    .eq('user_id', user.id)
    .select('id, analysis, updated_at')
    .single();
  if (error) throw new Error(`No se pudo guardar el análisis: ${error.message}`);
  return { success: true, action: 'simular', operation: 'guardar_analisis', simulation: data, metadata: { service: 'simulacion' } };
}

async function cambiarEstado(args, user, supabase, status) {
  const loaded = await loadSimulation(supabase, user?.id, args.sim_id, false);
  if (loaded.error) return loaded.error;
  const { data, error } = await supabase
    .from('codex_simulations')
    .update({ status })
    .eq('id', args.sim_id)
    .eq('user_id', user.id)
    .select('id, status, updated_at')
    .single();
  if (error) throw new Error(`No se pudo cambiar el estado: ${error.message}`);
  return { success: true, action: 'simular', operation: status === 'archived' ? 'archivar' : 'cancelar', simulation: data, metadata: { service: 'simulacion' } };
}

async function ejecutarSimulacion(args = {}, user = null) {
  const supabase = require('../utils/supabase');
  try {
    switch (args.operation) {
      case 'crear': return crear(args, user, supabase);
      case 'actuar': return actuar(args, user, supabase);
      case 'reporte': return reporte(args, user, supabase);
      case 'estado': return estado(args, user, supabase);
      case 'listar': return listar(args, user, supabase);
      case 'obtener': return obtener(args, user, supabase);
      case 'guardar_analisis': return guardarAnalisis(args, user, supabase);
      case 'archivar': return cambiarEstado(args, user, supabase, 'archived');
      case 'cancelar': return cambiarEstado(args, user, supabase, 'cancelled');
      default:
        return fail(`operation inválida: "${args.operation}". Usa crear | actuar | reporte | estado | listar | obtener | guardar_analisis | archivar | cancelar.`, 'INVALID_OPERATION');
    }
  } catch (error) {
    console.error('[simulacion]', error);
    return fail(error.message || 'Error interno de simulación', error.code || 'SIMULATION_INTERNAL_ERROR', error.details);
  }
}

module.exports = {
  ejecutarSimulacion,
  loadSimulation,
  calculateReport,
};
