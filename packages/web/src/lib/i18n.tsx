import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import {
  type Departure,
  type Direction,
  findStationByCode,
  type IntercityRouteId,
  type ScheduledDeparture,
  type NirRouteId,
  type ServiceId,
  type Station,
  type TrainCategory,
} from '@dart-times/core';
import { type CountdownStyle, dueParts } from './due';
import { useCountdownStyle } from './prefs';

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
  // Not just Irish Rail's: the map has NI Railways' stations too.
  allStationsNote: 'Every rail station in Ireland on one map',
  // Stations on lines with trains that the all-stations (and InterCity) map can't draw yet; their boards work from search.
  notDrawnYet: 'Trains run here, but this map doesn’t draw their line yet (search to see their times)',
  italicStations: 'Stations in italics',
  timetableOnlyNote: 'have timetabled times only: there are no live NI Railways times.',
  timetableOnly: 'timetable only',
  niRailways: 'NI Railways',
  noTrainsAnyDirection: 'No trains in the next 90 minutes.',
  later: 'Later · timetable',
  timetabled: 'Timetable',
  // A train Irish Rail should be tracking by now but isn't: its time is only the timetable's.
  notTracked: 'Not tracked',
  laterNote: (mins: number) => `Timetabled times. Live times and delays appear about ${mins} minutes before.`,
  // Tapping a timetabled train on the station page.
  timetableWindow: (mins: number) =>
    `Irish Rail’s live tracking covers the next ${mins} minutes. This train is further away, so it shows its timetabled time. Its live time and any delay appear once it’s within ${mins} minutes.`,
  whyTimetabled: (destination: string) => `Why the train to ${destination} shows its timetabled time`,
  map: 'Map',
  allRoutes: 'All routes',
  // The station page's chip for every route at a hub, on one pair of tracks.
  allRoutesChip: 'All',
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
  nirNoLiveData: 'NI Railways has no live times, so these are Translink’s timetabled times: delays and cancellations don’t show.',
  nirEnterpriseOnly: 'NI Railways has no live times, so its trains are Translink’s timetabled times: delays and cancellations don’t show. Enterprise and Irish Rail trains are live.',
  timetable: 'Timetable',
  showAsList: 'Show as a list',
  showOnTracks: 'Show on the tracks',
  lines: 'Lines',
  noTrainsTowards: (places: string) => `No trains towards ${places} in the next 90 minutes`,
  // When this service has none but another's trains run that way (Commuter at Kilbarrack, DARTs running).
  noServiceTrains: (service: string) => `No ${service} trains in the next 90 minutes.`,
  otherServicesRun: (services: string, places: string, mins: number) =>
    `${services} trains to ${places} do${mins <= 0 ? ', one due now' : `, the next in ${mins} min`}.`,
  tomorrow: 'Tomorrow',
  // Today's last train on a track, when tomorrow's first follows it.
  lastToday: 'Last today',
  lastTrainToday: 'last train today',
  noMoreToday: 'No more trains today',
  noTimetabledTrains: 'No timetabled trains',
  nirTimetableNote: 'Timetabled times from Translink. NI Railways has no live times, so delays and cancellations don’t show.',
  stationCount: (n: number) => `${n} stations`,
  dublin: 'Dublin',
  towards2: (place: string) => `towards ${place}`,
  categories: { dart: 'DART', enterprise: 'Enterprise', intercity: 'InterCity', commuter: 'Commuter', nir: 'NIR' } as Record<TrainCategory, string>,
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
  hour: 'h',
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
  countdownStyle: 'Times over an hour',
  countdownMinutes: 'Minutes',
  countdownHours: 'Hours & mins',
  timetabledTrains: 'Timetabled trains',
  on: 'On',
  off: 'Off',
  install: 'Install',
  // iOS isn't available in Irish, so its button names are quoted in English in both languages.
  installTip: 'Tap Share, then “Add to Home Screen”, to open Next Train? like an app.',
  help: {
    open: 'Help & about',
    title: 'Help',
    readingTitle: 'Reading a station page',
    readingIntro: 'Each direction has its own track, in the service’s colours (green and orange on the DART, purples on the Enterprise, reds on Cork Commuter). Trains come towards the station sign along their track, the next one closest to it.',
    upArrow: 'Trains coming up the screen towards the station, then carrying on past it. The arrowhead names where they finish.',
    downArrow: 'Trains coming down the screen, heading the other way. Its arrowhead names where they finish.',
    boards: 'Dublin Commuter and InterCity stations, which can be on several routes, show a board grouped by route instead.',
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
      'Live times come from Irish Rail’s real-time API, the same data as the screens at stations. The app checks it every 30 seconds, it looks 90 minutes ahead and includes delays, and tapping a train shows its stops ahead from the same feed.',
      'Later trains come from Irish Rail’s timetable, which the National Transport Authority publishes every night as open data (GTFS). Trains beyond the next 90 minutes are listed under “Later · timetable” at their timetabled times, without live information yet.',
      'Northern Ireland: there are no live NI Railways times, so NI Railways trains are shown at their timetabled times, from Translink’s timetable on OpenDataNI (Open Government Licence). Enterprise trains come from Irish Rail.',
      'The times are only as good as the data: cancellations and platform changes may not show, and some quieter stations report no trains.',
    ],
    privacyTitle: 'Privacy',
    privacy: [
      'No accounts, no ads and no tracking.',
      'Favourites are saved against a random ID your device makes up, not your name or number.',
      'If you send a message below, it’s kept for a year with your email and browser type, only to read and reply to it.',
    ],
    feedbackTitle: 'Questions & feedback',
    feedbackIntro: 'Spotted something wrong, or have an idea? Send a message.',
    message: 'Message',
    email: 'Your email (so we can reply)',
    emailInvalid: 'Enter a full email address, like name@example.ie.',
    characters: (n: number, max: number) => `${n.toLocaleString('en-IE')} / ${max.toLocaleString('en-IE')}`,
    send: 'Send',
    sending: 'Sending…',
    sent: 'Thanks, your message has been sent.',
    sendAnother: 'Send another',
    failed: 'Couldn’t send your message. Please check your connection and try again.',
    tooMany: 'You’ve sent a few messages already. Please try again later.',
    aboutTitle: 'About',
    about: 'Next Train? is unofficial and isn’t affiliated with Iarnród Éireann.',
    design: 'Design inspired by the Swiss (International Typographic) Style, with wayfinding-style arrows, and Harry Beck’s London Underground map. Typeface: Inter Tight (SIL Open Font License).',
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
    // Shown instead of where the train is, for a train Irish Rail should be tracking by now but isn't.
    untrackedTitle: 'Not tracked',
    // Kept to about three lines: it sits beside the train, in a 92px band.
    untracked: 'Irish Rail isn’t tracking this train, so these are timetable times.',
  },
  liveTrains: 'Live trains',
  live: 'Live',
  liveTrainsUnavailable: 'Live trains unavailable',
  trainTo: (destination: string) => `Train to ${destination}`,
  nextStop: 'Next stop',
  standingAt: 'At',
  trainCode: 'Train',
  trainStatus: 'Running',
  onTime: 'On time',
  minsLate: (n: number) => `${n} min late`,
  minsEarly: (n: number) => `${n} min early`,
  // A live-map train Irish Rail isn't tracking (the Enterprise in Northern Ireland), placed from the timetable.
  estimatedNote: 'Irish Rail isn’t tracking this train, so its place on the map is estimated from the timetable.',
  describeEstimated: (destination: string, next: string) => `Train to ${destination}, next stop ${next}, not tracked, position estimated`,
  describeTrain: (destination: string, next: string, lateMins: number) =>
    `Train to ${destination}, next stop ${next}` +
    (lateMins > 0 ? `, ${lateMins} minute${lateMins === 1 ? '' : 's'} late` : ''),
  describeScheduled: (destination: string, time: string) => `to ${destination} at ${time}, timetabled, no live information yet`,
  describeUntracked: (destination: string, time: string) => `to ${destination} at ${time}, timetabled, not being tracked`,
  describe: (destination: string, dueInMins: number, lateMins: number, style: CountdownStyle) =>
    `to ${destination} ${dueInMins <= 0 ? 'due now' : `in ${spokenDue(dueInMins, style)}`}` +
    (lateMins > 0 ? `, running ${lateMins} minute${lateMins === 1 ? '' : 's'} late` : ''),
};

type Messages = typeof en;

/** "26 minutes", or in hours style "1 hour 26 minutes" / "2 hours". */
function spokenDue(mins: number, style: CountdownStyle): string {
  return dueParts(mins, style)
    .map(({ value, unit }) => `${value} ${unit === 'h' ? 'hour' : 'minute'}${value === 1 ? '' : 's'}`)
    .join(' ');
}

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
  allStationsNote: 'Gach stáisiún iarnróid in Éirinn ar léarscáil amháin',
  notDrawnYet: 'Ritheann traenacha anseo, ach níl a líne ar an léarscáil seo fós (cuardaigh chun a n-amanna a fheiceáil)',
  italicStations: 'Stáisiúin i gcló iodálach:',
  timetableOnlyNote: 'níl acu ach amanna an chláir ama: níl amanna beo ar fáil d’Iarnród Thuaisceart Éireann.',
  timetableOnly: 'clár ama amháin',
  // Translink's brand name, kept as is.
  niRailways: 'NI Railways',
  noTrainsAnyDirection: 'Níl aon traein sna 90 nóiméad atá romhainn.',
  later: 'Níos déanaí · clár ama',
  timetabled: 'Clár ama',
  notTracked: 'Gan rianú',
  laterNote: (mins) => `Amanna an chláir ama. Feictear amanna beo agus moilleanna thart ar ${mins} nóiméad roimh ré.`,
  timetableWindow: (mins) =>
    `Clúdaíonn rianú beo Iarnród Éireann an ${mins} nóiméad atá romhainn. Tá an traein seo níos faide uainn, mar sin taispeántar am an chláir ama. Feicfear a ham beo agus aon mhoill nuair a bheidh sí laistigh de ${mins} nóiméad.`,
  whyTimetabled: (destination) => `Cén fáth a dtaispeántar am an chláir ama don traein go dtí ${destination}`,
  map: 'Léarscáil',
  allRoutes: 'Gach bealach',
  allRoutesChip: 'Gach ceann',
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
  nirNoLiveData: 'Níl amanna beo ar fáil d’Iarnród Thuaisceart Éireann, mar sin is iad seo amanna chlár ama Translink: ní thaispeántar moilleanna ná cealuithe.',
  nirEnterpriseOnly: 'Níl amanna beo ar fáil d’Iarnród Thuaisceart Éireann, mar sin is iad amanna chlár ama Translink atá ag a chuid traenacha: ní thaispeántar moilleanna ná cealuithe. Tá traenacha an Enterprise agus Iarnród Éireann beo.',
  timetable: 'Clár ama',
  showAsList: 'Taispeáin mar liosta',
  showOnTracks: 'Taispeáin ar na rianta',
  lines: 'Línte',
  noTrainsTowards: (places) => `Níl aon traein i dtreo ${places} sna 90 nóiméad atá romhainn`,
  noServiceTrains: (service) => `Níl aon traein ${service} sna 90 nóiméad atá romhainn.`,
  otherServicesRun: (services, places, mins) =>
    `Ach ritheann traenacha ${services} go dtí ${places}${mins <= 0 ? ', ceann ag teacht anois' : `, an chéad cheann i gceann ${mins} nóim`}.`,
  tomorrow: 'Amárach',
  lastToday: 'Deireanach inniu',
  lastTrainToday: 'an traein dheireanach inniu',
  noMoreToday: 'Níl a thuilleadh traenacha inniu',
  noTimetabledTrains: 'Níl aon traein sa chlár ama',
  nirTimetableNote: 'Amanna an chláir ama ó Translink. Níl amanna beo ag Iarnród Thuaisceart Éireann, mar sin ní thaispeántar moilleanna ná cealuithe.',

  stationCount: (n) => `${n} stáisiún`,
  dublin: 'Baile Átha Cliath',
  towards2: (place) => `go dtí ${place}`,
  // As Irish Rail labels them on its Irish pages; DART and Enterprise are brand names.
  categories: { dart: 'DART', enterprise: 'Enterprise', intercity: 'Idirchathrach', commuter: 'Comaitéara', nir: 'NIR' },
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
  hour: 'u',
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
  countdownStyle: 'Amanna thar uair an chloig',
  countdownMinutes: 'Nóiméid',
  countdownHours: 'Uaireanta & nóim',
  timetabledTrains: 'Traenacha an chláir ama',
  on: 'Ar siúl',
  off: 'Múchta',
  install: 'Suiteáil',
  installTip: 'Brúigh “Share”, ansin “Add to Home Screen”, chun Next Train? a oscailt mar aip.',
  help: {
    open: 'Cabhair & eolas',
    title: 'Cabhair',
    readingTitle: 'Leathanach stáisiúin a léamh',
    readingIntro: 'Tá a rian féin ag gach treo, i ndathanna na seirbhíse (glas agus oráiste ar an DART, corcra ar an Enterprise, dearg ar Chomaitéara Chorcaí). Tagann traenacha i dtreo chomhartha an stáisiúin ar a rian féin, an chéad cheann is gaire dó.',
    upArrow: 'Traenacha ag teacht aníos an scáileán i dtreo an stáisiúin, agus ar aghaidh thairis. Ainmníonn ceann na saighde an áit a gcríochnaíonn siad.',
    downArrow: 'Traenacha ag teacht anuas an scáileán, sa treo eile. Ainmníonn ceann na saighde an áit a gcríochnaíonn siad.',
    boards: 'Taispeánann stáisiúin Chomaitéara Bhaile Átha Cliath agus Idirchathrach, a d’fhéadfadh a bheith ar roinnt bealaí, clár grúpáilte de réir bealaigh ina ionad.',
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
      'Tagann na hamanna beo ó API fíor-ama Iarnród Éireann, na sonraí céanna agus atá ar na scáileáin ag na stáisiúin. Seiceálann an aip é gach 30 soicind, féachann sé 90 nóiméad chun cinn agus áirítear moilleanna, agus má bhrúnn tú ar thraein taispeántar na stadanna atá roimpi ón bhfotha céanna.',
      'Tagann traenacha níos déanaí ó chlár ama Iarnród Éireann, a fhoilsíonn an tÚdarás Náisiúnta Iompair gach oíche mar shonraí oscailte (GTFS). Liostaítear traenacha tar éis an chéad 90 nóiméad faoi “Níos déanaí · clár ama” ag amanna an chláir ama, gan eolas beo fós.',
      'Tuaisceart Éireann: níl amanna beo d’Iarnród Thuaisceart Éireann ann, mar sin taispeántar a gcuid traenacha de réir chlár ama Translink ar OpenDataNI (Ceadúnas Rialtais Oscailte). Tagann traenacha an Enterprise ó Iarnród Éireann.',
      'Níl na hamanna níos fearr ná na sonraí: b’fhéidir nach dtaispeánfar cealuithe ná athruithe ardáin, agus ní thuairiscíonn roinnt stáisiún ciúin aon traein.',
    ],
    privacyTitle: 'Príobháideacht',
    privacy: [
      'Gan chuntais, gan fógraí agus gan rianú.',
      'Sábháiltear ceanáin faoi aitheantas randamach a chumann do ghléas, ní faoi d’ainm ná d’uimhir.',
      'Má sheolann tú teachtaireacht thíos, coinnítear í ar feadh bliana le do ríomhphost agus cineál do bhrabhsálaí, chun í a léamh agus freagra a thabhairt amháin.',
    ],
    feedbackTitle: 'Ceisteanna & aiseolas',
    feedbackIntro: 'An bhfaca tú rud mícheart, nó an bhfuil smaoineamh agat? Seol teachtaireacht.',
    message: 'Teachtaireacht',
    email: 'Do ríomhphost (chun freagra a thabhairt)',
    emailInvalid: 'Cuir isteach seoladh ríomhphoist iomlán, mar shampla ainm@example.ie.',
    characters: (n, max) => `${n.toLocaleString('ga-IE')} / ${max.toLocaleString('ga-IE')}`,
    send: 'Seol',
    sending: 'Á seoladh…',
    sent: 'Go raibh maith agat, seoladh do theachtaireacht.',
    sendAnother: 'Seol ceann eile',
    failed: 'Níorbh fhéidir do theachtaireacht a sheoladh. Seiceáil do cheangal agus bain triail eile as.',
    tooMany: 'Tá cúpla teachtaireacht seolta agat cheana. Bain triail eile as ar ball.',
    aboutTitle: 'Eolas',
    about: 'Níl Next Train? oifigiúil agus níl baint aige le hIarnród Éireann.',
    design: 'Dearadh spreagtha ag an Stíl Eilvéiseach (an Stíl Chlóghrafaíochta Idirnáisiúnta), le saigheada ar nós comharthaí treo, agus ag léarscáil Faoi Thalamh Londan le Harry Beck. Cló: Inter Tight (SIL Open Font License).',
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
    untrackedTitle: 'Gan rianú',
    untracked: 'Níl Iarnród Éireann ag rianú na traenach seo, mar sin is amanna an chláir ama iad seo.',
  },
  liveTrains: 'Traenacha beo',
  live: 'Beo',
  liveTrainsUnavailable: 'Níl traenacha beo ar fáil',
  trainTo: (destination) => `Traein go dtí ${destination}`,
  nextStop: 'An chéad stad eile',
  standingAt: 'Ag',
  trainCode: 'Traein',
  trainStatus: 'Stádas',
  onTime: 'In am',
  minsLate: (n) => `${n} nóim. déanach`,
  minsEarly: (n) => `${n} nóim. luath`,
  estimatedNote: 'Níl Iarnród Éireann ag rianú na traenach seo, mar sin is meastachán ón gclár ama a háit ar an léarscáil.',
  describeEstimated: (destination, next) => `Traein go dtí ${destination}, an chéad stad eile ${next}, gan rianú, áit mheasta`,
  describeTrain: (destination, next, lateMins) =>
    `Traein go dtí ${destination}, an chéad stad eile ${next}` + (lateMins > 0 ? `, ${lateMins} nóiméad déanach` : ''),
  describeScheduled: (destination, time) => `go dtí ${destination} ag ${time}, de réir an chláir ama`,
  describeUntracked: (destination, time) => `go dtí ${destination} ag ${time}, de réir an chláir ama, gan rianú`,
  // Spoken in minutes whatever the countdown style: hours need Irish number mutations (uair, huaire, n-uaire).
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
  const [countdownStyle] = useCountdownStyle();

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
  // A timetabled train's destination: our name when we know the station, else the timetable's minus its bracketed part.
  const scheduledDestination = (d: ScheduledDeparture) =>
    d.destinationCode ? nameOf(d.destinationCode) : d.destination.replace(/\s*\(.*?\)/g, '');
  const list = (items: string[]) =>
    items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} ${t.and} ${items.at(-1)}`;
  // Untracked trains: only the timetable time is known, so no countdown or lateness is read out as if live.
  const describe = (d: Departure) =>
    d.untracked
      ? t.describeUntracked(destinationName(d), d.scheduledDepart)
      : t.describe(destinationName(d), d.dueInMins, d.lateMins, countdownStyle);

  return { lang, setLang, t, stationName, nameOf, destinationName, scheduledDestination, list, describe };
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
