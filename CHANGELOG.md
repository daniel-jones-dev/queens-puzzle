# Changelog

All notable changes to this project will be documented here.

## [Unreleased]

### Added
- **Web UI** deployed to GitHub Pages with four pages:
  - **Play** — interactive board with click-to-place queens, auto-cross, undo, timer, and share-by-URL
  - **Solve** — step through the solver's deduction chain with rule explanations and board highlights
  - **Editor** — paint custom region layouts, place queens manually, and export or share the result
  - **Generator** — run parallel background workers to generate and collect puzzles at chosen sizes
- **Hint system** on the Play page: highlights involved cells and dims the rest; distinguishes queen-placement from elimination hints visually
- **Share links**: puzzles are encoded as base64url JSON in the URL hash and decoded on load
- **Live uniqueness analysis** in the Editor: reports valid/invalid, solution count, and difficulty as you paint
- **Puzzle import**: paste or load canonical JSON directly into the Play or Editor page
- **WASM bindings** (`queens-puzzle-wasm` crate) wrapping the core library for use in the browser and web workers
- `RequiresGuessing` difficulty level for puzzles that exhaust all logical rules before reaching a solution
- GitHub Pages deployment via CI on every push to `main`
- Playwright end-to-end tests covering Play, Solve, Editor, Generator, and Analysis flows
- Git hooks via `.githooks/` (pre-commit: fmt + clippy; activated via `core.hooksPath`)
- Dependency audit CI job (`cargo audit` + `npm audit`)
- Content-Security-Policy header in the web app

### Fixed
- SPA routes now survive a hard reload on GitHub Pages (404 redirects to `index.html`)
- Timer no longer persists to localStorage after reset or when loading an already-solved puzzle
- Region border corners rendered correctly with SVG `strokeLinecap="square"` (eliminates CSS miter artifact)
- Worker instances are snapshotted before cleanup closures to prevent stale-reference bugs
- Hint-mode click on dimmed cells dismisses the hint and applies the click, except during queen-placement hints where it applies the click without dismissal

## [0.1.1] - 2026-06-16

### Added
- CI: `cargo fmt --check` and `cargo clippy -- -D warnings` on every push and pull request

## [0.1.0] - 2026-06-16

### Added
- Logical solver applying five techniques in order of increasing difficulty:
  - **Mark queen** (Trivial) — only cell left in a row, column, or region must be a queen
  - **Mark empty** (Trivial) — every cell adjacent to a queen (row, column, region, diagonal) must be empty
  - **Pointers** (Easy) — if a region's remaining cells share a row or column, the rest of that row/column is empty
  - **Naked set** (Medium/Hard) — *N* cells in a block that must collectively hold a queen eliminate other cells
  - **Hidden set** (Hard) — *N* regions confined to *N* rows/columns claim those rows/columns exclusively
- Brute-force fallback that enumerates all solutions when logic gets stuck
- Difficulty rating: Trivial, Easy, Medium, or Hard based on the hardest technique required
- Puzzle generator: places non-attacking queens at random then grows regions until all cells are assigned, guaranteeing exactly one solution
- CLI with `solve` and `generate` subcommands, `-v`/`-vv` verbosity, and true-colour terminal board rendering
- Text puzzle format and archived LinkedIn JSON format support
- CI: build and test workflow on every push and pull request
