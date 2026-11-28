import { describe, expect, it } from 'vitest';
import { findStationByCode, type ServiceId } from '@dart-times/core';
import { sellsTicketsOnline, ticketUrl } from '../src/components/TicketLink';

describe('ticket link', () => {
  it("opens Irish Rail's planner with the station as From, by Irish Rail's own name", () => {
    expect(ticketUrl(findStationByCode('CNLLY')!)).toBe('https://journeyplanner.irishrail.ie/webapp/?S=Dublin%20Connolly');
    // We show "Belfast Grand Central"; Irish Rail calls it Belfast.
    expect(ticketUrl(findStationByCode('BFSTC')!)).toBe('https://journeyplanner.irishrail.ie/webapp/?S=Belfast');
  });

  it('shows only for services whose tickets are bought online', () => {
    expect((['commuter', 'intercity', 'enterprise', 'cork'] as ServiceId[]).every(sellsTicketsOnline)).toBe(true);
    expect((['dart', 'nir', 'luas'] as ServiceId[]).some(sellsTicketsOnline)).toBe(false);
  });
});
