import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import test from "node:test";
import assert from "node:assert/strict";

const pluginRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const hook = join(pluginRoot, "scripts", "omo-hook.mjs");

function runHook(event, payload, env = {}) {
	const result = spawnSync(process.execPath, [hook, event], {
		input: JSON.stringify(payload),
		env: { ...process.env, ...env },
		encoding: "utf8",
		timeout: 10_000,
	});
	return { status: result.status, stdout: result.stdout.trim(), stderr: result.stderr };
}

function contextOf(stdout) {
	if (!stdout) return null;
	const parsed = JSON.parse(stdout);
	return parsed.hookSpecificOutput?.additionalContext ?? null;
}

test("session-start emits the OMO session pointer", () => {
	const { status, stdout } = runHook("session-start", { hook_event_name: "SessionStart", source: "startup", session_id: "s1" });
	assert.equal(status, 0);
	const ctx = contextOf(stdout);
	assert.match(ctx, /<omo-mode>/);
	assert.match(ctx, /omo:ultrawork/);
	assert.match(ctx, /omo:oracle/);
});

test("user-prompt-submit injects ultrawork bootstrap on keyword", () => {
	for (const prompt of ["please ultrawork this change", "ulw this", "ULTRAWORK the refactor"]) {
		const { status, stdout } = runHook("user-prompt-submit", { hook_event_name: "UserPromptSubmit", prompt });
		assert.equal(status, 0, prompt);
		const ctx = contextOf(stdout);
		assert.match(ctx, /<ultrawork-mode>/, prompt);
		assert.match(ctx, /ULTRAWORK MODE ENABLED!/, prompt);
		assert.match(ctx, /omo:ultrawork/, prompt);
	}
});

test("user-prompt-submit is silent on non-trigger prompts", () => {
	for (const prompt of ["fix the bug", "run ulw-plan for this", "ulw-research auth flows", "ulw-execute the plan", ""]) {
		const { status, stdout } = runHook("user-prompt-submit", { hook_event_name: "UserPromptSubmit", prompt });
		assert.equal(status, 0, prompt);
		assert.equal(stdout, "", `expected no output for: ${prompt}`);
	}
});

test("post-compact re-injects the session pointer", () => {
	const { status, stdout } = runHook("post-compact", { hook_event_name: "PostCompaction", summary: "…" });
	assert.equal(status, 0);
	assert.match(contextOf(stdout), /<omo-mode>/);
});

test("hook never blocks: garbage stdin and unknown events still exit 0", () => {
	const garbage = spawnSync(process.execPath, [hook, "user-prompt-submit"], { input: "not-json{", encoding: "utf8" });
	assert.equal(garbage.status, 0);
	const unknown = runHook("some-future-event", {});
	assert.equal(unknown.status, 0);
});

test("OMO_DEVIN_HOOK_LOG records the event payload", () => {
	const dir = mkdtempSync(join(tmpdir(), "omo-hook-log-"));
	try {
		const logPath = join(dir, "hook.jsonl");
		runHook("session-start", { session_id: "abc" }, { OMO_DEVIN_HOOK_LOG: logPath });
		const lines = readFileSync(logPath, "utf8").trim().split("\n");
		const record = JSON.parse(lines[0]);
		assert.equal(record.event, "session-start");
		assert.equal(record.stdin.session_id, "abc");
		assert.ok(record.pluginRoot.endsWith("plugin"));
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
