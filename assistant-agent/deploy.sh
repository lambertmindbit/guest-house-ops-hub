#!/usr/bin/env bash
# One-command agent deploy. Bakes in --max-instances=1 so the single-instance
# invariant can't be forgotten: by default the agent keeps conversation +
# pending-booking state in one process's memory (InMemorySessionService), so a
# SECOND instance would serve a guest's follow-up turn from different memory and
# lose their in-flight booking. Deploying without the pin is a silent correctness
# bug — this script makes the pin part of the deploy and then verifies it.
#
# Running a PERSISTENT session store (set SESSION_DB_URL — see server.py) makes
# state shared across instances; only then is it safe to raise the cap. To do that,
# set MAX_INSTANCES to a higher value when you have SESSION_DB_URL configured.
#
# Usage:  ./deploy.sh          (from assistant-agent/)
# Env:    REGION (default asia-south1), SERVICE (default ota-guest-agent)
set -euo pipefail

REGION="${REGION:-asia-south1}"
SERVICE="${SERVICE:-ota-guest-agent}"
# Safe default 1 (in-memory sessions). Only raise this WITH SESSION_DB_URL set.
MAX_INSTANCES="${MAX_INSTANCES:-1}"
# MIN_INSTANCES=1 keeps one instance warm so the FIRST guest question after an idle
# spell doesn't hit a cold start (which times out and drops to the limited Phase-1
# fallback). Default 0 = scale-to-zero (cheapest); set 1 for a snappy always-on bot.
MIN_INSTANCES="${MIN_INSTANCES:-0}"

echo "▸ Deploying ${SERVICE} to ${REGION} (min=${MIN_INSTANCES}, max=${MAX_INSTANCES})…"
gcloud run deploy "${SERVICE}" \
  --source . \
  --region "${REGION}" \
  --min-instances="${MIN_INSTANCES}" \
  --max-instances="${MAX_INSTANCES}" \
  --quiet

# Belt-and-suspenders: re-assert the cap in case a deploy default reset it.
gcloud run services update "${SERVICE}" --region "${REGION}" --max-instances="${MAX_INSTANCES}" --quiet

echo "▸ Verifying maxScale…"
SCALE="$(gcloud run services describe "${SERVICE}" --region "${REGION}" \
  --format="value(spec.template.metadata.annotations['autoscaling.knative.dev/maxScale'])")"
if [ "${SCALE}" != "${MAX_INSTANCES}" ]; then
  echo "✗ maxScale is '${SCALE}', expected ${MAX_INSTANCES}." >&2
  exit 1
fi
if [ "${MAX_INSTANCES}" != "1" ]; then
  echo "⚠ max-instances > 1 — ensure SESSION_DB_URL is set, or guests will lose in-flight bookings."
fi
echo "✓ ${SERVICE} deployed with maxScale=${MAX_INSTANCES}"
