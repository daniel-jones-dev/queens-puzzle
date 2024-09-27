use std::collections::HashMap;
use colored::*;

#[derive(Clone)]
#[derive(PartialEq)]
struct Cell {
    r: usize,
    c: usize,
}

struct QueensPuzzle {
    // Which cells have queens in them
    board: Vec<Vec<bool>>,
    // List of regions, and the cells that are in each region
    regions: Vec<Vec<Cell>>,
    // Dimension of board
    n: usize,
}

impl QueensPuzzle {
    fn new(n: usize, regions: &Vec<Vec<Cell>>) -> Self {
        let board = vec![vec![false; n]; n];
        let regions = regions.clone();
        Self { board, regions, n }
    }

    fn solve(&mut self) -> bool {
        self.solve_helper(0)
    }

    fn solve_helper(&mut self, col: usize) -> bool {
        if col >= self.n {
            return true;
        }

        for row in 0..self.n {
            if self.is_valid_move(row, col) {
                self.board[row][col] = true;

                if self.solve_helper(col + 1) {
                    return true;
                }

                self.board[row][col] = false;
            }
        }

        false
    }

    fn is_valid_move(&self, row: usize, col: usize) -> bool {
        for i in 0..col {
            if self.board[row][i] {
                return false;
            }
        }

        for i in 0..row {
            if self.board[i][col] {
                return false;
            }
        }

        // for i in 0..self.n {
        //     for j in 0..self.n {
        //         if self.regions[i].contains(&self.board[i][j]) && self.board[i][j] {
        //             if (i != row || j != col) && (i + j == row + col || i + col == j + row) {
        //                 return false;
        //             }
        //         }
        //     }
        // }

        true
    }
}

fn generate_puzzle(n: usize) -> QueensPuzzle {
    let regions = generate_regions(n);
    let mut puzzle = QueensPuzzle::new(n, &regions);

    while !puzzle.solve() {
        puzzle = QueensPuzzle::new(n, &regions);
    }

    puzzle
}

fn generate_regions(n: usize) -> Vec<Vec<Cell>> {
    let mut regions = vec![vec![]; n];

    for i in 0..n {
        regions[i].push(Cell {r: i, c: i});
    }

    regions
}

fn read_board(input: &str) -> Result<Vec<Vec<bool>>, String> {
    let rows: Vec<&str> = input.trim().split('\n').collect();
    let n = rows.len();
    let mut board = vec![vec![false; n]; n];

    for (i, row) in rows.iter().enumerate() {
        if row.len() != n {
            return Err(format!("Invalid row length in row {}: expected {}, found {}", i + 1, n, row.len()));
        }

        for (j, c) in row.chars().enumerate() {
            match c {
                '0' => board[i][j] = false,
                '1' => board[i][j] = true,
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

    Ok(QueensPuzzle::new(n, &regions))
}

fn print_board_colorized(puzzle: &QueensPuzzle) {
    let n = puzzle.n;

    for i in 0..n {
        for j in 0..n {
            let char = if puzzle.board[i][j] { " ♛ " } else { " . " };
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
    let puzzle_sep_26 = read_regions(puzzle_sep_26_str).unwrap();
    print_board_colorized(&puzzle_sep_26);

    println!("Hello, world!");
}
