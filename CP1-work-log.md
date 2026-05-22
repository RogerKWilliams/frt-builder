# FRT Builder CP1 — Work Log

**Checkpoint:** CP1 — Setup Phase: Import + DE Creation + Negative Entry
**Date:** 2026-03-26
**Status:** Complete

## What was built

### New files
- `src/utils/importCRT.ts` — Reads CRTTree JSON, validates structure (id, nodes array with id/text/type), extracts UDE nodes as `{id, text}` pairs. Fails gracefully with descriptive errors for invalid JSON, missing structure, or no UDEs found.
- `src/utils/importEC.ts` — Reads ECCloud JSON, validates structure (id, assumptions array, injections array with id/text), extracts injections with optional target assumption cross-reference. Same error handling pattern.
- `src/components/DEEditor.tsx` — Individual DE editing row. When source UDE exists: shows full UDE reference above input until text is edited, then collapses to "Show original" toggle link. Supports remove button.
- `src/components/SetupPanel.tsx` — Three-section setup panel:
  - **Injection:** Import from EC file (radio selection among multiple injections, auto-selects if only one) or manual textarea fallback.
  - **Desirable Effects:** Import UDEs from CRT file (checkbox checklist), each selected UDE creates a pre-filled DE editing row. Manual "Add DE" button for entries without CRT import.
  - **Anticipated Negatives:** One-per-line textarea with count display.
  - **Start Building** button: disabled until 1 injection + 1 DE present. Dispatches `BATCH_ADD_NODES` with injection (core, injectionKind), DEs (with sourceUDEText), and negatives (addressed: false).

### Modified files
- `src/components/App.tsx` — Phase management (setup/build), topbar with title + goal inputs, auto-creates tree on mount, auto-transitions to build phase if restored from localStorage with nodes.
- `src/styles/app.css` — Full CSS: variables for FRT node types (injection/teal, DE/green, negative/red, entity/gray), setup panel layout, injection card/list, UDE checklist, DE editor with collapse states, buttons, topbar inputs.

## Verification
- TypeScript compiles clean (`tsc -b --noEmit`)
- Vite dev server starts successfully
- All 33 existing reducer tests pass

## Design decisions
- Import utilities use the same FileReader + Promise pattern as EC Builder's `importJson.ts`
- CRT import validates `nodes` array structure but is lenient on extra fields (forward-compatible)
- EC import cross-references `targetAssumptionId` to show which assumption each injection challenges
- DE entries keyed by UDE id when imported (enables checkbox toggle to add/remove), by uuid when manual
- Manual injection textarea hidden when imports are loaded (avoids confusion); can clear by re-importing
- Phase auto-detection on mount: if localStorage has nodes → skip to build phase

## What's next (CP2)
Canvas + node rendering + edge creation with AND junction support. All four node types render with distinct visual treatment. Sidebar scorecard with live inventory.
