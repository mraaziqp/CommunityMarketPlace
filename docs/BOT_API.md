# ShareHub bot API (`/api/v1`)

Full programmatic access to ShareHub for the ARP Cloud Solutions ecosystem: read and write every business record, bulk export and import, run marketplace actions on behalf of a member, and receive signed event webhooks.

Base URL: `https://market.arpcloudsolutions.co.za/api/v1`

## Authentication

Every request needs a key from the server's `BOT_API_KEYS` setting:

```
Authorization: Bearer shb_…
```

- Several keys can be configured (comma-separated), so a key can be rotated without downtime.
- A missing or wrong key returns `401`.
- If no keys are configured, the API is off and returns `503`.

The key has full write access. Keep it server-side in the bot, never in a browser or a chat message.

What the key can never reach:

- **Passwords.** They are stored as scrypt hashes in a separate table that the API does not expose.
- **Sessions.** Session tokens are also kept out of the API.
- **PayFast credentials.** These never appear in any response.

## Errors

Errors come back as JSON: `{ "error": "message" }`.

| Status | Meaning |
|---|---|
| `400` | Invalid input, a business rule was broken, or the database rejected the change (for example a foreign key pointing at a record that doesn't exist). |
| `404` | The collection or record doesn't exist. |
| `409` | The record already exists (import in `insert` mode). |
| `500` | A server fault. |

A failed write changes nothing. Each request is all-or-nothing.

## Discovery

| Request | Returns |
|---|---|
| `GET /api/v1` | The collections, actions and endpoints available. |
| `GET /api/v1/schema` | Every field of every collection: type, required, default, and allowed values for enum fields. |

## Collections

The collections are:

`users`, `trustGroups`, `groupMemberships`, `listings`, `pricingTiers`, `userSubscriptions`, `bookings`, `payments`, `usageLogs`, `conditionLogs`, `reviews`, `systemLogs`

Field names are camelCase, exactly as `/schema` lists them. Dates are ISO 8601 strings, and money is in cents (ZAR).

| Request | Purpose |
|---|---|
| `GET /collections/:name?limit=100&cursor=…&updatedSince=ISO&<field>=<value>` | List records. `limit` is 1–1000. Paginate by passing `nextCursor` back as `cursor`. Any field can be used as an exact-match filter, e.g. `?status=ACTIVE&listingId=list_…`. |
| `GET /collections/:name/:id` | One record. |
| `POST /collections/:name` | Create a record, or replace it if `id` already exists. Leave out `id` to have one generated. Missing fields get their defaults. |
| `PATCH /collections/:name/:id` | Change only the fields you send. `updatedAt` is set for you. |
| `DELETE /collections/:name/:id` | Delete a record. Postgres cascade rules apply; for example, deleting a listing deletes its pricing tiers. |

Example: make someone a verified host.

```bash
curl -X PATCH https://market.arpcloudsolutions.co.za/api/v1/collections/users/usr_123 \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"role":"VERIFIED_HOST"}'
```

Writes through `/collections` are raw data changes: they bypass marketplace rules such as capacity limits and date overlaps. Use **actions** when you want the same rules the app applies.

## Export

```
GET /export?collections=users,listings&updatedSince=2026-09-01T00:00:00Z&format=json|ndjson
```

- **`json`** (the default): returns `{ exportedAt, collections: { name: [records] } }`.
- **`ndjson`**: returns one `{ "collection": …, "record": … }` per line, which suits large syncs.
- **`collections`**: leave it out to export everything.
- **`updatedSince`**: gives an incremental sync (see the event webhooks section for keeping one in step).

## Import (ingestion)

```
POST /import
{
  "mode": "upsert",          // or "insert" (fails if an id already exists)
  "dryRun": false,           // true = validate everything, then save nothing
  "collections": {
    "users":       [{ "id": "usr_x", "name": "…", "email": "…" }],
    "trustGroups": [{ "id": "grp_x", "name": "…", "inviteCode": "ABC-12", "adminId": "usr_x" }]
  }
}
```

- **Order and atomicity.** Collections are written parents-first, so a user and their listings can go in one import. The whole import is a single transaction: if any record fails, nothing is saved.
- **Response.** A successful import returns `{ dryRun, mode, written: { collection: count } }`.
- **What a dry run checks.** A dry run validates field types, required fields and allowed values. It does not check foreign keys, because those are only checked by Postgres when the data is actually saved.

## Actions: marketplace operations as a member

```
POST /actions/:action
{ "actingUserId": "usr_…", ...arguments }
```

The action runs as that member, with every rule the app enforces: circle visibility, capacity, date overlaps, pickup codes, and "only the host can check an item back in". Most actions return `{ "data": … }`.

| Action | Arguments |
|---|---|
| `searchListings` | `searchTerm`, `categorySlug`, `latitude`, `longitude`, `radiusInKm`, `city` (`actingUserId` is optional; it unlocks that member's private circles) |
| `getActivity` | — |
| `createListing` | `listing: { title, description, category, address, neighborhood, city, images[], pricingTiers[], … }` |
| `createBooking` | `listingId`, `tierId`, `startDate`, `endDate` (creates a booking awaiting payment) |
| `startBookingCheckout` | `bookingId` → returns a signed PayFast form `{ actionUrl, fields }` |
| `joinCoop` | `listingId`, `tierId` → returns `{ subscriptionId, checkout }` |
| `logUsage` | `subscriptionId`, `notes` |
| `confirmPickup` | `bookingId`, `code` |
| `confirmReturn` | `bookingId`, `condition` (`GOOD` or `MINOR_WEAR`), `notes`, `photos[]` (acting user must be the host) |
| `reportProblem` | `bookingId`, `notes`, `photos[]` (acting user must be the host) |
| `createReview` | `bookingId`, `rating`, `comment`, … (acting user must be the renter) |
| `createCircle` | `name`, `description`, `icon` |
| `joinCircle` | `inviteCode` |
| `startTestPayment` | `amountInCents` (500–1,000,000), `recurring` (acting user must be an admin) |
| `settlePayment` | `paymentId`, `what` (`hostPayout` or `depositRefund`) — marks a manual payout as done |

To send someone to PayFast from a checkout form:

1. Render the returned `fields` as hidden inputs.
2. Make the form `POST` to `actionUrl`.

## Payments and payouts

| Request | Returns |
|---|---|
| `GET /payments?kind=booking\|subscription\|test&limit=200` | Recent payments. |
| `GET /payouts` | Payments where money is still owed: `hostPayout.status = "due"` (90% of the rental, to pay to the host) and/or `depositRefund.status = "due"` (the deposit, to return to the renter). |

Once the money has been paid, record it with the `settlePayment` action.

Why payouts are manual: PayFast collects into ShareHub's merchant account and has no API for paying third parties. The bot is the natural place to automate these payouts.

## Reports

| Request | Returns |
|---|---|
| `GET /reports/admin?range=7d\|30d\|90d\|all` | The same figures as the admin dashboard: revenue, members, co-op usage, top listings, neighbourhoods. |

This needs at least one admin account to exist (set `ADMIN_EMAILS`).

## Event webhooks (ShareHub → your bot)

Set `BOT_WEBHOOK_URL` and `BOT_WEBHOOK_SECRET` on the server. After each change is saved, every business event is POSTed as JSON:

```
X-ShareHub-Event: BOOKING_CREATED
X-ShareHub-Delivery: <uuid>
X-ShareHub-Timestamp: <unix seconds>
X-ShareHub-Signature: sha256=<hex>

{ "id": "…", "type": "BOOKING_CREATED", "occurredAt": "…", "userId": "…", "targetId": "…", "data": { … } }
```

To check the signature: compute HMAC-SHA256 of `<timestamp>.<raw body>` with the secret, then compare it with the header in constant time. Reject requests whose timestamp is more than 5 minutes old.

Event types:

- `AUTH_SIGNUP`, `AUTH_SIGNIN`
- `LISTING_CREATED`
- `BOOKING_CREATED`
- `PAYMENT_HELD`, `PAYMENT_CAPTURED`, `PAYMENT_REFUNDED`, `PAYMENT_FAILED`
- `HANDOVER_COMPLETED` (`data.stage` is `pickup` or `return`)
- `FRACTIONAL_USE_LOGGED`
- `REVIEW_SUBMITTED`
- `DISPUTE_RAISED`
- `GROUP_CREATED`, `GROUP_JOINED`
- `SUBSCRIPTION_CANCELLED`

Delivery:

- Delivery is **at least once**: failed deliveries are retried after 1s, 5s and 30s.
- The same event can therefore arrive more than once, so de-duplicate on `id`.
- If your bot was down, recover missed events with `GET /collections/systemLogs?updatedSince=…`.

```js
// Node example
import crypto from 'node:crypto';
function verify(req, rawBody, secret) {
  const ts = req.headers['x-sharehub-timestamp'];
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex');
  const given = String(req.headers['x-sharehub-signature'] || '');
  return given.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected)) &&
    Math.abs(Date.now() / 1000 - Number(ts)) < 300;
}
```
