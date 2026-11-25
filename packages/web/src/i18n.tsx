import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { type Departure, type Direction, findStationByCode, type ServiceId, type Station } from '@dart-times/core';

export type Lang = 'en' | 'ga';

const KEY = 'dart-times:lang';

// Irish phrasing uses "go dtí" (takes the nominative, so place names need no mutation) and avoids
// counting nouns after numbers, whose mutations vary. Irish strings should be reviewed by a fluent speaker.
const en = {
  services: 'Services',
  chooseService: 'Choose a service',
  serviceNames: { dart: 'DART', enterprise: 'Enterprise' } as Record<ServiceId, string>,
  dublinBelfast: 'Dublin – Belfast',
  stations: 'Stations',
  findStation: 'Find a station',
  favouriteStations: 'Favourite stations',
  noMatch: (query: string) => `No DART station matches “${query}”.`,
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
  noDarts: (direction: string) => `No ${direction.toLowerCase()} DARTs in the next 90 minutes`,
  noDartsTo: (station: string) => `No DARTs to ${station} in the next 90 minutes`,
  terminateHere: 'Trains terminate here',
  noMatching: 'No matching DARTs in the next 90 minutes.',
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
  serviceNames: { dart: 'DART', enterprise: 'Enterprise' },
  // As on Irish Rail's bilingual Dublin–Belfast timetable.
  dublinBelfast: 'Baile Átha Cliath – Béal Feirste',
  stations: 'Stáisiúin',
  findStation: 'Aimsigh stáisiún',
  favouriteStations: 'Stáisiúin is fearr leat',
  noMatch: (query) => `Níl stáisiún DART ar bith a mheaitseálann “${query}”.`,
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
  noDarts: (direction) => `Níl aon DART ${direction.toLowerCase()} sna 90 nóiméad atá romhainn`,
  noDartsTo: (station) => `Níl aon DART go dtí ${station} sna 90 nóiméad atá romhainn`,
  terminateHere: 'Críochnaíonn na traenacha anseo',
  noMatching: 'Níl aon DART oiriúnach sna 90 nóiméad atá romhainn.',
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
