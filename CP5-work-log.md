# CP5 Work Log — Persistence + Export

## What was done

- Created JSON export utility (`utils/exportJson.ts`) — downloads FRTTree as `.json` with sanitized filename
- Created JSON import utility (`utils/importJson.ts`) — `validateFRTTree` with structural validation: required fields, valid FRTNodeType, injectionKind validation, edge reference validation, junctionId consistency (must appear on 2+ edges)
- Created Markdown export (`utils/exportMarkdown.ts`) — 7 section renderers: header/goal, core injection, DEs with sourceUDE reference, causal chains (AND notation + cycle guards with "reinforcing loop" annotation), negative branches with addressed status, reinforcing loops (cycle detection via iterative DFS), summary statistics
- Created FileControls component (`components/FileControls.tsx`) — New/Save/Load/Export JSON/Export MD buttons with last-saved timestamp display
- Updated App.tsx — integrated FileControls in both setup and build phases, app-level Ctrl+S handler, import handler that auto-navigates to build phase
- Removed duplicate Ctrl+S handler from Canvas.tsx (now handled at app level)
- Added file-controls CSS styles to app.css
- 11 validation tests in `persistence.test.ts`
- 10 Markdown export tests in `exportMarkdown.test.ts`

## Design decisions

- **Persistence helpers stay in treeStore.tsx**: The guide suggested extracting to `utils/persistence.ts` but noted it wasn't required. Since CP0 already built working auto-save/restore/debounce in treeStore.tsx, extracting would be churn with no benefit. The `persistence.test.ts` tests validate the import/validation logic in `importJson.ts` instead.
- **Cycle detection uses iterative DFS**: Avoids stack overflow on large loops. Called twice in Markdown export (reinforcing loops section + summary) — acceptable for tree sizes in practice.
- **Ctrl+S moved to app level**: Was previously in Canvas.tsx (only worked in build phase). Now covers both setup and build phases.

## Verification

- `tsc -b --noEmit`: clean
- `vitest run`: 62/62 tests pass (41 existing + 11 persistence + 10 export)

## Files created/modified

Created:
- `src/utils/exportJson.ts`
- `src/utils/importJson.ts`
- `src/utils/exportMarkdown.ts`
- `src/utils/exportMarkdown.test.ts`
- `src/utils/persistence.test.ts`
- `src/components/FileControls.tsx`

Modified:
- `src/components/App.tsx` — FileControls integration, app-level Ctrl+S, import/new handlers
- `src/components/Canvas.tsx` — removed duplicate Ctrl+S handler and unused import
- `src/styles/app.css` — file-controls styles
