# DEBUG REPORT: The Office automatic observer

- **Symptom:** The Office remained in simulated mode while Codex was executing tools because no lifecycle event files were produced.
- **Root cause:** The implementation depended exclusively on project hooks. Codex requires review and trust for non-managed hooks, so newly added hook definitions were skipped and `TheOffice/runtime/observed` stayed empty.
- **Fix:** Replaced hook event files with read-only observation of the existing Codex and Claude Code session logs. The observer reads bounded tail segments, extracts only structural event and tool names, and exposes sanitized visual state.
- **Evidence:** During this investigation, `~/.codex/sessions` changed while the runtime hook directory remained empty. The local API subsequently reported Codex states from `signalSource: session-log` without hook configuration.
- **Regression test:** `TheOffice/tests/bridge_smoke.mjs` creates synthetic Codex and Claude logs, validates terminal/editing/completed/stale states, and asserts that prompt, command, and secret contents are absent from observer output.
- **Related:** Multiple concurrent sessions map to one character per provider; the most recently modified matching session currently wins.
- **Status:** DONE
