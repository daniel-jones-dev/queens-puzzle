use crate::grid::Cell;
use crate::puzzle::{block_name, cell_name, QueensPuzzle, State};
use crate::solver::rule::{Rule, RuleResult};
use itertools::Itertools;
use std::collections::HashSet;

/// The simplest rule: if there is only possibility remaining for a row, column, or region, it
/// must be a queen.
pub struct MarkQueen;

impl MarkQueen {
    fn check_block_has_single_unknown_and_no_queen(
        &self,
        puzzle: &QueensPuzzle,
        block_cells: &HashSet<Cell>,
    ) -> Option<Cell> {
        if block_cells.iter().any(|cell| puzzle[cell] == State::Queen) {
            return None;
        }
        match block_cells
            .iter()
            .filter(|cell| puzzle[*cell] == State::Unknown)
            .exactly_one()
        {
            Ok(cell) => Some(*cell),
            Err(..) => None,
        }
    }
}

impl Rule for MarkQueen {
    fn check(&self, puzzle: &QueensPuzzle) -> Option<RuleResult> {
        for (block_cells, block_index, block_type) in puzzle.all_blocks_iter() {
            if let Some(single_unknown_cell) =
                self.check_block_has_single_unknown_and_no_queen(puzzle, &block_cells)
            {
                return Some(RuleResult {
                    code_name: "mark_queen",
                    changes: vec![(single_unknown_cell, State::Queen)],
                    involved: block_cells
                        .iter()
                        .filter(|c| single_unknown_cell != **c)
                        .copied()
                        .collect(),
                    description: format!(
                        "{} must contain a queen, and no cell except {} can \
                    contain a queen, so it must be a queen",
                        block_name(block_type, block_index),
                        cell_name(single_unknown_cell)
                    ),
                });
            }
        }
        None
    }
}
