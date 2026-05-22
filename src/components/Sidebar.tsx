import { useMemo } from 'react';
import { useTreeStore } from '../state/treeStore.tsx';
import { findReachableFromInjections, countCycles } from '../utils/validation.ts';

interface SidebarProps {
  selectedNodeId: string | null;
  onNodeSelect: (nodeId: string | null) => void;
}

export function Sidebar({ selectedNodeId, onNodeSelect }: SidebarProps) {
  const { state } = useTreeStore();

  const injections = useMemo(() => {
    if (!state) return [];
    return state.nodes.filter((n) => n.type === 'injection');
  }, [state]);

  const des = useMemo(() => {
    if (!state) return [];
    return state.nodes.filter((n) => n.type === 'desirable-effect');
  }, [state]);

  const negatives = useMemo(() => {
    if (!state) return [];
    return state.nodes.filter((n) => n.type === 'negative-effect');
  }, [state]);

  const reachable = useMemo(() => {
    if (!state) return new Set<string>();
    return findReachableFromInjections(state.nodes, state.edges);
  }, [state]);

  const loopCount = useMemo(() => {
    if (!state) return 0;
    return countCycles(state.nodes, state.edges);
  }, [state]);

  if (!state) return null;

  const coreCount = injections.filter((i) => i.injectionKind !== 'supplementary').length;
  const suppCount = injections.filter((i) => i.injectionKind === 'supplementary').length;
  const connectedDEs = des.filter((d) => reachable.has(d.id)).length;
  const addressedNegatives = negatives.filter((n) => n.addressed).length;

  return (
    <div className="frt-sidebar">
      {/* Summary line */}
      <div className="frt-sidebar__summary">
        <span className={connectedDEs === des.length && des.length > 0 ? 'frt-sidebar__stat--ok' : 'frt-sidebar__stat--warn'}>
          {connectedDEs}/{des.length} DEs connected
        </span>
        <span className="frt-sidebar__dot-sep">&middot;</span>
        <span className={addressedNegatives === negatives.length && negatives.length > 0 ? 'frt-sidebar__stat--ok' : negatives.length > 0 ? 'frt-sidebar__stat--warn' : ''}>
          {addressedNegatives}/{negatives.length} negatives addressed
        </span>
        <span className="frt-sidebar__dot-sep">&middot;</span>
        <span className={loopCount > 0 ? 'frt-sidebar__stat--ok' : 'frt-sidebar__stat--warn'}>
          {loopCount} loop{loopCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Injections section */}
      <div className="frt-sidebar__section">
        <h3 className="frt-sidebar__section-title">
          Injections
          {injections.length > 0 && (
            <span className="frt-sidebar__section-count">
              {' '}{coreCount} core{suppCount > 0 ? `, ${suppCount} supplementary` : ''}
            </span>
          )}
        </h3>
        {injections.length === 0 ? (
          <p className="frt-sidebar__empty">No injections</p>
        ) : (
          <ul className="frt-sidebar__list">
            {injections.map((inj) => (
              <li
                key={inj.id}
                className={`frt-sidebar__item frt-sidebar__item--injection ${selectedNodeId === inj.id ? 'frt-sidebar__item--selected' : ''}`}
                onClick={() => onNodeSelect(inj.id)}
              >
                <span className="frt-sidebar__badge frt-sidebar__badge--injection">
                  {inj.injectionKind === 'supplementary' ? 'S' : 'C'}
                </span>
                <span className="frt-sidebar__item-text">{inj.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Target DEs section */}
      <div className="frt-sidebar__section">
        <h3 className="frt-sidebar__section-title">
          Target DEs
          {des.length > 0 && (
            <span className="frt-sidebar__section-count"> {connectedDEs} of {des.length} connected</span>
          )}
        </h3>
        {des.length === 0 ? (
          <p className="frt-sidebar__empty">No desirable effects</p>
        ) : (
          <ul className="frt-sidebar__list">
            {des.map((de) => {
              const isConnected = reachable.has(de.id);
              return (
                <li
                  key={de.id}
                  className={`frt-sidebar__item ${isConnected ? 'frt-sidebar__item--connected' : 'frt-sidebar__item--unconnected'} ${selectedNodeId === de.id ? 'frt-sidebar__item--selected' : ''}`}
                  onClick={() => onNodeSelect(de.id)}
                >
                  <span className={`frt-sidebar__dot ${isConnected ? 'frt-sidebar__dot--connected' : 'frt-sidebar__dot--unconnected'}`} />
                  <span className="frt-sidebar__item-text">{de.text}</span>
                  {!isConnected && <span className="frt-sidebar__cta">unconnected</span>}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Negative Effects section */}
      <div className="frt-sidebar__section">
        <h3 className="frt-sidebar__section-title">
          Negative Effects
          {negatives.length > 0 && (
            <span className="frt-sidebar__section-count"> {addressedNegatives} of {negatives.length} addressed</span>
          )}
        </h3>
        {negatives.length === 0 ? (
          <p className="frt-sidebar__empty">No negative effects</p>
        ) : (
          <ul className="frt-sidebar__list">
            {negatives.map((neg) => (
              <li
                key={neg.id}
                className={`frt-sidebar__item ${neg.addressed ? 'frt-sidebar__item--addressed' : 'frt-sidebar__item--unaddressed'} ${selectedNodeId === neg.id ? 'frt-sidebar__item--selected' : ''}`}
                onClick={() => onNodeSelect(neg.id)}
              >
                <span className={`frt-sidebar__dot ${neg.addressed ? 'frt-sidebar__dot--addressed' : 'frt-sidebar__dot--unaddressed'}`} />
                <span className="frt-sidebar__item-text">{neg.text}</span>
                {neg.addressed ? (
                  <span className="frt-sidebar__check" title="Addressed">&#10003;</span>
                ) : (
                  <span className="frt-sidebar__cta">unaddressed</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
