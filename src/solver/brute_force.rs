use crate::grid::Cell;
use crate::puzzle::{QueensPuzzle, State};

/// Recursively solve a puzzle by brute-forcing.
/// Solves the puzzle by checking each column for a valid queen placement and recursively
/// trying to place queens in later columns.
/// Returns true if a solution is found, false otherwise.
/// Modifies the puzzle in place.
pub fn solve(puzzle: &mut QueensPuzzle) -> bool {
    solve_helper(puzzle, 0)
}

fn solve_helper(puzzle: &mut QueensPuzzle, col: usize) -> bool {
    if col >= puzzle.n() {
        return true;
    }

    // If the current column already has a queen, continue to the next column
    if puzzle.queens().iter().any(|cell| cell.col == col) {
        return solve_helper(puzzle, col + 1);
    }

    for row in 0..puzzle.n() {
        let cell = Cell{row, col};
        if puzzle.is_valid_move(cell) {
            puzzle[cell] = State::Queen;
            // TODO identify cells connected to this queen that are unknown, and mark them as empty

            if solve_helper(puzzle, col + 1) {
                return true;
            }

            // TODO clear the cells marked empty above
            puzzle[cell] = State::Unknown;
        }
    }

    false
}