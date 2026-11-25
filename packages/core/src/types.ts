export type Direction = 'Northbound' | 'Southbound';

export interface Station {
  /** Irish Rail station code, e.g. `CNLLY`. */
  code: string;
  /** Full name from Irish Rail, e.g. `Dublin Connolly`. */
  name: string;
  /** Name without the `Dublin ` prefix, used for speech and compact UI. */
  shortName: string;
  /** Official Irish name, when known; apps fall back to the English name without one. */
  irishName?: string;
  /** Shorter Irish form for compact display, like `shortName`. */
  irishShortName?: string;
  /** Other names people use for the station, used for search and voice synonyms. */
  aliases: string[];
  /** Shared section, or one of the two northern branches beyond Howth Junction. */
  branch: 'trunk' | 'howth' | 'malahide';
  lat: number;
  lon: number;
}

export interface Departure {
  trainCode: string;
  origin: string;
  destination: string;
  /** Station codes when the origin/destination is a DART station, for use with the line helpers. */
  originCode?: string;
  destinationCode?: string;
  direction: Direction | string;
  /** Minutes until the train is due, as reported by Irish Rail. */
  dueInMins: number;
  /** Expected departure time, `HH:mm`. */
  expectedDepart: string;
  /** Scheduled departure time, `HH:mm`. */
  scheduledDepart: string;
  /** Minutes late (negative means early). */
  lateMins: number;
  trainType: 'DART' | 'Train' | string;
  lastLocation: string;
}
