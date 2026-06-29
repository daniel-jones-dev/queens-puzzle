use crate::grid::Cell;
use crate::puzzle::{cell_name, QueensPuzzle, State};
use crate::solver::rule::{Rule, RuleResult};

/// This rule marks cells connected to a queen as empty.
pub struct MarkEmpty;

impl Rule for MarkEmpty {
    fn check(&self, puzzle: &QueensPuzzle) -> Option<RuleResult> {
        let queens = puzzle.queens();
        for queen_cell in queens {
            let connected_cells_unknown = puzzle
                .connected_cells(queen_cell)
                .filter(|cell: &Cell| puzzle[cell] == State::Unknown)
                .collect::<Vec<_>>();
            if !connected_cells_unknown.is_empty() {
                return Some(RuleResult {
                    code_name: "mark_empty",
                    changes: connected_cells_unknown
                        .into_iter()
                        .map(|cell: Cell| (cell, State::Empty))
                        .collect::<Vec<_>>(),
                    involved: vec![queen_cell],
                    description: format!(
                        "The queen in {} means that all cells in \
                    the same row, column, region and neighbouring cells must be empty",
                        cell_name(queen_cell)
                    ),
                });
            }
        }

        None
    }
}
