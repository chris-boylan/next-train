// Daily health check against the live Irish Rail and Luas APIs (run by .github/workflows/api-check.yml).
// Neither has versioning or a changelog, so this fails loudly if their data goes missing or changes shape.
// Usage: npm run api-check -w @dart-times/core
import { getLuasDepartures, IrishRailClient, LUAS_STATION_CODES, LuasClient, SERVICES, type ServiceId, TRANSLINK_STOPS } from '../src';

const client = new IrishRailClient({ timeoutMs: 15_000 });
const problems: string[] = [];
const check = (ok: boolean, problem: string) => {
  if (!ok) problems.push(problem);
};
const hasFields = (row: object, fields: string[]) => fields.filter((f) => !(f in row));

// 1. The station list: still there, still the same shape, and still knows every station the app uses.
const stations = await client.getAllStations();
check(stations.length > 100, `getAllStations returned ${stations.length} stations (expected over 100)`);
const missingStationFields = stations[0] ? hasFields(stations[0], ['StationCode', 'StationDesc', 'StationLatitude']) : [];
check(!missingStationFields.length, `station rows are missing ${missingStationFields.join(', ')}`);
const known = new Set(stations.map((s) => s.StationCode.trim().toUpperCase()));
for (const id of Object.keys(SERVICES) as ServiceId[]) {
  // Our own codes (NI_ for NI Railways stations Irish Rail doesn't know, LU_ for Luas stops) aren't Irish Rail's.
  const gone = SERVICES[id].stations.map((s) => s.code).filter((code) => !code.includes('_') && !known.has(code));
  check(!gone.length, `${id}: station codes no longer in the API: ${gone.join(', ')}`);
}

// 2. Live trains: some should be running at check time (mid-morning), with the fields the app reads.
const trains = await client.getCurrentTrains();
check(trains.length > 5, `getCurrentTrains returned ${trains.length} trains (expected more than 5 mid-morning)`);
const missingTrainFields = trains[0] ? hasFields(trains[0], ['TrainCode', 'PublicMessage', 'Direction']) : [];
check(!missingTrainFields.length, `train rows are missing ${missingTrainFields.join(', ')}`);

// 3. Departures at busy stations on every service: present, parseable, and recognisable as our services.
const busy = ['CNLLY', 'PERSE', 'HSTON', 'CORK', 'BFSTC'];
const departureFields = ['Traincode', 'Destination', 'Duein', 'Late', 'Expdepart', 'Schdepart', 'Direction', 'Traintype', 'Locationtype'];
let total = 0;
for (const code of busy) {
  const rows = await client.getStationData(code);
  total += rows.length;
  const missing = rows[0] ? hasFields(rows[0], departureFields) : [];
  check(!missing.length, `${code} departures are missing ${missing.join(', ')}`);
  const badDue = rows.filter((r) => !/^-?\d+$/.test(String(r.Duein).trim()));
  check(!badDue.length, `${code}: ${badDue.length} departures have a non-numeric Duein (e.g. "${badDue[0]?.Duein}")`);
  const matched = rows.filter((r) => (Object.keys(SERVICES) as ServiceId[]).some((id) => SERVICES[id].matches(r)));
  check(!rows.length || matched.length > 0, `${code}: none of ${rows.length} departures match any of our services`);
  console.log(`${code}: ${rows.length} departures, ${matched.length} matched to a service`);
}
check(total > 10, `only ${total} departures across ${busy.join(', ')} (expected more than 10 mid-morning)`);

console.log(`${stations.length} stations, ${trains.length} trains running`);

// 4. Luas: the stops list still has every stop the app uses, and a busy stop's forecast still parses. Trams may be
// suspended on one line (the forecast then has none, with a message), so only the Green line's Ranelagh is checked
// for trams, and a disruption there is reported, not failed.
const luas = new LuasClient({ timeoutMs: 15_000 });
const luasStops = new Set((await luas.getStops()).map((s) => `LU_${s.abrev}`));
const goneLuas = LUAS_STATION_CODES.filter((code) => !luasStops.has(code));
check(!goneLuas.length, `luas: stop codes no longer in the Luas API: ${goneLuas.join(', ')}`);
const ranelagh = await getLuasDepartures(luas, 'LU_RAN', SERVICES.luas.stations);
check(!!ranelagh.message, 'luas: the Ranelagh forecast has no status message (has the format changed?)');
check(ranelagh.disrupted || ranelagh.departures.length > 0, 'luas: no trams at Ranelagh, and no disruption reported');
check(ranelagh.departures.every((d) => d.destinationCode), `luas: Ranelagh has trams to unknown stops: ${ranelagh.departures.filter((d) => !d.destinationCode).map((d) => d.destination).join(', ')}`);
console.log(`Luas: ${luasStops.size} stops, ${ranelagh.departures.length} trams at Ranelagh (${ranelagh.message})`);

// 5. The station page's ticket button opens Irish Rail's journey planner with "From" filled (?S=<station>, see
// web/src/components/TicketLink.tsx). The planner reads S= in the browser, so this can't see the field filled; it
// checks the planner is still at that address and still the HAFAS web app that reads it.
const planner = await fetch('https://journeyplanner.irishrail.ie/webapp/?S=Kildare', { signal: AbortSignal.timeout(15_000) });
const plannerPage = planner.ok ? await planner.text() : '';
check(planner.ok, `ticket link: the journey planner returned HTTP ${planner.status}`);
check(/hafas_webapp/.test(plannerPage), 'ticket link: the journey planner is no longer the HAFAS web app (does ?S= still fill "From"?)');

// 6. NI Railways' ticket button opens Translink's "Plan and buy" with Translink's own station ID
// (translinkStops.data.ts, from npm run update-translink-stops). Its station search should still give Coleraine the
// ID we have: if Translink renumber their stations, the button would open on the wrong one, or none.
const translinkPlanner = await fetch('https://www.translink.co.uk/JourneyPlannerV2?isQuickBuy=true', { signal: AbortSignal.timeout(15_000) });
check(translinkPlanner.ok, `ticket link: Translink's journey planner returned HTTP ${translinkPlanner.status}`);
const coleraine = (await (await fetch('https://www.translink.co.uk/locationApi/find?SearchString=Coleraine', { signal: AbortSignal.timeout(15_000) })).json()) as {
  Locations?: { Id: string; LocationType: string }[];
} | null;
const coleraineId = coleraine?.Locations?.find((l) => l.LocationType === 'Train stop')?.Id;
check(coleraineId === TRANSLINK_STOPS.NI_COLER?.id, `ticket link: Translink's ID for Coleraine is now ${coleraineId}, not ${TRANSLINK_STOPS.NI_COLER?.id} (run npm run update-translink-stops)`);

if (problems.length) {
  console.error(`\nAPI check failed:\n${problems.map((p) => `- ${p}`).join('\n')}`);
  process.exit(1);
}
console.log('Irish Rail, Luas and ticket links check passed.');
