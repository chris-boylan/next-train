import type { ServiceId } from '@dart-times/core';
import { Caps, useI18n } from './i18n';
import { OptionsMenu } from './OptionsMenu';

interface Props {
  onSelect: (service: ServiceId) => void;
  onOpenNetwork: () => void;
}

/**
 * Most-used first, by passenger journeys on the NTA's 2024 National Rail Census day: DART 87,058; Dublin
 * commuter 62,857; InterCity 50,753; Cork commuter and regional 9,617; Enterprise 6,214 (Tables 8 and 12).
 * The app keeps no usage stats of its own.
 */
export const SERVICE_ORDER: ServiceId[] = ['dart', 'commuter', 'intercity', 'cork', 'enterprise'];

/** The top level: pick a service, then its map, then a station. */
export function ServicePicker({ onSelect, onOpenNetwork }: Props) {
  const { t, nameOf } = useI18n();
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
