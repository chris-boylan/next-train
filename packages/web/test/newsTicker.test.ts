import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NewsTicker, type TickerItem } from '../src/components/NewsTicker';

const red: TickerItem = { key: 'red', label: 'Red Line', colour: '#c8102e', message: 'No service Red Cow – Tallaght / Saggart. See news.' };
const green: TickerItem = { key: 'green', label: 'Green Line', colour: '#00843d', message: 'Green Line services operating with delays' };
const render = (items: TickerItem[]) => renderToStaticMarkup(createElement(NewsTicker, { items, href: 'https://www.luas.ie/travel-update/' }));
const seconds = (html: string) => Number(html.match(/--ticker-duration:([\d.]+)s/)?.[1]);

describe('the news ticker', () => {
  it('shows nothing when there is no news', () => {
    expect(render([])).toBe('');
  });

  it("scrolls each line's label, in its colour, and message, twice over so the loop runs on seamlessly", () => {
    const html = render([red, green]);
    expect(html.match(/class="ticker__run"/g)).toHaveLength(2);
    // Two lines' news in each of the two copies.
    expect(html.match(/class="ticker__item"/g)).toHaveLength(4);
    expect(html).toContain('background:#c8102e');
    expect(html).toContain('Green Line services operating with delays');
  });

  it('links to the full story in a new tab, and gives screen readers the news once', () => {
    const html = render([red]);
    expect(html).toContain('href="https://www.luas.ie/travel-update/"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('aria-label="Service news: Red Line: No service Red Cow – Tallaght / Saggart. See news.. Travel updates on luas.ie"');
    expect(html).toMatch(/class="ticker__window" aria-hidden="true"/);
  });

  it('takes longer to scroll longer news, so everything reads at the same speed', () => {
    expect(seconds(render([red, green]))).toBeGreaterThan(seconds(render([red])));
    // Never too fast to read, however short.
    expect(seconds(render([{ ...green, message: 'Delays' }]))).toBe(10);
  });
});
