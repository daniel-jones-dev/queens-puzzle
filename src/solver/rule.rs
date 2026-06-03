use crate::grid::Cell;
use crate::puzzle::{QueensPuzzle, State};

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
    pub(crate) fn apply(&self, puzzle: &mut QueensPuzzle) {
        for (cell, state) in &self.changes {
            puzzle[cell] = *state;
        }
    }
}

// TODO need a rule that checks if the remaining unknowns for a region are all in one row or
//  column, pretty easy to see
// TODO Should split up the NakedSet rule, sometimes it's hard to see.
//  e.g. cases when all cells in a row (of multiple colors) cross out some cells in the next row,
//  because they share the same color and are nearby another color.

pub trait Rule {
    fn description(&self) -> String;

    fn check(&self, puzzle: &QueensPuzzle) -> Option<RuleResult>;
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