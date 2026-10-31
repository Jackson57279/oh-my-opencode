# OMO — Agentic Workflow for Devin

The `omo` plugin is active. It brings the oh-my-openagent workflow layer into
Devin CLI: skills, specialist subagents, rules, lifecycle hooks, and MCP
servers.

## Skills (`/omo:*`)

Invoke with `/omo:<name>` or let them auto-load on matching prompts:

| Skill | Use |
|-------|-----|
| `ultrawork` | Maximum-precision, certainty-first, evidence-bound execution mode. Triggered by "ultrawork" or "ulw" in a prompt. |
| `ulw-plan` | Explore-first planning consultant; writes one decision-complete `.omo/plans/` plan. |
| `ulw-execute` | Orchestrated execution of a written ulw plan: Boulder state, evidence ledger, parallel subagents. |
| `ulw-research` | Maximum-saturation research: parallel worker swarms, cited/proven claims, synthesis. |
| `review-work` | Gate review of finished work: manual QA on the real surface + one gate reviewer. |
| `debugging` | Structured diagnosis loop for hard bugs and regressions. |
| `programming` | Language-level rules for Python/Rust/TS/JS/Go, incl. the test-authoring gate. |
| `frontend` | Frontend taste + design references. |
| `refactor`, `remove-ai-slops` | Refactoring discipline; AI-slop cleanup. |
| `git-master` | Git surgery and history work. |
| `visual-qa`, `browser` | Visual evidence capture; bundled browser runtime. |
| `data-scientist`, `coding-agent-sessions`, `ast-grep`, `lsp-setup`, `init-deep`, `ultimate-browsing` | Domain + tooling skills. |

## Subagents (`omo:*`)

Delegate with `run_subagent(profile="<name>", task="<self-contained task>")`:

| Profile | Role |
|---------|------|
| `omo:oracle` | Read-only deep-reasoning consultant (hard bugs, architecture). |
| `omo:librarian` | External research: remote codebases, official docs, OSS examples, permalink evidence. |
| `omo:momus` | Plan reviewer: executability + reference validity, APPROVED/BLOCKED verdict. |
| `omo:metis` | Pre-planning: hidden intentions, ambiguities, AI failure points. |
| `omo:prometheus` | Strategic planner; writes `.omo/` plans only, never implements. |
| `omo:multimodal-looker` | PDF/image/diagram analysis and extraction. |
| `omo:sisyphus-junior` | Focused executor for well-scoped units; cannot delegate. |

Built-in `subagent_explore` and `subagent_general` remain available alongside.

## Ultrawork trigger

A `UserPromptSubmit` hook watches for `ultrawork` or `ulw` (excluding
`ulw-plan`/`ulw-research`/`ulw-execute`). On match it injects the ultrawork
bootstrap: announce `ULTRAWORK MODE ENABLED!` first, then invoke
`/omo:ultrawork` and follow its directive for the rest of the task.

## Evidence discipline

- "It should work" is not evidence. Run the verification and capture real output.
- Delegated tasks need self-contained task text (TASK / DELIVERABLE / SCOPE / VERIFY).
- Prefer specialist subagents for what they own: oracle for reasoning, librarian for external sources, momus for plan review.

## MCP servers

`grep_app` (code search) and `context7` (library docs) start with the session.
