# PRD: Queens Puzzle Web UI

## Overview

Build a browser-based UI for the Queens puzzle — replacing the terminal-only experience with an interactive, visual board that any player can use without installing Rust. The Rust solver and generator are compiled to WebAssembly via `wasm-bindgen` and called directly from a React frontend.

## Goals

- Let anyone play a Queens puzzle in the browser with no install step.
- Expose the solver as a hint/step-through tool so players can learn solving techniques.
- Allow generating new puzzles on demand and loading custom puzzles.
- Keep the Rust core unchanged; only add a WASM boundary on top of it.

## Non-goals

- Mobile-native app (responsive web is  ^).
- User accounts, leaderboards, or persistence beyond a single session.
- Multiplayer or real-time collaboration.
- Replacing the CLI; both targets coexist in the same workspace.

---

## Features

### 1. Interactive board

The board is an n×n grid rendered with each cell's region colour. Players click a cell to cycle its state: Unknown → Queen → Empty → Unknown. The board enforces no rules on its own; illegal placements are allowed so that players can explore freely.

**Acceptance criteria**
- Clicking a cell cycles its state.
- Region colours match the existing palette (`region_color` in `puzzle.rs`).
- A "solved" banner appears when the player has placed exactly n non-attacking queens (one per row, column, and region, none diagonally adjacent).

### 2. Solver step-through

A "Hint" button applies the next logical deduction and highlights the cells involved (the same `changes` + `involved` data already present in `RuleResult`). A "Solve" button runs all steps to completion. After each step, the description text from `RuleResult::description` is shown.

**Acceptance criteria**
- "Hint" advances by exactly one rule application and displays the description.
- Changed cells are visually highlighted (green); involved cells are visually distinguished (e.g. underlined or outlined).
- "Solve" runs to completion or reports "brute force required" if logical solving gets stuck.
- The board state shown matches the state the CLI would produce.

### 3. Puzzle generation

A "Generate" button (with optional size selector, defaulting to 8) calls the WASM generator and loads the result into the board as a fresh puzzle.

**Acceptance criteria**
- Generated puzzles have exactly one solution (guaranteed by the generator).
- The difficulty rating is displayed after generation.
- Selecting sizes 4–12 is supported.

### 4. Custom puzzle editor

An "Edit" mode lets the user paint region colours onto cells to build a board from scratch. Each paint stroke assigns the selected region colour. Switching back to "Play" mode loads the painted layout as a puzzle.

**Acceptance criteria**
- The user can assign any of the 12 region colours to any cell.
- The editor validates that each region appears at least once and the board is n×n before allowing the switch to Play mode.
- Painted puzzles can be solved and stepped through exactly like generated ones.

### 5. Puzzle import

A text field accepts the text format described in the README (n lines × n characters). Submitting it loads the puzzle into the board.

**Acceptance criteria**
- Valid text-format puzzles load correctly.
- An inline error message is shown for malformed input.

---

## Technical design

### Repository structure

```
queens-puzzle/         (existing Rust workspace)
├── src/               (existing CLI binary)
├── wasm/              (new: wasm-bindgen crate)
│   ├── Cargo.toml
│   └── src/lib.rs     (thin JS-facing API over puzzle/solver/generator)
└── web/               (new: React app)
    ├── package.json
    └── src/
```

The `wasm` crate is a `cdylib` that re-exports the core types. The `web` app imports the compiled WASM package.

### WASM API surface (initial)

```rust
// wasm/src/lib.rs — indicative, not final

#[wasm_bindgen]
pub struct WasmPuzzle { ... }

#[wasm_bindgen]
impl WasmPuzzle {
    pub fn from_text(input: &str) -> Result<WasmPuzzle, JsValue>;
    pub fn generate(n: usize, seed: u64) -> WasmPuzzle;
    pub fn n(&self) -> usize;
    pub fn cell_region(&self, row: usize, col: usize) -> u8;
    pub fn cell_state(&self, row: usize, col: usize) -> u8;  // 0=Unknown 1=Queen 2=Empty
    pub fn set_cell_state(&mut self, row: usize, col: usize, state: u8);
    pub fn next_hint(&mut self) -> Option<WasmHint>;
    pub fn solve(&mut self) -> bool;  // returns true if solved logically
    pub fn is_solved(&self) -> bool;
    pub fn difficulty(&self) -> Option<String>;
}

#[wasm_bindgen]
pub struct WasmHint {
    pub description: String;
    // serialized as JSON arrays for JS consumption
    pub changes: Vec<u32>;   // [row, col, state, ...]
    pub involved: Vec<u32>;  // [row, col, ...]
}
```

### Frontend stack

| Concern | Choice |
|---------|--------|
| Framework | React (Vite) |
| Language | TypeScript |
| Styling | CSS Modules or Tailwind — TBD |
| WASM loading | `wasm-pack` output, loaded via `import()` |
| Build | `wasm-pack build --target bundler` + `vite` |

No state management library is needed at this scale; React `useState` / `useReducer` is sufficient.

---

## Milestones

| # | Milestone | Deliverable |
|---|-----------|-------------|
| 1 | WASM scaffold | `wasm-pack build` succeeds; `from_text` and `cell_region` callable from a browser console |
| 2 | Playable board | Board renders with region colours; click-to-cycle works; solved detection works |
| 3 | Solver UX | Hint and Solve buttons work with highlighting and description text |
| 4 | Generator UX | Generate button with size selector; difficulty shown |
| 5 | Editor + import | Paint-mode editor and text-format import |

---

## Open questions

- **Hosting**: static site (GitHub Pages) or a small server? Currently leaning toward static — no backend needed since all logic is in WASM.
- **Puzzle archive**: should the JSON archive (`linkedinPuzzles.json`) be bundled into the web build so players can browse past LinkedIn puzzles? Out of scope for now; revisit after milestone 2.
- **Undo/redo**: desirable for both play and edit modes, but requires recording a change list (noted as future work in the README). Defer until the "Record the list of changes" item is done.
