#!/usr/bin/env bash
# Uploads an NI Railways timetable release (the ZIP from OpenDataNI's "Translink Northern Ireland Rail Timetable
# Data", or the .xml inside it) for the daily timetable job. The timetable is rebuilt a minute later.
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

# One current release: remove the other form so the job can't pick up a stale one.
aws s3 rm "s3://$BUCKET/$OTHER" --region eu-west-1 "$@" >/dev/null 2>&1 || true
aws s3 cp "$FILE" "s3://$BUCKET/$KEY" --region eu-west-1 "$@"
echo "Uploaded. The timetable job runs now; NIR stations show the new timetable within a minute or two."
