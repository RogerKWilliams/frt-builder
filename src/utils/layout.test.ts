import { describe, it, expect } from 'vitest';
import { computeLayout } from './layout.ts';
import type { FRTNode, FRTEdge } from '../types/frt.ts';

function makeNode(id: string, overrides?: Partial<FRTNode>): FRTNode {
  return {
    id,
    type: 'entity',
    text: id,
    position: { x: 0, y: 0 },
    ...overrides,
  };
}

describe('computeLayout', () => {
  it('returns empty positions for empty input', () => {
    const { positions } = computeLayout([], []);
    expect(positions.size).toBe(0);
  });

  it('places disconnected nodes in staging area grid', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    const { positions } = computeLayout(nodes, []);

    expect(positions.size).toBe(3);
    for (const pos of positions.values()) {
      expect(pos.x).toBeGreaterThanOrEqual(0);
      expect(pos.y).toBeGreaterThanOrEqual(0);
    }
  });

  it('arranges many disconnected nodes in a grid (not a single row)', () => {
    const nodes = Array.from({ length: 12 }, (_, i) => makeNode(`n${i}`));
    const { positions } = computeLayout(nodes, []);

    expect(positions.size).toBe(12);
    // With 12 nodes the grid should have multiple rows (not all same Y)
    const ys = new Set([...positions.values()].map((p) => p.y));
    expect(ys.size).toBeGreaterThan(1);

    // And multiple columns (not all same X)
    const xs = new Set([...positions.values()].map((p) => p.x));
    expect(xs.size).toBeGreaterThan(1);
  });

  it('arranges connected nodes top-to-bottom (source above target)', () => {
    const nodes = [makeNode('cause'), makeNode('effect')];
    const edges: FRTEdge[] = [
      { id: 'e1', source: 'cause', target: 'effect' },
    ];

    const { positions } = computeLayout(nodes, edges);

    // In TB layout, source is at a lower Y than target
    const causeY = positions.get('cause')!.y;
    const effectY = positions.get('effect')!.y;
    expect(causeY).toBeLessThan(effectY);
  });

  it('skips manually positioned nodes', () => {
    const nodes = [
      makeNode('a', { manuallyPositioned: true, position: { x: 999, y: 888 } }),
      makeNode('b'),
    ];
    const edges: FRTEdge[] = [
      { id: 'e1', source: 'a', target: 'b' },
    ];

    const { positions } = computeLayout(nodes, edges);

    // Manual node keeps its position
    expect(positions.get('a')).toEqual({ x: 999, y: 888 });
    // Auto node gets a computed position
    expect(positions.has('b')).toBe(true);
  });

  it('handles a chain of 3 nodes (TB ordering)', () => {
    const nodes = [makeNode('root'), makeNode('mid'), makeNode('leaf')];
    const edges: FRTEdge[] = [
      { id: 'e1', source: 'root', target: 'mid' },
      { id: 'e2', source: 'mid', target: 'leaf' },
    ];

    const { positions } = computeLayout(nodes, edges);

    const rootY = positions.get('root')!.y;
    const midY = positions.get('mid')!.y;
    const leafY = positions.get('leaf')!.y;

    expect(rootY).toBeLessThan(midY);
    expect(midY).toBeLessThan(leafY);
  });

  it('handles a 3-node cycle without crash or overlapping positions', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')];
    const edges: FRTEdge[] = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'b', target: 'c' },
      { id: 'e3', source: 'c', target: 'a' }, // back-edge forming cycle
    ];

    const { positions } = computeLayout(nodes, edges);

    // All 3 nodes should have positions
    expect(positions.size).toBe(3);

    // No two nodes should overlap (same position)
    const posArray = [...positions.values()];
    for (let i = 0; i < posArray.length; i++) {
      for (let j = i + 1; j < posArray.length; j++) {
        const samePos = posArray[i].x === posArray[j].x && posArray[i].y === posArray[j].y;
        expect(samePos).toBe(false);
      }
    }
  });

  it('places disconnected nodes below the connected graph', () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('orphan')];
    const edges: FRTEdge[] = [
      { id: 'e1', source: 'a', target: 'b' },
    ];

    const { positions } = computeLayout(nodes, edges);

    const maxConnectedY = Math.max(positions.get('a')!.y, positions.get('b')!.y);
    const orphanY = positions.get('orphan')!.y;
    expect(orphanY).toBeGreaterThan(maxConnectedY);
  });
});
