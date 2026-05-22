import { useMemo } from 'react';
import { useTreeStore } from '../state/treeStore.tsx';
import { validateTree } from '../utils/validation.ts';
import type { ValidationFlag, FlagCategory } from '../utils/validation.ts';

interface ValidationPanelProps {
  onClose: () => void;
}

const CATEGORY_LABELS: Record<FlagCategory, string> = {
  de_connectivity: 'DE Connectivity',
  negatives_addressed: 'Negatives Addressed',
  reinforcing_loop: 'Reinforcing Loop',
  disconnected_nodes: 'Disconnected Nodes',
  dead_end_injection: 'Dead-End Injections',
  dead_end_de: 'Dead-End DEs',
  off_path_entity: 'Off-Path Entities',
};

const SCHEINKOPF_CATEGORIES: FlagCategory[] = [
  'de_connectivity',
  'negatives_addressed',
  'reinforcing_loop',
];

function groupFlags(flags: ValidationFlag[]): Map<FlagCategory, ValidationFlag[]> {
  const grouped = new Map<FlagCategory, ValidationFlag[]>();
  for (const flag of flags) {
    const list = grouped.get(flag.category) ?? [];
    list.push(flag);
    grouped.set(flag.category, list);
  }
  return grouped;
}

export function ValidationPanel({ onClose }: ValidationPanelProps) {
  const { state } = useTreeStore();

  const result = useMemo(() => {
    if (!state) return null;
    return validateTree(state);
  }, [state]);

  if (!result) return null;

  const { flags, completeness, stats } = result;

  const scheinkopfFlags = flags.filter((f) =>
    SCHEINKOPF_CATEGORIES.includes(f.category)
  );
  const advisoryFlags = flags.filter(
    (f) => !SCHEINKOPF_CATEGORIES.includes(f.category)
  );

  return (
    <div className="validation-panel">
      <div className="validation-panel__header">
        <h2>Validation</h2>
        <button className="validation-panel__close" onClick={onClose} title="Close">&times;</button>
      </div>

      {/* Completeness score */}
      <div className="validation-panel__score">
        <span className="validation-panel__score-value">{completeness.overall}%</span>
        <span className="validation-panel__score-label">completeness</span>
      </div>

      <div className="validation-panel__breakdown">
        <div className="validation-panel__breakdown-row">
          <span>DEs reachable</span>
          <span className="validation-panel__weight">35%</span>
          <span className={completeness.deReachable.score === 100 ? 'validation-panel__check' : 'validation-panel__miss'}>
            {completeness.deReachable.detail}
          </span>
        </div>
        <div className="validation-panel__breakdown-row">
          <span>Negatives addressed</span>
          <span className="validation-panel__weight">30%</span>
          <span className={completeness.negativesAddressed.score === 100 ? 'validation-panel__check' : 'validation-panel__miss'}>
            {completeness.negativesAddressed.detail}
          </span>
        </div>
        <div className="validation-panel__breakdown-row">
          <span>Reinforcing loop</span>
          <span className="validation-panel__weight">20%</span>
          <span className={completeness.reinforcingLoop.score === 100 ? 'validation-panel__check' : 'validation-panel__miss'}>
            {completeness.reinforcingLoop.detail}
          </span>
        </div>
        <div className="validation-panel__breakdown-row">
          <span>All connected</span>
          <span className="validation-panel__weight">15%</span>
          <span className={completeness.allConnected.score === 100 ? 'validation-panel__check' : 'validation-panel__miss'}>
            {completeness.allConnected.detail}
          </span>
        </div>
      </div>

      {/* Scheinkopf criteria flags */}
      {scheinkopfFlags.length > 0 && (
        <div className="validation-panel__section">
          <h3>Scheinkopf Criteria</h3>
          {[...groupFlags(scheinkopfFlags).entries()].map(([cat, catFlags]) => (
            <div key={cat} className="validation-panel__flag-group">
              <h4>{CATEGORY_LABELS[cat]}</h4>
              <ul className="validation-panel__list">
                {catFlags.map((f) => (
                  <li key={f.id} className="validation-panel__list-item validation-panel__list-item--warn">
                    {f.message}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Advisory flags */}
      {advisoryFlags.length > 0 && (
        <div className="validation-panel__section">
          <h3>Advisory</h3>
          {[...groupFlags(advisoryFlags).entries()].map(([cat, catFlags]) => (
            <div key={cat} className="validation-panel__flag-group">
              <h4>{CATEGORY_LABELS[cat]}</h4>
              <ul className="validation-panel__list">
                {catFlags.map((f) => (
                  <li key={f.id} className="validation-panel__list-item">
                    {f.message}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {flags.length === 0 && (
        <div className="validation-panel__section">
          <p className="validation-panel__ok">No issues found</p>
        </div>
      )}

      {/* Tree statistics */}
      <div className="validation-panel__section">
        <h3>Tree Statistics</h3>
        <table className="validation-panel__stats">
          <tbody>
            <tr><td>Nodes</td><td>{stats.nodeCount}</td></tr>
            <tr><td>Injections</td><td>{stats.injectionCount}</td></tr>
            <tr><td>Desirable Effects</td><td>{stats.deCount}</td></tr>
            <tr><td>Negative Effects</td><td>{stats.negativeCount}</td></tr>
            <tr><td>Entities</td><td>{stats.entityCount}</td></tr>
            <tr><td>Edges</td><td>{stats.edgeCount}</td></tr>
            <tr><td>AND Junctions</td><td>{stats.junctionCount}</td></tr>
            <tr><td>Loops</td><td>{stats.loopCount}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
