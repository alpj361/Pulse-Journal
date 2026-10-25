import assert from 'node:assert/strict';
import { appendFile, mkdtemp, mkdir, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSessionObserver } from '../observer/session-observer.mjs';

const fixtureRoot = await mkdtemp(join(tmpdir(), 'the-office-observer-'));
const workspaceRoot = '/Users/test/Desktop/Pulse_Journal';
const codexRoot = join(fixtureRoot, 'codex');
const claudeRoot = join(fixtureRoot, 'claude');
const now = new Date();
const codexDay = join(
  codexRoot,
  String(now.getFullYear()),
  String(now.getMonth() + 1).padStart(2, '0'),
  String(now.getDate()).padStart(2, '0'),
);
const claudeWorkspace = workspaceRoot.replace(/[^a-zA-Z0-9]/g, '-');
const claudeProject = join(claudeRoot, claudeWorkspace);

await mkdir(codexDay, { recursive: true });
await mkdir(claudeProject, { recursive: true });

const codexFile = join(codexDay, 'rollout-test.jsonl');
const claudeFile = join(claudeProject, 'session-test.jsonl');

try {
  await writeFile(codexFile, [
    JSON.stringify({ type: 'session_meta', payload: { cwd: workspaceRoot } }),
    JSON.stringify({ type: 'response_item', payload: { type: 'message', content: 'DO_NOT_EXPOSE_PROMPT' } }),
    JSON.stringify({ type: 'response_item', payload: { type: 'custom_tool_call', name: 'exec', input: 'DO_NOT_EXPOSE_COMMAND' } }),
  ].join('\n'));
  await writeFile(claudeFile, [
    JSON.stringify({ type: 'user', message: { content: 'DO_NOT_EXPOSE_REQUEST' } }),
    JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'tool_use', name: 'Edit', input: { secret: 'DO_NOT_EXPOSE_SECRET' } }] },
    }),
  ].join('\n'));

  const observe = createSessionObserver({ workspaceRoot, codexRoot, claudeRoot });
  const signals = await observe();
  const serialized = JSON.stringify(signals);

  assert.equal(signals.codex.active, true);
  assert.equal(signals.codex.phase, 'terminal');
  assert.equal(signals.claude.active, true);
  assert.equal(signals.claude.phase, 'editing');
  assert.equal(signals.codex.signalSource, 'session-log');
  assert.ok(!serialized.includes('DO_NOT_EXPOSE'));

  await appendFile(codexFile, `\n${JSON.stringify({ type: 'event_msg', payload: { type: 'task_complete' } })}`);
  const completedSignals = await createSessionObserver({ workspaceRoot, codexRoot, claudeRoot })();
  assert.equal(completedSignals.codex.status, 'completed');
  assert.equal(completedSignals.codex.active, false);

  const staleDate = new Date(Date.now() - 11 * 60 * 1_000);
  await utimes(codexFile, staleDate, staleDate);
  await utimes(claudeFile, staleDate, staleDate);
  const observeStale = createSessionObserver({ workspaceRoot, codexRoot, claudeRoot });
  const staleSignals = await observeStale();
  assert.equal(staleSignals.codex.active, false);
  assert.equal(staleSignals.codex.status, 'available');
  assert.equal(staleSignals.claude.active, false);

  console.log('Automatic session observer smoke test passed without hooks.');
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
