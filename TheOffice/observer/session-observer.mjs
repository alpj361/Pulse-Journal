import { open, readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, join, resolve, sep } from 'node:path';

const ACTIVE_WINDOW_MS = 10 * 60 * 1_000;
const COMPLETED_WINDOW_MS = 90 * 1_000;
const CACHE_WINDOW_MS = 900;
const MAX_TAIL_BYTES = 512 * 1_024;

const safeStat = async (path) => {
  try {
    return await stat(path);
  } catch {
    return null;
  }
};

const readSlice = async (path, start, length) => {
  const handle = await open(path, 'r');
  try {
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buffer, 0, length, start);
    return buffer.subarray(0, bytesRead).toString('utf8');
  } finally {
    await handle.close();
  }
};

const readFirstJson = async (path) => {
  try {
    const info = await stat(path);
    const content = await readSlice(path, 0, Math.min(info.size, 1_024 * 1_024));
    return JSON.parse(content.split('\n')[0]);
  } catch {
    return null;
  }
};

const readTailJson = async (path) => {
  try {
    const info = await stat(path);
    const start = Math.max(0, info.size - MAX_TAIL_BYTES);
    const content = await readSlice(path, start, info.size - start);
    const lines = content.split('\n');
    if (start > 0) lines.shift();
    return lines.flatMap((line) => {
      try {
        return line.trim() ? [JSON.parse(line)] : [];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
};

const describeTool = (toolName = '') => {
  const normalized = String(toolName).toLowerCase();
  if (normalized.includes('apply_patch') || normalized === 'edit' || normalized === 'write') {
    return { phase: 'editing', activity: 'Editando archivos', tool: String(toolName) };
  }
  if (normalized.includes('bash') || normalized.includes('exec') || normalized.includes('shell')) {
    return { phase: 'terminal', activity: 'Ejecutando comandos', tool: String(toolName) };
  }
  if (normalized.includes('web') || normalized.includes('browser') || normalized.includes('search')) {
    return { phase: 'researching', activity: 'Investigando', tool: String(toolName) };
  }
  if (normalized.includes('read') || normalized.includes('grep') || normalized.includes('glob')) {
    return { phase: 'reading', activity: 'Leyendo el proyecto', tool: String(toolName) };
  }
  return { phase: 'working', activity: toolName ? `Usando ${String(toolName).slice(0, 48)}` : 'Trabajando', tool: String(toolName) };
};

const dateParts = (date) => [String(date.getFullYear()), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')];

const recentCodexFiles = async (root) => {
  const candidates = [];
  for (let offset = 0; offset < 3; offset += 1) {
    const date = new Date(Date.now() - offset * 24 * 60 * 60 * 1_000);
    const directory = join(root, ...dateParts(date));
    try {
      const entries = await readdir(directory, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.jsonl')) candidates.push(join(directory, entry.name));
      }
    } catch {
      // A date directory may not exist when Codex was not used that day.
    }
  }
  return candidates;
};

const encodedClaudeWorkspace = (workspaceRoot) => resolve(workspaceRoot).replace(/[^a-zA-Z0-9]/g, '-');

const collectJsonl = async (directory, depth = 0) => {
  if (depth > 2) return [];
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isFile() && entry.name.endsWith('.jsonl')) files.push(path);
      if (entry.isDirectory()) files.push(...await collectJsonl(path, depth + 1));
    }
    return files;
  } catch {
    return [];
  }
};

const recentClaudeFiles = async (root, workspaceRoot) => {
  try {
    const prefix = encodedClaudeWorkspace(workspaceRoot);
    const entries = await readdir(root, { withFileTypes: true });
    const matchingDirectories = entries
      .filter((entry) => entry.isDirectory() && (entry.name === prefix || entry.name.startsWith(`${prefix}-`)))
      .map((entry) => join(root, entry.name));
    return (await Promise.all(matchingDirectories.map((directory) => collectJsonl(directory)))).flat();
  } catch {
    return [];
  }
};

const newestWorkspaceFile = async (files, workspaceRoot, provider) => {
  const withStats = (await Promise.all(files.map(async (path) => ({ path, info: await safeStat(path) })))).filter((item) => item.info);
  withStats.sort((left, right) => right.info.mtimeMs - left.info.mtimeMs);
  if (provider === 'claude') return withStats[0] ?? null;

  for (const candidate of withStats) {
    const first = await readFirstJson(candidate.path);
    const cwd = first?.payload?.cwd;
    if (typeof cwd === 'string' && (resolve(cwd) === resolve(workspaceRoot) || resolve(cwd).startsWith(`${resolve(workspaceRoot)}${sep}`))) {
      return candidate;
    }
  }
  return null;
};

const codexSignal = (records) => {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    const payload = record?.payload ?? {};
    if (record?.type === 'event_msg' && payload.type === 'task_complete') {
      return { status: 'completed', phase: 'celebrating', activity: 'Terminó su trabajo', tool: '' };
    }
    if (record?.type === 'event_msg' && ['turn_aborted', 'task_failed'].includes(payload.type)) {
      return { status: 'blocked', phase: 'blocked', activity: 'Trabajo interrumpido', tool: '' };
    }
    if (record?.type === 'response_item' && ['custom_tool_call', 'function_call', 'local_shell_call'].includes(payload.type)) {
      return { status: 'working', ...describeTool(payload.name ?? payload.tool_name ?? 'tool') };
    }
    if (record?.type === 'event_msg' && payload.type === 'item_completed' && payload.item?.type === 'CommandExecution') {
      return { status: 'working', phase: 'terminal', activity: 'Procesando un comando', tool: 'command' };
    }
    if (record?.type === 'response_item' && ['custom_tool_call_output', 'function_call_output', 'local_shell_call_output'].includes(payload.type)) {
      return { status: 'thinking', phase: 'thinking', activity: 'Revisando resultados', tool: '' };
    }
    if (record?.type === 'response_item' && payload.type === 'reasoning') {
      return { status: 'thinking', phase: 'thinking', activity: 'Pensando', tool: '' };
    }
    if (record?.type === 'response_item' && payload.type === 'message') {
      return { status: 'thinking', phase: 'communicating', activity: 'Comunicando un avance', tool: '' };
    }
  }
  return { status: 'working', phase: 'working', activity: 'Actividad de Codex detectada', tool: '' };
};

const claudeSignal = (records) => {
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    if (record?.type === 'assistant' && Array.isArray(record.message?.content)) {
      const toolUse = [...record.message.content].reverse().find((content) => content?.type === 'tool_use');
      if (toolUse) return { status: 'working', ...describeTool(toolUse.name ?? 'tool') };
      if (record.message.content.some((content) => content?.type === 'thinking')) {
        return { status: 'thinking', phase: 'thinking', activity: 'Pensando', tool: '' };
      }
      if (record.message.content.some((content) => content?.type === 'text')) {
        return { status: 'completed', phase: 'celebrating', activity: 'Terminó su trabajo', tool: '' };
      }
    }
    if (record?.type === 'user') {
      const hasToolResult = Array.isArray(record.message?.content) && record.message.content.some((content) => content?.type === 'tool_result');
      return hasToolResult
        ? { status: 'thinking', phase: 'thinking', activity: 'Revisando resultados', tool: '' }
        : { status: 'thinking', phase: 'thinking', activity: 'Analizando una petición', tool: '' };
    }
  }
  return { status: 'working', phase: 'working', activity: 'Actividad de Claude detectada', tool: '' };
};

const inactiveSignal = () => ({
  observed: false,
  active: false,
  status: 'available',
  phase: 'simulated',
  activity: 'Vida simulada',
  workspace: null,
  lastSeen: null,
  signalSource: 'session-log',
  events: [],
});

export const createSessionObserver = ({
  workspaceRoot,
  codexRoot = join(homedir(), '.codex', 'sessions'),
  claudeRoot = join(homedir(), '.claude', 'projects'),
  now = () => Date.now(),
} = {}) => {
  const history = { codex: [], claude: [] };
  const previousSignature = { codex: '', claude: '' };
  let cache = { at: 0, value: null };

  const observeProvider = async (provider) => {
    const files = provider === 'codex'
      ? await recentCodexFiles(codexRoot)
      : await recentClaudeFiles(claudeRoot, workspaceRoot);
    const latest = await newestWorkspaceFile(files, workspaceRoot, provider);
    if (!latest) return inactiveSignal();

    const records = await readTailJson(latest.path);
    const detected = provider === 'codex' ? codexSignal(records) : claudeSignal(records);
    const age = Math.max(0, now() - latest.info.mtimeMs);
    const completed = detected.status === 'completed' && age <= COMPLETED_WINDOW_MS;
    const active = detected.status !== 'completed' && age <= ACTIVE_WINDOW_MS;
    const status = active || completed ? detected.status : 'available';
    const signal = {
      observed: true,
      active,
      status,
      phase: status === 'available' ? 'simulated' : detected.phase,
      activity: status === 'available' ? 'Disponible en la oficina' : detected.activity,
      workspace: provider === 'codex' ? basename((await readFirstJson(latest.path))?.payload?.cwd ?? workspaceRoot) : basename(workspaceRoot),
      lastSeen: latest.info.mtime.toISOString(),
      signalSource: 'session-log',
      tool: detected.tool,
    };

    const signature = `${signal.status}:${signal.phase}:${signal.tool}`;
    if (signature !== previousSignature[provider]) {
      previousSignature[provider] = signature;
      history[provider].push({
        event: 'SessionLog',
        status: signal.status,
        activity: signal.activity,
        tool: signal.tool,
        at: new Date(now()).toISOString(),
      });
      history[provider] = history[provider].slice(-12);
    }
    return { ...signal, events: history[provider] };
  };

  return async () => {
    if (cache.value && now() - cache.at < CACHE_WINDOW_MS) return cache.value;
    const [codex, claude] = await Promise.all([observeProvider('codex'), observeProvider('claude')]);
    cache = { at: now(), value: { codex, claude } };
    return cache.value;
  };
};
