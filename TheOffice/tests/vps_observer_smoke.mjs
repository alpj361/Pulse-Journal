import assert from 'node:assert/strict';
import { createVpsObserver } from '../observer/vps-observer.mjs';

const now = Date.UTC(2026, 8, 15, 12, 0, 0);
const epoch = (milliseconds) => milliseconds / 1_000;
const fixture = [
  `/home/pj/NewsCron/clasificador_worker.log|${epoch(now - 8 * 60 * 60 * 1_000)}|4282`,
  `/home/pj/NewsCron/legal_agent.log|${epoch(now - 90 * 24 * 60 * 60 * 1_000)}|0`,
  `/home/pj/NewsCron/reality_agent.log|${epoch(now - 7 * 60 * 60 * 1_000)}|2436`,
  `/home/pj/NewsCron/fetch_profiles.log|${epoch(now - 12 * 60 * 1_000)}|70731`,
  `/home/pj/NewsCron/fetch_trending_and_tweets.log|${epoch(now - 11 * 60 * 60 * 1_000)}|66628`,
  `/home/pj/NewsCron/news_cards_cron.log|${epoch(now - 17 * 60 * 60 * 1_000)}|0`,
  `/home/pj/NewsCron/narrativa_cron.log|${epoch(now - 16 * 60 * 60 * 1_000)}|0`,
  `/home/pj/NewsCron/cron_news.log|${epoch(now - 13 * 60 * 60 * 1_000)}|0`,
  `/home/pj/NewsCron/director_state.json|${epoch(now - 10 * 60 * 60 * 1_000)}|2189`,
].join('\n');

const observe = createVpsObserver({ runSsh: async () => fixture, now: () => now });
const agents = await observe();

assert.equal(agents.length, 5);
assert.equal(agents.find((agent) => agent.id === 'classifier-worker').status, 'completed');
assert.equal(agents.find((agent) => agent.id === 'legal-worker').phase, 'pausado');
assert.equal(agents.find((agent) => agent.id === 'media-worker').cadence, 100);
assert.equal(agents.find((agent) => agent.id === 'manager-agent').signalSource, 'vps-artifact');
assert.ok(!JSON.stringify(agents).includes('secret'));

console.log('VPS artifact observer smoke test passed with curated metadata only.');
