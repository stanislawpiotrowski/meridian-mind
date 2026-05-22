# Repository Guidelines

MeridianMind is a geospatial flashcard SRS app where users learn to locate geographic points by clicking on an interactive map. Stack: Astro 6 (full SSR) + React 19 islands + Tailwind CSS 4 + Supabase (auth + data) + Cloudflare Workers. See @README.md for full setup and @CLAUDE.md.scaffold for architecture notes.

## Critical Rules

- Never read `SUPABASE_URL` or `SUPABASE_KEY` from client-side code; both are server-only secrets accessed via `astro:env/server`.
- Do not use `"use client"` or `"use server"` directives — this is not Next.js. Activate React components with `client:` directives inside `.astro` files.
- Use the `cn()` helper from `@/lib/utils` for all conditional or merged Tailwind class names; never concatenate class strings manually.
- API route handlers must export uppercase named functions (`GET`, `POST`, etc.) and validate all input with zod.
- All new Supabase tables must have RLS enabled with per-operation, per-role policies.

## Project Structure

Top-level source lives in `src/`: `components/` (PascalCase `.astro` or `.tsx`; `auth/` and `ui/` subdirs), `layouts/`, `lib/` (utilities, Supabase client; extracted business logic in `lib/services/`), `pages/` (Astro pages + `api/` endpoints), `middleware.ts` (auth guard; edit `PROTECTED_ROUTES` to add protected paths), and `styles/`. Path alias `@/*` → `src/*`. Shared entity and DTO types go in `src/types.ts`. shadcn/ui components live in `src/components/ui/` — add new ones with `npx shadcn@latest add [name]`.

## Commands

- `npm run dev` — dev server (Cloudflare workerd runtime; reads `.dev.vars` for secrets)
- `npm run build` — production build; requires `SUPABASE_URL` and `SUPABASE_KEY` in env
- `npm run lint` — ESLint with type-checked rules
- `npm run lint:fix` — auto-fix lint issues
- `npm run format` — run Prettier across all files

Pre-commit hooks (husky + lint-staged) run `eslint --fix` on `*.{ts,tsx,astro}` and Prettier on `*.{json,css,md}` automatically on every commit.

## Conventions

- **Astro vs React**: Use `.astro` files for static content and page layout; use `.tsx` React components only for components that use React hooks (`useState`, `useEffect`, etc.) or browser event handlers (`onClick`, `onChange`, etc.).
- **React hooks**: Extract to `src/components/hooks/`, not inline in component files.
- **Migrations**: Name as `YYYYMMDDHHmmss_short_description.sql` in `supabase/migrations/`.

## CI

Gate: `@.github/workflows/ci.yml` — runs `npm run lint` + `npm run build` on every push/PR to `master`. Requires `SUPABASE_URL` and `SUPABASE_KEY` as repository secrets.
