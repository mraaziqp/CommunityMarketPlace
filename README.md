# ShareHub — Community P2P Rental & Fractional Sharing Marketplace

A hyper-local marketplace for renting and co-owning physical things: power
tools, appliances on a fractional subscription, rooms and studios, vehicles and
gear — scoped to a neighbourhood and to private trust groups.

Built as a React 19 + Vite single-page app, deployed as static files on AWS.

```bash
npm install
npm run dev       # http://localhost:3000
```

---

## What it does

- **Proximity discovery** — geolocation search with Haversine distance and
  privacy-rounded display ("~2.4 km away"), neighbourhood and category filters,
  all reflected in shareable URLs.
- **Fractional subscriptions** — appliances sold as a capped number of uses per
  period rather than a rental. Quota tracking, usage logging, co-op caps.
- **Digital handover** — verification codes, condition logs with photos, return
  inspection and dispute initiation.
- **Escrow payments** — funds held, captured on handover confirmation, refunded
  on dispute resolution.
- **Private trust groups** — invite-code co-ops that scope listing visibility.
- **Reviews and trust scores** — multi-axis ratings feeding a host trust score.
- **Executive admin dashboard** — GMV, utilisation, category revenue, fleet
  telemetry, and an immutable system audit log.
- **Installable PWA** — offline app shell, maskable icons, mobile navigation.

## Architecture

```
index.html
└── src/main.tsx → src/App.tsx
    ├── src/components/   feature UI (discovery, listings, bookings, admin, …)
    ├── src/types/        the models the UI is written against
    ├── src/data/         seed catalogue and category tree
    └── actions/          the data layer the components call
        └── db/           browser-native persistent store
```

### Where the data lives

**In the visitor's browser, and nowhere else.**

ShareHub is served as static files. There is no server process and no database
connection, because a Postgres URL in a browser bundle is a Postgres URL handed
to every visitor.

`db/index.ts` holds the working set as typed `Map`s and writes through to
`localStorage` on every mutation, so a refresh, a reopened tab or a relaunched
PWA resumes where it left off. A first visit seeds a populated demo
neighbourhood. `db/schema.ts` keeps the Drizzle table definitions, and the `db`
export presents a Drizzle-shaped facade (`query` / `insert` / `update` /
`select` / `transaction`), so the `actions/` layer reads like real data access.

The consequences are worth being explicit about:

- Data is **per-browser**. Two visitors do not see each other's listings, and
  clearing site data resets the app to its seed state.
- `localStorage` caps out around 5MB. Uploaded listing photos are downscaled to
  1280px and re-encoded before being stored (`actions/storage.ts`) to stay
  inside that budget.
- Authentication is a **role switcher**, not an identity system. `DEMO_ACCOUNTS`
  in `actions/auth.ts` provides admin, host and renter personas.

### Making it multi-user

Every component calls `actions/`, and `actions/` is the only thing that touches
`db/`. To put real data behind it, reimplement the `actions/` functions as
`fetch` calls to an API and leave the components alone. `db/migrations/` holds
the Postgres schema and PostGIS indexes that design assumed.

## Commands

| Command | What it does |
| :--- | :--- |
| `npm run dev` | Dev server on port 3000 |
| `npm run build` | Typecheck, then build to `dist/` |
| `npm run preview` | Serve the built output on port 4173 |
| `npm run typecheck` | `tsc --noEmit` |

`npm run build` runs `tsc --noEmit` first, so a type error fails the build
rather than shipping.

## Configuration

None. The app reads no environment variables — see
[`.env.production.example`](./.env.production.example) for why, and for the AWS
credentials the deployment workflow needs.

## Deploying

Full instructions in [AWS_DEPLOYMENT_GUIDE.md](./AWS_DEPLOYMENT_GUIDE.md).

**AWS Amplify Hosting** is the primary target. The app must be registered with
platform `WEB`, not `WEB_COMPUTE` — an app created as a Next.js SSR app fails
during provisioning with `Cannot read 'next' version in package.json`, before
`amplify.yml` is ever read. Fix it once with:

```bash
./aws/amplify-configure.sh <APP_ID> <REGION>
```

which also installs the SPA rewrite rule that deep links need.

Also supported: S3 + CloudFront via `aws/cloudformation-template.yml` and the
GitHub Actions workflow, or a container via the included `Dockerfile` and
`nginx.conf`.

## Licence

Private.
