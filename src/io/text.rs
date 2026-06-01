use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use crate::grid::Cell;
use crate::puzzle::{QueensPuzzle, State};

fn read_board(input: &str) -> Result<Vec<Vec<State>>, String> {
    let rows: Vec<&str> = input.trim().split('\n').collect();
    let n = rows.len();
    let mut board = vec![vec![State::Unknown; n]; n];

    for (i, row) in rows.iter().enumerate() {
        if row.len() != n {
            return Err(format!("Invalid row length in row {}: expected {}, found {}", i + 1, n, row.len()));
        }

        for (j, c) in row.chars().enumerate() {
            match c {
                '0' => board[i][j] = State::Unknown,
                '1' => board[i][j] = State::Queen,
                _ => return Err(format!("Invalid character in row {}, column {}: {}", i + 1, j + 1, c)),
            }
        }
    }

    Ok(board)
}

fn read_regions(input: &str) -> Result<QueensPuzzle, String> {
    let rows: Vec<&str> = input.trim().split('\n').collect();
    let n = rows.len();
    let mut regions = vec![vec![]; n];
    let mut region_map = HashMap::new();

    for (r, row) in rows.iter().enumerate() {
        if row.len() != n {
            return Err(format!("Invalid row length in row {}: expected {}, found {}", r + 1, n, row.len()));
        }

        for (c, ch) in row.chars().enumerate() {
            if ch.is_ascii_alphabetic() {
                let region_count = region_map.len();
                let region_index = *region_map.entry(ch).or_insert(region_count);
                regions[region_index].push(Cell { row: r, col: c });
            } else if ch != ' ' {
                return Err(format!("Invalid character in row {}, column {}: {}", r + 1, c + 1, ch));
            }
        }
    }

    Ok(QueensPuzzle::new(regions))
}

pub fn read_puzzle_text(path: PathBuf) -> QueensPuzzle {
    let puzzle_str = fs::read_to_string(&path).map_err(|e| {
        eprintln!("Failed to read puzzle file {}: {}", path.display(), e);
        std::process::exit(1);
    }).unwrap();

    let puzzle = read_regions(&puzzle_str).map_err(|e| {
        eprintln!("Failed to parse puzzle: {}", e);
        std::process::exit(1);
    }).unwrap();

    puzzle
}