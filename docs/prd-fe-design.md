# PRD: Frontend Design Review


feedback:
> Default landing page:
> - have an open puzzle (should be selected randomly a list of easy puzzles)
> - should have a link to an explanation/tutorial of the game to explain what the puzzle is (this can be a different page)
> - I want to make it clear this site is more than just a place to play, you can also: solve, editor, generator
> - also eventually I want to have a list of the rules the sovler uses, with explanations
>
> maybe there should be four "tabs"? Play, Solve, Editor, Generator
>
> play mode:
> - make hint, reset, undo into buttons with words. settings can be moved out of play mode, there will be settings for other modes too
> - after 10 seconds of inactivity, suggest to show a hint by highlighting the hint button and displaying text like "tap to show hint"
>
> should also add a solver mode
> - the idea here is to explain more about the reasoning of solving a puzzle
> - list the puzzle on the left, rules on the right, and show how the solver iterates down through the rules with each step
> - the solver should have redo support too
>
> the editor needs explanations and UI improvements:
> - the default "tool" shouldnt be a colour but rather drag-paint the selected colour
> - fix the real-time calculation to immediately show "calculating" when rechecking the number of solutions
> - long-term: add a check that explores the remaining possibilities of assigning regions and explores suitability (ie will there be a unique solution)
> - needs a how-to-use guide that suggests e.g. start by shuffling queens and then grow regions
> - show where the queens are in the grid
> - allow beginning by assigning some starting regions and then shuffling more queens in. e.g. you might start by drawing a letter or two in the grid then shuffling the queens in.
>
> the generator needs a lot of changes:
> - i want the generation view to be more a "management" view
> - show in-progress searches from worker(s)
> - list found solutions with sizes and difficulties. generation state should continue independent of viewing/editing/playing found puzzles
> - show the number of solutions found
> -
>
> all views should have hotkeys, like ctrl+z to undo, H for hint
> I also want a footer that says "Made by Daniel Jones", link to the github project, anyhting else?



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

feedback: I want to support both mobile and desktop.