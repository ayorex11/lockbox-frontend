# Lockbox frontend

Vue 3 + TypeScript + Vite + Pinia + Tailwind. The client for the Lockbox API (`lockbox_backend`):
end-to-end encrypted file sharing with expiring and one-time links.

Files are encrypted in the browser (AES-256-GCM, Web Crypto) before upload. The key lives only in
the URL fragment (`#key`), which browsers never send to servers, so the API and B2 only ever see
ciphertext.

## Quick start

```bash
npm install
cp .env.example .env        # leave VITE_API_URL empty for local dev
npm run dev                 # http://localhost:5173  (proxies /api to http://localhost:8000)
```

Run the backend alongside it (see `lockbox_backend/README.md`) with
`FRONTEND_URL=http://localhost:5173` and `CORS_ALLOWED_ORIGINS=http://localhost:5173`.
In dev, verification emails print to the Django console; copy the `/verify-email?token=...` link.

| Script | What it does |
|---|---|
| `npm run dev` | Dev server with HMR and `/api` proxy |
| `npm run build` | Type-check (`vue-tsc`) then production build to `dist/` |
| `npm run typecheck` | Type-check only |
| `npm test` | 54 unit/component tests (Vitest) |

## Stitch screen → route → code

| Stitch screen | Route | Code | API |
|---|---|---|---|
| `lockbox_private_encrypted_file_sharing` (landing) | `/` | `views/LandingView.vue` | none |
| `sign_up_lockbox` | `/signup` | `views/SignupView.vue` | `POST /api/auth/register` |
| `verify_email_lockbox` (check your inbox) | `/check-email` | `views/CheckEmailView.vue` | `POST resend-verification` |
| (email link target) | `/verify-email?token=` | `views/VerifyEmailView.vue` | `POST verify-email` |
| `log_in_lockbox` | `/login` | `views/LoginView.vue` | `POST login` |
| `dashboard_lockbox` / `my_shared_links` | `/dashboard` | `views/DashboardView.vue`, `components/LinkRow.vue` | `GET /api/links/`, `POST revoke` |
| `send_file_lockbox_1/2` (options, locking, uploading) | `/send` | `views/SendView.vue`, `lib/sendPipeline.ts` | `POST /api/files/`, PUT to B2, `complete`, `POST /api/links/` |
| `your_link_is_ready_lockbox` / `share_link_created` | `/links/:id/ready` | `views/LinkReadyView.vue` | `GET /api/links/:id/` |
| `activity_…_lockbox` | `/links/:id` | `views/LinkActivityView.vue` | `GET links/:id/`, `events/`, `POST revoke` |
| `decrypt_download_lockbox` (recipient) | `/s/:token` | `views/RecipientView.vue` (ready) | `GET /api/s/:token/` |
| `downloading_unlocking_lockbox` | `/s/:token` | same view, `working` state, `lib/recipientFlow.ts` | `POST claim`, GET from B2 |
| `download_complete_lockbox` | `/s/:token` | same view, `done` state | none |
| `link_expired_lockbox` | `/s/:token` | same view, `gone` + `expired` | 410 `reason: expired` |
| `link_revoked_or_used_lockbox` | `/s/:token` | same view, `gone` + `unavailable` | 410 `reason: unavailable` |

Added beyond the Stitch set: locked-out state (too many wrong link passwords), incomplete-link state
(key missing from the URL), download/decrypt failure states, load-error states, 404, dark mode,
mobile layouts, and an empty dashboard.

Screenshots from a real browser run are in `docs/screenshots/`.

## Changes from the Stitch designs (deliberate)

These follow the review of the designs against what the backend actually does:

- Copy: removed "No account required" (senders need one, recipients don't), "2.5 GB" (limit is
  25 MB), "Zero server logs" (there is an audit log), "zero-knowledge" (now "end-to-end encrypted
  contents"), and "Open source client"/whitepaper claims. The landing page gains a plain
  "What we can and can't see" section.
- Removed: geolocation map, Edit transfer rules, Re-share, Audit cert, CSV/JSON export, "Request a
  new link", "Remember this device", "Forgot password" (none exist in the backend), terms checkbox.
- Dead-link screens show no file name or sender; the 410 body carries none.
- Added "Show my email to the recipient" toggle (default on), and the expiry picker applies to
  one-time links too (unopened links still expire).
- The progress UI shows real upload percentage; "download complete" is a client-side state because
  the server can't observe the browser finishing.

## How the important parts work

- `lib/crypto.ts`: blob format `[version | 12-byte IV | ciphertext+tag]`, version bound as AES-GCM
  additional data. `CIPHERTEXT_OVERHEAD` is 29 bytes; `MAX_FILE_BYTES` keeps the ciphertext under
  the API's 25 MiB cap (keep in sync with `MAX_UPLOAD_BYTES`).
- `lib/sendPipeline.ts`: lock → reserve + PUT → verify → create link. State survives failures, so
  "Try again" doesn't re-encrypt, change the key, or re-upload completed work.
- `lib/recipientFlow.ts`: claim → download → decrypt, returning a typed outcome the view renders.
  The metadata `GET` never consumes a link; only the explicit download button claims.
- `lib/api.ts`: access token in memory only; refresh token is an HttpOnly cookie. One shared refresh
  for concurrent 401s, then a single retry.
- `stores/keys.ts`: remembers keys for links created **on this device** so "Copy link" works from the
  dashboard. Stored in `localStorage`, dropped at link expiry, wiped on logout. The server cannot
  recover a key, so on another device the link can't be re-copied. This is a convenience/security
  trade-off: any XSS on the origin could read these keys, which is why the CSP below matters.

## Deployment (Vercel)

1. Import the repo; framework preset Vite; build `npm run build`, output `dist`.
2. Set `VITE_API_URL=https://api.yourdomain.com`.
3. **Put the frontend and API on sibling subdomains of one domain** (e.g. `app.yourdomain.com` on
   Vercel, `api.yourdomain.com` on Render) and set `REFRESH_COOKIE_SAMESITE=Lax` on the API. With
   `vercel.app` + `onrender.com` the refresh cookie is third-party and Safari/Chrome block it.
4. Edit the `connect-src` in `vercel.json`: replace `https://api.YOURDOMAIN.com` with your API
   origin, and make sure the B2 origin matches your bucket endpoint
   (`https://s3.<region>.backblazeb2.com`; the wildcard already covers it).
5. On the API set `FRONTEND_URL` and `CORS_ALLOWED_ORIGINS` to the Vercel origin, and add the same
   origin to the B2 bucket CORS rules.

`vercel.json` also sets the SPA rewrite, `Referrer-Policy: no-referrer` (so the key fragment can't
leak via Referer), a strict CSP (no inline scripts; the theme bootstrap is `public/theme-init.js`),
HSTS, and frame denial. The production build was exercised end-to-end in a real browser under
this exact CSP with zero violations.

## Known gaps

- No password reset or account deletion (not in the backend yet).
- Files are encrypted in one piece in memory, hence the 25 MB cap. Larger files need chunked
  encryption and multipart upload.
- Dashboard search filters the current page only (the API has no search).
- Dashboard "Copy link" and the "Copy link" button on the activity page need the key stored on
  this device (see above).
- Google Fonts (Inter, JetBrains Mono, Material Symbols) load from Google; self-host them via
  `@fontsource`/`material-symbols` if you want zero third-party requests, then tighten the CSP.
