# CLAUDE.md — Queens Puzzle

## Repository layout

```
queens-puzzle/
├── src/       CLI binary (depends on core; coloured output, clap, env_logger)
├── core/      Library crate — solver, generator, puzzle types, IO
│   └── src/
│       ├── io/json.rs    Canonical JSON format (used by WASM and web UI)
│       └── io/text.rs    Text/archive formats (used by the CLI)
├── wasm/      cdylib crate — wasm-bindgen wrapper over core
│   └── src/lib.rs        Full WASM API surface (WasmPuzzle, WasmHint)
├── web/       React + Vite frontend — see web/CLAUDE.md for details
└── docs/      formats.md (puzzle format spec)
```

The root `Cargo.toml` is simultaneously the workspace root and the CLI binary package.

## Git

The `main` branch is protected — never push directly to it. All changes go through branches and PRs.

## Build commands

```bash
# Build CLI
cargo build --release

# Run Rust tests
cargo test

# Web: see web/CLAUDE.md
```

## Puzzle formats

See [docs/formats.md](docs/formats.md) for the full specification of all supported formats.

The canonical JSON format (used by the WASM API, frontend state, URL sharing, and import/export)
is implemented in `core/src/io/json.rs`. The text and archived JSON formats used by the CLI are
in `core/src/io/text.rs` and `core/src/io/json.rs` respectively.

## getrandom on wasm32

`getrandom` requires the `wasm_js` feature to compile for `wasm32-unknown-unknown`. This is
already set in `wasm/Cargo.toml`. If you add a new dependency that transitively uses `getrandom`,
ensure this feature remains active.
