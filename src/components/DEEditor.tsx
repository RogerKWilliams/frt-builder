import { useState } from 'react';

export type DEEntry = {
  id: string;
  deText: string;
  sourceUDEText?: string;
};

interface DEEditorProps {
  entry: DEEntry;
  onChange: (id: string, deText: string) => void;
  onRemove: (id: string) => void;
}

export function DEEditor({ entry, onChange, onRemove }: DEEditorProps) {
  const [showOriginal, setShowOriginal] = useState(false);

  const hasSource = !!entry.sourceUDEText;
  const isEdited = hasSource && entry.deText.trim() !== entry.sourceUDEText!.trim() && entry.deText.trim().length > 0;

  return (
    <div className="de-editor">
      {hasSource && !isEdited && (
        <div className="de-editor__ude-ref">
          <span className="de-editor__ude-label">Original UDE:</span>
          <span className="de-editor__ude-text">{entry.sourceUDEText}</span>
        </div>
      )}
      {hasSource && isEdited && (
        <div className="de-editor__ude-collapsed">
          <button
            type="button"
            className="de-editor__show-original"
            onClick={() => setShowOriginal(!showOriginal)}
          >
            {showOriginal ? 'Hide original' : 'Show original UDE'}
          </button>
          {showOriginal && (
            <span className="de-editor__ude-text">{entry.sourceUDEText}</span>
          )}
        </div>
      )}
      <div className="de-editor__row">
        <input
          type="text"
          className="de-editor__input"
          placeholder="Desirable effect text..."
          value={entry.deText}
          onChange={(e) => onChange(entry.id, e.target.value)}
        />
        <button
          type="button"
          className="de-editor__remove"
          onClick={() => onRemove(entry.id)}
          title="Remove"
        >
          &times;
        </button>
      </div>
    </div>
  );
}
