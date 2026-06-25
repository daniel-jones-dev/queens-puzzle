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
- **New game** requires a confirmation dialog before clearing progress.

### Current user flows (unchanged)
- Load puzzle from localStorage / URL hash → tap cells (empty → X → queen → empty cycle) → solved banner appears.
- Tap Hint → cells dim, hint bar appears with description → tap Apply or interact freely → hint clears.
- Tap Undo to step back through board state snapshots.
- Share encodes the puzzle as base64url in the URL fragment and copies to clipboard.
- Import: paste canonical JSON to replace the current puzzle.

---

## Solve

An annotated play view — you interact with the board exactly as in Play mode, and the solver rules panel on the right reflects the solver's analysis of the current board state in real time.

- **Entry point**: Solve is opened with a specific puzzle (e.g. via "Open in Solver" from Play). Navigating directly to `/solve` with no puzzle loaded shows a prompt: "Select a puzzle to solve — open a puzzle in Play first."
- **Left panel**: the puzzle board. Puzzle name and difficulty are shown **above** the board (same position as in Play). Click cells to cycle states (empty → X → queen) exactly as in Play mode.
- **Right panel**: the list of **solver rules** in priority order, grouped Easy / Medium / Hard. The rule the solver would apply next (given the current board state) is highlighted with a plain-English explanation. Board cells affected by that rule are highlighted.
- **No step counter.** Navigation is undo/redo of the player's own moves — there is no separate solver-controlled stepping.
- Undo/redo are available (same as Play). Undo history is preserved if the puzzle was originally opened from Play mid-solve.
- A link "All solver rules →" goes to `/rules`.
- **"Continue in Play →"** button opens the current board state in Play mode (with undo history intact).

---

## Editor

### Toolbar
A single row below the board. Exactly one tool is active at a time — all choices are mutually exclusive:
1. **🪄** (default): drag from an existing coloured cell to extend that region's colour into adjacent cells.
2. **Colour swatches 1–N**: each swatch is itself a tool. Selecting swatch N paints with that colour — click or drag any cell to paint it. Hotkeys `1`–`N` select swatches.
3. **Unset region** (checkerboard icon): click or drag any cell to clear it back to unassigned.
4. **Toggle queen** (♛): click a cell to toggle a queen placement without changing its region colour.

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
4. Puzzle should have exactly 1 solution — analysis updates as you edit.

### Queen overlay and Shuffle queens
The board displays solver-determined queen positions as a live overlay. When **Shuffle queens** is clicked, the solver runs and places one queen per region, clearing any previously placed queens. This replaces the entire queen assignment — partial-region support (shuffle into existing placements) is a future improvement.

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
- Workers run as long as the Generator tab is open. Navigating away from the Generator page (or closing the browser tab) requires a confirmation: "Leaving will stop all running workers." Workers do not persist across page refresh.

---

## Settings

Settings is a preference panel accessible from all tabs via the ⚙ button in the header. It contains only user preferences — no navigation commands. The three settings are:
- **Show clock** (toggle)
- **Auto-check** (toggle) — auto-validates queen placement
- **Auto-place X's** (toggle) — equivalent to the current "auto-cross cells" setting

---

## Mobile and desktop

Both mobile and desktop are supported. Touch targets, button sizing, and layout must work well on small screens.

- **Play**: the existing responsive cell-size formula handles small screens well. No structural change needed.
- **Solve**: same board-left / rules-right layout on desktop; on mobile the rules panel moves below the board.
- **Editor**: on mobile, the right-side analysis panel collapses to a compact summary row positioned **above** the board. Tapping the row expands a drawer with the full analysis and puzzle info. The board and toolbar remain visible and usable without the drawer open.
- **Generator**: the workers column stacks above the results column on mobile.
- **General**: prefer patterns that degrade gracefully (no fixed-width panels, use `flex-wrap` or column stacking rather than horizontal scroll).

---

## Decisions

- **Settings location**: Dropdown panel anchored to a ⚙ Settings ▾ button in the header right (not a page or slide-in drawer)
- **Screenshot importer**: Removed from Play tab for now. Potential future feature as its own tab; note in README as a possible next step.
- **About page**: A modal (not a separate page or tooltip).
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

Settings ▾ opens a preference panel with three toggles: Show clock, Auto-check, Auto-place X's. No navigation commands, no New game button.

## Editor layout

The toolbar is a **single row** below the board — no two-row layout. Left-to-right: `[🪄]` `[colour 1]` `[colour 2]` … `[colour N]` `[unset region]` `[♛]`. Hotkeys `1`–`N` switch the active colour.

## Generator

Worker cards show:
- Seed value — when the user left the seed blank, the resolved random seed is shown (e.g. `7,834,920 (auto)`)
- Stopped workers show **Restart** and **Delete** buttons instead of Stop

## Solve

The rules panel header is "Solver rules". Rules are grouped Easy / Medium / Hard. Each rule name links to `/rules`. Puzzle name and difficulty are shown **above** the board (same as Play). No step counter or Back/Next buttons — undo/redo of player moves drives navigation.

## Open questions

- ~~Tutorial/rules pages~~ — resolved: use SPA routes.
- ~~Built-in puzzle list~~ — resolved: use a dummy puzzle list for now; generate real puzzles later.

