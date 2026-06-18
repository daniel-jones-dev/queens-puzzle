# PRD: Queens Puzzle Web UI

## Overview

Build a browser-based UI for the Queens puzzle — replacing the terminal-only experience with an interactive, visual board that any player can use without installing Rust. The Rust solver and generator are compiled to WebAssembly via `wasm-bindgen` and called directly from a React frontend.

## Goals

- Let anyone play a Queens puzzle in the browser with no install step; host statically on GitHub Pages.
- Expose the solver as a hint/step-through tool so players can learn solving techniques.
- Allow generating new puzzles on demand and importing custom puzzles via JSON.
- Support shareable URLs that encode a puzzle — either as a link to a remotely hosted JSON file or with
  the full puzzle JSON embedded directly in the URL.
- Rust core changes are welcome where needed (e.g. splitting into a library crate, exposing a
  step-by-step solver loop).

## Non-goals

- Mobile-native app (responsive web is sufficient).
- User accounts, leaderboards, or persistence beyond a single session.
- Multiplayer or real-time collaboration.
- Replacing the CLI; both targets coexist in the same workspace.

---

## Open decision: puzzle JSON format

Before milestone 2 begins, settle on the canonical JSON representation. The frontend, WASM API, URL
sharing, and import feature all use this format. **Three options** — pick one:

User feedback: we need to be able to store a cell region as undefined too, please update options below

User feedback: make a recommendation

**Option A — flat grid pair**
```json
{
  "n": 7,
  "regions": [[0,0,0,0,0,1,2], [0,0,0,1,1,1,2], ...],
  "states":  [[0,0,0,0,0,0,0], [0,0,0,0,0,0,0], ...]
}
```
`regions[row][col]` is the region index (0-based). `states[row][col]` is `0` (unknown), `1` (queen),
or `2` (empty). The `states` key is omitted or all-zero for an unsolved puzzle.

**Option B — puzzle + state split**
```json
{
  "puzzle":  { "n": 7, "regions": [[0,0,0,0,0,1,2], ...] },
  "state":   { "queens": [[0,2],[3,5]], "empty": [[0,0],[0,1]] }
}
```
The `puzzle` object is the shareable definition; `state` is the mutable game progress. Unsolved
puzzles omit `state`. Aligns naturally with "share this puzzle" vs "share my progress".

**Option C — LinkedIn-compatible**
```json
{ "id": 353, "date": "2025/04/18", "regions": [[0,0,0,0,0,0,1], ...] }
```
Matches the archived JSON already used by the CLI (`linkedinPuzzles.json`). No game-state field —
state is carried separately if needed. Easiest to load existing archives; harder to represent
partially-solved puzzles.

---

## Features

### 1. Interactive board

The board is an n×n grid rendered to match the visual style of the README example image: each cell
fills with its region colour and region boundaries are drawn with bold borders. Players click a cell
to cycle its state: Unknown → Queen → Empty → Unknown. The board enforces no rules on its own.
feedback: unknwon -> empty -> queen -> unknown. note that "empty" means a small cross (see readme example image)

Region colours must be consistent across the CLI and the web UI — both should match the colours
visible in the README screenshot.

feedback: add a reset button with a confirmation dialog

**Acceptance criteria**
- Clicking a cell cycles its state.
- Region colours match the README example image; the same palette is used by the CLI.
- Bold borders are drawn between cells that belong to different regions.
- A "solved" banner appears when the player has placed exactly n non-attacking queens (one per row,
  column, and region, none diagonally adjacent).

### 2. Improved interactive board

Quality-of-life features layered on top of the basic board, all toggled via UI controls.

- **Auto-cross** (toggle, default on): when a queen is placed, automatically mark every cell in the
  same row, column, region, or diagonally adjacent as empty.
- **Timer** (toggle, default on): a running clock showing elapsed time since the puzzle was started.
- **Drag-to-cross**: clicking and dragging across cells marks each cell under the cursor as empty.

feedback: mousing over a cell should darken that cell, but the region should not change.

feedback: any queens that clash with each other should be coloured red.

**Acceptance criteria**
- Auto-cross toggle updates the board immediately when turned on (applies retroactively to already-
  placed queens) and clears auto-crosses when turned off.
- Timer shows MM:SS, starts on first interaction, and stops when the puzzle is solved.
- Drag gesture crosses out all cells the pointer passes over; it does not interfere with single-click
  cycling.
  - feedback: only do this when the starting cell is empty, not when any queen is already in it. also dont change any queens to crossed out with this 
- No Rust changes required for this milestone.

### 3. Solver step-through

A "Hint" button applies the next logical deduction and highlights the cells involved (using the
`changes` and `involved` data from `RuleResult`). A "Solve" button runs all steps to completion.
After each step the description from `RuleResult::description` is shown.

The solver loop in Rust needs to be refactored to expose individual steps (one rule application at a
time) rather than running to completion internally.

**Acceptance criteria**
- "Hint" advances by exactly one rule application and displays the description.
- Changed cells are highlighted (green); involved cells are visually distinguished (outlined).
- "Solve" runs to completion or reports "brute force required" if logical solving gets stuck.
- Board state matches what the CLI would produce for the same puzzle.

### 4. Change history (undo/redo)

Record every state-changing action (player move, hint application, solve step) in a history list.
Undo and redo buttons walk backwards and forwards through it.

**Acceptance criteria**
- Undo reverts the most recent action; redo re-applies it.
- Hint and Solve steps are individually undoable.
- History is cleared when a new puzzle is loaded.

### 5. Puzzle import

A JSON import dialog accepts the puzzle JSON format decided in the open decision above. Submitting it
loads the puzzle into the board. URL-based loading (see feature 6) also uses this path.

The text-format import from the original PRD is dropped — the visual editor makes it redundant, and
JSON is a better interchange format.

**Acceptance criteria**
- Valid JSON puzzles load correctly.
- Partially-solved state (if present in the JSON) is restored.
- An inline error message is shown for malformed or invalid input.

### 6. Shareable URLs

A "Share" button encodes the current puzzle (and optionally the current board state) into a URL.
Two encoding modes:

- **Remote link**: a URL query parameter holds a URL pointing to a remotely hosted JSON file; on
  load the app fetches and parses it.
- **Embedded**: the full puzzle JSON is base64-encoded and embedded directly in the URL fragment,
  so no external fetch is needed and the link works entirely offline.

**Acceptance criteria**
- Visiting a share URL restores the puzzle (and state if embedded) without any manual import step.
- The Share dialog shows both forms of URL and lets the user copy either.
- An invalid or unreachable URL shows a clear error rather than a blank board.

### 7. Puzzle generation

A "Generate" button with a size selector (4–12, defaulting to 8) calls the WASM generator and
loads the result into the board as a fresh puzzle.

**Acceptance criteria**
- Generated puzzles have exactly one solution (guaranteed by the generator).
- The difficulty rating is displayed after generation.

### 8. Custom puzzle editor

An "Edit" mode lets the user paint region colours onto cells to build a board from scratch. Each
paint stroke assigns the selected region colour. Switching back to "Play" mode loads the painted
layout as a puzzle.

**Acceptance criteria**
- The user can assign any of the 12 region colours to any cell.
- The editor validates that the board is fully assigned and each of the n regions is contiguous
  before allowing the switch to Play mode.
- Painted puzzles can be solved and stepped through exactly like generated ones.
- The finished board can be exported as JSON (using the canonical format).

---

## Technical design

### Repository structure

```
queens-puzzle/
├── src/            (existing CLI binary — depends on core)
├── core/           (new: library crate with solver, generator, puzzle types)
│   ├── Cargo.toml
│   └── src/
├── wasm/           (new: cdylib crate — thin JS-facing wrapper over core)
│   ├── Cargo.toml
│   └── src/lib.rs
└── web/            (new: React/Vite app)
    ├── package.json
    └── src/
```

user feedback: Designate an area for tests as well.

Splitting the existing code into a `core` library crate means the CLI binary, the WASM crate, and
future targets all share one implementation with no duplication.

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
    pub description: String,
    pub changes: Vec<u32>,   // [row, col, state, ...] flattened triples
    pub involved: Vec<u32>,  // [row, col, ...] flattened pairs
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
| Hosting | GitHub Pages (static) |

No state management library is needed at this scale; React `useState` / `useReducer` is sufficient.

---

## Milestones

| # | Milestone | Deliverable |
|---|-----------|-------------|
| 0 | JSON format decision | Canonical puzzle JSON format agreed; documented here |
| 1 | WASM scaffold | `wasm-pack build` succeeds; `from_json` and `cell_region` callable from browser console |
| 2 | Playable board | Board renders with correct colours and bold region borders; click-to-cycle works; solved detection works |
| 3 | Improved board | Auto-cross toggle, timer, drag-to-cross |
| 4 | Solver step-through | Hint and Solve with highlighting; Rust solver refactored to expose individual steps |
| 5 | Change history | Undo/redo for all actions |
| 6 | Puzzle import + share | JSON import dialog; shareable URLs (remote link and embedded) |
| 7 | Generator UX | Generate button with size selector; difficulty shown |
| 8 | Custom editor | Paint-mode editor; JSON export |

feedback: reorder the editor and generator milestones
