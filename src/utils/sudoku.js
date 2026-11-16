// src/utils/sudoku.js

const BLANK = null;

// PRNG (Pseudo-Random Number Generator) for seeded daily puzzles
function mulberry32(a) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

function isValid(board, row, col, num) {
  for (let i = 0; i < 9; i++) {
    if (board[row][i] === num || board[i][col] === num) return false;
  }
  const startRow = Math.floor(row / 3) * 3;
  const startCol = Math.floor(col / 3) * 3;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (board[startRow + i][startCol + j] === num) return false;
    }
  }
  return true;
}

function fillBoard(board, randomFn) {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row][col] === BLANK) {
        // Use our seeded random function instead of Math.random
        const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => randomFn() - 0.5);
        for (let num of numbers) {
          if (isValid(board, row, col, num)) {
            board[row][col] = num;
            if (fillBoard(board, randomFn)) return true;
            board[row][col] = BLANK;
          }
        }
        return false;
      }
    }
  }
  return true;
}

export function generateSudoku(difficulty = 40, seedString = null) {
  let randomFn = Math.random; // Default to pure random
  
  if (seedString) {
    // Convert string (e.g. "2026-11-16") to a numeric seed
    let numericSeed = 0;
    for (let i = 0; i < seedString.length; i++) {
      numericSeed = (numericSeed << 5) - numericSeed + seedString.charCodeAt(i);
      numericSeed |= 0; // Convert to 32bit integer
    }
    randomFn = mulberry32(numericSeed);
  }

  let solutionBoard = Array(9).fill().map(() => Array(9).fill(BLANK));
  fillBoard(solutionBoard, randomFn);

  let puzzleBoard = solutionBoard.map(row => [...row]);
  
  let attempts = difficulty; 
  while (attempts > 0) {
    let row = Math.floor(randomFn() * 9);
    let col = Math.floor(randomFn() * 9);
    if (puzzleBoard[row][col] !== BLANK) {
      puzzleBoard[row][col] = BLANK;
      attempts--;
    }
  }

  const cells = [];
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const value = puzzleBoard[row][col];
      cells.push({
        index: row * 9 + col,
        row: row,
        col: col,
        box: Math.floor(row / 3) * 3 + Math.floor(col / 3),
        value: value,
        solution: solutionBoard[row][col],
        isGiven: value !== BLANK,
        notes: [],
        isError: false
      });
    }
  }
  return cells;
}