---
name: devin-qa
description: "QA the omo Devin adapter (packages/omo-devin) against the real Devin CLI in strict isolation, so ONLY our plugin is exercised and the user's real Devin home is never written. Builds a sandboxed XDG home (credentials copied), installs the plugin with `devin plugins install --local`, drives headless `devin -p` sessions, and proves hooks fired via the OMO_DEVIN_HOOK_LOG JSONL. Use whenever someone changes anything under packages/omo-devin or wants to QA, smoke-test, verify, or debug the Devin plugin, its skills/subagents/rules/hooks/MCPs, or the plugin install flow. Triggers: devin qa, qa devin, devin-qa, test devin plugin, verify devin hook, devin plugins install, isolated XDG devin."
---

# devin-qa — isolated QA for the omo Devin adapter

QA for `packages/omo-devin/` mirrors the codex-qa/senpi-qa contract: **drive the REAL harness, prove the thing fired, write evidence to disk, never touch the user's real state.**

## Isolation model (mandatory)

Devin CLI honors XDG. A sandboxed home is four temp dirs plus two copied auth files:

```bash
SANDBOX="$(mktemp -d)/home"
mkdir -p "$SANDBOX"/{config,data,state,cache}
mkdir -p "$SANDBOX/data/devin" "$SANDBOX/config/devin"
cp ~/.local/share/devin/credentials.toml "$SANDBOX/data/devin/"
cp ~/.config/devin/config.json "$SANDBOX/config/devin/"
export XDG_CONFIG_HOME="$SANDBOX/config" XDG_DATA_HOME="$SANDBOX/data" \
       XDG_STATE_HOME="$SANDBOX/state" XDG_CACHE_HOME="$SANDBOX/cache"
```

`scripts/sandbox-home.sh` prints these exports for `eval`. Prove the real
`~/.config/devin` + `~/.local/share/devin` are untouched by sha256-summing
`config.json`, `mcp_config.json`, `credentials.toml`, and
`cli/plugins/lock.json` BEFORE and AFTER.

## Driving the harness

```bash
node packages/omo-devin/plugin/scripts/build-plugin.mjs   # regenerate plugin/skills
devin plugins install --local <repo>/packages/omo-devin/plugin -y
devin plugins info omo          # must list skills + agents + hooks + MCP servers
devin skills list | grep '/omo:' # 19 skills expected
```

Headless sessions (work in a scratch dir — never the repo):

```bash
cd "$(mktemp -d)" && mkdir -p .omo
OMO_DEVIN_HOOK_LOG="$PWD/hook.jsonl" \
  timeout 240 devin -p --permission-mode bypass --respect-workspace-trust false \
  -- "<prompt>"
```

`--respect-workspace-trust false` is required for `-p` in an untrusted dir.
`OMO_DEVIN_HOOK_LOG` makes `scripts/omo-hook.mjs` append one JSONL record per
fired event — the hook-fired proof.

## Assertions that count as QA

1. `devin plugins install --local` exits 0; `devin plugins info omo` shows
   skills, all 7 `omo:*` agents, the 3 hooks, and both MCP servers.
2. `devin skills list` shows `/omo:ultrawork` plus the shared skills.
3. A `devin -p` session leaves `hook.jsonl` with `session-start` +
   `user-prompt-submit` records carrying the right `pluginRoot`.
4. A prompt containing `ultrawork` produces a `user-prompt-submit` hook record
   AND the session output shows the injected directive took effect (e.g.
   `ULTRAWORK MODE ENABLED!`).
5. Real-home isolation: sha256 before/after equal.

## Evidence

Write artifacts under `.omo/evidence/<YYYYMMDD>-<slug>/` (gitignored): install
transcript, `plugins info` + `skills list` captures, `hook.jsonl`, session
stdout, before/after sha256 list. Summarize in the PR QA & Evidence section.

## Scripts

- `scripts/sandbox-home.sh [dir]` — create sandbox + print env exports (`--self-test` validates it makes the dirs without devin).
- `scripts/install-local.sh <plugin-path>` — install inside the sandbox env.
- `scripts/drive-headless.sh <prompt> [workdir]` — run one headless session, print stdout, write `hook.jsonl` in the workdir.

Each script is safe to run under `set -euo pipefail`; they never write outside
the sandbox.
