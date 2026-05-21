---
bootstrapped_at: 2026-05-21T21:54:24Z
starter_id: 10x-astro-starter
starter_name: "10x Astro Starter (Astro + Supabase + Cloudflare)"
project_name: meridian-mind
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: "npm audit --json"
---

## Hand-off

Verbatim copy of `context/foundation/tech-stack.md`:

```yaml
---
starter_id: 10x-astro-starter
package_manager: npm
project_name: meridian-mind
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
---
```

### Why this stack

Solo developer building MeridianMind — an interactive geo-flashcard web app for cram-mode geography students — in a 5-week after-hours window. The 10x Astro Starter is the recommended default for `(web-app, js)` and clears all four agent-friendly gates (explicit TypeScript types end-to-end, convention-based via Astro file-routing + Supabase schema-first data, popular within JS training data, well-documented). It pre-wires the three biggest tech-forcing features in the PRD: email + password auth (FR-001/2/3 via Supabase), persistent cross-session storage for sets and per-item study history (FR-015 via Supabase Postgres), and an interactive map UX through React islands (FR-010/11). Cloudflare Pages is the starter's first deployment default and the cheapest path to first deploy. CI runs on GitHub Actions with auto-deploy-on-merge — the shape the starter ships. Scaffolding confidence is first-class (registered with a valid CLI but not yet end-to-end-verified); expect mostly-smooth scaffolding with occasional manual steps. AI features are explicit Non-Goals in the PRD; SRS prioritization runs synchronously, so no background-jobs feature is needed at MVP.

## Pre-scaffold verification

| Signal       | Value                                                                  | Severity | Notes                                                                |
| ------------ | ---------------------------------------------------------------------- | -------- | -------------------------------------------------------------------- |
| npm package  | not run                                                                | n/a      | `cmd_template` starts with `git clone`; no npm `create-*` CLI to query |
| GitHub repo  | przeprogramowani/10x-astro-starter last pushed 2026-05-17 (4 days ago) | fresh    | from card `docs_url`; pulled via REST API (gh CLI not on PATH)         |

## Scaffold log

**Resolved invocation** (after `{name}` / `{pm}` substitution and two environment-specific TLS patches applied with user consent):

```
git -c http.sslBackend=schannel clone --progress \
  https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold \
  && cd .bootstrap-scaffold \
  && NODE_OPTIONS=--use-system-ca npm install
```

**Base `cmd_template` from the registry card**: `git clone https://github.com/przeprogramowani/10x-astro-starter {name} && cd {name} && {pm} install`

**Strategy**: git-clone (clone into temp dir, delete `.git/`, move up under conflict matrix)
**Exit code**: 0 (after recovery from two earlier failed attempts — see Notes)
**npm install duration**: ~52 seconds, 773 packages added
**Files moved**: 18

| Type      | Items                                                                                                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hidden    | `.env.example`, `.github/`, `.husky/`, `.nvmrc`, `.prettierrc.json`, `.vscode/`                                                                                                |
| Visible   | `astro.config.mjs`, `components.json`, `eslint.config.js`, `node_modules/`, `package.json`, `package-lock.json`, `public/`, `README.md`, `src/`, `supabase/`, `tsconfig.json`, `wrangler.jsonc` |

**Conflicts (`.scaffold` siblings)**: `CLAUDE.md.scaffold` (user's pre-existing `CLAUDE.md` preserved; starter's CLAUDE.md sidelined for diff)
**`.gitignore` handling**: append-merged. The user's single line (`.claude/skills/`) was preserved at the top; the starter's 18 lines were appended under a `# from 10x-astro-starter` separator. No de-dupe collisions.
**`context/` handling**: scaffold did not ship a `context/` directory, so nothing to drop. User's `context/foundation/` (prd.md, shape-notes.md, tech-stack.md, README.md, shape-notes_idea1.md) preserved verbatim — verified post-move.
**`.bootstrap-scaffold` cleanup**: deleted.

### Notes — what actually happened during this run

Two environment-specific failures and a tool-induced cwd-persistence issue had to be navigated before the chain landed at exit 0. Recorded here for audit-trail completeness:

1. **Git OpenSSL backend cert failure** — first attempt with the literal `cmd_template` failed at `git clone` with `SSL certificate problem: unable to get local issuer certificate`. The Git-for-Windows bundled `ca-bundle.crt` (last refreshed 2024-09-24) couldn't verify github.com's leaf cert. Resolved by adding `-c http.sslBackend=schannel` (Windows OS trust store) to the git invocation for this run only. No global git config change.
2. **Node TLS cert failure** — second attempt cleared git but failed at `npm install` with `UNABLE_TO_VERIFY_LEAF_SIGNATURE` against `registry.npmjs.org`, then crashed with npm's `Exit handler never called!` (downstream of the cert failures). Same root cause as #1 — Node's bundled cert store also lacked the required issuer. Resolved by setting `NODE_OPTIONS=--use-system-ca` (Node 24+ flag pointing TLS at the OS trust store) for the install for this run only.
3. **Cwd persistence + nested scaffold** — the `cd .bootstrap-scaffold` inside the brace group leaked across Bash tool invocations (the harness preserves cwd between calls). The third successful chain therefore cloned into `.bootstrap-scaffold/.bootstrap-scaffold/` (nested). Recovered by promoting the inner canonical scaffold up one level (atomic rename), wiping the outer wrapper which still held stale residue from the second-attempt broken install, then applying the conflict matrix normally.

The user approved each environment patch via an explicit choice between (a) patching this run only, (b) HARD-STOP and fix permanently, and (c) abort. Option (a) was picked both times. The cwd-persistence recovery did not need a prompt — it was a clean recovery preserving all in-flight state.

## Post-scaffold audit

**Tool**: `npm audit --json`
**Summary**: 0 CRITICAL, 1 HIGH, 9 MODERATE, 0 LOW (10 total)
**Direct vs transitive**: 0/0/2/0 direct of total 0/1/9/0 (the 1 HIGH is transitive; 2 of the 9 MODERATE findings are direct dependencies)
**Dependency footprint**: 449 prod, 316 dev, 131 optional — 895 packages total

#### CRITICAL findings

(none)

#### HIGH findings

- **devalue** (transitive — pulled in via `@cloudflare/vite-plugin` → `wrangler` → `miniflare`)
  - Affected versions: 5.6.3 – 5.8.0
  - Advisory: [GHSA-77vg-94rm-hx3p](https://github.com/advisories/GHSA-77vg-94rm-hx3p) — Svelte devalue: DoS via sparse array deserialization
  - CVSS: 7.5 (AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H) — network attacker, no auth, availability impact
  - CWE: CWE-770 (Allocation of Resources Without Limits or Throttling)
  - Fix available: yes — bumping `@cloudflare/vite-plugin` resolves the chain

#### MODERATE findings (9)

| Package                  | Direct? | Via / effects                                       | Advisory / fix                                                                |
| ------------------------ | ------- | --------------------------------------------------- | ----------------------------------------------------------------------------- |
| `@astrojs/check`         | DIRECT  | via `@astrojs/language-server` → `volar-service-yaml` → `yaml-language-server` → `yaml` | downgrade to 0.9.2 (SemVer major — verify TS check still passes) |
| `wrangler`               | DIRECT  | via `miniflare` → `ws`                              | fix available (in-range)                                                      |
| `@astrojs/language-server` | transitive | via `volar-service-yaml`; effects `@astrojs/check` | fix via `@astrojs/check` downgrade                                            |
| `@cloudflare/vite-plugin` | transitive | via `miniflare` / `wrangler` / `ws`               | fix available (in-range)                                                      |
| `miniflare`              | transitive | via `ws`; effects `@cloudflare/vite-plugin`, `wrangler` | fix available                                                              |
| `volar-service-yaml`     | transitive | via `yaml-language-server`; effects `@astrojs/language-server` | fix via `@astrojs/check` downgrade                                  |
| `ws`                     | transitive | [GHSA-58qx-3vcg-4xpx](https://github.com/advisories/GHSA-58qx-3vcg-4xpx) — uninitialized memory disclosure; CVSS 4.4 (CWE-908); affected 8.0.0–8.20.0 | fix available                                  |
| `yaml`                   | transitive | [GHSA-48c2-rrv3-qjmp](https://github.com/advisories/GHSA-48c2-rrv3-qjmp) — stack overflow via deeply nested YAML; CVSS 4.3 (CWE-674); affected 2.0.0–2.8.2 | fix via `@astrojs/check` downgrade |
| `yaml-language-server`   | transitive | via `yaml`; effects `volar-service-yaml`            | fix via `@astrojs/check` downgrade                                            |

#### LOW / INFO findings

(none)

The `@astrojs/check` family of advisories (5 of the 9 MODERATEs are reachable only through this chain) is resolved by a single SemVer-major downgrade of the direct dep, which npm flagged as the suggested fix. `wrangler` and its transitive chain (`miniflare`, `@cloudflare/vite-plugin`, `ws`) accept an in-range update. The HIGH `devalue` advisory also moves via the `wrangler` chain.

Suggested triage (not run by bootstrapper — informational only):

```
npm audit fix                  # in-range bumps for wrangler / miniflare / cloudflare-vite-plugin / ws / devalue
npm audit fix --force          # also runs the @astrojs/check 0.9.2 downgrade (SemVer-major; verify build)
```

## Hints recorded but not acted on

Bootstrapper v1 reads these hints but takes no automated action; preserved here for the future memory-architecture skill (or human reader) to consume.

| Hint                       | Value                  |
| -------------------------- | ---------------------- |
| `bootstrapper_confidence`  | first-class            |
| `quality_override`         | false                  |
| `path_taken`               | standard               |
| `self_check_answers`       | null                   |
| `team_size`                | solo                   |
| `deployment_target`        | cloudflare-pages       |
| `ci_provider`              | github-actions         |
| `ci_default_flow`          | auto-deploy-on-merge   |
| `has_auth`                 | true                   |
| `has_payments`             | false                  |
| `has_realtime`             | false                  |
| `has_ai`                   | false                  |
| `has_background_jobs`      | false                  |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:

- **Initialize your own git history**: this repository already has a `.git/` from the pre-bootstrap chain (the foundation work in `context/`). Run `git status` to confirm nothing was clobbered, then `git add` the new scaffold files and commit. The starter's upstream git history was deliberately discarded during the move-up (`git-clone` strategy) so it doesn't leak into yours.
- **Review the `CLAUDE.md.scaffold` sibling**: the starter ships its own `CLAUDE.md` (3218 bytes — Astro + Supabase guidance). Diff it against your existing `CLAUDE.md` (`diff CLAUDE.md CLAUDE.md.scaffold`) and merge whichever parts are useful; delete the `.scaffold` sibling when done.
- **Address audit findings per your risk tolerance**: the full breakdown is in the `## Post-scaffold audit` section above. The single HIGH (`devalue`, transitive) and the moderate `wrangler`/`miniflare`/`ws` cluster can be resolved with `npm audit fix` (in-range). The `@astrojs/check` MODERATE cluster requires a SemVer-major downgrade — verify your TS check still passes if you take it.
- **Configure Supabase RLS early**: the starter ships Supabase auth + Postgres + storage. Row-Level-Security must be configured on every table from the start, or the data-isolation NFR in the PRD (no cross-user observation) will quietly leak. The starter's gotchas in the registry card flag this explicitly.
- **(Optional — for your environment) Fix Git and Node TLS permanently**: this run patched both per-invocation. Permanent options are `git config --global http.sslBackend schannel` and setting `NODE_OPTIONS=--use-system-ca` in your user environment (or `NODE_EXTRA_CA_CERTS` pointing at the appropriate certificate). Future scaffolds in this environment will hit the same cert issue without these.
