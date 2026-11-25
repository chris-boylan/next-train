// Live check against the real API: prints the next DARTs from a station.
// Usage: npm run smoke -- connolly [north|south]
import { describeDeparture, getDepartures, IrishRailClient, parseDirection, resolveStation } from '../src';

const [query = 'CNLLY', dir] = process.argv.slice(2);
const station = resolveStation(query);
if (!station) {
  console.error(`No DART station matches "${query}"`);
  process.exit(1);
}

const direction = parseDirection(dir);
const departures = await getDepartures(new IrishRailClient(), station.code, { direction, limit: 5 });
console.log(`Next DARTs from ${station.name} (${station.code})${direction ? `, ${direction}` : ''}:`);
if (!departures.length) console.log('  None in the next 90 minutes.');
for (const d of departures) console.log(`  ${d.expectedDepart}  ${describeDeparture(d)}`);
