import { SERVICES, type ServiceId } from '@dart-times/core';
import { Caps, useI18n } from './i18n';
import { OptionsMenu } from './OptionsMenu';

interface Props {
  onSelect: (service: ServiceId) => void;
  onOpenNetwork: () => void;
}

/** The top level: pick a service, then its map, then a station. */
export function ServicePicker({ onSelect, onOpenNetwork }: Props) {
  const { t, nameOf } = useI18n();
  const routes: Record<ServiceId, string> = {
    dart: `${nameOf('HOWTH')} · ${nameOf('MHIDE')} – ${nameOf('GSTNS')}`,
    enterprise: t.dublinBelfast,
  };

  return (
    <div className="picker">
      <header className="picker__header">
        <div className="picker__title">
          <h1>Next Train</h1>
          <OptionsMenu />
        </div>
      </header>
      <h2 className="services__heading">{t.chooseService}</h2>
      <ul className="services">
        {(Object.keys(SERVICES) as ServiceId[]).map((id) => (
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
