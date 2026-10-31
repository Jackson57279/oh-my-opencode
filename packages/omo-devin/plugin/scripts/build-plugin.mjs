#!/usr/bin/env node
// Build pipeline for the omo Devin plugin: materialize shared-skill upstream
// refs (best effort), regenerate plugin/skills, stamp the plugin manifest
// version from the repo root package.json.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const pluginRoot = dirname(scriptsDir);
const repoRoot = join(pluginRoot, "..", "..", "..");
const materialize = join(repoRoot, "packages", "omo-codex", "plugin", "scripts", "materialize-shared-upstreams.mjs");

// The frontend skill's third-party references materialize from pinned git
// submodules. Non-fatal so an offline/submodule-less checkout still builds,
// matching script/agent/setup.sh behavior; CI runs this same script --strict
// earlier in the root build chain.
const mat = spawnSync(process.execPath, [materialize], { stdio: "inherit" });
if (mat.status !== 0) {
	console.warn("warning: materialize-shared-upstreams failed or skipped (offline checkout?); continuing without frontend third-party refs");
}

const sync = spawnSync(process.execPath, [join(scriptsDir, "sync-skills.mjs")], { stdio: "inherit" });
if (sync.status !== 0) process.exit(sync.status ?? 1);

const manifestPath = join(pluginRoot, ".devin-plugin", "plugin.json");
const pluginPkgPath = join(pluginRoot, "package.json");
const rootPkg = JSON.parse(await readFile(join(repoRoot, "package.json"), "utf8"));
for (const path of [manifestPath, pluginPkgPath]) {
	const json = JSON.parse(await readFile(path, "utf8"));
	if (json.version !== rootPkg.version) {
		json.version = rootPkg.version;
		await writeFile(path, `${JSON.stringify(json, null, "\t")}\n`);
		console.log(`stamped ${path} -> ${rootPkg.version}`);
	}
}
console.log("omo-devin plugin build complete.");
