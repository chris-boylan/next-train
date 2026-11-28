# Decisions

Why Next Train? is built the way it is: the significant choices, newest first, with what was considered instead.
Add an entry when a decision changes how the app is hosted, deployed, structured or presented. Don't rewrite old
entries: if one is reversed, add a new entry and mark the old one **Superseded**.

---

## 2026-11-28 · A ticket button that opens Irish Rail's planner from the station

**Decision:** station pages for services sold online (Dublin Commuter, InterCity, Enterprise, Cork Commuter) have
a square ticket button bottom right that opens Irish Rail's journey planner in a new tab with "From" filled by
`?S=<station>`. Stations in Northern Ireland (NI Railways, and the Enterprise's Belfast, Portadown and Newry, which Translink
sells for) open Translink's "Plan and buy" the same way, by Translink's own station ID (generated, as its planner
needs one). Not the DART or the Luas. It fills only "From": the destination is left to the person,
even when the page's "Going to" filter is set.

**Why:** a link is only worth having if it saves typing the station, and the planner, which is also where tickets
are bought, reads `?S=` (undocumented; checked in a browser, and our station names resolve). There's no booking API
or partner deep link to use instead. Because the parameter could change without notice, the daily API check
watches that the planner is still the HAFAS web app; the worst case is the planner opening with "From" empty.
Bottom right because the header is full on a phone and the thumb reaches it there.

## 2026-11-28 · Trams on the home page's other page, not a service tile

**Decision:** the Luas leaves the service picker. The home page has two pages, "Next Train?" (the service picker)
and "Next Tram?" (the Luas's All routes map, with its search and favourites), swiped between, or switched by a small
indicator beside the title: two page dots and the other page's name. The page last shown is remembered, and
opening the Luas or a train service by a link or favourite moves the home page to its side, so back lands there.

**Why:** the Luas is a tram, not a train: as a tile it sat among the rail services as if it were one, under a
name that says "Train". Its own page gives it the right name and saves a tap, as Luas users only ever want the
Luas map. A tab bar was considered, but it would take space from every page for something only the home page needs;
the indicator is enough of a hint, and tappable for anyone who doesn't swipe.

## 2026-11-28 · Luas trams as one service, from the Luas Forecasting API

**Decision:** the Luas is a service of its own, with both lines on one map (a chip each, as Dublin Commuter's
routes). Live times come from TII's Luas Forecasting API through our API Lambda, in the same `Departure` shape as
trains, so the station page and list board work unchanged. The first version has times, maps, search, favourites
and the line's disruption message. It has no live trams on the map, no journey view and no timetable.

**Why:** the feed only gives each stop's next trams (minutes and destination), with no tram IDs or positions.
Placing trams on a map would mean guessing from every stop's times (about 67 calls a refresh), and there's no
journey to look up. Two separate services were considered, since the lines share no stops; one service keeps the
picker short and matches how people speak of "the Luas". The feed's documentation is from 2016, so the daily API
check now covers it too.

## 2026-11-27 · A one-time welcome, with an invitation to install

**Decision:** a first ever visit to the home page gets a quiet full-screen welcome (`components/Welcome.tsx`): the
icon, the name, one line on what it does, an invitation to add it to the home screen, and "Find a train". Where the
browser has an install prompt (Android Chrome) the invitation is a button that opens it; on iPhone Safari it's the
Share → Add to Home Screen tip; elsewhere there's no invitation. It's marked seen in `localStorage` as soon as it
shows, so it never comes back. It isn't shown in the installed app (iOS gives that its own storage, so it would
otherwise greet again), to visitors arriving on a station or help link (they came for that), or where storage
isn't available (we couldn't remember having shown it).

**Why:** installing is what turns a one-off visit into the app on someone's phone, and most people don't know a
website can be installed. Once, on the first visit, is enough to tell them; anything more often gets in the way of
the times.

## 2026-11-27 · Live trains on the Dublin Commuter and InterCity maps

**Decision:** the All routes maps for Dublin Commuter and InterCity show live trains, behind the same Live switch.
They're placed from the positions feed like the DART's, kept to the service's own trains by the boards' `matches`
rule (DART trains told apart by their E codes, since the feed has no train type). On these maps trains point along
the track, and one between stations that aren't neighbours on the map follows the drawn track through the ones it
passes (expresses), and to the Nenagh line's stand-in Ballybrophy. Trains Irish Rail isn't tracking aren't
estimated here (unlike the Enterprise): a board check per station would be ~100 calls a refresh.

**Why:** on 27 Nov at 19:55 the feed had 19 Commuter and 26 InterCity trains running; the existing placement put
18 and 25 on their lines (the others were past the map's ends). Cork stays off: a three-hour sample found only
Mallow–Cobh trains ever tracked, and those froze at Killarney Junction.

## 2026-11-27 · Station pages at hubs open on "All" routes

**Decision:** a Commuter or InterCity station on several routes gets an "All" chip first, and opens on it: every
route's trains on one pair of tracks (`allRoutesLine`). Routes are lined up by a neighbour they share, so a route
that keeps "outbound is up" (Galway & Mayo, east–west) is turned to match the rest at Kildare. Within a route, paths
through the same neighbour now agree (`orientAt`), so at Limerick Junction Limerick and Ennis trains share a track.
Track ends leave out the start of a line that trains from here only pass (Ballybrophy and Limerick Junction from
Kildare). A route picked on the map still opens on that route.

**Why:** at Kildare you had to pick Cork & Kerry, Galway & Mayo, Limerick or Waterford to see a train, when what
you usually want is the next train either way.

## 2026-11-27 · All-stations map: the south-west bends geography to fit every line

**Decision:** the Ennis–Athenry, Nenagh and Limerick Junction–Waterford lines are drawn on the all-stations map
(and the InterCity map, which shares its layout). To fit at 340 px with every name clear of the track, geography
gives way: Galway is a short stub east of Athenry; the Ennis line runs down the west edge (Craughwell above the
Tullamore swing, the rest below it) to Limerick; Limerick Junction–Waterford leaves the junction, runs down and
across to Tipperary and climbs the Waterford lane to Waterford; and the Nenagh line runs down from Limerick to a
stand-in Ballybrophy stop, named and opened as Ballybrophy, since drawing its track back up to the main line would
cross it. The main line spreads out a little so Limerick Junction lines up with Limerick; Tralee, Mallow and Cork
move down.

**Why:** the map's lanes have room for one column of names each; the west edge already carried Galway, Ennis,
Limerick and Tralee. Widening the map would add only about 40 px on a phone, not a lane. A separate south-west map
or strips under the map were the alternatives; the owner preferred bending the geography on the one map.

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
