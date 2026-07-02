# CLAUDE.md — web

## Build commands

```bash
# Build WASM and start the Vite dev server
npm run dev

# Build WASM only
npm run wasm

# Run Playwright tests (dev server must already be running)
npx playwright test
```

`npm run wasm` runs: `wasm-pack build ../wasm --target web --out-dir ../web/wasm-pkg`

`--out-dir` is resolved relative to the wasm crate directory, so `../web/wasm-pkg` lands where
`package.json` expects it at `file:./wasm-pkg`.

## Critical: WASM build target

Always use `--target web`, never `--target bundler`.

With `--target bundler`, WASM initialises as an ES module side-effect that a bundler plugin
intercepts for the main thread. Web Workers do not go through that plugin, so they get stuck
with WASM uninitialised.

With `--target web`, the package exports an explicit `async init()`. Both the main thread and
each Worker call `await init()` independently before using any WASM types.

In workers:
```typescript
import init, { WasmPuzzle } from "queens-puzzle-wasm";
// MUST call init() before using WasmPuzzle — workers cannot share the main thread's instance
await init();
```

Use `initWasm.ts` on the main thread (singleton promise, safe to call multiple times).

## WASM API surface

`WasmPuzzle` (defined in `../wasm/src/lib.rs`):

| Method | Notes |
|--------|-------|
| `from_json(s)` | Parses canonical JSON; returns `Result<WasmPuzzle, JsValue>` |
| `new_empty(n)` | Blank n×n grid for editor mode |
| `generate(n, seed)` | `seed` is `u32` (JS safe integer); widened to `u64` internally |
| `to_json()` | Serialises to canonical JSON |
| `n()` | Board size |
| `cell_region(r, c)` | `Option<u8>` → `number \| undefined` |
| `set_cell_region(r, c, region)` | `None` unassigns; silently overwrites existing region |
| `cell_state(r, c)` | `u32` — 0/1/2 |
| `set_cell_state(r, c, state)` | Panics if state not 0/1/2 |
| `next_hint()` | Non-mutating; clones internally; returns `Option<WasmHint>` |
| `is_solved()` | |
| `difficulty()` | `Option<String>` — `None` if not yet determined |
| `clashing_queens()` | Flattened `[row, col, ...]` pairs |
| `region_color_hex(i)` | Static; returns `"#rrggbb"` string |

`WasmHint`:
- `name()` — stable rule code name (matches `codeName` in `web/src/data/rules.ts`)
- `description()` — human-readable explanation of the step
- `changes()` — flattened `[row, col, state, ...]` triples
- `involved()` — flattened `[row, col, ...]` pairs (cells to highlight)

## Region colours

`region_color_hex` in `wasm/src/lib.rs` is the source of truth for the 12-colour palette. If
the CLI ever gains coloured board output, derive colours from `core` so both targets stay in sync.

## Web UI implementation notes

### Board rendering
Region borders are drawn as an SVG overlay (`position: absolute` over the board grid) rather than
CSS `border` properties on individual cells. This avoids the CSS corner miter artifact where a
thick border meets a thin border at the same cell corner. SVG `<line>` elements with
`strokeLinecap="square"` fill the corner pixels correctly.

Cell size is responsive: `Math.min(56, Math.max(32, Math.floor((window.innerWidth - 32) / n)))`
on load and on `resize`. The computed value is passed as a prop to `Board` and used for grid
template columns, cell width/height, and icon font sizes.

### Above-board header (AboveBoard component)
`AboveBoard.tsx` is a shared component used by both PlayPage and SolvePage. It renders three
lines above the board:

1. **⚙ Settings** (left) and **Reset** (right) — always visible.
2. Puzzle name and author — omitted when both are absent.
3. Difficulty badge, "✓ Unique" badge, and timer — omitted when all are absent.

The settings button is wrapped in `.settingsAnchor { position: relative }`. `SettingsPanel`
renders as `position: absolute; top: calc(100% + 8px); right: 0` so the panel drops directly
below the button. A `position: fixed; inset: 0` backdrop sits behind the panel to catch
outside-click dismissals.

### Controls row (PlayPage)
A single row below the board:

- **Left**: Hint button (hidden when the puzzle is solved).
- **Right**: ↩ Undo.

The row must stay in normal document flow (not `position: absolute` over the board). If it
overlaps other elements, pointer events on those elements are lost.

### Timer
The `setInterval` ID is stored in `timerIntervalRef`. When resetting a solved puzzle, `doReset`
calls `clearInterval(timerIntervalRef.current)` **before** `localStorage.removeItem(TIMER_KEY)`.
This prevents a race where the interval fires between the `removeItem` call and React's next
render.

The timer effect guards on `solved`: it never starts the interval if the puzzle loads already
completed, preventing the timer from ticking after a page refresh on a finished puzzle.

### Hint mode
Hint state lives in `PlayPage.tsx` as `HintState | null` containing `name` (rule code name),
`description`, `changes: Map<string, number>` ("r,c" → target state), and `involved: Set<string>`.

**Dimming**: non-involved cells receive a dark semi-transparent overlay. Empty non-involved cells
use `rgba(0,0,0,0.42)`; cells that already have a queen or cross use `rgba(0,0,0,0.18)` so
existing marks remain readable. Hint-change cells and involved cells receive no dim overlay.

**Hint-change overlays** (rendered above the dim layer in `Board.tsx`):
- Target state `2` (cross): diagonal stripe pattern (`repeating-linear-gradient`).
- Target state `1` (queen): no overlay — the queen icon alone signals the placement.

**Region border dimming**: `Board.tsx` tracks the two adjacent cells for each SVG segment. When
both adjacent cells are dimmed, the segment strokes at `rgba(0,0,0,0.18)` instead of the normal
`rgba(0,0,0,0.5)`.

**Dimmed-cell click behaviour**: clicking a dimmed cell dismisses the hint and processes the
click normally, **except** when the hint is a queen-placement hint (any `changes` entry has
state `1`). In that case, clicking a dimmed cell processes the click without dismissing — the
player can freely cross out cells while being guided to place a queen.
Detection: `[...activeHint.changes.values()].some(s => s === 1)`.

### Change history
`past: number[][][]` and `future: number[][][]` are undo/redo stacks of full board state
snapshots. A snapshot is taken (via `readStates(puzzle)`) immediately before every mutation.
On undo, the top of `past` is restored and the current state is pushed to `future`. Redo is
not exposed in the UI.

`handleUndo` also manages timer state: if the puzzle was solved and undo moves to an unsolved
state, `setTimerRunning(true)` is called. History is cleared on reset and when a new puzzle loads.

### Import and share
`WasmPuzzle.to_json()` always strips `name`, `source`, and `date` (the Rust `from_puzzle()`
hardcodes them to `None`). `handleShare` in PlayPage works around this by parsing the WASM
output, injecting `puzzleMeta.{name, source, date}` back in, then base64url-encoding the result.
`puzzleMeta` is populated from the raw JSON at load time via `parsePuzzleMeta()` in `utils.ts`.

The share button shows "✓ Copied!" for 2 s via `shareToast` state.

On startup the init `useEffect` checks `window.location.hash` before falling back to
`loadPuzzle()` (localStorage → default). A successful hash decode calls
`history.replaceState(null, "", window.location.pathname)` to strip the fragment, then persists
to localStorage. A failed decode sets `urlError` state which renders as a dismissable amber banner.
