use crate::grid::{Cell, Grid};
use std::borrow::Borrow;
use std::collections::HashSet;
use std::fmt::Display;
use std::ops::{Index, IndexMut};

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
    Region,
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

pub fn region_color_name(block_index: usize) -> &'static str {
    match block_index {
        0 => "purple",
        1 => "orange",
        2 => "blue",
        3 => "green",
        4 => "white",
        5 => "red",
        6 => "yellow",
        7 => "grey",
        8 => "pink",
        9 => "sea green",
        10 => "teal",
        11 => "brown",
        _ => unreachable!("region index out of bounds"),
    }
}

#[derive(Copy, Clone)]
pub struct Color {
    pub(crate) r: u8,
    pub(crate) g: u8,
    pub(crate) b: u8,
}

pub fn region_color(block_index: usize) -> Color {
    const PURPLE: Color = Color {
        r: 187,
        g: 163,
        b: 226,
    };
    const ORANGE: Color = Color {
        r: 255,
        g: 201,
        b: 146,
    };
    const BLUE: Color = Color {
        r: 150,
        g: 190,
        b: 255,
    };
    const GREEN: Color = Color {
        r: 179,
        g: 223,
        b: 160,
    };
    const WHITE: Color = Color {
        r: 223,
        g: 223,
        b: 223,
    };
    const RED: Color = Color {
        r: 255,
        g: 123,
        b: 96,
    };
    const YELLOW: Color = Color {
        r: 230,
        g: 243,
        b: 136,
    };
    const GREY: Color = Color {
        r: 185,
        g: 178,
        b: 158,
    };
    const PINK: Color = Color {
        r: 223,
        g: 160,
        b: 191,
    };
    const SEA_GREEN: Color = Color {
        r: 163,
        g: 210,
        b: 216,
    };
    const TEAL: Color = Color {
        r: 98,
        g: 239,
        b: 234,
    };
    const BROWN: Color = Color {
        r: 166,
        g: 90,
        b: 47,
    };

    let colors = vec![
        PURPLE, ORANGE, BLUE, GREEN, WHITE, RED, YELLOW, GREY, PINK, SEA_GREEN, TEAL, BROWN,
    ];
    colors[block_index % colors.len()]
}

pub fn column_name(block_index: usize) -> String {
    // Columns use letters A, B, C, ..
    format!("Column {}", (block_index as u8 + b'A') as char)
}

pub fn row_name(block_index: usize) -> String {
    format!("Row {}", block_index + 1)
}

pub fn region_name(block_index: usize) -> String {
    format!("Region {}", region_color_name(block_index))
}

pub fn cell_name(cell: Cell) -> String {
    format!("Cell {}{}", (cell.col as u8 + b'A') as char, cell.row + 1)
}

pub fn block_name(block_type: BlockType, block_index: usize) -> String {
    match block_type {
        BlockType::Column => column_name(block_index),
        BlockType::Row => row_name(block_index),
        BlockType::Region => region_name(block_index),
    }
}

#[derive(Clone)]
pub struct QueensPuzzle {
    /// Cell states
    board: Grid<State>,
    /// Which region each cell belongs to
    cell_regions: Grid<Option<u8>>,
    /// List of regions with each containing the cells that are in the region
    regions: Vec<HashSet<Cell>>,
}

impl QueensPuzzle {
    pub(crate) fn new(region_vecs: Vec<Vec<Cell>>) -> Self {
        let n = region_vecs.len();
        let board = Grid::new(n, n);
        let mut cell_regions = Grid::new(n, n);
        let mut regions = vec![];

        for (region_index, region) in region_vecs.into_iter().enumerate() {
            if region.is_empty() {
                panic!("region {region_index} is empty")
            }
            region.iter().for_each(|cell| {
                cell_regions[cell] = match cell_regions[cell] {
                    Some(set_region) => panic!(
                        "cell {cell} is overlapping in regions {set_region} and {region_index}"
                    ),
                    None => Some(region_index as u8),
                }
            });

            let region: HashSet<Cell> = region.into_iter().collect();
            regions.push(region)
        }

        Self {
            board,
            cell_regions,
            regions,
        }
    }

    pub(crate) fn n(&self) -> usize {
        self.regions.len()
    }

    /// Returns the cells occupied by queens
    pub fn queens(&self) -> Vec<Cell> {
        let mut result = vec![];
        for c in 0..self.n() {
            for r in 0..self.n() {
                let c = Cell { row: r, col: c };
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

    /// Returns the region index for a given cell, if any
    pub fn cell_region(&self, cell: Cell) -> Option<u8> {
        self.cell_regions[cell]
    }

    /// Assigns a region to a cell
    pub fn assign_cell_region(&mut self, cell: Cell, region: u8) {
        if self.cell_regions[cell].is_some() {
            panic!("cell {cell} already has a region")
        }
        self.cell_regions[cell] = Some(region);
        self.regions[region as usize].insert(cell);
    }

    /// Unassigns a region from a cell
    pub fn unassign_cell_region(&mut self, cell: Cell) {
        if self.cell_regions[cell].is_none() {
            panic!("cell {cell} does not have a region")
        }
        let region = self.cell_regions[cell].unwrap();
        self.regions[region as usize].remove(&cell);
        self.cell_regions[cell] = None;
    }

    /// Returns a hashset of cells in given row
    pub fn row_iter(&self, row: usize) -> HashSet<Cell> {
        self.board.row_iter(row)
    }

    /// Returns an iterator over all cells in the puzzle
    pub fn all_cells(&self) -> impl Iterator<Item = Cell> + use<'_> {
        self.board.all_cells()
    }

    /// Returns an iterator over all rows, returning the cell-set and row index
    pub(crate) fn all_rows_iter(&self) -> impl Iterator<Item = (HashSet<Cell>, usize)> + '_ {
        self.board.all_rows_iter()
    }

    /// Returns a hashset of cells in given column
    pub fn col_iter(&self, col: usize) -> HashSet<Cell> {
        self.board.col_iter(col)
    }

    /// Returns an iterator over all columns, returning the cell-set and col index
    pub(crate) fn all_cols_iter(&self) -> impl Iterator<Item = (HashSet<Cell>, usize)> + '_ {
        self.board.all_cols_iter()
    }

    /// Returns an iterator over all regions, returning the cell-set and region index
    pub(crate) fn all_regions_iter(&self) -> impl Iterator<Item = (HashSet<Cell>, usize)> + '_ {
        self.regions
            .iter()
            .enumerate()
            .map(|(i, cells)| (cells.clone(), i))
    }

    /// Returns an iterator over all blocks (rows, columns, regions), returning the cell-set, block-index, and block type
    pub(crate) fn all_blocks_iter(
        &self,
    ) -> impl Iterator<Item = (HashSet<Cell>, usize, BlockType)> + '_ {
        self.all_rows_iter()
            .map(|(cells, index)| (cells, index, BlockType::Row))
            .chain(
                self.all_cols_iter()
                    .map(|(cells, index)| (cells, index, BlockType::Column)),
            )
            .chain(
                self.all_regions_iter()
                    .map(|(cells, index)| (cells, index, BlockType::Region)),
            )
    }

    /// Returns an iterator over cells in the same row as the given cell, excluding the given cell
    pub(crate) fn cells_in_same_row(&self, cell: Cell) -> impl Iterator<Item = Cell> + '_ {
        self.board.cells_in_same_row(cell)
    }

    /// Returns an iterator over cells in the same column as the given cell, excluding the given cell
    pub(crate) fn cells_in_same_col(&self, cell: Cell) -> impl Iterator<Item = Cell> + '_ {
        self.board.cells_in_same_col(cell)
    }

    /// Returns an iterator over cells in the same region as the given cell, excluding the given cell
    fn cells_in_same_region(&self, cell: Cell) -> impl Iterator<Item = Cell> + '_ {
        match self.cell_regions[cell] {
            None => vec![],
            Some(region_index) => self.regions[region_index as usize]
                .iter()
                .filter(|&&c| c != cell)
                .copied()
                .collect(),
        }
        .into_iter()
    }

    /// Returns an iterator over the four cells diagonally adjacent to a cell
    pub fn cells_diagonally_adjacent(&self, cell: Cell) -> impl Iterator<Item = Cell> + '_ {
        self.board.cells_diagonally_adjacent(cell)
    }

    pub fn cells_cardinally_adjacent(&self, cell: Cell) -> impl Iterator<Item = Cell> + '_ {
        self.board.cells_cardinally_adjacent(cell)
    }

    pub fn connected_cells(&self, cell: Cell) -> impl Iterator<Item = Cell> + '_ {
        self.cells_in_same_col(cell)
            .chain(self.cells_in_same_row(cell))
            .chain(self.cells_in_same_region(cell))
            .chain(self.cells_diagonally_adjacent(cell))
    }

    pub(crate) fn is_valid_move(&self, cell: Cell) -> bool {
        if self.board[cell] != State::Unknown || self.cell_regions[cell].is_none() {
            return false;
        }

        if self
            .connected_cells(cell)
            .any(|cell: Cell| self.board[cell] == State::Queen)
        {
            return false;
        }

        true
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

#[cfg(test)]
mod tests {
    use crate::cell;
    use crate::puzzle::{column_name, QueensPuzzle};
    use crate::Cell;
    use std::collections::HashSet;

    /// Test puzzle with the following setup:
    ///
    ///  Queens:
    ///  [ ] [ ] [1] [ ]
    ///  [2] [ ] [ ] [ ]
    ///  [ ] [ ] [ ] [3]
    ///  [ ] [4] [ ] [ ]
    ///  Regions:
    ///  [1] [1] [1] [1]
    ///  [2] [4] [3] [3]
    ///  [4] [4] [3] [3]
    ///  [4] [4] [3] [3]
    ///
    fn build_test_puzzle() -> QueensPuzzle {
        QueensPuzzle::new(vec![
            vec![cell![0, 0], cell![0, 1], cell![0, 2], cell![0, 3]],
            vec![cell![1, 0]],
            vec![
                cell![1, 2],
                cell![1, 3],
                cell![2, 2],
                cell![2, 3],
                cell![3, 2],
                cell![3, 3],
            ],
            vec![
                cell![1, 1],
                cell![2, 0],
                cell![2, 1],
                cell![3, 0],
                cell![3, 1],
            ],
        ])
    }

    #[test]
    fn test_column_name() {
        assert_eq!(column_name(0), "Column A");
        assert_eq!(column_name(1), "Column B");
        assert_eq!(column_name(2), "Column C");
        assert_eq!(column_name(3), "Column D");
        assert_eq!(column_name(4), "Column E");
        assert_eq!(column_name(5), "Column F");
        assert_eq!(column_name(6), "Column G");
        assert_eq!(column_name(7), "Column H");
        assert_eq!(column_name(8), "Column I");
        assert_eq!(column_name(9), "Column J");
        assert_eq!(column_name(10), "Column K");
        assert_eq!(column_name(11), "Column L");
    }

    #[test]
    fn setup() {
        let puzzle = build_test_puzzle();
        assert_eq!(puzzle.n(), 4);
        assert_eq!(puzzle.is_solved(), false);
        assert_eq!(puzzle.all_regions_iter().count(), 4);
    }

    #[test]
    fn connected_cells() {
        let puzzle = build_test_puzzle();
        // Cell 0,0
        let expected_cells: HashSet<Cell> = vec![
            cell![0, 1],
            cell![0, 2],
            cell![0, 3], // Same row
            cell![1, 0],
            cell![2, 0],
            cell![3, 0], // Same column
            cell![1, 1], // diagonally adjacent
        ]
        .into_iter()
        .collect();
        assert_eq!(
            expected_cells,
            puzzle.connected_cells(cell![0, 0]).into_iter().collect()
        );

        // Cell 3,0
        let expected_cells: HashSet<Cell> = vec![
            cell![3, 1],
            cell![3, 2],
            cell![3, 3], // Same row
            cell![0, 0],
            cell![1, 0],
            cell![2, 0], // Same column
            cell![2, 1], // diagonally adjacent
            cell![1, 1], // same region
        ]
        .into_iter()
        .collect();
        assert_eq!(
            expected_cells,
            puzzle.connected_cells(cell![3, 0]).into_iter().collect()
        );
    }
}
