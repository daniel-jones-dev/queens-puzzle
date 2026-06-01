use std::cmp::max;
use std::collections::HashSet;
use crate::grid::Cell;
use crate::puzzle::{QueensPuzzle, State};
use itertools::Itertools;

pub mod brute_force;

/// Represents a human-understandable solve-hint like "you can mark cell X as a queen because cells Y
/// and Z are empty"
pub struct RuleResult {
    /// The cell(s) to be changed and the state to change them to
    pub(crate) changes: Vec<(Cell, State)>,
    /// Other cells involved in the rule
    pub(crate) involved: Vec<Cell>,
    /// Human-readable explanation
    pub(crate) description: String,
}

impl RuleResult {
    fn apply(&self, puzzle: &mut QueensPuzzle) {
        for (cell, state) in &self.changes {
            puzzle[cell] = *state;
        }
    }
}

trait Rule {
    fn description(&self) -> String;

    fn check(&self, puzzle: &QueensPuzzle) -> Option<RuleResult>;
}

/// This rule marks cells connected to a queen as empty.
struct MarkEmpty;

impl Rule for MarkEmpty {
    fn description(&self) -> String {
        "A queen in one cell indicates that all connected cells are empty, i.e. all cells \
        in the same row, column, region, and diagonally adjacent.".to_string()
    }
    fn check(&self, puzzle: &QueensPuzzle) -> Option<RuleResult> {
        let queens = puzzle.queens();
        for queen_cell in queens {
            let connected_cells_unknown = puzzle.connected_cells(queen_cell)
                .filter(|cell: &Cell| {puzzle[cell] == State::Unknown}).collect::<Vec<_>>();
            if !connected_cells_unknown.is_empty() {
                return Some(RuleResult{
                    changes: connected_cells_unknown.into_iter().map(|cell: Cell| {(cell, State::Empty)})
                        .collect::<Vec<_>>(),
                    involved: vec![queen_cell],
                    description: format!("The queen in cell {queen_cell} means that all cells in \
                    the same row, column, region and neighbouring cells must be empty")
                });
            }
        }

        None
    }
}

/// The simplest rule: if there is only possibility remaining for a row, column, or region, it
/// must be a queen.
struct MarkQueen;

impl MarkQueen {
    /// Checks if the given block has exactly one unknown cell and no queens
    fn check_block_has_single_unknown_and_no_queen(&self, puzzle: &QueensPuzzle, block_cells: &HashSet<Cell>) -> Option<Cell> {
        if block_cells.iter().any(|cell| puzzle[cell] == State::Queen) {
            return None;
        }
        match block_cells.iter().exactly_one() {
            Ok(cell) => Some(*cell),
            Err(..) => None
        }
    }
}

impl Rule for MarkQueen {
    fn description(&self) -> String {
        "If all cells except one in a row, column, or region are known be empty, the remaining \
        single unknown cell must be a queen.".to_string()
    }

    fn check(&self, puzzle: &QueensPuzzle) -> Option<RuleResult> {
        for (block_cells, block_index, block_type) in puzzle.block_iter() {
            if let Some(single_unknown_cell) = self.check_block_has_single_unknown_and_no_queen(puzzle, &block_cells) {
                return Some(RuleResult {
                    changes: vec![(single_unknown_cell, State::Queen)],
                    involved: block_cells.iter().filter(|c| { single_unknown_cell != **c }).map(|c| {*c}).collect(),
                    description: format!("This {block_type} must contain a queen, and no other \
                     cell except this one can contain a queen, so it must be a queen")
                })
            }
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
struct NakedSet;

impl Rule for NakedSet {
    fn description(&self) -> String {
        "The involved cells are in the same block and one must contain a queen. \
        The given cell(s) must therefore be empty".to_string()
    }

    fn check(&self, puzzle: &QueensPuzzle) -> Option<RuleResult> {
        for (block_cells, block_index, block_type) in puzzle.block_iter() {
            // Check there are no queens and at least two unknown cells
            if block_cells.iter().any(|cell| puzzle[*cell] == State::Queen) {
                continue;
            }

            let unknown_cells = block_cells.into_iter()
                .filter(|cell| {puzzle[cell] == State::Unknown}).collect::<Vec<_>>();
            if unknown_cells.len() <= 1 {
                continue;
            }

            // Loop through all unknown cells, and find their connected cells that are unknown
            let connected_unknowns = unknown_cells.iter().map(|cell| {
                puzzle.connected_cells(*cell)
                    .filter(|c| puzzle[c] == State::Unknown)
                    .collect::<HashSet<Cell>>()
            }).collect::<Vec<_>>();

            // Now intersect them
            let common_connected_unknowns = connected_unknowns.clone().into_iter().reduce(|acc, conn_unknowns| {
                acc.intersection(&conn_unknowns).cloned().collect::<HashSet<Cell>>()
            }).unwrap(); // Safe, checked above there are at least two unknown cells

            if common_connected_unknowns.is_empty() {
                continue;
            }

            return Some(RuleResult{
                changes: common_connected_unknowns.into_iter().map(|cell| (cell, State::Empty)).collect(),
                involved: unknown_cells,
                description: format!("One of these cells in the {block_type} must be a queen, so \
                these cells must be empty")
            })
        }
        None
    }
}

fn check_rule(puzzle: &mut QueensPuzzle, rule: &dyn Rule) {
    match rule.check(&puzzle) {
        Some(result) => {
            result.apply(puzzle);
            crate::print_board_colorized(&puzzle);
            println!();
        }
        _ => {}
    }
}

pub fn solve_logically(puzzle: &mut QueensPuzzle) -> Option<usize> {
    let rules: Vec<Box<dyn Rule>> = vec![
        Box::new(MarkEmpty{}),
        Box::new(MarkQueen{}),
        Box::new(NakedSet {})];

    let mut max_used_rule = 0;

    'solver: loop {
        for (rule_index, rule) in rules.iter().enumerate() {
            if let Some(result) = rule.check(puzzle) {
                max_used_rule = max(rule_index, max_used_rule);
                result.apply(puzzle);
                crate::print_board_result_colorized(puzzle, &Some(result));
                if puzzle.is_solved() {
                    return Some(max_used_rule);
                }
                continue 'solver;
            }
        }
        return None;
    }
}