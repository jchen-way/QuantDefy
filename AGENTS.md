# QuantDefy Agent Notes

## Current stack
- Next.js App Router with TypeScript and Tailwind CSS v3.
- Local demo persistence uses JSON storage in `data/runtime/store.json`.
- Production persistence targets Neon Postgres through `@neondatabase/serverless`.
- Local uploads are written to `data/runtime/uploads`, preuploaded through `app/api/uploads/route.ts`, and read back through `app/api/uploads/[fileName]/route.ts`.
- `RUNTIME_DATA_DIR` can override the local runtime path for isolated test/dev runs.
- Upload storage is now routed through the adapter boundary in `lib/server/uploads.ts`, with implementations under `lib/server/upload-adapters/`. `UPLOAD_RUNTIME` currently supports `local` and `s3`, so object storage no longer requires another architecture pass.
- Vercel production should be treated as a managed ephemeral runtime: require `DATABASE_URL` for Neon-backed persistence and `UPLOAD_RUNTIME=s3` for uploads instead of relying on the local file adapters.
- Validation is handled with `zod`.

## Product surfaces
- Public routes: `/`, `/login`, `/register`, `/auth/google`, `/auth/google/callback`, `/api/cron/cleanup-uploads` (cron-secret protected).
- App routes: `/app`, `/trades`, `/trades/new`, `/trades/[tradeId]`, `/analytics`, `/insights`, `/settings`, `/admin` (admin-only).
- Shared shells live in `components/public-navbar.tsx`, `components/auth-shell.tsx`, and `components/workspace-shell.tsx`.
- New Neon-backed accounts start empty; the dashboard, journal, analytics, and insights pages now include first-trade onboarding states instead of relying on seeded demo data.
- User-facing branding is `QuantDefy`. Keep the warm monogram mark in the shared nav/shell branding and avoid reintroducing old `Trade Logger`, `QuantDesk`, or demo-badge wording.
- The public landing page now has explicit mobile-specific responsive behavior in `components/public-navbar.tsx` and the landing `preview` variant of `components/calendar-grid.tsx`; avoid assuming the phone layout is just the desktop preview scaled down.

## Data and analytics
- Core domain types live in `lib/domain/types.ts`.
- Trade metrics, calendar rollups, and distributions live in `lib/domain/analytics.ts`.
- Trade-level, weekly, and monthly insight generation lives in `lib/domain/insights.ts`.
- The default insight layer is a local pattern engine: it clusters similar mistake/lesson/emotion tags, review notes, and attachment captions so weekly/monthly summaries do not depend on exact repeated phrasing.
- `UserSettings.insightMode` now supports `local` and `semantic`. `semantic` is an optional premium mode that can compute embedding-backed retrieval summaries when `OPENAI_API_KEY` is configured.
- Semantic insights are cached as a persisted snapshot. `/app` and `/insights` should read that cache on normal page loads; OpenAI work should happen only when the user explicitly refreshes insights.
- Hosted multi-user deployments should keep `OPENAI_API_KEY` server-side and gate premium semantic refreshes with per-user quotas/cooldowns. The explicit refresh path is the place to enforce those limits; normal page loads should continue reading the cached snapshot.
- Insight persistence now keeps historical weekly and monthly reports for every detected period instead of only the latest week/month.
- Calendar and weekly insight logic are timezone-sensitive and should use the journal timezone helpers in `lib/domain/utils.ts`.
- Shared analytics formatting also lives in `lib/domain/utils.ts`; capital buckets, readable duration strings, and date-key formatting should be fixed there first instead of patching copy in individual pages.
- Calendar month navigation is server-driven through `buildDashboardData(...)` month keys plus the `CalendarDashboard` month arrows inside `/app`. Keep the overview page as the single calendar surface instead of reintroducing a separate calendar route.
- Trade journal filters can now be saved as user-scoped presets from the `/trades` page.
- `UserSettings` now also stores `customTradeTypes` and `customSetupTypes`, which are editable in settings and auto-extended from the trade form when a user types a new label.
- Settings also store `insightMode`; the settings page exposes this as a select instead of burying it in env-only behavior.
- The settings action returns the saved `insightMode`, and the settings form now treats the `Insight mode` select as a native uncontrolled field keyed from the latest saved mode. Keep that field aligned with persisted server state instead of reintroducing a controlled-select snapback after save.
- Saving settings should preserve the last semantic snapshot and should not regenerate premium insights implicitly. Trade and attachment mutations still clear semantic cache so refresh can rebuild against the latest journal evidence.
- The dashboard now prefers persisted weekly insight reports and only falls back to recomputation when no weekly report exists in memory.
- The analytics page can now read the latest cached semantic snapshot too; notable-trade cards should prefer premium takeaways when a semantic snapshot exists and fall back to local review text otherwise.
- Trade capital allocation is derived from execution fills rather than manually entered. Option exposure should always apply contract value in that calculation.
- Trade timestamp parsing must trust the authenticated user's saved timezone from server settings, not hidden client fields.
- Fees are no longer part of active trade-entry or analytics math. Legacy records may still carry a `fees` field for compatibility, but current P/L should not subtract it.

## Current runtime model
- Auth now uses server-side password sessions in `lib/server/auth.ts`.
- Google OAuth can be enabled with `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. The app still owns authorization: admin access should be checked with app-side rules like `ADMIN_EMAILS`, not assumed from Google alone.
- Google OAuth is intentionally conservative right now: it creates new accounts for new emails and reuses accounts already created through Google, but it does not silently attach to existing password-based accounts that happen to share the same email. Add an explicit account-linking flow before loosening that rule.
- Auth throttling now lives in `lib/server/auth-rate-limit.ts`. It rate-limits login and registration attempts by normalized email and request IP when available, using Neon-backed persistence when `DATABASE_URL` is set and a file-backed runtime otherwise.
- The file-backed auth throttling path now serializes its read/modify/write cycle so concurrent failures do not clobber each other.
- Forwarded IP headers are only trusted when `TRUST_PROXY_IP_HEADERS=true`; local/dev runs should leave that off.
- Trade mutations run through `app/trades/actions.ts`.
- Settings mutations run through `app/settings/actions.ts`.
- Auth mutations run through `app/auth/actions.ts`.
- Insight regeneration is exposed through `app/insights/actions.ts`.
- The trade form in `components/trade-form.tsx` is now a client-controlled draft form. It submits `draftJson`, `fillsJson`, `tagsJson`, and signed attachment claim metadata instead of relying on uncontrolled fields, so user input survives validation errors.
- Trade images are now uploaded before the trade Server Action through `POST /api/uploads`. The route returns a signed upload claim that must be verified server-side in `app/trades/actions.ts`; do not trust client-supplied `fileName` or `storagePath` directly.
- Upload lifecycle orchestration now lives in `lib/server/upload-workflow.ts`. Prefer extending that service for preupload, discard, trade-attachment consumption, and cleanup behavior instead of duplicating sequencing in routes/actions.
- Attachment rows now need an explicit remove/discard path in the client form because file selection persists storage immediately. Replacing or removing a pending image should clean up the old preupload through `DELETE /api/uploads`.
- Preuploaded images are staged server-side until a trade save consumes them. `lib/server/upload-staging.ts` opportunistically prunes expired staged uploads for both file and Neon-backed runtimes, and `UPLOAD_TOKEN_TTL_MS` controls that expiry window.
- Vercel Hobby now has a daily cron in `vercel.json` hitting `/api/cron/cleanup-uploads`; it requires `CRON_SECRET` and prunes expired staged uploads even when no user traffic occurs. Shorter TTLs still rely mostly on opportunistic cleanup between daily runs.
- `Trade type` and `Setup type` are freeform text inputs with suggestion pills, not dropdowns. New labels should remain user-extensible and flow back into `customTradeTypes` / `customSetupTypes`.
- User-facing timezone inputs are dropdowns driven from `lib/domain/catalog.ts`, not free-text fields.
- Settings list inputs are chip/token editors in `components/token-list-field.tsx`, not comma-separated textareas.
- `lib/server/store.ts` is still the public persistence boundary, but internal repository logic is now split across `lib/server/store-core.ts`, `lib/server/store-accounts.ts`, `lib/server/store-settings.ts`, `lib/server/store-trades.ts`, `lib/server/store-file.ts`, `lib/server/store-mappers.ts`, and `lib/server/store-insights.ts`.
- When `DATABASE_URL` is present, `lib/server/store.ts` uses normalized Neon tables for users, sessions, settings, trades, fills, attachments, tags, presets, and insight reports.
- The major Neon multi-step write paths now batch through `sql.transaction(...)` for atomic trade saves, settings saves, preset saves, user creation, and insight replacement.
- The Neon bootstrap path will migrate from the legacy `app_store_state` JSON blob table if it exists, but it no longer seeds demo data into an empty production database.
- Without `DATABASE_URL`, the app falls back to `data/runtime/store.json` with a seeded local demo account.
- `.env.example` documents the required Neon connection string.
- Media review on the trade detail page uses the client gallery in `components/attachment-gallery.tsx`; images open in a full-screen inspectable viewer rather than staying as static thumbnails.
- Attached trade images are now deletable from the trade detail UI through `components/attachment-gallery.tsx` and `deleteTradeAttachmentAction` in `app/trades/actions.ts`.
- Trade, settings, and attachment mutations invalidate semantic insight cache so premium pages do not keep serving stale AI output after journal changes.
- `UPLOAD_RUNTIME=s3` now uses a real S3-compatible adapter backed by `@aws-sdk/client-s3` and env vars declared in `.env.example`.
- Vercel deployments now fail fast if they try to boot with the file-backed store or `UPLOAD_RUNTIME=local`, so deployment config mistakes are surfaced immediately instead of degrading into ephemeral data loss.
- The S3 adapter now attempts version-aware cleanup on delete when bucket version listing is permitted, so versioned buckets can purge historical object versions instead of only creating delete markers.
- Login and registration now have basic rate limiting / lockout protection at both the normalized email and request-IP layers when forwarding headers are available.
- Auth forms now preserve submitted non-password fields after validation failures and should return friendlier field-specific copy from `app/auth/actions.ts` instead of raw validator messages.
- The current storage boundary now cleans up local upload binaries on trade delete, attachment delete, and attachment removal during trade edits so the file runtime does not silently leak orphaned images.
- Session cookies now use the `quantdefy_session` name while still accepting the older legacy cookie name during the transition.
- Trade create/detail routes now treat auth lookup failures and store lookup failures as the same data-connection problem path, so Neon outages should degrade to the shared `DataConnectionState` UI instead of crashing before route rendering.

## Intended next backend direction
- Use Neon for the production Postgres layer instead of Supabase.
- Keep object storage concerns decoupled from the data repository boundary so Neon can back relational data cleanly.
- Avoid baking provider-specific assumptions into UI copy or domain modules.
- The largest remaining backend gaps are deeper store decomposition and stronger end-to-end coverage; private object storage is now supported through the S3-compatible upload adapter when configured.
- `UPLOAD_RUNTIME` is now explicit in `.env.example`; unsupported upload modes should fail fast at boot/runtime rather than silently falling back.
- Baseline browser security headers now ship from `next.config.ts` (`Referrer-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, and `Permissions-Policy`) instead of depending only on route-level hardening.
- `lib/server/store.ts` has started to be decomposed: trade CRUD now lives in `lib/server/store-trades.ts`, while row types, mappers, and insight-query helpers live in `lib/server/store-types.ts`, `lib/server/store-mappers.ts`, and `lib/server/store-insights.ts`.
- Neon-backed writes for user creation and settings updates now rely on database uniqueness constraints and transactional writes instead of optimistic read-first checks alone.
- Integration coverage is broader now: the repo includes tests for auth rate limiting, auth session cookie behavior, protected upload route behavior, local upload lifecycle, and the S3 upload adapter contract.
- Browser coverage now exists under `e2e/` using Playwright for auth, trade creation, protected media, settings token-editor persistence, and overview month-navigation flows against an isolated local runtime.
- The trade preupload route now has direct route-level coverage in `tests/upload-route.test.ts` for auth, empty payload rejection, signed claim issuance, and discard cleanup.
- Fees are no longer part of the trade-entry UX. New trades default fees to zero unless older records already carry fee values.

## UI guidance
- The current visual system uses subdued dark surfaces, a single warm accent, and restrained glass treatment.
- Prefer updating shared primitives before patching page-specific one-offs.
- Avoid reintroducing stacked decorative callout cards in the workspace shell unless they convey real workflow value.
- Equity curve cards should still communicate state when there is only one closed trade; the shared chart component already renders a single-point marker for that case.
- Trade/analytics cards are moving toward flatter editorial layouts: fewer nested boxes, fewer redundant CTA blocks, and context-aware copy instead of generic coaching placeholders.
- The trade form’s attachment draft lifecycle is now factored into `components/use-trade-attachments-draft.ts`; keep attachment-specific state transitions there instead of re-expanding `components/trade-form.tsx`.

## Verification
- Primary checks are `npm run build`, `npm run typecheck`, and `npm test`.
- Browser checks are `npm run test:e2e`; the script prebuilds once, then Playwright starts an isolated production-style server from `playwright.config.ts` with `RUNTIME_DATA_DIR=.e2e-runtime` and `UPLOAD_RUNTIME=local`.
- Playwright also pins upload-claim envs and clears optional OAuth/OpenAI env vars in its `webServer.env` block so browser coverage does not drift based on a developer's local secrets.
- `npm run typecheck` uses `tsconfig.typecheck.json` so it stays stable even when Next auto-rewrites the main `tsconfig.json` include list.
- `npm test` excludes browser coverage. Run `npm run test:e2e` intentionally when auth/media/settings/insight UI flows are touched.
