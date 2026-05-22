import { graphlib, layout } from '@dagrejs/dagre';
import type { FRTNode, FRTEdge } from '../types/frt.ts';

const NODE_WIDTH = 240;
const NODE_HEIGHT = 80;
const RANK_SEP = 120; // vertical space between ranks — enough for junction ellipses (~40px)
const NODE_SEP = 80;  // horizontal space between nodes in the same rank

/** Staging area: disconnected nodes go here, spread horizontally */
const STAGING_Y = 600;
const STAGING_X_START = 80;
const STAGING_X_GAP = 280;

export interface LayoutResult {
  positions: Map<string, { x: number; y: number }>;
}

/**
 * Run dagre hierarchical layout on the connected portion of the graph.
 * Nodes with manuallyPositioned=true are excluded from layout.
 * Disconnected nodes are placed in a staging grid.
 *
 * Direction: top-to-bottom (injections at bottom in FRT convention,
 * but dagre TB puts sources at top — since FRT edges go source→target
 * with injections as sources, injections land at top of dagre output.
 * We keep TB for consistency with CRT; visual convention is maintained
 * by the tree structure itself).
 *
 * Cycle handling: dagre internally reverses back-edges for ranking,
 * then restores original direction. This means cycles (reinforcing loops)
 * won't crash — they may just route awkwardly.
 */
export function computeLayout(nodes: FRTNode[], edges: FRTEdge[]): LayoutResult {
  const positions = new Map<string, { x: number; y: number }>();

  if (nodes.length === 0) return { positions };

  // Separate manually positioned nodes — they keep their current position
  const autoNodes = nodes.filter((n) => !n.manuallyPositioned);
  const manualNodes = nodes.filter((n) => n.manuallyPositioned);
  for (const n of manualNodes) {
    if (n.position) {
      positions.set(n.id, { x: n.position.x, y: n.position.y });
    }
  }

  if (autoNodes.length === 0) return { positions };

  // Build node set for quick lookup
  const autoNodeIds = new Set(autoNodes.map((n) => n.id));

  // Find which auto-nodes are connected (have at least one edge where both ends are auto-nodes)
  const connectedIds = new Set<string>();
  const layoutEdges: FRTEdge[] = [];
  for (const e of edges) {
    if (autoNodeIds.has(e.source) && autoNodeIds.has(e.target)) {
      connectedIds.add(e.source);
      connectedIds.add(e.target);
      layoutEdges.push(e);
    }
  }

  // Also include auto-nodes that connect to manual nodes (they're part of the graph structure)
  for (const e of edges) {
    if (autoNodeIds.has(e.source) && manualNodes.some((n) => n.id === e.target)) {
      connectedIds.add(e.source);
    }
    if (autoNodeIds.has(e.target) && manualNodes.some((n) => n.id === e.source)) {
      connectedIds.add(e.target);
    }
  }

  const disconnectedNodes = autoNodes.filter((n) => !connectedIds.has(n.id));
  const connectedAutoNodes = autoNodes.filter((n) => connectedIds.has(n.id));

  // Run dagre on connected auto-nodes
  if (connectedAutoNodes.length > 0 && layoutEdges.length > 0) {
    const g = new graphlib.Graph();
    g.setGraph({
      rankdir: 'TB',  // top-to-bottom
      nodesep: NODE_SEP,
      ranksep: RANK_SEP,
      marginx: 40,
      marginy: 40,
    });
    g.setDefaultEdgeLabel(() => ({}));

    for (const n of connectedAutoNodes) {
      g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    }
    for (const e of layoutEdges) {
      g.setEdge(e.source, e.target);
    }

    layout(g);

    for (const n of connectedAutoNodes) {
      const nodeData = g.node(n.id);
      if (nodeData) {
        // dagre returns center coordinates; ReactFlow uses top-left
        positions.set(n.id, {
          x: nodeData.x - NODE_WIDTH / 2,
          y: nodeData.y - NODE_HEIGHT / 2,
        });
      }
    }
  } else if (connectedAutoNodes.length > 0) {
    // Connected nodes but no edges between auto-nodes (all edges go to manual nodes)
    // Treat as disconnected for positioning
    disconnectedNodes.push(...connectedAutoNodes);
  }

  // Place disconnected nodes in a grid that approximates 16:9 aspect ratio
  // Find the bottom of the laid-out graph to place staging below it
  let maxY = 0;
  for (const [, pos] of positions) {
    if (pos.y + NODE_HEIGHT > maxY) maxY = pos.y + NODE_HEIGHT;
  }
  const stagingBaseY = positions.size > 0 ? maxY + RANK_SEP : STAGING_Y;

  if (disconnectedNodes.length > 0) {
    const STAGING_ROW_GAP = RANK_SEP;
    const aspectRatio = 16 / 9;
    const cellWidth = STAGING_X_GAP;
    const cellHeight = NODE_HEIGHT + STAGING_ROW_GAP;
    const cols = Math.max(1, Math.round(
      Math.sqrt(disconnectedNodes.length * aspectRatio * cellHeight / cellWidth)
    ));

    for (let i = 0; i < disconnectedNodes.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      positions.set(disconnectedNodes[i].id, {
        x: STAGING_X_START + col * STAGING_X_GAP,
        y: stagingBaseY + row * (NODE_HEIGHT + STAGING_ROW_GAP),
      });
    }
  }

  return { positions };
}
