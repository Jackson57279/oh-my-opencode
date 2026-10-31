import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import test from "node:test";
import assert from "node:assert/strict";

const pluginRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const skillsRoot = join(pluginRoot, "skills");
const syncScript = join(pluginRoot, "scripts", "sync-skills.mjs");

function readSkill(name) {
	return readFileSync(join(skillsRoot, name, "SKILL.md"), "utf8");
}

test("synced skill tree is complete and committed", () => {
	const dirs = readdirSync(skillsRoot, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
	for (const expected of [
		"ultrawork", "ulw-plan", "ulw-execute", "ulw-research", "review-work",
		"debugging", "programming", "frontend", "refactor", "git-master",
		"visual-qa", "browser", "ast-grep", "init-deep", "lsp-setup",
		"data-scientist", "coding-agent-sessions", "remove-ai-slops", "ultimate-browsing",
	]) {
		assert.ok(dirs.includes(expected), `missing skill dir: ${expected}`);
		assert.ok(existsSync(join(skillsRoot, expected, "SKILL.md")), `missing SKILL.md: ${expected}`);
	}
});

test("every emitted SKILL.md has parseable name + description frontmatter", () => {
	const dirs = readdirSync(skillsRoot, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
	for (const name of dirs) {
		const content = readSkill(name);
		const fm = content.match(/^---\n([\s\S]*?)\n---/);
		assert.ok(fm, `${name}: no frontmatter`);
		assert.match(fm[1], /^name:\s*\S+/m, `${name}: no name`);
		const desc = fm[1].match(/^description:(.*)$/m);
		assert.ok(desc, `${name}: no description`);
		const inline = desc[1].trim();
		if (inline && !/^[|>"']/.test(inline)) {
			assert.ok(!inline.includes(": "), `${name}: unquoted ': ' in description breaks YAML`);
		}
	}
});

test("harness compat sections are rewritten for Devin", () => {
	for (const name of ["review-work", "ulw-execute", "ulw-research"]) {
		const content = readSkill(name);
		assert.match(content, /## Devin Harness Tool Compatibility/, name);
		assert.ok(!content.includes("## Codex Harness Tool Compatibility"), `${name}: codex section survived`);
		assert.match(content, /run_subagent/, name);
	}
});

test("ultrawork skill composes the canonical directive with the Devin block", () => {
	const content = readSkill("ultrawork");
	assert.match(content, /## Devin Harness Tool Compatibility/);
	assert.match(content, /ULTRAWORK MODE ENABLED!/);
	assert.match(content, /## Devin Subagent Reliability/);
});

test("sync --check passes on the committed tree", () => {
	const result = spawnSync(process.execPath, [syncScript, "--check"], { encoding: "utf8", timeout: 120_000 });
	assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("sync --check detects drift", () => {
	const staged = mkdtempSync(join(tmpdir(), "omo-devin-check-"));
	try {
		// Generate into a temp target is covered by --check on the real tree;
		// here we assert the validator catches a bad frontmatter directly.
		const bad = "---\nname: bad\ndescription: Triggers: unquoted colon\n---\n";
		const result = spawnSync(process.execPath, ["--input-type=module", "-e", `
			import { readFileSync } from "node:fs";
			const src = ${JSON.stringify(readFileSync(syncScript, "utf8"))};
			const m = src.match(/function validateSkillFrontmatter[\\s\\S]*?\\n}/);
			eval(m[0]);
			try { validateSkillFrontmatter("bad", ${JSON.stringify(bad)}); console.log("NO_THROW"); }
			catch { console.log("THREW"); }
		`], { encoding: "utf8", timeout: 15_000 });
		assert.match(result.stdout, /THREW/);
	} finally {
		rmSync(staged, { recursive: true, force: true });
	}
});
