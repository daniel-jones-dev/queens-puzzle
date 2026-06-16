use std::cmp::max;
use std::fmt::Display;
use log::debug;
use crate::puzzle::QueensPuzzle;
use rule::Rule;
use rule_hidden_set::HiddenSet;
use rule_mark_empty::MarkEmpty;
use rule_mark_queen::MarkQueen;
use rule_naked_set::NakedSet;
use crate::solver::rule_pointers::Pointers;

pub mod brute_force;
pub mod rule;
mod rule_mark_empty;
mod rule_mark_queen;
mod rule_naked_set;
mod rule_hidden_set;
mod rule_pointers;

/// The difficulty to solve a puzzle.
#[derive(Copy, Clone, Debug)]
pub enum Difficulty {
    Trivial,
    Easy,
    Medium,
    Hard,
}

fn oxford_comma(items: impl Iterator<Item: Display>) -> String {
    let v: Vec<_> = items.collect();
    match v.len() {
        0 => "".to_string(),
        1 => format!("{}", v[0]),
        2 => format!("{} and {}", v[0], v[1]),
        _ => v[0..v.len()-1].iter().map(|item| format!("{}, ", item)).collect::<String>() + &format!("and {}", v[v.len()-1])
    }
}

/// Solves the given puzzle by applying logical rules in order of increasing difficulty,
/// returning the difficulty of the hardest rule needed, or `None` if it could not be solved
/// logically. The puzzle may be not started, partially completed, or already solved, and is
/// modified in place.
pub fn solve_and_rate_puzzle(puzzle: &mut QueensPuzzle) -> Option<Difficulty> {
    let rules: Vec<(Box<dyn Rule>, Difficulty)> = vec![
        (Box::new(MarkQueen{}), Difficulty::Trivial),
        (Box::new(MarkEmpty{}), Difficulty::Trivial),
        (Box::new(Pointers{check_row: true }), Difficulty::Easy),
        (Box::new(Pointers{check_row: false }), Difficulty::Easy),
        (Box::new(NakedSet {n: 2}), Difficulty::Medium),
        (Box::new(NakedSet {n: 3}), Difficulty::Medium),
        (Box::new(HiddenSet{n: 2}), Difficulty::Hard),
        (Box::new(NakedSet {n: 4}), Difficulty::Hard),
        (Box::new(NakedSet {n: 5}), Difficulty::Hard),
        (Box::new(HiddenSet{n: 3}), Difficulty::Hard),
        (Box::new(NakedSet {n: 12}), Difficulty::Hard),
        (Box::new(HiddenSet{n: 4}), Difficulty::Hard),
        (Box::new(HiddenSet{n: 5}), Difficulty::Hard),
        (Box::new(HiddenSet{n: 6}), Difficulty::Hard),
    ];

    let mut max_used_rule = 0;

    'solver: loop {
        for (rule_index, (rule, _)) in rules.iter().enumerate() {
            if let Some(result) = rule.check(puzzle) {
                max_used_rule = max(rule_index, max_used_rule);
                result.apply(puzzle);
                debug!("{}", crate::format_board_result(puzzle, &Some(result)));
                if puzzle.is_solved() {
                    return Some(rules.get(max_used_rule).unwrap().1);
                }
                continue 'solver;
            }
        }
        return None;
    }
}