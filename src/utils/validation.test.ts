import { describe, it, expect } from 'vitest';
import { validateTree, findReachableFromInjections, countCycles } from './validation.ts';
import type { FRTNode, FRTEdge, FRTTree } from '../types/frt.ts';

function makeNode(id: string, overrides?: Partial<FRTNode>): FRTNode {
  return { id, type: 'entity', text: id, ...overrides };
}

function makeEdge(source: string, target: string, overrides?: Partial<FRTEdge>): FRTEdge {
  return { id: `${source}-${target}`, source, target, ...overrides };
}

function makeTree(nodes: FRTNode[], edges: FRTEdge[]): FRTTree {
  return {
    schemaVersion: 1,
    id: 'test',
    title: 'Test',
    goal: '',
    nodes,
    edges,
    createdAt: '',
    updatedAt: '',
  };
}

describe('findReachableFromInjections', () => {
  it('returns injection IDs plus all downstream nodes', () => {
    const nodes = [
      makeNode('inj', { type: 'injection', injectionKind: 'core' }),
      makeNode('e1'),
      makeNode('de1', { type: 'desirable-effect' }),
    ];
    const edges = [makeEdge('inj', 'e1'), makeEdge('e1', 'de1')];
    const reachable = findReachableFromInjections(nodes, edges);
    expect(reachable).toEqual(new Set(['inj', 'e1', 'de1']));
  });

  it('does not reach nodes with no path from injection', () => {
    const nodes = [
      makeNode('inj', { type: 'injection', injectionKind: 'core' }),
      makeNode('orphan'),
    ];
    const reachable = findReachableFromInjections(nodes, []);
    expect(reachable.has('inj')).toBe(true);
    expect(reachable.has('orphan')).toBe(false);
  });
});

describe('countCycles', () => {
  it('returns 0 for acyclic graph', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const edges = [makeEdge('a', 'b')];
    expect(countCycles(nodes, edges)).toBe(0);
  });

  it('detects a simple cycle', () => {
    const nodes = [makeNode('a'), makeNode('b')];
    const edges = [makeEdge('a', 'b'), makeEdge('b', 'a')];
    expect(countCycles(nodes, edges)).toBeGreaterThan(0);
  });
});

describe('validateTree', () => {
  it('empty tree: no flags, score 30% (negatives N/A credited)', () => {
    const tree = makeTree([], []);
    const result = validateTree(tree);
    // No nodes means no DE/negative/loop flags (nothing to check)
    // But negatives N/A credits 30 points
    expect(result.completeness.overall).toBe(30);
    expect(result.flags.length).toBe(0);
  });

  it('complete tree: no flags, score 100%', () => {
    // injection -> entity -> DE, negative addressed, loop via entity->injection
    const nodes = [
      makeNode('inj', { type: 'injection', injectionKind: 'core' }),
      makeNode('e1'),
      makeNode('de1', { type: 'desirable-effect' }),
      makeNode('neg1', { type: 'negative-effect', addressed: true }),
    ];
    const edges = [
      makeEdge('inj', 'e1'),
      makeEdge('e1', 'de1'),
      makeEdge('e1', 'neg1'),
      makeEdge('neg1', 'inj'), // creates a cycle
    ];
    const result = validateTree(makeTree(nodes, edges));
    expect(result.completeness.overall).toBe(100);
    // No Scheinkopf flags
    const scheinkopfFlags = result.flags.filter(
      (f) => f.category === 'de_connectivity' || f.category === 'negatives_addressed' || f.category === 'reinforcing_loop'
    );
    expect(scheinkopfFlags.length).toBe(0);
  });

  it('missing loop only: loop flag fires, score ~80%', () => {
    const nodes = [
      makeNode('inj', { type: 'injection', injectionKind: 'core' }),
      makeNode('de1', { type: 'desirable-effect' }),
    ];
    const edges = [makeEdge('inj', 'de1')];
    const result = validateTree(makeTree(nodes, edges));
    expect(result.flags.some((f) => f.category === 'reinforcing_loop')).toBe(true);
    // DEs reachable (35) + no negatives credited (30) + no loop (0) + all connected (15) = 80
    expect(result.completeness.overall).toBe(80);
  });

  it('unreachable DE: DE flag fires with correct node reference', () => {
    const nodes = [
      makeNode('inj', { type: 'injection', injectionKind: 'core' }),
      makeNode('de1', { type: 'desirable-effect' }),
      makeNode('de2', { type: 'desirable-effect' }),
    ];
    // Only de1 is connected
    const edges = [makeEdge('inj', 'de1')];
    const result = validateTree(makeTree(nodes, edges));
    const deFlags = result.flags.filter((f) => f.category === 'de_connectivity');
    expect(deFlags.length).toBe(1);
    expect(deFlags[0].targetId).toBe('de2');
  });

  it('unaddressed negative: negative flag fires', () => {
    const nodes = [
      makeNode('inj', { type: 'injection', injectionKind: 'core' }),
      makeNode('de1', { type: 'desirable-effect' }),
      makeNode('neg1', { type: 'negative-effect', addressed: false }),
    ];
    const edges = [makeEdge('inj', 'de1'), makeEdge('inj', 'neg1')];
    const result = validateTree(makeTree(nodes, edges));
    const negFlags = result.flags.filter((f) => f.category === 'negatives_addressed');
    expect(negFlags.length).toBe(1);
    expect(negFlags[0].targetId).toBe('neg1');
  });

  it('mixed: partial subset of flags', () => {
    // 2 DEs: one reachable, one not. 1 negative unaddressed. No loop.
    const nodes = [
      makeNode('inj', { type: 'injection', injectionKind: 'core' }),
      makeNode('de1', { type: 'desirable-effect' }),
      makeNode('de2', { type: 'desirable-effect' }),
      makeNode('neg1', { type: 'negative-effect', addressed: false }),
    ];
    const edges = [makeEdge('inj', 'de1'), makeEdge('inj', 'neg1')];
    const result = validateTree(makeTree(nodes, edges));

    expect(result.flags.some((f) => f.category === 'de_connectivity')).toBe(true);
    expect(result.flags.some((f) => f.category === 'negatives_addressed')).toBe(true);
    expect(result.flags.some((f) => f.category === 'reinforcing_loop')).toBe(true);
  });

  it('completeness scoring: verify weights for partial scenario', () => {
    // 2 DEs, 1 reachable (50% of 35 = 17.5)
    // 1 negative, addressed (100% of 30 = 30)
    // no loop (0% of 20 = 0)
    // 3 of 4 nodes connected (75% of 15 = 11.25)
    // Total: 17.5 + 30 + 0 + 11.25 = 58.75 -> 59
    const nodes = [
      makeNode('inj', { type: 'injection', injectionKind: 'core' }),
      makeNode('de1', { type: 'desirable-effect' }),
      makeNode('de2', { type: 'desirable-effect' }),
      makeNode('neg1', { type: 'negative-effect', addressed: true }),
    ];
    const edges = [makeEdge('inj', 'de1'), makeEdge('inj', 'neg1')];
    const result = validateTree(makeTree(nodes, edges));
    expect(result.completeness.overall).toBe(59);
  });

  it('no negatives exist: negative component scores 100% (N/A credited)', () => {
    const nodes = [
      makeNode('inj', { type: 'injection', injectionKind: 'core' }),
      makeNode('de1', { type: 'desirable-effect' }),
    ];
    const edges = [makeEdge('inj', 'de1')];
    const result = validateTree(makeTree(nodes, edges));
    expect(result.completeness.negativesAddressed.score).toBe(100);
    expect(result.completeness.negativesAddressed.detail).toContain('No negatives');
  });

  it('stats are computed correctly', () => {
    const nodes = [
      makeNode('inj', { type: 'injection', injectionKind: 'core' }),
      makeNode('e1'),
      makeNode('de1', { type: 'desirable-effect' }),
      makeNode('neg1', { type: 'negative-effect', addressed: false }),
    ];
    const edges = [
      makeEdge('inj', 'e1'),
      makeEdge('e1', 'de1'),
      { id: 'e1-neg1', source: 'e1', target: 'neg1', junctionId: 'j1' },
    ];
    const result = validateTree(makeTree(nodes, edges));
    expect(result.stats.nodeCount).toBe(4);
    expect(result.stats.injectionCount).toBe(1);
    expect(result.stats.deCount).toBe(1);
    expect(result.stats.negativeCount).toBe(1);
    expect(result.stats.entityCount).toBe(1);
    expect(result.stats.edgeCount).toBe(3);
    expect(result.stats.junctionCount).toBe(1);
  });
});
