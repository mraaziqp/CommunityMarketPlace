# ShareHub: community rentals and shared appliances

A neighbourhood marketplace for borrowing and co-owning things: tools and gear by the day, rooms and studios by the hour or night, and shared appliances (washers, 3D printers, solar batteries) through small monthly co-ops. Circles keep listings private to a building or makerspace.

It is part of the ARP Cloud Solutions ecosystem and lives at **https://market.arpcloudsolutions.co.za**.

```bash
npm install
npm run dev      # web on http://localhost:3000, API on :8787, embedded Postgres
npm test         # server integration tests
```

## What it does

- **Discovery**: search by keyword, category, city and distance, with shareable URLs. Circle-only listings are visible only to that circle's members.
- **Rentals**: book dates at a price the server works out, pay on PayFast, confirm pickup with a code from the host, and have the host check the item back in. After the return, the host's payout and the renter's deposit refund are tracked as due.
- **Shared appliances**: monthly PayFast subscriptions with a capped number of households, a set number of turns per month that refresh on renewal, and per-member access codes.
- **Reviews and trust scores**: the renter reviews the host once, after the rental is finished.
- **Admin dashboard**: revenue, members, co-op usage, top listings, neighbourhoods and the event log, plus payments, payouts owed and a **live payment test** for any amount.
- **Ecosystem bot API**: full read and write, export and import, marketplace actions and signed event webhooks. See [docs/BOT_API.md](docs/BOT_API.md).

## Architecture

```
src/            React 19 + Vite web app; talks only to /api (src/api/client.ts)
server/         Hono server: app API, bot API (/api/v1), PayFast ITN, static files
  payfast.ts    checkout signing and ITN verification
  persistence.ts  Postgres (Drizzle) — embedded PGlite in development and tests
actions/        business rules (bookings, co-ops, payments, reviews, circles, …)
db/             schema, migrations and the in-memory working set
docs/           deployment and bot API
scripts/aws/    provision.sh (one-time AWS setup) and deploy.sh (each release)
```

How data flows:

- Postgres is the system of record.
- The server keeps a working copy in memory, and each write request runs as a unit of work: it is committed to Postgres in one transaction, or fully rolled back.
- Because of this, run **one** server instance per database.
- Sessions are HTTP-only cookies, and passwords are scrypt hashes.
- Admin access comes from the server-side `ADMIN_EMAILS` setting.

## Commands

| Command | What it does |
| :--- | :--- |
| `npm run dev` | Web app and API together, with an embedded database in `.data/` |
| `npm test` | Server integration tests (accounts, visibility, PayFast lifecycle, bot API, rollback, persistence) |
| `npm run build` | Typecheck, build the web app to `dist/` and the server to `dist-server/` |
| `npm start` | Run the built server (serves `dist/` and `/api`) |
| `npm run db:generate` | Generate a migration after changing `db/schema.ts` |

## Handover and roadmap

- [GEMINI.md](GEMINI.md): the rules, architecture and production state for whoever (or whichever AI agent) works on this next.
- [docs/UPGRADE_PLAN.md](docs/UPGRADE_PLAN.md): the next upgrade (personal dashboards, admin console, home page), step by step.

## Configuration and deployment

- The server's settings are listed in [.env.production.example](.env.production.example). None of them are ever sent to the browser.
- Production runs on AWS: EC2 with Caddy for HTTPS, plus RDS Postgres. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for how to deploy it.

## Licence

Private.
