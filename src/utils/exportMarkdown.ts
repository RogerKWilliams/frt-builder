import type { FRTTree, FRTNode, FRTEdge } from '../types/frt.ts';

/**
 * Exports an FRTTree as a human-readable Markdown string.
 */
export function exportTreeAsMarkdown(tree: FRTTree): string {
  const lines: string[] = [];

  lines.push(...renderHeader(tree));
  lines.push(...renderInjection(tree));
  lines.push(...renderDesirableEffects(tree));
  lines.push(...renderCausalChains(tree));
  lines.push(...renderNegativeBranches(tree));
  lines.push(...renderReinforcingLoops(tree));
  lines.push(...renderSummary(tree));

  return lines.join('\n');
}

// --- Section renderers ---

function renderHeader(tree: FRTTree): string[] {
  const lines: string[] = [];
  lines.push(`# FRT: ${tree.title}`);
  if (tree.goal) {
    lines.push(`**Goal:** ${tree.goal}`);
  }
  lines.push('');
  return lines;
}

function renderInjection(tree: FRTTree): string[] {
  const coreInjections = tree.nodes.filter(
    (n) => n.type === 'injection' && (n.injectionKind === 'core' || !n.injectionKind)
  );
  if (coreInjections.length === 0) return [];

  const lines: string[] = [];
  lines.push('## Core Injection');
  for (const inj of coreInjections) {
    lines.push(`> ${inj.text}`);
  }
  lines.push('');
  return lines;
}

function renderDesirableEffects(tree: FRTTree): string[] {
  const des = tree.nodes.filter((n) => n.type === 'desirable-effect');
  if (des.length === 0) return [];

  const lines: string[] = [];
  lines.push('## Desirable Effects');
  for (const de of des) {
    if (de.sourceUDEText) {
      lines.push(`- ${de.text} ← from UDE: ${de.sourceUDEText}`);
    } else {
      lines.push(`- ${de.text}`);
    }
  }
  lines.push('');
  return lines;
}

function renderCausalChains(tree: FRTTree): string[] {
  if (tree.edges.length === 0) return [];

  const nodeMap = new Map(tree.nodes.map((n) => [n.id, n]));

  // Build adjacency: source → edges (cause → effect, bottom-up in FRT)
  const childrenOf = new Map<string, FRTEdge[]>();
  const hasParent = new Set<string>();

  for (const edge of tree.edges) {
    const list = childrenOf.get(edge.source) ?? [];
    list.push(edge);
    childrenOf.set(edge.source, list);
    hasParent.add(edge.target);
  }

  // Roots: nodes with outgoing edges but no incoming edges
  const roots = tree.nodes.filter(
    (n) => !hasParent.has(n.id) && (childrenOf.has(n.id))
  );

  if (roots.length === 0) return [];

  const lines: string[] = [];
  lines.push('## Causal Chains');

  const visited = new Set<string>();
  for (const root of roots) {
    const before = lines.length;
    renderChain(root.id, 0, nodeMap, childrenOf, tree.edges, lines, visited);
    if (lines.length === before + 1) {
      // Only the node text was added with no connections — it's rendered in AND junction from another chain
      lines.pop();
      visited.delete(root.id);
    } else {
      lines.push('');
    }
  }

  return lines;
}

function renderChain(
  nodeId: string,
  depth: number,
  nodeMap: Map<string, FRTNode>,
  childrenOf: Map<string, FRTEdge[]>,
  allEdges: FRTEdge[],
  lines: string[],
  visited: Set<string>,
): void {
  if (visited.has(nodeId)) {
    const node = nodeMap.get(nodeId);
    const indent = '  '.repeat(depth);
    lines.push(`${indent}→ ${node?.text ?? nodeId} (reinforcing loop)`);
    return;
  }
  visited.add(nodeId);

  const node = nodeMap.get(nodeId);
  if (!node) return;

  const indent = depth === 0 ? '' : '  '.repeat(depth - 1) + '→ ';
  lines.push(`${indent}${node.text}`);

  const outEdges = childrenOf.get(nodeId) ?? [];

  // Group edges by target
  const targetGroups = new Map<string, FRTEdge[]>();
  for (const edge of outEdges) {
    const list = targetGroups.get(edge.target) ?? [];
    list.push(edge);
    targetGroups.set(edge.target, list);
  }

  for (const [targetId] of targetGroups) {
    // Check if this target has AND junction incoming edges
    const incomingToTarget = allEdges.filter((e) => e.target === targetId);
    const junctionEdges = incomingToTarget.filter((e) => e.junctionId != null);

    // Group junction edges by junctionId
    const junctionGroups = new Map<string, FRTEdge[]>();
    for (const je of junctionEdges) {
      const list = junctionGroups.get(je.junctionId!) ?? [];
      list.push(je);
      junctionGroups.set(je.junctionId!, list);
    }

    // Find if current node is part of an AND junction to this target
    const currentEdgeToTarget = outEdges.find((e) => e.target === targetId);
    if (currentEdgeToTarget?.junctionId) {
      const jGroup = junctionGroups.get(currentEdgeToTarget.junctionId);
      if (jGroup && jGroup.length >= 2) {
        // Only render the AND junction once (when we encounter the first cause)
        const firstCauseId = jGroup.map((e) => e.source).sort()[0];
        if (nodeId === firstCauseId) {
          const causeNames = jGroup
            .map((e) => nodeMap.get(e.source)?.text ?? e.source)
            .join('] + [');
          const jIndent = '  '.repeat(depth);
          lines.push('');
          lines.push(`${jIndent}[${causeNames}] (AND)`);

          renderChain(targetId, depth + 1, nodeMap, childrenOf, allEdges, lines, visited);
        }
        continue;
      }
    }

    // Regular (sufficient cause) edge
    renderChain(targetId, depth + 1, nodeMap, childrenOf, allEdges, lines, visited);
  }
}

function renderNegativeBranches(tree: FRTTree): string[] {
  const negatives = tree.nodes.filter((n) => n.type === 'negative-effect');
  if (negatives.length === 0) return [];

  const lines: string[] = [];
  lines.push('## Negative Branches');

  // Find supplementary injections connected to negatives
  const supplementaryInjections = tree.nodes.filter(
    (n) => n.type === 'injection' && n.injectionKind === 'supplementary'
  );
  // Map: negative node ID → supplementary injections connected to it
  const negativeToInjections = new Map<string, FRTNode[]>();
  for (const inj of supplementaryInjections) {
    // Find edges from this injection targeting the negative (or entities leading to addressed state)
    const outEdges = tree.edges.filter((e) => e.source === inj.id);
    for (const edge of outEdges) {
      const target = tree.nodes.find((n) => n.id === edge.target);
      if (target?.type === 'negative-effect') {
        const list = negativeToInjections.get(target.id) ?? [];
        list.push(inj);
        negativeToInjections.set(target.id, list);
      }
    }
  }

  for (const neg of negatives) {
    const status = neg.addressed ? 'ADDRESSED' : 'UNADDRESSED';
    lines.push(`- **[${status}]** ${neg.text}`);
    const connected = negativeToInjections.get(neg.id) ?? [];
    for (const inj of connected) {
      lines.push(`  - Supplementary injection: ${inj.text}`);
    }
  }
  lines.push('');
  return lines;
}

function renderReinforcingLoops(tree: FRTTree): string[] {
  const loops = detectLoops(tree.nodes, tree.edges);
  if (loops.length === 0) return [];

  const nodeMap = new Map(tree.nodes.map((n) => [n.id, n]));
  const lines: string[] = [];
  lines.push('## Reinforcing Loops');

  for (let i = 0; i < loops.length; i++) {
    const loop = loops[i];
    const nodeNames = loop.map((id) => nodeMap.get(id)?.text ?? id);
    lines.push(`${i + 1}. ${nodeNames.join(' → ')} → ${nodeNames[0]}`);
  }
  lines.push('');
  return lines;
}

/**
 * Detects cycles in the directed graph. Returns arrays of node IDs forming each cycle.
 */
function detectLoops(nodes: FRTNode[], edges: FRTEdge[]): string[][] {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const list = adjacency.get(edge.source) ?? [];
    list.push(edge.target);
    adjacency.set(edge.source, list);
  }

  const loops: string[][] = [];
  const globalVisited = new Set<string>();

  for (const node of nodes) {
    if (globalVisited.has(node.id)) continue;

    const path: string[] = [];
    const pathSet = new Set<string>();
    const stack: Array<{ nodeId: string; childIdx: number }> = [{ nodeId: node.id, childIdx: 0 }];
    const localVisited = new Set<string>();

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const { nodeId } = frame;

      if (!localVisited.has(nodeId)) {
        localVisited.add(nodeId);
        path.push(nodeId);
        pathSet.add(nodeId);
      }

      const children = adjacency.get(nodeId) ?? [];
      let pushed = false;

      while (frame.childIdx < children.length) {
        const child = children[frame.childIdx];
        frame.childIdx++;

        if (pathSet.has(child)) {
          // Found a cycle — extract it
          const cycleStart = path.indexOf(child);
          const cycle = path.slice(cycleStart);
          // Avoid duplicate cycles
          const key = [...cycle].sort().join(',');
          if (!loops.some((l) => [...l].sort().join(',') === key)) {
            loops.push(cycle);
          }
        } else if (!localVisited.has(child)) {
          stack.push({ nodeId: child, childIdx: 0 });
          pushed = true;
          break;
        }
      }

      if (!pushed) {
        stack.pop();
        path.pop();
        pathSet.delete(nodeId);
        globalVisited.add(nodeId);
      }
    }
  }

  return loops;
}

function renderSummary(tree: FRTTree): string[] {
  const injections = tree.nodes.filter((n) => n.type === 'injection');
  const coreInjections = injections.filter((n) => n.injectionKind === 'core' || !n.injectionKind);
  const supplementaryInjections = injections.filter((n) => n.injectionKind === 'supplementary');
  const des = tree.nodes.filter((n) => n.type === 'desirable-effect');
  const negatives = tree.nodes.filter((n) => n.type === 'negative-effect');
  const entities = tree.nodes.filter((n) => n.type === 'entity');
  const addressed = negatives.filter((n) => n.addressed);
  const loops = detectLoops(tree.nodes, tree.edges);

  // Count DEs that have at least one incoming edge
  const targetNodeIds = new Set(tree.edges.map((e) => e.target));
  const connectedDEs = des.filter((n) => targetNodeIds.has(n.id));

  const lines: string[] = [];
  lines.push('## Summary');
  lines.push(`- **Core injections:** ${coreInjections.length}`);
  lines.push(`- **Supplementary injections:** ${supplementaryInjections.length}`);
  lines.push(`- **Desirable effects:** ${des.length} (${connectedDEs.length} connected)`);
  lines.push(`- **Negative effects:** ${negatives.length} (${addressed.length} addressed)`);
  lines.push(`- **Entities:** ${entities.length}`);
  lines.push(`- **Edges:** ${tree.edges.length}`);
  lines.push(`- **Reinforcing loops:** ${loops.length}`);
  lines.push('');
  return lines;
}

/**
 * Triggers a Markdown file download.
 */
export function downloadMarkdown(tree: FRTTree): void {
  const md = exportTreeAsMarkdown(tree);
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);

  const safeName = tree.title
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `${safeName || 'frt'}-${timestamp}.md`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
