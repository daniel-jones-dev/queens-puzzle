use crate::grid::Cell;
use crate::puzzle::{column_name, region_color_name, row_name, QueensPuzzle, State};
use crate::solver;
use crate::solver::rule::{Rule, RuleResult};
use itertools::Itertools;
use std::collections::HashSet;

pub struct HiddenSet {
    // Naming comes from sudokuwiki.org "Hidden Pair"
    pub(crate) n: usize,
}

impl Rule for HiddenSet {
    fn check(&self, puzzle: &QueensPuzzle) -> Option<RuleResult> {
        // Search for N unsolved regions whose cells lie wholly within N rows or columns

        // Filter out unsolved regions, ie not containing a queen
        let unsolved_regions: Vec<(HashSet<Cell>, usize)> = puzzle
            .all_regions_iter()
            .filter(|(region, _)| !region.iter().any(|cell| puzzle[cell] == State::Queen))
            .collect();

        // Check each permutation of N unsolved regions
        for permutation in unsolved_regions.iter().permutations(self.n) {
            let involved_cells: HashSet<Cell> = permutation
                .iter()
                .flat_map(|(region, _)| region.iter().copied())
                .collect();

            // Unknowns to change found, whether they are in rows or columns, and the row/col indices
            let mut unknowns: Option<(HashSet<Cell>, bool, HashSet<usize>)> = None;

            // Determine the distinct rows covered by these regions
            let row_indices: HashSet<usize> = permutation
                .iter()
                // Find distinct rows covered by each region
                .map(|(region, _)| {
                    region
                        .iter()
                        .map(|cell| cell.row)
                        .collect::<HashSet<usize>>()
                })
                // Combine each region's rows by union
                .reduce(|a, b| a.union(&b).cloned().collect())
                .unwrap();

            // If there are only N rows
            if row_indices.len() <= self.n {
                // Find unknowns in these rows not involved in these regions
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
            // If no row candidates found, check columns
            if unknowns.is_none() {
                let col_indices: HashSet<usize> = permutation
                    .iter()
                    // Find distinct columns covered by each region
                    .map(|(region, _)| {
                        region
                            .iter()
                            .map(|cell| cell.col)
                            .collect::<HashSet<usize>>()
                    })
                    // Combine each region's columns by union
                    .reduce(|a, b| a.union(&b).cloned().collect())
                    .unwrap();

                // If there are only N cols
                if col_indices.len() <= self.n {
                    // Find unknowns in these columns that are not involved in these regions
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
