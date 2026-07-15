use crate::grid::Cell;
use crate::puzzle::{block_name, QueensPuzzle, State};
use crate::solver::rule::{Rule, RuleResult};
use std::collections::HashSet;

impl Rule for NakedSet {
    fn check(&self, puzzle: &QueensPuzzle) -> Option<RuleResult> {
        for (block_cells, block_index, block_type) in puzzle.all_blocks_iter() {
            if block_cells.iter().any(|cell| puzzle[*cell] == State::Queen) {
                continue;
            }

            let unknown_cells = block_cells
                .into_iter()
                .filter(|cell| puzzle[cell] == State::Unknown)
                .collect::<Vec<_>>();
            if unknown_cells.len() > self.n {
                continue;
            }

            let connected_unknowns = unknown_cells
                .iter()
                .map(|cell| {
                    puzzle
                        .connected_cells(*cell)
                        .filter(|c| puzzle[c] == State::Unknown)
                        .collect::<HashSet<Cell>>()
                })
                .collect::<Vec<_>>();

            let common_connected_unknowns = connected_unknowns
                .clone()
                .into_iter()
                .reduce(|acc, conn_unknowns| {
                    acc.intersection(&conn_unknowns)
                        .cloned()
                        .collect::<HashSet<Cell>>()
                })
                .unwrap();

            if common_connected_unknowns.is_empty() {
                continue;
            }

            return Some(RuleResult {
                code_name: "naked_set",
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
                hint: format!("The highlighted {block_type} must contain a queen. A queen in the striped cells blocks this {block_type}.", )
            });
        }
        None
    }
}

/// If the remaining possibles for a row, column or region have some connected cells in common,
/// those cells must be empty.
pub struct NakedSet {
    pub n: usize,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cell;
    use crate::io::json;

    /// Generated 7×7 puzzle (seed 2554347766), partway through solving: columns A/B/D and
    /// most of the board are already resolved, leaving column C (index 2) down to two
    /// unknown cells at (5, 2) and (6, 2).
    fn build_test_puzzle() -> QueensPuzzle {
        let json = r#"{"regions":[[0,0,1,3,3,3,6],[0,0,1,3,4,6,6],[0,0,1,3,4,6,6],[0,1,1,4,4,5,6],[0,1,2,2,2,5,5],[0,1,2,2,5,5,5],[0,0,5,5,5,5,5]],"states":[[0,2,2,0,0,0,0],[0,2,2,0,2,0,0],[0,2,2,2,0,0,0],[0,0,2,0,0,2,0],[2,0,2,0,2,0,0],[0,0,0,0,2,0,0],[0,2,0,2,0,0,0]]}"#;
        json::parse(json).unwrap()
    }

    #[test]
    fn fires_on_column_c_with_two_remaining_cells() {
        let puzzle = build_test_puzzle();
        let result = NakedSet { n: 2 }.check(&puzzle).expect("rule should fire");

        assert_eq!(result.code_name, "naked_set");
        assert_eq!(
            result.involved.into_iter().collect::<HashSet<_>>(),
            HashSet::from([cell![5, 2], cell![6, 2]])
        );
        assert!(result
            .changes
            .iter()
            .all(|(_, state)| *state == State::Empty));
        assert_eq!(
            result
                .changes
                .into_iter()
                .map(|(cell, _)| cell)
                .collect::<HashSet<_>>(),
            HashSet::from([cell![5, 1], cell![5, 3], cell![5, 5], cell![5, 6]])
        );
    }

    #[test]
    fn does_not_fire_for_smaller_n() {
        let puzzle = build_test_puzzle();
        assert!(NakedSet { n: 1 }.check(&puzzle).is_none());
    }
}
