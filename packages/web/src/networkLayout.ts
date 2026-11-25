/**
 * Lays the rail network out as a vertical schematic, in the same style as the line maps.
 *
 * The network is (almost) a tree radiating from Dublin, so it's drawn as one: starting from the root,
 * each station gets its own row. At a junction the branch reaching furthest carries straight on down
 * the same column; shorter branches step one column to the right and are listed first, so the main
 * line runs past them. Width therefore only grows with how deeply branches nest. Track that would
 * close a loop isn't drawn as a line; it's reported as a link to note beside the station.
 */
export interface PlacedStation {
  code: string;
  row: number;
  col: number;
}

export interface Segment {
  from: string;
  to: string;
}

export interface NetworkLayout {
  stations: PlacedStation[];
  /** Track drawn as lines: every parent → child step of the tree. */
  segments: Segment[];
  /** Track closing a loop, shown as a note on the later station of the pair. */
  links: Segment[];
  rows: number;
  columns: number;
}

export function layoutNetwork(edges: [string, string][], root: string): NetworkLayout {
  const neighbours = new Map<string, string[]>();
  for (const [a, b] of edges) {
    neighbours.set(a, [...(neighbours.get(a) ?? []), b]);
    neighbours.set(b, [...(neighbours.get(b) ?? []), a]);
  }

  // Breadth-first from the root: each station hangs off the neighbour nearest the root.
  const parent = new Map<string, string>();
  const children = new Map<string, string[]>();
  const order = [root];
  const seen = new Set([root]);
  for (let i = 0; i < order.length; i++) {
    const code = order[i]!;
    for (const next of [...(neighbours.get(code) ?? [])].sort()) {
      if (seen.has(next)) continue;
      seen.add(next);
      parent.set(next, code);
      children.set(code, [...(children.get(code) ?? []), next]);
      order.push(next);
    }
  }

  // How far each subtree reaches, to decide which branch carries straight on.
  const reach = new Map<string, number>();
  for (const code of [...order].reverse()) {
    reach.set(code, 1 + Math.max(0, ...(children.get(code) ?? []).map((c) => reach.get(c)!)));
  }

  const stations: PlacedStation[] = [];
  const segments: Segment[] = [];
  let row = 0;
  let columns = 1;
  const place = (code: string, col: number) => {
    stations.push({ code, row: row++, col });
    columns = Math.max(columns, col + 1);
    const kids = [...(children.get(code) ?? [])].sort((a, b) => reach.get(a)! - reach.get(b)!);
    const main = kids.pop();
    for (const branch of kids) {
      segments.push({ from: code, to: branch });
      place(branch, col + 1);
    }
    if (main) {
      segments.push({ from: code, to: main });
      place(main, col);
    }
  };
  place(root, 0);

  const rowOf = new Map(stations.map((s) => [s.code, s.row]));
  const links = edges
    .filter(([a, b]) => parent.get(a) !== b && parent.get(b) !== a && rowOf.has(a) && rowOf.has(b))
    .map(([a, b]) => (rowOf.get(a)! > rowOf.get(b)! ? { from: a, to: b } : { from: b, to: a }));

  return { stations, segments, links, rows: row, columns };
}
