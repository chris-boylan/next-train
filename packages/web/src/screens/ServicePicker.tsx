import type { ReactNode } from 'react';
import type { ServiceId, Station } from '@dart-times/core';
import { Caps, useI18n } from '../lib/i18n';
import { OptionsMenu } from '../components/OptionsMenu';
import { useFavouritesPlace } from '../lib/prefs';
import type { SwipeHandlers } from '../lib/useSwipe';

interface Props {
  onSelect: (service: ServiceId) => void;
  onOpenNetwork: () => void;
  /** Every favourite, shown here when the options say favourites go on the home page. */
  favourites: Station[];
  onSelectFavourite: (station: Station) => void;
  /** The home page's title ("Next Train?", and the way to the trams). */
  title: ReactNode;
  /** Swiping across the page goes to the trams. */
  swipe: SwipeHandlers;
}

/**
 * Most-used first, by passenger journeys on the NTA's 2024 National Rail Census day: DART 87,058; Dublin
 * commuter 62,857; InterCity 50,753; Cork commuter and regional 9,617; Enterprise 6,214 (Tables 8 and 12).
 * Translink NIR comes last: it has no live times. The app keeps no usage stats of its own. The Luas isn't here:
 * trams have the home page's other page ("Next Tram?"), swiped to from this one.
 */
export const SERVICE_ORDER: Exclude<ServiceId, 'luas'>[] = ['dart', 'commuter', 'intercity', 'cork', 'enterprise', 'nir'];

/** The top level for trains: pick a service, then its map, then a station. */
export function ServicePicker({ onSelect, onOpenNetwork, favourites, onSelectFavourite, title, swipe }: Props) {
  const { t, nameOf, stationName } = useI18n();
  const [favouritesPlace] = useFavouritesPlace();
  const routes: Record<(typeof SERVICE_ORDER)[number], string> = {
    dart: `${nameOf('HOWTH')} · ${nameOf('MHIDE')} – ${nameOf('GSTNS')}`,
    enterprise: t.dublinBelfast,
    cork: `${nameOf('CORK')} – ${nameOf('COBH')} · ${nameOf('MDLTN')} · ${nameOf('MLLOW')}`,
    commuter: `${nameOf('DDALK')} · ${nameOf('MYNTH')} · ${nameOf('PTLSE')} · ${nameOf('GOREY')}`,
    intercity: `${nameOf('CORK')} · ${nameOf('GALWY')} · ${nameOf('LMRCK')} · ${nameOf('SLIGO')} · ${nameOf('WFORD')}`,
    nir: `${nameOf('NI_BANGR')} · ${t.nirRoutes.larne} · ${nameOf('NI_DERRY')} · ${nameOf('NI_PRUSH')} · ${nameOf('NEWRY')}`,
  };

  return (
    <div className="screen picker" {...swipe}>
      <header className="picker__header">
        <div className="picker__title">
          {title}
          <OptionsMenu />
        </div>
      </header>

      <div className="screen__scroll">
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
    </div>
  );
}
