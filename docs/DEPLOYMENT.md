# Deploying ShareHub

ShareHub is one Node server that serves both the web app and the API. It runs at `https://market.arpcloudsolutions.co.za`, with Postgres as the database.

## Production layout (AWS, eu-west-2)

| Piece | What it is |
|---|---|
| EC2 `sharehub-prod` | A t4g.small instance running Amazon Linux 2023, Node 22 and the `sharehub` systemd service. |
| Caddy | HTTPS for `market.arpcloudsolutions.co.za`. It gets and renews a Let's Encrypt certificate automatically and proxies traffic to `127.0.0.1:8787`. |
| RDS `sharehub-prod` | Postgres 16: private, encrypted, with deletion protection. It keeps 1 day of automatic backups (the AWS free-plan maximum; set `RDS_BACKUP_DAYS` higher on a paid plan). Only the web server's security group can connect. |
| Route 53 | `market.arpcloudsolutions.co.za` → the server's Elastic IP. |

Roughly US$30/month.

**Run exactly one server instance.** The server keeps its working set in memory and writes every change through to Postgres. Two instances writing to the same database would drift apart.

## First deployment

You need the AWS CLI signed in to the account that owns the `arpcloudsolutions.co.za` hosted zone, plus Node 22, `ssh`, `scp`, `curl` and bash (Git Bash on Windows).

1. **Check the settings file.** Settings live in `~/.sharehub/production.env`, outside the repo. Check `ADMIN_EMAILS` and the `PAYFAST_*` values.
2. **Create the infrastructure:**
   ```bash
   bash scripts/aws/provision.sh
   ```
   This takes about 10 minutes, mostly waiting for RDS. It fills in `DATABASE_URL`, `SERVER_IP` and the generated secrets. Re-running it is safe.
3. **Build, test and release:**
   ```bash
   bash scripts/aws/deploy.sh
   ```
   Database migrations run when the server starts. The script ends by checking `https://market.arpcloudsolutions.co.za/api/health`.
4. **Sign up in the app** with an address listed in `ADMIN_EMAILS`. You now have the admin dashboard in the user menu.

## Every later release

```bash
bash scripts/aws/deploy.sh
```

The script:

- keeps the last five releases in `/opt/sharehub/releases`
- makes `current` a symlink to the newest one

To roll back, point the symlink at an older release and restart:

```bash
ssh -i ~/.sharehub/sharehub-prod.pem ec2-user@$SERVER_IP \
  'sudo ln -sfn /opt/sharehub/releases/<older> /opt/sharehub/current && sudo systemctl restart sharehub'
```

Logs: `sudo journalctl -u sharehub -f` (app) and `sudo journalctl -u caddy -f` (HTTPS).

## PayFast

**Checkout.** The server builds and signs each checkout form; the browser posts it to PayFast. Signing uses PHP `urlencode` rules. This was verified against the live gateway for bookings, monthly co-op subscriptions and test payments.

**ITN (payment notification).**

- Every checkout sends `notify_url = https://market.arpcloudsolutions.co.za/api/webhooks/payfast`. That per-payment URL overrides the default in your PayFast dashboard, so the hub's own handler at `arpcloudsolutions.co.za/api/webhooks/payfast` is not affected.
- A notification is only applied after four checks: the signature is valid, it came from a PayFast IP, PayFast confirms it through `/eng/query/validate`, and the amount matches what was charged.
- Notifications are idempotent: a repeated notification changes nothing.

**App tag.** Every payment carries `custom_str1 = sharehub`, so a shared handler can route notifications if you ever centralise them.

**Monthly memberships** use PayFast subscriptions (recurring billing), which must be enabled on the merchant account. Members cancel through PayFast. A cancellation notification ends the membership in ShareHub.

**Payouts.**

- PayFast pays everything into ShareHub's merchant account.
- When a rental is returned, 90% of the rental becomes a host payout that is due, and the deposit becomes a renter refund that is due.
- Pay these out, then mark them done in **Admin → Payments**, or with the bot API `settlePayment` action.

### Testing a live payment

1. Go to **Admin dashboard → Payments → Test the payment gateway**.
2. Choose an amount (at least R5.00) and whether it repeats monthly, then click **Pay with PayFast**.
3. Complete the payment on PayFast. Within a few seconds, **Recent payments** should show it as **Paid**, with the PayFast reference. That proves checkout, the ITN, the source check and the server-to-server confirmation all work.
4. A monthly test keeps charging until you cancel it in the PayFast dashboard under Subscriptions.

### Sandbox

Set `PAYFAST_MODE=sandbox` together with your own sandbox merchant ID, key and passphrase (from sandbox.payfast.co.za). PayFast's shared public test merchant no longer accepts signatures.

## Email (Resend)

The server sends transactional email through Resend when `RESEND_API_KEY` is set:

- welcome on sign-up
- booking confirmed (to the renter)
- new booking with the pickup code (to the host)
- co-op welcome with the member's access code, and renewal receipts
- pickup confirmed
- returned / payout due
- problem reported
- new review
- "test payment received" (to the admin)

How it works:

- Emails are built from committed events in `server/notifications.ts`, so a change that rolls back never sends one.
- Sending happens in the background with retries, and never blocks a request.
- The sender is `EMAIL_FROM`, by default `ShareHub <market@arpcloudsolutions.co.za>`. The `arpcloudsolutions.co.za` domain is already verified in Resend.
- In `~/.sharehub/production.env`, quote values that contain spaces or `<`, for example `EMAIL_FROM="ShareHub <market@…>"`. Otherwise `deploy.sh` cannot load the file.

## Photos and backups (Firebase Storage)

No AWS object storage is used.

- **Photos:** when Firebase is configured, listing and return photos are uploaded to Firebase Storage, and only their links are stored. Without it, photos are stored inside Postgres. That's fine at launch scale.
- **Backups:** RDS keeps 1 day of automatic backups, the maximum on the AWS free plan. With Firebase configured, the server also writes a full gzipped JSON backup to `backups/` in the bucket every night at 02:00 UTC and keeps 30 days. Sessions are left out.

To enable it:

1. Use a Firebase project on the Blaze plan. New projects only get a Storage bucket on Blaze, which is free within 5 GB but needs a billing account.
2. Create the bucket (Build → Storage).
3. Generate a service-account key (Project settings → Service accounts).
4. Add both to `~/.sharehub/production.env`:
   ```
   FIREBASE_STORAGE_BUCKET=<project>.firebasestorage.app
   FIREBASE_SERVICE_ACCOUNT_BASE64=<output of: base64 -w0 key.json>
   ```
5. Run `bash scripts/aws/deploy.sh`.

The server log then shows `[backup] nightly Firebase Storage backups scheduled`.

## Local development

```bash
npm install
npm run dev        # web app on :3000, API on :8787, embedded Postgres in .data/
npm test           # server integration tests (embedded Postgres)
```

Development seeds a demo neighbourhood and adds one-tap demo accounts; production never does. `docker compose up --build` runs the production image against a real Postgres locally.
