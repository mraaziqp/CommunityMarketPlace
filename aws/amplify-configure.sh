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
SPA_REWRITE_SOURCE='</^[^.]+$|\.(?!(css|gif|ico|jpg|jpeg|js|mjs|png|txt|svg|webp|avif|woff|woff2|ttf|eot|map|json|webmanifest)$)([^.]+$)/>'

aws amplify update-app \
  --app-id "$APP_ID" \
  --region "$REGION" \
  --platform WEB \
  --custom-rules "[
    {
      \"source\": \"${SPA_REWRITE_SOURCE}\",
      \"target\": \"/index.html\",
      \"status\": \"200\"
    }
  ]" \
  --query 'app.{name:name,platform:platform,rules:customRules}' \
  --output json

cat <<'EOF'

Done. Platform is now WEB and the SPA rewrite is in place.

Next: trigger a fresh build, because the failed one never got past provisioning.

  aws amplify start-job --app-id <APP_ID> --branch-name main --job-type RELEASE --region <REGION>

Or push any commit to main.
EOF
