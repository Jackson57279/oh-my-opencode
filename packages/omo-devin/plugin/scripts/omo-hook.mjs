#!/usr/bin/env node
// OMO lifecycle hook entry for Devin CLI.
// Reads one hook payload as JSON on stdin, writes one JSON object on stdout.
// Contract (mirrors the Codex ultrawork component): never block a turn, never
// make a network call, always exit 0.

import { appendFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ULTRAWORK_PATTERN = /(?:ultrawork|ulw(?!-(?:plan|research|execute)))/i;
const PLUGIN_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ULTRAWORK_SKILL_PATH = join(PLUGIN_ROOT, "skills", "ultrawork", "SKILL.md");

const SESSION_CONTEXT = [
	"<omo-mode>",
	"The OMO plugin is active in this session.",
	"- Skills: invoke as /<plugin>:<skill>, e.g. /omo:ultrawork, /omo:ulw-plan,",
	"  /omo:ulw-execute, /omo:ulw-research, /omo:review-work, /omo:debugging,",
	"  /omo:programming, /omo:frontend, /omo:git-master, /omo:refactor.",
	'- Subagents: run_subagent(profile) supports omo:oracle (deep reasoning),',
	"  omo:librarian (external docs/code research), omo:momus (plan review),",
	"  omo:metis (pre-planning intent analysis), omo:prometheus (planner),",
	"  omo:multimodal-looker (media files), omo:sisyphus-junior (focused executor).",
	"- Trigger: the words ultrawork or ulw in a user prompt activate",
	"  ULTRAWORK MODE via the omo:ultrawork skill.",
	"</omo-mode>",
].join("\n");

const ULTRAWORK_CONTEXT = [
	"<ultrawork-mode>",
	"The user invoked ULTRAWORK MODE.",
	'Your FIRST user-visible line MUST be exactly: "ULTRAWORK MODE ENABLED!"',
	"Then invoke the bundled /omo:ultrawork skill (skill tool, name",
	'"omo:ultrawork") and follow its directive exactly: absolute certainty',
	"before implementation, evidence-bound QA, no excuses, deliver what was",
	"asked.",
	`If the skill cannot be invoked, read the directive at`,
	`${ULTRAWORK_SKILL_PATH}`,
	"and follow it.",
	"</ultrawork-mode>",
].join("\n");

function emit(event, additionalContext) {
	process.stdout.write(
		JSON.stringify({
			hookSpecificOutput: { hookEventName: event, additionalContext },
		}),
	);
}

function log(payload) {
	const target = process.env.OMO_DEVIN_HOOK_LOG;
	if (!target) return;
	try {
		appendFileSync(target, `${JSON.stringify(payload)}\n`);
	} catch {
		// Logging is best effort and must never break the hook.
	}
}

let raw = "";
process.stdin.on("data", (chunk) => {
	raw += chunk;
});

process.stdin.on("end", () => {
	let input = {};
	try {
		input = JSON.parse(raw || "{}");
	} catch {
		input = {};
	}
	const event = process.argv[2] ?? "unknown";
	log({ event, cwd: process.cwd(), pluginRoot: PLUGIN_ROOT, stdin: input });

	try {
		if (event === "session-start") {
			emit("SessionStart", SESSION_CONTEXT);
		} else if (event === "post-compact") {
			emit("PostCompaction", SESSION_CONTEXT);
		} else if (event === "user-prompt-submit") {
			const prompt = typeof input.prompt === "string" ? input.prompt : "";
			if (ULTRAWORK_PATTERN.test(prompt) && existsSync(ULTRAWORK_SKILL_PATH)) {
				emit("UserPromptSubmit", ULTRAWORK_CONTEXT);
			}
		}
	} catch {
		// Fail open: a hook error must never break the session.
	}
	process.exit(0);
});
