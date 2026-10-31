#!/usr/bin/env node
// Regenerate packages/omo-devin/plugin/skills/ from packages/shared-skills/skills/
// plus the canonical prompts-core ultrawork directive, adapted for the Devin
// harness. Mirrors the codex adapter's sync pipeline: wipe -> copy (filtered)
// -> harness adaptation -> ultrawork compose -> frontmatter validation.
//
//   node scripts/sync-skills.mjs          # regenerate in place
//   node scripts/sync-skills.mjs --check  # assert the committed tree is fresh

import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { createSkillSourceCopyFilter } from "../../../shared-skills/skill-source-filter.mjs";

const pluginRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = join(pluginRoot, "..", "..", "..");
const sharedSkillsRoot = join(repoRoot, "packages", "shared-skills", "skills");
const ultraworkDirectivePath = join(repoRoot, "packages", "prompts-core", "prompts", "ultrawork", "default.md");
const checkMode = process.argv.includes("--check");

const DEVIN_COMPAT_BLOCK = `## Devin Harness Tool Compatibility

Translate any OpenCode- or Codex-only tool name in an inherited example to its Devin CLI equivalent:

| Other-harness example | Devin tool to use |
| --- | --- |
| \`task(subagent_type="explore", ...)\` / \`call_omo_agent(subagent_type="explore", ...)\` | \`run_subagent(profile="subagent_explore", task="...", is_background=true)\` |
| \`task(subagent_type="librarian", ...)\` / \`call_omo_agent(subagent_type="librarian", ...)\` | \`run_subagent(profile="omo:librarian", task="...", is_background=true)\` |
| \`task(subagent_type="oracle", ...)\` for consultation or final verification | \`run_subagent(profile="omo:oracle", task="...", is_background=false)\` |
| \`task(subagent_type="momus", ...)\` for plan review | \`run_subagent(profile="omo:momus", task="...", is_background=false)\` |
| \`task(subagent_type="metis", ...)\` for pre-planning analysis | \`run_subagent(profile="omo:metis", task="...", is_background=false)\` |
| \`task(subagent_type="prometheus", ...)\` / \`task(subagent_type="plan", ...)\` | \`run_subagent(profile="omo:prometheus", task="...")\` |
| \`task(subagent_type="multimodal-looker", ...)\` / \`look_at(...)\` | \`run_subagent(profile="omo:multimodal-looker", task="...")\` or \`read\` on the media file |
| \`task(category="...", ...)\` / worker spawns for implementation or QA | \`run_subagent(profile="omo:sisyphus-junior", task="...", is_background=true)\` (or \`subagent_general\` when the omo plugin is absent) |
| \`background_output(task_id="...")\` | \`read_subagent(agent_id, block=true)\` |
| \`team_*(...)\` | parallel \`run_subagent\` fan-out + \`read_subagent\` to collect |
| \`todowrite(...)\` | \`todo_write(...)\` |
| \`bash(...)\` | \`exec(...)\` |
| \`load_skills=[...]\` on a spawn | name the skills inside the \`task\` text (e.g. "invoke the /omo:ulw-plan skill"); subagents invoke skills with the \`skill\` tool |

Devin subagents never inherit parent conversation history — write every \`task\` as a self-contained assignment (see Devin Subagent Reliability). Foreground subagents return their result when done; background subagents notify the parent on completion and are collected with \`read_subagent\`. If a code block below conflicts with this section, this section wins.

## Devin Subagent Reliability

Every \`run_subagent\` task string must be self-contained. Start with
\`TASK: <imperative assignment>\`, then name \`DELIVERABLE\`, \`SCOPE\`, and
\`VERIFY\`. State that it is an executable assignment, not a context
handoff — the child receives only what the task text carries, never the
parent's conversation. Role or specialty instructions belong inside \`task\`.

Review lanes are leaf agents: a lane does its own reading, running, and
judging inline and never spawns sub-reviewers of its own (nested spawning is
off by default). Reviewers are one-shot: a lane ends at its verdict; a
re-review after fixes is a fresh \`run_subagent\` scoped to the delta plus
current evidence, never a resume of a long-lived reviewer carrying stale
context.

Plan and reviewer agents may run for a long time; spawn them with
\`is_background=true\` and keep doing independent root work, then collect them
with \`read_subagent(agent_id, block=true)\`. Track spawned agent ids locally;
the completion notification, not a poll loop, is the progress signal. Treat a
running child as alive. Fall back to a smaller respawn only when the child
completed without the deliverable or is no longer running — then mark that
lane \`INCONCLUSIVE\`, do not count it as PASS or approval. Preserve completed
lane results immediately; if the retry budget is exhausted, keep the lane
\`INCONCLUSIVE\` and still emit a final aggregate result. If a code block
below conflicts with this section, this section wins.
`;

const ULTRAWORK_FRONTMATTER = `---
name: ultrawork
description: "Binding ultrawork mode directive for omo on Devin CLI. When a prompt contains ultrawork or ulw, the omo UserPromptSubmit hook injects a short bootstrap that points at this file. Read the whole file and follow every rule in it for the rest of the task."
metadata:
  short-description: "Binding ultrawork mode directive"
---

`;

function replaceHarnessSections(content) {
	// The shared skills carry Codex-specific compat sections. Swap every
	// consecutive run of "## Codex ..." sections for the Devin equivalents.
	// Boundary: the first subsequent h1 ("# ") or h2 ("## ") heading that is
	// not itself a Codex section; "###" and deeper stay inside the block.
	const start = content.indexOf("## Codex Harness Tool Compatibility");
	if (start === -1) return content;
	let end = content.length;
	let cursor = start + 1;
	while (true) {
		const idx = content.indexOf("\n#", cursor);
		if (idx === -1) break;
		const after = idx + 1;
		if (content.startsWith("## Codex", after)) {
			cursor = after + 1;
			continue;
		}
		if (content.startsWith("# ", after) || content.startsWith("## ", after)) {
			end = after;
			break;
		}
		cursor = after + 1;
	}
	return `${content.slice(0, start)}${DEVIN_COMPAT_BLOCK}\n${content.slice(end).replace(/^\n+/, "")}`;
}

function validateSkillFrontmatter(skillName, content) {
	const fm = content.match(/^---\n([\s\S]*?)\n---/);
	if (!fm) throw new Error(`${skillName}: missing YAML frontmatter`);
	const block = fm[1];
	if (!/^name:\s*\S+/m.test(block)) throw new Error(`${skillName}: missing name:`);
	const descLine = block.match(/^description:(.*)$/m);
	if (!descLine) throw new Error(`${skillName}: missing description:`);
	const inline = descLine[1].trim();
	// An unquoted scalar containing ": " is a YAML syntax error and Devin
	// silently drops the skill. Require quoting or a block scalar.
	if (inline && !/^[|>"']/.test(inline) && inline.includes(": ")) {
		throw new Error(`${skillName}: description contains ': ' unquoted — quote it or use a block scalar`);
	}
}

async function copySkill(name, sourceDir, targetDir) {
	await cp(sourceDir, targetDir, {
		recursive: true,
		filter: createSkillSourceCopyFilter(sourceDir, { ignoredFileNames: ["openai.yaml"] }),
	});
	const skillMdPath = join(targetDir, "SKILL.md");
	const content = await readFile(skillMdPath, "utf8");
	const adapted = replaceHarnessSections(content);
	if (adapted !== content) await writeFile(skillMdPath, adapted);
	validateSkillFrontmatter(name, adapted);
}

async function sync(targetRoot) {
	const entries = (await readdir(sharedSkillsRoot, { withFileTypes: true }))
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort();
	for (const name of entries) {
		await copySkill(name, join(sharedSkillsRoot, name), join(targetRoot, name));
	}
	// Compose the ultrawork skill from the canonical prompts-core directive —
	// same composition as the codex adapter (read the canonical file directly).
	const directive = await readFile(ultraworkDirectivePath, "utf8");
	const ultraworkDir = join(targetRoot, "ultrawork");
	await mkdir(ultraworkDir, { recursive: true });
	const ultraworkSkill = `${ULTRAWORK_FRONTMATTER}${DEVIN_COMPAT_BLOCK}\n${directive}`;
	await writeFile(join(ultraworkDir, "SKILL.md"), ultraworkSkill);
	validateSkillFrontmatter("ultrawork", ultraworkSkill);
	return [...entries, "ultrawork"];
}

async function collectFiles(root) {
	const out = new Map();
	async function walk(dir) {
		for (const entry of await readdir(dir, { withFileTypes: true })) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) await walk(full);
			else if (entry.isFile()) out.set(full.slice(root.length + 1), await readFile(full, "utf8"));
		}
	}
	await walk(root);
	return out;
}

async function check() {
	const staged = await mkdtemp(join(tmpdir(), "omo-devin-skills-"));
	try {
		await sync(staged);
		const expected = await collectFiles(staged);
		const actual = await collectFiles(join(pluginRoot, "skills"));
		const problems = [];
		for (const [rel, text] of expected) {
			if (!actual.has(rel)) problems.push(`missing: ${rel}`);
			else if (actual.get(rel) !== text) problems.push(`stale: ${rel}`);
		}
		for (const rel of actual.keys()) {
			if (!expected.has(rel)) problems.push(`stray: ${rel}`);
		}
		if (problems.length > 0) {
			console.error(`plugin/skills is out of sync (${problems.length} problems). Run: node packages/omo-devin/plugin/scripts/sync-skills.mjs`);
			for (const p of problems.slice(0, 40)) console.error(`  ${p}`);
			process.exit(1);
		}
		console.log(`plugin/skills is fresh (${expected.size} files).`);
	} finally {
		await rm(staged, { recursive: true, force: true });
	}
}

if (checkMode) {
	await check();
} else {
	const skillsRoot = join(pluginRoot, "skills");
	await rm(skillsRoot, { recursive: true, force: true });
	await mkdir(skillsRoot, { recursive: true });
	const names = await sync(skillsRoot);
	console.log(`Synced ${names.length} skills into plugin/skills: ${names.join(", ")}`);
}
