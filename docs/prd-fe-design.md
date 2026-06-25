# PRD: Frontend Design Review

## Current user flows

### Play
Load puzzle from localStorage / URL hash → tap cells (empty → X → queen → empty cycle) → solved banner appears.

### Hint
Tap Hint button → cells dim, hint bar appears with description → tap Apply or interact freely → hint clears.

### Undo
Tap ↩ to step back through board state snapshots.

### Settings panel
Tap ⚙ → floating panel reveals: share puzzle, import puzzle, new game (generate), edit mode toggle.

### Generate
Modal with size / seed inputs → spinner → new puzzle loads in play mode.

### Edit
Separate mode (toggled from settings): paint regions on a blank grid; live analysis shows validity and difficulty.

### Import
Paste canonical JSON into a modal; replaces current puzzle on success.

### Reset
Tap 🗑 → confirm modal → board clears, timer resets.

---

## Open design questions

### Navigation model
Play and Edit are currently a single-page mode-toggle inside the settings panel. Should these be distinct routes/pages (e.g. `/play`, `/edit`), or stay as modes on one screen?

### Settings panel
Currently a `position: fixed` floating panel anchored to the controls row via `getBoundingClientRect`. Is a floating panel the right pattern, or would a slide-in drawer or a proper menu page feel better?

### Controls row layout
Current grouping: Hint (left) · Timer (centre) · Undo / Settings / Reset (right). Is this the right priority order? Should any controls move?

### New game entry point
Generate is currently two taps deep (⚙ → Generate). Should creating or loading a puzzle be more prominent — e.g. a top-level button or a dedicated screen?

### Mobile vs desktop
Is there a target breakdown, or is desktop primary? This affects how much weight to give touch targets, bottom-sheet patterns, etc.
