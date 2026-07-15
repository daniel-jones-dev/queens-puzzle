use crate::grid::Cell;
use crate::puzzle::{column_name, region_color_name, row_name, QueensPuzzle, State};
use crate::solver;
use crate::solver::rule::{Rule, RuleResult};
use itertools::Itertools;
use std::collections::HashSet;

pub struct HiddenSet {
    pub n: usize,
}

impl Rule for HiddenSet {
    fn check(&self, puzzle: &QueensPuzzle) -> Option<RuleResult> {
        let unsolved_regions: Vec<(HashSet<Cell>, usize)> = puzzle
            .all_regions_iter()
            .filter(|(region, _)| !region.iter().any(|cell| puzzle[cell] == State::Queen))
            .collect();

        for permutation in unsolved_regions.iter().permutations(self.n) {
            let involved_cells: HashSet<Cell> = permutation
                .iter()
                .flat_map(|(region, _)| region.iter().copied())
                .collect();

            let mut unknowns: Option<(HashSet<Cell>, bool, HashSet<usize>)> = None;

            let row_indices: HashSet<usize> = permutation
                .iter()
                .map(|(region, _)| {
                    region
                        .iter()
                        .filter(|cell| puzzle[*cell] == State::Unknown)
                        .map(|cell| cell.row)
                        .collect::<HashSet<usize>>()
                })
                .reduce(|a, b| a.union(&b).cloned().collect())
                .unwrap();

            if row_indices.len() <= self.n {
                let unknowns_cells: HashSet<Cell> = row_indices
                    .iter()
                    .flat_map(|row| puzzle.row_iter(*row))
                    .filter(|cell| puzzle[cell] == State::Unknown)
                    .filter(|cell| !involved_cells.contains(cell))
                    .collect();
                if !unknowns_cells.is_empty() {
                    unknowns = Some((unknowns_cells, false, row_indices));
                }
            }
            if unknowns.is_none() {
                let col_indices: HashSet<usize> = permutation
                    .iter()
                    .map(|(region, _)| {
                        region
                            .iter()
                            .filter(|cell| puzzle[*cell] == State::Unknown)
                            .map(|cell| cell.col)
                            .collect::<HashSet<usize>>()
                    })
                    .reduce(|a, b| a.union(&b).cloned().collect())
                    .unwrap();

                if col_indices.len() <= self.n {
                    let unknowns_cells: HashSet<Cell> = col_indices
                        .iter()
                        .flat_map(|col| puzzle.col_iter(*col))
                        .filter(|cell| puzzle[cell] == State::Unknown)
                        .filter(|cell| !involved_cells.contains(cell))
                        .collect();
                    if !unknowns_cells.is_empty() {
                        unknowns = Some((unknowns_cells, true, col_indices));
                    }
                }
            }
            match unknowns {
                None => continue,
                Some((unknowns_cells, is_col, row_or_col_indices)) => {
                    let regions_sorted = permutation.iter().map(|(_, region)| *region).sorted();
                    let regions_group = format!(
                        "The {} regions",
                        solver::oxford_comma(
                            regions_sorted.map(|region| { region_color_name(region) })
                        )
                    );
                    let row_or_cols = if is_col { "columns" } else { "rows" };
                    let row_or_col_indices_sorted = row_or_col_indices.iter().copied().sorted();
                    let row_or_col_group = format!(
                        "{row_or_cols} {}",
                        solver::oxford_comma(row_or_col_indices_sorted.map(|index| {
                            if is_col {
                                column_name(index)
                            } else {
                                row_name(index)
                            }
                        }))
                    );
                    if is_col {
                        "columns"
                    } else {
                        "rows"
                    };
                    let description = format!(
                        "{regions_group} are confined to {row_or_col_group}, so other cells \
                     in these {row_or_cols} must be empty"
                    );

                    return Some(RuleResult {
                        code_name: "hidden_set",
                        changes: unknowns_cells
                            .into_iter()
                            .map(|cell| (cell, State::Empty))
                            .collect(),
                        involved: involved_cells.into_iter().collect(),
                        description,
                        hint: format!("Each highlighted region needs a queen. No room remains for queens from other regions in these {row_or_cols}."),
                    });
                }
            }
        }

        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cell;
    use crate::io::json;

    /// Generated 8×8 puzzle (seed 2176039665), partway through solving: the yellow (6) and
    /// grey (7) regions' remaining unknown cells are confined to the rightmost two columns
    /// (G and H, index 6 and 7), so (2, 6) — the only other unknown cell in those columns —
    /// must be empty.
    fn build_test_puzzle() -> QueensPuzzle {
        let json = r#"{"regions":[[0,1,1,3,3,3,6,6],[0,0,1,3,3,6,6,6],[0,0,0,5,3,3,3,6],[0,0,2,5,5,3,6,6],[0,0,2,2,5,5,6,6],[2,0,0,2,2,5,5,6],[2,2,2,2,7,7,7,7],[2,2,2,2,4,7,7,7]],"states":[[2,0,0,2,2,0,0,0],[2,2,0,0,2,2,0,0],[0,0,0,0,2,0,0,0],[0,0,0,0,2,0,0,0],[0,2,0,0,2,0,0,0],[0,2,2,0,2,0,2,2],[2,2,2,2,2,2,0,0],[2,2,2,2,1,2,2,2]]}"#;
        json::parse(json).unwrap()
    }

    #[test]
    fn fires_on_rightmost_two_columns() {
        let puzzle = build_test_puzzle();
        let result = HiddenSet { n: 2 }.check(&puzzle).expect("rule should fire");

        assert_eq!(result.code_name, "hidden_set");
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
            HashSet::from([cell![2, 6]])
        );

        let expected_involved: HashSet<Cell> = [
            cell![0, 6],
            cell![0, 7],
            cell![1, 5],
            cell![1, 6],
            cell![1, 7],
            cell![2, 7],
            cell![3, 6],
            cell![3, 7],
            cell![4, 6],
            cell![4, 7],
            cell![5, 7],
            cell![6, 4],
            cell![6, 5],
            cell![6, 6],
            cell![6, 7],
            cell![7, 5],
            cell![7, 6],
            cell![7, 7],
        ]
        .into_iter()
        .collect();
        assert_eq!(
            result.involved.into_iter().collect::<HashSet<_>>(),
            expected_involved
        );
    }

    #[test]
    fn does_not_fire_for_smaller_n() {
        let puzzle = build_test_puzzle();
        assert!(HiddenSet { n: 1 }.check(&puzzle).is_none());
    }
}
