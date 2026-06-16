use crate::grid::Cell;
use crate::puzzle::{block_name, QueensPuzzle, State};
use crate::solver::rule::{Rule, RuleResult};
use std::collections::HashSet;

impl Rule for NakedSet {
    fn check(&self, puzzle: &QueensPuzzle) -> Option<RuleResult> {
        for (block_cells, block_index, block_type) in puzzle.all_blocks_iter() {
            // Check there are no queens and at least N unknown cells
            if block_cells.iter().any(|cell| puzzle[*cell] == State::Queen) {
                continue;
            }

            let unknown_cells = block_cells
                .into_iter()
                .filter(|cell| puzzle[cell] == State::Unknown)
                .collect::<Vec<_>>();
            if unknown_cells.len() <= self.n {
                continue;
            }

            // Loop through all unknown cells, and find their connected cells that are unknown
            let connected_unknowns = unknown_cells
                .iter()
                .map(|cell| {
                    puzzle
                        .connected_cells(*cell)
                        .filter(|c| puzzle[c] == State::Unknown)
                        .collect::<HashSet<Cell>>()
                })
                .collect::<Vec<_>>();

            // Now intersect them
            let common_connected_unknowns = connected_unknowns
                .clone()
                .into_iter()
                .reduce(|acc, conn_unknowns| {
                    acc.intersection(&conn_unknowns)
                        .cloned()
                        .collect::<HashSet<Cell>>()
                })
                .unwrap(); // Safe, checked above there are at least two unknown cells

            if common_connected_unknowns.is_empty() {
                continue;
            }

            return Some(RuleResult {
                changes: common_connected_unknowns
                    .into_iter()
                    .map(|cell| (cell, State::Empty))
                    .collect(),
                involved: unknown_cells,
                description: format!(
                    "One of these cells in {} must be a queen, so these cells \
                must be empty",
                    block_name(block_type, block_index)
                ),
            });
        }
        None
    }
}

/// If the remaining possibles for a row, column or region have some connected cells in common,
/// those cells must be empty.
/// For example, if the two middle cells here belong to a region, then the surrounding six cells
/// can be marked empty:
///  <code>
///     [ ][x][x][ ]
///     [x]{ }{ }[x]
///     [ ][x][x][ ]
///   </code>
/// Remark: Naming comes from sudokuwiki.org "Naked Pair"
pub struct NakedSet {
    pub(crate) n: usize,
}
