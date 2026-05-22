import type { FRTTree } from '../types/frt.ts';

/**
 * Exports an FRTTree as a downloadable JSON file.
 */
export function exportTreeAsJson(tree: FRTTree): void {
  const versioned: FRTTree = { ...tree, schemaVersion: 1 };
  const json = JSON.stringify(versioned, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const timestamp = new Date().toISOString().slice(0, 10);
  const safeName = tree.title
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
  const filename = `${safeName || 'frt-export'}-frt-${timestamp}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
