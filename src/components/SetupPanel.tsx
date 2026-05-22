import { useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useTreeStore } from '../state/treeStore.tsx';
import { importCRTFromFile } from '../utils/importCRT.ts';
import { importECFromFile } from '../utils/importEC.ts';
import type { ECImportInjection } from '../utils/importEC.ts';
import type { CRTImportUDE } from '../utils/importCRT.ts';
import { DEEditor } from './DEEditor.tsx';
import type { DEEntry } from './DEEditor.tsx';

interface SetupPanelProps {
  onStartBuilding: () => void;
}

export function SetupPanel({ onStartBuilding }: SetupPanelProps) {
  const { state, dispatch } = useTreeStore();

  // --- Injection state ---
  const [injectionText, setInjectionText] = useState('');
  const [importedInjections, setImportedInjections] = useState<ECImportInjection[]>([]);
  const [selectedInjectionId, setSelectedInjectionId] = useState<string | null>(null);
  const [ecError, setEcError] = useState<string | null>(null);
  const ecFileRef = useRef<HTMLInputElement>(null);

  // --- DE state ---
  const [deEntries, setDeEntries] = useState<DEEntry[]>([]);
  const [importedUDEs, setImportedUDEs] = useState<CRTImportUDE[]>([]);
  const [selectedUDEIds, setSelectedUDEIds] = useState<Set<string>>(new Set());
  const [crtError, setCrtError] = useState<string | null>(null);
  const crtFileRef = useRef<HTMLInputElement>(null);

  // --- Negatives state ---
  const [negativesText, setNegativesText] = useState('');

  // --- Derived ---
  const selectedInjection = importedInjections.find((i) => i.id === selectedInjectionId);
  const effectiveInjectionText = selectedInjection?.text ?? injectionText;
  const hasInjection = effectiveInjectionText.trim().length > 0;
  const hasDEs = deEntries.some((de) => de.deText.trim().length > 0);
  const canStart = hasInjection && hasDEs;

  // --- EC Import ---
  const handleImportEC = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEcError(null);
    const result = await importECFromFile(file);
    if (!result.ok) {
      setEcError(result.error);
    } else {
      setImportedInjections(result.injections);
      if (result.injections.length === 1) {
        setSelectedInjectionId(result.injections[0].id);
      }
    }
    // Reset file input so same file can be re-imported
    if (ecFileRef.current) ecFileRef.current.value = '';
  };

  const handleSelectInjection = (id: string) => {
    setSelectedInjectionId(id === selectedInjectionId ? null : id);
  };

  // --- CRT Import ---
  const handleImportCRT = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCrtError(null);
    const result = await importCRTFromFile(file);
    if (!result.ok) {
      setCrtError(result.error);
    } else {
      setImportedUDEs(result.udes);
      setSelectedUDEIds(new Set());
    }
    if (crtFileRef.current) crtFileRef.current.value = '';
  };

  const handleToggleUDE = (udeId: string) => {
    const next = new Set(selectedUDEIds);
    const ude = importedUDEs.find((u) => u.id === udeId);
    if (!ude) return;

    if (next.has(udeId)) {
      next.delete(udeId);
      // Remove the corresponding DE entry
      setDeEntries((prev) => prev.filter((de) => de.id !== udeId));
    } else {
      next.add(udeId);
      // Add a DE entry pre-filled with UDE text
      setDeEntries((prev) => [
        ...prev,
        { id: udeId, deText: ude.text, sourceUDEText: ude.text },
      ]);
    }
    setSelectedUDEIds(next);
  };

  const handleAddManualDE = () => {
    setDeEntries((prev) => [...prev, { id: uuidv4(), deText: '' }]);
  };

  const handleDEChange = (id: string, deText: string) => {
    setDeEntries((prev) => prev.map((de) => (de.id === id ? { ...de, deText } : de)));
  };

  const handleDERemove = (id: string) => {
    setDeEntries((prev) => prev.filter((de) => de.id !== id));
    setSelectedUDEIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // --- Negatives ---
  const negativeLines = negativesText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // --- Start Building ---
  const handleStartBuilding = () => {
    if (!state || !canStart) return;

    const nodes: Array<{
      type: 'injection' | 'desirable-effect' | 'negative-effect';
      text: string;
      injectionKind?: 'core' | 'supplementary';
      sourceUDEText?: string;
      addressed?: boolean;
    }> = [];

    // Core injection
    nodes.push({
      type: 'injection',
      text: effectiveInjectionText.trim(),
      injectionKind: 'core',
    });

    // DEs
    for (const de of deEntries) {
      if (de.deText.trim().length === 0) continue;
      nodes.push({
        type: 'desirable-effect',
        text: de.deText.trim(),
        ...(de.sourceUDEText ? { sourceUDEText: de.sourceUDEText } : {}),
      });
    }

    // Negatives
    for (const neg of negativeLines) {
      nodes.push({
        type: 'negative-effect',
        text: neg,
        addressed: false,
      });
    }

    dispatch({ type: 'BATCH_ADD_NODES', payload: { nodes } });
    onStartBuilding();
  };

  return (
    <div className="setup-panel">
      {/* --- Injection Section --- */}
      <section className="setup-section">
        <h2>Injection</h2>
        <p className="setup-section__hint">
          The core change you are proposing. Import from an EC analysis or enter manually.
        </p>

        <div className="setup-section__import-row">
          <label className="btn btn--secondary">
            Import from EC
            <input
              ref={ecFileRef}
              type="file"
              accept=".json"
              onChange={handleImportEC}
              hidden
            />
          </label>
        </div>
        {ecError && <p className="setup-error">{ecError}</p>}

        {importedInjections.length > 0 && (
          <div className="injection-list">
            {importedInjections.map((inj) => (
              <label
                key={inj.id}
                className={`injection-option ${selectedInjectionId === inj.id ? 'injection-option--selected' : ''}`}
              >
                <input
                  type="radio"
                  name="injection"
                  checked={selectedInjectionId === inj.id}
                  onChange={() => handleSelectInjection(inj.id)}
                />
                <span className="injection-option__text">{inj.text}</span>
                {inj.targetAssumptionText && (
                  <span className="injection-option__assumption">
                    Challenges: {inj.targetAssumptionText}
                  </span>
                )}
              </label>
            ))}
          </div>
        )}

        {selectedInjection && (
          <div className="injection-card">
            <strong>Core Injection:</strong> {selectedInjection.text}
          </div>
        )}

        {importedInjections.length === 0 && (
          <>
            <p className="setup-section__or">Or enter manually:</p>
            <textarea
              className="setup-textarea"
              placeholder="Describe the core injection..."
              value={injectionText}
              onChange={(e) => setInjectionText(e.target.value)}
              rows={3}
            />
          </>
        )}
        {importedInjections.length > 0 && !selectedInjection && (
          <p className="setup-section__or">Select an injection above, or clear imports to enter manually.</p>
        )}
      </section>

      {/* --- Desirable Effects Section --- */}
      <section className="setup-section">
        <h2>Desirable Effects</h2>
        <p className="setup-section__hint">
          What UDEs should become once the injection takes effect. Import from a CRT or add manually.
        </p>

        <div className="setup-section__import-row">
          <label className="btn btn--secondary">
            Import UDEs from CRT
            <input
              ref={crtFileRef}
              type="file"
              accept=".json"
              onChange={handleImportCRT}
              hidden
            />
          </label>
          <button className="btn btn--secondary" onClick={handleAddManualDE}>
            Add DE manually
          </button>
        </div>
        {crtError && <p className="setup-error">{crtError}</p>}

        {importedUDEs.length > 0 && (
          <div className="ude-checklist">
            <p className="ude-checklist__label">Select UDEs to convert to desirable effects:</p>
            {importedUDEs.map((ude) => (
              <label key={ude.id} className="ude-checklist__item">
                <input
                  type="checkbox"
                  checked={selectedUDEIds.has(ude.id)}
                  onChange={() => handleToggleUDE(ude.id)}
                />
                <span>{ude.text}</span>
              </label>
            ))}
          </div>
        )}

        {deEntries.length > 0 && (
          <div className="de-list">
            {deEntries.map((entry) => (
              <DEEditor
                key={entry.id}
                entry={entry}
                onChange={handleDEChange}
                onRemove={handleDERemove}
              />
            ))}
          </div>
        )}
      </section>

      {/* --- Anticipated Negatives Section --- */}
      <section className="setup-section">
        <h2>Anticipated Negatives</h2>
        <p className="setup-section__hint">
          List negative effects you anticipate from this injection, one per line.
          Think about unintended consequences, resistance, and side effects.
        </p>
        <textarea
          className="setup-textarea"
          placeholder={"Implementation costs may be high\nStaff may resist the change\nShort-term disruption during transition\n..."}
          value={negativesText}
          onChange={(e) => setNegativesText(e.target.value)}
          rows={6}
        />
        {negativeLines.length > 0 && (
          <p className="setup-section__count">
            {negativeLines.length} negative{negativeLines.length === 1 ? '' : 's'} entered
          </p>
        )}
      </section>

      {/* --- Start Building --- */}
      <div className="setup-actions">
        <button
          className="btn btn--primary btn--large"
          onClick={handleStartBuilding}
          disabled={!canStart}
        >
          Start Building
        </button>
        {!canStart && (
          <p className="setup-actions__hint">
            {!hasInjection && 'Enter or import an injection. '}
            {!hasDEs && 'Add at least one desirable effect.'}
          </p>
        )}
      </div>
    </div>
  );
}
