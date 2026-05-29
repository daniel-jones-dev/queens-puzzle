use std::fmt;
use std::ops::{Index, IndexMut};


#[derive(Clone, Copy)]
#[derive(PartialEq, Eq, Hash)]
pub struct Cell {
    pub(crate) row: usize,
    pub(crate) col: usize,
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


pub struct Grid<T: Default> {
    data: Vec<T>,
    width: usize,
    height: usize,
}

impl<T: Default> Grid<T> {
    pub fn new(width: usize, height: usize) -> Self {
        let mut data = Vec::with_capacity(width * height);
        for _ in 0..width * height {
            data.push(T::default());
        }
        Grid {
            data,
            width,
            height,
        }
    }

    fn check_in_range(&self, cell: Cell) {
        if cell.col >= self.width || cell.row >= self.height {
            panic!("Cell out of bounds");
        }
    }
}

impl<T: Default> Index<Cell> for Grid<T> {
    type Output = T;

    fn index(&self, cell: Cell) -> &T {
        self.check_in_range(cell);
        &self.data[cell.row * self.width + cell.col]
    }
}

impl<T: Default> IndexMut<Cell> for Grid<T> {
    fn index_mut(&mut self, cell: Cell) -> &mut T {
        self.check_in_range(cell);
        &mut self.data[cell.row * self.width + cell.col]
    }
}
impl<T: Default> Index<&Cell> for Grid<T> {
    type Output = T;

    fn index(&self, cell: &Cell) -> &T {
        self.check_in_range(*cell);
        &self.data[cell.row * self.width + cell.col]
    }
}

impl<T: Default> IndexMut<&Cell> for Grid<T> {
    fn index_mut(&mut self, cell: &Cell) -> &mut T {
        self.check_in_range(*cell);
        &mut self.data[cell.row * self.width + cell.col]
    }
}
