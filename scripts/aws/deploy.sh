#!/usr/bin/env bash
# ==============================================================================
# Build and ship a ShareHub release to the production server.
#
#   bash scripts/aws/deploy.sh
#
# 1. Runs the tests and a production build locally.
# 2. Uploads the release (frontend, server bundle, migrations) over SSH.
# 3. Writes the server's environment file from ~/.sharehub/production.env.
# 4. Installs runtime dependencies, switches the "current" symlink, restarts,
#    and checks https://APP_DOMAIN/api/health. Database migrations run
#    automatically when the server starts.
# ==============================================================================
set -euo pipefail
export AWS_PAGER="" MSYS_NO_PATHCONV=1

ENV_FILE="${ENV_FILE:-$HOME/.sharehub/production.env}"
set -a; source "$ENV_FILE"; set +a
: "${SERVER_IP:?Run scripts/aws/provision.sh first}" "${DATABASE_URL:?Run scripts/aws/provision.sh first}"
KEY_FILE="$HOME/.sharehub/sharehub-prod.pem"
SSH="ssh -i $KEY_FILE -o StrictHostKeyChecking=accept-new ec2-user@$SERVER_IP"

cd "$(dirname "$0")/../.."
RELEASE="$(date -u +%Y%m%d%H%M%S)-$(git rev-parse --short HEAD 2>/dev/null || echo local)"

echo "== Testing (embedded database only)"
env -u DATABASE_URL -u BOT_WEBHOOK_URL npm test
echo "== Building $RELEASE"
npm run build

TARBALL="$(mktemp -d)/sharehub-$RELEASE.tgz"
tar -czf "$TARBALL" dist dist-server db/migrations package.json package-lock.json

# Server environment. Only here and on the server; never in git or the bundle.
SERVER_ENV="$(mktemp)"
cat > "$SERVER_ENV" <<EOF
NODE_ENV=production
PORT=8787
PUBLIC_APP_URL=https://$APP_DOMAIN
DATABASE_URL=$DATABASE_URL
TRUST_PROXY=true
DEMO_MODE=false
ADMIN_EMAILS=$ADMIN_EMAILS
PAYFAST_MODE=$PAYFAST_MODE
PAYFAST_MERCHANT_ID=$PAYFAST_MERCHANT_ID
PAYFAST_MERCHANT_KEY=$PAYFAST_MERCHANT_KEY
PAYFAST_PASSPHRASE=$PAYFAST_PASSPHRASE
PAYFAST_APP_TAG=sharehub
BOT_API_KEYS=$BOT_API_KEYS
BOT_WEBHOOK_URL=${BOT_WEBHOOK_URL:-}
BOT_WEBHOOK_SECRET=$BOT_WEBHOOK_SECRET
RESEND_API_KEY=${RESEND_API_KEY:-}
EMAIL_FROM=${EMAIL_FROM:-}
FIREBASE_STORAGE_BUCKET=${FIREBASE_STORAGE_BUCKET:-}
FIREBASE_SERVICE_ACCOUNT_BASE64=${FIREBASE_SERVICE_ACCOUNT_BASE64:-}
STATIC_ROOT=/opt/sharehub/current/dist
MIGRATIONS_DIR=/opt/sharehub/current/db/migrations
EOF

echo "== Uploading to $SERVER_IP"
scp -i "$KEY_FILE" -o StrictHostKeyChecking=accept-new "$TARBALL" "ec2-user@$SERVER_IP:/tmp/release.tgz"
scp -i "$KEY_FILE" "$SERVER_ENV" "ec2-user@$SERVER_IP:/tmp/sharehub.env"
rm -f "$SERVER_ENV" "$TARBALL"

$SSH "sudo bash -s" <<REMOTE
set -euo pipefail
install -o root -g sharehub -m 640 /tmp/sharehub.env /etc/sharehub/sharehub.env && rm -f /tmp/sharehub.env
DIR=/opt/sharehub/releases/$RELEASE
mkdir -p "\$DIR" && tar -xzf /tmp/release.tgz -C "\$DIR" && rm -f /tmp/release.tgz
cd "\$DIR" && /usr/local/bin/npm ci --omit=dev --no-audit --no-fund
chown -R sharehub:sharehub "\$DIR"
ln -sfn "\$DIR" /opt/sharehub/current
systemctl restart sharehub
# Keep the five most recent releases for quick rollback.
ls -1dt /opt/sharehub/releases/* | tail -n +6 | xargs -r rm -rf
REMOTE

echo "== Health check"
for i in $(seq 1 30); do
  if curl -fsS "https://$APP_DOMAIN/api/health" | grep -q '"ok":true'; then
    echo "Live: https://$APP_DOMAIN  (release $RELEASE)"
    exit 0
  fi
  sleep 5
done
echo "Health check failed. Logs: $SSH 'sudo journalctl -u sharehub -n 100 --no-pager'"
exit 1
