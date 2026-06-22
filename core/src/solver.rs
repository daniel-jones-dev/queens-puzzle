use crate::puzzle::QueensPuzzle;
use crate::solver::rule::Rule;
use rule_hidden_set::HiddenSet;
use rule_mark_empty::MarkEmpty;
use rule_mark_queen::MarkQueen;
use rule_naked_set::NakedSet;
use rule_pointers::Pointers;
use std::cmp::max;
use std::fmt::Display;

pub mod brute_force;
pub mod rule;
mod rule_hidden_set;
mod rule_mark_empty;
mod rule_mark_queen;
mod rule_naked_set;
mod rule_pointers;

/// The difficulty to solve a puzzle.
#[derive(Copy, Clone, Debug)]
pub enum Difficulty {
    Trivial,
    Easy,
    Medium,
    Hard,
}

pub fn oxford_comma(items: impl Iterator<Item: Display>) -> String {
    let v: Vec<_> = items.collect();
    match v.len() {
        0 => "".to_string(),
        1 => format!("{}", v[0]),
        2 => format!("{} and {}", v[0], v[1]),
        _ => {
            v[0..v.len() - 1]
                .iter()
                .map(|item| format!("{}, ", item))
                .collect::<String>()
                + &format!("and {}", v[v.len() - 1])
        }
    }
}

fn make_rules() -> Vec<(Box<dyn Rule>, Difficulty)> {
    vec![
        (Box::new(MarkQueen {}), Difficulty::Trivial),
        (Box::new(MarkEmpty {}), Difficulty::Trivial),
        (Box::new(Pointers { check_row: true }), Difficulty::Easy),
        (Box::new(Pointers { check_row: false }), Difficulty::Easy),
        (Box::new(NakedSet { n: 2 }), Difficulty::Medium),
        (Box::new(NakedSet { n: 3 }), Difficulty::Medium),
        (Box::new(HiddenSet { n: 2 }), Difficulty::Hard),
        (Box::new(NakedSet { n: 4 }), Difficulty::Hard),
        (Box::new(NakedSet { n: 5 }), Difficulty::Hard),
        (Box::new(HiddenSet { n: 3 }), Difficulty::Hard),
        (Box::new(NakedSet { n: 12 }), Difficulty::Hard),
        (Box::new(HiddenSet { n: 4 }), Difficulty::Hard),
        (Box::new(HiddenSet { n: 5 }), Difficulty::Hard),
        (Box::new(HiddenSet { n: 6 }), Difficulty::Hard),
    ]
}

/// Returns the next logical deduction without mutating the puzzle, or `None` if no step is found.
pub fn next_hint(puzzle: &QueensPuzzle) -> Option<rule::RuleResult> {
    let rules = make_rules();
    for (rule, _) in &rules {
        if let Some(result) = rule.check(puzzle) {
            return Some(result);
        }
    }
    None
}

/// Solves the given puzzle by applying logical rules in order of increasing difficulty,
/// returning the difficulty of the hardest rule needed, or `None` if it could not be solved
/// logically.
pub fn solve_and_rate_puzzle(puzzle: &mut QueensPuzzle) -> Option<Difficulty> {
    let rules = make_rules();
    let mut max_used_rule = 0;

    'solver: loop {
        for (rule_index, (rule, _)) in rules.iter().enumerate() {
            if let Some(result) = rule.check(puzzle) {
                max_used_rule = max(rule_index, max_used_rule);
                result.apply(puzzle);
                if puzzle.is_solved() {
                    return Some(rules.get(max_used_rule).unwrap().1);
                }
                continue 'solver;
            }
        }
        return None;
    }
}
