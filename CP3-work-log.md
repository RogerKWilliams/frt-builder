# CP3 Work Log — Auto-Layout + Spatial Management

## What was done

- Created dagre layout wrapper in `src/utils/layout.ts` — TB direction, cycle-tolerant (dagre's internal edge reversal), manual position skip, 16:9 grid staging for disconnected nodes
- Created `src/components/LayoutControls.tsx` — Re-layout, Reset, Fit buttons (same pattern as CRT)
- Added `RESET_MANUAL_POSITIONS` action to `state/treeStore.tsx` — clears all `manuallyPositioned` flags
- Replaced simple grid layout in `Canvas.tsx` with dagre integration: `applyLayout` helper, `handleRelayout`, `handleResetLayout`, `handleFitView`, initial layout on build phase entry with fitView, auto-relayout on edge count change when no manual positions
- Added `LayoutControls` component to Canvas JSX
- Created 7 layout unit tests in `src/utils/layout.test.ts`: empty input, disconnected grid, grid multi-row, connected TB ordering, manual preservation, 3-node cycle (no crash/no overlap), mixed connected/disconnected staging

## Verification

- `tsc -b --noEmit`: clean
- `vitest run`: 41/41 tests pass (34 existing + 7 new layout tests)

## Files created/modified

**Created:**
- `src/utils/layout.ts`
- `src/utils/layout.test.ts`
- `src/components/LayoutControls.tsx`

**Modified:**
- `src/state/treeStore.tsx` — added `RESET_MANUAL_POSITIONS` action
- `src/components/Canvas.tsx` — replaced grid layout with dagre integration + layout controls
