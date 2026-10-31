# packages/omo-devin/ - Devin CLI Adapter (omo plugin)

## STOP. THIS IS THE DEVIN EDITION. QA IS MANDATORY. EVERY SINGLE TIME.

> **IF YOU CHANGE ANY DEVIN-CONNECTED COMPONENT (`plugin/`, its skills/agents/rules/hooks/MCP wiring, `scripts/`, or the `devin-qa` skill), YOU MUST QA IT AGAINST A REAL DEVIN CLI IN AN ISOLATED HOME. ALWAYS.**

**"It typechecks" is NOT QA. "`bun test`/`node --test` is NOT QA."** You must run the `devin-qa` skill (`.agents/skills/devin-qa/`): sandboxed XDG home + copied credentials, `devin plugins install --local`, headless `devin -p` sessions, `OMO_DEVIN_HOOK_LOG` JSONL proving the hook fired, sha256 before/after on the real `~/.config/devin` + `~/.local/share/devin` proving them untouched. Record evidence under `.omo/evidence/<YYYYMMDD>-<slug>/` (gitignored; PR body carries the summary).

**NO EVIDENCE == NO QA == NO COMMIT == NO PUSH.**

## OVERVIEW

The Devin harness adapter: a Devin plugin (`plugin/`) in `.devin-plugin` format,
installable via `devin plugins install <repo>#packages/omo-devin/plugin` or
`devin plugins install --local <path>`. Devin's plugin model is declarative —
skills, subagent profiles, rules, hooks, MCP servers — so there is no TS runtime
here; integration is the manifest + `scripts/omo-hook.mjs` shell hook + the
synced skill tree.

## LAYOUT

| Path | Purpose |
|------|---------|
| `plugin/.devin-plugin/plugin.json` | Plugin manifest (`name: omo`, `skills: "skills"`, `mcpServers: "./.mcp.json"`); version stamped from root package.json by build-plugin.mjs |
| `plugin/skills/` | GENERATED + COMMITTED — `sync-skills.mjs` copies `packages/shared-skills/skills/*` (filtered via `createSkillSourceCopyFilter`, `openai.yaml` dropped), rewrites `## Codex*` compat sections to `## Devin*`, and composes `ultrawork/` from `packages/prompts-core/prompts/ultrawork/default.md`. Committed because git-subdir installs have no post-clone build step; `--check` is the freshness gate |
| `plugin/agents/` | 7 custom subagent profiles (`<name>.md` frontmatter format): oracle, librarian, momus, metis, prometheus, multimodal-looker, sisyphus-junior — distilled from `packages/omo-opencode/src/agents/` with `allowed-tools` mirroring the omo denied-tools table |
| `plugin/rules/` | Triggered rules (`trigger:`/`globs:` frontmatter); `test-discipline.md` is the generalized port of `.omo/rules/test-discipline.md` |
| `plugin/AGENTS.md` | Always-on plugin rule: skills index, subagent roster, ultrawork trigger contract, evidence discipline |
| `plugin/hooks.json` | Devin lifecycle wiring → `node "${PLUGIN_ROOT}/scripts/omo-hook.mjs" <event>` for SessionStart, UserPromptSubmit, PostCompaction |
| `plugin/scripts/omo-hook.mjs` | Dependency-free Node ESM hook entry: stdin JSON → stdout `hookSpecificOutput.additionalContext`. Ultrawork detector `/(?:ultrawork\|ulw(?!-(?:plan\|research\|execute)))/i`. `OMO_DEVIN_HOOK_LOG` env → JSONL event log for QA. NEVER blocks, NEVER networks, ALWAYS exit 0 |
| `plugin/scripts/sync-skills.mjs` | The only transformer; `--check` asserts committed tree freshness |
| `plugin/scripts/build-plugin.mjs` | materialize upstreams (non-fatal) → sync-skills → stamp versions |
| `plugin/.mcp.json` | Remote MCPs `grep_app` + `context7` (`${PLUGIN_ROOT}` expands in command/args but no local dists ship — see README roadmap) |
| `plugin/test/` | node:test suite (hook behavior + sync contract); NOT bun — plugin tests use `node --test` like the codex plugin |

## VERIFIED DEVIN SEMANTICS (empirical, v3000.11.234)

- `${PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_ROOT}` expand in `hooks.json` commands and `.mcp.json` args. Hook cwd = the USER'S project dir; `PLUGIN_ROOT`/`CLAUDE_PLUGIN_ROOT` env vars exist for hook processes only (not MCP spawns). Scripts self-locate via `import.meta.url`.
- Plugin skills invoke as `/<plugin>:<skill>`; agents as `omo:<name>`.
- SKILL.md frontmatter must be VALID YAML — an unquoted `: ` inside `description:` silently drops the skill (sync validates this).
- Hooks fail open. Headless driver: `devin -p --permission-mode bypass --respect-workspace-trust false -- "<prompt>"`.
- Isolation = `XDG_*` → temp + copied `~/.local/share/devin/credentials.toml` + `~/.config/devin/config.json`. See `devin-qa` SKILL.md.

## CONVENTIONS

- `plugin/skills/` is a committed generated artifact: NEVER hand-edit it; edit `packages/shared-skills/skills/` or the sync transforms, then run `node plugin/scripts/build-plugin.mjs`.
- The canonical ultrawork directive lives in `packages/prompts-core/prompts/ultrawork/default.md` — same source the codex adapter reads directly.
- Keep `omo-hook.mjs` dependency-free (node: builtins only); the plugin must install and run without a repo `bun install`.
- New project skills go in `.agents/skills/` (per `.agents/AGENTS.md`); `devin-qa` lives there.

## COMMANDS

```bash
node packages/omo-devin/plugin/scripts/build-plugin.mjs        # full pipeline
node packages/omo-devin/plugin/scripts/sync-skills.mjs --check # freshness gate
node --test packages/omo-devin/plugin/test/*.test.mjs          # test gate
bun run test:devin                                             # repo-level gate
```

Parent: [`packages/AGENTS.md`](../AGENTS.md).
