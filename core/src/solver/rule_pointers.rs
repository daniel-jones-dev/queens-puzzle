use crate::grid::Cell;
use crate::puzzle::State::{Empty, Queen, Unknown};
use crate::puzzle::{column_name, region_name, row_name, QueensPuzzle};
use crate::solver::rule::{Rule, RuleResult};
use itertools::Itertools;
use std::collections::HashSet;

impl Rule for Pointers {
    fn check(&self, puzzle: &QueensPuzzle) -> Option<RuleResult> {
        for (region_cells, region_index) in puzzle.all_regions_iter() {
            if region_cells.iter().any(|cell| puzzle[cell] == Queen) {
                continue;
            }
            let unknown_cells: Vec<Cell> = region_cells
                .iter()
                .cloned()
                .filter(|cell| puzzle[cell] == Unknown)
                .collect_vec();
            if unknown_cells.len() < 2 {
                continue;
            }

            let distinct_rows_or_cols: HashSet<usize> = unknown_cells
                .iter()
                .map(|cell: &Cell| if self.check_row { cell.row } else { cell.col })
                .collect();
            if distinct_rows_or_cols.len() != 1 {
                continue;
            }
            let row_or_col = *distinct_rows_or_cols.iter().next().unwrap();

            let other_unknowns = (if self.check_row {
                puzzle.row_iter(row_or_col)
            } else {
                puzzle.col_iter(row_or_col)
            })
            .into_iter()
            .filter(|cell| puzzle[*cell] == Unknown)
            .filter(|cell| puzzle.cell_region(*cell) != Some(region_index as u8))
            .collect_vec();
            if other_unknowns.is_empty() {
                continue;
            }

            return Some(RuleResult {
                changes: other_unknowns
                    .into_iter()
                    .map(|cell| (cell, Empty))
                    .collect_vec(),
                involved: unknown_cells.into_iter().collect_vec(),
                description: format!(
                    "All possible cells in {} are in {}, so we can remove the \
                other cells",
                    region_name(region_index),
                    if self.check_row {
                        row_name(row_or_col)
                    } else {
                        column_name(row_or_col)
                    }
                ),
            });
        }
        None
    }
}

pub struct Pointers {
    pub check_row: bool,
}
