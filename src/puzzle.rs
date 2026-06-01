use std::borrow::Borrow;
use std::fmt::Display;
use std::ops::{Index, IndexMut};
use crate::grid::{Cell, Grid};

/// Represents the state of a cell
#[derive(Copy, Clone, Default, PartialEq)]
pub enum State {
    #[default]
    Unknown,
    Queen,
    Empty,
}

pub enum BlockType {
    Column,
    Row,
    Region
}

impl Display for BlockType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            BlockType::Column => write!(f, "column"),
            BlockType::Row => write!(f, "row"),
            BlockType::Region => write!(f, "region"),
        }
    }
}

pub struct QueensPuzzle {
    /// Cells states
    board: Grid<State>,
    /// List of regions with each containing the cells that are in the region
    regions: Vec<Vec<Cell>>,
    // TODO Add Grid<region> to remember which region each cell belongs to
}

impl QueensPuzzle {
    pub(crate) fn new(regions: Vec<Vec<Cell>>) -> Self {
        let n = regions.len();
        let board = Grid::new(n, n);
        // TODO check the regions are valid: within bounds, non-overlapping
        //  probably do not want to enforce complete-fill though, to simplify puzzle generation
        Self { board, regions }
    }

    pub(crate) fn n(&self) -> usize {
        self.regions.len()
    }


    /// Returns the cells occupied by queens
    pub fn queens(&self) -> Vec<Cell> {
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

    pub fn is_solved(&self) -> bool {
        self.queens().len() == self.n()
    }

    /// Returns an iterator over all rows
    pub(crate) fn row_iter(&self) -> impl Iterator<Item = Vec<Cell>> + '_ {
        (0..self.n()).map(move |r| {
            (0..self.n()).map(move |c| Cell { row: r, col: c }).collect()
        })
    }

    // Returns an iterator over all columns
    pub(crate) fn col_iter(&self) -> impl Iterator<Item = Vec<Cell>> + '_ {
        (0..self.n()).map(move |c| {
            (0..self.n()).map(move |r| Cell { row: r, col: c }).collect()
        })
    }

    // Returns an iterator over all regions
    pub(crate) fn region_iter(&self) -> impl Iterator<Item = Vec<Cell>> + '_ {
        self.regions.iter().map(move |r| {r.clone()})
    }

    pub(crate) fn block_iter(&self) -> impl Iterator<Item = (Vec<Cell>, BlockType)> + '_ {
        self.row_iter().map(|cells| (cells, BlockType::Row))
            .chain(self.col_iter().map(|cells| (cells, BlockType::Column)))
            .chain(self.region_iter().map(|cells| (cells, BlockType::Region)))
    }

    pub(crate) fn cells_in_same_row(&self, cell: Cell) -> impl Iterator<Item = Cell> + '_ {
        self.board.cells_in_same_row(cell)
    }

    pub(crate) fn cells_in_same_col(&self, cell: Cell) -> impl Iterator<Item = Cell> + '_ {
        self.board.cells_in_same_col(cell)
    }

    fn cells_in_same_region(&self, cell: Cell) -> impl Iterator<Item = Cell> + '_ {
        match self.regions.iter().find(|region| region.contains(&cell)) {
            None => vec![].into_iter(), // Handle case cell is not in a region
            Some(cells_in_region) => {
                cells_in_region.clone().into_iter().filter(|c| c != cell).collect::<Vec<Cell>>().into_iter()
            }
        }
    }

    /// Returns an iterator over the four cells diagonally adjacent to a cell
    pub fn cells_diagonally_adjacent(&self, cell: Cell) -> impl Iterator<Item = Cell> + '_ {
        self.board.cells_diagonally_adjacent(cell)
    }

    pub fn connected_cells(&self, cell: Cell) -> impl Iterator<Item = Cell> + '_ {
        self.cells_in_same_col(cell)
            .chain(self.cells_in_same_row(cell))
            .chain(self.cells_in_same_region(cell))
            .chain(self.cells_diagonally_adjacent(cell))
    }

    pub(crate) fn is_valid_move(&self, cell: Cell) -> bool {
        if self.board[cell] != State::Unknown {
            return false;
        }

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


// Index by Cell

impl<B: Borrow<Cell>> Index<B> for QueensPuzzle {
    type Output = State;

    fn index(&self, cell: B) -> &State {
        &self.board[cell]
    }
}

impl<B: Borrow<Cell>> IndexMut<B> for QueensPuzzle {
    fn index_mut(&mut self, cell: B) -> &mut State {
        &mut self.board[cell]
    }
}