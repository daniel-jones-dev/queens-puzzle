mod shuffle_queens;

use std::collections::HashSet;
use crate::grid::Cell;
use crate::puzzle::{region_color_name, QueensPuzzle};

use rand::prelude::*;
use crate::{print_board_colorized, solver};

fn neighbouring_unregioned_cells(puzzle: &QueensPuzzle, cell: Cell) -> impl Iterator<Item=Cell> + use<'_> {
    puzzle.cells_cardinally_adjacent(cell).filter(|cell| {puzzle.cell_region(*cell).is_none()})
}

pub fn generate_puzzles(n: usize, num: usize) -> Vec<QueensPuzzle> {
    let mut result = vec![];
    for i in 0..num {
        result.push(generate_puzzle(n, i as u64));
    }
    result
}


fn generate_puzzle_helper(puzzle: &mut QueensPuzzle, rng: &mut StdRng) -> bool {
    // Shuffle every cell that is not assigned to a region and neighbors an existing region
    let mut unregioned_neighbouring_cells =puzzle.all_cells()
        .filter(|cell| {puzzle.cell_region(*cell).is_none()})
        .filter(|cell| {puzzle.cells_cardinally_adjacent(*cell).any(|cell| {puzzle.cell_region(cell).is_some()})})
        .collect::<Vec<Cell>>();
    if unregioned_neighbouring_cells.is_empty() {
        return true;
    }
    let is_final_cell = unregioned_neighbouring_cells.len() == 1;
    unregioned_neighbouring_cells.shuffle(rng);

    for cell in unregioned_neighbouring_cells {
        // Get set of neighboring regions of the cell
        let neighboring_regions = puzzle.cells_cardinally_adjacent(cell)
            .filter_map(|cell| {puzzle.cell_region(cell)}).collect::<HashSet<_>>();
        for region in neighboring_regions {
            // Grow the region
            println!("+++ Growing Region {} to include cell {}", region_color_name(region as usize), cell);
            puzzle.assign_cell_region(cell, region);
            print_board_colorized(puzzle);
            println!();

            // Check the puzzle still has a unique solution
            let mut solutions = vec![];
            let num_solutions = solver::brute_force::solve(&mut puzzle.clone(), &mut solutions);

            if num_solutions == 1 && (is_final_cell || generate_puzzle_helper(puzzle, rng)) {
                return true;
            }

            // Shrink the region again
            println!("--- Shrinking cell {} from Region {}", cell, region_color_name(region as usize));
            puzzle.unassign_cell_region(cell);
            print_board_colorized(puzzle);
            println!();

            if num_solutions != 1 { return false }
        }
    }

    false
}


pub fn generate_puzzle(n: usize, seed: u64) -> QueensPuzzle {
    let mut rng = StdRng::seed_from_u64(seed);

    // First, shuffle queen placement
    let queens = shuffle_queens::shuffle_queens(n, &mut rng).unwrap();

    // Start puzzle by giving each queen a one-cell region
    let mut puzzle = QueensPuzzle::new(queens.into_iter().map(|cell: Cell| {vec![cell]}).collect());

    // Note: puzzle is guaranteed to have a unique solution, since single-celled regions match the shuffled queens

    // Call the helper function to iteratively assign regions to cells
    generate_puzzle_helper(&mut puzzle, &mut rng);

    puzzle
}

pub fn generate_regions(n: usize) -> Vec<Vec<Cell>> {
    let mut regions = vec![vec![]; n];

    for i in 0..n {
        regions[i].push(Cell { row: i, col: i });
    }

    regions
}