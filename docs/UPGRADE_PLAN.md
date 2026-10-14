# Upgrade plan: personal dashboards, admin console, nicer app

The owner asked for:

> When someone makes a profile they need their own personal dashboard to either manage purchases, or if they are a seller manage their products etc. Make it a powerful tool, a major upgrade of the dashboards, and make the page more useful, better to scroll through, a nicer app.

**The server side is done and tested.** Every endpoint below already exists, has a typed method in `src/api/client.ts`, and is covered by `server/test/integration.test.ts`. What remains is mostly UI.

Work through the steps in order. After each step:

1. `npm test`
2. `npm run build`
3. Try it with `npm run dev` (sign in with the dev-only demo accounts in the sign-in dialog).
4. Commit.

## Step 0: Deploy what is already built

```bash
npm test && bash scripts/aws/deploy.sh
```

This ships the new endpoints, member suspension (a migration that adds `user.suspended_at`) and Resend emails.

Then check it:

- `curl https://market.arpcloudsolutions.co.za/api/health` returns `{"ok":true}`.
- `sudo journalctl -u sharehub -n 20` shows the start-up line with `email=on`.

**Safe email check:** send one email through Resend's test inbox rather than a real person. Run this on the server, or anywhere `RESEND_API_KEY` is set:

```bash
curl -s https://api.resend.com/emails -H "Authorization: Bearer $RESEND_API_KEY" -H 'Content-Type: application/json' \
  -d '{"from":"ShareHub <market@arpcloudsolutions.co.za>","to":["delivered@resend.dev"],"subject":"ShareHub test","text":"ok"}'
```

## API already available (browser, cookie session)

| Method in `api` | Endpoint | Returns / does |
|---|---|---|
| `dashboard()` | `GET /api/me/dashboard` | `{ stats, earnings[] }`, figures for the overview and earnings |
| `activity()` | `GET /api/me/activity` | `{ subscriptions, bookings (renter + host views), usageLogs, history }` |
| `myListings()` | `GET /api/me/listings` | `[{ listing, stats }]`, including paused listings |
| `createListing(input)` | `POST /api/listings` | new listing |
| `updateListing(id, patch)` | `POST /api/listings/:id/update` | Edit any field, including `isAvailable` (pause/resume) and `tiers` (edit/add rates; rates left out are retired). Owner or admin. |
| `deleteListing(id)` | `POST /api/listings/:id/delete` | Only if never booked or joined; otherwise the error says to pause it. |
| `updateProfile(patch)` | `POST /api/me/profile` | name, bio, neighbourhood, phone, image (data URL or https) |
| `changePassword(cur, next)` | `POST /api/me/password` | Signs out the member's other devices. |
| `confirmPickup / confirmReturn / reportProblem / review / logUsage / bookingCheckout / subscriptionCheckout` | — | Existing rental and co-op actions. |
| `adminMembers(search)` | `GET /api/admin/members` | `[{ user, listings, bookings, memberships, lastActiveAt }]` |
| `setMemberRole(id, 'USER' or 'VERIFIED_HOST')` | `POST /api/admin/members/:id/role` | |
| `setMemberSuspended(id, bool)` | `POST /api/admin/members/:id/suspend` | Signs the member out and hides their listings. |
| `adminListings(search)` | `GET /api/admin/listings` | `[{ listing, ownerEmail, ownerSuspended, stats }]`. Moderate with `updateListing(id, { isAvailable })`. |
| `adminReport / adminPayments / settlePayment / startTestPayment` | — | Existing admin tools. |

**Emails** are sent automatically by the server; the UI does nothing for them. They cover: welcome, booking confirmed (renter), new booking with the pickup code (host), co-op welcome with access code, renewal receipt, pickup, return/payout due, problem reported, new review, and admin test payment.

## Step 1: Simple client-side routing

The app currently opens everything as modals on one page. Add real pages:

- `src/lib/router.ts`: a tiny router using `history.pushState` and `popstate`, exposing `useRoute()` → `{ path, navigate(to) }`. Don't add a dependency.
- `App.tsx` renders by path:

  | Path | Page |
  |---|---|
  | `/` | Home |
  | `/me` | Dashboard overview |
  | `/me/:section` | Dashboard section (`rentals`, `memberships`, `listings`, `earnings`, `profile`, `history`) |
  | `/admin` and `/admin/:tab` | Admin (admins only; anyone else is sent to `/`) |

- The URL-sync effect in `App.tsx` rewrites the address bar to `/` plus query parameters. Change it to sync the query only on the home route and keep the pathname.
- The server already serves `index.html` for every non-API path, so deep links work.
- Keep these as modals: listing detail, payment, return check-in, review, auth.
- PayFast `return_url` and `cancel_url` point at `/?payment=…`. The existing return handling in `App.tsx` must keep working, and on return it should navigate to `/me/rentals`.

## Step 2: Personal dashboard page (`src/pages/DashboardPage.tsx`)

**Layout:**

- A full page (not a modal).
- A left sidebar on desktop (sticky), and a horizontally scrollable tab bar on mobile.
- A header with the avatar, name, role badge and a **Share an item** button.
- Guests see a sign-in prompt.

**Sections:**

1. **Overview**
   - Stat cards from `api.dashboard().stats`: upcoming rentals, active memberships, total spent, active listings, upcoming bookings on my listings, earnings due and paid, average rating.
   - A **To do** list derived from `api.activity().bookings`:
     - "Pay for X" — renter, `PENDING_PAYMENT`
     - "Collect X — enter pickup code" — renter, `PENDING_HANDOVER`
     - "Give pickup code to Y" — host, `PENDING_HANDOVER`
     - "Check X back in" — host, `ACTIVE`
     - "Review X" — renter, `COMPLETED` and `!hasReview`
   - Each to-do opens the right action.
2. **Rentals** (what I booked)
   - Tabs: Upcoming / Active / Past.
   - Reuse `RentalCard` from `src/components/usage/FractionalUsageLogger.tsx`; export it, ideally moving it to `src/components/dashboard/`.
3. **Memberships**
   - Reuse `CoopPanel` from the same file: turns left, access code, start a turn, usage log.
4. **My listings** (seller tools)
   - A grid of `myListings()` cards. Each card shows the photo, title, status chip (Live / Paused / Hidden by admin) and stats (bookings, upcoming, members, earnings, rating).
   - Card actions:
     - **Edit:** reuse `CreateListingModal` with an `initial` prop and edit mode. It calls `updateListing` and edits rates via `tiers`.
     - **Pause / Resume:** `updateListing(id, { isAvailable })`.
     - **Delete:** confirm first, then `deleteListing`. Show the server's message when it refuses.
     - **View:** opens the detail modal.
   - Below each listing, or in a drawer: its incoming bookings, from `activity().bookings` filtered to `viewerRole === 'host'`, using the host actions on `RentalCard` (pickup code, check back in).
   - An empty state with a **Share your first item** call to action.
5. **Earnings**
   - A table from `dashboard().earnings`: date, listing, gross, your payout, status (due / paid).
   - Totals at the top.
   - Explain that payouts are made by ShareHub after the return is checked in.
6. **Profile**
   - A form for name, bio, neighbourhood and phone, plus an avatar upload using `prepareImage` from `src/lib/images.ts` → `updateProfile({ image })`.
   - A change-password form.
   - A sign-out button.
7. **History**
   - The `activity().history` list. This is already rendered in `FractionalUsageLogger`; reuse that markup.

Then retire the "My activity" modal (`FractionalUsageLogger`) once its parts live in the dashboard. The navbar, user menu and mobile tab bar should all link to `/me`.

## Step 3: Admin console page (`/admin`)

- Convert `src/components/admin/AdminDashboard.tsx` from a fixed overlay into a page. Keep it lazy-loaded, so members never download it, and render it only for `role === 'ADMIN'`.
- Keep the existing tabs: Overview, Neighbourhoods, Top listings, Shared appliances, Payments, Event log.
- Add **Members**:
  - A searchable table from `adminMembers(search)`: name, email, role, joined, listings, bookings, last active, suspended.
  - Actions: **Make verified host / Remove verified**, and **Suspend / Unsuspend**. Ask for confirmation before suspending.
- Add **Listings**:
  - A searchable table from `adminListings(search)` with the owner's email, status and stats.
  - Actions: **Hide / Show** (`updateListing(id, { isAvailable })`) and **View**.
- Put **Payments** (with the live payment test and payouts owed) first for admins.

## Step 4: A nicer home page and navigation

- **Hero** above the feed: a one-line value proposition, a search box and a location button, then three "How it works" tiles (Borrow · Join a co-op · Share and earn).
- **Empty marketplace state.** Production starts with no listings. Show "Be the first to share in your neighbourhood" with a **Share an item** button, rather than a bare "no results".
- **Rows** when listings exist: "Near you", "Shared appliances", "Tools & gear", "Spaces". Each row scrolls horizontally on mobile, with a "See all" that applies the category filter.
- **Sticky, compact header** on scroll. Make sure the bottom mobile bar never covers content (the app already pads `pb-20`).
- **Mobile tab bar:** Explore · Circles · Share · My ShareHub (`/me`) · Messages.
- **Skeleton loading** cards instead of spinners. Keep listing images `loading="lazy"`.
- Keep the copy warm and plain, with no technical terms. The existing tone is in the components.

## Step 5: Tests and checks

- Server: add tests to `server/test/integration.test.ts` for any new endpoint.
- Run `npm run build`. The browser bundle must stay free of server code (CI checks this).
- Click through in `npm run dev`:
  - as a demo **Member**: rentals, membership turns, profile
  - as a demo **Host** (Tariq): listings, edit/pause, incoming booking, pickup code
  - as a demo **Admin**: members, listings, payments
- Check at phone width (375px).

## Step 6: Deploy and verify

```bash
npm test && bash scripts/aws/deploy.sh
```

Then on https://market.arpcloudsolutions.co.za:

1. Sign up as a new member, open `/me`, and edit the profile.
2. Create a listing, then pause and resume it.
3. Sign in as the admin (the email in `ADMIN_EMAILS`). Check `/admin` → Members and Listings.
4. Payments → run a **R5 once-off test payment**. It should show **Paid** within seconds, and the admin should receive the "Test payment received" email.
5. Delete any test accounts you created, using the bot API: `DELETE /api/v1/collections/users/:id` with the key from `BOT_API_KEYS`.

## Later (not part of this upgrade)

- **Firebase Storage** for photos and nightly backups, once the owner picks a project (see `docs/DEPLOYMENT.md`).
- **In-app messages** (currently a link to AwehChat).
- **A cancellation and refund flow** before pickup (`refundEscrow` exists in `actions/payments.ts` but has no UI or tests).
- **Moving actions to direct SQL**, if the app ever needs more than one server instance.
