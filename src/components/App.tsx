import { useState, useEffect, useCallback } from 'react';
import { TreeProvider, useTreeStore, saveToLocalStorage } from '../state/treeStore.tsx';
import { SetupPanel } from './SetupPanel.tsx';
import { Canvas } from './Canvas.tsx';
import { Sidebar } from './Sidebar.tsx';
import { FileControls } from './FileControls.tsx';
import { NodeDetailPanel } from './NodeDetailPanel.tsx';
import { ValidationPanel } from './ValidationPanel.tsx';
import type { FRTTree } from '../types/frt.ts';
import '../styles/app.css';

type Phase = 'setup' | 'build';

function AppContent() {
  const { state, dispatch, lastSaved } = useTreeStore();
  const [phase, setPhase] = useState<Phase>('setup');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [validationOpen, setValidationOpen] = useState(false);

  // Auto-create tree on mount if none exists
  useEffect(() => {
    if (!state) {
      dispatch({ type: 'CREATE_TREE', payload: { title: 'Future Reality Tree', goal: '' } });
    }
  }, [state, dispatch]);

  // If restored from localStorage with nodes, go straight to build
  useEffect(() => {
    if (state && state.nodes.length > 0 && phase === 'setup') {
      setPhase('build');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveNow = useCallback(() => {
    if (state) saveToLocalStorage(state);
  }, [state]);

  const handleImport = useCallback((tree: FRTTree) => {
    dispatch({ type: 'SET_TREE', payload: { tree } });
    if (tree.nodes.length > 0) {
      setPhase('build');
    }
  }, [dispatch]);

  const handleNew = useCallback(() => {
    dispatch({ type: 'CREATE_TREE', payload: { title: 'Future Reality Tree', goal: '' } });
    setPhase('setup');
  }, [dispatch]);

  // Global keyboard handler: Ctrl+S save + Escape priority chain
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveNow();
      }
      if (e.key === 'Escape' && phase === 'build') {
        // Priority: close validation panel -> close detail panel -> deselect
        if (validationOpen) {
          setValidationOpen(false);
          e.stopPropagation();
        } else if (selectedNodeId) {
          setSelectedNodeId(null);
          e.stopPropagation();
        }
      }
    };
    window.addEventListener('keydown', handler, true); // capture phase
    return () => window.removeEventListener('keydown', handler, true);
  }, [handleSaveNow, phase, validationOpen, selectedNodeId]);

  if (!state) return null;

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'UPDATE_TREE_META', payload: { title: e.target.value } });
  };

  const handleGoalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'UPDATE_TREE_META', payload: { goal: e.target.value } });
  };

  const handleStartBuilding = () => {
    setPhase('build');
  };

  const handleBackToSetup = () => {
    setPhase('setup');
  };

  const fileControls = (
    <FileControls
      tree={state}
      lastSaved={lastSaved}
      onImport={handleImport}
      onNew={handleNew}
      onSaveNow={handleSaveNow}
    />
  );

  if (phase === 'setup') {
    return (
      <div className="app-layout app-layout--setup">
        <div className="topbar">
          <h1 className="topbar__brand">FRT Builder</h1>
          <input
            className="topbar__input topbar__input--title"
            type="text"
            placeholder="Tree title..."
            value={state.title}
            onChange={handleTitleChange}
          />
          <input
            className="topbar__input topbar__input--goal"
            type="text"
            placeholder="Goal: what should the FRT achieve?"
            value={state.goal}
            onChange={handleGoalChange}
          />
          {fileControls}
        </div>
        <div className="setup-main">
          <SetupPanel onStartBuilding={handleStartBuilding} />
        </div>
      </div>
    );
  }

  // Build phase
  return (
    <div className="app-layout">
      <div className="topbar">
        <h1 className="topbar__brand">FRT Builder</h1>
        <input
          className="topbar__input topbar__input--title"
          type="text"
          placeholder="Tree title..."
          value={state.title}
          onChange={handleTitleChange}
        />
        <input
          className="topbar__input topbar__input--goal"
          type="text"
          placeholder="Goal..."
          value={state.goal}
          onChange={handleGoalChange}
        />
        {fileControls}
        <button className="btn btn--secondary btn--small" onClick={() => setValidationOpen(true)}>
          Validate
        </button>
        <button className="btn btn--secondary btn--small" onClick={handleBackToSetup}>
          Setup
        </button>
      </div>
      <Sidebar selectedNodeId={selectedNodeId} onNodeSelect={setSelectedNodeId} />
      <div className="canvas-area">
        <Canvas selectedNodeId={selectedNodeId} onNodeSelect={setSelectedNodeId} />
        {selectedNodeId && (
          <NodeDetailPanel
            nodeId={selectedNodeId}
            onClose={() => setSelectedNodeId(null)}
          />
        )}
        {validationOpen && (
          <ValidationPanel onClose={() => setValidationOpen(false)} />
        )}
        {state.edges.length === 0 && (
          <div className="canvas-empty-hint">
            Connect nodes by dragging from one handle to another. Right-click canvas to add new nodes.
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <TreeProvider>
      <div className="app-shell">
        <AppContent />
        <footer className="app-disclaimer">
          Personal educational project. Not affiliated with Gartner; views are my own.{' '}
          {/* placeholder REPO_URL — fill in when GitHub repo is published */}
          <a href="<REPO_URL>" target="_blank" rel="noopener noreferrer">
            Source on GitHub →
          </a>
        </footer>
      </div>
    </TreeProvider>
  );
}

export default App;
