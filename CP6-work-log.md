# CP6 Work Log — Validation + Polish

## What was done

- Created validation engine (`src/utils/validation.ts`) with 3 Scheinkopf criteria checks (DE connectivity via backward BFS, negatives addressed, reinforcing loop detection) and 4 advisory checks (disconnected nodes, dead-end injections/DEs, off-path entities)
- Implemented weighted completeness scoring: DEs reachable 35%, negatives addressed 30% (N/A credits 100%), reinforcing loop 20%, all connected 15%
- Extracted `findReachableFromInjections` and `countCycles` from Sidebar.tsx into shared `utils/validation.ts` module; updated Sidebar to import from there
- Created `ValidationPanel` component — floating panel (left side of canvas) showing score breakdown, grouped flags (Scheinkopf first, then advisory), and tree statistics
- Wired "Validate" button into topbar and ValidationPanel into canvas-area
- Implemented global Escape priority chain (capture phase): close validation panel -> close detail panel -> deselect node; removed standalone Escape handler from NodeDetailPanel
- Added empty canvas guidance text when no edges exist in build phase
- Added responsive CSS breakpoints at 1400px (narrower sidebar/panels) and 900px (sidebar hidden, full-width panels)
- Wrote 13 validation tests across utility and integration scenarios
- "Start Building" gate was already implemented in CP1 (requires injection + DE) — verified in place

## Verification

- `tsc -b --noEmit`: clean
- `vitest run`: 82/82 tests pass (5 test files)

## Files created/modified

Created:
- `src/utils/validation.ts` — validation engine + graph analysis utilities
- `src/utils/validation.test.ts` — 13 tests
- `src/components/ValidationPanel.tsx` — floating validation panel

Modified:
- `src/components/App.tsx` — Validate button, ValidationPanel rendering, Escape priority chain, empty canvas hint
- `src/components/NodeDetailPanel.tsx` — removed standalone Escape handler (now managed by App)
- `src/components/Sidebar.tsx` — imports graph analysis from shared module instead of local definitions
- `src/styles/app.css` — ValidationPanel styles, empty canvas hint, responsive breakpoints

---

## Post-CP6 — UX Polish (2026-03-28)

### What was done
- Added missing CSS styles for `.layout-controls` and `.layout-controls__btn` — the LayoutControls component (Re-layout, Reset, Fit buttons) was created in CP3 and wired into Canvas.tsx, but the corresponding CSS was never added to `app.css`. Buttons were invisible without styles.
- Styles match CRT builder pattern: positioned bottom-right of canvas, z-index 5, compact button row with hover state.

### Verification
- `tsc -b --noEmit`: clean
- `vitest run`: 82/82 tests pass
- Manual testing: completed a full FRT using CRT and EC imports, all features working as expected

### Files modified
- `src/styles/app.css` — added layout-controls CSS block
