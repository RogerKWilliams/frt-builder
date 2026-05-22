# CP2 Work Log — Canvas + Node Rendering + Edge Creation

## What was done

- Created `FRTNodeComponent` with four visually distinct node treatments: core injection (solid teal, bold), supplementary injection (dashed teal, lighter fill), desirable effect (green, bold), negative effect (red, bold with addressed checkmark/muting), entity (gray, standard)
- Created `Canvas.tsx` with full ReactFlow integration: pan, zoom, drag-to-reposition, handle-to-handle edge creation, AND junction prompt, canvas/edge/node context menus, keyboard shortcuts (Delete/Backspace/Escape/Ctrl+S)
- Created `JunctionEdge` for AND junction ellipse rendering and `JunctionPrompt` for the "Sufficient alone" / "AND with existing" interaction
- Created `Sidebar` with three inventory sections: Injections (C/S badges), Target DEs (connected/unconnected via BFS from injections), Negative Effects (addressed/unaddressed with checkmarks), plus summary line with loop count via DFS cycle detection
- Added `UPDATE_EDGE` action to treeStore reducer (needed for junction assignment)
- Exported `saveToLocalStorage` from treeStore for Ctrl+S in Canvas
- Updated `App.tsx` to wire Canvas + Sidebar into the build phase
- Added ~480 lines of CSS for nodes, context menus, junction prompt, edge context menu, canvas context menu, and sidebar
- 5 new component files created, 3 existing files modified

## Design decisions

- **Simple grid layout instead of dagre**: CP2 uses a basic grid for initial node positioning since dagre integration is CP3's scope. Nodes without positions get arranged in a square grid (250px x 150px spacing).
- **Canvas context menu for node creation**: Right-click on canvas offers Add Entity / Add Negative Effect / Add Supplementary Injection (not core injection or DE, since those come from setup phase).
- **BFS reachability for DE connectivity**: Sidebar checks if each DE is reachable from any injection via directed BFS. This is recalculated on every state change via `useMemo`.
- **DFS cycle detection for loop count**: Uses standard white/gray/black coloring to count back-edges. Exposed in sidebar summary line.

## Verification

- `tsc -b --noEmit`: clean, no errors
- `vitest run`: 33/33 tests pass (all existing CP0 reducer tests)
- `npm run build`: production build succeeds (395 KB JS, 28 KB CSS)

## Files created/modified

**Created:**
- `src/components/Canvas.tsx` — ReactFlow integration, edge creation, junction handling, context menus, keyboard shortcuts
- `src/components/FRTNodeComponent.tsx` — custom node renderer with four visual treatments
- `src/components/JunctionEdge.tsx` — AND junction ellipse edge component
- `src/components/JunctionPrompt.tsx` — junction choice prompt
- `src/components/Sidebar.tsx` — three-section inventory with BFS connectivity and DFS cycle detection

**Modified:**
- `src/components/App.tsx` — wired Canvas + Sidebar into build phase
- `src/state/treeStore.tsx` — added UPDATE_EDGE action, exported saveToLocalStorage
- `src/styles/app.css` — ~480 lines of node, canvas, sidebar, context menu, and junction styling
