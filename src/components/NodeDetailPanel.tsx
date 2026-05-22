import { useState, useEffect, useRef, useCallback } from 'react';
import { useTreeStore } from '../state/treeStore.tsx';
import type { FRTNode } from '../types/frt.ts';

interface NodeDetailPanelProps {
  nodeId: string;
  onClose: () => void;
}

export function NodeDetailPanel({ nodeId, onClose }: NodeDetailPanelProps) {
  const { state, dispatch } = useTreeStore();
  const node = state?.nodes.find((n) => n.id === nodeId);
  const [draft, setDraft] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync draft when node changes
  useEffect(() => {
    if (node) setDraft(node.text);
  }, [node?.id, node?.text]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus textarea on mount / node switch
  useEffect(() => {
    // Small delay so panel renders before focus
    const t = setTimeout(() => textareaRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [nodeId]);

  const commitText = useCallback(() => {
    if (!node) return;
    const trimmed = draft.trim();
    if (trimmed.length > 0 && trimmed !== node.text) {
      dispatch({ type: 'UPDATE_NODE', payload: { nodeId, updates: { text: trimmed } } });
    }
  }, [draft, node, nodeId, dispatch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commitText();
    }
  };

  const toggleAddressed = useCallback(() => {
    if (!node) return;
    dispatch({
      type: 'UPDATE_NODE',
      payload: { nodeId, updates: { addressed: !node.addressed } },
    });
  }, [node, nodeId, dispatch]);

  if (!node) return null;

  const isEditable = node.type !== 'injection' || node.injectionKind !== 'core';

  return (
    <div className="node-detail-panel">
      <div className="node-detail-panel__header">
        <span className="node-detail-panel__type-label">{typeLabel(node)}</span>
        <button
          className="node-detail-panel__close"
          onClick={onClose}
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>

      {/* Text field — editable for all except core injection */}
      {isEditable ? (
        <textarea
          ref={textareaRef}
          className="node-detail-panel__textarea"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitText}
          onKeyDown={handleKeyDown}
          rows={3}
        />
      ) : (
        <div className="node-detail-panel__readonly">{node.text}</div>
      )}

      {/* DE: sourceUDEText reference */}
      {node.type === 'desirable-effect' && node.sourceUDEText && (
        <div className="node-detail-panel__ude-ref">
          <span className="node-detail-panel__ude-label">Original UDE:</span>{' '}
          <span className="node-detail-panel__ude-text">{node.sourceUDEText}</span>
        </div>
      )}

      {/* Negative effect: addressed toggle */}
      {node.type === 'negative-effect' && (
        <label className="node-detail-panel__toggle">
          <input
            type="checkbox"
            checked={!!node.addressed}
            onChange={toggleAddressed}
          />
          <span>Addressed</span>
        </label>
      )}

      {/* Injection kind note */}
      {node.type === 'injection' && (
        <div className="node-detail-panel__meta">
          {node.injectionKind === 'core' ? 'Core injection — imported from EC' : 'Supplementary injection'}
        </div>
      )}
    </div>
  );
}

function typeLabel(node: FRTNode): string {
  switch (node.type) {
    case 'injection':
      return node.injectionKind === 'supplementary' ? 'Supplementary Injection' : 'Core Injection';
    case 'desirable-effect':
      return 'Desirable Effect';
    case 'negative-effect':
      return 'Negative Effect';
    case 'entity':
      return 'Entity';
  }
}
