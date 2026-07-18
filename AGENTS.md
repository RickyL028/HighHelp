# HighHelp — Agent Guide

HighHelp is a **Cloudflare Workers** app (Hono + JSX) that serves a school community platform: timetable, resources, past papers, Q&A, essays, announcements, leaderboard, ATAR tracker.

## Project structure

- **`highhelp/`** — the sole package/source root. All commands run from here.
- **`src/index.tsx`** — entrypoint. Exports `{ fetch, queue }`.
- **`src/routes/`** — route modules (Hono sub-apps), all mounted in index.tsx.
- **`src/layout.tsx`** — shared HTML layout (Tailwind CSS loaded from CDN).
- **`src/types.ts`** — `Bindings` type (env + queue). Matches `worker-configuration.d.ts`.
- **`src/permissions.ts`** — `PermissionLevel` enum and check functions.
- **`src/utils.ts`** — helpers (points, email, logging, date formatting).
- **`src/constants.ts`** — subject list, the canonical source for valid subjects.

## Commands (run from `highhelp/`)

| Command | Purpose |
|---|---|
| `npm run dev` | Start dev server (wrangler) |
| `npm run deploy` | Deploy to Cloudflare |
| `npm test` | Vitest (with `@cloudflare/vitest-pool-workers`) |
| `npm run cf-typegen` | Regenerate `worker-configuration.d.ts` |

## Key conventions

- **JSX**: Uses `hono/jsx` with import source `"hono/jsx"` (tsconfig.json). No React.
- **Tabs** for indentation (`.editorconfig`, `.prettierrc`). Prettier with `printWidth: 140`, `singleQuote: true`, `semi: true`, `useTabs: true`.
- **All routes return `c.html()`** wrapping a `<Layout>` component. The `user` object (from `getUser(c)`) is always passed.
- **Auth**: Cookie-based via `getCookie(c, 'user_id')` set by the auth routes. No session middleware — user is re-fetched from DB on each request.
- **Permissions** are integer-based (`PermissionLevel` enum). Checking `user.permission_level` vs tags happens inline in route handlers.

## Bindings & env

See `worker-configuration.d.ts` and `wrangler.jsonc` for the full list. Key ones:
- **`DB`**: D1 database (Cloudflare). Schema in `schema.sql`, migrations in `migrations/`.
- **`BUCKET`**: R2 bucket for file storage.
- **`AI_QUEUE`**: Queue for async past-paper AI processing.
- Secrets (`GEMINI_API_KEY`, `PORTAL_API_CLIENT_SECRET`, etc.) are in `.dev.vars` for local dev.

## Testing

- Tests use `@cloudflare/vitest-pool-workers`. No test files currently exist in the repo (`test/` dir missing, tsconfig excludes `test/`).
- Config is in `vitest.config.mts` — reads `wrangler.jsonc`.

## Noteworthy

- **Timetable** proxies data from the SBHS student portal (`student.sbhs.net.au`). Passes `Authorization` header through. Depends on a separately managed `accessToken` stored in `localStorage`.
- **AI past-paper import** uses Cloudflare Queues. Workers exports a `queue()` handler in `src/index.tsx` that calls `processAIImportJob`. Jobs are serialized (`max_batch_size: 1`).
- **PWA**: Service worker at `public/sw.js`, manifest at `public/manifest.json`. The layout includes install-to-dock logic.
- **No CSS framework bundling** — Tailwind is loaded via CDN `<script>` tag. Styles are inline utility classes only.
