# PRD: Queens Puzzle Web UI

## Overview

Build a browser-based UI for the Queens puzzle — replacing the terminal-only experience with an
interactive, visual board that any player can use without installing Rust. The Rust solver and
generator are compiled to WebAssembly via `wasm-bindgen` and called directly from a React frontend.

## Goals

- Let anyone play a Queens puzzle in the browser with no install step; host statically on GitHub Pages.
- Expose the solver as a hint/step-through tool so players can learn solving techniques.
- Allow generating new puzzles on demand and importing custom puzzles via JSON.
- Support shareable URLs that encode a puzzle — either as a link to a remotely hosted JSON file or
  with the full puzzle JSON embedded directly in the URL.
- Rust core changes are in scope where required by the web UI (e.g. splitting into a library crate,
  exposing a step-by-step solver); the focus of this work is the web UI.

## Non-goals

- Mobile-native app (responsive web is sufficient).
- User accounts, leaderboards, or persistence beyond a single session.
- Multiplayer or real-time collaboration.
- Replacing the CLI; both targets coexist in the same workspace.

---

## Puzzle JSON format

The canonical format for all puzzle interchange — frontend state, WASM API, URL sharing, import,
and export. `n` is omitted; it is inferred from the length of the `regions` array.

```json
{
  "regions": [[0, 0, null, 1, 1, 2, 2], [0, 0, 0, 1, 1, 2, 2], ...],
  "states":  [[0, 0,    0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0], ...]
}
```

- `regions[row][col]` — region index (0-based integer) or `null` for an unassigned cell (editor
  mode only).
- `states[row][col]` — `0` (unknown), `1` (queen), `2` (empty/crossed).
- `states` is omitted when all cells are unknown (unsolved puzzle with no progress).
- The board is always square: `regions.length === regions[0].length`.

---

## Features

### 1. Interactive board

The board is an n×n grid rendered to match the visual style of the README example image: each cell
fills with its region colour and region boundaries are drawn with bold borders. Players click a cell
to cycle its state: **Unknown → Empty (cross) → Queen → Unknown**. "Empty" renders as a small cross,
as shown in the README example image. The board enforces no rules on its own.

A **Reset** button clears all cell states back to Unknown. It shows a confirmation dialog first.

Region colours must be consistent across the CLI and the web UI — both should match the colours
visible in the README screenshot.

Puzzle state (cell states) is persisted to browser `localStorage` on every change so that closing
and reopening the tab restores the session.

feedback: initialize with the same puzzle (but unsolved) as the example image in the README.

**Acceptance criteria**
- Clicking a cell cycles Unknown → Empty → Queen → Unknown; empty renders as a small cross.
- Region colours match the README example image; the same palette is used by the CLI.
- Bold borders are drawn between cells that belong to different regions.
- Reset shows a confirmation dialog, then resets all cells to Unknown on confirm.
- Board state is saved to `localStorage` on every change and restored on page load.
- A "solved" banner appears when the player places exactly n non-attacking queens (one per row,
  column, and region, none diagonally adjacent).

### 2. Improved interactive board

Quality-of-life features layered on top of the basic board.

- **Hover highlight**: mousing over a cell darkens it slightly; the region colour does not change.
- **Clashing queens**: any queen that conflicts with another (same row, column, region, or diagonal)
  is rendered in red until the conflict is resolved.
- **Auto-cross** (toggle, default on): when a queen is placed, automatically mark every cell in the
  same row, column, region, or diagonally adjacent as empty.
- **Timer** (toggle, default on): a running clock showing elapsed time since the first interaction.
- **Drag-to-cross**: clicking and dragging marks cells as empty. The drag only initiates when the
  starting cell is Unknown (not a queen); queens are never overwritten by a drag gesture.

**Acceptance criteria**
- Hovering a cell applies a darkening effect without altering its region background colour.
- Queens involved in any conflict are highlighted red; the highlight clears when resolved.
- Auto-cross updates the board immediately when toggled on (applies retroactively to placed queens)
  and clears auto-crosses when toggled off.
- Timer shows MM:SS, starts on first interaction, and stops when the puzzle is solved.
- Drag only starts when the pointer-down cell is Unknown; queens are never changed to empty by drag.
- No Rust changes required for this milestone.

### 3. Solver step-through

A "Hint" button identifies the next logical deduction, highlights the affected cells, and shows the
explanation — but does **not** apply the change immediately. An "Apply" button then commits the
hint to the board. A "Solve" button runs all steps to completion without pausing.
feedback: when showing a hint, all other cells should be slightly dimmed, the cells to be changed should be highlighted with green borders

feedback: or the user can make the corresponding changes manually, when theyre all applied return to normal UI

The solver loop in Rust needs to be refactored to expose individual steps (one rule application at a
time) rather than running to completion internally.

**Acceptance criteria**
- "Hint" highlights changed cells (green) and involved cells (outlined) and shows the description,
  without mutating the board.
- "Apply" commits the pending hint; the highlight clears.
- "Solve" runs to completion or reports "brute force required" if logical solving gets stuck.
- Board state after "Solve" matches what the CLI would produce for the same puzzle.

feedback: we dont need the solve button i think?

### 4. Change history (undo/redo)

Record every state-changing action (player move, hint application, solve step, editor paint stroke)
in a history list. Undo and redo buttons walk backwards and forwards through it. History covers both
play mode and edit mode.

**Acceptance criteria**
- Undo reverts the most recent action; redo re-applies it.
- Hint Apply and Solve steps are individually undoable.
- Editor paint strokes are undoable.
- History is cleared when a new puzzle is loaded.

### 5. Puzzle import

A JSON import dialog accepts the canonical puzzle JSON format. Submitting it loads the puzzle into
the board. URL-based loading (feature 6) uses the same parsing path.

The text-format import from the original PRD is dropped — the visual editor makes it redundant, and
JSON is a better interchange format.

**Acceptance criteria**
- Valid JSON puzzles (regions only, or regions + states) load correctly.
- Partially-solved state (if present) is restored.
- An inline error message is shown for malformed or invalid input.

### 6. Shareable URLs

A "Share" button produces a URL for the current puzzle. The Share dialog offers two variants:

- **Share puzzle** — encodes only the `regions` grid (cleared state), so the recipient starts fresh.
- **Share progress** — encodes `regions` + `states`, restoring the sender's partial solve.

Two encoding modes are available for each variant:

- **Remote link**: a query parameter holds a URL to a remotely hosted JSON file; the app fetches it
  on load.
- **Embedded**: the JSON is base64-encoded into the URL fragment; no fetch needed, works offline.

**Acceptance criteria**
- Visiting a share URL restores the puzzle (and state if progress was shared) with no manual import.
- The Share dialog presents all four combinations and lets the user copy any of them.
- An invalid or unreachable URL shows a clear error rather than a blank board.

### 7. Custom puzzle editor

An **Edit mode** (toggled separately from Play mode via a mode button) lets the user paint region
colours onto cells. Cells with no assigned region are displayed as a transparent checkerboard
pattern (the standard "no colour" indicator, distinct from all 12 region colours). Switching to
Play mode loads the painted layout as a puzzle.

The colour palette in the editor is limited to n colours (where n is the current board size), not
the full 12. A **Shuffle colours** button randomly reassigns which colour index maps to which
region.

Undo/redo (milestone 4) applies in edit mode as well as play mode.

Board state in edit mode is also persisted to `localStorage`.

**Acceptance criteria**
- The user can assign any of the n region colours to any cell.
- Unassigned cells render as a checkerboard pattern.
- The editor validates that the board is fully assigned and each of the n regions appears at least
  once before allowing the switch to Play mode.
- Shuffle colours button reassigns the colour palette randomly without changing region shapes.
- Undo/redo works for paint strokes in edit mode.
- Painted puzzles can be solved and stepped through exactly like generated ones.
- The finished board can be exported as JSON.

feedback: add a follow up milestone that shows (calculates in the background) if the partially edited puzzle has a solution (or multiple) and how difficult it is

### 8. Puzzle generation

A "Generate" button with a size selector (4–12, defaulting to 8) and an optional seed field calls
the WASM generator. Generation runs in a **Web Worker** so the UI remains responsive for large
boards. An empty seed field uses a random seed; a numeric value produces a deterministic result.

**Acceptance criteria**
- Generated puzzles have exactly one solution (guaranteed by the generator).
- The difficulty rating is displayed after generation.
- The UI remains interactive during generation; a loading indicator is shown.
- An optional numeric seed can be entered; leaving it blank generates randomly.

---

## Technical design

### Repository structure

```
queens-puzzle/
├── src/              (existing CLI binary — depends on core)
├── core/             (new: library crate — solver, generator, puzzle types)
│   ├── Cargo.toml
│   ├── src/
│   └── tests/        (Rust integration tests spanning multiple modules)
├── wasm/             (new: cdylib crate — thin JS-facing wrapper over core)
│   ├── Cargo.toml
│   └── src/lib.rs
└── web/              (new: React/Vite app)
    ├── package.json
    └── src/
        ├── components/
        └── __tests__/  (frontend unit and integration tests)
```

Splitting the existing code into a `core` library crate means the CLI binary, the WASM crate, and
future targets all share one implementation with no duplication. Rust unit tests stay co-located
(`#[cfg(test)]` modules); integration tests that span multiple modules go in `core/tests/`.
Frontend tests (component behaviour, JSON parsing) live in `web/src/__tests__/`.

### WASM API surface (initial)

```rust
// wasm/src/lib.rs — indicative, not final

#[wasm_bindgen]
pub struct WasmPuzzle { ... }

#[wasm_bindgen]
impl WasmPuzzle {
    pub fn from_json(input: &str) -> Result<WasmPuzzle, JsValue>;
    pub fn generate(n: usize, seed: u64) -> WasmPuzzle;
    pub fn to_json(&self) -> String;
    pub fn n(&self) -> usize;
    pub fn cell_region(&self, row: usize, col: usize) -> Option<u8>;
    pub fn cell_state(&self, row: usize, col: usize) -> u8;  // 0=Unknown 1=Queen 2=Empty
    pub fn set_cell_state(&mut self, row: usize, col: usize, state: u8);
    pub fn next_hint(&mut self) -> Option<WasmHint>;
    pub fn solve(&mut self) -> bool;  // returns true if solved logically
    pub fn is_solved(&self) -> bool;
    pub fn difficulty(&self) -> Option<String>;
}

#[wasm_bindgen]
pub struct WasmHint {
    pub description: String,
    pub changes: Vec<u32>,   // [row, col, state, ...] flattened triples
    pub involved: Vec<u32>,  // [row, col, ...] flattened pairs
}
```

`cell_region` returns `Option<u8>` (mapped to `number | undefined` in JS) to represent unassigned
cells in editor mode.

### Frontend stack

| Concern | Choice |
|---------|--------|
| Framework | React (Vite) |
| Language | TypeScript |
| Styling | CSS Modules or Tailwind — TBD |
| WASM loading | `wasm-pack` output, loaded via `import()` |
| Build | `wasm-pack build --target bundler` + `vite` |
| Hosting | GitHub Pages (static) |

No state management library is needed at this scale; React `useState` / `useReducer` is sufficient.

---

## Milestones

| # | Milestone | Deliverable |
|---|-----------|-------------|
| 1 | WASM scaffold | `wasm-pack build` succeeds; `from_json` and `cell_region` callable from a browser console |
| 2 | Playable board | Board renders with correct colours and bold region borders; click-to-cycle; reset; localStorage |
| 3 | Improved board | Hover highlight, clashing queen indicator, auto-cross toggle, timer, drag-to-cross |
| 4 | Solver step-through | Hint (preview) + Apply + Solve; Rust solver refactored to expose individual steps |
| 5 | Change history | Undo/redo for player moves, hint applications, and editor strokes |
| 6 | Puzzle import + share | JSON import dialog; shareable URLs (puzzle-only and with-progress variants) |
| 7 | Custom editor | Paint-mode editor; checkerboard unassigned cells; shuffle colours; n-colour palette; JSON export |
| 8 | Generator UX | Generate button; size selector; optional seed; Web Worker; difficulty shown |
