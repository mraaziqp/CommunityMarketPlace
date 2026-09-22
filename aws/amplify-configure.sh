#!/usr/bin/env bash
#
# Configures an existing AWS Amplify Hosting app to serve ShareHub correctly.
#
# Run this once against the app whose build is failing. It fixes the two things
# that cannot be set from a file in the repository:
#
#   1. platform = WEB
#      The app was created as a Next.js SSR app (platform WEB_COMPUTE). During
#      provisioning — before amplify.yml is ever read — Amplify looks up the
#      "next" version in package.json and aborts the build with:
#
#          CustomerError: Cannot read 'next' version in package.json.
#
#      ShareHub is a Vite SPA and has no Next.js dependency, so the platform
#      must be WEB (static hosting). This is the actual fix for that error.
#
#   2. A SPA rewrite rule
#      Amplify serves files, so a deep link such as /admin is a 404 until every
#      non-asset path is rewritten to /index.html with a 200.
#
# Usage:
#   ./aws/amplify-configure.sh <APP_ID> [REGION]
#
# Find APP_ID in the Amplify console URL:
#   .../apps/d1a2b3c4d5e6f7/...   ->   d1a2b3c4d5e6f7
#
set -euo pipefail

APP_ID="${1:-}"
REGION="${2:-${AWS_REGION:-us-east-1}}"

if [[ -z "$APP_ID" ]]; then
  echo "Usage: $0 <APP_ID> [REGION]" >&2
  exit 1
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "The AWS CLI is required but was not found on PATH." >&2
  exit 1
fi

echo "Configuring Amplify app ${APP_ID} in ${REGION}..."

CURRENT_PLATFORM="$(aws amplify get-app \
  --app-id "$APP_ID" \
  --region "$REGION" \
  --query 'app.platform' \
  --output text)"

echo "  Current platform: ${CURRENT_PLATFORM}"

# Anything that is not an asset request falls through to the SPA shell. The
# negative lookahead lists the extensions that must keep being served as files.
# Single quotes keep this exactly as written — it is a regex, not shell.
SPA_REWRITE_SOURCE='</^[^.]+$|\.(?!(css|gif|ico|jpg|jpeg|js|mjs|png|txt|svg|webp|avif|woff|woff2|ttf|eot|map|json|webmanifest)$)([^.]+$)/>'

# JSON has no \. escape, so the lone backslash in that pattern has to be
# doubled before it can go into a JSON string. Doing it with a substitution
# rather than by hand-typing \\. keeps the pattern above readable and survives
# heredocs, which do not reliably preserve a literal double backslash.
SPA_REWRITE_JSON="${SPA_REWRITE_SOURCE//\\/\\\\}"

RULES_FILE="$(mktemp)"
trap 'rm -f "$RULES_FILE"' EXIT

printf '[{"source": "%s", "target": "/index.html", "status": "200"}]\n' \
  "$SPA_REWRITE_JSON" > "$RULES_FILE"

# Fail here with a clear message rather than letting the AWS CLI reject the
# payload with something opaque.
for interpreter in python3 python; do
  if command -v "$interpreter" >/dev/null 2>&1; then
    "$interpreter" -c "import json,sys; json.load(open(sys.argv[1]))" "$RULES_FILE" \
      || { echo "Generated rewrite rule is not valid JSON:" >&2; cat "$RULES_FILE" >&2; exit 1; }
    break
  fi
done

aws amplify update-app \
  --app-id "$APP_ID" \
  --region "$REGION" \
  --platform WEB \
  --custom-rules "file://${RULES_FILE}" \
  --query 'app.{name:name,platform:platform,rules:customRules}' \
  --output json

cat <<'EOF'

Done. Platform is now WEB and the SPA rewrite is in place.

Next: trigger a fresh build, because the failed one never got past provisioning.

  aws amplify start-job --app-id <APP_ID> --branch-name main --job-type RELEASE --region <REGION>

Or push any commit to main.
EOF
