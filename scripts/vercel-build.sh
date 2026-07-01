#!/usr/bin/env bash
# Vercel build. On PRODUCTION deploys only, apply pending DB migrations BEFORE
# building — this closes the gap where merges never applied migrations. Preview
# deploys skip it, so a PR can never migrate production. Requires DIRECT_URL
# (the direct :5432 connection, not the pooler) in the Vercel Production env.
set -euo pipefail

if [ "${VERCEL_ENV:-}" = "production" ]; then
  echo "▸ Production deploy — applying database migrations"
  npx prisma migrate deploy
else
  echo "▸ ${VERCEL_ENV:-local} build — skipping migrations"
fi

npx prisma generate
npx next build
