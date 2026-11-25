import { describe, expect, it } from 'vitest';
import type { RequestEnvelope, ResponseEnvelope } from 'ask-sdk-model';
import { FavouritesService, InMemoryFavouritesRepository, IrishRailClient } from '@dart-times/core';
import { fixtureClient } from '../../core/test/fixtures';
import { createSkill } from '../src/skill';
import { stationSlotValue } from '../scripts/build-model';
import { DART_STATIONS } from '@dart-times/core';

function makeSkill(client: IrishRailClient = fixtureClient('connolly-midday.xml')) {
  return createSkill({ client, favourites: new FavouritesService(new InMemoryFavouritesRepository()) }).create();
}

interface SlotInput {
  value: string;
  id?: string;
}

function envelope(request: Record<string, unknown>): RequestEnvelope {
  return {
    version: '1.0',
    session: {
      new: true,
      sessionId: 'session-1',
      application: { applicationId: 'amzn1.ask.skill.test' },
      user: { userId: 'amzn1.ask.account.TEST' },
    },
    context: {
      System: {
        application: { applicationId: 'amzn1.ask.skill.test' },
        user: { userId: 'amzn1.ask.account.TEST' },
        device: { deviceId: 'device-1', supportedInterfaces: {} },
        apiEndpoint: 'https://api.eu.amazonalexa.com',
      },
    },
    request: { requestId: 'req-1', timestamp: new Date().toISOString(), locale: 'en-IE', ...request },
  } as unknown as RequestEnvelope;
}

function intent(name: string, slots: Record<string, SlotInput> = {}) {
  return envelope({
    type: 'IntentRequest',
    intent: {
      name,
      confirmationStatus: 'NONE',
      slots: Object.fromEntries(
        Object.entries(slots).map(([slotName, { value, id }]) => [
          slotName,
          {
            name: slotName,
            value,
            confirmationStatus: 'NONE',
            resolutions: id
              ? {
                  resolutionsPerAuthority: [
                    { authority: 'custom', status: { code: 'ER_SUCCESS_MATCH' }, values: [{ value: { name: value, id } }] },
                  ],
                }
              : undefined,
          },
        ]),
      ),
    },
  });
}

const speech = (res: ResponseEnvelope) => (res.response.outputSpeech as { ssml: string }).ssml;

describe('Alexa skill', () => {
  it('reads the next DARTs from a resolved station slot', async () => {
    const res = await makeSkill().invoke(intent('GetDeparturesIntent', { station: { value: 'connolly', id: 'CNLLY' } }));
    expect(speech(res)).toMatch(/^<speak>The next DARTs from Connolly are to \w+/);
    expect(res.response.shouldEndSession).toBe(true);
  });

  it('falls back to fuzzy matching when the slot did not resolve', async () => {
    const res = await makeSkill().invoke(intent('GetDeparturesIntent', { station: { value: 'connoly' } }));
    expect(speech(res)).toContain('from Connolly');
  });

  it('applies the direction slot', async () => {
    const res = await makeSkill().invoke(
      intent('GetDeparturesIntent', { station: { value: 'connolly', id: 'CNLLY' }, direction: { value: 'south', id: 'Southbound' } }),
    );
    expect(speech(res)).toContain('The next southbound DARTs from Connolly');
  });

  it('asks again for an unknown station and keeps the session open', async () => {
    const res = await makeSkill().invoke(intent('GetDeparturesIntent', { station: { value: 'atlantis' } }));
    expect(speech(res)).toContain("I don't know a DART station called atlantis");
    expect(res.response.shouldEndSession).toBe(false);
  });

  it('says when there are no departures', async () => {
    const skill = makeSkill(fixtureClient('connolly-late-night.xml'));
    const res = await skill.invoke(
      intent('GetDeparturesIntent', { station: { value: 'connolly', id: 'CNLLY' }, direction: { value: 'south', id: 'Southbound' } }),
    );
    expect(speech(res)).toContain('There are no southbound DARTs from Connolly in the next 90 minutes');
  });

  it('saves a favourite and uses it for "when is my next train" and launch', async () => {
    const skill = makeSkill();
    expect(speech(await skill.invoke(intent('FavouriteDeparturesIntent')))).toContain("haven't saved a favourite");

    const added = await skill.invoke(intent('AddFavouriteIntent', { station: { value: 'connolly', id: 'CNLLY' } }));
    expect(speech(added)).toContain('Connolly is in your favourites');

    expect(speech(await skill.invoke(intent('FavouriteDeparturesIntent')))).toContain('from Connolly');
    expect(speech(await skill.invoke(envelope({ type: 'LaunchRequest' })))).toContain('from Connolly');

    const removed = await skill.invoke(intent('RemoveFavouriteIntent', { station: { value: 'connolly', id: 'CNLLY' } }));
    expect(speech(removed)).toContain("removed Connolly");
  });

  it('apologises when Irish Rail is down', async () => {
    const down = new IrishRailClient({ fetch: async () => new Response('', { status: 503 }) });
    const res = await makeSkill(down).invoke(intent('GetDeparturesIntent', { station: { value: 'pearse', id: 'PERSE' } }));
    expect(speech(res)).toContain("couldn't get train times");
  });
});

describe('interaction model', () => {
  it('uses station codes as slot IDs with plain-word synonyms', () => {
    const dl = stationSlotValue(DART_STATIONS.find((s) => s.code === 'DLERY')!);
    expect(dl.id).toBe('DLERY');
    expect(dl.name.value).toBe('Dun Laoghaire');
    expect(dl.name.synonyms).toContain('Dunleary');
    expect(dl.name.synonyms).not.toContain('Dun Laoghaire');
    const connolly = stationSlotValue(DART_STATIONS.find((s) => s.code === 'CNLLY')!);
    expect(connolly.name.synonyms).toContain('Dublin Connolly');
  });
});
