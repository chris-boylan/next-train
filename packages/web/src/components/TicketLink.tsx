import type { ServiceId, Station } from '@dart-times/core';
import { useI18n } from '../lib/i18n';

/** Irish Rail's journey planner, which is also where its tickets are bought (HaCon's HAFAS web app). */
const PLANNER_URL = 'https://journeyplanner.irishrail.ie/webapp/';

/**
 * Services whose tickets are bought online. Not the DART (Leap or the station's machines), NI Railways
 * (Translink's) or the Luas (Leap or the stop's machines).
 */
const SOLD_ONLINE: ReadonlySet<ServiceId> = new Set(['commuter', 'intercity', 'enterprise', 'cork']);

export const sellsTicketsOnline = (service: ServiceId) => SOLD_ONLINE.has(service);

/**
 * The planner opened at this station: `?S=` fills "From" (undocumented, but the planner reads it, and matches
 * our names: "Connolly" → Dublin Connolly, "Limerick" → Limerick (Colbert)). Irish Rail's own name for the
 * station where we show another (Belfast Grand Central is "Belfast" to Irish Rail). The daily API check watches it.
 */
export const ticketUrl = (station: Station) => `${PLANNER_URL}?S=${encodeURIComponent(station.apiName ?? station.name)}`;

/**
 * A square button like the options cog, bottom right of the station page: a ticket with an arrow out of it, for
 * buying tickets from this station on irishrail.ie (a new tab). The ticket is solid with the arrow cut through it,
 * like the cog's hole.
 */
export function TicketLink({ station }: { station: Station }) {
  const { t } = useI18n();
  return (
    <a className="ticket-link" href={ticketUrl(station)} target="_blank" rel="noopener noreferrer" aria-label={t.buyTickets} title={t.buyTickets}>
      {/* Framed close round the ticket, so it fills the button as fully as the cog does. */}
      <svg className="ticket-link__icon" viewBox="2 2.5 20 19" aria-hidden>
        <defs>
          <mask id="ticket-link-arrow">
            <rect width="24" height="24" fill="white" />
            <path d="M9.6 14.4 14.4 9.6M10.4 9.6h4v4" fill="none" stroke="black" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
          </mask>
        </defs>
        {/* A ticket: notched halfway down each side. */}
        <path
          d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v2.8a2.2 2.2 0 0 0 0 4.4V17a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 17v-2.8a2.2 2.2 0 0 0 0-4.4V7A1.5 1.5 0 0 1 4 5.5Z"
          mask="url(#ticket-link-arrow)"
        />
      </svg>
    </a>
  );
}
