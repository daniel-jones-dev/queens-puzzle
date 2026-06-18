# PRD: Queens Puzzle Web UI

## Overview

Build a browser-based UI for the Queens puzzle — replacing the terminal-only experience with an
interactive, visual board that any player can use without installing Rust. The Rust solver and
generator are compiled to WebAssembly via `wasm-bindgen` and called directly from a React frontend.

## Goals

- Let anyone play a Queens puzzle in the browser with no install step; host statically on GitHub Pages.
- Expose the solver as a hint/step-through tool so players can learn solving techniques.
- Allow generating new puzzles on demand and importing custom puzzles via JSON.
- Support shareable URLs that embed the puzzle JSON directly in the URL.
- Rust core changes are in scope where required by the web UI (e.g. splitting into a library crate,
  exposing a step-by-step solver); the focus of this work is the web UI.

## Non-goals

- Mobile-native app (responsive web is sufficient).
- User accounts, leaderboards, or server-side persistence.
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
to cycle its state: **Unknown → Empty (cross) → Queen → Unknown**. Two clicks are needed to place a
queen (first click marks the cell empty, second places the queen); this is intentional, matching the
game's design of explicitly eliminating cells. "Empty" renders as a small cross, as shown in the
README example image. The board enforces no rules on its own.

The app loads with the puzzle from the README example image (the 7×7 puzzle defined in the README
text format) in its initial unsolved state. This serves as the default starting puzzle.

A **Reset** button clears all cell states back to Unknown. It shows a confirmation dialog first.

Region colours must be consistent across the CLI and the web UI — both should match the colours
visible in the README screenshot.

Puzzle state (cell states) is persisted to browser `localStorage` on every change so that closing
and reopening the tab restores the session.

When the puzzle is solved, a congratulations banner is shown at the top of the page.

**Acceptance criteria**
- On first load (no `localStorage` data), the README example puzzle is shown fully unsolved.
- Clicking a cell cycles Unknown → Empty → Queen → Unknown; empty renders as a small cross.
- Region colours match the README example image; the same palette is used by the CLI.
- Bold borders are drawn between cells that belong to different regions.
- Reset shows a confirmation dialog, then resets all cells to Unknown on confirm.
- Board state is saved to `localStorage` on every change and restored on page load.
- A congratulations banner is shown at the top of the page when the player places exactly n
  non-attacking queens (one per row, column, and region, none diagonally adjacent).

### 2. Improved interactive board

Quality-of-life features layered on top of the basic board.

- **Hover highlight**: mousing over a cell darkens it slightly; the region colour does not change.
- **Clashing queens**: any queen that conflicts with another (same row, column, region, or diagonal)
  is rendered in red until the conflict is resolved.
- **Auto-cross** (toggle, default on): when a queen is placed, automatically mark every cell in the
  same row, column, region, or diagonally adjacent as empty.
- **Timer** (toggle, default on): a running clock showing elapsed time since the first interaction,
  persisted to `localStorage` and resumed on page load. The timer is written to `localStorage` on
  every tick (once per second); no separate debounce is needed since the value is a single integer.
- **Drag-to-cross**: clicking and dragging (or touch-and-drag on mobile) marks cells as empty. The
  gesture only initiates when the starting cell is Unknown; queens are never overwritten.

**Acceptance criteria**
- Hovering a cell applies a darkening effect without altering its region background colour.
- Queens involved in any conflict are highlighted red; the highlight clears when resolved.
- Auto-cross updates the board immediately when toggled on (applies retroactively to placed queens)
  and clears auto-crosses when toggled off.
- Timer shows MM:SS, starts on first interaction, stops when the puzzle is solved, and resumes from
  the saved value on page reload.
- Drag only starts when the pointer-down (or touch-start) cell is Unknown; queens are never changed
  to empty by drag. Touch events (`touchstart`, `touchmove`, `touchend`) are supported alongside
  mouse events.
- No Rust changes required for this milestone.

### 3. Solver step-through

A "Hint" button identifies the next logical deduction and enters **hint mode**:

- All cells not involved in the hint are dimmed.
- Cells that would be changed are highlighted with green borders.
- The hint description is shown in a panel.
- The user can press **Apply** to commit all hint changes at once, or manually click each affected
  cell. Clicks in hint mode still cycle normally (Unknown → Empty → Queen → Unknown); when a cell
  reaches the hinted target state it is counted as applied. Once all changes are applied, hint mode
  exits automatically.
- A dismiss control exits hint mode without applying any changes. The exact design is deferred to
  implementation review.

If no logical step is available (the puzzle requires brute force), pressing Hint shows a message:
"No logical step found — try a different approach."

The Rust solver loop needs to be refactored to expose individual steps (one rule application at a
time) rather than running to completion internally.

**Acceptance criteria**
- "Hint" enters hint mode: non-involved cells dim, cells-to-change gain green borders, description
  is shown; the board is not mutated.
- "Apply" commits all pending changes and exits hint mode.
- Clicking an affected cell cycles it normally; reaching the hinted state counts as applying that
  cell's change; hint mode exits once all changes are applied.
- A dismiss control is available to exit hint mode without applying changes.
- When no logical step exists, Hint shows "No logical step found — try a different approach."
- Board state after a fully applied hint matches what the CLI would produce for the same step.

### 4. Change history (undo/redo)

Record every state-changing action (player move, hint application, editor paint stroke) in a
history list. Undo and redo buttons walk backwards and forwards through it. History covers both
play mode and edit mode.

**Acceptance criteria**
- Undo reverts the most recent action; redo re-applies it.
- Hint Apply steps are individually undoable.
- Editor paint strokes are undoable.
- History is cleared when a new puzzle is loaded.

### 5. Puzzle import

A JSON import dialog accepts the canonical puzzle JSON format. It always loads the puzzle in its
unsolved state — any `states` present in the JSON are ignored. URL-based loading (feature 6) uses
the same JSON parser but applies states when they are present (see feature 6).

**Acceptance criteria**
- Valid JSON puzzles load correctly; the board is shown fully unsolved regardless of any states in
  the file.
- An inline error message is shown for malformed or invalid input.

### 6. Shareable URLs

A "Share" button produces a URL encoding the current puzzle. The Share dialog offers two variants,
both using base64-encoded JSON embedded in the URL fragment (no external fetch required):

- **Share puzzle** — encodes only the `regions` grid; the recipient starts with an unsolved board.
- **Share progress** — encodes `regions` + `states`; the recipient's board is restored to the
  sender's current state.

Visiting a share URL uses the same JSON parser as import but applies states when present, so
progress links restore the board state.

**Acceptance criteria**
- Visiting a share URL restores the puzzle (and state if a progress link) with no manual import.
- The Share dialog presents both variants and lets the user copy either URL.
- A malformed or tampered share URL shows a clear error rather than a blank board.

### 7. Custom puzzle editor

An **Edit mode** (separate from Play mode, entered via a mode button) lets the user paint region
colours onto cells. Cells with no assigned region are displayed as a transparent checkerboard
pattern (the standard "no colour" indicator, distinct from all 12 region colours).

**Editor entry points:**

- **From play mode** — an "Edit this puzzle" button loads the current play board's region layout
  into the editor (states stripped, regions preserved). Switching back to Play shows a confirmation
  dialog ("This will replace your current puzzle — continue?") before loading the editor board.
- **Fresh board** — entering edit mode without using "Edit this puzzle" starts with an empty n×n
  grid (all cells unassigned). The board size n is selected via a size picker (4–12, default 8).

**Within the editor**, a toolbar offers:

- **Scatter queens** — places n queens randomly and assigns each a single-cell region, giving a
  solvable scaffold of n isolated regions to grow. (Mirrors the generator's first step.)
- **Shuffle colours** — randomly reassigns which colour index maps to which region, without
  changing region shapes.

The colour palette in the editor is limited to n colours (where n is the current board size).

Undo/redo (milestone 4) applies in edit mode. Board state in edit mode is persisted to
`localStorage`.

**Acceptance criteria**
- "Edit this puzzle" in play mode loads the current region layout into the editor.
- Fresh-board entry starts with an empty grid; size is set by the size picker.
- Scatter queens populates n isolated one-cell regions placed at random non-attacking positions.
- The user can assign any of the n region colours to any cell.
- Unassigned cells render as a checkerboard pattern.
- Shuffle colours reassigns the colour palette randomly without changing region shapes.
- Undo/redo works for all paint strokes and scatter-queens operations.
- Switching from Edit to Play shows a confirmation dialog before replacing the play board.
- The editor validates that all cells are assigned and each of the n regions appears at least once
  before allowing the switch to Play mode.
- Painted puzzles can be solved and stepped through exactly like generated ones.
- The finished board can be exported as JSON.

### 8. Editor live analysis

While in Edit mode, a background Web Worker continuously analyses the current (possibly partial)
board and shows a live indicator. The indicator is debounced at 300ms and the solution count is
capped at 10. Any in-progress analysis is cancelled immediately when the board changes.

Indicator states:

- **Incomplete** — board not yet fully assigned; analysis deferred.
- **No solution** — the current region layout has no valid queen placement.
- **Multiple solutions** — ambiguous; shows exact count up to 10, then "10+ solutions".
- **Unique solution** — exactly one solution exists; the difficulty rating is shown.

**Acceptance criteria**
- The indicator updates within 300ms of each paint stroke settling.
- Previous analysis is cancelled when the board changes.
- Analysis runs in a Web Worker and does not block the UI.
- All four indicator states are displayed correctly.

### 9. Puzzle generation

A "Generate" button with a size selector (4–12, defaulting to 8) and an optional seed field calls
the WASM generator. Generation runs in a **Web Worker** so the UI remains responsive for large
boards. An empty seed field uses a random seed; a numeric value (up to 2³²−1) produces a
deterministic result.

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
    pub fn new_empty(n: usize) -> WasmPuzzle;              // editor: blank n×n grid
    pub fn generate(n: usize, seed: u32) -> WasmPuzzle;   // seed is u32; cast to u64 internally
    pub fn to_json(&self) -> String;
    pub fn n(&self) -> usize;
    pub fn cell_region(&self, row: usize, col: usize) -> Option<u8>;
    pub fn set_cell_region(&mut self, row: usize, col: usize, region: Option<u8>);
    pub fn cell_state(&self, row: usize, col: usize) -> u8;  // 0=Unknown 1=Queen 2=Empty
    pub fn set_cell_state(&mut self, row: usize, col: usize, state: u8);
    pub fn next_hint(&mut self) -> Option<WasmHint>;
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

`cell_region` / `set_cell_region` use `Option<u8>` (mapped to `number | undefined` in JS) to
represent unassigned cells in editor mode. `seed` is `u32` (max ~4.3 billion) to stay within
JavaScript's safe integer range; it is widened to `u64` inside the Rust implementation.

Web Workers for generation (milestone 9) and live analysis (milestone 8) each need their own WASM
initialisation call — they cannot share the main thread's module instance. This should be proved
out during milestone 1 (the WASM scaffold) before the architecture is locked in.

### Frontend stack

| Concern | Choice |
|---------|--------|
| Framework | React (Vite) |
| Language | TypeScript |
| Styling | CSS Modules |
| WASM loading | `wasm-pack` output, loaded via `import()` |
| Build | `wasm-pack build --target bundler` + `vite` |
| Hosting | GitHub Pages (static) |

CSS Modules is chosen over Tailwind because the board's region colours are computed at runtime from
puzzle data and must use inline styles or CSS custom properties regardless of the styling approach.
Tailwind's utilities would only benefit the surrounding chrome, which is a small fraction of the
work. CSS Modules keeps the dependency surface minimal.

No state management library is needed at this scale; React `useState` / `useReducer` is sufficient.

---

## Milestones

| # | Milestone | Deliverable |
|---|-----------|-------------|
| 1 | WASM scaffold | `wasm-pack build` succeeds; `from_json` and `cell_region` callable from a browser console; Web Worker WASM init proved out |
| 2 | Playable board | Board with README default puzzle; correct colours; bold borders; click-to-cycle; reset; localStorage |
| 3 | Improved board | Hover highlight, clashing queens, auto-cross toggle, timer (with localStorage), drag-to-cross (mouse + touch) |
| 4 | Solver step-through | Hint mode (dim + green borders + description); Apply; manual apply; dismiss; no-hint message; Rust step refactor |
| 5 | Change history | Undo/redo for player moves, hint applications, and editor strokes |
| 6 | Puzzle import + share | JSON import (regions only); embedded shareable URLs (puzzle and progress variants) |
| 7 | Custom editor | Edit-from-play; fresh board; scatter queens; shuffle colours; n-colour palette; live analysis Worker; JSON export |
| 8 | Editor live analysis | 300ms-debounced background analysis; cancellable; four indicator states |
| 9 | Generator UX | Generate button; size selector; optional seed (u32); Web Worker; difficulty shown |

---

## Next steps

Items deferred from this PRD for future consideration:

- **Post-solve experience**: the congratulations banner is a placeholder. Future work could add a
  "Generate a new puzzle" shortcut, a timer summary, or a difficulty reveal at solve time.
- **Default puzzle variety**: the app always opens to the same README example puzzle. A returning
  player will see a puzzle they have already solved. Options to consider: a daily puzzle fetched
  from the archive, a random puzzle on load, or a "next puzzle" button after solving.
