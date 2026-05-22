import { describe, it, expect } from 'vitest';
import { treeReducer, dissolveOrphanedJunctions } from './treeStore.tsx';
import type { FRTTree, FRTEdge } from '../types/frt.ts';

function makeTree(overrides?: Partial<FRTTree>): FRTTree {
  return {
    schemaVersion: 1,
    id: 'tree-1',
    title: 'Test FRT',
    goal: 'Improve throughput',
    nodes: [],
    edges: [],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('treeReducer', () => {
  // --- CREATE_TREE ---
  it('CREATE_TREE returns a new tree with given title and goal', () => {
    const result = treeReducer(null, {
      type: 'CREATE_TREE',
      payload: { title: 'My FRT', goal: 'Eliminate late deliveries' },
    });
    expect(result).not.toBeNull();
    expect(result!.title).toBe('My FRT');
    expect(result!.goal).toBe('Eliminate late deliveries');
    expect(result!.nodes).toHaveLength(0);
    expect(result!.edges).toHaveLength(0);
    expect(result!.id).toBeTruthy();
    expect(result!.createdAt).toBeTruthy();
  });

  // --- SET_TREE ---
  it('SET_TREE replaces state with the provided tree', () => {
    const tree = makeTree({ title: 'Original' });
    const replacement = makeTree({ id: 'tree-2', title: 'Imported' });
    const result = treeReducer(tree, { type: 'SET_TREE', payload: { tree: replacement } });
    expect(result!.id).toBe('tree-2');
    expect(result!.title).toBe('Imported');
  });

  it('SET_TREE works from null state', () => {
    const tree = makeTree();
    const result = treeReducer(null, { type: 'SET_TREE', payload: { tree } });
    expect(result!.id).toBe('tree-1');
  });

  // --- UPDATE_TREE_META ---
  it('UPDATE_TREE_META updates title', () => {
    const tree = makeTree({ title: 'Old Title' });
    const result = treeReducer(tree, {
      type: 'UPDATE_TREE_META',
      payload: { title: 'New Title' },
    });
    expect(result!.title).toBe('New Title');
    expect(result!.goal).toBe('Improve throughput'); // unchanged
    expect(result!.updatedAt).not.toBe(tree.updatedAt);
  });

  it('UPDATE_TREE_META updates goal', () => {
    const tree = makeTree({ goal: 'Old goal' });
    const result = treeReducer(tree, {
      type: 'UPDATE_TREE_META',
      payload: { goal: 'New goal' },
    });
    expect(result!.goal).toBe('New goal');
    expect(result!.title).toBe('Test FRT'); // unchanged
  });

  it('UPDATE_TREE_META updates both title and goal', () => {
    const tree = makeTree();
    const result = treeReducer(tree, {
      type: 'UPDATE_TREE_META',
      payload: { title: 'Updated', goal: 'Updated goal' },
    });
    expect(result!.title).toBe('Updated');
    expect(result!.goal).toBe('Updated goal');
  });

  it('UPDATE_TREE_META on null state returns null', () => {
    const result = treeReducer(null, {
      type: 'UPDATE_TREE_META',
      payload: { title: 'Anything' },
    });
    expect(result).toBeNull();
  });

  // --- ADD_NODE ---
  it('ADD_NODE adds an injection node with injectionKind', () => {
    const tree = makeTree();
    const result = treeReducer(tree, {
      type: 'ADD_NODE',
      payload: { nodeType: 'injection', text: 'Implement drum-buffer-rope', injectionKind: 'core' },
    });
    expect(result!.nodes).toHaveLength(1);
    expect(result!.nodes[0].type).toBe('injection');
    expect(result!.nodes[0].text).toBe('Implement drum-buffer-rope');
    expect(result!.nodes[0].injectionKind).toBe('core');
    expect(result!.nodes[0].id).toBeTruthy();
  });

  it('ADD_NODE adds a DE node with sourceUDEText', () => {
    const tree = makeTree();
    const result = treeReducer(tree, {
      type: 'ADD_NODE',
      payload: { nodeType: 'desirable-effect', text: 'Deliveries are on time', sourceUDEText: 'Deliveries are late' },
    });
    expect(result!.nodes[0].type).toBe('desirable-effect');
    expect(result!.nodes[0].sourceUDEText).toBe('Deliveries are late');
  });

  it('ADD_NODE adds a negative-effect node with addressed flag', () => {
    const tree = makeTree();
    const result = treeReducer(tree, {
      type: 'ADD_NODE',
      payload: { nodeType: 'negative-effect', text: 'Overtime increases', addressed: false },
    });
    expect(result!.nodes[0].type).toBe('negative-effect');
    expect(result!.nodes[0].addressed).toBe(false);
  });

  it('ADD_NODE adds an entity node without optional fields', () => {
    const tree = makeTree();
    const result = treeReducer(tree, {
      type: 'ADD_NODE',
      payload: { nodeType: 'entity', text: 'WIP is reduced' },
    });
    expect(result!.nodes[0].type).toBe('entity');
    expect(result!.nodes[0].injectionKind).toBeUndefined();
    expect(result!.nodes[0].sourceUDEText).toBeUndefined();
    expect(result!.nodes[0].addressed).toBeUndefined();
  });

  it('ADD_NODE with position sets position', () => {
    const tree = makeTree();
    const result = treeReducer(tree, {
      type: 'ADD_NODE',
      payload: { nodeType: 'entity', text: 'A', position: { x: 100, y: 200 } },
    });
    expect(result!.nodes[0].position).toEqual({ x: 100, y: 200 });
  });

  it('ADD_NODE on null state returns null', () => {
    const result = treeReducer(null, {
      type: 'ADD_NODE',
      payload: { nodeType: 'entity', text: 'A' },
    });
    expect(result).toBeNull();
  });

  // --- REMOVE_NODE ---
  it('REMOVE_NODE removes the node and its connected edges', () => {
    const tree = makeTree({
      nodes: [
        { id: 'n1', type: 'injection', text: 'A', injectionKind: 'core' },
        { id: 'n2', type: 'entity', text: 'B' },
        { id: 'n3', type: 'desirable-effect', text: 'C' },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
      ],
    });
    const result = treeReducer(tree, { type: 'REMOVE_NODE', payload: { nodeId: 'n2' } });
    expect(result!.nodes).toHaveLength(2);
    expect(result!.nodes.map((n) => n.id)).toEqual(['n1', 'n3']);
    expect(result!.edges).toHaveLength(0);
  });

  it('REMOVE_NODE dissolves junctions affected by the removed edges', () => {
    const tree = makeTree({
      nodes: [
        { id: 'n1', type: 'entity', text: 'A' },
        { id: 'n2', type: 'entity', text: 'B' },
        { id: 'n3', type: 'desirable-effect', text: 'C' },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n3', junctionId: 'j1' },
        { id: 'e2', source: 'n2', target: 'n3', junctionId: 'j1' },
      ],
    });
    const result = treeReducer(tree, { type: 'REMOVE_NODE', payload: { nodeId: 'n1' } });
    expect(result!.nodes).toHaveLength(2);
    expect(result!.edges).toHaveLength(1);
    expect(result!.edges[0].junctionId).toBeUndefined(); // dissolved
  });

  it('REMOVE_NODE on null state returns null', () => {
    const result = treeReducer(null, { type: 'REMOVE_NODE', payload: { nodeId: 'n1' } });
    expect(result).toBeNull();
  });

  // --- UPDATE_NODE ---
  it('UPDATE_NODE updates text and type-specific fields', () => {
    const tree = makeTree({
      nodes: [
        { id: 'n1', type: 'negative-effect', text: 'Overtime increases', addressed: false },
      ],
    });
    const result = treeReducer(tree, {
      type: 'UPDATE_NODE',
      payload: { nodeId: 'n1', updates: { addressed: true, text: 'Overtime increases (trimmed)' } },
    });
    expect(result!.nodes[0].addressed).toBe(true);
    expect(result!.nodes[0].text).toBe('Overtime increases (trimmed)');
  });

  it('UPDATE_NODE can set manuallyPositioned flag', () => {
    const tree = makeTree({
      nodes: [
        { id: 'n1', type: 'entity', text: 'A', position: { x: 0, y: 0 } },
      ],
    });
    const result = treeReducer(tree, {
      type: 'UPDATE_NODE',
      payload: { nodeId: 'n1', updates: { position: { x: 50, y: 60 }, manuallyPositioned: true } },
    });
    expect(result!.nodes[0].position).toEqual({ x: 50, y: 60 });
    expect(result!.nodes[0].manuallyPositioned).toBe(true);
  });

  it('UPDATE_NODE on null state returns null', () => {
    const result = treeReducer(null, {
      type: 'UPDATE_NODE',
      payload: { nodeId: 'n1', updates: { text: 'X' } },
    });
    expect(result).toBeNull();
  });

  // --- BATCH_ADD_NODES ---
  it('BATCH_ADD_NODES adds multiple heterogeneous nodes', () => {
    const tree = makeTree();
    const result = treeReducer(tree, {
      type: 'BATCH_ADD_NODES',
      payload: {
        nodes: [
          { type: 'injection', text: 'Implement DBR', injectionKind: 'core' },
          { type: 'desirable-effect', text: 'Deliveries on time', sourceUDEText: 'Deliveries late' },
          { type: 'negative-effect', text: 'Overtime may increase', addressed: false },
          { type: 'entity', text: 'WIP reduced' },
        ],
      },
    });
    expect(result!.nodes).toHaveLength(4);
    expect(result!.nodes[0].type).toBe('injection');
    expect(result!.nodes[0].injectionKind).toBe('core');
    expect(result!.nodes[1].sourceUDEText).toBe('Deliveries late');
    expect(result!.nodes[2].addressed).toBe(false);
    expect(result!.nodes[3].injectionKind).toBeUndefined();
    // All IDs unique
    expect(new Set(result!.nodes.map((n) => n.id)).size).toBe(4);
  });

  it('BATCH_ADD_NODES preserves existing nodes', () => {
    const tree = makeTree({
      nodes: [
        { id: 'existing-1', type: 'injection', text: 'Already here', injectionKind: 'core' },
      ],
    });
    const result = treeReducer(tree, {
      type: 'BATCH_ADD_NODES',
      payload: { nodes: [{ type: 'entity', text: 'New entity' }] },
    });
    expect(result!.nodes).toHaveLength(2);
    expect(result!.nodes[0].id).toBe('existing-1');
    expect(result!.nodes[1].text).toBe('New entity');
  });

  it('BATCH_ADD_NODES on null state returns null', () => {
    const result = treeReducer(null, {
      type: 'BATCH_ADD_NODES',
      payload: { nodes: [{ type: 'entity', text: 'A' }] },
    });
    expect(result).toBeNull();
  });

  // --- ADD_EDGE ---
  it('ADD_EDGE creates an edge with optional junctionId', () => {
    const tree = makeTree({
      nodes: [
        { id: 'n1', type: 'entity', text: 'A' },
        { id: 'n2', type: 'desirable-effect', text: 'B' },
      ],
    });
    const result = treeReducer(tree, {
      type: 'ADD_EDGE',
      payload: { source: 'n1', target: 'n2', junctionId: 'j1' },
    });
    expect(result!.edges).toHaveLength(1);
    expect(result!.edges[0].source).toBe('n1');
    expect(result!.edges[0].target).toBe('n2');
    expect(result!.edges[0].junctionId).toBe('j1');
  });

  it('ADD_EDGE without junctionId omits it', () => {
    const tree = makeTree({
      nodes: [
        { id: 'n1', type: 'entity', text: 'A' },
        { id: 'n2', type: 'desirable-effect', text: 'B' },
      ],
    });
    const result = treeReducer(tree, {
      type: 'ADD_EDGE',
      payload: { source: 'n1', target: 'n2' },
    });
    expect(result!.edges[0].junctionId).toBeUndefined();
  });

  it('ADD_EDGE on null state returns null', () => {
    const result = treeReducer(null, {
      type: 'ADD_EDGE',
      payload: { source: 'n1', target: 'n2' },
    });
    expect(result).toBeNull();
  });

  // --- REMOVE_EDGE ---
  it('REMOVE_EDGE removes the edge', () => {
    const tree = makeTree({
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
      ],
    });
    const result = treeReducer(tree, { type: 'REMOVE_EDGE', payload: { edgeId: 'e1' } });
    expect(result!.edges).toHaveLength(1);
    expect(result!.edges[0].id).toBe('e2');
  });

  it('REMOVE_EDGE dissolves a junction when only one member remains', () => {
    const tree = makeTree({
      nodes: [
        { id: 'n1', type: 'entity', text: 'A' },
        { id: 'n2', type: 'entity', text: 'B' },
        { id: 'n3', type: 'desirable-effect', text: 'C' },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n3', junctionId: 'j1' },
        { id: 'e2', source: 'n2', target: 'n3', junctionId: 'j1' },
      ],
    });
    const result = treeReducer(tree, { type: 'REMOVE_EDGE', payload: { edgeId: 'e1' } });
    expect(result!.edges).toHaveLength(1);
    expect(result!.edges[0].id).toBe('e2');
    expect(result!.edges[0].junctionId).toBeUndefined(); // dissolved
  });

  it('REMOVE_EDGE from a 3-member junction preserves junction on remaining 2', () => {
    const tree = makeTree({
      edges: [
        { id: 'e1', source: 'n1', target: 'n4', junctionId: 'j1' },
        { id: 'e2', source: 'n2', target: 'n4', junctionId: 'j1' },
        { id: 'e3', source: 'n3', target: 'n4', junctionId: 'j1' },
      ],
    });
    const result = treeReducer(tree, { type: 'REMOVE_EDGE', payload: { edgeId: 'e1' } });
    expect(result!.edges).toHaveLength(2);
    expect(result!.edges[0].junctionId).toBe('j1');
    expect(result!.edges[1].junctionId).toBe('j1');
  });

  it('REMOVE_EDGE on null state returns null', () => {
    const result = treeReducer(null, { type: 'REMOVE_EDGE', payload: { edgeId: 'e1' } });
    expect(result).toBeNull();
  });

  // --- UPDATE_NODE: addressed toggle ---
  it('UPDATE_NODE toggles addressed from false to true', () => {
    const tree = makeTree({
      nodes: [
        { id: 'n1', type: 'negative-effect', text: 'Overtime increases', addressed: false },
      ],
    });
    const result = treeReducer(tree, {
      type: 'UPDATE_NODE',
      payload: { nodeId: 'n1', updates: { addressed: true } },
    });
    expect(result!.nodes[0].addressed).toBe(true);
  });

  it('UPDATE_NODE toggles addressed from true to false', () => {
    const tree = makeTree({
      nodes: [
        { id: 'n1', type: 'negative-effect', text: 'Overtime increases', addressed: true },
      ],
    });
    const result = treeReducer(tree, {
      type: 'UPDATE_NODE',
      payload: { nodeId: 'n1', updates: { addressed: false } },
    });
    expect(result!.nodes[0].addressed).toBe(false);
  });

  // --- UPDATE_NODE: type change sets/clears type-specific fields ---
  it('UPDATE_NODE changing entity to negative-effect sets addressed false', () => {
    const tree = makeTree({
      nodes: [{ id: 'n1', type: 'entity', text: 'Something' }],
    });
    const result = treeReducer(tree, {
      type: 'UPDATE_NODE',
      payload: { nodeId: 'n1', updates: { type: 'negative-effect', addressed: false } },
    });
    expect(result!.nodes[0].type).toBe('negative-effect');
    expect(result!.nodes[0].addressed).toBe(false);
  });

  it('UPDATE_NODE changing entity to supplementary injection sets injectionKind', () => {
    const tree = makeTree({
      nodes: [{ id: 'n1', type: 'entity', text: 'Something' }],
    });
    const result = treeReducer(tree, {
      type: 'UPDATE_NODE',
      payload: { nodeId: 'n1', updates: { type: 'injection', injectionKind: 'supplementary' } },
    });
    expect(result!.nodes[0].type).toBe('injection');
    expect(result!.nodes[0].injectionKind).toBe('supplementary');
  });

  it('UPDATE_NODE changing negative-effect to entity clears addressed', () => {
    const tree = makeTree({
      nodes: [{ id: 'n1', type: 'negative-effect', text: 'Bad thing', addressed: true }],
    });
    const result = treeReducer(tree, {
      type: 'UPDATE_NODE',
      payload: { nodeId: 'n1', updates: { type: 'entity', addressed: undefined } },
    });
    expect(result!.nodes[0].type).toBe('entity');
    expect(result!.nodes[0].addressed).toBeUndefined();
  });

  // --- RESET_MANUAL_POSITIONS ---
  it('RESET_MANUAL_POSITIONS clears all manuallyPositioned flags', () => {
    const tree = makeTree({
      nodes: [
        { id: 'n1', type: 'entity', text: 'A', position: { x: 10, y: 20 }, manuallyPositioned: true },
        { id: 'n2', type: 'entity', text: 'B', position: { x: 30, y: 40 } },
      ],
    });
    const result = treeReducer(tree, { type: 'RESET_MANUAL_POSITIONS' });
    expect(result!.nodes[0].manuallyPositioned).toBe(false);
    expect(result!.nodes[1].manuallyPositioned).toBe(false);
  });

  // --- UPDATE_EDGE ---
  it('UPDATE_EDGE sets junctionId on an existing edge', () => {
    const tree = makeTree({
      edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
    });
    const result = treeReducer(tree, {
      type: 'UPDATE_EDGE',
      payload: { edgeId: 'e1', updates: { junctionId: 'j1' } },
    });
    expect(result!.edges[0].junctionId).toBe('j1');
  });
});

describe('dissolveOrphanedJunctions', () => {
  it('clears junctionId when only one edge remains in a junction', () => {
    const edges: FRTEdge[] = [
      { id: 'e1', source: 'n1', target: 'n3', junctionId: 'j1' },
    ];
    const result = dissolveOrphanedJunctions(edges);
    expect(result[0].junctionId).toBeUndefined();
  });

  it('preserves junctionId when two or more edges share it', () => {
    const edges: FRTEdge[] = [
      { id: 'e1', source: 'n1', target: 'n3', junctionId: 'j1' },
      { id: 'e2', source: 'n2', target: 'n3', junctionId: 'j1' },
    ];
    const result = dissolveOrphanedJunctions(edges);
    expect(result[0].junctionId).toBe('j1');
    expect(result[1].junctionId).toBe('j1');
  });

  it('handles edges without junctionId', () => {
    const edges: FRTEdge[] = [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
    ];
    const result = dissolveOrphanedJunctions(edges);
    expect(result[0].junctionId).toBeUndefined();
    expect(result[1].junctionId).toBeUndefined();
  });

  it('handles mixed junctioned and non-junctioned edges', () => {
    const edges: FRTEdge[] = [
      { id: 'e1', source: 'n1', target: 'n3', junctionId: 'j1' },
      { id: 'e2', source: 'n2', target: 'n3', junctionId: 'j1' },
      { id: 'e3', source: 'n4', target: 'n5' },
    ];
    const result = dissolveOrphanedJunctions(edges);
    expect(result[0].junctionId).toBe('j1');
    expect(result[1].junctionId).toBe('j1');
    expect(result[2].junctionId).toBeUndefined();
  });
});
