mod io;
mod grid;
mod puzzle;
mod solver;
mod generator;

use crate::grid::Cell;
use std::path::PathBuf;
use clap::Parser;
use colored::*;
use puzzle::{QueensPuzzle, State};
use solver::rule::RuleResult;
use crate::generator::generate_puzzles;
use crate::puzzle::region_color;

fn print_board_colorized(puzzle: &QueensPuzzle){
    print_board_result_colorized(puzzle, &None);
}

fn print_board_result_colorized(puzzle: &QueensPuzzle, rule_result: &Option<RuleResult>) {
    let n = puzzle.n();

    for row in 0..n {
        for col in 0..n {
            let cell = Cell { row, col };
            let mut cell_text = match puzzle[cell] {
                State::Queen => " ♛ ",
                State::Empty => " x ",
                _ => "   ",
            }.white();
            let region_index = puzzle.all_regions_iter().position(|(region, _)| region.contains(&cell));

            cell_text = match rule_result {
                Some(ref rule_result) => {
                    if rule_result.changes.iter().any(|(c,_)| c==cell) {
                        cell_text.bright_green()
                    } else if rule_result.involved.contains(&cell) {
                        cell_text.underline()
                    } else {
                        cell_text
                    }
                },
                None => cell_text
            };

            cell_text = match region_index {
                Some(index) => colorize_region(cell_text, index),
                None => cell_text,
            };
            print!("{} ", cell_text);
        }

        println!();
    }
    match rule_result {
        Some(ref result) => {
            println!("{}", result.description);
        }
        None => {}
    }
}

fn colorize_region(cell: ColoredString, region_index: usize) -> ColoredString {
    let color = region_color(region_index);
    let color = Color::TrueColor{ r: color.r, g: color.g, b:color.b };
    cell.on_color(color)
}


#[derive(Parser, Debug)]
#[command(version, about, long_about = None)]
struct Args {
    /// Puzzle file to solve
    #[arg(short, long)]
    puzzle: Option<PathBuf>,

    #[arg(short, long)]
    archived_queens_json: Option<PathBuf>,

    /// Turn debugging information on
    #[arg(short, long, action = clap::ArgAction::Count)]
    debug: u8,
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = Args::parse();

    let mut puzzle = match args.puzzle {
        Some(puzzle_path) => io::text::read_puzzle_text(puzzle_path),
        None => match args.archived_queens_json {
            Some(path) => io::archived_queens::read_first(path)?,
            None => panic!("invalid options"),
        }
    };
    let puzzles = generate_puzzles(5, 1);
    for mut puzzle in puzzles.into_iter() {
        print_board_colorized(&puzzle);
        solve_puzzle(&mut puzzle);
    }

    //solve_puzzle(&mut puzzle);


    Ok(())
}

fn solve_puzzle(mut puzzle: &mut QueensPuzzle) {
    print_board_colorized(&puzzle);
    println!();
    solver::solve_logically(&mut puzzle);

    print_board_colorized(&puzzle);
    println!();
    if !puzzle.is_solved() {
        println!("Resorting to brute force");
        let mut solutions = vec![];
        let num_solutions = solver::brute_force::solve(&mut puzzle, &mut solutions);
        println!("Found {} solutions", num_solutions);
        solutions.iter().for_each(|solution| print_board_colorized(solution));
    }
}
