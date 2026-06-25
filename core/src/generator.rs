mod shuffle_queens;

use crate::grid::Cell;
use crate::puzzle::QueensPuzzle;
use crate::solver;
use std::collections::HashSet;

use log::trace;
use rand::prelude::*;

/// Generates `num` puzzles of size `n`; puzzle `i` is generated with `seed + i`.
pub fn generate_puzzles(n: usize, num: usize, seed: u64) -> Vec<QueensPuzzle> {
    (0..num as u64)
        .map(|i| generate_puzzle(n, seed + i))
        .collect()
}

fn generate_puzzle_helper(puzzle: &mut QueensPuzzle, rng: &mut StdRng) -> bool {
    let mut unregioned_neighbouring_cells = puzzle
        .all_cells()
        .filter(|cell| puzzle.cell_region(*cell).is_none())
        .filter(|cell| {
            puzzle
                .cells_cardinally_adjacent(*cell)
                .any(|cell| puzzle.cell_region(cell).is_some())
        })
        .collect::<Vec<Cell>>();
    if unregioned_neighbouring_cells.is_empty() {
        return true;
    }
    let is_final_cell = unregioned_neighbouring_cells.len() == 1;
    unregioned_neighbouring_cells.shuffle(rng);

    for cell in unregioned_neighbouring_cells {
        let neighboring_regions = puzzle
            .cells_cardinally_adjacent(cell)
            .filter_map(|cell| puzzle.cell_region(cell))
            .collect::<HashSet<_>>();
        for region in neighboring_regions {
            trace!("Growing region {} to include cell {}", region, cell);
            puzzle.assign_cell_region(cell, region);

            let mut solutions = vec![];
            let num_solutions = solver::brute_force::solve(&mut puzzle.clone(), &mut solutions);

            if num_solutions == 1 && (is_final_cell || generate_puzzle_helper(puzzle, rng)) {
                return true;
            }

            trace!("Shrinking cell {} from region {}", cell, region);
            puzzle.unassign_cell_region(cell);

            if num_solutions != 1 {
                return false;
            }
        }
    }

    false
}

pub fn generate_puzzle(n: usize, seed: u64) -> QueensPuzzle {
    let mut rng = StdRng::seed_from_u64(seed);

    let queens = shuffle_queens::shuffle_queens(n, &mut rng).unwrap();
    let mut puzzle = QueensPuzzle::new(queens.into_iter().map(|cell: Cell| vec![cell]).collect());

    generate_puzzle_helper(&mut puzzle, &mut rng);

    puzzle
}

/// Place n non-attacking queens as single-cell starter regions.
pub fn scatter_queens(n: usize, seed: u64) -> QueensPuzzle {
    let mut rng = StdRng::seed_from_u64(seed);
    let queens = shuffle_queens::shuffle_queens(n, &mut rng).unwrap_or_default();
    let mut puzzle = QueensPuzzle::new_empty(n);
    for (i, cell) in queens.iter().enumerate() {
        puzzle.set_cell_region(*cell, Some(i as u8));
    }
    puzzle
}
