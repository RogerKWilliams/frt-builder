import { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  useReactFlow,
  BackgroundVariant,
  MarkerType,
} from '@xyflow/react';
import type { Node, Edge, NodeChange, EdgeChange, Connection, NodeMouseHandler, EdgeMouseHandler } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { v4 as uuidv4 } from 'uuid';
import { useTreeStore } from '../state/treeStore.tsx';
import { FRTNodeComponent } from './FRTNodeComponent.tsx';
import { JunctionEdge } from './JunctionEdge.tsx';
import { JunctionPrompt } from './JunctionPrompt.tsx';
import { LayoutControls } from './LayoutControls.tsx';
import { computeLayout } from '../utils/layout.ts';
import type { FRTNodeType } from '../types/frt.ts';

interface CanvasProps {
  selectedNodeId: string | null;
  onNodeSelect: (nodeId: string | null) => void;
}

const nodeTypes = { frt: FRTNodeComponent };
const edgeTypes = { junction: JunctionEdge };

interface PendingConnection {
  fromNodeId: string;
  toNodeId: string;
  promptPosition: { x: number; y: number };
}

interface CanvasContextMenu {
  position: { x: number; y: number };
  flowPosition: { x: number; y: number };
}

const ELLIPSE_OFFSET_Y = 40;

function CanvasInner({ selectedNodeId, onNodeSelect }: CanvasProps) {
  const { state, dispatch } = useTreeStore();
  const { screenToFlowPosition, flowToScreenPosition, fitView } = useReactFlow();
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [pendingConnection, setPendingConnection] = useState<PendingConnection | null>(null);
  const [edgeContextMenu, setEdgeContextMenu] = useState<{
    edgeId: string;
    position: { x: number; y: number };
  } | null>(null);
  const [canvasContextMenu, setCanvasContextMenu] = useState<CanvasContextMenu | null>(null);

  const initialLayoutApplied = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // --- Node action callbacks ---

  const handleTextChange = useCallback(
    (nodeId: string, text: string) => {
      dispatch({ type: 'UPDATE_NODE', payload: { nodeId, updates: { text } } });
    },
    [dispatch]
  );

  const handleTypeChange = useCallback(
    (nodeId: string, newType: FRTNodeType, injectionKind?: 'core' | 'supplementary') => {
      const updates: Record<string, unknown> = { type: newType };
      if (newType === 'injection') {
        updates.injectionKind = injectionKind ?? 'core';
      } else {
        updates.injectionKind = undefined;
      }
      if (newType === 'negative-effect') {
        updates.addressed = false;
      } else {
        updates.addressed = undefined;
      }
      dispatch({ type: 'UPDATE_NODE', payload: { nodeId, updates } });
    },
    [dispatch]
  );

  const handleDelete = useCallback(
    (nodeId: string) => {
      dispatch({ type: 'REMOVE_NODE', payload: { nodeId } });
      if (selectedNodeId === nodeId) onNodeSelect(null);
    },
    [dispatch, selectedNodeId, onNodeSelect]
  );

  // --- Layout helpers ---

  /** Apply dagre layout positions to the store */
  const applyLayout = useCallback(
    (nodes: NonNullable<typeof state>['nodes'],
     edges: NonNullable<typeof state>['edges']) => {
      const { positions } = computeLayout(nodes, edges);
      for (const [nodeId, pos] of positions) {
        dispatch({
          type: 'UPDATE_NODE',
          payload: { nodeId, updates: { position: pos } },
        });
      }
    },
    [dispatch]
  );

  const handleRelayout = useCallback(() => {
    if (!state) return;
    applyLayout(state.nodes, state.edges);
  }, [state, applyLayout]);

  const handleResetLayout = useCallback(() => {
    if (!state) return;
    dispatch({ type: 'RESET_MANUAL_POSITIONS' });
    // Apply layout after clearing flags — use nodes with cleared flags
    const clearedNodes = state.nodes.map((n) => ({ ...n, manuallyPositioned: false }));
    applyLayout(clearedNodes, state.edges);
  }, [state, dispatch, applyLayout]);

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.1, duration: 200 });
  }, [fitView]);

  // Run initial layout when first entering build mode with nodes
  useEffect(() => {
    if (!state || initialLayoutApplied.current) return;
    if (state.nodes.length > 0) {
      initialLayoutApplied.current = true;
      applyLayout(state.nodes, state.edges);
      // fitView after a frame so React can render the positioned nodes
      requestAnimationFrame(() => {
        fitView({ padding: 0.15, duration: 200 });
      });
    }
  }, [state, applyLayout, fitView]);

  // Smart trigger: auto-layout on edge count change if no manual positioning
  const prevEdgeCount = useRef(state?.edges.length ?? 0);
  useEffect(() => {
    if (!state) return;
    const currentCount = state.edges.length;
    if (currentCount !== prevEdgeCount.current) {
      prevEdgeCount.current = currentCount;
      const hasManual = state.nodes.some((n) => n.manuallyPositioned);
      if (!hasManual) {
        applyLayout(state.nodes, state.edges);
      }
      // Fit all nodes into view after layout settles
      requestAnimationFrame(() => {
        fitView({ padding: 0.15, duration: 200 });
      });
    }
  }, [state, applyLayout, fitView]);

  // --- Convert store → ReactFlow nodes ---

  const rfNodes: Node[] = useMemo(() => {
    if (!state) return [];
    return state.nodes.map((n) => ({
      id: n.id,
      type: 'frt',
      position: n.position ?? { x: 0, y: 0 },
      selected: n.id === selectedNodeId,
      data: {
        label: n.text,
        nodeType: n.type,
        injectionKind: n.injectionKind,
        addressed: n.addressed,
        onTextChange: handleTextChange,
        onTypeChange: handleTypeChange,
        onDelete: handleDelete,
      },
    }));
  }, [state, selectedNodeId, handleTextChange, handleTypeChange, handleDelete]);

  // --- Convert store → ReactFlow edges ---

  const rfEdges: Edge[] = useMemo(() => {
    if (!state) return [];

    const junctionGroups = new Map<string, string[]>();
    for (const e of state.edges) {
      if (e.junctionId) {
        const key = `${e.junctionId}:${e.target}`;
        const group = junctionGroups.get(key) ?? [];
        group.push(e.id);
        junctionGroups.set(key, group);
      }
    }

    const ellipseOwners = new Set<string>();
    for (const group of junctionGroups.values()) {
      const sorted = [...group].sort();
      ellipseOwners.add(sorted[0]);
    }

    return state.edges.map((e) => {
      const targetNode = state.nodes.find((n) => n.id === e.target);
      const targetPos = targetNode?.position;
      const ellipseY = targetPos ? targetPos.y - ELLIPSE_OFFSET_Y : 0;

      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: 'junction',
        selected: e.id === selectedEdgeId,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: 'var(--edge-color)',
          width: 16,
          height: 16,
        },
        style: {
          stroke: 'var(--edge-color)',
          strokeWidth: 2,
        },
        data: {
          junctionId: e.junctionId,
          renderEllipse: ellipseOwners.has(e.id),
          ellipseY,
        },
      };
    });
  }, [state, selectedEdgeId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(rfNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(rfEdges);

  // Keep ReactFlow in sync with store
  useMemo(() => { setNodes(rfNodes); }, [rfNodes]); // eslint-disable-line react-hooks/exhaustive-deps
  useMemo(() => { setEdges(rfEdges); }, [rfEdges]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Position sync on drag end ---

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      for (const change of changes) {
        if (change.type === 'position' && change.dragging === false && change.position) {
          dispatch({
            type: 'UPDATE_NODE',
            payload: {
              nodeId: change.id,
              updates: {
                position: { x: change.position.x, y: change.position.y },
                manuallyPositioned: true,
              },
            },
          });
        }
      }
    },
    [onNodesChange, dispatch]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const filtered = changes.filter((c) => c.type !== 'remove');
      onEdgesChange(filtered);
    },
    [onEdgesChange]
  );

  // --- Edge creation ---

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!state) return;
      const { source, target } = connection;
      if (!source || !target) return;
      if (source === target) return;

      const duplicate = state.edges.some(
        (e) => e.source === source && e.target === target
      );
      if (duplicate) return;

      const existingIncoming = state.edges.filter((e) => e.target === target);

      if (existingIncoming.length === 0) {
        dispatch({
          type: 'ADD_EDGE',
          payload: { source, target },
        });
      } else {
        const targetNode = state.nodes.find((n) => n.id === target);
        if (targetNode) {
          const pos = targetNode.position ?? { x: 0, y: 0 };
          const screenPos = flowToScreenPosition({ x: pos.x + 100, y: pos.y - 20 });
          const canvasEl = containerRef.current;
          if (canvasEl) {
            const rect = canvasEl.getBoundingClientRect();
            setPendingConnection({
              fromNodeId: source,
              toNodeId: target,
              promptPosition: {
                x: screenPos.x - rect.left,
                y: screenPos.y - rect.top,
              },
            });
          }
        }
      }
    },
    [state, dispatch, flowToScreenPosition]
  );

  // --- Junction prompt ---

  const handleJunctionChoice = useCallback(
    (choice: 'sufficient' | 'and') => {
      if (!pendingConnection || !state) return;
      const { fromNodeId, toNodeId } = pendingConnection;

      if (choice === 'sufficient') {
        dispatch({
          type: 'ADD_EDGE',
          payload: { source: fromNodeId, target: toNodeId },
        });
      } else {
        const existingIncoming = state.edges.filter((e) => e.target === toNodeId);
        const existingJunctionId = existingIncoming.find((e) => e.junctionId)?.junctionId;
        const junctionId = existingJunctionId ?? uuidv4();

        for (const edge of existingIncoming) {
          if (edge.junctionId !== junctionId) {
            dispatch({
              type: 'UPDATE_EDGE',
              payload: { edgeId: edge.id, updates: { junctionId } },
            });
          }
        }

        dispatch({
          type: 'ADD_EDGE',
          payload: { source: fromNodeId, target: toNodeId, junctionId },
        });
      }

      setPendingConnection(null);
    },
    [pendingConnection, state, dispatch]
  );

  const handleJunctionCancel = useCallback(() => {
    setPendingConnection(null);
  }, []);

  // --- Edge interaction ---

  const handleEdgeClick: EdgeMouseHandler = useCallback(
    (_event, edge) => {
      setSelectedEdgeId(edge.id);
      setEdgeContextMenu(null);
      setCanvasContextMenu(null);
      onNodeSelect(null);
    },
    [onNodeSelect]
  );

  const handleEdgeContextMenu: EdgeMouseHandler = useCallback(
    (event, edge) => {
      event.preventDefault();
      const canvasEl = containerRef.current;
      if (!canvasEl) return;
      const rect = canvasEl.getBoundingClientRect();
      setEdgeContextMenu({
        edgeId: edge.id,
        position: { x: event.clientX - rect.left, y: event.clientY - rect.top },
      });
      setSelectedEdgeId(edge.id);
      setCanvasContextMenu(null);
      onNodeSelect(null);
    },
    [onNodeSelect]
  );

  // --- Double-click on pane → add entity ---

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('.react-flow__node')) return;
      const onPaneOrBg =
        target.closest('.react-flow__pane') ||
        target.closest('.react-flow__background');
      if (!onPaneOrBg) return;

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      dispatch({
        type: 'ADD_NODE',
        payload: { nodeType: 'entity', text: 'New entity', position },
      });
    };

    el.addEventListener('dblclick', handler);
    return () => el.removeEventListener('dblclick', handler);
  }, [dispatch, screenToFlowPosition]);

  // --- Canvas right-click context menu ---

  const handlePaneContextMenu = useCallback(
    (event: React.MouseEvent) => {
      // Only if clicking on pane/background, not on a node
      const target = event.target as HTMLElement;
      if (target.closest('.react-flow__node')) return;
      const onPaneOrBg =
        target.closest('.react-flow__pane') ||
        target.closest('.react-flow__background');
      if (!onPaneOrBg) return;

      event.preventDefault();
      const canvasEl = containerRef.current;
      if (!canvasEl) return;
      const rect = canvasEl.getBoundingClientRect();
      const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      setCanvasContextMenu({
        position: { x: event.clientX - rect.left, y: event.clientY - rect.top },
        flowPosition: flowPos,
      });
      setEdgeContextMenu(null);
      onNodeSelect(null);
      setSelectedEdgeId(null);
    },
    [screenToFlowPosition, onNodeSelect]
  );

  const addNodeFromContextMenu = useCallback(
    (nodeType: FRTNodeType, injectionKind?: 'core' | 'supplementary') => {
      if (!canvasContextMenu) return;
      const defaultTexts: Record<string, string> = {
        'entity': 'New entity',
        'negative-effect': 'New negative effect',
        'injection': injectionKind === 'supplementary' ? 'New supplementary injection' : 'New injection',
      };
      dispatch({
        type: 'ADD_NODE',
        payload: {
          nodeType,
          text: defaultTexts[nodeType] ?? 'New node',
          position: canvasContextMenu.flowPosition,
          ...(injectionKind && { injectionKind }),
          ...(nodeType === 'negative-effect' && { addressed: false }),
        },
      });
      setCanvasContextMenu(null);
    },
    [canvasContextMenu, dispatch]
  );

  // --- Node / pane click ---

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      onNodeSelect(node.id);
      setSelectedEdgeId(null);
      setEdgeContextMenu(null);
      setCanvasContextMenu(null);
    },
    [onNodeSelect]
  );

  const handlePaneClick = useCallback(() => {
    onNodeSelect(null);
    setSelectedEdgeId(null);
    setEdgeContextMenu(null);
    setCanvasContextMenu(null);
  }, [onNodeSelect]);

  // --- Keyboard ---

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const active = document.activeElement;
      if (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement) return;

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedEdgeId) {
          dispatch({ type: 'REMOVE_EDGE', payload: { edgeId: selectedEdgeId } });
          setSelectedEdgeId(null);
        } else if (selectedNodeId) {
          dispatch({ type: 'REMOVE_NODE', payload: { nodeId: selectedNodeId } });
          onNodeSelect(null);
        }
      }
      if (event.key === 'Escape') {
        onNodeSelect(null);
        setSelectedEdgeId(null);
        setPendingConnection(null);
        setEdgeContextMenu(null);
        setCanvasContextMenu(null);
      }
    },
    [selectedNodeId, selectedEdgeId, dispatch, onNodeSelect]
  );

  return (
    <div
      className="canvas-reactflow"
      ref={containerRef}
      onKeyDown={handleKeyDown}
      onContextMenu={handlePaneContextMenu}
      tabIndex={0}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={handleConnect}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        onEdgeContextMenu={handleEdgeContextMenu}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView={false}
        zoomOnDoubleClick={false}
        deleteKeyCode={null}
        selectionKeyCode={null}
        multiSelectionKeyCode={null}
        panOnScroll={false}
        zoomOnScroll
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e2e8f0" />
        <Controls showInteractive={false} />
      </ReactFlow>

      <LayoutControls
        onRelayout={handleRelayout}
        onResetLayout={handleResetLayout}
        onFitView={handleFitView}
      />

      {pendingConnection && (
        <JunctionPrompt
          position={pendingConnection.promptPosition}
          onChoice={handleJunctionChoice}
          onCancel={handleJunctionCancel}
        />
      )}

      {edgeContextMenu && (
        <div
          className="edge-context-menu"
          style={{
            position: 'absolute',
            left: edgeContextMenu.position.x,
            top: edgeContextMenu.position.y,
          }}
        >
          <button
            className="edge-context-menu__btn"
            onClick={() => {
              dispatch({ type: 'REMOVE_EDGE', payload: { edgeId: edgeContextMenu.edgeId } });
              setSelectedEdgeId(null);
              setEdgeContextMenu(null);
            }}
          >
            Delete edge
          </button>
        </div>
      )}

      {canvasContextMenu && (
        <div
          className="canvas-context-menu"
          style={{
            position: 'absolute',
            left: canvasContextMenu.position.x,
            top: canvasContextMenu.position.y,
          }}
        >
          <button
            className="canvas-context-menu__btn"
            onClick={() => addNodeFromContextMenu('entity')}
          >
            Add Entity
          </button>
          <button
            className="canvas-context-menu__btn"
            onClick={() => addNodeFromContextMenu('negative-effect')}
          >
            Add Negative Effect
          </button>
          <button
            className="canvas-context-menu__btn"
            onClick={() => addNodeFromContextMenu('injection', 'supplementary')}
          >
            Add Supplementary Injection
          </button>
        </div>
      )}
    </div>
  );
}

export function Canvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
