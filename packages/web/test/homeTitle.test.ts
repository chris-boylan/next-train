import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HomeTitle } from '../src/components/HomeTitle';

const render = (mode: 'train' | 'tram', slideIn = false) => renderToStaticMarkup(createElement(HomeTitle, { mode, onChange: () => {}, slideIn }));

describe('the home page title', () => {
  it('names the page, and offers the other one, with the current page\'s dot on', () => {
    const trains = render('train');
    expect(trains).toContain('Next Train?');
    expect(trains).toContain('Tram ›');
    expect(trains).toContain('aria-label="Show trams: the Luas"');
    expect(trains).toMatch(/home-title__dot home-title__dot--train home-title__dot--on/);
    expect(trains).not.toMatch(/home-title__dot--tram home-title__dot--on/);

    const trams = render('tram');
    expect(trams).toContain('Next Tram?');
    expect(trams).toContain('‹ Train');
    expect(trams).toContain('aria-label="Show trains"');
    expect(trams).toMatch(/home-title__dot home-title__dot--tram home-title__dot--on/);
  });

  it('slides the title in from its page\'s side only after a switch', () => {
    expect(render('train')).not.toContain('home-title__name--from');
    expect(render('tram', true)).toContain('home-title__name--from-right');
    expect(render('train', true)).toContain('home-title__name--from-left');
  });
});
