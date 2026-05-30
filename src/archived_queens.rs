use std::collections::HashMap;
use std::error::Error;
use std::fs;
use std::path::PathBuf;
use serde::Deserialize;
use crate::grid::Cell;
use crate::QueensPuzzle;

#[derive(Deserialize, Clone)]
pub struct PuzzleData {
    /// Integer ID of the puzzle
    id: u32,
    /// Date in form YYYY/MM/DD
    date: Option<String>,
    /// The solution by row then column: 1 a queen is in the cell, 0 otherwise
    /// e.g [ [top row] [second row] ..]
    grid: Vec<Vec<u8>>,
    /// The region a cell belongs to, by row then column
    regions: Vec<Vec<u8>>,
}

pub fn parse_file(path: PathBuf) -> Result<HashMap<u32, PuzzleData>, Box<dyn Error>> {
    let json = fs::read_to_string(path)?;
    let result: Vec<PuzzleData> = serde_json::from_str(&*json)?;
    Ok(HashMap::from_iter(result.into_iter().map(|p| (p.id, p))))
}

pub fn read_data(data: &PuzzleData) -> Result<QueensPuzzle, Box<dyn Error>> {
    let n = data.regions.len();
    let mut regions: Vec<Vec<Cell>> = vec![vec![]; n];
    for row in 0..n {
        if data.regions[row].len() != n {
            panic!("invalid region {row} in puzzle data, wrong length")
        }
        for col in 0..n {
            let cell = Cell{row, col};

            let this_cells_region = data.regions[row][col] as usize;
            if this_cells_region >= n {
                panic!("invalid region {row}, {col} in puzzle data, region number too high")
            }
            regions[this_cells_region].push(cell);
        }
    }

    Ok(QueensPuzzle::new(regions))
}

pub fn read_first(path: PathBuf)-> Result<QueensPuzzle, Box<dyn Error>> {
    let map = parse_file(path)?;
    Ok(read_data(&map.iter().next().unwrap().1)?)
}