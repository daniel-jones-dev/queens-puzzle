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
The default puzzle is chosen randomly from a curated built-in list of puzzles. The built-in list needs to be generated before this can ship. A link to the tutorial page is shown prominently so first-time visitors can learn the rules.

Puzzle metadata displayed above the board (when present):
- Name and author
- **Difficulty:** label with a styled badge (e.g. "Difficulty: Medium")
- Solution uniqueness: "Confirmed unique" (green badge) / "No solution" (red) / "Multiple solutions" (amber) — not "1 solution"

### Controls
- **Hint**, **Reset**, **Undo** are labelled buttons. Share is labelled **Copy link**. Settings moves to a global ⚙ icon in the header.
- After 10 seconds of inactivity, the Hint button pulses. No tooltip text is shown — the visual pulse is sufficient.

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

- **Left panel**: the puzzle board, showing the current state at each step. Puzzle name and difficulty ("Difficulty: Medium") are shown below the board.
- **Right panel**: the list of **solver rules** in priority order. The active solver rule is highlighted with a plain-English explanation of exactly why it applies to the current board state, with board cells highlighted accordingly.
- Supports both **undo** and **redo** so the user can walk back and forth through the solution.
- A link to "All solver rules →" goes to `/rules` so users can read about any solver rule in depth.

---

## Editor

### Toolbar
A single row below the board. Left-to-right order:
1. **🪄** (active tool — paint; click to re-select if a swatch was last clicked)
2. Colour swatches 1–N (one per region colour). Hotkeys `1`–`N` switch the active colour.
3. **Unset region** (checkerboard icon): click any cell in a region to clear it.
4. **Toggle queen** (♛): manually override a queen position.

No two-row layout — everything in one row.

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

## Decisions

- **Settings location**: Dropdown panel anchored to a ⚙ Settings ▾ button in the header right (not a page or slide-in drawer)
- **Screenshot importer**: Client-side — WASM/canvas, faster and works offline
- **About page**: Probably not needed as a separate page; too little content. May fold into footer or a tooltip.
- **Tutorial/rules pages**: TBD — see trade-offs below

### Tutorial/rules pages: SPA routes vs. static pages

**SPA routes** (`/tutorial`, `/rules` inside the React app):
- Pro: consistent header/nav, can deep-link to specific rules, no extra deploy step
- Con: slightly larger JS bundle, rules content needs to live in the repo as JSX/MDX

**Static pages** (separate HTML files, e.g. `tutorial.html`):
- Pro: zero JS overhead, easy to author in plain HTML/markdown, faster first load
- Con: loses the shared nav header unless duplicated; harder to link to board state

Recommendation: SPA routes — the nav consistency is worth it and rules content is small.

## Play layout

Below the board, three rows:
1. **Controls**: `[Hint]` — `[02:34]` — `[Undo]` `[Reset]`
2. **How to play** (collapsible, collapsed by default): one-line rules summary
3. **Actions**: `[Open in Solver]` `[Open in Editor]` `[Copy link]`
   - Open in Solver / Editor navigate the current page (not a new tab)
   - Copy link encodes the puzzle as base64url in the URL fragment and copies to clipboard

## Header

The header uses a three-column grid: logo (left) · nav tabs (centre) · settings (right). This prevents the settings button from colliding with the tab row at any viewport width.

Settings ▾ opens a dropdown panel containing: Share puzzle, Import puzzle, New game, Export, and cross-links to Solver/Editor.

## Editor layout

The toolbar is a **single row** below the board — no two-row layout. Left-to-right: `[🪄]` `[colour 1]` `[colour 2]` … `[colour N]` `[unset region]` `[♛]`. Hotkeys `1`–`N` switch the active colour.

## Generator

Worker cards show:
- Seed value — when the user left the seed blank, the resolved random seed is shown (e.g. `7,834,920 (auto)`)
- Stopped workers show **Restart** and **Delete** buttons instead of Stop

## Solve

**Solver rules** are grouped into **Easy / Medium / Hard** difficulty categories. The panel header is "Solver rules". Each rule name links to its entry on `/rules` ("All solver rules →"). Puzzle name and difficulty are shown below the board (not only in the rules panel).

## Open questions

- Tutorial/rules pages: recommendation is SPA routes — confirm?
- Built-in puzzle list: need to generate a curated set before shipping the Play landing state.

