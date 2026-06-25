# PRD: Frontend Design Review

## Vision

The site is more than a place to play — it is a tool for understanding how constraint puzzles are solved. The four primary modes (Play, Solve, Editor, Generator) should each be reachable from a top-level tab bar so new visitors understand the full scope at a glance.

A footer on every page shows "Made by Daniel Jones", a link to the GitHub project, and "Inspired by [LinkedIn Queens](https://www.linkedin.com/games/queens/)".

An `/about` page is under consideration for the footer; see open questions.

All views support hotkeys (e.g. `Ctrl+Z` to undo, `H` to show hint).

---

## Navigation

Four top-level tabs replace the current single-page mode-toggle:

| Tab       | Route        | Purpose                                    |
|-----------|--------------|--------------------------------------------|
| Play      | `/play`      | Solve a puzzle (default, redirects from /) |
| Solve     | `/solve`     | Step through the solver with explanations  |
| Editor    | `/editor`    | Design a custom puzzle                     |
| Generator | `/generator` | Run and manage puzzle generation           |

Additional pages (not in the tab bar):
- `/rules` — Solver rules reference: every rule the solver knows, with plain-English explanations and worked examples. Linked from the Solve tab.
- `/tutorial` — How-to-play guide for first-time visitors. Linked from the Play tab.

---

## Puzzle representation

The canonical JSON format gains three optional metadata fields:

| Field        | Type     | Example             |
|--------------|----------|---------------------|
| `name`       | `string` | `"My Puzzle"`       |
| `source`     | `string` | `"LinkedIn Queens"` |
| `difficulty` | `string` | `"Medium"`          |

These are surfaced in the UI when present (e.g. displayed above the board in Play mode) and preserved on import/export. The text and archived formats are updated correspondingly.

---

## Play

### Landing state
The default puzzle is chosen randomly from a curated list of easy puzzles. A link to the tutorial page is shown prominently so first-time visitors can learn the rules.

When puzzle metadata is present (`name`, `source`, `difficulty`, solution count), it is displayed above the board. Difficulty is computed by the solver from an *unsolved* puzzle state, not derived from the stored field.

### Controls
- **Hint**, **Reset**, **Undo**, and **Share** become labelled buttons in the controls row. Settings moves to a global ⚙ icon in the header, accessible from all tabs.
- After 10 seconds of inactivity, the Hint button is highlighted and a prompt appears near it ("Tap for a hint").

### Import from screenshot
A "Import from screenshot" option lets users paste or upload an image of a Queens puzzle (e.g. from LinkedIn) and automatically extracts the region layout. This is a long-term feature.

### Current user flows (unchanged)
- Load puzzle from localStorage / URL hash → tap cells (empty → X → queen → empty cycle) → solved banner appears.
- Tap Hint → cells dim, hint bar appears with description → tap Apply or interact freely → hint clears.
- Tap Undo to step back through board state snapshots.
- Share encodes the puzzle as base64url in the URL fragment and copies to clipboard.
- Import: paste canonical JSON to replace the current puzzle.

---

## Solve

A step-through view that exposes the solver's internal reasoning.

- **Left panel**: the puzzle board, showing the current state at each step.
- **Right panel**: the list of solver rules in priority order. The active rule is highlighted with a plain-English explanation of exactly why it applies to the current board state, with board cells highlighted accordingly.
- Supports both **undo** and **redo** so the user can walk back and forth through the solution.
- A link to `/rules` allows users to read about any rule in depth.

---

## Editor

### Tool
The toolbar shows two tools plus the colour palette:
- **Paint** (✏ icon, default): drag across cells to paint the selected colour. Hotkeys `1`–`N` switch the active colour.
- **Reset region** (checkerboard icon): click any cell in a region to clear the entire region back to unassigned.

"Open in Play" opens in a new tab (↗ icon). It sits alongside a **Share / Export** button.

### Analysis
- The real-time validity calculation shows **"Calculating…"** immediately when a change invalidates the cached result, before the debounce fires.
- Analysis shows: valid layout, regions complete, queens placed, difficulty, and solution count.
- When multiple solutions exist, **row markers** (right of the board) and **column markers** (below the board) highlight which rows/columns have ambiguity. The problematic cells on the board are also highlighted so the author knows exactly where to add more region constraints.

### Puzzle info
A puzzle name and author field sit above the analysis panel so the author can label their creation before exporting.

### Other controls
Undo/Redo buttons, a **Change size** button (shows current size e.g. "8×8 ▾"), and Share/Export are all in the editor toolbar.

### Workflow guide
A how-to-use guide is shown in the editor UI, suggesting:
1. Select a colour and drag-paint cells.
2. Use *Shuffle queens* to find valid queen positions for the painted regions.
3. Alternatively, sketch a letter or shape first, then shuffle queens in.
4. Aim for exactly 1 solution — analysis updates as you paint.

### Queen overlay
The board displays the solver-determined queen positions for the current region layout so the user can see the solved state as they paint.

### Partial-region start
Allow beginning with some regions already assigned, then invoking Shuffle queens to fill in remaining placements.

### Long-term
A check that explores remaining region-assignment possibilities to verify a unique solution is achievable before all regions are fully drawn.

---

## Generator

### Management view
The generator is a persistent background management view. Generation runs independently of what the user is doing elsewhere.

- **Worker panel**: shows in-progress searches from one or more workers, with live status (size, seed, candidates tried, found count, progress bar).
- **Add worker** opens a dialog to configure size and seed (blank seed = random).
- **Results list**: found puzzles with size and difficulty, filterable by size and difficulty. Opening a puzzle from the results list opens it in a **new browser tab** (Play ↗ or Edit ↗) so generation is never interrupted.
- **Counter**: total puzzles found is always visible.
- Workers continue running when the user navigates away and resume on return.

---

## Settings

Settings (share, import, new game) are moved to a global location accessible from all tabs, no longer buried inside the Play controls row.

---

## Mobile and desktop

Both mobile and desktop are supported. Touch targets, button sizing, and layout must work well on small screens. Where patterns differ (e.g. bottom sheets vs floating panels), prefer patterns that degrade gracefully on mobile.

---

## Open questions

- Tutorial/rules pages: same SPA routes or separate static pages?
- Settings: slide-in drawer, dedicated page, or floating panel?
- Screenshot importer: client-side (WASM/canvas) or server-side OCR?
- About page: add `/about` to the footer? What would it contain?
- Play mode secondary actions: should there be "View solver steps" and "Edit this puzzle" links visible in Play mode?
