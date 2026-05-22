interface LayoutControlsProps {
  onRelayout: () => void;
  onResetLayout: () => void;
  onFitView: () => void;
}

export function LayoutControls({ onRelayout, onResetLayout, onFitView }: LayoutControlsProps) {
  return (
    <div className="layout-controls">
      <button className="layout-controls__btn" onClick={onRelayout} title="Re-layout tree (preserves manually dragged nodes)">
        Re-layout
      </button>
      <button className="layout-controls__btn" onClick={onResetLayout} title="Clear all manual positions and re-layout">
        Reset
      </button>
      <button className="layout-controls__btn" onClick={onFitView} title="Fit all nodes in viewport">
        Fit
      </button>
    </div>
  );
}
