# CP0 Work Log — Project Scaffolding + Data Model

## What was done

- Scaffolded Vite + React 19 + TypeScript 5.9 project matching CRT/EC configuration (strict mode, verbatimModuleSyntax, Vitest with jsdom)
- Defined FRT data model types: `FRTNodeType` (4 node types), `FRTNode` (with `injectionKind`, `sourceUDEText`, `addressed` optional fields), `FRTEdge` (with optional `junctionId`), `FRTTree`
- Built context + useReducer state management with 9 actions: `CREATE_TREE`, `SET_TREE`, `UPDATE_TREE_META`, `ADD_NODE`, `REMOVE_NODE`, `UPDATE_NODE`, `BATCH_ADD_NODES`, `ADD_EDGE`, `REMOVE_EDGE`
- `REMOVE_NODE` cascades to delete connected edges and dissolve junctions that drop below 2 members
- `REMOVE_EDGE` dissolves junctions when membership drops below 2
- `BATCH_ADD_NODES` accepts heterogeneous node types (needed for setup→build transition)
- localStorage auto-save with 2-second debounce, matching CRT/EC pattern
- Minimal App.tsx with TreeProvider wrapping
- 33 unit tests covering all actions, null-state guards, cascade deletion, junction dissolution, and batch operations

## Design decisions vs CRT

- **`BATCH_ADD_NODES` payload**: Array of `{type, text, ...optionals}` instead of CRT's single-type `{nodeType, texts[]}` — the setup→build transition creates injections, DEs, and negatives in one dispatch
- **Edge field names**: `source`/`target` (ReactFlow convention) instead of CRT's `fromNodeId`/`toNodeId` — avoids mapping layer in later canvas integration
- **`junctionId` optionality**: `string | undefined` instead of `string | null` — dissolved junctions omit the field entirely via rest spread, cleaner with conditional spread in the reducer

## Verification

- `tsc -b --noEmit`: clean
- `vitest run`: 33/33 tests pass
- `vite dev`: starts successfully on localhost:5173

## Files created

- `package.json`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`
- `src/types/frt.ts`
- `src/state/treeStore.tsx`
- `src/state/treeStore.test.ts`
- `src/components/App.tsx`
- `src/main.tsx`
- `src/styles/app.css`
