use queens_puzzle_core::generator::{generate_puzzle, scatter_queens as core_scatter_queens};
use queens_puzzle_core::grid::Cell;
use queens_puzzle_core::io::json;
use queens_puzzle_core::puzzle::{region_color, QueensPuzzle, State};
use queens_puzzle_core::solver;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct WasmPuzzle {
    inner: QueensPuzzle,
}

#[wasm_bindgen]
impl WasmPuzzle {
    /// Parse a puzzle from the canonical JSON format.
    pub fn from_json(input: &str) -> Result<WasmPuzzle, JsValue> {
        json::parse(input)
            .map(|inner| WasmPuzzle { inner })
            .map_err(|e| JsValue::from_str(&e))
    }

    /// Create an empty n×n puzzle (all cells unassigned, for editor mode).
    pub fn new_empty(n: usize) -> WasmPuzzle {
        WasmPuzzle {
            inner: QueensPuzzle::new_empty(n),
        }
    }

    /// Generate a puzzle of size n with the given seed.
    /// The seed is u32 to stay within JS's safe integer range; widened to u64 internally.
    pub fn generate(n: usize, seed: u32) -> WasmPuzzle {
        WasmPuzzle {
            inner: generate_puzzle(n, seed as u64),
        }
    }

    /// Create an n×n puzzle with n non-attacking queens placed as single-cell starter regions.
    pub fn scatter_queens(n: usize, seed: u32) -> WasmPuzzle {
        WasmPuzzle {
            inner: core_scatter_queens(n, seed as u64),
        }
    }

    /// Serialize the puzzle to the canonical JSON format.
    pub fn to_json(&self) -> String {
        json::serialize(&self.inner)
    }

    pub fn n(&self) -> usize {
        self.inner.n()
    }

    /// Returns the region index for a cell, or `undefined` if unassigned.
    pub fn cell_region(&self, row: usize, col: usize) -> Option<u8> {
        self.inner.cell_region(Cell { row, col })
    }

    /// Assign or unassign a cell's region (pass `undefined` to unassign).
    /// Silently overwrites any existing assignment.
    pub fn set_cell_region(&mut self, row: usize, col: usize, region: Option<u8>) {
        self.inner.set_cell_region(Cell { row, col }, region);
    }

    /// Returns the cell state: 0 = Unknown, 1 = Queen, 2 = Empty.
    pub fn cell_state(&self, row: usize, col: usize) -> u32 {
        match self.inner.cell_state(Cell { row, col }) {
            State::Unknown => 0,
            State::Queen => 1,
            State::Empty => 2,
        }
    }

    /// Set a cell state: 0 = Unknown, 1 = Queen, 2 = Empty. Panics if state is not 0, 1, or 2.
    pub fn set_cell_state(&mut self, row: usize, col: usize, state: u32) {
        let s = match state {
            0 => State::Unknown,
            1 => State::Queen,
            2 => State::Empty,
            _ => panic!("invalid state value: {state}"),
        };
        self.inner.set_cell_state(Cell { row, col }, s);
    }

    /// Returns the next logical hint without mutating the puzzle.
    pub fn next_hint(&self) -> Option<WasmHint> {
        solver::next_hint(&self.inner).map(|result| WasmHint {
            code_name: result.code_name.to_owned(),
            description: result.description,
            changes: result
                .changes
                .iter()
                .flat_map(|(cell, state)| {
                    let s: u32 = match state {
                        State::Unknown => 0,
                        State::Queen => 1,
                        State::Empty => 2,
                    };
                    [cell.row as u32, cell.col as u32, s]
                })
                .collect(),
            involved: result
                .involved
                .iter()
                .flat_map(|cell| [cell.row as u32, cell.col as u32])
                .collect(),
        })
    }

    /// Returns flattened [row, col, ...] pairs for all cells affected by a queen at (row, col).
    /// Includes same row, column, region, and diagonally adjacent cells; excludes the queen itself.
    /// Duplicates are removed.
    pub fn cells_affected_by_queen(&self, row: usize, col: usize) -> Vec<u32> {
        let mut seen = std::collections::HashSet::new();
        let mut result = Vec::new();
        for cell in self.inner.connected_cells(Cell { row, col }) {
            if seen.insert((cell.row, cell.col)) {
                result.push(cell.row as u32);
                result.push(cell.col as u32);
            }
        }
        result
    }

    pub fn is_solved(&self) -> bool {
        self.inner.is_solved()
    }

    /// Count solutions for the current region layout (ignoring player state). Capped at 10.
    pub fn count_solutions(&self) -> u32 {
        let mut clone = self.inner.clone();
        for row in 0..clone.n() {
            for col in 0..clone.n() {
                clone.set_cell_state(Cell { row, col }, State::Unknown);
            }
        }
        let mut solutions = Vec::new();
        solver::brute_force::solve(&mut clone, &mut solutions) as u32
    }

    /// Returns the difficulty string, or `undefined` if it cannot be determined.
    /// Always rates from a clean board (all player states reset) so progress doesn't skew the result.
    pub fn difficulty(&self) -> Option<String> {
        let mut clone = self.inner.clone();
        let n = clone.n();
        for row in 0..n {
            for col in 0..n {
                clone.set_cell_state(Cell { row, col }, State::Unknown);
            }
        }
        solver::rate_puzzle(&mut clone).map(|d| format!("{}", d))
    }

    /// Returns flattened [row, col, ...] pairs for all queens currently in conflict.
    pub fn clashing_queens(&self) -> Vec<u32> {
        self.inner
            .clashing_queens()
            .iter()
            .flat_map(|cell| [cell.row as u32, cell.col as u32])
            .collect()
    }

    /// Returns the region colour as a CSS hex string (e.g. "#bba3e2") for a given region index.
    pub fn region_color_hex(region_index: usize) -> String {
        let c = region_color(region_index);
        format!("#{:02x}{:02x}{:02x}", c.r, c.g, c.b)
    }

    /// Returns flattened [row, col, ...] queen positions for the first solution.
    /// Returns an empty Vec if no solution exists.
    /// Ignores current player states — analyses the region layout only.
    pub fn solve_one(&self) -> Vec<u32> {
        let n = self.inner.n();
        let mut clone = self.inner.clone();
        for row in 0..n {
            for col in 0..n {
                clone.set_cell_state(Cell { row, col }, State::Unknown);
            }
        }
        let mut solutions = Vec::new();
        solver::brute_force::solve(&mut clone, &mut solutions);
        if solutions.is_empty() {
            return Vec::new();
        }
        solutions[0]
            .queens()
            .iter()
            .flat_map(|cell| [cell.row as u32, cell.col as u32])
            .collect()
    }

    /// Combined analysis: returns [count, row0_ambiguous, ..., rowN-1_ambiguous,
    /// col0_ambiguous, ..., colN-1_ambiguous] where count is capped at 10 and
    /// ambiguous values are 0/1 (meaningful only when count >= 2).
    /// A row/col is ambiguous if queen placement differs between the first two solutions.
    pub fn solution_analysis(&self) -> Vec<u32> {
        use std::collections::HashMap;
        let n = self.inner.n();
        let mut clone = self.inner.clone();
        for row in 0..n {
            for col in 0..n {
                clone.set_cell_state(Cell { row, col }, State::Unknown);
            }
        }
        let mut solutions = Vec::new();
        solver::brute_force::solve(&mut clone, &mut solutions);
        let count = solutions.len() as u32;

        let mut ambiguous = vec![0u32; 2 * n];
        if solutions.len() >= 2 {
            let queens0: HashMap<usize, usize> = solutions[0]
                .queens()
                .iter()
                .map(|c| (c.row, c.col))
                .collect();
            let queens1: HashMap<usize, usize> = solutions[1]
                .queens()
                .iter()
                .map(|c| (c.row, c.col))
                .collect();
            for row in 0..n {
                if queens0.get(&row) != queens1.get(&row) {
                    ambiguous[row] = 1;
                }
            }
            for col in 0..n {
                let r0 = queens0.iter().find(|(_, v)| **v == col).map(|(k, _)| *k);
                let r1 = queens1.iter().find(|(_, v)| **v == col).map(|(k, _)| *k);
                if r0 != r1 {
                    ambiguous[n + col] = 1;
                }
            }
        }

        let mut result = vec![count];
        result.extend(ambiguous);
        result
    }
}

#[wasm_bindgen]
pub struct WasmHint {
    code_name: String,
    description: String,
    /// Flattened [row, col, state, ...] triples; state values 0/1/2
    changes: Vec<u32>,
    /// Flattened [row, col, ...] pairs
    involved: Vec<u32>,
}

#[wasm_bindgen]
impl WasmHint {
    /// Stable rule identifier (e.g. `"mark_queen"`) — used by the web UI to look up
    /// rule metadata in rules.ts without depending on the human-readable description text.
    pub fn name(&self) -> String {
        self.code_name.clone()
    }

    pub fn description(&self) -> String {
        self.description.clone()
    }

    pub fn changes(&self) -> Vec<u32> {
        self.changes.clone()
    }

    pub fn involved(&self) -> Vec<u32> {
        self.involved.clone()
    }
}
