# Decisions

Why Next Train? is built the way it is: the significant choices, newest first, with what was considered instead.
Add an entry when a decision changes how the app is hosted, deployed, structured or presented. Don't rewrite old
entries: if one is reversed, add a new entry and mark the old one **Superseded**.

---

## 2026-11-27 · Enterprise live map: estimate untracked trains from the boards

**Decision:** the Enterprise map's `/api/trains` also reads its six stations' boards. A train in the positions
feed whose next stop doesn't list it is dropped; a train running but untracked ("No Information" past its start)
is drawn hollow at a place estimated from its minutes to its next stop. Its card says it isn't tracked.

**Why:** Irish Rail doesn't track the Enterprise in Northern Ireland. On 27 Nov, A120 sat at "Departed Dundalk
next stop Newry" two hours after it should have reached Belfast, and Dublin-bound A123 and A125 were missing from
the map while the boards had them due. The station page already marks such trains "Not tracked" at their timetable
times; drawing them hollow on the map keeps the two in step. Dropping them was the other option, but a timetable
estimate, clearly marked, is more useful than a gap. Six cached calls a refresh; not done for the DART (31
stations, tracked throughout). Cork could use the same, once the sampling shows how often it's untracked.

## 2026-11-27 · Station pages: up means north, not "away from Dublin"

**Decision:** on Commuter and InterCity station pages, each route is turned so the up track heads north
(`orientAt` in `core/src/stationLines.ts`): by the next stations either side where they're clearly north and
south of each other, else by where the whole path runs; only paths running almost due east–west (Dublin–Galway)
keep "outbound is up". Termini and neighbours move with their paths.

**Why:** route paths run from the hub outwards, and the page drew outbound as up, so every line south of Dublin
was upside down (Carlow: Waterford up, Heuston down; Bray under the Commuter: Gorey up, though the DART page and
the Commuter map both have it down). An audit of all 234 station-and-line pairs found 65 reversed; none are now.
At Mallow, Cork and Tralee are both down (the Tralee line leaves south of the station, at Killarney Junction, so
Cork–Tralee trains reverse there), and Cork shows one track, north to Mallow, for both Dublin and Tralee trains.

## 2026-11-27 · Untracked trains shown as "Not tracked", not as on time

**Decision:** a departure whose status is "No Information" more than 2 minutes after its start time is marked
`untracked`. The station page draws it hollow, like a timetabled train, with a "Not tracked" tag and its timetable
time; the boards and sheets show the same tag, and screen readers say "not being tracked". No lateness is shown.

**Why:** Irish Rail lists every train as "No Information" until it leaves, so the status alone would flag half of
every board. Some trains (on 27 Nov, most Cork commuter trains) are never picked up: they keep "No Information",
with `Late=0` and expected = scheduled, so they looked tracked and on time when nobody knew. The start time and the
answer's query time come in the same row, so the check doesn't depend on the device clock.
## 2026-11-27 · The page never scrolls: every screen is pinned, with its own scroll area

**Decision:** `html` and `body` never scroll. Every screen is a `.screen` pinned to the screen (`position: fixed`),
with its header fixed at the top and only the content under it scrolling (`.screen__scroll`, which keeps its
bounce to itself). This was already true of the station page; the board, pickers, maps and help page now work
the same way. The header's cog is always the rightmost control, 16 px from the edge and level on every screen,
with the favourite star to its left. Each map remembers its scroll position for going back from a station, and
starts at the top when opened from the service list.

**Why:** on iOS, a scrolling page slides the header up under the status bar, and iOS blurs it. Pinning only the
station page fixed that page but not the board. A sticky header inside a scrolling page still gets dragged down
by iOS's bounce at the top, so the header sits outside the scroll area. Putting the cog after the star means
screens without a star don't move it.

## 2026-11-27 · Live trains on the line maps, opt-in, placed from one feed call

**Decision:** the DART and Enterprise maps can show every running train, behind a small "Live" switch on the map's top strip that's off
by default and remembered per device. `/api/trains?service=` makes one Irish Rail call (`getCurrentTrainsXML`,
DART-only for the DART) and places each train from its public message: "Arrived X" at X, "Departed X" halfway to
its next stop, a signal location just short of the next stop. Direction comes from the line, not the API. Trains
are drawn as the station page's train seen from above, pointing straight up or down on north–south maps and
along the track (to the nearest 45°) on Cork's; lateness is only in the
train's card. Cached at the edge for 20 s like departures.

**Why:** one feed call covers every train, so a busy map costs one Lambda call per 20 s; timing each train
between stations would need a movements call per train. Off by default keeps the map calm and costs nothing for
people who don't want it. Colour-coded direction arrows and a late outline were tried and felt too busy.

**Next:** Cork, once its commuter trains are tracked: on 27 Nov they weren't in the positions feed at all and
their boards said "No Information", so the map support (trains pointing along the track) is built but switched off.
Then the Commuter and InterCity maps (`TrainMarkers` only needs a station's position), where trains skip
stations and a gap can span several dots.

## 2026-11-27 · NI Railways from Translink's timetable, uploaded by hand

**Decision:** NIR stations show NIR trains at their timetabled times, from Translink's TransXChange file on
OpenDataNI, read by the same daily job as Irish Rail's GTFS and written into the same per-station files. NIR
trains show from now (there's no live window to wait for); Irish Rail trains, including the Enterprise, still
show timetabled only beyond the 90-minute live window. The Enterprise comes from Irish Rail's GTFS only. The owner
uploads each release (`npm run nir:upload`) to a private bucket, which triggers a rebuild; the job emails a
reminder from 10 days before a release runs out.

**Why:** there's no working open live NIR data (OpenDataNI's real-time feed lists no endpoints, and Worldline's
site isn't a feed). OpenDataNI refuses scripted downloads (HTTP 403) and each release has a new file name, so the
job can't fetch it; releases come every few months, so a one-minute upload is cheaper than working around the
block. The owner is asking Translink and OpenDataNI about real-time data and a stable download URL.

**Next:** live NIR times if OpenDataNI's feed returns or Translink offers an API; automatic downloads if a stable
URL is offered.

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
