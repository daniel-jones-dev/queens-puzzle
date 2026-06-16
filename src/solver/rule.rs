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

/// A logical deduction technique. `check` inspects the puzzle and, if the technique applies,
/// returns a [`RuleResult`] describing the deduction (without mutating the puzzle).
pub trait Rule {
    fn check(&self, puzzle: &QueensPuzzle) -> Option<RuleResult>;
}
