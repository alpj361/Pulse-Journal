import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const CACHE_WINDOW_MS = 60_000;
const VPS_HOST = process.env.THE_OFFICE_VPS_HOST ?? 'root@157.245.115.216';
const VPS_KEY = process.env.THE_OFFICE_VPS_KEY ?? '/Users/pj/Desktop/PDKey';
const CONTROL_SOCKET = process.env.THE_OFFICE_VPS_SOCKET ?? `${tmpdir()}/the-office-vps-${process.getuid?.() ?? 'user'}.sock`;
const LAST_KNOWN_PATH = join(dirname(fileURLToPath(import.meta.url)), 'vps-last-known.txt');

const files = {
  classifier: '/home/pj/NewsCron/clasificador_worker.log',
  legal: '/home/pj/NewsCron/legal_agent.log',
  reality: '/home/pj/NewsCron/reality_agent.log',
  manager: '/home/pj/NewsCron/director_state.json',
  mediaProfiles: '/home/pj/NewsCron/fetch_profiles.log',
  mediaTrends: '/home/pj/NewsCron/fetch_trending_and_tweets.log',
  mediaCards: '/home/pj/NewsCron/news_cards_cron.log',
  mediaNarrative: '/home/pj/NewsCron/narrativa_cron.log',
  mediaFeed: '/home/pj/NewsCron/cron_news.log',
};

const remoteCommand = `for f in ${Object.values(files).join(' ')}; do if [ -f "$f" ]; then stat -c '%n|%Y|%s' "$f"; fi; done`;

const runDefaultSsh = async () => {
  const { stdout } = await execFileAsync('/usr/bin/ssh', [
    '-i', VPS_KEY,
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=8',
    '-o', 'ControlMaster=auto',
    '-o', 'ControlPersist=12h',
    '-S', CONTROL_SOCKET,
    VPS_HOST,
    remoteCommand,
  ], { timeout: 12_000, maxBuffer: 128 * 1024 });
  return stdout;
};

export const parseArtifactMetadata = (output = '') => new Map(
  output.split('\n').flatMap((line) => {
    const [path, epoch, size] = line.trim().split('|');
    const modifiedAt = Number.parseFloat(epoch) * 1_000;
    if (!path || !Number.isFinite(modifiedAt)) return [];
    return [[path, { path, modifiedAt, size: Number.parseInt(size, 10) || 0 }]];
  }),
);

const ageLabel = (ageMs) => {
  const minutes = Math.max(0, Math.floor(ageMs / 60_000));
  if (minutes < 2) return 'hace un momento';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} días`;
};

const artifactSignal = ({ id, artifact, now, cadenceHours, activity, role }) => {
  if (!artifact) {
    return {
      id, observed: false, active: false, status: 'blocked', phase: 'sin-señal',
      activity: 'No se encontró evidencia reciente en el VPS', workspace: 'NewsCron',
      lastSeen: null, signalSource: 'vps-artifact', health: 12, cadence: 0, role, events: [],
    };
  }
  const age = Math.max(0, now - artifact.modifiedAt);
  const overdue = age > cadenceHours * 60 * 60 * 1_000;
  const freshness = Math.max(8, Math.round(100 - (age / (cadenceHours * 60 * 60 * 1_000)) * 75));
  const status = overdue ? 'blocked' : 'completed';
  const summary = overdue ? `Sin resultado dentro de la cadencia · ${ageLabel(age)}` : `${activity} · ${ageLabel(age)}`;
  return {
    id, observed: true, active: false, status, phase: overdue ? 'atrasado' : 'resultado',
    activity: summary, workspace: 'NewsCron', lastSeen: new Date(artifact.modifiedAt).toISOString(),
    signalSource: 'vps-artifact', health: overdue ? Math.min(34, freshness) : freshness,
    cadence: overdue ? 18 : 96, role,
    events: [{ event: 'Artefacto VPS', status, activity: summary, tool: 'cron', at: new Date(artifact.modifiedAt).toISOString() }],
  };
};

const mediaSignal = (metadata, now) => {
  const artifacts = ['mediaProfiles', 'mediaTrends', 'mediaCards', 'mediaNarrative', 'mediaFeed']
    .map((key) => metadata.get(files[key]))
    .filter(Boolean)
    .sort((left, right) => right.modifiedAt - left.modifiedAt);
  const latest = artifacts[0];
  const signal = artifactSignal({
    id: 'media-worker', artifact: latest, now, cadenceHours: 2,
    activity: `${artifacts.length}/5 canales dejaron señal`, role: 'News cards · Tweets · Feeds',
  });
  signal.cadence = Math.round((artifacts.filter((artifact) => now - artifact.modifiedAt < 26 * 60 * 60 * 1_000).length / 5) * 100);
  return signal;
};

const disconnectedSignals = (message = 'VPS temporalmente inaccesible') => ['classifier-worker', 'legal-worker', 'reality-worker', 'media-worker', 'manager-agent'].map((id) => ({
  id, observed: false, active: false, status: 'blocked', phase: 'desconectado', activity: message,
  workspace: 'NewsCron', lastSeen: null, signalSource: 'vps-artifact', health: 0, cadence: 0, events: [],
}));

const buildSignals = (metadata, timestamp) => [
  artifactSignal({ id: 'classifier-worker', artifact: metadata.get(files.classifier), now: timestamp, cadenceHours: 36, activity: 'Clasificación actualizada', role: 'Clasificador de señales' }),
  {
    ...artifactSignal({ id: 'legal-worker', artifact: metadata.get(files.legal), now: timestamp, cadenceHours: 36, activity: 'Monitoreo legal actualizado', role: 'Monitor legal' }),
    status: 'blocked', phase: 'pausado', activity: 'Monitoreo pausado · bloqueo externo de Incapsula', health: 24, cadence: 0,
  },
  artifactSignal({ id: 'reality-worker', artifact: metadata.get(files.reality), now: timestamp, cadenceHours: 36, activity: 'Reality model actualizado', role: 'Reality signals' }),
  mediaSignal(metadata, timestamp),
  artifactSignal({ id: 'manager-agent', artifact: metadata.get(files.manager), now: timestamp, cadenceHours: 36, activity: 'Estado directivo consolidado', role: 'Director de operaciones' }),
];

export const createVpsObserver = ({ runSsh = runDefaultSsh, now = () => Date.now() } = {}) => {
  let cache = { at: 0, agents: disconnectedSignals('Esperando primera lectura del VPS') };
  return async () => {
    if (now() - cache.at < CACHE_WINDOW_MS) return cache.agents;
    try {
      const metadata = parseArtifactMetadata(await runSsh());
      const timestamp = now();
      const agents = buildSignals(metadata, timestamp);
      cache = { at: timestamp, agents };
      return agents;
    } catch {
      if (cache.at > 0) return cache.agents.map((agent) => ({ ...agent, phase: 'señal-cache', activity: `${agent.activity} · conexión en caché` }));
      try {
        const timestamp = now();
        const agents = buildSignals(parseArtifactMetadata(await readFile(LAST_KNOWN_PATH, 'utf8')), timestamp)
          .map((agent) => ({ ...agent, phase: agent.phase === 'pausado' ? 'pausado' : 'última-señal', activity: `${agent.activity} · última lectura confirmada` }));
        cache = { at: timestamp, agents };
      } catch {
        cache = { at: now(), agents: disconnectedSignals() };
      }
      return cache.agents;
    }
  };
};
