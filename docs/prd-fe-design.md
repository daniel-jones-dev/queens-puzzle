# PRD: Frontend Design Review

## Vision

The site is more than a place to play — it is a tool for understanding how constraint puzzles are solved. The four primary modes (Play, Solve, Editor, Generator) should each be reachable from a top-level tab bar so new visitors understand the full scope at a glance.

A footer on every page shows "Made by Daniel Jones", a link to the GitHub project, and any other relevant links.

All views support hotkeys (e.g. `Ctrl+Z` to undo, `H` to show hint).

---

## Navigation

Four top-level tabs replace the current single-page mode-toggle:

| Tab | Route        | Purpose                                    |
|-----|--------------|--------------------------------------------|
| Play | `/play`      | Solve a puzzle (default, redirects from /) |
| Solve | `/solve`     | Step through the solver with explanations  |
| Editor | `/editor`    | Design a custom puzzle                     |
| Generator | `/generator` | Run and manage puzzle generation           |

feedback
> some more ideas:
> - solver-rules page that explains the rules in more detail
> - puzzle importer to import a puzzle from a screenshot eg from linkedin
> - i want to include an optional name, source, difficulty fields in the puzzle representation (and correspondingly in the json and other formats) 
> - editor should have hotkeys to change tool (e.g. numbers for colours), make a suggestion in prd

---

## Play

### Landing state
The default puzzle is chosen randomly from a curated list of easy puzzles. A link to a tutorial/explanation page is shown prominently so first-time visitors can learn the rules.

### Controls
- **Hint**, **Reset**, and **Undo** become labelled buttons (text, not just icons). Settings moves out of the controls row into a global location shared across all tabs.
- After 10 seconds of inactivity, the Hint button is highlighted and a "Tap to show hint" prompt appears.

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
- **Right panel**: the list of solver rules, with the active rule highlighted and a plain-English explanation of why it applies.
- The solver iterates through rules in priority order; each step advances one rule application.
- Supports both **undo** and **redo** so the user can walk back and forth through the solution.
- Long-term: a separate page lists all solver rules with explanations, linked from this view.

---

## Editor

### Improvements
- The default tool is **drag-paint**: hold and drag to paint the selected colour across cells rather than single-click per cell.
- The real-time validity calculation shows **"Calculating…"** immediately when a change invalidates the cached result, before the debounce fires.
- A **how-to-use guide** is shown in the editor UI, suggesting a workflow: e.g. start by placing queens, shuffle them, then grow regions around them; or draw a letter/shape first and then shuffle queens in.
- The board displays **queen positions** from the current region layout so the user sees the solved state as they paint.
- **Partial-region start**: allow beginning with some regions already assigned, then invoking the generator/shuffler to fill in remaining queens and regions. For example, draw a letter or two, then let the tool place the remaining queens.
- Long-term: a check that explores remaining region-assignment possibilities to verify a unique solution is achievable.

---

## Generator

### Management view
feedback:
> actually would be clearer if from the generator page, opening a given puzzle opens in a new tab. but still, it should
> not interfere with the generator page
 
The generator becomes a persistent background management view rather than a blocking modal.

- **Worker panel**: shows in-progress searches from one or more workers, with live status.
- **Results list**: found puzzles displayed with their size and difficulty. Generation continues independently — the user can leave this tab to play or edit a found puzzle without interrupting the search.
- **Counter**: total number of solutions found is always visible.
- Selecting a found puzzle opens it in Play or Editor without stopping generation.

---

## Settings

Settings (share, import, new game) are moved to a global location accessible from all tabs, no longer buried inside the Play controls row.

---

## Mobile and desktop

Both mobile and desktop are supported. Touch targets, button sizing, and layout must work well on small screens. Where patterns differ (e.g. bottom sheets vs floating panels), prefer patterns that degrade gracefully on mobile.

---

## Open questions

- What links belong in the footer alongside GitHub and the author credit?
- Tutorial/rules page: same SPA route or a separate static page?
- Settings: slide-in drawer, dedicated page, or floating panel?
