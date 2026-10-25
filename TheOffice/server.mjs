import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { createSessionObserver } from './observer/session-observer.mjs';
import { createVpsObserver } from './observer/vps-observer.mjs';

const appRoot = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(appRoot, '..');
const preferredPort = Number(process.env.THE_OFFICE_PORT ?? 5173);
const host = '127.0.0.1';
const observeSessions = createSessionObserver({
  workspaceRoot,
  codexRoot: process.env.THE_OFFICE_CODEX_SESSIONS,
  claudeRoot: process.env.THE_OFFICE_CLAUDE_PROJECTS,
});
const observeVps = createVpsObserver();

const observers = [
  { id: 'data-analyst', name: 'Data Analyst', provider: 'Codex', source: 'codex' },
  { id: 'product-design', name: 'Product & Design', provider: 'Claude Code', source: 'claude' },
];

const json = (response, status, body) => {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(body));
};

const vite = await createViteServer({
  root: appRoot,
  appType: 'spa',
  server: { middlewareMode: true, hmr: false },
});

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? `${host}:${preferredPort}`}`);
  try {
    if (request.method === 'GET' && url.pathname === '/api/agents') {
      const [sessions, vpsAgents] = await Promise.all([observeSessions(), observeVps()]);
      const agents = [
        ...observers.map((observer) => ({ ...observer, ...sessions[observer.source] })),
        ...vpsAgents.map((agent) => ({ ...agent, provider: 'VPS' })),
      ];
      return json(response, 200, {
        mode: 'automatic-observer',
        workspace: workspaceRoot,
        agents,
      });
    }
    if (url.pathname.startsWith('/api/agents/') && request.method !== 'GET') {
      return json(response, 405, { error: 'The Office observa agentes; no inicia ni controla sus tareas.' });
    }
    vite.middlewares(request, response, () => json(response, 404, { error: 'Ruta no encontrada' }));
  } catch (error) {
    json(response, 500, { error: error instanceof Error ? error.message : 'Error interno' });
  }
});

let activePort = preferredPort;
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE' && !process.env.THE_OFFICE_PORT && activePort < preferredPort + 9) {
    activePort += 1;
    console.log(`Port ${activePort - 1} is busy; trying ${activePort}...`);
    server.listen(activePort, host);
    return;
  }
  console.error(`The Office could not start: ${error.message}`);
  process.exitCode = 1;
});
server.on('listening', () => {
  const url = `http://${host}:${activePort}`;
  console.log(`The Office observer is running at ${url}`);
  console.log(`Watching Codex and Claude session activity automatically for: ${workspaceRoot}`);
  if (!process.argv.includes('--no-open') && process.platform === 'darwin') {
    spawn('open', [url], { stdio: 'ignore', detached: true }).unref();
  }
});
server.listen(activePort, host);

const shutdown = async () => {
  await vite.close();
  server.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
