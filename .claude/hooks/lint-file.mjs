#!/usr/bin/env node
// PostToolUse hook (Write|Edit): lint + auto-fix ONLY the file the agent just
// edited, instead of the whole project. The old `eslint --fix .` re-touched
// every file on each edit (the CRLF churn you saw); this scopes it to one file.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

let event = {};
try {
  event = JSON.parse(readFileSync(0, "utf8") || "{}");
} catch {
  process.exit(0);
}

const filePath = event?.tool_input?.file_path;
if (!filePath) process.exit(0);

let rel = path.isAbsolute(filePath)
  ? path.relative(process.cwd(), filePath)
  : filePath;
rel = rel.split(path.sep).join("/");

// Only lint files ESLint actually handles in this project.
if (!/\.(ts|tsx|astro|js|jsx|mjs|cjs)$/.test(rel)) process.exit(0);

const res = spawnSync(`npx eslint --fix --quiet "${rel}"`, {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

// exit 2 on remaining lint errors so the agent sees them and fixes them.
process.exit(res.status === 0 ? 0 : 2);
