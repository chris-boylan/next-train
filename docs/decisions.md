# Decisions

Why Next Train? is built the way it is: the significant choices, newest first, with what was considered instead.
Add an entry when a decision changes how the app is hosted, deployed, structured or presented. Don't rewrite old
entries: if one is reversed, add a new entry and mark the old one **Superseded**.

---

## 2026-11-27 · Timetable: built once a day into static files

**Decision:** a scheduled Lambda (EventBridge, 03:30 UTC, and once after every deploy) downloads Irish Rail's GTFS
timetable from the NTA once, builds yesterday's, today's and tomorrow's departures for every station, and writes
one small JSON file per station per day into the site bucket (`timetable/<date>/<code>.json`). CloudFront serves
them like any other file; the app fetches them directly. An S3 lifecycle rule deletes them after 3 days, and a
CloudWatch alarm emails the owner if the job fails.

**Why:** the timetable changes once a night, so building it on request was the wrong shape. The first version had
the API Lambda download the 10 MB zip into memory per Lambda instance: with short-lived instances that meant many
downloads a day, a slow (~1.2 s) first request on each new instance, a live dependency on the NTA's site, and a
512 MB API Lambda. Static files are fetched once a day, served instantly from the edge, keep working if the NTA is
down during the day, and let the API Lambda go back to 256 MB.

**Considered:** in-memory per Lambda instance (built first, replaced); storing per-station rows in DynamoDB (adds
reads and cost for no benefit over static files); a separate bucket (the site bucket already sits behind
CloudFront, and the job can only write under `timetable/`).

**Notes:** GTFS stops are matched to our stations by position (600 m), else by name (3 km); trips carry the live
API's train codes, so trains shown live aren't repeated. Local development builds the same files with
`npm run timetable:local` into `packages/web/.timetable/`, served only by the Vite dev server (never in a build).
GTFS-Realtime (needs the NTA key) is a later step, for cancellations and a second live source.

## 2026-11-27 · Feedback needs an email address; messages capped at 1,000 characters

**Decision:** the help page's feedback form requires an email address (checked in the browser and by the API), and
messages are limited to 1,000 characters with a visible counter. The help page also explains where the times come
from (the live API, the timetable, Northern Ireland) and describes the station page for any service, not just the
DART.

**Why:** every message can then be answered, and a cap keeps messages readable and the inbox manageable.
**Updates** the help page entry (2026-11-26), where the email was optional and messages could be 2,000 characters.

## 2026-11-27 · Translink NIR as its own service, without live data

**Decision:** Northern Ireland Railways is a separate "Translink NIR" service: Translink's teal `#084f5c` and lime
`#afca1a` on its tile (their site's header and footer), each line in the colour NIR's own maps use, the map drawn
from the all-stations map's Northern Ireland. The Enterprise line isn't drawn on it. Station pages say there are no
live times; Belfast Grand Central, Portadown and Newry also show live Enterprise trains. Always "Derry".

**Why:** Irish Rail's API has no NI Railways trains. OpenDataNI's real-time NIR feed (open licence, no key) was
down (HTTP 503) when tested; Worldline's site is a web app, not a feed, and its internal API wasn't used.

**Next:** NIR's timetable is open data (TransXChange, updated October 2026, NIR and Enterprise) and can feed the
daily timetable job. Live times later if the OpenDataNI feed returns or the owner registers for Translink's API.

## 2026-11-27 · Official station names as a subtitle, not the main name

**Decision:** stations keep their place names (Cork, Galway), as Irish Rail's live data and boards do. Their
official commemorative names (Kent, Ceannt, Colbert, Clarke…) are search terms and a small subtitle on the station
page and board ("Kent Station"), in English only until the Irish forms are checked. Dublin's Heuston, Connolly and
Pearse already show their official names.

## 2026-11-27 · Deploy main automatically when the checks pass

**Decision:** pull requests run typecheck, tests, the web build and `cdk synth`; a merge to `main` runs the same
checks and then deploys, with no approval step. "Run workflow" redeploys by hand.

**Why:** one person, one repo. The first version deployed every merge after a manual approval, but an unapproved
run blocked every later run, and GitHub cancelled the queued ones. A manual-only deploy was tried next; the owner
preferred deploying whenever the tests pass. **Supersedes** the approval-gated deploy (2026-11-26).

## 2026-11-26 · iOS home-screen app: pinned station page, no page scrolling there

**Decision:** the station page is pinned to the screen (`position: fixed`), not sized with `100dvh`, and the page
doesn't scroll or bounce while it's shown (its sheets scroll inside themselves); its tracks run to the bottom edge.

**Why:** installed on iOS, `100dvh` could come out taller than the screen, letting the page scroll so iOS blurred
the header under the status bar, and the tracks stopped short of the home indicator.

## 2026-11-26 · Help page and feedback form

**Decision:** "Help & about" in the options cog, with a feedback form. Messages go to `POST /api/feedback`, are kept
in DynamoDB for a year and emailed to the owner through SNS. Spam limits: a honeypot field, 3 seconds minimum on the
form, 3 per device per hour, 50 a day.

**Why:** the owner's address stays private, there's no third-party form service, and it fits the free tier.
**Considered:** a mailto link (exposes the address), GitHub issues (needs an account, public).

## 2026-11-26 · Keyless deploys from GitHub (OIDC)

**Decision:** GitHub Actions assumes the `next-train-github-deploy` role with GitHub's OIDC token: no AWS keys in
GitHub. The role trusts only this repo's `production` environment, in GitHub's immutable subject format
(`repo:chris-boylan@271568683/next-train@1473275948:environment:production`), and can only assume CDK's bootstrap
roles. It lives in its own stack (`NextTrainGitHubDeploy`), deployed by hand, which the pipeline never deploys.

## 2026-11-26 · Custom domain nexttrain.ie, DNS in Route 53

**Decision:** `nexttrain.ie`, registered at Hosting Ireland (Route 53 can't register `.ie`), with its nameservers
pointed at a Route 53 hosted zone so CDK manages the certificate (us-east-1) and records. `www` redirects to the
apex (a CloudFront Function), so search engines see one site.

## 2026-11-26 · Budget alert

**Decision:** an AWS Budgets alert at $5 a month, emailed at 80% of actual spend and when the month's forecast goes
over. An extra alert at 100% actual was proposed and dropped as unnecessary.

## 2026-11-26 · API behind CloudFront through a Lambda Function URL

**Decision:** CloudFront calls the API Lambda's Function URL with origin access control (only this distribution
can invoke it). No API Gateway. Departures and train journeys are cached at the edge for 20 seconds; favourites
and feedback never are.

**Why:** removes API Gateway's per-request charge, and the edge cache means a busy station costs one Lambda call per
20 seconds rather than one per viewer.

## 2026-11-26 · Stay on AWS

**Decision:** keep the existing AWS CDK stack (S3 + CloudFront, Lambda, DynamoDB, eu-west-1).

**Why:** the Alexa skill runs on Lambda, and AWS keeps everything in one place with one deploy. At hobby traffic it
sits within the free allowances (Route 53's $0.50 a month aside). **Considered:** Cloudflare Pages + Workers (could be
$0, but the Alexa skill would still need AWS, so two providers), Vercel/Netlify, a VPS.

## 2026-11-26 · Installable web app now, App Store later

**Decision:** make the site a PWA (manifest, icons, service worker for the app shell; live data always from the
network). A Capacitor-wrapped App Store app may come later; it needs the Apple Developer Program ($99 a year), an
absolute API URL and CORS, and at least one genuinely native feature for App Store review.

**Why:** free, and installable on iPhone and Android today.
