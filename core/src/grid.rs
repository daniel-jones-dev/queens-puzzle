use std::borrow::Borrow;
use std::collections::HashSet;
use std::fmt;
use std::ops::{Index, IndexMut};

/// Represents a cell in a grid with row and column indices.
#[derive(Clone, Copy, PartialEq, Eq, Hash)]
pub struct Cell {
    pub row: usize,
    pub col: usize,
}
impl Cell {
    pub fn new(row: usize, col: usize) -> Self {
        Cell { row, col }
    }
}

#[macro_export]
macro_rules! cell {
    ($row:expr, $col:expr) => {
        Cell::new($row, $col)
    };
}

impl fmt::Display for Cell {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "({}, {})", self.row, self.col)
    }
}

impl fmt::Debug for Cell {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Cell({}, {})", self.row, self.col)
    }
}

impl PartialEq<Cell> for &Cell {
    fn eq(&self, other: &Cell) -> bool {
        self.row == other.row && self.col == other.col
    }
}

/// Represents a two-dimensional grid of cells with a specified width and height.
#[derive(Clone)]
pub struct Grid<T: Default> {
    data: Vec<T>,
    height: usize,
    width: usize,
}

impl<T: Default> Grid<T> {
    /// Creates a new grid with the specified width and height, initializing all cells with the default value.
    pub fn new(height: usize, width: usize) -> Self {
        let mut data = Vec::with_capacity(width * height);
        for _ in 0..width * height {
            data.push(T::default());
        }
        Grid {
            data,
            height,
            width,
        }
    }

    pub fn height(&self) -> usize {
        self.height
    }

    pub fn width(&self) -> usize {
        self.width
    }

    pub fn all_cells(&self) -> impl Iterator<Item = Cell> + use<'_, T> {
        (0..self.height()).flat_map(move |row| (0..self.width()).map(move |col| Cell { row, col }))
    }

    pub fn cells_in_same_row(&self, cell: Cell) -> impl Iterator<Item = Cell> + '_ {
        (0..self.width())
            .filter(move |&col| col != cell.col)
            .map(move |col| Cell { row: cell.row, col })
    }

    pub fn cells_in_same_col(&self, cell: Cell) -> impl Iterator<Item = Cell> + '_ {
        (0..self.height())
            .filter(move |&row| row != cell.row)
            .map(move |row| Cell { row, col: cell.col })
    }

    /// Returns a hashset of cells in given row
    pub fn row_iter(&self, row: usize) -> HashSet<Cell> {
        (0..self.width())
            .map(move |col| Cell { row, col })
            .collect::<HashSet<Cell>>()
    }

    /// Returns an iterator over all rows
    pub fn all_rows_iter(&self) -> impl Iterator<Item = (HashSet<Cell>, usize)> + '_ {
        (0..self.height()).map(move |r| {
            (
                (0..self.width())
                    .map(move |c| Cell { row: r, col: c })
                    .collect(),
                r,
            )
        })
    }

    /// Returns a hashset of cells in given column
    pub fn col_iter(&self, col: usize) -> HashSet<Cell> {
        (0..self.height())
            .map(move |row| Cell { row, col })
            .collect::<HashSet<Cell>>()
    }

    /// Returns an iterator over all columns
    pub fn all_cols_iter(&self) -> impl Iterator<Item = (HashSet<Cell>, usize)> + '_ {
        (0..self.width()).map(move |c| {
            (
                (0..self.height())
                    .map(move |r| Cell { row: r, col: c })
                    .collect(),
                c,
            )
        })
    }

    /// Returns an iterator over the (up to) four cells up/down/left/right adjacent to a cell
    pub fn cells_cardinally_adjacent(&self, cell: Cell) -> impl Iterator<Item = Cell> + '_ {
        let mut result = vec![];
        if cell.col > 0 {
            result.push(Cell {
                row: cell.row,
                col: cell.col - 1,
            });
        }
        if cell.col < self.width() - 1 {
            result.push(Cell {
                row: cell.row,
                col: cell.col + 1,
            });
        }
        if cell.row > 0 {
            result.push(Cell {
                row: cell.row - 1,
                col: cell.col,
            });
        }
        if cell.row < self.height() - 1 {
            result.push(Cell {
                row: cell.row + 1,
                col: cell.col,
            });
        }
        result.into_iter()
    }

    /// Returns an iterator over the four cells diagonally adjacent to a cell
    pub fn cells_diagonally_adjacent(&self, cell: Cell) -> impl Iterator<Item = Cell> + '_ {
        let offsets = [(-1, -1), (-1, 1), (1, -1), (1, 1)];
        offsets
            .iter()
            .filter_map(move |&(dr, dc)| {
                let r = cell.row as i32 + dr;
                let c = cell.col as i32 + dc;
                if r >= 0 && r < self.height() as i32 && c >= 0 && c < self.width() as i32 {
                    Some(Cell {
                        row: r as usize,
                        col: c as usize,
                    })
                } else {
                    None
                }
            })
            .collect::<Vec<_>>()
            .into_iter()
    }

    fn check_in_range(&self, cell: Cell) {
        if cell.col >= self.width || cell.row >= self.height {
            panic!("Cell out of bounds");
        }
    }
}

// Index by Cell

impl<T: Default, B: Borrow<Cell>> Index<B> for Grid<T> {
    type Output = T;

    fn index(&self, cell: B) -> &T {
        let cell = cell.borrow();
        self.check_in_range(*cell);
        &self.data[cell.row * self.width + cell.col]
    }
}

impl<T: Default, B: Borrow<Cell>> IndexMut<B> for Grid<T> {
    fn index_mut(&mut self, cell: B) -> &mut T {
        let cell = cell.borrow();
        self.check_in_range(*cell);
        &mut self.data[cell.row * self.width + cell.col]
    }
}

#[cfg(test)]
mod tests {
    #[allow(unused_imports)]
    use crate::cell;
    use crate::grid::{Cell, Grid};
    use std::collections::HashSet;

    #[test]
    fn default() {
        let grid: Grid<u32> = Grid::new(3, 2);
        assert_eq!(grid.width(), 2);
        assert_eq!(grid.height(), 3);
        assert_eq!(grid[cell![0, 0]], 0);
        assert_eq!(grid[cell![0, 1]], 0);
        assert_eq!(grid[cell![1, 0]], 0);
        assert_eq!(grid[cell![1, 1]], 0);
        assert_eq!(grid[cell![2, 0]], 0);
        assert_eq!(grid[cell![2, 1]], 0);
    }

    #[test]
    fn setter() {
        let mut grid: Grid<u32> = Grid::new(3, 2);
        grid[cell![0, 0]] = 3;
        grid[cell![2, 1]] = 5;
        assert_eq!(grid[cell![0, 0]], 3);
        assert_eq!(grid[cell![2, 1]], 5);
    }

    #[test]
    fn cells_in_same_col() {
        let grid: Grid<u32> = Grid::new(3, 2);
        let col1: HashSet<_> = vec![cell![0, 1], cell![2, 1]].into_iter().collect();
        assert_eq!(
            grid.cells_in_same_col(cell![1, 1])
                .collect::<HashSet<Cell>>(),
            col1
        );
    }

    #[test]
    fn cells_in_same_row() {
        let grid: Grid<u32> = Grid::new(3, 2);
        let row1: HashSet<_> = vec![cell![2, 1]].into_iter().collect();
        assert_eq!(
            grid.cells_in_same_row(cell![2, 0])
                .collect::<HashSet<Cell>>(),
            row1
        );
    }

    #[test]
    fn row_iter() {
        let grid: Grid<u32> = Grid::new(3, 2);
        let expected_rows: Vec<HashSet<Cell>> = vec![
            vec![cell![0, 0], cell![0, 1]].into_iter().collect(),
            vec![cell![1, 0], cell![1, 1]].into_iter().collect(),
            vec![cell![2, 0], cell![2, 1]].into_iter().collect(),
        ];
        let actual_rows: Vec<HashSet<Cell>> = grid.all_rows_iter().map(|(row, _)| row).collect();
        assert_eq!(actual_rows, expected_rows);
    }

    #[test]
    fn col_iter() {
        let grid: Grid<u32> = Grid::new(3, 2);
        let expected_rows: Vec<HashSet<Cell>> = vec![
            vec![cell![0, 0], cell![1, 0], cell![2, 0]]
                .into_iter()
                .collect(),
            vec![cell![0, 1], cell![1, 1], cell![2, 1]]
                .into_iter()
                .collect(),
        ];
        let actual_rows: Vec<HashSet<Cell>> = grid.all_cols_iter().map(|(col, _)| col).collect();
        assert_eq!(actual_rows, expected_rows);
    }

    #[test]
    fn cells_cardinally_adjacent() {
        let grid: Grid<u32> = Grid::new(3, 3);
        let cell = cell![1, 1];
        let adjacent_cells: HashSet<_> = vec![cell![0, 1], cell![2, 1], cell![1, 0], cell![1, 2]]
            .into_iter()
            .collect();
        assert_eq!(
            grid.cells_cardinally_adjacent(cell)
                .collect::<HashSet<Cell>>(),
            adjacent_cells
        );

        // Test clipping
        let cell = cell![2, 2];
        let adjacent_cells: HashSet<_> = vec![cell![1, 2], cell![2, 1]].into_iter().collect();
        assert_eq!(
            grid.cells_cardinally_adjacent(cell)
                .collect::<HashSet<Cell>>(),
            adjacent_cells
        );
    }

    #[test]
    fn cells_diagonally_adjacent() {
        let grid: Grid<u32> = Grid::new(3, 3);
        let cell = cell![1, 1];
        let adjacent_cells: HashSet<_> = vec![cell![0, 0], cell![0, 2], cell![2, 0], cell![2, 2]]
            .into_iter()
            .collect();
        assert_eq!(
            grid.cells_diagonally_adjacent(cell)
                .collect::<HashSet<Cell>>(),
            adjacent_cells
        );

        // Test clipping
        let cell = cell![2, 2];
        let adjacent_cells: HashSet<_> = vec![cell![1, 1]].into_iter().collect();
        assert_eq!(
            grid.cells_diagonally_adjacent(cell)
                .collect::<HashSet<Cell>>(),
            adjacent_cells
        );
    }
}
