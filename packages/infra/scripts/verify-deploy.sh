#!/usr/bin/env bash
# Checks a deployed site from the outside, the way a phone sees it. Run by the pipeline after every deploy, or by
# hand: npm run verify-deploy -- https://nexttrain.ie [expected-commit]
#
#  1. the site loads, and serves the commit just deployed (so CloudFront isn't serving a stale copy)
#  2. index.html isn't cached, so installed PWAs pick up the deploy
#  3. the API answers with live departures
#  4. today's timetable file exists (the daily job, also run after a deploy, writes it to the site bucket)
#  5. www.<domain> redirects to <domain>
# Any failure exits non-zero. The deploy itself has already happened by then; this says whether it's healthy.
set -uo pipefail

SITE="${1:?usage: verify-deploy.sh <site-url> [expected-commit]}"
SITE="${SITE%/}"
COMMIT="${2:-}"
STATION=HSTON # Heuston: InterCity trains every day, so it always has a timetable file
failures=0

pass() { echo "  ✓ $1"; }
fail() { echo "  ✗ $1"; failures=$((failures + 1)); }
get() { curl -sS --max-time 20 "$@"; }

echo "Checking $SITE"

# 1. Site and version
html=$(get "$SITE/") || html=""
if grep -q "<title>Next Train?" <<<"$html"; then pass "site loads"; else fail "site didn't load or has no Next Train? title"; fi
if [[ -n "$COMMIT" ]]; then
  bundle=$(grep -o 'src="/assets/index-[^"]*\.js"' <<<"$html" | head -1 | cut -d'"' -f2)
  # Downloaded whole, then searched: piping curl into `grep -q` fails at random under pipefail, as grep stops
  # reading at the first match and curl then can't finish writing (curl error 23).
  js=""
  [[ -n "$bundle" ]] && js=$(get "$SITE$bundle")
  if grep -q "· ${COMMIT:0:7}" <<<"$js"; then
    pass "serving commit ${COMMIT:0:7}"
  else
    fail "not serving commit ${COMMIT:0:7} (stale CloudFront copy, or the upload didn't happen)"
  fi
fi

# 2. index.html must revalidate
cache=$(get -o /dev/null -w '%header{cache-control}' "$SITE/index.html")
if [[ "$cache" == *no-cache* ]]; then pass "index.html is no-cache"; else fail "index.html cache-control is '$cache', expected no-cache"; fi

# 3. API
api=$(get -w '\n%{http_code}' "$SITE/api/stations/$STATION/departures?service=all")
if [[ "$(tail -1 <<<"$api")" == 200 ]] && grep -q '"departures"' <<<"$api"; then
  pass "API answers"
else
  fail "API /api/stations/$STATION/departures returned $(tail -1 <<<"$api")"
fi

# 4. Timetable. After a deploy the job runs in the background, so give it a few minutes.
today=$(TZ=Europe/Dublin date +%Y%m%d)
url="$SITE/timetable/$today/$STATION.json"
for attempt in $(seq 1 10); do
  status=$(get -o /dev/null -w '%{http_code}' "$url")
  [[ "$status" == 200 ]] && break
  [[ $attempt -lt 10 ]] && sleep 30
done
if [[ "$status" == 200 ]]; then
  pass "today's timetable file exists"
else
  # S3 answers 403 for a missing file (CloudFront can't list the bucket).
  fail "no timetable file at /timetable/$today/$STATION.json after 5 min (HTTP $status): check the TimetableFunction logs"
fi

# 5. www redirect, only with a custom domain
host=$(sed -E 's#^https?://##; s#/.*##' <<<"$SITE")
if [[ "$host" != *.cloudfront.net ]]; then
  redirect=$(get -o /dev/null -w '%{http_code} %{redirect_url}' "https://www.$host/?service=dart")
  if [[ "$redirect" == "301 $SITE/?service=dart" ]]; then pass "www redirects to $host"; else fail "www.$host gave '$redirect', expected a 301 to $SITE"; fi
fi

if [[ $failures -gt 0 ]]; then
  echo "$failures check(s) failed"
  exit 1
fi
echo "All checks passed"
