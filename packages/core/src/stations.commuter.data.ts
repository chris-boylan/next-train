// Dublin commuter stations not already listed for the DART or Enterprise, from the Irish Rail API station
// list (getAllStationsXML, Nov 2026). Codes are the ones the departures feed answers to.
import type { StationRecord } from './stations';

export const COMMUTER_STATION_DATA: StationRecord[] = [
  // Northern, beyond Malahide
  { code: 'DBATE', name: 'Donabate', apiAlias: '', lat: 53.4855, lon: -6.15134 },
  { code: 'RLUSK', name: 'Rush and Lusk', apiAlias: '', lat: 53.5201, lon: -6.1439 },
  { code: 'SKRES', name: 'Skerries', apiAlias: '', lat: 53.5741, lon: -6.11933 },
  { code: 'BBRGN', name: 'Balbriggan', apiAlias: '', lat: 53.6118, lon: -6.18226 },
  { code: 'GSTON', name: 'Gormanston', apiAlias: '', lat: 53.638, lon: -6.21705 },
  { code: 'LTOWN', name: 'Laytown', apiAlias: '', lat: 53.6794, lon: -6.24253 },
  // Western
  { code: 'DCDRA', name: 'Drumcondra', apiAlias: '', lat: 53.3632, lon: -6.25908 },
  { code: 'BBRDG', name: 'Broombridge', apiAlias: '', lat: 53.3725, lon: -6.29869 },
  { code: 'DCKLS', name: 'Docklands', apiAlias: '', lat: 53.3509, lon: -6.23929 },
  { code: 'PELTN', name: 'Pelletstown', apiAlias: '', lat: 53.3752, lon: -6.31388 },
  { code: 'ASHTN', name: 'Ashtown', apiAlias: '', lat: 53.3755, lon: -6.33135 },
  { code: 'PHNPK', name: 'Navan Road Parkway', apiAlias: '', lat: 53.3777, lon: -6.34591 },
  { code: 'CNOCK', name: 'Castleknock', apiAlias: '', lat: 53.3816, lon: -6.37149 },
  { code: 'CMINE', name: 'Coolmine', apiAlias: '', lat: 53.3776, lon: -6.39072 },
  { code: 'CLSLA', name: 'Clonsilla', apiAlias: '', lat: 53.3831, lon: -6.4242 },
  { code: 'LXCON', name: 'Leixlip (Confey)', apiAlias: '', lat: 53.3743, lon: -6.48624 },
  { code: 'LXLSA', name: 'Leixlip (Louisa Bridge)', apiAlias: '', lat: 53.3704, lon: -6.50598 },
  { code: 'MYNTH', name: 'Maynooth', apiAlias: '', lat: 53.378, lon: -6.58993 },
  { code: 'HAFLD', name: 'Hansfield', apiAlias: '', lat: 53.3853, lon: -6.44205 },
  { code: 'DBYNE', name: 'Dunboyne', apiAlias: '', lat: 53.4175, lon: -6.46483 },
  { code: 'M3WAY', name: 'M3 Parkway', apiAlias: '', lat: 53.4349, lon: -6.46898 },
  // South Western
  { code: 'HSTON', name: 'Dublin Heuston', apiAlias: '', lat: 53.3464, lon: -6.29461 },
  { code: 'CHORC', name: 'Park West and Cherry Orchard', apiAlias: '', lat: 53.334, lon: -6.37868 },
  { code: 'CLDKN', name: 'Clondalkin', apiAlias: '', lat: 53.3334, lon: -6.40628 },
  { code: 'KISHO', name: 'Kishoge', apiAlias: '', lat: 53.3345, lon: -6.43038 },
  { code: 'ADAMF', name: 'Adamstown', apiAlias: '', lat: 53.3353, lon: -6.45233 },
  { code: 'HZLCH', name: 'Hazelhatch', apiAlias: '', lat: 53.3223, lon: -6.52356 },
  { code: 'SALNS', name: 'Sallins', apiAlias: '', lat: 53.2469, lon: -6.66386 },
  { code: 'NBRGE', name: 'Newbridge', apiAlias: '', lat: 53.1855, lon: -6.80807 },
  { code: 'CURAH', name: 'Curragh', apiAlias: '', lat: 53.1725, lon: -6.86245 },
  { code: 'KDARE', name: 'Kildare', apiAlias: '', lat: 53.163, lon: -6.90802 },
  { code: 'MONVN', name: 'Monasterevin', apiAlias: '', lat: 53.1454, lon: -7.06361 },
  { code: 'PTRTN', name: 'Portarlington', apiAlias: '', lat: 53.146, lon: -7.18055 },
  { code: 'PTLSE', name: 'Portlaoise', apiAlias: '', lat: 53.0371, lon: -7.30086 },
  // South Eastern, beyond Greystones
  { code: 'KCOOL', name: 'Kilcoole', apiAlias: '', lat: 53.107, lon: -6.04112 },
  { code: 'WLOW', name: 'Wicklow', apiAlias: '', lat: 52.9882, lon: -6.05338 },
  { code: 'RDRUM', name: 'Rathdrum', apiAlias: '', lat: 52.9295, lon: -6.22641 },
  { code: 'ARKLW', name: 'Arklow', apiAlias: '', lat: 52.7932, lon: -6.15994 },
  { code: 'GOREY', name: 'Gorey', apiAlias: '', lat: 52.6712, lon: -6.29195 },
];
