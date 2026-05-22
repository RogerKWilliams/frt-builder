import { describe, it, expect } from 'vitest';
import { validateFRTTree } from './importJson.ts';
import type { FRTTree } from '../types/frt.ts';

function makeTree(overrides: Partial<FRTTree> = {}): FRTTree {
  return {
    schemaVersion: 1,
    id: 'tree-1',
    title: 'My FRT',
    goal: 'Improve throughput',
    nodes: [],
    edges: [],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('validateFRTTree', () => {
  it('accepts a valid tree with no nodes or edges', () => {
    expect(validateFRTTree(makeTree())).toBe(true);
  });

  it('accepts a valid tree with nodes and edges', () => {
    const tree = makeTree({
      nodes: [
        { id: 'n1', text: 'Injection', type: 'injection', injectionKind: 'core' },
        { id: 'n2', text: 'Effect', type: 'desirable-effect' },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' },
      ],
    });
    expect(validateFRTTree(tree)).toBe(true);
  });

  it('rejects null', () => {
    expect(validateFRTTree(null)).toBe(false);
  });

  it('rejects a string', () => {
    expect(validateFRTTree('not a tree')).toBe(false);
  });

  it('rejects missing required fields', () => {
    expect(validateFRTTree({ id: 'x' })).toBe(false);
    expect(validateFRTTree({ id: 'x', title: 'y' })).toBe(false);
  });

  it('rejects invalid node type', () => {
    const tree = makeTree({
      nodes: [
        { id: 'n1', text: 'Bad', type: 'banana' as never },
      ],
    });
    expect(validateFRTTree(tree)).toBe(false);
  });

  it('rejects invalid injectionKind', () => {
    const tree = makeTree({
      nodes: [
        { id: 'n1', text: 'Injection', type: 'injection', injectionKind: 'mega' as never },
      ],
    });
    expect(validateFRTTree(tree)).toBe(false);
  });

  it('accepts injection without injectionKind (defaults to core)', () => {
    const tree = makeTree({
      nodes: [
        { id: 'n1', text: 'Injection', type: 'injection' },
      ],
    });
    expect(validateFRTTree(tree)).toBe(true);
  });

  it('rejects edge referencing non-existent node', () => {
    const tree = makeTree({
      nodes: [
        { id: 'n1', text: 'A', type: 'entity' },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n999' },
      ],
    });
    expect(validateFRTTree(tree)).toBe(false);
  });

  it('rejects junction with only 1 edge', () => {
    const tree = makeTree({
      nodes: [
        { id: 'n1', text: 'A', type: 'entity' },
        { id: 'n2', text: 'B', type: 'entity' },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', junctionId: 'j1' },
      ],
    });
    expect(validateFRTTree(tree)).toBe(false);
  });

  it('accepts junction with 2 edges', () => {
    const tree = makeTree({
      nodes: [
        { id: 'n1', text: 'A', type: 'entity' },
        { id: 'n2', text: 'B', type: 'entity' },
        { id: 'n3', text: 'C', type: 'entity' },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n3', junctionId: 'j1' },
        { id: 'e2', source: 'n2', target: 'n3', junctionId: 'j1' },
      ],
    });
    expect(validateFRTTree(tree)).toBe(true);
  });

  it('accepts a tree with no schemaVersion (back-compat for pre-versioning data)', () => {
    const tree = makeTree();
    delete (tree as Partial<FRTTree>).schemaVersion;
    expect(validateFRTTree(tree)).toBe(true);
  });

  it('rejects a tree with a future schemaVersion', () => {
    const tree = makeTree();
    (tree as Record<string, unknown>).schemaVersion = 2;
    expect(validateFRTTree(tree)).toBe(false);
  });

  it('rejects a tree with non-numeric schemaVersion', () => {
    const tree = makeTree();
    (tree as Record<string, unknown>).schemaVersion = '1';
    expect(validateFRTTree(tree)).toBe(false);
  });
});
