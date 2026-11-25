// Official Irish-language station names, as Iarnród Éireann publishes them on its Irish timetables-by-station
// page (irishrail.ie/ga-ie/train-timetables/timetables-by-station), cross-checked against its bilingual DART
// timetable PDF and logainm.ie (Nov 2026). `short` mirrors the English short name where Irish Rail's name
// includes a second place, e.g. "Howth Junction & Donaghmede" is shown as "Howth Junction".
// Note: Grand Canal Dock's heading and PDF say "Dug na Canálach Móire"; some of Irish Rail's links say "Duga…".
export const IRISH_NAMES: Record<string, { name: string; short?: string }> = {
  MHIDE: { name: 'Mullach Íde' },
  PMNCK: { name: 'Port Mearnóg' },
  GRGRD: { name: 'Cluain Ghrífín' },
  HOWTH: { name: 'Binn Éadair' },
  SUTTN: { name: 'Cill Fhionntain' },
  BYSDE: { name: 'Cois Bá' },
  HWTHJ: { name: 'Gabhal Bhinn Éadair agus Domhnach Míde', short: 'Gabhal Bhinn Éadair' },
  KBRCK: { name: 'Cill Bharróg' },
  RAHNY: { name: 'Ráth Eanaigh' },
  HTOWN: { name: 'Baile Hearmann' },
  KLSTR: { name: 'Cill Easra' },
  CTARF: { name: 'Bóthar Chluain Tarbh' },
  CNLLY: { name: 'Stáisiún Uí Chonghaile' },
  TARA: { name: 'Sráid na Teamhrach' },
  PERSE: { name: 'Stáisiún na bPiarsach' },
  GCDK: { name: 'Dug na Canálach Móire' },
  LDWNE: { name: 'Bóthar Lansdún' },
  SMONT: { name: 'Dumhach Thrá' },
  SIDNY: { name: 'Paráid Sydney' },
  BTSTN: { name: 'Baile an Bhóthair' },
  BROCK: { name: 'An Charraig Dhubh' },
  SEAPT: { name: 'Rinn na Mara' },
  SHILL: { name: 'Cnoc an tSalainn agus Baile na Manach' },
  DLERY: { name: 'Dún Laoghaire' },
  SCOVE: { name: 'Cuas an Ghainimh agus Glas Tuathail', short: 'Cuas an Ghainimh' },
  GLGRY: { name: 'Gleann na gCaorach' },
  DLKEY: { name: 'Deilginis' },
  KILNY: { name: 'Cill Iníon Léinín' },
  SKILL: { name: 'Seanchill' },
  WBROK: { name: 'Sruthán na Coille' },
  BRAY: { name: 'Bré' },
  GSTNS: { name: 'Na Clocha Liatha' },
  // Enterprise: town names as on Irish Rail's Irish station page and its bilingual Dublin–Belfast timetable
  // (logainm.ie agrees). The timetable's honorific station names, e.g. "Stáisiún Uí Chléirigh, Dún Dealgan",
  // aren't used, matching the English names from the API.
  DGHDA: { name: 'Droichead Átha' },
  DDALK: { name: 'Dún Dealgan' },
  NEWRY: { name: 'An tIúr' },
  PDOWN: { name: 'Port an Dúnáin' },
  BFSTC: { name: 'Béal Feirste' },
};
