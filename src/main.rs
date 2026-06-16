mod io;
mod grid;
mod puzzle;
mod solver;
mod generator;

use crate::grid::Cell;
use std::fmt::Write as _;
use std::path::PathBuf;
use clap::{Parser, Subcommand};
use colored::*;
use log::{info, LevelFilter};
use puzzle::{QueensPuzzle, State};
use solver::rule::RuleResult;
use crate::generator::generate_puzzles;
use crate::puzzle::region_color;

/// Solver and generator for the LinkedIn Queens puzzle.
#[derive(Parser, Debug)]
#[command(version, about, long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Command,

    /// Increase output verbosity (-v shows solver steps, -vv also shows generator steps)
    #[arg(short, long, action = clap::ArgAction::Count, global = true)]
    verbose: u8,
}

#[derive(Subcommand, Debug)]
enum Command {
    /// Solve a puzzle from a file and rate its difficulty
    Solve {
        /// Path to the puzzle file
        file: PathBuf,

        /// Parse the file as archived JSON (see README) instead of the text grid format
        #[arg(long)]
        json: bool,

        /// When reading JSON, the id of the puzzle to solve (defaults to the lowest id in the file)
        #[arg(long)]
        id: Option<u32>,
    },

    /// Generate new puzzle(s), each with a unique solution
    Generate {
        /// Board size; generates an n x n board
        #[arg(short = 'n', long, default_value_t = 8)]
        size: usize,

        /// Number of puzzles to generate
        #[arg(short, long, default_value_t = 1)]
        count: usize,

        /// Base RNG seed; puzzle i uses seed + i
        #[arg(short, long, default_value_t = 0)]
        seed: u64,
    },
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();
    init_logging(cli.verbose);

    match cli.command {
        Command::Solve { file, json, id } => {
            let puzzle = if json {
                io::archived_queens::read(file, id)?
            } else {
                io::text::read_puzzle_text(file)
            };
            solve_puzzle(&puzzle);
        }
        Command::Generate { size, count, seed } => {
            for mut puzzle in generate_puzzles(size, count, seed) {
                info!("{}", format_board(&puzzle));
                match solver::solve_and_rate_puzzle(&mut puzzle) {
                    Some(difficulty) => info!("Difficulty: {:?}\n", difficulty),
                    None => info!("Difficulty: unrated (needs brute force)\n"),
                }
            }
        }
    }

    Ok(())
}

/// Initialises the logger. The verbosity count maps to a maximum log level:
/// 0 -> results only, 1 -> solver steps, 2+ -> generator steps too.
fn init_logging(verbosity: u8) {
    let level = match verbosity {
        0 => LevelFilter::Info,
        1 => LevelFilter::Debug,
        _ => LevelFilter::Trace,
    };

    env_logger::Builder::new()
        .filter_level(level)
        .target(env_logger::Target::Stdout)
        // Print only the message, so boards render cleanly without log metadata.
        .format(|buf, record| {
            use std::io::Write;
            writeln!(buf, "{}", record.args())
        })
        .init();
}

/// Solves a puzzle in place, logging the starting board, the solved board and its difficulty,
/// and falling back to brute force if the logical solver gets stuck.
fn solve_puzzle(puzzle: &QueensPuzzle) {
    info!("{}", format_board(puzzle));

    let mut working = puzzle.clone();
    let difficulty = solver::solve_and_rate_puzzle(&mut working);

    info!("{}", format_board(&working));
    if let Some(difficulty) = difficulty {
        info!("Difficulty: {:?}", difficulty);
    }

    if !working.is_solved() {
        info!("No logical solution found; resorting to brute force");
        let mut solutions = vec![];
        let num_solutions = solver::brute_force::solve(&mut working, &mut solutions);
        info!("Found {} solution(s)", num_solutions);
        for solution in &solutions {
            info!("{}", format_board(solution));
        }
    }
}

/// Renders a puzzle board as a colorized, multi-line string.
fn format_board(puzzle: &QueensPuzzle) -> String {
    format_board_result(puzzle, &None)
}

/// Renders a puzzle board, highlighting the cells changed (green) and involved (underlined)
/// by a rule result, and appending the rule's description.
fn format_board_result(puzzle: &QueensPuzzle, rule_result: &Option<RuleResult>) -> String {
    let n = puzzle.n();
    let mut out = String::new();

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
                    if rule_result.changes.iter().any(|(c, _)| *c == cell) {
                        cell_text.bright_green()
                    } else if rule_result.involved.contains(&cell) {
                        cell_text.underline()
                    } else {
                        cell_text
                    }
                }
                None => cell_text,
            };

            cell_text = match region_index {
                Some(index) => colorize_region(cell_text, index),
                None => cell_text,
            };
            write!(out, "{} ", cell_text).unwrap();
        }
        writeln!(out).unwrap();
    }

    if let Some(result) = rule_result {
        write!(out, "{}", result.description).unwrap();
    }

    out
}

fn colorize_region(cell: ColoredString, region_index: usize) -> ColoredString {
    let color = region_color(region_index);
    let color = Color::TrueColor { r: color.r, g: color.g, b: color.b };
    cell.on_color(color)
}