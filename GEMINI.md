# GEMINI.md — handover for ShareHub

You are taking over development of **ShareHub**, a neighbourhood rental and shared-appliance marketplace. It is live at **https://market.arpcloudsolutions.co.za**, part of the ARP Cloud Solutions ecosystem.

Read this file first. Then use:

| Read | For |
|---|---|
| [`docs/UPGRADE_PLAN.md`](docs/UPGRADE_PLAN.md) | The work to do next, step by step. |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | How production is built and deployed. |
| [`docs/BOT_API.md`](docs/BOT_API.md) | The ecosystem bot API. |

---

## 1. Ground rules (do not break these)

1. **This repository is public. Never commit secrets.**
   - Real values live only in `~/.sharehub/production.env` on the owner's PC, outside the repo, and on the server in `/etc/sharehub/sharehub.env`.
   - Never paste their values into code, docs, commit messages or logs.
   - `.env.production.example` documents the *names* only.
2. **Nothing secret goes to the browser.**
   - Code under `src/` must only talk to the server through `src/api/client.ts`.
   - Never import from `actions/`, `db/` or `server/` in `src/`.
   - Never use `VITE_` variables for secrets; Vite publishes them.
   - CI fails the build if server code or secret names appear in `dist/`.
3. **Run `npm test` before every commit and every deploy.** All tests must pass.
   - Tests use an embedded Postgres (PGlite) and force `DATABASE_URL` empty. Keep it that way: tests must never reach the production database.
4. **Business rules live in `actions/`.** HTTP routes in `server/routes/` only check who is calling, validate input and call actions.
   - Every write goes through `memoryStore.runExclusive(...)`; see section 3.
5. **Money is in integer cents (ZAR).** Prices are always computed on the server, never trusted from the client.
6. **PayFast signing must use PHP `urlencode` rules** (`pfEncode` in `server/payfast.ts`). This was verified against the live gateway. Don't "simplify" it to `encodeURIComponent`; PayFast rejects any value containing `(`, `)` or `'` if you do.
7. **Run exactly one server instance per database** (see section 3).
8. **Don't edit a bash script while it is running.** Bash reads scripts as it goes, and an edit mid-run breaks it.

## 2. Commands

```bash
npm install
npm run dev          # web on :3000 + API on :8787, embedded Postgres in .data/ (demo data + demo logins)
npm test             # server integration tests (16 tests, ~15 s)
npm run build        # typecheck + web build (dist/) + server bundle (dist-server/)
npm run db:generate  # create a migration after editing db/schema.ts (commit it)
bash scripts/aws/deploy.sh   # test, build, upload, restart, health-check production
```

On Windows, use Git Bash for the `scripts/aws/*.sh` scripts.

## 3. Architecture

```
src/                 React 19 + Vite + Tailwind 4 web app
  api/client.ts      the ONLY way the browser talks to the server (typed, cookie session)
  components/        UI (discovery, listings, usage/activity, admin, auth, …)
  types/index.ts     models shared by browser and server
server/              Hono HTTP server (Node 22)
  index.ts           boot: migrate → load DB into memory → serve
  app.ts             mounts routes + static files + security headers
  routes/app.ts      browser API (/api/*), session cookie auth
  routes/bot.ts      ecosystem bot API (/api/v1/*), Bearer key auth
  routes/payfast.ts  PayFast ITN webhook (/api/webhooks/payfast)
  payfast.ts         checkout signing + ITN verification
  persistence.ts     Postgres via Drizzle (PGlite locally)
  email.ts + notifications.ts   Resend transactional email from committed events
  events.ts          signed webhooks to the bot
  firebase.ts        optional Firebase Storage for photos + nightly backups
  records.ts         schema-driven generic CRUD for the bot API
actions/             business rules (bookings, co-ops, payments, returns, reviews, circles,
                     hosting/dashboards, admin report, auth)
db/schema.ts         Drizzle schema (Postgres) · db/migrations/ generated SQL
db/index.ts          the in-memory store + unit-of-work
scripts/aws/         provision.sh (one-time infra) · deploy.sh (each release)
```

**How data works:**

- Postgres is the system of record.
- At boot the server loads every table into typed Maps (`memoryStore`), and actions read and write those Maps.
- Every write request runs inside `memoryStore.runExclusive(fn)`. That one call:
  - runs writes one at a time
  - commits every changed record to Postgres in one SQL transaction
  - restores memory completely if the action or the commit throws
- After a commit, `onCommitted` fires the event webhooks and emails.
- Because memory is the working copy, **only one server instance** may run against a database.
- Lookups must be by id or by filtering the Map. The Drizzle-shaped `db.query.*.findFirst` with `where` deliberately throws.

**Errors:**

- Actions throw a plain `Error` with a message written for members. Routes turn it into `400 { error }`.
- Any other error type (bugs, database errors) becomes a generic 500 and is logged.
- To reject a request deliberately, throw `ClientError` (in `server/http.ts`) or a plain `Error`.

**Auth:**

- Sign-up always creates a `USER`.
- `ADMIN` comes only from the `ADMIN_EMAILS` server setting. Admins can grant `VERIFIED_HOST`.
- Passwords are scrypt-hashed in the `account` table.
- Sessions are HTTP-only cookies; the server stores only the SHA-256 of each token.
- Browser POSTs must send `x-sharehub-client: web` (this is the CSRF guard; the client does it for you).

**Payments (PayFast, live):**

- **Rentals:**
  1. Booking → `PENDING_PAYMENT`, with the dates held for 30 minutes.
  2. PayFast ITN → payment `HELD_IN_ESCROW`, booking `PENDING_HANDOVER`.
  3. The renter enters the host's pickup code → `ACTIVE`.
  4. The host checks the item back in → `COMPLETED`, payment `CAPTURED`. The host payout (90%) and the deposit refund become `due`.
- **Co-ops** are PayFast monthly subscriptions. The first ITN activates the membership, renewals extend it, and a cancellation ends it.
- **Payouts** to hosts and **deposit refunds** are manual: PayFast cannot pay third parties. They are marked done in **Admin → Payments** or with the bot `settlePayment` action.
- **ITN checks:** the server applies a notification only if it passes signature, source IP, amount, and PayFast's server-to-server validate.
- **Admin test payment:** Admin → Payments lets an admin pay any amount (R5+) once-off or monthly, to verify the live gateway.

## 4. Production (already running)

| Piece | Where |
|---|---|
| App server | AWS EC2 `sharehub-prod` (eu-west-2, t4g.small, Amazon Linux 2023), systemd unit `sharehub`, Caddy for HTTPS |
| Database | AWS RDS Postgres 16 `sharehub-prod` (private, db.t4g.micro, 1-day backups: AWS free-plan limit) |
| DNS | Route 53 `market.arpcloudsolutions.co.za` → server Elastic IP |
| Email | Resend, from `market@arpcloudsolutions.co.za` (domain already verified in Resend) |
| Payments | PayFast **live** merchant account |

How to operate it:

- **Server address and IDs** are in `~/.sharehub/production.env` (`SERVER_IP`, `INSTANCE_ID`, `DATABASE_URL`, …).
- **SSH:** `ssh -i ~/.sharehub/sharehub-prod.pem ec2-user@$SERVER_IP`
- **Logs:** `sudo journalctl -u sharehub -f`
- **Health:** `curl https://market.arpcloudsolutions.co.za/api/health`
- **Releases** live in `/opt/sharehub/releases/`. `current` is a symlink to the newest one, and the last five are kept for rollback.

**What is deployed vs. in the repo:**

- The live release predates the dashboard/admin/email *server* work.
- That work is in the repo and fully tested, but **not deployed yet**. Deploying is step 0 of the upgrade plan.
- The new dashboard *UI* has not been built yet; that is steps 1–6.

## 5. Open decisions for the owner (ask, don't assume)

- **Firebase project for photos and backups.** The owner's Google account is at its project quota, so they must choose an existing project or free one up. The project then needs the Blaze plan and a service-account key. See `docs/DEPLOYMENT.md`. Until then, photos are stored in Postgres and backups rely on RDS (1 day).
- **AWS free plan.** The AWS account is on the free plan, which can close the account when the plan ends. The owner should upgrade to a paid plan before then. Expect about US$30/month afterwards.
- **Old Amplify app "CommunityMarketPlace".** It still builds from GitHub and would publish a copy of the site with no server behind it. It should be deleted (owner's call).
- **GitHub `main`.** The upgrade work lives on branch `fix/amplify-static-spa`. Merge it into `main` with a pull request; the branch already contains `main`'s history, so there are no conflicts.
