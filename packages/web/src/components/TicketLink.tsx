import { type ServiceId, type Station, TRANSLINK_STOPS } from '@dart-times/core';
import { useI18n } from '../lib/i18n';

/** Irish Rail's journey planner, which is also where its tickets are bought (HaCon's HAFAS web app). */
const IRISH_RAIL_PLANNER = 'https://journeyplanner.irishrail.ie/webapp/';
/** Translink's journey planner, in its "Plan and buy" mode. */
const TRANSLINK_PLANNER = 'https://www.translink.co.uk/JourneyPlannerV2';

/** Services whose tickets Irish Rail sells online. Not the DART (Leap or the station's machines) or the Luas. */
const SOLD_BY_IRISH_RAIL: ReadonlySet<ServiceId> = new Set(['commuter', 'intercity', 'enterprise', 'cork']);
/** Services whose stations in Northern Ireland Translink sells for: NI Railways, and the Enterprise's Belfast,
 *  Portadown and Newry. */
const SOLD_BY_TRANSLINK_IN_NI: ReadonlySet<ServiceId> = new Set(['nir', 'enterprise']);

export interface TicketSite {
  href: string;
  site: 'irishrail' | 'translink';
}

/**
 * Where to buy tickets from this station, with "From" filled, or undefined where tickets aren't bought online.
 * - Irish Rail: `?S=<station>` (undocumented, but the planner reads it, and matches our names: "Connolly" → Dublin
 *   Connolly). Irish Rail's own name where we show another (Belfast Grand Central is "Belfast" to Irish Rail).
 * - Translink, for stations in Northern Ireland (NI Railways, and the Enterprise's Belfast, Portadown and Newry):
 *   "Plan and buy" (`isQuickBuy`) with Translink's own ID for the station (translinkStops.data.ts): a name alone
 *   fills the box but selects no station.
 * The daily API check watches both.
 */
export function ticketSite(service: ServiceId, station: Station): TicketSite | undefined {
  const stop = SOLD_BY_TRANSLINK_IN_NI.has(service) ? TRANSLINK_STOPS[station.code] : undefined;
  if (stop) {
    const params = new URLSearchParams({ originId: stop.id, originName: stop.name, originType: 'Train stop', isQuickBuy: 'true' });
    return { site: 'translink', href: `${TRANSLINK_PLANNER}?${params}` };
  }
  if (SOLD_BY_IRISH_RAIL.has(service)) {
    return { site: 'irishrail', href: `${IRISH_RAIL_PLANNER}?S=${encodeURIComponent(station.apiName ?? station.name)}` };
  }
  return undefined;
}

/**
 * A square button like the options cog, bottom right of the station page: a ticket with an arrow out of it, for
 * buying tickets from this station on Irish Rail's or Translink's site (a new tab). The ticket is solid with the
 * arrow cut through it, like the cog's hole.
 */
export function TicketLink({ to }: { to: TicketSite }) {
  const { t } = useI18n();
  const label = t.buyTickets[to.site];
  return (
    <a className="ticket-link" href={to.href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label}>
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
