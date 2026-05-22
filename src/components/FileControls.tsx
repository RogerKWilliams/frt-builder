import { useRef } from 'react';
import type { FRTTree } from '../types/frt.ts';
import { exportTreeAsJson } from '../utils/exportJson.ts';
import { importTreeFromFile } from '../utils/importJson.ts';
import { downloadMarkdown } from '../utils/exportMarkdown.ts';

interface FileControlsProps {
  tree: FRTTree;
  lastSaved: string | null;
  onImport: (tree: FRTTree) => void;
  onNew: () => void;
  onSaveNow: () => void;
}

function hasContent(tree: FRTTree): boolean {
  return tree.nodes.length > 0 || tree.edges.length > 0;
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function FileControls({ tree, lastSaved, onImport, onNew, onSaveNow }: FileControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleNew = () => {
    if (hasContent(tree)) {
      if (!window.confirm('Start a new tree? Current work will be cleared.')) return;
    }
    onNew();
  };

  const handleExportJson = () => {
    exportTreeAsJson(tree);
  };

  const handleExportMd = () => {
    downloadMarkdown(tree);
  };

  const handleLoadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be loaded again
    e.target.value = '';

    if (hasContent(tree)) {
      if (!window.confirm('Load a tree from file? Current work will be replaced.')) return;
    }

    const result = await importTreeFromFile(file);
    if (result.ok) {
      onImport(result.tree);
    } else {
      window.alert(result.error);
    }
  };

  return (
    <div className="file-controls">
      <button className="file-btn" onClick={handleNew} title="New tree">New</button>
      <button className="file-btn" onClick={onSaveNow} title="Save now (Ctrl+S)">Save</button>
      <button className="file-btn" onClick={handleLoadClick} title="Load from JSON file">Load</button>
      <button className="file-btn" onClick={handleExportJson} title="Export as JSON">Export JSON</button>
      <button className="file-btn" onClick={handleExportMd} title="Export as Markdown">Export MD</button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      {lastSaved && (
        <span className="last-saved" title={lastSaved}>
          Saved {formatTimestamp(lastSaved)}
        </span>
      )}
    </div>
  );
}
