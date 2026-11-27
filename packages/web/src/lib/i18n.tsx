import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import {
  type Departure,
  type Direction,
  findStationByCode,
  type IntercityRouteId,
  type NirRouteId,
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
  serviceNames: { dart: 'DART', enterprise: 'Enterprise', cork: 'Cork Commuter', commuter: 'Dublin Commuter', intercity: 'InterCity', nir: 'Translink NIR' } as Record<ServiceId, string>,
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
  nirRoutes: {
    bangor: 'Bangor',
    larne: 'Larne',
    derry: 'Derry',
    portrush: 'Portrush',
    portadown: 'Portadown & Newry',
  } as Record<NirRouteId, string>,
  nirNoLiveData: 'NI Railways times aren’t available, so there are no live trains for this station.',
  nirEnterpriseOnly: 'NI Railways times aren’t available. Only Enterprise and Irish Rail trains are shown here.',
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
  favouritesPlace: 'Favourites',
  favouritesInService: 'In each service',
  favouritesOnHome: 'On home page',
  install: 'Install',
  // iOS isn't available in Irish, so its button names are quoted in English in both languages.
  installTip: 'Tap Share, then “Add to Home Screen”, to open Next Train? like an app.',
  help: {
    open: 'Help & about',
    title: 'Help',
    readingTitle: 'Reading a station page',
    readingIntro: 'Each station has two tracks. Trains come towards the station sign along their track, the next one closest to it.',
    upArrow: 'Trains this way (northbound on the DART). The arrowhead names where they end up.',
    downArrow: 'Trains the other way (southbound on the DART).',
    due: 'Minutes until the train leaves.',
    scheduled: 'The timetabled time, crossed out when the train is late.',
    minor: 'Running a few minutes late.',
    major: (mins: number) => `Running ${mins} or more minutes late.`,
    expected: 'When it’s now expected to leave.',
    stale: 'The clock at the top is Irish time. “Updated” turns red if the times stop refreshing, for example with no signal.',
    tipsTitle: 'Tips',
    tips: [
      ['Going to', 'Tap “+ N more” or “Filter” and pick where you’re going. Trains that won’t get you there are hidden, and the choice is remembered for that station.'],
      ['Favourites', 'Tap the star on a station to keep it at the top of its map. In the options you can show all your favourites on the home page instead.'],
      ['Next stations', 'The names above and below the station sign take you one stop along the line.'],
      ['Add to your home screen', 'On iPhone, open the site in Safari, tap Share, then “Add to Home Screen”. On Android, Chrome offers “Install app”. It then opens full screen, like an app.'],
    ] as [string, string][],
    dataTitle: 'Where the times come from',
    data: [
      'Live times come from Irish Rail’s public real-time data. They look 90 minutes ahead and refresh every 30 seconds.',
      'They’re only as good as that data: cancellations and platform changes may not show, and some quieter stations report no trains at all.',
    ],
    privacyTitle: 'Privacy',
    privacy: [
      'No accounts, no ads and no tracking.',
      'Favourites are saved against a random ID your device makes up, not your name or number.',
      'If you send a message below, it’s kept for a year with your email (if you give one) and browser type, only to read and reply to it.',
    ],
    feedbackTitle: 'Questions & feedback',
    feedbackIntro: 'Spotted something wrong, or have an idea? Send a message.',
    message: 'Message',
    email: 'Your email (optional, if you’d like a reply)',
    send: 'Send',
    sending: 'Sending…',
    sent: 'Thanks, your message has been sent.',
    sendAnother: 'Send another',
    failed: 'Couldn’t send your message. Please check your connection and try again.',
    tooMany: 'You’ve sent a few messages already. Please try again later.',
    aboutTitle: 'About',
    about: 'Next Train? is unofficial and isn’t affiliated with Iarnród Éireann.',
    version: (version: string) => `Version ${version}`,
  },
  journey: {
    open: (destination: string) => `Show the stops to ${destination}`,
    stops: (destination: string) => `Stops to ${destination}`,
    close: 'Close',
    at: (station: string) => `At ${station}`,
    left: (station: string, mins: number) => (mins <= 0 ? `Just left ${station}` : `Left ${station} ${mins} min ago`),
    notStarted: (station: string, time: string) => `Leaves ${station} at ${time}`,
    cancelled: 'Cancelled',
    loading: 'Loading the stops…',
    unavailable: 'Couldn’t load this train’s stops.',
  },
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
    // A brand name, like DART and Enterprise.
    nir: 'Translink NIR',
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
  },  nirRoutes: {
    bangor: 'Beannchar',
    larne: 'Latharna',
    derry: 'Doire',
    portrush: 'Port Rois',
    portadown: 'Port an Dúnáin agus an tIúr',
  },
  nirNoLiveData: 'Níl amanna Iarnróid Thuaisceart Éireann ar fáil, mar sin níl aon traein bheo don stáisiún seo.',
  nirEnterpriseOnly: 'Níl amanna Iarnróid Thuaisceart Éireann ar fáil. Ní thaispeántar anseo ach traenacha an Enterprise agus Iarnród Éireann.',

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
  favouritesPlace: 'Ceanáin',
  favouritesInService: 'I ngach seirbhís',
  favouritesOnHome: 'Ar an leathanach baile',
  install: 'Suiteáil',
  installTip: 'Brúigh “Share”, ansin “Add to Home Screen”, chun Next Train? a oscailt mar aip.',
  help: {
    open: 'Cabhair & eolas',
    title: 'Cabhair',
    readingTitle: 'Leathanach stáisiúin a léamh',
    readingIntro: 'Tá dhá rian ag gach stáisiún. Tagann traenacha i dtreo chomhartha an stáisiúin ar a rian féin, an chéad cheann is gaire dó.',
    upArrow: 'Traenacha sa treo seo (ó thuaidh ar an DART). Ainmníonn ceann na saighde an áit a gcríochnaíonn siad.',
    downArrow: 'Traenacha sa treo eile (ó dheas ar an DART).',
    due: 'Nóiméid go bhfágann an traein.',
    scheduled: 'An t-am sa chlár ama, trasnaithe amach nuair a bhíonn an traein déanach.',
    minor: 'Cúpla nóiméad déanach.',
    major: (mins) => `${mins} nóiméad nó níos mó déanach.`,
    expected: 'An t-am a bhfuiltear ag súil anois go bhfágfaidh sí.',
    stale: 'Am na hÉireann atá ar an gclog thuas. Éiríonn “Nuashonraithe” dearg mura bhfuil na hamanna á nuashonrú, mar shampla gan chomhartha.',
    tipsTitle: 'Leideanna',
    tips: [
      ['Ag dul go', 'Brúigh “+ N eile” nó “Scag” agus roghnaigh cá bhfuil tú ag dul. Ceiltear traenacha nach dtabharfaidh ann thú, agus cuimhnítear ar do rogha don stáisiún sin.'],
      ['Ceanáin', 'Brúigh an réalta ar stáisiún chun é a choinneáil ag barr a léarscáile. Sna roghanna is féidir do cheanáin go léir a thaispeáint ar an leathanach baile ina ionad.'],
      ['Na stáisiúin eile', 'Tugann na hainmneacha os cionn agus faoi chomhartha an stáisiúin stad amháin ar aghaidh thú ar an líne.'],
      ['Cuir le do scáileán baile é', 'Ar iPhone, oscail an suíomh in Safari, brúigh “Share”, ansin “Add to Home Screen”. Ar Android, tairgeann Chrome “Install app”. Osclaíonn sé ansin ar an scáileán iomlán, mar aip.'],
    ],
    dataTitle: 'Cá as a dtagann na hamanna',
    data: [
      'Tagann na hamanna beo ó shonraí poiblí fíor-ama Iarnród Éireann. Féachann siad 90 nóiméad chun cinn agus nuashonraítear iad gach 30 soicind.',
      'Níl siad níos fearr ná na sonraí sin: b’fhéidir nach dtaispeánfar cealuithe ná athruithe ardáin, agus ní thuairiscíonn roinnt stáisiún ciúin aon traein.',
    ],
    privacyTitle: 'Príobháideacht',
    privacy: [
      'Gan chuntais, gan fógraí agus gan rianú.',
      'Sábháiltear ceanáin faoi aitheantas randamach a chumann do ghléas, ní faoi d’ainm ná d’uimhir.',
      'Má sheolann tú teachtaireacht thíos, coinnítear í ar feadh bliana le do ríomhphost (má thugann tú é) agus cineál do bhrabhsálaí, chun í a léamh agus freagra a thabhairt amháin.',
    ],
    feedbackTitle: 'Ceisteanna & aiseolas',
    feedbackIntro: 'An bhfaca tú rud mícheart, nó an bhfuil smaoineamh agat? Seol teachtaireacht.',
    message: 'Teachtaireacht',
    email: 'Do ríomhphost (roghnach, más mian leat freagra)',
    send: 'Seol',
    sending: 'Á seoladh…',
    sent: 'Go raibh maith agat, seoladh do theachtaireacht.',
    sendAnother: 'Seol ceann eile',
    failed: 'Níorbh fhéidir do theachtaireacht a sheoladh. Seiceáil do cheangal agus bain triail eile as.',
    tooMany: 'Tá cúpla teachtaireacht seolta agat cheana. Bain triail eile as ar ball.',
    aboutTitle: 'Eolas',
    about: 'Níl Next Train? oifigiúil agus níl baint aige le hIarnród Éireann.',
    version: (version) => `Leagan ${version}`,
  },
  journey: {
    open: (destination) => `Taispeáin na stadanna go ${destination}`,
    stops: (destination) => `Stadanna go ${destination}`,
    close: 'Dún',
    at: (station) => `Ag ${station}`,
    left: (station, mins) => (mins <= 0 ? `Díreach tar éis ${station} a fhágáil` : `D’fhág sí ${station} ${mins} nóim ó shin`),
    notStarted: (station, time) => `Fágfaidh sí ${station} ag ${time}`,
    cancelled: 'Cealaithe',
    loading: 'Na stadanna á lódáil…',
    unavailable: 'Níorbh fhéidir stadanna na traenach seo a lódáil.',
  },
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
