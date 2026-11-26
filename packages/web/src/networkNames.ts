import { findStationByCode } from '@dart-times/core';
import { useI18n } from './i18n';
import { NETWORK_STATIONS } from './network.data';

const rawNames = new Map(NETWORK_STATIONS.map((s) => [s.code, s.name]));

/** Names for any station on the network: Irish where we have an official one, else Irish Rail's name. */
export function useNetworkName(): (code: string) => string {
  const { lang } = useI18n();
  return (code) => {
    const known = findStationByCode(code);
    if (known) return lang === 'ga' && known.irishName ? known.irishName : known.name;
    const raw = rawNames.get(code) ?? code;
    // A few API names are all capitals; show them like the rest.
    return raw === raw.toUpperCase() ? raw.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : raw;
  };
}
