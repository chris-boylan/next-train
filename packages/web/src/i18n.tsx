import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import {
  type Departure,
  type Direction,
  findStationByCode,
  type IntercityRouteId,
  type ServiceId,
  type Station,
  type TrainCategory,
} from '@dart-times/core';

export type Lang = 'en' | 'ga';

const KEY = 'dart-times:lang';

// Irish phrasing uses "go dtí" (takes the nominative, so place names need no mutation) and avoids
// counting nouns after numbers, whose mutations vary. Irish strings should be reviewed by a fluent speaker.
const en = {
  services: 'Services',
  chooseService: 'Choose a service',
  serviceNames: { dart: 'DART', enterprise: 'Enterprise', cork: 'Cork Commuter', commuter: 'Dublin Commuter', intercity: 'InterCity' } as Record<ServiceId, string>,
  dublinBelfast: 'Dublin – Belfast',
  allStations: 'All stations',
  allStationsNote: 'Every Irish Rail station on one map',
  notYetMapped: 'Not yet mapped (no train seen on these lines yet)',
  italicStations: 'Stations in italics',
  noLiveDataNote: 'have no live times yet: in Northern Ireland, Irish Rail only has data for the Enterprise.',
  noLiveData: 'no live times yet',
  noLiveDataTitle: 'No live times yet',
  niRailways: 'NI Railways',
  noLiveDataExplained: 'There are no live times for this station yet. In Northern Ireland, Irish Rail only has live data for the Enterprise.',
  noTrainsAnyDirection: 'No trains in the next 90 minutes.',
  map: 'Map',
  allRoutes: 'All routes',
  byRoute: 'By route',
  commuterRoutes: { northern: 'Northern', western: 'Western', southWestern: 'South Western', southEastern: 'South Eastern' },
  intercityRoutes: {
    corkKerry: 'Cork & Kerry',
    galwayMayo: 'Galway & Mayo',
    limerick: 'Limerick & Ennis',
    waterford: 'Waterford',
    sligo: 'Sligo',
    rosslare: 'Rosslare',
  } as Record<IntercityRouteId, string>,
  stationCount: (n: number) => `${n} stations`,
  dublin: 'Dublin',
  towards2: (place: string) => `towards ${place}`,
  categories: { dart: 'DART', enterprise: 'Enterprise', intercity: 'InterCity', commuter: 'Commuter' } as Record<TrainCategory, string>,
  stations: 'Stations',
  findStation: 'Find a station',
  favouriteStations: 'Favourite stations',
  noMatch: (query: string) => `No station matches “${query}”.`,
  mapLabel: 'DART stations map',
  cityCentre: 'City centre',
  compassNorth: 'N',
  favourite: 'favourite',
  addFavourite: (station: string) => `Add ${station} to favourites`,
  removeFavourite: (station: string) => `Remove ${station} from favourites`,
  now: 'Now',
  updated: 'Updated',
  retrying: 'retrying',
  loading: 'Loading…',
  to: 'to',
  goingTo: (station: string) => `Going to ${station}`,
  goingToLabel: 'Going to',
  showAll: 'Show all trains',
  more: (n: number) => `+ ${n} more`,
  filter: 'Filter',
  due: 'Due',
  min: 'min',
  direction: { Northbound: 'Northbound', Southbound: 'Southbound' } as Record<Direction, string>,
  nextStation: { north: 'Next station north', south: 'Next station south' },
  towards: (direction: string, places: string) => `${direction}, towards ${places}`,
  // "trains", not "DARTs": these messages are shared by every service (DART, Enterprise…).
  noTrains: (direction: string) => `No ${direction.toLowerCase()} trains in the next 90 minutes`,
  noTrainsTo: (station: string) => `No trains to ${station} in the next 90 minutes`,
  terminateHere: 'Trains terminate here',
  noMatching: 'No matching trains in the next 90 minutes.',
  hidden: (n: number, places: string) => `${n} train${n === 1 ? '' : 's'} to ${places} hidden`,
  all: 'All',
  otherStation: 'Other station…',
  close: 'Close',
  and: 'and',
  options: 'Options',
  language: 'Language',
  languageNames: { en: 'English', ga: 'Irish' } as Record<Lang, string>,
  appearance: 'Appearance',
  light: 'Light',
  dark: 'Dark',
  describe: (destination: string, dueInMins: number, lateMins: number) =>
    `to ${destination} ${dueInMins <= 0 ? 'due now' : `in ${dueInMins} minute${dueInMins === 1 ? '' : 's'}`}` +
    (lateMins > 0 ? `, running ${lateMins} minute${lateMins === 1 ? '' : 's'} late` : ''),
};

type Messages = typeof en;

const ga: Messages = {
  services: 'Seirbhísí',
  chooseService: 'Roghnaigh seirbhís',
  // Irish Rail's own Irish labels: "Idirchathrach" (InterCity) and "Comaitéara" (Commuter), from its Irish live
  // maps (irishrail.ie/ga-ie/train-timetables/commuter-live-map). The two commuter services add the cities in the
  // genitive as Irish Rail writes them ("Léarscáil Iarnróid Bhaile Átha Cliath / Chorcaí"); those compounds are
  // ours and should be checked by a fluent speaker. DART and Enterprise are brand names.
  serviceNames: {
    dart: 'DART',
    enterprise: 'Enterprise',
    cork: 'Comaitéara Chorcaí',
    commuter: 'Comaitéara Bhaile Átha Cliath',
    intercity: 'Idirchathrach',
  },
  // As on Irish Rail's bilingual Dublin–Belfast timetable.
  dublinBelfast: 'Baile Átha Cliath – Béal Feirste',
  allStations: 'Gach stáisiún',
  allStationsNote: 'Gach stáisiún de chuid Iarnród Éireann ar léarscáil amháin',
  notYetMapped: 'Gan mapáil fós (níor feiceadh traein ar na línte seo fós)',
  italicStations: 'Stáisiúin i gcló iodálach:',
  noLiveDataNote: 'níl amanna beo againn dóibh fós. I dTuaisceart Éireann, níl sonraí ag Iarnród Éireann ach don Enterprise.',
  noLiveData: 'gan amanna beo fós',
  noLiveDataTitle: 'Gan amanna beo fós',
  // Translink's brand name, kept as is.
  niRailways: 'NI Railways',
  noLiveDataExplained: 'Níl amanna beo againn don stáisiún seo fós. I dTuaisceart Éireann, níl sonraí ag Iarnród Éireann ach don Enterprise.',
  noTrainsAnyDirection: 'Níl aon traein sna 90 nóiméad atá romhainn.',
  map: 'Léarscáil',
  allRoutes: 'Gach bealach',
  byRoute: 'De réir bealaigh',
  // Irish Rail publishes no Irish names for its commuter routes, so these use the standard compass regions
  // (tuaisceart, iarthar, iardheisceart, oirdheisceart) in the genitive: "the Northern line" and so on.
  commuterRoutes: {
    northern: 'Líne an Tuaiscirt',
    western: 'Líne an Iarthair',
    southWestern: 'Líne an Iardheiscirt',
    southEastern: 'Líne an Oirdheiscirt',
  },
  // Named after the places they serve, so they take the places' Irish names.
  intercityRoutes: {
    corkKerry: 'Corcaigh agus Ciarraí',
    galwayMayo: 'Gaillimh agus Maigh Eo',
    limerick: 'Luimneach agus Inis',
    waterford: 'Port Láirge',
    sligo: 'Sligeach',
    rosslare: 'Ros Láir',
  },
  stationCount: (n) => `${n} stáisiún`,
  dublin: 'Baile Átha Cliath',
  towards2: (place) => `go dtí ${place}`,
  // As Irish Rail labels them on its Irish pages; DART and Enterprise are brand names.
  categories: { dart: 'DART', enterprise: 'Enterprise', intercity: 'Idirchathrach', commuter: 'Comaitéara' },
  stations: 'Stáisiúin',
  findStation: 'Aimsigh stáisiún',
  favouriteStations: 'Stáisiúin is fearr leat',
  noMatch: (query) => `Níl stáisiún ar bith a mheaitseálann “${query}”.`,
  mapLabel: 'Léarscáil de stáisiúin DART',
  cityCentre: 'Lár na cathrach',
  compassNorth: 'T',
  favourite: 'ceanán',
  addFavourite: (station) => `Cuir ${station} leis na ceanáin`,
  removeFavourite: (station) => `Bain ${station} de na ceanáin`,
  now: 'Anois',
  updated: 'Nuashonraithe',
  retrying: 'ag triail arís',
  loading: 'Á lódáil…',
  to: 'go dtí',
  goingTo: (station) => `Ag dul go dtí ${station}`,
  goingToLabel: 'Ag dul go dtí',
  showAll: 'Taispeáin gach traein',
  more: (n) => `+ ${n} eile`,
  filter: 'Scag',
  due: 'Ag teacht',
  min: 'nóim',
  direction: { Northbound: 'Ó thuaidh', Southbound: 'Ó dheas' },
  nextStation: { north: 'An chéad stáisiún eile ó thuaidh', south: 'An chéad stáisiún eile ó dheas' },
  towards: (direction, places) => `${direction}, go dtí ${places}`,
  noTrains: (direction) => `Níl aon traein ${direction.toLowerCase()} sna 90 nóiméad atá romhainn`,
  noTrainsTo: (station) => `Níl aon traein go dtí ${station} sna 90 nóiméad atá romhainn`,
  terminateHere: 'Críochnaíonn na traenacha anseo',
  noMatching: 'Níl aon traein oiriúnach sna 90 nóiméad atá romhainn.',
  hidden: (n, places) => `${n} i bhfolach · go dtí ${places}`,
  all: 'Uile',
  otherStation: 'Stáisiún eile…',
  close: 'Dún',
  and: 'agus',
  options: 'Roghanna',
  language: 'Teanga',
  languageNames: { en: 'Béarla', ga: 'Gaeilge' },
  appearance: 'Cuma',
  light: 'Geal',
  dark: 'Dorcha',
  describe: (destination, dueInMins, lateMins) =>
    `go dtí ${destination}, ${dueInMins <= 0 ? 'ag teacht anois' : `i gceann ${dueInMins} nóiméad`}` +
    (lateMins > 0 ? `, ${lateMins} nóiméad déanach` : ''),
};

const MESSAGES: Record<Lang, Messages> = { en, ga };

function initialLang(): Lang {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === 'en' || stored === 'ga') return stored;
  } catch {
    // Fall through to the browser language.
  }
  return navigator.language.toLowerCase().startsWith('ga') ? 'ga' : 'en';
}

const LangContext = createContext<{ lang: Lang; setLang: (lang: Lang) => void }>({ lang: 'en', setLang: () => {} });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState(initialLang);
  useEffect(() => {
    document.documentElement.lang = lang === 'ga' ? 'ga' : 'en-IE';
  }, [lang]);
  const setLang = (next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Applied for this visit only.
    }
  };
  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}

/** Translated strings plus station names in the current language (falling back to English when no Irish name is known). */
export function useI18n() {
  const { lang, setLang } = useContext(LangContext);
  const t = MESSAGES[lang];

  const stationName = (station: Station, full = false) =>
    lang === 'ga' && station.irishName
      ? full
        ? station.irishName
        : (station.irishShortName ?? station.irishName)
      : full
        ? station.name
        : station.shortName;
  const nameOf = (code: string) => {
    const station = findStationByCode(code);
    return station ? stationName(station) : code;
  };
  const destinationName = (d: Departure) => (d.destinationCode ? nameOf(d.destinationCode) : d.destination);
  const list = (items: string[]) =>
    items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} ${t.and} ${items.at(-1)}`;
  const describe = (d: Departure) => t.describe(destinationName(d), d.dueInMins, d.lateMins);

  return { lang, setLang, t, stationName, nameOf, destinationName, list, describe };
}

/**
 * Text that stays correct when CSS capitalises it. Irish prefixes before a capital letter stay
 * lowercase in capitals ("Cnoc an tSalainn" → "CNOC AN tSALAINN"), so they're marked to skip
 * text-transform. The DOM text is unchanged, so screen readers read the name normally.
 */
export function Caps({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\s+)/).map((word, i) => {
        const prefix = word.match(/^[a-z]{1,2}(?=[A-ZÁÉÍÓÚ])/)?.[0];
        return prefix ? (
          <span key={i}>
            <span className="ga-prefix">{prefix}</span>
            {word.slice(prefix.length)}
          </span>
        ) : (
          word
        );
      })}
    </>
  );
}
