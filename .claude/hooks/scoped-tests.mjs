#!/usr/bin/env node
// PostToolUse hook (Write|Edit): run ONLY the Vitest tests related to the file
// the agent just edited — and only when that file sits in a risk area from
// context/foundation/test-plan.md. Edits to config/helpers/docs run nothing.
//
// Why Node instead of the lesson's `bash -c '... jq ...'`: this machine has no
// jq, and Node ships with the project. This is the Windows-friendly adaptation
// of the same trigger -> match -> check -> signal pattern.
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

// Hot-spot risk areas from test-plan.md §1. Only edits under these run tests.
const RISK_PREFIXES = [
  "src/lib/",
  "src/pages/api/",
  "src/components/map/",
  "src/components/study/",
  "src/components/sets/",
  "src/components/auth/",
];

// 1. Read the event JSON Claude Code pipes in on stdin (fd 0).
let event = {};
try {
  event = JSON.parse(readFileSync(0, "utf8") || "{}");
} catch {
  process.exit(0); // no parsable input -> nothing to do
}

const filePath = event?.tool_input?.file_path;
if (!filePath) process.exit(0);

// 2. Normalize to a repo-relative path with forward slashes.
let rel = path.isAbsolute(filePath)
  ? path.relative(process.cwd(), filePath)
  : filePath;
rel = rel.split(path.sep).join("/");

// 3. Match: only real source files, never the test files themselves.
if (!/\.(ts|tsx|astro)$/.test(rel)) process.exit(0);
if (/\.(test|spec)\.(ts|tsx)$/.test(rel)) process.exit(0);
if (!RISK_PREFIXES.some((p) => rel.startsWith(p))) process.exit(0);

// 4. Check: run the related tests. AI_AGENT=1 -> compact, failures-only output.
const res = spawnSync(`npx vitest related "${rel}" --run --passWithNoTests`, {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, AI_AGENT: "1" },
});

// 5. Signal: exit 2 on failure so the agent sees the output and reacts.
process.exit(res.status === 0 ? 0 : 2);
