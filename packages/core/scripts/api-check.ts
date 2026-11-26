// Daily health check against the live Irish Rail API (run by .github/workflows/api-check.yml).
// The API has no versioning or changelog, so this fails loudly if its data goes missing or changes shape.
// Usage: npm run api-check -w @dart-times/core
import { IrishRailClient, SERVICES, type ServiceId } from '../src';

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
  const gone = SERVICES[id].stations.map((s) => s.code).filter((code) => !known.has(code));
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
if (problems.length) {
  console.error(`\nIrish Rail API check failed:\n${problems.map((p) => `- ${p}`).join('\n')}`);
  process.exit(1);
}
console.log('Irish Rail API check passed.');
