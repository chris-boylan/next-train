import { describe, expect, it } from 'vitest';
import { NETWORK_EDGES } from '../src/maps/data/network.data';
import { layoutNetwork } from '../src/maps/networkLayout';

describe('layoutNetwork', () => {
  it('puts a simple line in one column and a branch one column over', () => {
    const layout = layoutNetwork(
      [
        ['A', 'B'],
        ['B', 'C'],
        ['C', 'D'],
        ['B', 'X'],
      ],
      'A',
    );
    expect(layout.stations.map((s) => `${s.code}${s.col}`)).toEqual(['A0', 'B0', 'X1', 'C0', 'D0']);
    expect(layout.columns).toBe(2);
    expect(layout.links).toEqual([]);
  });

  it('reports track that closes a loop as a link, not a line', () => {
    const layout = layoutNetwork(
      [
        ['A', 'B'],
        ['B', 'C'],
        ['C', 'A'],
      ],
      'A',
    );
    expect(layout.segments).toHaveLength(2);
    expect(layout.links).toHaveLength(1);
  });

  it('places every connected station once and fits a phone width on the real network', () => {
    const layout = layoutNetwork(NETWORK_EDGES, 'CNLLY');
    const connected = new Set(NETWORK_EDGES.flat());
    expect(layout.stations).toHaveLength(connected.size);
    expect(new Set(layout.stations.map((s) => s.code)).size).toBe(connected.size);
    expect(layout.columns).toBeLessThanOrEqual(7);
  });
});

describe('Dublin commuter preview schematic', () => {
  it('places every commuter station', async () => {
    const { COMMUTER_ROUTE_MAP } = await import('../src/maps/data/commuterRoutes');
    const { COMMUTER_SCHEMATIC } = await import('../src/maps/data/commuterSchematic');
    const missing = [...new Set(COMMUTER_ROUTE_MAP.allEdges.flat())].filter((code) => !COMMUTER_SCHEMATIC.points[code]);
    expect(missing).toEqual([]);
  });
});
