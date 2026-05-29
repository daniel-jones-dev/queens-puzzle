mod grid;

use crate::grid::Grid;
use crate::grid::Cell;
use std::cmp::PartialEq;
use std::collections::{HashMap, HashSet};
use std::{fmt, fs};
use colored::*;


#[derive(Clone, Default, PartialEq)]
enum State {
    #[default]
    Unknown,
    Queen,
    Empty,
}

struct QueensPuzzle {
    // Cells states
    // board: Vec<Vec<State>>,
    board: Grid<State>,
    // List of regions, and the cells that are in each region
    regions: Vec<Vec<Cell>>,
}

impl QueensPuzzle {
    fn new(regions: &Vec<Vec<Cell>>) -> Self {
        let n = regions.len();
        let board = Grid::new(n, n);
        let regions = regions.clone();
        // TODO check the regions are valid: within bounds, non-overlapping
        //  probably do not want to enforce complete-fill though, to simplify puzzle generation
        Self { board, regions }
    }

    fn n(&self) -> usize {
        self.regions.len()
    }

    fn solve(&mut self) -> bool {
        self.solve_helper(0)
    }

    // Returns the cells occupied by queens
    fn queens(&self) -> Vec<Cell> {
        // TODO consider memoizing
        let mut result = vec![];
        for c in 0..self.n() {
            for r in 0..self.n() {
                let c = Cell{ row: r, col: c };
                if self.board[c] == State::Queen {
                    result.push(c);
                }
            }
        }
        result
    }

    fn is_solved(&self) -> bool {
        self.queens().len() == self.n()
    }

    // Returns an iterator over all rows
    fn row_iter(&self) -> impl Iterator<Item = Vec<Cell>> + '_ {
        (0..self.n()).map(move |r| {
            (0..self.n()).map(move |c| Cell { row: r, col: c }).collect()
        })
    }

    // Returns an iterator over all columns
    fn col_iter(&self) -> impl Iterator<Item = Vec<Cell>> + '_ {
        (0..self.n()).map(move |c| {
            (0..self.n()).map(move |r| Cell { row: r, col: c }).collect()
        })
    }

    // Returns an iterator over all regions
    fn region_iter(&self) -> impl Iterator<Item = Vec<Cell>> + '_ {
        self.regions.iter().map(move |r| {r.clone()})
    }

    fn block_iter(&self) -> impl Iterator<Item = Vec<Cell>> + '_ {
        self.row_iter().chain(self.col_iter()).chain(self.region_iter())
    }

    fn cells_in_same_row(&self, cell: Cell) -> impl Iterator<Item = Cell> + '_ {
        (0..self.n()).filter(move |&c| c != cell.col).map(move |c| Cell{ row: cell.row, col: c })
    }

    fn cells_in_same_col(&self, cell: Cell) -> impl Iterator<Item = Cell> + '_ {
        (0..self.n()).filter(move |&r| r != cell.row).map(move |r| Cell { row: r, col: cell.col })
    }

    fn cells_in_same_region(&self, cell: Cell) -> impl Iterator<Item = Cell> + '_ {
        // Handle case cell is not in a region -- to allow more flexible puzzles
        let region_index = self.regions.iter().position(|region| region.contains(&cell));
        let region = region_index.map(|index| &self.regions[index]);
        region.into_iter().flat_map(move |region| {
            region.iter().filter(move |&&c| c != cell).cloned()
        })
    }

    // Returns an iterator over cells diagonally adjacent to a cell
    fn cells_diagonally_adjacent(&self, cell: Cell) -> impl Iterator<Item = Cell> + '_ {
        let offsets = [(-1, -1), (-1, 1), (1, -1), (1, 1)];
        offsets.iter().filter_map(move |&(dr, dc)| {
            let r = cell.row as i32 + dr;
            let c = cell.col as i32 + dc;
            if r >= 0 && r < self.n() as i32 && c >= 0 && c < self.n() as i32 {
                Some(Cell { row: r as usize, col: c as usize })
            } else {
                None
            }
        }).collect::<Vec<_>>().into_iter()
    }

    fn connected_cells(&self, cell: Cell) -> impl Iterator<Item = Cell> + '_ {
        self.cells_in_same_col(cell)
            .chain(self.cells_in_same_row(cell))
            .chain(self.cells_in_same_region(cell))
            .chain(self.cells_diagonally_adjacent(cell))
    }

    fn solve_helper(&mut self, col: usize) -> bool {
        if col >= self.n() {
            return true;
        }

        for row in 0..self.n() {
            let cell = Cell{row, col};
            if self.is_valid_move(cell) {
                self.board[cell] = State::Queen;

                if self.solve_helper(col + 1) {
                    return true;
                }

                self.board[cell] = State::Unknown;
            }
        }

        false
    }

    fn is_valid_move(&self, cell: Cell) -> bool {
        if self.connected_cells(cell).any(|cell: Cell| {self.board[cell] == State::Queen}) {
            return false;
        }

        true
    }

    fn total_in_region(&self, region: &Vec<Cell>, state: State) -> usize {
        region.iter().fold(0, |acc, cell| {
            if self.board[cell] == state { acc+1 } else { acc }
        })
    }
}

// Represents a human-understandable solve hint like "you can mark cell X as a queen because cells Y
// and Z are empty"
struct RuleResult {
    // The cell(s) to be changed and the state to change them to
    changes: Vec<(Cell, State)>,
    // Other cells involved in the rule
    involved: Vec<Cell>,
}

impl RuleResult {
    fn apply(&self, puzzle: &mut QueensPuzzle) {
        for (cell, state) in &self.changes {
            puzzle.board[cell] = state.clone();
        }
    }
}

trait Rule {
    fn description(&self) -> String;

    fn check(&self, puzzle: &QueensPuzzle) -> Option<RuleResult>;
}

struct MarkEmpty;
impl Rule for MarkEmpty {
    fn description(&self) -> String {
        "A queen in one cell indicates that all connected cells are empty, i.e. all cells \
        in the same row, column, region, and diagonally adjacent.".to_string()
    }
    fn check(&self, puzzle: &QueensPuzzle) -> Option<RuleResult> {
        let queens = puzzle.queens();
        for queen_cell in queens {
            let connected_cells_unknown = puzzle.connected_cells(queen_cell)
                .filter(|cell: &Cell| {puzzle.board[cell] == State::Unknown})
                .map(|cell: Cell| {(cell, State::Empty)})
                .collect::<Vec<_>>();
            if !connected_cells_unknown.is_empty() {
                return Some(RuleResult{
                    changes: connected_cells_unknown,
                    involved: vec![queen_cell]
                });
            }
        }

        None
    }
}

struct MarkQueen;
impl MarkQueen {
    fn check_block_has_single_unknown_and_no_queen(&self, puzzle: &QueensPuzzle, block: &Vec<Cell>) -> Option<Cell> {
        let mut maybe_found_unknown_cell = None;
        for cell in block {
            match &puzzle.board[cell] {
                State::Queen => {
                    return None;
                },
                State::Unknown => {
                    match maybe_found_unknown_cell {
                        None => {
                            maybe_found_unknown_cell = Some(*cell);
                        },
                        Some(_) => {
                            return None;
                        }
                    }
                },
                _ => {}
            }
        }
        maybe_found_unknown_cell
    }
}
impl Rule for MarkQueen {
    fn description(&self) -> String {
        "If all cells except one in a row, column, or region are known be empty, the remaining \
        unknown cell must be a queen.".to_string()
    }

    fn check(&self, puzzle: &QueensPuzzle) -> Option<RuleResult> {
        for block in puzzle.block_iter() {
            match self.check_block_has_single_unknown_and_no_queen(puzzle, &block) {
                Some(cell) => {
                    return Some(RuleResult {
                        changes: vec![(cell, State::Queen)],
                        involved: block.iter().filter(|c| { cell != **c }).map(|c| {*c}).collect()
                    })
                }
                None => {}
            }
        }

        None
    }
}

struct NakedSet; // Naming comes from sudokuwiki.org "Naked Pair"
impl Rule for NakedSet {
    fn description(&self) -> String {
        "The involved cells are in the same block and one must contain a queen. \
        The given cell(s) must therefore be empty".to_string()
    }

    fn check(&self, puzzle: &QueensPuzzle) -> Option<RuleResult> {
        'block_loop: for block in puzzle.block_iter() {
            let unknown_cells = block.iter()
                .filter(|cell: &&Cell| {puzzle.board[*cell] == State::Unknown}).map(|cell| {*cell}).collect::<Vec<_>>();
            if unknown_cells.len() >= 2 {
                // Cells connected to all involved cells, that have unknown state
                //  Note: option to skip hashset-intersection in first round
                let mut maybe_coinciding_unknown_cells: Option<HashSet<Cell>> = None;
                for unknown_cell in &unknown_cells {
                    // Cells connected to this one that have unknown state
                    let connected_unknown_cells = puzzle.connected_cells(*unknown_cell)
                        .filter(|cell: &Cell| {
                            puzzle.board[cell] == State::Unknown})
                        .collect::<HashSet<Cell>>();
                    if connected_unknown_cells.is_empty() {
                        continue 'block_loop;
                    }
                    match maybe_coinciding_unknown_cells {
                        None => {
                            maybe_coinciding_unknown_cells = Some(connected_unknown_cells)
                        },
                        Some(ref mut coinciding) => {
                            coinciding.retain(|cell| connected_unknown_cells.contains(&cell));
                            if coinciding.is_empty() {
                                continue 'block_loop;
                            }
                        }
                    };
                }
                return Some(RuleResult{
                    changes: maybe_coinciding_unknown_cells.unwrap().iter().map(|cell| (*cell, State::Empty)).collect(),
                    involved: unknown_cells
                })
            }
        }
        None
    }
}


fn generate_puzzle(n: usize) -> QueensPuzzle {
    let regions = generate_regions(n);
    let mut puzzle = QueensPuzzle::new(&regions);

    while !puzzle.solve() {
        puzzle = QueensPuzzle::new(&regions);
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

    Ok(QueensPuzzle::new(&regions))
}


fn print_board_colorized(puzzle: &QueensPuzzle){
    print_board_result_colorized(puzzle, None);
}

fn print_board_result_colorized(puzzle: &QueensPuzzle, rule_result: Option<RuleResult>) {
    let n = puzzle.n();

    for row in 0..n {
        for col in 0..n {
            let cell = Cell { row, col };
            let mut cell_text = match puzzle.board[cell] {
                State::Queen => " ♛ ",
                State::Empty => " . ",
                _ => "   ",
            }.white();
            let region_index = puzzle.regions.iter().position(|region| region.contains(&cell));

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
}

fn colorize_region(cell: ColoredString, region_index: usize) -> ColoredString {
    let colors = vec![Color::Red, Color::Green, Color::Yellow, Color::Blue, Color::Magenta, Color::Cyan, Color::White];
    cell.on_color(colors[region_index % colors.len()])
}


fn check_rule(puzzle: &mut QueensPuzzle, rule: &dyn Rule) {
    match rule.check(&puzzle) {
        Some(result) => {
            result.apply(puzzle);
            print_board_colorized(&puzzle);
            println!();
        }
        _ => {}
    }
}

fn solve_logically(puzzle: &mut QueensPuzzle) -> Option<usize> {
    let rules: Vec<Box<dyn Rule>> = vec![
        Box::new(MarkEmpty{}),
        Box::new(MarkQueen{}),
        Box::new(NakedSet {})];

    let mut used_rules = 1;

    loop {
        for rule_index in 0..used_rules+1 {
            if rule_index == used_rules {
                if rule_index >= rules.len() {
                    return None;
                }
                used_rules += 1;
            }
            let rule = &rules[rule_index];
            match rule.check(&puzzle) {
                Some(result) => {
                    result.apply(puzzle);
                    print_board_result_colorized(&puzzle, Some(result));
                    println!();
                    if puzzle.is_solved() {
                        return Some(used_rules);
                    }
                    break;
                }
                None => {}
            }
        }
    }
}

fn main() {
    let puzzle_str = fs::read_to_string("puzzles/linkedin_20240921.txt").unwrap();
    let mut puzzle_sep_26 = read_regions(&puzzle_str).unwrap();
    print_board_colorized(&puzzle_sep_26);
    println!();
    solve_logically(&mut puzzle_sep_26);

    print_board_colorized(&puzzle_sep_26);
    println!();
    let _ = &puzzle_sep_26.solve();
    print_board_colorized(&puzzle_sep_26);

}
