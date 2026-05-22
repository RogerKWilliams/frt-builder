/**
 * Import utility for CRT Builder JSON files.
 * Reads a CRTTree structure and extracts UDE nodes for use as DE sources.
 */

import { checkSchemaVersion } from './importJson.ts';

export type CRTImportUDE = {
  id: string;
  text: string;
};

export type CRTImportResult =
  | { ok: true; treeName: string; udes: CRTImportUDE[] }
  | { ok: false; error: string };

function validateCRTTree(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false;
  const obj = data as Record<string, unknown>;
  if (typeof obj.id !== 'string') return false;
  if (!Array.isArray(obj.nodes)) return false;
  for (const node of obj.nodes) {
    if (typeof node !== 'object' || node === null) return false;
    const n = node as Record<string, unknown>;
    if (typeof n.id !== 'string' || typeof n.text !== 'string' || typeof n.type !== 'string') {
      return false;
    }
  }
  return true;
}

function extractUDEs(data: Record<string, unknown>): CRTImportUDE[] {
  const nodes = data.nodes as Array<Record<string, unknown>>;
  return nodes
    .filter((n) => n.type === 'ude')
    .map((n) => ({ id: n.id as string, text: n.text as string }));
}

export function importCRTFromFile(file: File): Promise<CRTImportResult> {
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
        if (!validateCRTTree(parsed)) {
          resolve({
            ok: false,
            error: 'File does not contain a valid CRT tree. Expected fields: id, nodes (array with id, text, type).',
          });
          return;
        }
        const udes = extractUDEs(parsed);
        if (udes.length === 0) {
          resolve({
            ok: false,
            error: 'CRT file contains no UDE nodes. Make sure the CRT has nodes with type "ude".',
          });
          return;
        }
        resolve({
          ok: true,
          treeName: (parsed.name as string) ?? (parsed.title as string) ?? 'Untitled CRT',
          udes,
        });
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
