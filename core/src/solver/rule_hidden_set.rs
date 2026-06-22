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
                        changes: unknowns_cells
                            .into_iter()
                            .map(|cell| (cell, State::Empty))
                            .collect(),
                        involved: involved_cells.into_iter().collect(),
                        description,
                    });
                }
            }
        }

        None
    }
}
