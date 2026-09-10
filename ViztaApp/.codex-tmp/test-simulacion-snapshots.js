const assert = require('assert');
require('dotenv').config({ path: '.env' });
const supabase = require('./server/utils/supabase');
const { createSource, updateSource, createProfile } = require('./server/services/codexResourceService');
const { ejecutarSimulacion } = require('./server/services/simulacion');

(async () => {
  let sourceId = null;
  let profileId = null;
  let simulationId = null;
  try {
    const { data: users, error: userError } = await supabase.from('profiles').select('id').limit(1);
    if (userError) throw userError;
    const user = { id: users?.[0]?.id };
    assert(user.id);

    const source = await createSource(supabase, user.id, {
      name: 'Snapshot source temporal',
      description: 'Fuente de prueba que debe quedar congelada.',
      fields: {
        sys_source_kind: 'Web',
        sys_source_url: 'https://example.com/original',
      },
    });
    sourceId = source.id;

    const profile = await createProfile(supabase, user.id, {
      name: 'Perfil temporal para snapshot',
      target: 'Personas de prueba',
      goal: 'Comprobar que el contexto es reproducible',
      known: 'Dato inicial verificable',
      fields: { sys_actor_profile_sources: [{ id: sourceId }] },
    });
    profileId = profile.id;

    const created = await ejecutarSimulacion({
      operation: 'crear',
      escenario: 'Prueba temporal de Perfil y Source',
      personas: [
        { fuente: 'codex', ids: [profileId] },
        { fuente: 'sintetica', n: 1, perfil: 'Control sintético', etiqueta: 'Control' },
      ],
      turnos: 2,
      source_ids: [sourceId],
      seed: 'profile-source-snapshot-seed',
    }, user);
    assert.equal(created.success, true, JSON.stringify(created));
    simulationId = created.sim_id;
    assert.equal(created.resumen.perfiles, 2);
    assert.equal(created.resumen.sources, 1);

    const { data: before, error: beforeError } = await supabase
      .from('codex_simulations')
      .select('participants_snapshot, sources_snapshot, source_ids, config')
      .eq('id', simulationId)
      .single();
    if (beforeError) throw beforeError;
    const profileSnapshot = before.participants_snapshot.find((person) => person.codexId === profileId);
    assert.equal(profileSnapshot.isProfile, true);
    assert(profileSnapshot.perfil.campos.some((line) => line.includes('Personas de prueba')));
    assert.equal(before.sources_snapshot[0].fields.sys_source_url, 'https://example.com/original');
    assert.deepEqual(before.source_ids, [sourceId]);
    assert.equal(before.config.seed, 'profile-source-snapshot-seed');

    await updateSource(supabase, user.id, sourceId, {
      fields: { sys_source_url: 'https://example.com/updated' },
    });
    const { data: after, error: afterError } = await supabase
      .from('codex_simulations')
      .select('sources_snapshot')
      .eq('id', simulationId)
      .single();
    if (afterError) throw afterError;
    assert.equal(after.sources_snapshot[0].fields.sys_source_url, 'https://example.com/original');

    console.log(JSON.stringify({
      passed: true,
      profile_snapshot: true,
      source_snapshot: true,
      source_auto_attached_from_profile: true,
      immutable_after_source_update: true,
      deterministic_seed: before.config.seed,
    }));
  } finally {
    if (simulationId) await supabase.from('codex_simulations').delete().eq('id', simulationId);
    if (profileId) await supabase.from('codex_universe_items').delete().eq('id', profileId);
    if (sourceId) await supabase.from('codex_universe_items').delete().eq('id', sourceId);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
