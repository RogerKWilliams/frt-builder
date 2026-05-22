import type { FRTNode, FRTEdge, FRTTree } from '../types/frt.ts';

// --- Graph analysis utilities (extracted from Sidebar.tsx) ---

/**
 * BFS forward from all injection nodes. Returns set of reachable node IDs.
 */
export function findReachableFromInjections(nodes: FRTNode[], edges: FRTEdge[]): Set<string> {
  const adjacency = new Map<string, string[]>();
  for (const e of edges) {
    const targets = adjacency.get(e.source) ?? [];
    targets.push(e.target);
    adjacency.set(e.source, targets);
  }

  const injectionIds = nodes
    .filter((n) => n.type === 'injection')
    .map((n) => n.id);

  const visited = new Set<string>();
  const queue = [...injectionIds];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const neighbor of adjacency.get(current) ?? []) {
      if (!visited.has(neighbor)) {
        queue.push(neighbor);
      }
    }
  }

  return visited;
}

/**
 * Count cycles using DFS back-edge detection.
 */
export function countCycles(nodes: FRTNode[], edges: FRTEdge[]): number {
  const adjacency = new Map<string, string[]>();
  for (const e of edges) {
    const targets = adjacency.get(e.source) ?? [];
    targets.push(e.target);
    adjacency.set(e.source, targets);
  }

  let cycles = 0;
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  for (const n of nodes) color.set(n.id, WHITE);

  function dfs(nodeId: string) {
    color.set(nodeId, GRAY);
    for (const neighbor of adjacency.get(nodeId) ?? []) {
      const c = color.get(neighbor);
      if (c === GRAY) {
        cycles++;
      } else if (c === WHITE) {
        dfs(neighbor);
      }
    }
    color.set(nodeId, BLACK);
  }

  for (const n of nodes) {
    if (color.get(n.id) === WHITE) {
      dfs(n.id);
    }
  }

  return cycles;
}

// --- Validation types ---

export type FlagCategory =
  | 'de_connectivity'
  | 'negatives_addressed'
  | 'reinforcing_loop'
  | 'disconnected_nodes'
  | 'dead_end_injection'
  | 'dead_end_de'
  | 'off_path_entity';

export type ValidationFlag = {
  id: string;
  category: FlagCategory;
  message: string;
  targetId?: string;
};

export type CompletenessBreakdown = {
  deReachable: { score: number; detail: string };
  negativesAddressed: { score: number; detail: string };
  reinforcingLoop: { score: number; detail: string };
  allConnected: { score: number; detail: string };
  overall: number;
};

export type ValidationResult = {
  flags: ValidationFlag[];
  completeness: CompletenessBreakdown;
  stats: {
    nodeCount: number;
    injectionCount: number;
    deCount: number;
    negativeCount: number;
    entityCount: number;
    edgeCount: number;
    junctionCount: number;
    loopCount: number;
  };
};

function truncate(text: string, maxLen = 40): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1).trimEnd() + '\u2026';
}

// --- Validation engine ---

export function validateTree(tree: FRTTree): ValidationResult {
  const { nodes, edges } = tree;
  const flags: ValidationFlag[] = [];

  // Precompute sets
  const des = nodes.filter((n) => n.type === 'desirable-effect');
  const negatives = nodes.filter((n) => n.type === 'negative-effect');
  const injections = nodes.filter((n) => n.type === 'injection');
  const entities = nodes.filter((n) => n.type === 'entity');

  // Forward reachability from injections
  const reachable = findReachableFromInjections(nodes, edges);

  // Reverse adjacency for backward BFS from DEs
  const reverseAdj = new Map<string, string[]>();
  for (const e of edges) {
    const sources = reverseAdj.get(e.target) ?? [];
    sources.push(e.source);
    reverseAdj.set(e.target, sources);
  }

  // Connected node IDs (any edge touches them)
  const connectedIds = new Set<string>();
  for (const e of edges) {
    connectedIds.add(e.source);
    connectedIds.add(e.target);
  }

  // Outgoing/incoming counts
  const outgoing = new Map<string, number>();
  const incoming = new Map<string, number>();
  for (const e of edges) {
    outgoing.set(e.source, (outgoing.get(e.source) ?? 0) + 1);
    incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1);
  }

  // --- Scheinkopf criterion 1: DE connectivity ---
  // For each DE, BFS backward to see if any injection is reachable
  const reachableDEs: string[] = [];
  for (const de of des) {
    const visited = new Set<string>();
    const queue = [de.id];
    let foundInjection = false;
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      const node = nodes.find((n) => n.id === current);
      if (node && node.type === 'injection') {
        foundInjection = true;
        break;
      }
      for (const pred of reverseAdj.get(current) ?? []) {
        if (!visited.has(pred)) queue.push(pred);
      }
    }
    if (foundInjection) {
      reachableDEs.push(de.id);
    } else {
      flags.push({
        id: `de-conn-${de.id}`,
        category: 'de_connectivity',
        message: `"${truncate(de.text)}" is not reachable from any injection`,
        targetId: de.id,
      });
    }
  }

  // --- Scheinkopf criterion 2: Negatives addressed ---
  const addressedCount = negatives.filter((n) => n.addressed).length;
  for (const neg of negatives) {
    if (!neg.addressed) {
      flags.push({
        id: `neg-${neg.id}`,
        category: 'negatives_addressed',
        message: `"${truncate(neg.text)}" has not been marked as addressed`,
        targetId: neg.id,
      });
    }
  }

  // --- Scheinkopf criterion 3: Reinforcing loop ---
  const loopCount = countCycles(nodes, edges);
  if (loopCount === 0 && nodes.length > 0) {
    flags.push({
      id: 'no-loop',
      category: 'reinforcing_loop',
      message: 'No reinforcing loop detected. Scheinkopf recommends at least one.',
    });
  }

  // --- Advisory: disconnected nodes ---
  const disconnected = nodes.filter((n) => !connectedIds.has(n.id));
  if (disconnected.length > 0) {
    flags.push({
      id: 'disconnected',
      category: 'disconnected_nodes',
      message: `${disconnected.length} node${disconnected.length === 1 ? ' is' : 's are'} not connected to anything`,
    });
  }

  // --- Advisory: injections with no outgoing edges ---
  for (const inj of injections) {
    if ((outgoing.get(inj.id) ?? 0) === 0) {
      flags.push({
        id: `dead-inj-${inj.id}`,
        category: 'dead_end_injection',
        message: `"${truncate(inj.text)}" has no outgoing connections`,
        targetId: inj.id,
      });
    }
  }

  // --- Advisory: DEs with no incoming edges ---
  for (const de of des) {
    if ((incoming.get(de.id) ?? 0) === 0) {
      flags.push({
        id: `dead-de-${de.id}`,
        category: 'dead_end_de',
        message: `"${truncate(de.text)}" has no incoming connections`,
        targetId: de.id,
      });
    }
  }

  // --- Advisory: entities not on any path from injection to DE ---
  for (const ent of entities) {
    if (!reachable.has(ent.id)) {
      flags.push({
        id: `off-path-${ent.id}`,
        category: 'off_path_entity',
        message: `"${truncate(ent.text)}" may be disconnected from the main argument`,
        targetId: ent.id,
      });
    }
  }

  // --- Completeness scoring ---
  const deScore = des.length > 0 ? reachableDEs.length / des.length : 0;
  const negScore = negatives.length > 0 ? addressedCount / negatives.length : 1; // N/A credits 100%
  const loopScore = loopCount > 0 ? 1 : 0;
  const connectedScore = nodes.length > 0
    ? nodes.filter((n) => connectedIds.has(n.id)).length / nodes.length
    : 0;

  const overall = Math.round(
    deScore * 35 +
    negScore * 30 +
    loopScore * 20 +
    connectedScore * 15
  );

  const completeness: CompletenessBreakdown = {
    deReachable: {
      score: Math.round(deScore * 100),
      detail: `${reachableDEs.length}/${des.length} DEs reachable`,
    },
    negativesAddressed: {
      score: Math.round(negScore * 100),
      detail: negatives.length > 0
        ? `${addressedCount}/${negatives.length} addressed`
        : 'No negatives (credited)',
    },
    reinforcingLoop: {
      score: Math.round(loopScore * 100),
      detail: loopCount > 0 ? `${loopCount} loop${loopCount !== 1 ? 's' : ''} found` : 'None detected',
    },
    allConnected: {
      score: Math.round(connectedScore * 100),
      detail: `${nodes.filter((n) => connectedIds.has(n.id)).length}/${nodes.length} connected`,
    },
    overall,
  };

  // --- Stats ---
  const junctionIds = new Set(edges.filter((e) => e.junctionId).map((e) => e.junctionId));

  const stats = {
    nodeCount: nodes.length,
    injectionCount: injections.length,
    deCount: des.length,
    negativeCount: negatives.length,
    entityCount: entities.length,
    edgeCount: edges.length,
    junctionCount: junctionIds.size,
    loopCount,
  };

  return { flags, completeness, stats };
}
