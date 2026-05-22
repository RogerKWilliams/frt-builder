import { useEffect, useRef } from 'react';

interface JunctionPromptProps {
  position: { x: number; y: number };
  onChoice: (choice: 'sufficient' | 'and') => void;
  onCancel: () => void;
}

export function JunctionPrompt({ position, onChoice, onCancel }: JunctionPromptProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKey);
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handleClick);
    }, 50);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('mousedown', handleClick);
      clearTimeout(timer);
    };
  }, [onCancel]);

  return (
    <div
      ref={ref}
      className="junction-prompt"
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -100%)',
        zIndex: 1000,
      }}
    >
      <div className="junction-prompt__label">
        This node already has an incoming cause.
      </div>
      <div className="junction-prompt__buttons">
        <button
          className="junction-prompt__btn junction-prompt__btn--sufficient"
          onClick={() => onChoice('sufficient')}
        >
          Sufficient alone
        </button>
        <button
          className="junction-prompt__btn junction-prompt__btn--and"
          onClick={() => onChoice('and')}
        >
          AND with existing
        </button>
      </div>
    </div>
  );
}
