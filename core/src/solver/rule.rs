use crate::grid::Cell;
use crate::puzzle::{QueensPuzzle, State};

/// Represents a human-understandable solve-hint like "you can mark cell X as a queen because cells Y
/// and Z are empty"
pub struct RuleResult {
    /// Stable identifier shared with the web UI (e.g. `"mark_queen"`)
    pub code_name: &'static str,
    /// The cell(s) to be changed and the state to change them to
    pub changes: Vec<(Cell, State)>,
    /// Other cells involved in the rule
    pub involved: Vec<Cell>,
    /// Human-readable explanation
    pub description: String,
}

impl RuleResult {
    pub fn apply(&self, puzzle: &mut QueensPuzzle) {
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
