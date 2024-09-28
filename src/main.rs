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
        // If same row contains queen
        for i in 0..c {
            if self.board[r][i] == State::Queen {
                return false;
            }
        }

        // If same column contains queen
        for i in 0..r {
            if self.board[i][c] == State::Queen {
                return false;
            }
        }

        // If diagonally-adjacent cells contain queen
        if r > 0 {
            if c > 0 {
                if self.board[r - 1][c - 1] == State::Queen {
                    return false;
                }
            } else if c < self.n() - 1 {
                if self.board[r - 1][c + 1] == State::Queen {
                    return false;
                }
            }
        } else if r < self.n() - 1 {
            if c > 0 {
                if self.board[r + 1][c - 1] == State::Queen {
                    return false;
                }
            } else if c < self.n() - 1 {
                if self.board[r + 1][c + 1] == State::Queen {
                    return false;
                }
            }
        }

        // If any cells in the region containing this cell contain queen
        for region in &self.regions {
            if region.contains(&Cell { r, c }) {
                if region.iter().any(|cell| self.board[cell.r][cell.c] == State::Queen) {
                    return false;
                }
            }
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
