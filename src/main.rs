struct QueensPuzzle {
    // Which cells have queens in them
    board: Vec<Vec<bool>>,
    // List of regions, and the cells that are in each region
    regions: Vec<Vec<usize>>,
    // Dimension of board
    n: usize,
}

impl QueensPuzzle {
    fn new(n: usize, regions: &Vec<Vec<usize>>) -> Self {
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

fn generate_regions(n: usize) -> Vec<Vec<usize>> {
    let mut regions = vec![vec![]; n];

    for i in 0..n {
        regions[i].push(i);
    }

    regions
}



fn main() {
    println!("Hello, world!");
}
