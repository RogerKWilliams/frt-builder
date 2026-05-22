import { createContext, useContext, useReducer, useEffect, useRef, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { FRTTree, FRTNode, FRTEdge, FRTNodeType } from '../types/frt.ts';
import { validateFRTTree } from '../utils/importJson.ts';

// --- Actions ---

export type TreeAction =
  | { type: 'CREATE_TREE'; payload: { title: string; goal: string } }
  | { type: 'SET_TREE'; payload: { tree: FRTTree } }
  | { type: 'UPDATE_TREE_META'; payload: { title?: string; goal?: string } }
  | { type: 'ADD_NODE'; payload: { nodeType: FRTNodeType; text: string; injectionKind?: 'core' | 'supplementary'; sourceUDEText?: string; addressed?: boolean; position?: { x: number; y: number } } }
  | { type: 'REMOVE_NODE'; payload: { nodeId: string } }
  | { type: 'UPDATE_NODE'; payload: { nodeId: string; updates: Partial<Pick<FRTNode, 'text' | 'type' | 'injectionKind' | 'sourceUDEText' | 'addressed' | 'position' | 'manuallyPositioned'>> } }
  | { type: 'BATCH_ADD_NODES'; payload: { nodes: Array<{ type: FRTNodeType; text: string; injectionKind?: 'core' | 'supplementary'; sourceUDEText?: string; addressed?: boolean }> } }
  | { type: 'ADD_EDGE'; payload: { source: string; target: string; junctionId?: string } }
  | { type: 'REMOVE_EDGE'; payload: { edgeId: string } }
  | { type: 'UPDATE_EDGE'; payload: { edgeId: string; updates: Partial<Pick<FRTEdge, 'junctionId'>> } }
  | { type: 'RESET_MANUAL_POSITIONS' };

// --- Reducer ---

export function treeReducer(state: FRTTree | null, action: TreeAction): FRTTree | null {
  switch (action.type) {
    case 'CREATE_TREE': {
      const now = new Date().toISOString();
      return {
        schemaVersion: 1,
        id: uuidv4(),
        title: action.payload.title,
        goal: action.payload.goal,
        nodes: [],
        edges: [],
        createdAt: now,
        updatedAt: now,
      };
    }

    case 'SET_TREE':
      return action.payload.tree;

    case 'UPDATE_TREE_META': {
      if (!state) return state;
      return {
        ...state,
        ...(action.payload.title !== undefined && { title: action.payload.title }),
        ...(action.payload.goal !== undefined && { goal: action.payload.goal }),
        updatedAt: new Date().toISOString(),
      };
    }

    case 'ADD_NODE': {
      if (!state) return state;
      const newNode: FRTNode = {
        id: uuidv4(),
        type: action.payload.nodeType,
        text: action.payload.text,
        ...(action.payload.injectionKind !== undefined && { injectionKind: action.payload.injectionKind }),
        ...(action.payload.sourceUDEText !== undefined && { sourceUDEText: action.payload.sourceUDEText }),
        ...(action.payload.addressed !== undefined && { addressed: action.payload.addressed }),
        ...(action.payload.position !== undefined && { position: action.payload.position }),
      };
      return {
        ...state,
        nodes: [...state.nodes, newNode],
        updatedAt: new Date().toISOString(),
      };
    }

    case 'BATCH_ADD_NODES': {
      if (!state) return state;
      const newNodes: FRTNode[] = action.payload.nodes.map((n) => ({
        id: uuidv4(),
        type: n.type,
        text: n.text,
        ...(n.injectionKind !== undefined && { injectionKind: n.injectionKind }),
        ...(n.sourceUDEText !== undefined && { sourceUDEText: n.sourceUDEText }),
        ...(n.addressed !== undefined && { addressed: n.addressed }),
      }));
      return {
        ...state,
        nodes: [...state.nodes, ...newNodes],
        updatedAt: new Date().toISOString(),
      };
    }

    case 'REMOVE_NODE': {
      if (!state) return state;
      const { nodeId } = action.payload;
      const remainingEdges = state.edges.filter(
        (e) => e.source !== nodeId && e.target !== nodeId
      );
      const dissolvedEdges = dissolveOrphanedJunctions(remainingEdges);
      return {
        ...state,
        nodes: state.nodes.filter((n) => n.id !== nodeId),
        edges: dissolvedEdges,
        updatedAt: new Date().toISOString(),
      };
    }

    case 'UPDATE_NODE': {
      if (!state) return state;
      return {
        ...state,
        nodes: state.nodes.map((n) =>
          n.id === action.payload.nodeId ? { ...n, ...action.payload.updates } : n
        ),
        updatedAt: new Date().toISOString(),
      };
    }

    case 'ADD_EDGE': {
      if (!state) return state;
      const newEdge: FRTEdge = {
        id: uuidv4(),
        source: action.payload.source,
        target: action.payload.target,
        ...(action.payload.junctionId !== undefined && { junctionId: action.payload.junctionId }),
      };
      return {
        ...state,
        edges: [...state.edges, newEdge],
        updatedAt: new Date().toISOString(),
      };
    }

    case 'REMOVE_EDGE': {
      if (!state) return state;
      const remainingEdges = state.edges.filter((e) => e.id !== action.payload.edgeId);
      const dissolvedEdges = dissolveOrphanedJunctions(remainingEdges);
      return {
        ...state,
        edges: dissolvedEdges,
        updatedAt: new Date().toISOString(),
      };
    }

    case 'RESET_MANUAL_POSITIONS': {
      if (!state) return state;
      return {
        ...state,
        nodes: state.nodes.map((n) => ({ ...n, manuallyPositioned: false })),
        updatedAt: new Date().toISOString(),
      };
    }

    case 'UPDATE_EDGE': {
      if (!state) return state;
      return {
        ...state,
        edges: state.edges.map((e) =>
          e.id === action.payload.edgeId ? { ...e, ...action.payload.updates } : e
        ),
        updatedAt: new Date().toISOString(),
      };
    }

    default:
      return state;
  }
}

/**
 * If a junction has fewer than 2 member edges remaining, clear the junctionId
 * on the remaining edge (it becomes a sufficient cause on its own).
 */
export function dissolveOrphanedJunctions(edges: FRTEdge[]): FRTEdge[] {
  const junctionCounts = new Map<string, number>();
  for (const edge of edges) {
    if (edge.junctionId) {
      junctionCounts.set(edge.junctionId, (junctionCounts.get(edge.junctionId) ?? 0) + 1);
    }
  }
  return edges.map((edge) => {
    if (edge.junctionId && (junctionCounts.get(edge.junctionId) ?? 0) < 2) {
      const { junctionId: _, ...rest } = edge;
      return rest;
    }
    return edge;
  });
}

// --- Persistence helpers ---

const STORAGE_KEY = 'frt-builder-tree';
const TIMESTAMP_KEY = 'frt-builder-last-saved';

export function saveToLocalStorage(tree: FRTTree): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tree));
  localStorage.setItem(TIMESTAMP_KEY, new Date().toISOString());
}

function loadFromLocalStorage(): FRTTree | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!validateFRTTree(parsed)) return null;
    return { ...parsed, schemaVersion: 1 } as FRTTree;
  } catch {
    return null;
  }
}

function getLastSavedTimestamp(): string | null {
  return localStorage.getItem(TIMESTAMP_KEY);
}

function clearLocalStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(TIMESTAMP_KEY);
}

function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  ms: number,
): [(...args: Parameters<T>) => void, () => void] {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  const cancel = () => {
    if (timer) clearTimeout(timer);
  };
  return [debounced, cancel];
}

// --- Context ---

type TreeContextValue = {
  state: FRTTree | null;
  dispatch: React.Dispatch<TreeAction>;
  lastSaved: string | null;
};

const TreeContext = createContext<TreeContextValue | null>(null);

interface TreeProviderProps {
  children: ReactNode;
}

function getInitialState(): FRTTree | null {
  return loadFromLocalStorage();
}

export function TreeProvider({ children }: TreeProviderProps) {
  const [state, dispatch] = useReducer(treeReducer, null, getInitialState);
  const [lastSaved, setLastSaved] = useState<string | null>(getLastSavedTimestamp);

  const debouncedSaveRef = useRef<ReturnType<typeof debounce<(tree: FRTTree) => void>> | null>(null);
  if (!debouncedSaveRef.current) {
    debouncedSaveRef.current = debounce((tree: FRTTree) => {
      saveToLocalStorage(tree);
      setLastSaved(new Date().toISOString());
    }, 2000);
  }

  useEffect(() => {
    if (state) {
      debouncedSaveRef.current![0](state);
    }
    return () => {
      debouncedSaveRef.current![1]();
    };
  }, [state]);

  const wrappedDispatch = useCallback<React.Dispatch<TreeAction>>((action) => {
    if (action.type === 'CREATE_TREE') {
      clearLocalStorage();
      setLastSaved(null);
    }
    dispatch(action);
  }, []);

  return (
    <TreeContext.Provider value={{ state, dispatch: wrappedDispatch, lastSaved }}>
      {children}
    </TreeContext.Provider>
  );
}

export function useTreeStore(): TreeContextValue {
  const ctx = useContext(TreeContext);
  if (!ctx) {
    throw new Error('useTreeStore must be used within a TreeProvider');
  }
  return ctx;
}
