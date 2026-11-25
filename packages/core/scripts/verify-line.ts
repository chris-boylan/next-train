// Checks the line definition in src/line.ts against the stop lists of DARTs running right now.
// Usage: npm run verify-line -w @dart-times/core   (exits 1 on any mismatch)
import { IrishRailClient, route, servedStops } from '../src';

const MAX_TRAINS = 12;
const client = new IrishRailClient();
const trains = (await client.getCurrentDarts()).filter((t) => t.TrainStatus === 'R').slice(0, MAX_TRAINS);

if (!trains.length) {
  console.log('No DARTs running right now; try again during service hours.');
  process.exit(0);
}

let mismatches = 0;
for (const train of trains) {
  const stops = servedStops(await client.getTrainMovements(train.TrainCode));
  const from = stops[0];
  const to = stops.at(-1);
  const expected = from && to ? route(from, to) : undefined;
  const ok = !!expected && expected.join() === stops.join();
  if (!ok) mismatches++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${train.TrainCode.trim()} ${from} -> ${to} (${stops.length} stops)`);
  if (!ok) {
    console.log(`     train: ${stops.join(' ')}`);
    console.log(`     line:  ${expected?.join(' ') ?? 'no route between these stations'}`);
  }
}

console.log(`\n${trains.length - mismatches}/${trains.length} trains match the line definition.`);
process.exit(mismatches ? 1 : 0);
