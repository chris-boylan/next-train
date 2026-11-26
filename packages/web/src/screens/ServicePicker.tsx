import type { ServiceId, Station } from '@dart-times/core';
import { Caps, useI18n } from '../lib/i18n';
import { OptionsMenu } from '../components/OptionsMenu';
import { useFavouritesPlace } from '../lib/prefs';

interface Props {
  onSelect: (service: ServiceId) => void;
  onOpenNetwork: () => void;
  /** Every favourite, shown here when the options say favourites go on the home page. */
  favourites: Station[];
  onSelectFavourite: (station: Station) => void;
}

/**
 * Most-used first, by passenger journeys on the NTA's 2024 National Rail Census day: DART 87,058; Dublin
 * commuter 62,857; InterCity 50,753; Cork commuter and regional 9,617; Enterprise 6,214 (Tables 8 and 12).
 * The app keeps no usage stats of its own.
 */
export const SERVICE_ORDER: ServiceId[] = ['dart', 'commuter', 'intercity', 'cork', 'enterprise'];

/** The top level: pick a service, then its map, then a station. */
export function ServicePicker({ onSelect, onOpenNetwork, favourites, onSelectFavourite }: Props) {
  const { t, nameOf, stationName } = useI18n();
  const [favouritesPlace] = useFavouritesPlace();
  const routes: Record<ServiceId, string> = {
    dart: `${nameOf('HOWTH')} · ${nameOf('MHIDE')} – ${nameOf('GSTNS')}`,
    enterprise: t.dublinBelfast,
    cork: `${nameOf('CORK')} – ${nameOf('COBH')} · ${nameOf('MDLTN')} · ${nameOf('MLLOW')}`,
    commuter: `${nameOf('DDALK')} · ${nameOf('MYNTH')} · ${nameOf('PTLSE')} · ${nameOf('GOREY')}`,
    intercity: `${nameOf('CORK')} · ${nameOf('GALWY')} · ${nameOf('LMRCK')} · ${nameOf('SLIGO')} · ${nameOf('WFORD')}`,
  };

  return (
    <div className="picker">
      <header className="picker__header">
        <div className="picker__title">
          <h1>Next Train?</h1>
          <OptionsMenu />
        </div>
      </header>
      {favouritesPlace === 'home' && favourites.length > 0 && (
        <>
          <h2 className="services__heading">{t.favouriteStations}</h2>
          <div className="favourites favourites--home" aria-label={t.favouriteStations}>
            {favourites.map((s) => (
              <button key={s.code} className="chip chip--fav" onClick={() => onSelectFavourite(s)}>
                ★ <Caps text={stationName(s)} />
              </button>
            ))}
          </div>
        </>
      )}
      <h2 className="services__heading">{t.chooseService}</h2>
      <ul className="services">
        {SERVICE_ORDER.map((id) => (
          <li key={id}>
            <button className={`service-tile service-tile--${id}`} onClick={() => onSelect(id)}>
              <span className="service-tile__stripes" aria-hidden>
                <span className="service-tile__north" />
                <span className="service-tile__south" />
              </span>
              <span className="service-tile__text">
                <span className="service-tile__name">{t.serviceNames[id]}</span>
                <span className="service-tile__route">
                  <Caps text={routes[id]} />
                </span>
              </span>
              <span className="service-tile__go" aria-hidden>
                ›
              </span>
            </button>
          </li>
        ))}
      </ul>
      <button className="network-link" onClick={onOpenNetwork}>
        <span className="network-link__text">
          <span className="network-link__name">{t.allStations}</span>
          <span className="service-tile__route">{t.allStationsNote}</span>
        </span>
        <span className="service-tile__go" aria-hidden>
          ›
        </span>
      </button>
    </div>
  );
}
