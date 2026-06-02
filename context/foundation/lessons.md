# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Decode uploaded text files explicitly — never trust File.text()'s UTF-8 assumption

- **Context**: Any browser-side ingestion of user-uploaded text/CSV files (e.g. `src/components/sets/ImportSetForm.tsx` and any future import path that reads a `File`/`Blob`).
- **Problem**: `File.text()` always decodes as UTF-8. A Windows-1250 file (the Polish Excel default) has bytes like 0xB3 ("ł") that are invalid UTF-8, so they become U+FFFD ("�") at read time — before parsing or DB write, making the corruption permanent. Surfaced in first-study-session (S-02) manual verification as broken diacritics in flashcard names ("Słoneczny Brzeg" → "S�oneczny Brzeg"); root cause was in the S-01 import path. Fixed in 294165b.
- **Rule**: Never use `File.text()` for user uploads that may contain non-ASCII text. Read `await file.arrayBuffer()` and decode with `new TextDecoder("utf-8", { fatal: true })`, falling back to `new TextDecoder("windows-1250")` (or the locale-appropriate legacy charset) on decode failure.
- **Applies to**: plan, implement, impl-review

## Whole-repo lint is unreliable on Windows — CRLF baseline; verify lint on changed files only

- **Context**: Any change verified against `npm run lint` (`eslint .`) on a Windows checkout. Surfaced during navigation-shell (S-06) — both phases' "linting passes" criteria.
- **Problem**: The repo has no `.gitattributes` enforcing LF, so files are checked out CRLF on Windows. `prettier/prettier` then flags every line of untouched files with `Delete ␍`, so whole-repo `npm run lint` always exits 1. The lint-staged pre-commit hook only `--fix`es _staged_ files, so the baseline never heals — every change re-hits a red repo-wide gate, masking real new lint errors.
- **Rule**: Treat "lint passes" as scoped to the files a change touches: run `npx eslint <changed files>` (exit 0) rather than relying on `npm run lint`. Separately, fix the root cause once via a housekeeping change — add `.gitattributes` (`* text=auto eol=lf`) and run `prettier --write .` — so the whole-repo gate becomes trustworthy.
- **Applies to**: plan, implement, impl-review
