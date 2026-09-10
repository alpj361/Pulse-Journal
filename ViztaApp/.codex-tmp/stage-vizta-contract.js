const fs = require('fs');
const cp = require('child_process');
const file = 'server/services/agents/vizta/index.js';
let desired = cp.execFileSync('git', ['show', `HEAD:${file}`], { encoding: 'utf8' });
const work = fs.readFileSync(file, 'utf8');

function toolStart(text, name) {
  return text.indexOf(`  {\n    type: 'function',\n    function: {\n      name: '${name}',`);
}

function replaceRange(first, last) {
  const desiredStart = toolStart(desired, first);
  const desiredEnd = toolStart(desired, last);
  const workStart = toolStart(work, first);
  const workEnd = toolStart(work, last);
  if ([desiredStart, desiredEnd, workStart, workEnd].some((value) => value < 0)) {
    throw new Error(`No se encontró rango ${first} → ${last}`);
  }
  desired = desired.slice(0, desiredStart) + work.slice(workStart, workEnd) + desired.slice(desiredEnd);
}

replaceRange('codex', 'data_ops');
replaceRange('mapa', 'places');
replaceRange('places', 'workspace');

const originalPath = '/tmp/vizta-index-head.js';
const desiredPath = '/tmp/vizta-index-contract.js';
fs.writeFileSync(originalPath, cp.execFileSync('git', ['show', `HEAD:${file}`]));
fs.writeFileSync(desiredPath, desired);
const diff = cp.spawnSync('diff', ['-u', '--label', `a/${file}`, '--label', `b/${file}`, originalPath, desiredPath], { encoding: 'utf8' });
if (![0, 1].includes(diff.status)) throw new Error(diff.stderr || 'diff falló');
if (!diff.stdout.trim()) throw new Error('Patch staged quedó vacío');
fs.writeFileSync('/tmp/vizta-index-contract.patch', diff.stdout);
cp.execFileSync('git', ['apply', '--cached', '/tmp/vizta-index-contract.patch'], { stdio: 'inherit' });
console.log('staged_vizta_contract_only');
