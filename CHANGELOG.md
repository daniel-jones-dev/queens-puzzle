# Changelog

All notable changes to this project will be documented here.

## [Unreleased]

### Added
- Web UI with Play, Solve, Editor, and Generator pages
- Logical solver with five deduction rules rated Trivial → Hard
- Brute-force fallback for puzzles the logical solver cannot crack
- Puzzle generator producing layouts with exactly one solution
- Share-by-URL for puzzles (base64url-encoded JSON in the hash)
- Hint system with step-by-step rule explanations and cell highlighting
- Undo history and timer on the Play page
- Live uniqueness analysis in the Editor
- Parallel background workers on the Generator page
- CLI commands: `solve` and `generate` with colourful terminal output
- Support for text, archived JSON, and canonical JSON puzzle formats
