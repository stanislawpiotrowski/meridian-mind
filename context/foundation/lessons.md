# Lessons Learned

> Append-only register of recurring rules and patterns. Re-read at start by /10x-frame, /10x-research, /10x-plan, /10x-plan-review, /10x-implement, /10x-impl-review.

## Decode uploaded text files explicitly — never trust File.text()'s UTF-8 assumption

- **Context**: Any browser-side ingestion of user-uploaded text/CSV files (e.g. `src/components/sets/ImportSetForm.tsx` and any future import path that reads a `File`/`Blob`).
- **Problem**: `File.text()` always decodes as UTF-8. A Windows-1250 file (the Polish Excel default) has bytes like 0xB3 ("ł") that are invalid UTF-8, so they become U+FFFD ("�") at read time — before parsing or DB write, making the corruption permanent. Surfaced in first-study-session (S-02) manual verification as broken diacritics in flashcard names ("Słoneczny Brzeg" → "S�oneczny Brzeg"); root cause was in the S-01 import path. Fixed in 294165b.
- **Rule**: Never use `File.text()` for user uploads that may contain non-ASCII text. Read `await file.arrayBuffer()` and decode with `new TextDecoder("utf-8", { fatal: true })`, falling back to `new TextDecoder("windows-1250")` (or the locale-appropriate legacy charset) on decode failure.
- **Applies to**: plan, implement, impl-review
