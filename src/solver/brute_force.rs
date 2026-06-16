use crate::grid::Cell;
use crate::puzzle::{QueensPuzzle, State};

/// Recursively solve a puzzle by brute-forcing.
/// Solves the puzzle by checking each column for a valid queen placement and recursively
/// trying to place queens in later columns.
/// Returns the number of solutions found and writes solutions into the given vector.
pub fn solve(puzzle: &mut QueensPuzzle, solutions: &mut Vec<QueensPuzzle>) -> usize {
    solutions.clear();
    solve_helper(puzzle, 0, solutions);
    solutions.len()
}

fn solve_helper(puzzle: &mut QueensPuzzle, col: usize, solutions: &mut Vec<QueensPuzzle>) {
    // Stop at 10 solutions
    if solutions.len() >= 10 { return }

    // If the current column already has a queen, it is satisfied: record a solution if this is the
    // last column, otherwise move on to the next.
    if puzzle.queens().iter().any(|cell| cell.col == col) {
        if col == puzzle.n() - 1 {
            solutions.push(puzzle.clone());
        } else {
            solve_helper(puzzle, col + 1, solutions);
        }
        return;
    }

    for row in 0..puzzle.n() {
        let cell = Cell{row, col};
        if puzzle.is_valid_move(cell) {
            puzzle[cell] = State::Queen;

            // identify cells in this row that are unknown, and mark them as empty
            let unknown_in_row = puzzle.row_iter(row).into_iter()
                .filter(|cell: &Cell| puzzle[cell] == State::Unknown).collect::<Vec<_>>();
            unknown_in_row.iter().for_each(|cell| puzzle[*cell] = State::Empty);

            if col == puzzle.n() - 1 {
                solutions.push(puzzle.clone());
            } else {
                solve_helper(puzzle, col + 1, solutions);
            }

            // clear the cells marked empty above
            unknown_in_row.iter().for_each(|cell| puzzle[*cell] = State::Unknown);
            puzzle[cell] = State::Unknown;
        }
    }
}