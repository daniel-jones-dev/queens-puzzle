use crate::grid::Cell;
use rand::prelude::{SliceRandom, StdRng};

struct ShuffleQueensState {
    queens: Vec<Cell>, // TODO remove, use ordered rows_used to get queens
    rows_used: Vec<usize>,
    rows_free: Vec<usize>,
    solutions: Vec<Vec<Cell>>,
    solutions_limit: usize,
}

pub fn shuffle_queens(n: usize, rng: &mut StdRng) -> Option<Vec<Cell>> {
    let mut state = ShuffleQueensState{
        queens: vec![],
        rows_used: vec![],
        rows_free: (0..n).collect(),
        solutions: vec![],
        solutions_limit: 1,
    };
    shuffle_queens_helper(&mut state, 0, None, rng);
    state.solutions.into_iter().next()
}

pub fn shuffle_queens_all(n: usize, rng: &mut StdRng) -> Vec<Vec<Cell>> {
    let mut state = ShuffleQueensState{
        queens: vec![],
        rows_used: vec![],
        rows_free: (0..n).collect(),
        solutions: vec![],
        solutions_limit: usize::MAX,
    };
    shuffle_queens_helper(&mut state, 0, None, rng);
    state.solutions
}

fn shuffle_queens_helper(
    state: &mut ShuffleQueensState,
    col: usize,
    row_above: Option<usize>,
    rng: &mut StdRng,
) {
    // Filter free rows by removing neighbors from row above
    let mut rows_available = match row_above {
        None => state.rows_free.clone(),
        Some(row_above) => {
            state.rows_free.iter().filter(|row| {
                row > &&(row_above + 1) || (row_above > 1 && row < &&(row_above - 1))
            }).cloned().collect()
        },
    };
    rows_available.shuffle(rng);

    for row in rows_available {
        state.queens.push(Cell { col, row });
        state.rows_used.push(row);
        state.rows_free.retain(|&r| r != row);
        if state.rows_free.is_empty() {
            state.solutions.push(state.queens.clone());
            if state.solutions.len() >= state.solutions_limit {
                return;
            }
        } else {
            shuffle_queens_helper(state, col + 1, Some(row), rng);
        }
        state.queens.pop();
        state.rows_used.pop();
        state.rows_free.push(row);
        state.rows_free.sort();
    }
}