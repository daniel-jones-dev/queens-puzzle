use std::cmp::max;
use std::error::Error;
use std::fmt::Display;
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
pub enum Difficulty {
    Trivial,
    Easy,
    Medium,
    Hard,
}

pub fn solve_and_rate_puzzle(puzzle: &mut QueensPuzzle) -> Result<Difficulty, Box<dyn Error>> {
    // TODO
    Ok(Difficulty::Easy)
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

pub fn solve_logically(puzzle: &mut QueensPuzzle) -> Option<usize> {
    let rules: Vec<(Box<dyn Rule>, Difficulty)> = vec![
        (Box::new(MarkQueen{}), Difficulty::Trivial),
        (Box::new(MarkEmpty{}), Difficulty::Trivial),
        (Box::new(Pointers{check_row: true }), Difficulty::Easy),
        (Box::new(Pointers{check_row: false }), Difficulty::Easy),
        (Box::new(NakedSet {n: 2}), Difficulty::Medium),
        (Box::new(NakedSet {n: 3}), Difficulty::Medium),
        (Box::new(HiddenSet{n: 2}), Difficulty::Medium),
        (Box::new(NakedSet {n: 4}), Difficulty::Medium),
        (Box::new(NakedSet {n: 5}), Difficulty::Medium),
        (Box::new(HiddenSet{n: 3}), Difficulty::Medium),
        (Box::new(NakedSet {n: 12}), Difficulty::Medium),
        (Box::new(HiddenSet{n: 4}), Difficulty::Medium),
        (Box::new(HiddenSet{n: 5}), Difficulty::Medium),
        (Box::new(HiddenSet{n: 6}), Difficulty::Medium),
    ];

    let mut max_used_rule = 0;

    'solver: loop {
        for (rule_index, (rule, _)) in rules.iter().enumerate() {
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