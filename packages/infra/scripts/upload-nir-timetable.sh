#!/usr/bin/env bash
# Uploads an NI Railways timetable release (the ZIP from OpenDataNI's "Translink Northern Ireland Rail Timetable
# Data", or the .xml inside it) for the daily timetable job. The upload starts a rebuild; this waits for it,
# then clears CloudFront's copy of the timetable files (they're cached for an hour, so stations with Irish Rail
# trains too, like Grand Central, would otherwise keep showing the old timetable for up to an hour).
#   npm run nir:upload -- ~/Downloads/nir-and-enterprise-10-sept-26.zip --profile next-train
set -euo pipefail

FILE="${1:?usage: npm run nir:upload -- <release.zip|.xml> [aws options, e.g. --profile next-train]}"
shift
[[ -f "$FILE" ]] || { echo "No such file: $FILE" >&2; exit 1; }
case "$(tr '[:upper:]' '[:lower:]' <<<"$FILE")" in
  *.zip) KEY=nir/timetable.zip OTHER=nir/timetable.xml ;;
  *.xml) KEY=nir/timetable.xml OTHER=nir/timetable.zip ;;
  *) echo "Expected a .zip or .xml file" >&2; exit 1 ;;
esac

BUCKET=$(aws cloudformation describe-stacks --region eu-west-1 --stack-name DartTimes "$@" \
  --query "Stacks[0].Outputs[?OutputKey=='TimetableSourcesBucket'].OutputValue" --output text)
[[ -n "$BUCKET" && "$BUCKET" != None ]] || { echo "No TimetableSourcesBucket output on the DartTimes stack: deploy first." >&2; exit 1; }

resource() { # the physical id of the DartTimes stack's resource matching a JMESPath filter
  aws cloudformation describe-stack-resources --region eu-west-1 --stack-name DartTimes "${@:2}" \
    --query "StackResources[?$1].PhysicalResourceId | [0]" --output text
}
SITE_BUCKET=$(resource "starts_with(LogicalResourceId, 'SiteBucket') && ResourceType=='AWS::S3::Bucket'" "$@")
DISTRIBUTION=$(resource "ResourceType=='AWS::CloudFront::Distribution'" "$@")

# One current release: remove the other form so the job can't pick up a stale one.
STARTED=$(date -u +%Y-%m-%dT%H:%M:%S)
aws s3 rm "s3://$BUCKET/$OTHER" --region eu-west-1 "$@" >/dev/null 2>&1 || true
aws s3 cp "$FILE" "s3://$BUCKET/$KEY" --region eu-west-1 "$@"
echo "Uploaded. Waiting for the timetable to be rebuilt…"

# The job writes today's index right after today's station files: once it's newer than the upload, today is done.
INDEX="timetable/$(TZ=Europe/Dublin date +%Y%m%d)/index.json"
for _ in $(seq 1 24); do
  MODIFIED=$(aws s3api head-object --region eu-west-1 --bucket "$SITE_BUCKET" --key "$INDEX" "$@" \
    --query LastModified --output text 2>/dev/null || true)
  [[ "${MODIFIED:0:19}" > "$STARTED" ]] && break
  sleep 10
done
if [[ ! "${MODIFIED:0:19}" > "$STARTED" ]]; then
  echo "The timetable wasn't rebuilt within 4 minutes: check the TimetableFunction's logs (a broken file is logged there)." >&2
  exit 1
fi

aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION" --paths '/timetable/*' "$@" \
  --query Invalidation.Id --output text >/dev/null
echo "Rebuilt, and CloudFront's copy cleared: every station shows the new timetable within a few minutes."
