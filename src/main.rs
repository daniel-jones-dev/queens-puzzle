use std::cmp::PartialEq;
use std::collections::HashMap;
use colored::*;

#[derive(Clone)]
#[derive(PartialEq)]
struct Cell {
    r: usize,
    c: usize,
}

#[derive(Clone)]
#[derive(PartialEq)]
enum State {
    Unknown,
    Queen,
    Empty,
}

struct QueensPuzzle {
    // Cells states
    board: Vec<Vec<State>>,
    // List of regions, and the cells that are in each region
    regions: Vec<Vec<Cell>>,
}

impl QueensPuzzle {
    fn new(regions: &Vec<Vec<Cell>>) -> Self {
        let n = regions.len();
        let board = vec![vec![State::Unknown; n]; n];
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
                if self.board[r][c] == State::Queen {
                    result.push(Cell{r, c});
                }
            }
        }
        result
    }

    fn cells_in_same_row(&self, cell: Cell) -> impl Iterator<Item = Cell> + '_ {
        (0..self.n()).filter(move |&c| c != cell.c).map(move |c| Cell{r: cell.r, c})
    }

    fn cells_in_same_col(&self, cell: Cell) -> impl Iterator<Item = Cell> + '_ {
        (0..self.n()).filter(move |&r| r != cell.r).map(move |r| Cell {r, c: cell.c})
    }

    fn cells_in_same_region(&self, cell: Cell) -> impl Iterator<Item = Cell> + '_ {
        // Handle case cell is not in a region -- to allow more flexible puzzles
        let region_index = self.regions.iter().position(|region| region.contains(&cell));
        let region = region_index.map(|index| &self.regions[index]);
        region.into_iter().flat_map(move |region| {
            region.iter().filter(move |&&c| c != cell).cloned()
        })
    }

    fn cells_diagonally_adjacent(&self, cell: Cell) -> impl Iterator<Item = Cell> + '_ {
        let n = self.n();
        (0..2).flat_map(move |i| {
            let offsets = [0, 2];
            offsets.iter().filter_map(move |&j| {
                if cell.r + i == 0 || cell.c + j == 0 {
                    None
                } else {
                    let c = Cell { r: cell.r + i - 1, c: cell.c + j - 1 };
                    if c.r < n && c.c < n && c != cell {
                        Some(c)
                    } else {
                        None
                    }
                }
            }).collect::<Vec<_>>()
        })
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
            if self.is_valid_move(row, col) {
                self.board[row][col] = State::Queen;

                if self.solve_helper(col + 1) {
                    return true;
                }

                self.board[row][col] = State::Unknown;
            }
        }

        false
    }

    fn is_valid_move(&self, r: usize, c: usize) -> bool {
        if self.connected_cells(Cell{r, c}).any(|cell: Cell| {self.board[cell.r][cell.c] == State::Queen}) {
            return false;
        }

        true
    }

    fn total_in_region(&self, region: &Vec<Cell>, state: State) -> usize {
        region.iter().fold(0, |acc, cell| {
            if self.board[cell.r][cell.c] == state { acc+1 } else { acc }
        })
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
        regions[i].push(Cell { r: i, c: i });
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
                regions[region_index].push(Cell { r, c });
            } else if ch != ' ' {
                return Err(format!("Invalid character in row {}, column {}: {}", r + 1, c + 1, ch));
            }
        }
    }

    Ok(QueensPuzzle::new(&regions))
}

fn print_board_colorized(puzzle: &QueensPuzzle) {
    let n = puzzle.n();

    for i in 0..n {
        for j in 0..n {
            let char = match puzzle.board[i][j] {
                State::Queen => " ♛ ",
                State::Empty => " . ",
                _ => "   ",
            };
            let cell = Cell { r: i, c: j };
            let region_index = puzzle.regions.iter().position(|region| region.contains(&cell));

            match region_index {
                Some(index) => print!("{} ", colorize(char, index)),
                None => print!("{}", char),
            }
        }

        println!();
    }
}

fn colorize(cell: &str, region_index: usize) -> ColoredString {
    let colors = vec![Color::Red, Color::Green, Color::Yellow, Color::Blue, Color::Magenta, Color::Cyan, Color::White];
    cell.on_color(colors[region_index % colors.len()])
}


fn main() {
    let puzzle_sep_26_str = "pppppob\nppppooo\npgppwow\nggprwww\nggrrrww\ngrrrrrw\nrrryrrr";
    let mut puzzle_sep_26 = read_regions(puzzle_sep_26_str).unwrap();
    print_board_colorized(&puzzle_sep_26);
    &puzzle_sep_26.solve();
    println!();
    print_board_colorized(&puzzle_sep_26);


    println!("Hello, world!");
}
