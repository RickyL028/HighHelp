# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

HighHelp is a server-rendered Cloudflare Worker (Hono + `hono/jsx`) for Sydney Boys High School students: timetable, resources, past papers / mock exams, forum, essays, announcements, points/leaderboard, ATAR tracker, attendance. Deployed to `highhelp.org`.

## Commands

Everything lives in `highhelp/`; run all commands from there (the root `package-lock.json` is an empty stub).

```bash
npm run dev                                   # wrangler dev (local D1/R2/queue)
npm run deploy                                # wrangler deploy
npx vitest run                                # all tests once (`npm test` runs vitest in watch mode)
npx vitest run test/practiceQuery.test.ts     # one file
npx vitest run -t "safeNext"                  # tests matching a name
npx tsc --noEmit                              # type check (no npm script; tsconfig excludes test/)
npm run cf-typegen                            # regenerate worker-configuration.d.ts after changing wrangler.jsonc
npx wrangler d1 migrations apply highhelp-db  # apply migrations (add --remote for production)
```

`tsc` currently reports 2 pre-existing errors (`src/routes/atar.tsx`, `src/routes/pastPapers/view.tsx`). Don't count those as regressions.

Tests run inside the Workers runtime via `@cloudflare/vitest-pool-workers` (config reads `wrangler.jsonc`). They cover pure helpers: `practiceQuery.ts`, `practiceExport.ts`, `statsQuery.ts` (the past-papers Statistics tab) and the login-redirect helpers in `utils.ts`. They also cover timetable alerts: `webPush.ts` against the RFC 8291 vector, plus `portalTokens.ts`, the queue consumer and the push routes, using `fetchMock`. Push-service requests are caught with a `globalThis.fetch` stub, because `fetchMock` turns binary bodies into strings. No migrations are applied to the test D1; the suites that run SQL (`practiceQuery.test.ts`'s search tests, `statsQuery.test.ts`) create and seed their own tables. New query logic is easiest to test when written the same way: as pure SQL/param builders kept separate from the route handler.

Local secrets go in `highhelp/.dev.vars` (gitignored): `SESSION_SECRET`, `PORTAL_API_CLIENT_SECRET`, `PORTAL_API_CLIENT_SECRET_full`, `GEMINI_API_KEY`, and `LOCAL_DEV=true`. Timetable alerts also need `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `TOKEN_ENC_KEY` (`node scripts/generate-push-keys.mjs >> .dev.vars`); without them the feature hides itself.

## Architecture

**Entrypoint** `src/index.tsx` exports `{ fetch, scheduled, queue }`:
- A global middleware calls `getUser(c)` and blocks `PermissionLevel.BANNED` users.
- `/api/proxy/*` routes forward requests to the SBHS portal APIs (`student.sbhs.net.au`, `api.sbhs.net.au`), passing through the client's `Authorization` header.
- Each feature is a Hono sub-app in `src/routes/`. Almost all are mounted at `/` and declare their own full paths, so to find a URL's handler, grep for the path string. `pastPapers/index.tsx` combines several past-paper sub-apps the same way.
- `queue()` consumes `paper-ai-queue` (batch size 1, one retry, DLQ `paper-ai-dlq`) and calls `processAIImportJob`. That job sends uploaded paper PDFs to Gemini and splits them into questions. On a permanent failure it writes `papers.ai_status = 'error'`. It also consumes `timetable-push-queue`, dispatching on `batch.queue`.
- **Timetable change alerts** (Web Push). `scheduled()` runs every 15 minutes and `src/timetablePush.ts` queues subscribed users. The consumer fetches each user's daytimetable with a server-held portal token, diffs it against `timetable_snapshots`, and pushes new subs, no-cover periods and room changes. Pure rules and scheduling live in `src/timetableChanges.ts`, and the WebCrypto VAPID/aes128gcm sender is `src/webPush.ts`. Portal tokens are only held (AES-GCM encrypted, in `portal_tokens`) while the user has a push subscription. Because of token rotation, `/api/auth/refresh` prefers the held copy (`src/portalTokens.ts`). The subscribe routes live under `/api/auth/push/*` so they receive the refresh cookie.

**Rendering.** Route handlers return `c.html(<Layout title=… user={user}>…</Layout>)` using `hono/jsx` TSX. This is server-side only, with no React and no client hydration. Client behaviour is inline `<script dangerouslySetInnerHTML={{ __html: `…` }}>` blocks, or `html` tagged templates from `hono/html`. The timetable components in `src/components/timetable/` are mostly large client-side JS templates. `src/layout.tsx` holds the shared shell: nav, Tailwind via CDN `<script>` (no build step, so styling is utility classes only), the theme system (`light`/`dark`/`night`/`paper`/`glass` stored in `localStorage`, with Tailwind `darkMode: 'class'`), PWA install logic, and opt-in KaTeX (`latex`) and PDF-crop (`pdfCrop`) support.

**Auth and users.**
- Login is OAuth against the SBHS student portal (`src/routes/auth.tsx`). `portalCreds()` picks the `*_full` client credentials on `highhelp.org` and the plain ones on workers.dev or local dev.
- The session is an HMAC-signed `user_id` cookie (`userId.expiry.sig`), created by `createSessionCookie` and verified by `getSessionUserId` in `utils.ts`.
- `getUser(c)` loads the user row plus computed announcement badge counts, and caches the result per request context.
- Redirects to login should use `loginRedirect(c)`. Any `?next=` target must pass through `safeNext()`, which guards against open redirects and markup injection.

**Permissions.** `src/permissions.ts` defines an integer `PermissionLevel` (BANNED −2 … ADMIN 5) and `can*()` helpers, which handlers call inline. The helpers that take a `subject` argument currently ignore it. User `tags` is a JSON object built by `buildUserTags()` from the portal timetable: subjects plus a `Year` key. A tag whose value is `0` still counts as "takes this subject". Announcement audience targeting matches on tag keys (see the `announcementAudienceMatch` comment in `utils.ts`).

**Data.**
- D1 (`DB`, `highhelp-db`) is queried with raw SQL via `c.env.DB.prepare(...).bind(...)`. There is no ORM.
- D1 counts parameter *occurrences*, so a bound value cannot be reused within a statement. Use the `VIEWER_CTE` / `VIEWER_TAGS_CTE` helpers in `utils.ts` instead.
- Many tables soft-delete with `is_deleted`.
- `schema.sql` is meant to reflect the state after all migrations. `migrations/` numbering is inconsistent (`001_`…`015_`, then `0016_`…`0019_`, then `020_`+, with two `003_` files). Look at the newest file before you pick the next number.
- R2 (`BUCKET`) stores uploads. In past papers, an image key starting with `pdf_crop:{json}` is not an R2 object. It is a page/rect crop of the paper's source PDF, rendered client-side by the `<pdf-crop>` element.
- `src/constants.ts` is the canonical subject list.

**Timetable/attendance** mostly run in the browser. The portal `accessToken` lives in `localStorage.studentData` and is refreshed client-side. Day, calendar and notice data are cached in `localStorage` (`todayData_<date>`, `calendarWeek_<key>`) and fetched through the `/api/proxy/*` routes.

## Conventions

- Prettier: `printWidth: 140`, single quotes, semicolons, tabs. In practice most `src/` files use 4-space indentation, while tests and a few routes (`announcements.tsx`, `points.tsx`) use tabs. Match the file you're editing, and don't reformat whole files.
- Route modules start with `const app = new Hono<{ Bindings: Bindings }>()` and `export default app`, and must be mounted in `src/index.tsx`.
- Use `logAction()` for moderation/audit events and `updatePoints()` for point changes (both in `utils.ts`).
