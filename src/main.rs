mod io;
mod grid;
mod puzzle;
mod solver;

use crate::grid::Cell;
use std::path::PathBuf;
use clap::Parser;
use colored::*;
use puzzle::{QueensPuzzle, State};
use solver::RuleResult;


fn generate_puzzle(n: usize) -> QueensPuzzle {
    let regions = generate_regions(n);
    let mut puzzle = QueensPuzzle::new(regions.clone());

    while !solver::brute_force::solve(&mut puzzle) {
        puzzle = QueensPuzzle::new(regions.clone());
    }

    puzzle
}

fn generate_regions(n: usize) -> Vec<Vec<Cell>> {
    let mut regions = vec![vec![]; n];

    for i in 0..n {
        regions[i].push(Cell { row: i, col: i });
    }

    regions
}


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
            let region_index = puzzle.region_iter().position(|region| region.contains(&cell));

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
    const PURPLE: Color = Color::TrueColor {r: 187, g: 163, b: 226};
    const ORANGE: Color = Color::TrueColor {r: 255, g: 201, b: 146};
    const BLUE: Color = Color::TrueColor {r: 150, g: 190, b: 255};
    const GREEN: Color = Color::TrueColor {r: 179, g: 223, b: 160};
    const WHITE: Color = Color::TrueColor {r: 223, g: 223, b: 223};
    const RED: Color = Color::TrueColor {r: 255, g: 123, b: 96};
    const YELLOW: Color = Color::TrueColor {r: 230, g: 243, b: 136};
    const GREY: Color = Color::TrueColor {r: 185, g: 178, b: 158};
    const PINK: Color = Color::TrueColor {r: 223, g: 160, b: 191};
    const SEA_GREEN: Color = Color::TrueColor {r: 163, g: 210, b: 216};
    const TEAL: Color = Color::TrueColor {r: 98, g: 239, b: 234};

    let colors = vec![PURPLE, ORANGE, BLUE, GREEN, WHITE, RED, YELLOW, GREY, PINK, SEA_GREEN, TEAL];
    cell.on_color(colors[region_index % colors.len()])
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

    solve_puzzle(&mut puzzle);

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
        let _ = solver::brute_force::solve(&mut puzzle);
    }
    print_board_colorized(&puzzle);
}
