const fs = require('fs');
const path = '/home/pj/ExtractorW/server/middlewares/auth.js';
const backup = '/home/pj/ExtractorW/.codex-backups/20260829_contract_taxonomy/auth.before_user_isolation.js';
let source = fs.readFileSync(path, 'utf8');
const replacements = [
  ["if (process.env.NODE_ENV === 'development' || process.env.ALLOW_BYPASS_AUTH === 'true')", "if (process.env.ALLOW_BYPASS_AUTH === 'true')"],
  ["verifyUserAccess: process.env.NODE_ENV === 'development' ? bypassAuthForTesting : verifyUserAccess", "verifyUserAccess: process.env.ALLOW_BYPASS_AUTH === 'true' ? bypassAuthForTesting : verifyUserAccess"],
];
for (const [before, after] of replacements) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`expected one auth match, got ${count}: ${before}`);
  source = source.replace(before, after);
}
fs.mkdirSync('/home/pj/ExtractorW/.codex-backups/20260829_contract_taxonomy', { recursive: true });
if (!fs.existsSync(backup)) fs.copyFileSync(path, backup);
fs.writeFileSync(path, source);
console.log('updated auth bypass to explicit opt-in');
