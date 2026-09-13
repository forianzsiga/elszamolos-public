# elszamolos project — opencode instructions

These instructions are loaded by opencode whenever the project is the active workspace. They are project-specific supplements to the global `~/.config/opencode/instructions.md` and to the per-subagent "Always" sections.

## Worktree convention

All non-trivial code changes go in a git worktree under `<project>/.worktrees/<slug>/` (inside the project root, not as a sibling of the main repo). The pattern:

```bash
git worktree add .worktrees/<slug> -b feature/<slug>     # or fix/, refactor/, chore/
```

Subagents must use `workdir` set to the worktree path. Never merge a worktree into main yourself — your job ends at assessment. The user (or the build agent, with explicit override) merges.

If two parallel subagents both need to edit the same files, they each get their own worktree. If they would interfere on shared state, refuse and ask the user to split the work.

## Long-running processes

- Never block the agent on a foreground long-running process.
- Start dev servers, build watchers, log tails, and any streaming process in tmux via WSL:
  ```bash
  wsl -e tmux new-session -d -s <name> "<command>"
  wsl -e tmux capture-pane -p -t <name> -S -200   # read non-blocking
  wsl -e tmux send-keys -t <name> "..." Enter     # send input
  wsl -e tmux kill-session -t <name>               # teardown
  ```
- On Windows, if WSL is unavailable, fall back to `Start-Process` with output redirected to a log file and tailed with `Get-Content -Wait`.
- The agent that creates a tmux session owns its lifetime. Kill before ending unless the user explicitly asked to keep it alive.
- Two agents must not mutate the same tmux session. Non-owners observe via `capture-pane` only.

## Multi-agent browser protocol (chrome-devtools-mcp)

The MCP is shared external state. If two parallel subagents both touch the browser without isolation, the second one crashes with `browser is already running for ...\chrome-profile` and the parent loses its page context. The global MCP config already launches with `--isolated --experimentalPageIdRouting --no-usage-statistics`, so user-data-dir singleton locks are already handled. Page-level isolation is the agent's job.

- Create your own tab: `new_page url="<url>" isolatedContext="<unique-name>"` (unique per invocation).
- For every page-scoped tool call, pass `pageId=<your pageId>`. This makes each call atomic and immune to other agents calling `select_page` concurrently.
- DO NOT call `select_page` — it mutates global state and races.
- DO NOT call `close_page` on a pageId you did not create.
- On finish, close only your own pageId.
- If `list_pages` shows pages you did not create, ignore them.
- Verify final URL via `evaluate_script(pageId=<yours>, function="() => document.location.href")` to detect any pageId swap.

## In-page debug bridge

The app exposes `window.__DEBUG_BRIDGE__` in dev or developer mode (toggled in the sidebar). Use it for state injection and verification — it is far simpler than writing your own IndexedDB code.

- `getJobs()`, `getRules()`, `getInvoices()`, `getLogs()` — read state.
- `injectJobs(jobs)`, `injectRules(rules)`, `restoreFullBackup({jobs, rules, invoices, metadata})` — write state, auto-reloads the page.
- `testPricingEngine()` — dry-run the pricing engine and log a comparison table.
- `compareImportMethods()` — parity check between Force Import and Checked Import.
- `getAppInfo()` — version, env, developer mode, language.

If the bridge does not cover a case, fall back to `Runtime.evaluate` opening `indexedDB.open('DentalRaktarDB', 5)` directly.

## IndexedDB schema

- DB name: `DentalRaktarDB`, version `5`.
- Stores: `jobs` (keyPath: `id`), `tariffs` (keyPath: `id`), `invoices` (keyPath: `id`), `metadata` (no keyPath — uses out-of-line keys like `'materials'`, `'types'`, `'doctors'`, `'patients'`), `assets` (keyPath: `id`), `logs` (keyPath: `id`).

## Project commands

- Dev: `npm run dev` — Vite at `http://localhost:5173/elszamolos/`. Base path is `/elszamolos/`.
- Build: `npm run build` — `tsc -b && vite build`.
- Lint: `npm run lint` — ESLint + compliance runner.
- Type check: `npx tsc --noEmit`.
- Tests: `npm test` (Vitest). `describeIfIndexedDB` specs auto-skip in non-DOM envs.
- Compliance: `npm run compliance` — currently requires `python3` on PATH (not installed on this Windows machine; use WSL).

If `node_modules` is missing in a worktree, junction from the main repo:
```bash
cmd //c "if not exist .worktrees\<slug>\node_modules mklink /J .worktrees\<slug>\node_modules ..\..\node_modules"
```
Or `npm ci` inside the worktree.

## Deploy and release

- `.github/workflows/deploy.yml` triggers on `push` to `main` and `workflow_dispatch`. Does NOT trigger on `release` events.
- `VITE_APP_VERSION` is set at build time from `git describe --tags --always`. After tagging, the deployed `version.json` reflects the tag.
- Release process: `git push origin main`, then `gh release create <tag> --target main --generate-notes`.
- Existing tags: `v0.4.0` (2026-06-13, latest), `v0.3.0`, `v0.1.0`, `v0.0.1-prerelease-cli_build_legacy`. `v0.2.0` is a tag without a release.

## Engram memory

Use `mem_context` and `mem_search` proactively at session start to recover prior decisions and gotchas. Save non-obvious discoveries with `mem_save` (type: `bugfix` for fixes, `architecture` for design decisions, `pattern` for conventions, `config` for environment setup, `discovery` for findings). Use `mem_suggest_topic_key` when evolving topics to get a stable key, then `mem_save` with that key to upsert.

## WSL on this Windows machine

- `tmux` is installed in WSL Ubuntu 3.4. Wrap calls in `wsl -e`.
- `unzip` is NOT installed in WSL Ubuntu. Use Python `zipfile` stdlib.
- `sudo` requires a password (interactive). Don't use it for non-interactive scripts.
- Path translation: Git Bash auto-translates `/tmp/...` to a Windows path before passing to `wsl -e`. To pass a literal WSL path, use `wsl -e bash -c "<command with literal WSL paths>"`.
- File-lock gotcha: lingering `node.exe` processes from prior dev runs can hold files. `cmd //c "taskkill /F /IM node.exe"` to clean up before sensitive operations (worktree remove, npm install).
