use crate::grid::Cell;
use crate::puzzle::{QueensPuzzle, State};
use serde::{Deserialize, Serialize};

/// The canonical puzzle interchange format used by the web UI, WASM API, and URL sharing.
#[derive(Serialize, Deserialize, Debug)]
pub struct PuzzleJson {
    /// `regions[row][col]` — region index (0-based) or `null` for an unassigned cell
    pub regions: Vec<Vec<Option<u8>>>,
    /// `states[row][col]` — 0 = Unknown, 1 = Queen, 2 = Empty; omitted when all Unknown
    #[serde(skip_serializing_if = "Option::is_none")]
    pub states: Option<Vec<Vec<u8>>>,
}

impl PuzzleJson {
    pub fn from_puzzle(puzzle: &QueensPuzzle) -> Self {
        let n = puzzle.n();
        let regions: Vec<Vec<Option<u8>>> = (0..n)
            .map(|row| (0..n).map(|col| puzzle.cell_region(Cell { row, col })).collect())
            .collect();

        let all_unknown = (0..n).all(|row| {
            (0..n).all(|col| puzzle.cell_state(Cell { row, col }) == State::Unknown)
        });

        let states = if all_unknown {
            None
        } else {
            Some(
                (0..n)
                    .map(|row| {
                        (0..n)
                            .map(|col| match puzzle.cell_state(Cell { row, col }) {
                                State::Unknown => 0,
                                State::Queen => 1,
                                State::Empty => 2,
                            })
                            .collect()
                    })
                    .collect(),
            )
        };

        PuzzleJson { regions, states }
    }
}

pub fn parse(input: &str) -> Result<QueensPuzzle, String> {
    let pj: PuzzleJson = serde_json::from_str(input).map_err(|e| e.to_string())?;

    let n = pj.regions.len();
    if n == 0 {
        return Err("puzzle must have at least one row".to_string());
    }
    for (r, row) in pj.regions.iter().enumerate() {
        if row.len() != n {
            return Err(format!(
                "row {} has length {}, expected {}",
                r,
                row.len(),
                n
            ));
        }
    }

    // Count how many distinct (non-null) region indices appear
    let mut max_region: Option<u8> = None;
    for row in &pj.regions {
        for &region in row {
            if let Some(r) = region {
                max_region = Some(max_region.map_or(r, |m: u8| m.max(r)));
            }
        }
    }

    // Build region_vecs: one entry per region index (0..n)
    let mut region_vecs: Vec<Vec<Cell>> = (0..n).map(|_| vec![]).collect();
    for (row, region_row) in pj.regions.iter().enumerate() {
        for (col, &region_opt) in region_row.iter().enumerate() {
            if let Some(region_idx) = region_opt {
                let idx = region_idx as usize;
                if idx >= n {
                    return Err(format!(
                        "region index {idx} out of range for {n}×{n} puzzle"
                    ));
                }
                region_vecs[idx].push(Cell { row, col });
            }
        }
    }

    // Allow empty regions only if the puzzle is in editor mode (some cells unassigned)
    let has_unassigned = pj.regions.iter().any(|row| row.iter().any(|r| r.is_none()));
    if !has_unassigned {
        for (i, region) in region_vecs.iter().enumerate() {
            if region.is_empty() {
                return Err(format!("region {i} has no cells"));
            }
        }
    }

    // If there are unassigned cells, use new_empty() + set_cell_region() instead
    let mut puzzle = if has_unassigned || max_region.is_none() {
        let mut p = QueensPuzzle::new_empty(n);
        for (row, region_row) in pj.regions.iter().enumerate() {
            for (col, &region_opt) in region_row.iter().enumerate() {
                if let Some(region_idx) = region_opt {
                    p.set_cell_region(Cell { row, col }, Some(region_idx));
                }
            }
        }
        p
    } else {
        QueensPuzzle::new(region_vecs)
    };

    // Apply states if present
    if let Some(states) = &pj.states {
        if states.len() != n {
            return Err(format!(
                "states has {} rows, expected {}",
                states.len(),
                n
            ));
        }
        for (row, state_row) in states.iter().enumerate() {
            if state_row.len() != n {
                return Err(format!(
                    "states row {} has length {}, expected {}",
                    row,
                    state_row.len(),
                    n
                ));
            }
            for (col, &s) in state_row.iter().enumerate() {
                let state = match s {
                    0 => State::Unknown,
                    1 => State::Queen,
                    2 => State::Empty,
                    _ => return Err(format!("invalid state value {s} at ({row}, {col})")),
                };
                puzzle.set_cell_state(Cell { row, col }, state);
            }
        }
    }

    Ok(puzzle)
}

pub fn serialize(puzzle: &QueensPuzzle) -> String {
    let pj = PuzzleJson::from_puzzle(puzzle);
    serde_json::to_string(&pj).expect("serialization cannot fail")
}
