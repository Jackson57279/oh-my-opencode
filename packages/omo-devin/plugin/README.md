# omo — OMO for Devin CLI

The oh-my-openagent agentic workflow as a Devin CLI plugin: the full shared
skill bundle (ultrawork, ulw-plan, ulw-execute, ulw-research, review-work,
debugging, programming, frontend, and more), seven specialist subagent
profiles, workflow rules, lifecycle hooks, and MCP servers.

## Install

```bash
# From the repo (git-subdir)
devin plugins install code-yeongyu/oh-my-openagent#packages/omo-devin/plugin

# From a local checkout — linked, edits are live (build first)
bun run build:devin-plugin        # or: node packages/omo-devin/plugin/scripts/build-plugin.mjs
devin plugins install --local <repo>/packages/omo-devin/plugin
```

## What's inside

| Piece | Location | Notes |
|-------|----------|-------|
| Manifest | `.devin-plugin/plugin.json` | `skills: "skills"`, `mcpServers: "./.mcp.json"` |
| Skills | `skills/` | GENERATED — synced from `packages/shared-skills/skills/` + composed `ultrawork` from `packages/prompts-core/prompts/ultrawork/default.md`, with `## Codex*` compat sections rewritten for Devin. Invoked as `/omo:<skill>`. |
| Subagents | `agents/` | 7 profiles → `omo:oracle`, `omo:librarian`, `omo:momus`, `omo:metis`, `omo:prometheus`, `omo:multimodal-looker`, `omo:sisyphus-junior` |
| Always-on rule | `AGENTS.md` | OMO workflow contract injected every session |
| Rules | `rules/test-discipline.md` | Glob-triggered test discipline |
| Hooks | `hooks.json` + `scripts/omo-hook.mjs` | SessionStart + PostCompaction context; UserPromptSubmit ultrawork trigger |
| MCP | `.mcp.json` | `grep_app` + `context7` remote servers |

## Usage

- `/omo:ultrawork` or write "ultrawork"/"ulw" in a prompt → ULTRAWORK MODE.
- `/omo:ulw-plan` → Prometheus-style planning, writes `.omo/plans/*.md`.
- `/omo:ulw-execute` → executes a written plan with evidence ledger.
- `run_subagent(profile="omo:oracle", task="...")` → specialist lanes.

## Developing

```bash
node scripts/build-plugin.mjs     # materialize upstreams + sync skills + stamp version
node scripts/sync-skills.mjs      # skills only
node scripts/sync-skills.mjs --check   # freshness gate (runs in test:devin)
npm test                          # node:test suite for hooks + sync
```

`plugin/skills/` is COMMITTED — git-subdir installs have no post-clone build
step, so the generated tree ships in the repo. `--check` fails CI/tests on drift.

## Roadmap / not in v1

- Bundled `lsp` / `ast_grep` / `git_bash` stdio MCPs (build artifacts that do not
  ship in a git checkout). Wire them manually via `devin mcp add` pointing at a
  built `packages/lsp-daemon/dist/cli.js` / `packages/ast-grep-mcp` bundle.
- ulw-loop CLI machinery (goal budget, ledger runner) and Stop-hook resume.
- Telemetry and the OpenCode-only hook/tool surface (there is no TS plugin API
  in Devin — integration is declarative + shell hooks).
