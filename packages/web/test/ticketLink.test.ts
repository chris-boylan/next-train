import { describe, expect, it } from 'vitest';
import { findStationByCode, SERVICES, type ServiceId, TRANSLINK_STOPS } from '@dart-times/core';
import { ticketSite } from '../src/components/TicketLink';

const at = (service: ServiceId, code: string) => ticketSite(service, findStationByCode(code, SERVICES[service].stations)!);

describe('ticket link', () => {
  it("opens Irish Rail's planner with the station as From, by Irish Rail's own name", () => {
    expect(at('intercity', 'CNLLY')).toEqual({ site: 'irishrail', href: 'https://journeyplanner.irishrail.ie/webapp/?S=Dublin%20Connolly' });
    // The Enterprise south of the border is Irish Rail's to sell.
    expect(at('enterprise', 'DDALK')!.site).toBe('irishrail');
    expect(at('enterprise', 'CNLLY')!.site).toBe('irishrail');
  });

  it("sends the Enterprise's Northern Ireland stations to Translink", () => {
    expect(['BFSTC', 'PDOWN', 'NEWRY'].map((code) => at('enterprise', code)?.site)).toEqual(['translink', 'translink', 'translink']);
    expect(new URL(at('enterprise', 'BFSTC')!.href).searchParams.get('originId')).toBe('10000055');
  });

  it("opens Translink's Plan and buy for NI Railways, with Translink's own ID for the station", () => {
    const coleraine = new URL(at('nir', 'NI_COLER')!.href);
    expect(coleraine.origin + coleraine.pathname).toBe('https://www.translink.co.uk/JourneyPlannerV2');
    expect(Object.fromEntries(coleraine.searchParams)).toEqual({
      originId: '10000021',
      originName: 'Coleraine, Coleraine Train Station',
      originType: 'Train stop',
      isQuickBuy: 'true',
    });
  });

  it('knows every NI Railways station on Translink, and calls the city Derry', () => {
    expect(SERVICES.nir.stations.filter((s) => !TRANSLINK_STOPS[s.code]).map((s) => s.code)).toEqual([]);
    expect(Object.values(TRANSLINK_STOPS).filter((s) => /londonderry/i.test(s.name))).toEqual([]);
  });

  it('shows nothing where tickets aren\'t bought online: the DART and the Luas', () => {
    expect(at('dart', 'BRAY')).toBeUndefined();
    expect(ticketSite('luas', findStationByCode('LU_RAN')!)).toBeUndefined();
  });
});
