import { afterAll, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { TrainCategory } from '@dart-times/core';
import { TrainGlyph } from '../src/components/TrainGlyph';
import { type TrainIcons, useTrainIcons } from '../src/lib/prefs';

const draw = (category: TrainCategory, destinationCode?: string) =>
  renderToStaticMarkup(createElement(TrainGlyph, { train: { category, destinationCode } }));

/** Sets Options → Train icons, as the options menu does (its setter is only reachable through the hook). */
function setTrainIcons(value: TrainIcons) {
  renderToStaticMarkup(
    createElement(() => {
      useTrainIcons()[1](value);
      return null;
    }),
  );
}
afterAll(() => setTrainIcons('colour'));

// Each service's train, and a colour from its livery that only it uses.
const trains: [string, TrainCategory, string | undefined, string][] = [
  ['DART', 'dart', 'BRAY', '#169b62'],
  ['InterCity', 'intercity', 'GALWY', '#a7a9ac'],
  ['Enterprise', 'enterprise', 'BFSTC', '#c9cad3'],
  ['Cork Commuter', 'commuter', 'COBH', '#00573f'],
  ['NI Railways', 'nir', 'NI_COLER', '#1e3f8a'],
  ['Dublin Commuter', 'commuter', 'MYNTH', '#1b7a50'],
];

describe('train icons', () => {
  it('draws each service as its own train, in its livery by default', () => {
    for (const [, category, to, colour] of trains) expect(draw(category, to)).toContain(colour);
    // Every one different.
    expect(new Set(trains.map(([, category, to]) => draw(category, to))).size).toBe(trains.length);
  });

  it('tells Cork Commuter trains from Dublin ones by where they go: only Cork\'s 2600 has the gangway door', () => {
    expect(draw('commuter', 'COBH')).toContain('glyph-door');
    expect(draw('commuter', 'MYNTH')).not.toContain('glyph-door');
  });

  it('keeps the Luas a tram, with its pantograph', () => {
    expect(draw('luas')).toContain('glyph-pantograph');
  });

  it('draws them plain white, black and grey when the option says White: no livery, no yellow, no purple', () => {
    setTrainIcons('white');
    for (const [name, category, to] of trains) {
      const html = draw(category, to);
      expect(html, name).not.toMatch(/glyph-livery|glyph-paint|#ffd400|#5b2a86|glyph-light/);
      expect(html, name).toContain('glyph-outline');
    }
    // Still told apart by shape.
    expect(new Set(trains.filter(([name]) => name !== 'Dublin Commuter').map(([, c, to]) => draw(c, to))).size).toBe(trains.length - 1);
  });
});
