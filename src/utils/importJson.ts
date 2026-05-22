import type { FRTTree, FRTNodeType } from '../types/frt.ts';

export type ImportResult =
  | { ok: true; tree: FRTTree }
  | { ok: false; error: string };

export type SchemaCheckResult =
  | { ok: true; version: 1 }
  | { ok: false; error: string };

const VALID_NODE_TYPES: FRTNodeType[] = ['injection', 'desirable-effect', 'negative-effect', 'entity'];
const VALID_INJECTION_KINDS = ['core', 'supplementary'];

/**
 * Validates the schemaVersion field. Missing → treated as v1 (back-compat for
 * pre-versioning user data). Present and 1 → accepted. Anything else → rejected.
 */
export function checkSchemaVersion(obj: unknown): SchemaCheckResult {
  if (!obj || typeof obj !== 'object') {
    return { ok: false, error: 'Not a valid object.' };
  }
  const t = obj as Record<string, unknown>;
  if (t.schemaVersion === undefined) return { ok: true, version: 1 };
  if (typeof t.schemaVersion !== 'number') {
    return { ok: false, error: 'schemaVersion must be a number.' };
  }
  if (t.schemaVersion > 1) {
    return {
      ok: false,
      error: 'This file was created with a newer version of the tool. Please update.',
    };
  }
  if (t.schemaVersion < 1) {
    return { ok: false, error: 'schemaVersion must be >= 1.' };
  }
  return { ok: true, version: 1 };
}

/**
 * Validates a parsed object as a valid FRTTree.
 */
export function validateFRTTree(obj: unknown): obj is FRTTree {
  if (!obj || typeof obj !== 'object') return false;
  const t = obj as Record<string, unknown>;

  const schema = checkSchemaVersion(obj);
  if (!schema.ok) return false;

  // Required top-level fields
  if (typeof t.id !== 'string') return false;
  if (typeof t.title !== 'string') return false;
  if (typeof t.goal !== 'string') return false;
  if (typeof t.createdAt !== 'string') return false;
  if (typeof t.updatedAt !== 'string') return false;

  if (!Array.isArray(t.nodes)) return false;
  if (!Array.isArray(t.edges)) return false;

  // Collect node IDs for edge reference validation
  const nodeIds = new Set<string>();

  for (const node of t.nodes) {
    if (!node || typeof node !== 'object') return false;
    const n = node as Record<string, unknown>;
    if (typeof n.id !== 'string') return false;
    if (typeof n.text !== 'string') return false;
    if (typeof n.type !== 'string') return false;
    if (!VALID_NODE_TYPES.includes(n.type as FRTNodeType)) return false;

    // injectionKind validation
    if (n.type === 'injection' && n.injectionKind !== undefined) {
      if (!VALID_INJECTION_KINDS.includes(n.injectionKind as string)) return false;
    }

    nodeIds.add(n.id as string);
  }

  // Junction tracking for consistency check
  const junctionCounts = new Map<string, number>();

  for (const edge of t.edges) {
    if (!edge || typeof edge !== 'object') return false;
    const e = edge as Record<string, unknown>;
    if (typeof e.id !== 'string') return false;
    if (typeof e.source !== 'string') return false;
    if (typeof e.target !== 'string') return false;

    // Edge references must point to existing nodes
    if (!nodeIds.has(e.source as string)) return false;
    if (!nodeIds.has(e.target as string)) return false;

    if (e.junctionId !== undefined && e.junctionId !== null) {
      if (typeof e.junctionId !== 'string') return false;
      junctionCounts.set(e.junctionId as string, (junctionCounts.get(e.junctionId as string) ?? 0) + 1);
    }
  }

  // Every junctionId must appear on at least 2 edges
  for (const [, count] of junctionCounts) {
    if (count < 2) return false;
  }

  return true;
}

/**
 * Reads a File object and parses/validates it as an FRTTree.
 */
export function importTreeFromFile(file: File): Promise<ImportResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        const schema = checkSchemaVersion(parsed);
        if (!schema.ok) {
          resolve({ ok: false, error: schema.error });
          return;
        }
        if (!validateFRTTree(parsed)) {
          resolve({
            ok: false,
            error: 'File does not contain a valid FRT tree. Expected fields: id, title, goal, nodes, edges, createdAt, updatedAt. Check that node types are valid and edge references point to existing nodes.',
          });
          return;
        }
        resolve({ ok: true, tree: { ...parsed, schemaVersion: 1 } as FRTTree });
      } catch {
        resolve({ ok: false, error: 'File is not valid JSON.' });
      }
    };
    reader.onerror = () => {
      resolve({ ok: false, error: 'Failed to read file.' });
    };
    reader.readAsText(file);
  });
}
