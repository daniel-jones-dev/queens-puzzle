use crate::grid::Cell;
use crate::puzzle::QueensPuzzle;
use serde::Deserialize;
use std::collections::HashMap;
use std::error::Error;
use std::fs;
use std::path::PathBuf;

#[derive(Deserialize, Clone)]
#[allow(dead_code)]
pub struct PuzzleData {
    id: u32,
    date: Option<String>,
    grid: Vec<Vec<u8>>,
    regions: Vec<Vec<u8>>,
}

pub fn parse_file(path: PathBuf) -> Result<HashMap<u32, PuzzleData>, Box<dyn Error>> {
    let json = fs::read_to_string(path)?;
    let result: Vec<PuzzleData> = serde_json::from_str(&json)?;
    Ok(HashMap::from_iter(result.into_iter().map(|p| (p.id, p))))
}

pub fn read_data(data: &PuzzleData) -> Result<QueensPuzzle, Box<dyn Error>> {
    let n = data.regions.len();
    let mut region_indices: HashMap<u8, usize> = HashMap::new();
    let mut regions: Vec<Vec<Cell>> = vec![];

    for row in 0..n {
        if data.regions[row].len() != n {
            return Err(format!(
                "invalid puzzle data: row {row} has length {}, expected {n}",
                data.regions[row].len()
            )
            .into());
        }
        for col in 0..n {
            let region_id = data.regions[row][col];
            let next_index = region_indices.len();
            let index = *region_indices.entry(region_id).or_insert(next_index);
            if index == regions.len() {
                regions.push(vec![]);
            }
            regions[index].push(Cell { row, col });
        }
    }

    Ok(QueensPuzzle::new(regions))
}

pub fn read(path: PathBuf, id: Option<u32>) -> Result<QueensPuzzle, Box<dyn Error>> {
    let map = parse_file(path)?;
    let data = match id {
        Some(id) => map
            .get(&id)
            .ok_or_else(|| format!("puzzle id {id} not found in archive"))?,
        None => map
            .values()
            .min_by_key(|p| p.id)
            .ok_or("archive contains no puzzles")?,
    };
    read_data(data)
}
