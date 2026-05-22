import { useState, useRef, useEffect, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { FRTNodeType } from '../types/frt.ts';

interface FRTNodeData {
  label: string;
  nodeType: FRTNodeType;
  injectionKind?: 'core' | 'supplementary';
  addressed?: boolean;
  onTextChange: (id: string, text: string) => void;
  onTypeChange: (id: string, newType: FRTNodeType, injectionKind?: 'core' | 'supplementary') => void;
  onDelete: (id: string) => void;
}

const TYPE_LABELS: Record<string, string> = {
  'injection:core': 'Core Injection',
  'injection:supplementary': 'Supplementary',
  'desirable-effect': 'Desirable Effect',
  'negative-effect': 'Negative Effect',
  'entity': 'Entity',
};

function getTypeLabel(nodeType: FRTNodeType, injectionKind?: 'core' | 'supplementary'): string {
  if (nodeType === 'injection') {
    return TYPE_LABELS[`injection:${injectionKind ?? 'core'}`];
  }
  return TYPE_LABELS[nodeType];
}

const TYPE_ORDER: Array<{ type: FRTNodeType; injectionKind?: 'core' | 'supplementary'; label: string }> = [
  { type: 'injection', injectionKind: 'core', label: 'Core Injection' },
  { type: 'injection', injectionKind: 'supplementary', label: 'Supplementary Injection' },
  { type: 'desirable-effect', label: 'Desirable Effect' },
  { type: 'negative-effect', label: 'Negative Effect' },
  { type: 'entity', label: 'Entity' },
];

export function FRTNodeComponent({ id, data, selected }: NodeProps) {
  const {
    label,
    nodeType,
    injectionKind,
    addressed,
    onTextChange,
    onTypeChange,
    onDelete,
  } = data as unknown as FRTNodeData;

  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(label as string);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [contextMenu]);

  // Auto-focus and auto-size textarea when editing starts
  useEffect(() => {
    if (editing && textareaRef.current) {
      const ta = textareaRef.current;
      ta.focus();
      ta.selectionStart = ta.value.length;
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    }
  }, [editing]);

  const startEditing = useCallback(() => {
    setEditText(label as string);
    setEditing(true);
  }, [label]);

  const commitEdit = useCallback(() => {
    const trimmed = editText.trim();
    if (trimmed.length > 0 && trimmed !== label) {
      onTextChange(id, trimmed);
    }
    setEditing(false);
  }, [editText, label, id, onTextChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commitEdit();
    }
    if (e.key === 'Escape') {
      setEditing(false);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });
  };

  // Build CSS class for node type
  let typeClass = `frt-node--${nodeType}`;
  if (nodeType === 'injection' && injectionKind === 'supplementary') {
    typeClass = 'frt-node--injection-supplementary';
  } else if (nodeType === 'injection') {
    typeClass = 'frt-node--injection-core';
  }
  if (nodeType === 'negative-effect' && addressed) {
    typeClass += ' frt-node--addressed';
  }
  const selectedClass = selected ? 'frt-node--selected' : '';

  // Current type key for filtering context menu options
  const currentKey = nodeType === 'injection' ? `${nodeType}:${injectionKind ?? 'core'}` : nodeType;

  return (
    <div
      className={`frt-node ${typeClass} ${selectedClass}`}
      onDoubleClick={(e) => { e.stopPropagation(); startEditing(); }}
      onContextMenu={handleContextMenu}
    >
      <Handle type="target" position={Position.Top} className="frt-node__handle" />

      <div className="frt-node__type-badge">{getTypeLabel(nodeType, injectionKind)}</div>

      {editing ? (
        <textarea
          ref={textareaRef}
          className="frt-node__editor"
          value={editText}
          onChange={(e) => {
            setEditText(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
          }}
          onKeyDown={handleKeyDown}
          onBlur={commitEdit}
          rows={1}
        />
      ) : (
        <div className="frt-node__text">{label as string}</div>
      )}

      {nodeType === 'negative-effect' && addressed && (
        <div className="frt-node__addressed-badge" title="Addressed">&#10003;</div>
      )}

      <Handle type="source" position={Position.Bottom} className="frt-node__handle" />

      {contextMenu && (
        <div
          className="frt-node__context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {TYPE_ORDER.filter((t) => {
            const key = t.type === 'injection' ? `${t.type}:${t.injectionKind}` : t.type;
            return key !== currentKey;
          }).map((t) => {
            const key = t.type === 'injection' ? `${t.type}:${t.injectionKind}` : t.type;
            return (
              <button
                key={key}
                className="frt-node__context-item"
                onClick={() => { onTypeChange(id, t.type, t.injectionKind); setContextMenu(null); }}
              >
                Change to {t.label}
              </button>
            );
          })}
          <div className="frt-node__context-divider" />
          <button
            className="frt-node__context-item frt-node__context-item--danger"
            onClick={() => { onDelete(id); setContextMenu(null); }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
