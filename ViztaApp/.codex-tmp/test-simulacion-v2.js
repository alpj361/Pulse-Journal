const assert = require('assert');
require('dotenv').config({ path: '.env' });
const supabase = require('./server/utils/supabase');
const { ejecutarSimulacion } = require('./server/services/simulacion');

(async () => {
  let simulationId = null;
  try {
    const { data: profiles, error: profileError } = await supabase.from('profiles').select('id').limit(1);
    if (profileError) throw profileError;
    assert(profiles?.[0]?.id, 'No test user available');
    const user = { id: profiles[0].id };

    const created = await ejecutarSimulacion({
      operation: 'crear',
      titulo: 'Codex v4.1 integration test',
      escenario: 'Prueba temporal de persistencia',
      personas: [{ fuente: 'sintetica', n: 2, perfil: 'Participante temporal', etiqueta: 'Test' }],
      turnos: 2,
      batch: 1,
      seed: 'contract-v41-fixed-seed',
    }, user);
    assert.equal(created.success, true, JSON.stringify(created));
    assert.match(created.sim_id, /^[0-9a-f-]{36}$/i);
    simulationId = created.sim_id;
    assert(created.turn_token);

    const stateOne = await ejecutarSimulacion({ operation: 'estado', sim_id: simulationId }, user);
    const stateTwo = await ejecutarSimulacion({ operation: 'estado', sim_id: simulationId }, user);
    assert.equal(stateOne.turn_token, created.turn_token);
    assert.equal(stateTwo.turn_token, created.turn_token);
    assert.equal(stateOne.turnos_emitidos, stateTwo.turnos_emitidos);

    const firstPerson = created.turno[0].persona_id;
    const acted = await ejecutarSimulacion({
      operation: 'actuar',
      sim_id: simulationId,
      turn_token: created.turn_token,
      acciones: [{ persona_id: firstPerson, tipo: 'publicar', texto: 'Mensaje temporal' }],
    }, user);
    assert.equal(acted.success, true, JSON.stringify(acted));
    assert.equal(acted.idempotent, false);

    const retried = await ejecutarSimulacion({
      operation: 'actuar',
      sim_id: simulationId,
      turn_token: created.turn_token,
      acciones: [{ persona_id: firstPerson, tipo: 'publicar', texto: 'No debe duplicarse' }],
    }, user);
    assert.equal(retried.success, true, JSON.stringify(retried));
    assert.equal(retried.idempotent, true);

    const secondPerson = acted.turno[0].persona_id;
    const completed = await ejecutarSimulacion({
      operation: 'actuar',
      sim_id: simulationId,
      turn_token: acted.turn_token,
      acciones: [{ persona_id: secondPerson, tipo: 'callar' }],
    }, user);
    assert.equal(completed.success, true, JSON.stringify(completed));
    assert.equal(completed.turno.length, 0);

    const report = await ejecutarSimulacion({ operation: 'reporte', sim_id: simulationId }, user);
    assert.equal(report.success, true);
    assert.equal(report.metricas.acciones, 2);
    assert.equal(report.metricas.silencios, 1);

    const analysis = await ejecutarSimulacion({
      operation: 'guardar_analisis',
      sim_id: simulationId,
      analisis: 'Análisis temporal de integración.',
    }, user);
    assert.equal(analysis.success, true);

    const listed = await ejecutarSimulacion({ operation: 'listar', limit: 10 }, user);
    assert(listed.simulations.some((row) => row.id === simulationId));

    const { count: eventCount, error: countError } = await supabase
      .from('codex_simulation_events')
      .select('id', { count: 'exact', head: true })
      .eq('simulation_id', simulationId);
    if (countError) throw countError;
    assert.equal(eventCount, 2);

    console.log(JSON.stringify({
      passed: true,
      persisted: true,
      state_read_only: true,
      idempotent_retry: true,
      events: eventCount,
      report_actions: report.metricas.acciones,
      silences: report.metricas.silencios,
    }));
  } finally {
    if (simulationId) {
      const { error } = await supabase.from('codex_simulations').delete().eq('id', simulationId);
      if (error) console.error('cleanup_failed', error.message);
    }
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
