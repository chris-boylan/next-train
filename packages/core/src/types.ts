export type Direction = 'Northbound' | 'Southbound';

/** `nir`: NI Railways, from Translink's timetable only (there's no live NIR data). */
export type TrainCategory = 'dart' | 'enterprise' | 'intercity' | 'commuter' | 'nir';

export interface Station {
  /** Irish Rail station code, e.g. `CNLLY`. */
  code: string;
  /** Full name from Irish Rail, e.g. `Dublin Connolly`. */
  name: string;
  /** Name without the `Dublin ` prefix, used for speech and compact UI. */
  shortName: string;
  /** The station's official commemorative name when it differs from the one shown, e.g. `Kent Station` (Cork). */
  officialName?: string;
  /** Official Irish name, when known; apps fall back to the English name without one. */
  irishName?: string;
  /** Shorter Irish form for compact display, like `shortName`. */
  irishShortName?: string;
  /** Other names people use for the station, used for search and voice synonyms. */
  aliases: string[];
  /** Irish Rail's name for the station, when the app shows a newer or fuller one (Belfast Grand Central is
   *  "Belfast" in the API). Departure origins and destinations use this name. */
  apiName?: string;
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
  /** What kind of service this is (see `trainCategory`). */
  category: TrainCategory;
  lastLocation: string;
  /**
   * True when Irish Rail isn't tracking a train that should already be running: it says "No Information" though
   * the train's start time has passed. Its times are then just the timetable, and "0 minutes late" means unknown.
   * Trains that haven't started yet aren't flagged (they all say "No Information" until they leave).
   */
  untracked?: boolean;
}
