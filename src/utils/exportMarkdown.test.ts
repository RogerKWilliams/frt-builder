import { describe, it, expect } from 'vitest';
import { exportTreeAsMarkdown } from './exportMarkdown.ts';
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

describe('exportTreeAsMarkdown', () => {
  it('includes title and goal', () => {
    const md = exportTreeAsMarkdown(makeTree());
    expect(md).toContain('# FRT: My FRT');
    expect(md).toContain('**Goal:** Improve throughput');
  });

  it('renders core injection section', () => {
    const tree = makeTree({
      nodes: [
        { id: 'inj1', text: 'Implement pull system', type: 'injection', injectionKind: 'core' },
      ],
    });
    const md = exportTreeAsMarkdown(tree);
    expect(md).toContain('## Core Injection');
    expect(md).toContain('> Implement pull system');
  });

  it('renders DE list with sourceUDE reference', () => {
    const tree = makeTree({
      nodes: [
        { id: 'de1', text: 'On-time delivery improves', type: 'desirable-effect', sourceUDEText: 'Late deliveries' },
        { id: 'de2', text: 'Morale increases', type: 'desirable-effect' },
      ],
    });
    const md = exportTreeAsMarkdown(tree);
    expect(md).toContain('## Desirable Effects');
    expect(md).toContain('- On-time delivery improves ← from UDE: Late deliveries');
    expect(md).toContain('- Morale increases');
    // de2 should NOT have UDE reference
    expect(md).not.toContain('Morale increases ←');
  });

  it('renders a simple causal chain', () => {
    const tree = makeTree({
      nodes: [
        { id: 'inj', text: 'Pull system', type: 'injection', injectionKind: 'core' },
        { id: 'ent', text: 'WIP reduced', type: 'entity' },
        { id: 'de', text: 'Faster flow', type: 'desirable-effect' },
      ],
      edges: [
        { id: 'e1', source: 'inj', target: 'ent' },
        { id: 'e2', source: 'ent', target: 'de' },
      ],
    });
    const md = exportTreeAsMarkdown(tree);
    expect(md).toContain('## Causal Chains');
    expect(md).toContain('Pull system');
    expect(md).toContain('→ WIP reduced');
    expect(md).toContain('→ Faster flow');
  });

  it('renders AND junction with + notation', () => {
    const tree = makeTree({
      nodes: [
        { id: 'n1', text: 'Cause A', type: 'entity' },
        { id: 'n2', text: 'Cause B', type: 'entity' },
        { id: 'n3', text: 'Combined Effect', type: 'desirable-effect' },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n3', junctionId: 'j1' },
        { id: 'e2', source: 'n2', target: 'n3', junctionId: 'j1' },
      ],
    });
    const md = exportTreeAsMarkdown(tree);
    expect(md).toContain('(AND)');
    expect(md).toMatch(/Cause A.*\+.*Cause B|Cause B.*\+.*Cause A/);
    expect(md).toContain('→ Combined Effect');
  });

  it('renders cycle guard with reinforcing loop annotation', () => {
    // Root → A → B → C → A (cycle entered from root)
    const tree = makeTree({
      nodes: [
        { id: 'root', text: 'Root', type: 'injection', injectionKind: 'core' },
        { id: 'a', text: 'Node A', type: 'entity' },
        { id: 'b', text: 'Node B', type: 'entity' },
        { id: 'c', text: 'Node C', type: 'entity' },
      ],
      edges: [
        { id: 'e0', source: 'root', target: 'a' },
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'b', target: 'c' },
        { id: 'e3', source: 'c', target: 'a' },
      ],
    });
    const md = exportTreeAsMarkdown(tree);
    expect(md).toContain('(reinforcing loop)');
    // Should NOT infinitely recurse — the cycle guard stops it
    expect(md).toContain('Node A');
    expect(md).toContain('Node B');
    expect(md).toContain('Node C');
  });

  it('renders negative branches with addressed status', () => {
    const tree = makeTree({
      nodes: [
        { id: 'neg1', text: 'Overload risk', type: 'negative-effect', addressed: true },
        { id: 'neg2', text: 'Morale drop', type: 'negative-effect', addressed: false },
      ],
    });
    const md = exportTreeAsMarkdown(tree);
    expect(md).toContain('## Negative Branches');
    expect(md).toContain('**[ADDRESSED]** Overload risk');
    expect(md).toContain('**[UNADDRESSED]** Morale drop');
  });

  it('renders reinforcing loops section', () => {
    const tree = makeTree({
      nodes: [
        { id: 'a', text: 'More sales', type: 'entity' },
        { id: 'b', text: 'More revenue', type: 'entity' },
        { id: 'c', text: 'More investment', type: 'entity' },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'b', target: 'c' },
        { id: 'e3', source: 'c', target: 'a' },
      ],
    });
    const md = exportTreeAsMarkdown(tree);
    expect(md).toContain('## Reinforcing Loops');
    expect(md).toContain('More sales');
    expect(md).toContain('More revenue');
    expect(md).toContain('More investment');
  });

  it('renders summary statistics', () => {
    const tree = makeTree({
      nodes: [
        { id: 'inj', text: 'Inject', type: 'injection', injectionKind: 'core' },
        { id: 'de', text: 'Good', type: 'desirable-effect' },
        { id: 'neg', text: 'Bad', type: 'negative-effect', addressed: true },
        { id: 'ent', text: 'Thing', type: 'entity' },
      ],
      edges: [
        { id: 'e1', source: 'inj', target: 'de' },
      ],
    });
    const md = exportTreeAsMarkdown(tree);
    expect(md).toContain('## Summary');
    expect(md).toContain('**Core injections:** 1');
    expect(md).toContain('**Desirable effects:** 1 (1 connected)');
    expect(md).toContain('**Negative effects:** 1 (1 addressed)');
    expect(md).toContain('**Entities:** 1');
    expect(md).toContain('**Edges:** 1');
  });

  it('omits sections for empty tree', () => {
    const md = exportTreeAsMarkdown(makeTree());
    expect(md).not.toContain('## Core Injection');
    expect(md).not.toContain('## Desirable Effects');
    expect(md).not.toContain('## Causal Chains');
    expect(md).not.toContain('## Negative Branches');
    expect(md).not.toContain('## Reinforcing Loops');
    // Summary should still appear
    expect(md).toContain('## Summary');
  });
});
