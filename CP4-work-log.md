# CP4 Work Log — Negative Branch Interaction

## What was done

- Created `NodeDetailPanel` component — appears when any node is selected, positioned as floating panel in top-right of canvas area
  - **Injection**: read-only text for core, editable for supplementary, plus kind designation label
  - **Desirable Effect**: editable text + sourceUDEText shown as muted "Original UDE" reference
  - **Negative Effect**: editable text + addressed checkbox toggle (dispatches `UPDATE_NODE`)
  - **Entity**: editable text only
  - Closes on Escape key or close button; canvas click deselects via existing `handlePaneClick`
- Refined sidebar scorecard section headers:
  - Injections: shows "1 core, 2 supplementary" count breakdown
  - Target DEs: shows "X of Y connected"
  - Negative Effects: shows "X of Y addressed"
- Added 7 new reducer tests (addressed toggle true/false, type changes with field set/clear, RESET_MANUAL_POSITIONS, UPDATE_EDGE)
- Added CSS for NodeDetailPanel and sidebar section counts

## Design decisions

- **Panel placement**: Floating panel inside `canvas-area` (absolute-positioned top-right) rather than a dedicated grid column — keeps the layout simple and doesn't compress the canvas. Follows EC EntityEditor pattern adapted for floating use.
- **Core injection read-only**: Core injection text is read-only in the detail panel since it's imported from EC and shouldn't be casually changed. Supplementary injections are editable since they're created during FRT construction.
- **No addressed notes field**: Deferred the optional "how it was addressed" notes field per the guide's suggestion — the toggle alone carries the essential information and avoids clutter.

## Verification

- `tsc -b --noEmit`: clean
- `vitest run`: 69/69 tests pass (62 → 69)
- `npm run build`: production build succeeds

## Files created/modified

- **Created:** `src/components/NodeDetailPanel.tsx`
- **Created:** `CP4-work-log.md`
- **Modified:** `src/components/App.tsx` (import + render NodeDetailPanel)
- **Modified:** `src/components/Sidebar.tsx` (scorecard refinement with section counts)
- **Modified:** `src/styles/app.css` (panel styles, section count styles)
- **Modified:** `src/state/treeStore.test.ts` (7 new tests)
