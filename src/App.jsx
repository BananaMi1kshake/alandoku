// src/App.jsx
import { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { generateSudoku } from './utils/sudoku';

const loadState = (key, defaultValue) => {
  const saved = localStorage.getItem(key);
  if (saved !== null) {
    try { return JSON.parse(saved); } catch (e) { return saved; }
  }
  return defaultValue;
};

const DIFFICULTIES = { 'Easy': 35, 'Medium': 45, 'Hard': 52, 'Expert': 58 };

const triggerVibration = (pattern) => {
  if (typeof window !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};

const INITIAL_STATS = {
  gamesStarted: { Easy: 0, Medium: 0, Hard: 0, Expert: 0, Daily: 0 },
  gamesWon: { Easy: 0, Medium: 0, Hard: 0, Expert: 0, Daily: 0 },
  bestTime: { Easy: null, Medium: null, Hard: null, Expert: null, Daily: null },
  bestScore: { Easy: 0, Medium: 0, Hard: 0, Expert: 0, Daily: 0 },
  totalTime: { Easy: 0, Medium: 0, Hard: 0, Expert: 0, Daily: 0 },
  currentStreak: { Easy: 0, Medium: 0, Hard: 0, Expert: 0, Daily: 0 },
  bestStreak: { Easy: 0, Medium: 0, Hard: 0, Expert: 0, Daily: 0 },
};

function App() {
  // --- CORE GAME STATE ---
  const [board, setBoard] = useState(() => loadState('sudoku-board', []));
  const [mistakes, setMistakes] = useState(() => loadState('sudoku-mistakes', 0));
  const [time, setTime] = useState(() => loadState('sudoku-time', 0));
  const [score, setScore] = useState(() => loadState('sudoku-score', 0));
  const [combo, setCombo] = useState(() => loadState('sudoku-combo', 1));
  const [history, setHistory] = useState(() => loadState('sudoku-history', []));
  const [gameStatus, setGameStatus] = useState(() => loadState('sudoku-status', 'idle')); // idle, playing, won, lost
  const [notesMode, setNotesMode] = useState(() => loadState('sudoku-notesMode', false));
  const [difficulty, setDifficulty] = useState(() => loadState('sudoku-difficulty', 'Easy'));
  
  const [dailyDate, setDailyDate] = useState(() => loadState('sudoku-daily-date', null));
  const [dailyProgress, setDailyProgress] = useState(() => loadState('sudoku-daily-progress', {})); 
  
  const [selectedCell, setSelectedCell] = useState(null);
  const [lockedNumber, setLockedNumber] = useState(null);
  const [isPaused, setIsPaused] = useState(() => loadState('sudoku-paused', false));

  // --- UI NAVIGATION STATE ---
  // If game was playing or paused, open straight to the game. Otherwise, open to main menu.
  const initialView = loadState('sudoku-status', 'idle') === 'playing' || loadState('sudoku-status', 'idle') === 'paused' ? 'game' : 'main';
  const [activeTab, setActiveTab] = useState(initialView); // 'main', 'daily', 'me', 'game'
  const [showDifficultySheet, setShowDifficultySheet] = useState(false);
  
  const [theme, setTheme] = useState(() => loadState('sudoku-theme', 'light'));
  const [settings, setSettings] = useState(() => loadState('sudoku-settings', { autoCheck: true, mistakeLimit: true }));
  const [stats, setStats] = useState(() => loadState('sudoku-stats', INITIAL_STATS));
  const [animatingCells, setAnimatingCells] = useState([]);

  // Sub-menus for the 'Me' tab
  const [meSubView, setMeSubView] = useState(null); // 'stats', 'settings', null
  const [statsTab, setStatsTab] = useState('Easy');

  // Calendar Helpers
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const monthName = today.toLocaleString('default', { month: 'long' });

  // Get absolute best score across all difficulties
  const allTimeBestScore = Math.max(0, ...Object.values(stats.bestScore || {}));

  // --- EFFECTS ---
  useEffect(() => {
    if (animatingCells.length > 0) {
      const timer = setTimeout(() => setAnimatingCells([]), 500);
      return () => clearTimeout(timer);
    }
  }, [animatingCells]);

  useEffect(() => {
    const metaThemeColor = document.querySelector("meta[name=theme-color]");
    if (metaThemeColor) {
      if (theme === 'dark') metaThemeColor.setAttribute("content", "#111827");
      else if (theme === 'sepia') metaThemeColor.setAttribute("content", "#f4ecd8");
      else metaThemeColor.setAttribute("content", "#f9fafb");
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('sudoku-board', JSON.stringify(board));
    localStorage.setItem('sudoku-mistakes', JSON.stringify(mistakes));
    localStorage.setItem('sudoku-time', JSON.stringify(time));
    localStorage.setItem('sudoku-score', JSON.stringify(score));
    localStorage.setItem('sudoku-combo', JSON.stringify(combo));
    localStorage.setItem('sudoku-history', JSON.stringify(history));
    localStorage.setItem('sudoku-status', JSON.stringify(gameStatus));
    localStorage.setItem('sudoku-notesMode', JSON.stringify(notesMode));
    localStorage.setItem('sudoku-difficulty', JSON.stringify(difficulty));
    localStorage.setItem('sudoku-paused', JSON.stringify(isPaused));
    localStorage.setItem('sudoku-settings', JSON.stringify(settings));
    localStorage.setItem('sudoku-stats', JSON.stringify(stats));
    localStorage.setItem('sudoku-theme', JSON.stringify(theme));
    localStorage.setItem('sudoku-daily-date', JSON.stringify(dailyDate));
    localStorage.setItem('sudoku-daily-progress', JSON.stringify(dailyProgress));
  }, [board, mistakes, time, score, combo, history, gameStatus, notesMode, difficulty, isPaused, settings, stats, theme, dailyDate, dailyProgress]);

  useEffect(() => {
    let interval = null;
    // Only tick timer if we are explicitly IN the game view and unpaused
    if (gameStatus === 'playing' && !isPaused && activeTab === 'game') {
      interval = setInterval(() => setTime((prev) => prev + 1), 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [gameStatus, isPaused, activeTab]);

  useEffect(() => {
    if (board.length === 0 || gameStatus !== 'playing') return;
    if (settings.mistakeLimit && mistakes >= 3) {
      setGameStatus('lost');
      triggerVibration([100, 100, 100, 100, 300]); 
      
      setStats(prev => {
        const next = JSON.parse(JSON.stringify(prev)); 
        next.currentStreak[difficulty] = 0;
        return next;
      });
    } else {
      const isComplete = board.every(cell => cell.value !== null && cell.value === cell.solution);
      if (isComplete) {
        setGameStatus('won');
        triggerVibration([50, 50, 50, 50, 50]); 
        triggerConfetti();
        
        setStats(prev => {
          const next = JSON.parse(JSON.stringify(prev));
          next.gamesWon[difficulty]++;
          next.totalTime[difficulty] += time;
          if (next.bestTime[difficulty] === null || time < next.bestTime[difficulty]) next.bestTime[difficulty] = time;
          if (next.bestScore[difficulty] === undefined) next.bestScore[difficulty] = 0;
          if (score > next.bestScore[difficulty]) next.bestScore[difficulty] = score;
          next.currentStreak[difficulty]++;
          if (next.currentStreak[difficulty] > next.bestStreak[difficulty]) next.bestStreak[difficulty] = next.currentStreak[difficulty];
          return next;
        });

        if (dailyDate) {
          setDailyProgress(prev => ({
            ...prev,
            [dailyDate]: { won: true, score: score, time: time }
          }));
        }
      }
    }
  }, [board, mistakes, gameStatus, settings.mistakeLimit, time, score]); 

  // --- HELPER FUNCTIONS ---
  const triggerConfetti = () => {
    const duration = 3000;
    const end = Date.now() + duration;
    const frame = () => {
      confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#2563eb', '#60a5fa', '#3b82f6'] });
      confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#2563eb', '#60a5fa', '#3b82f6'] });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  };

  const getNumberCounts = () => {
    const counts = Array(10).fill(0);
    board.forEach(cell => { if (cell.value && !cell.isError) counts[cell.value]++; });
    return counts;
  };
  const numberCounts = getNumberCounts();

  useEffect(() => {
    if (lockedNumber !== null && numberCounts[lockedNumber] >= 9) setLockedNumber(null);
  }, [numberCounts, lockedNumber]);

  const startNewGame = (selectedDifficulty, dateStr = null) => {
    const blanks = DIFFICULTIES[selectedDifficulty] || 45; // Default to Medium if undefined
    setBoard(generateSudoku(blanks, dateStr));
    setDifficulty(dateStr ? 'Daily' : selectedDifficulty);
    setDailyDate(dateStr);
    setMistakes(0);
    setTime(0);
    setScore(0);
    setCombo(1);
    setHistory([]);
    setSelectedCell(null);
    setLockedNumber(null);
    setIsPaused(false);
    setAnimatingCells([]);
    setGameStatus('playing');
    setShowDifficultySheet(false);
    setActiveTab('game'); // Switch to game view immediately

    setStats(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const key = dateStr ? 'Daily' : selectedDifficulty;
      if (next.gamesStarted[key] === undefined) next.gamesStarted[key] = 0;
      next.gamesStarted[key]++;
      return next;
    });
  };

  const restartCurrentGame = () => {
    // Reset board to initial generated state
    setBoard(prev => prev.map(cell => ({ ...cell, value: cell.isGiven ? cell.solution : null, isError: false, notes: [] })));
    setMistakes(0);
    setTime(0);
    setScore(0);
    setCombo(1);
    setHistory([]);
    setSelectedCell(null);
    setLockedNumber(null);
    setIsPaused(false);
    setGameStatus('playing');
  };

  const formatTime = (seconds) => {
    if (seconds === null) return "--:--";
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const isPeer = (cell1, cell2) => {
    if (!cell1 || !cell2) return false;
    return cell1.row === cell2.row || cell1.col === cell2.col || cell1.box === cell2.box;
  };

  const saveHistory = (currentBoard) => { setHistory((prev) => [...prev, currentBoard]); };

  const handleUndo = () => {
    if (history.length === 0 || gameStatus !== 'playing' || isPaused) return;
    const previousBoard = history[history.length - 1];
    setBoard(previousBoard);
    setHistory((prev) => prev.slice(0, -1));
    setCombo(1); 
    triggerVibration(15); 
  };

  const handleErase = () => {
    if (selectedCell === null || gameStatus !== 'playing' || isPaused) return;
    const cell = board[selectedCell];
    if (cell.isGiven || (cell.value === cell.solution && !cell.isError)) return;
    saveHistory(board);
    setBoard((prevBoard) => {
      const newBoard = [...prevBoard];
      newBoard[selectedCell] = { ...cell, value: null, isError: false, notes: [] };
      return newBoard;
    });
    triggerVibration(15); 
  };

  // SMART HINT ALGORITHM
  const findSmartHint = (currentBoard) => {
    for (let cell of currentBoard) {
      if (cell.value === null) {
        let possibleNumbers = [];
        for (let num = 1; num <= 9; num++) {
          const conflict = currentBoard.some(c => c.value === num && isPeer(c, cell));
          if (!conflict) possibleNumbers.push(num);
        }
        if (possibleNumbers.length === 1) {
          return { index: cell.index, value: possibleNumbers[0] };
        }
      }
    }
    return null;
  };

  const handleHint = () => {
    if (gameStatus !== 'playing' || isPaused) return;
    
    saveHistory(board);
    setScore(s => Math.max(0, s - 100));
    setCombo(1);

    setBoard((prevBoard) => {
      const newBoard = [...prevBoard];
      
      let hint = findSmartHint(newBoard);
      
      if (!hint) {
        const emptyCells = newBoard.filter(c => c.value === null);
        if (emptyCells.length === 0) return prevBoard;
        const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        hint = { index: randomCell.index, value: randomCell.solution };
      }

      const targetCell = newBoard[hint.index];
      newBoard[hint.index] = { ...targetCell, value: hint.value, isError: false, notes: [] };
      
      const clearedBoard = clearNotesFromPeers(newBoard, hint.index, hint.value);
      checkForCompletionAnimations(clearedBoard, newBoard[hint.index]);
      
      setSelectedCell(hint.index); // Auto-select the hinted cell so user sees it
      return clearedBoard;
    });
    triggerVibration(25);
  };

  const clearNotesFromPeers = (currentBoard, targetCellIndex, placedNumber) => {
    const targetCell = currentBoard[targetCellIndex];
    return currentBoard.map(cell => {
      if (cell.index !== targetCellIndex && isPeer(cell, targetCell) && cell.notes.includes(placedNumber)) {
        return { ...cell, notes: cell.notes.filter(n => n !== placedNumber) };
      }
      return cell;
    });
  };

  const checkForCompletionAnimations = (currentBoard, targetCell) => {
    const isRowComplete = currentBoard.filter(c => c.row === targetCell.row && c.value === c.solution).length === 9;
    const isColComplete = currentBoard.filter(c => c.col === targetCell.col && c.value === c.solution).length === 9;
    const isBoxComplete = currentBoard.filter(c => c.box === targetCell.box && c.value === c.solution).length === 9;

    const cellsToFlash = [];
    if (isRowComplete) cellsToFlash.push(...currentBoard.filter(c => c.row === targetCell.row).map(c => c.index));
    if (isColComplete) cellsToFlash.push(...currentBoard.filter(c => c.col === targetCell.col).map(c => c.index));
    if (isBoxComplete) cellsToFlash.push(...currentBoard.filter(c => c.box === targetCell.box).map(c => c.index));

    if (cellsToFlash.length > 0) setTimeout(() => setAnimatingCells([...new Set(cellsToFlash)]), 0);
  };

  const handleNumberInput = (num, targetIndex) => {
    if (targetIndex === null || gameStatus !== 'playing' || isPaused) return;
    const cell = board[targetIndex];
    if (cell.isGiven || (cell.value === cell.solution && !cell.isError)) return;

    saveHistory(board);
    setBoard((prevBoard) => {
      const newBoard = [...prevBoard];
      if (notesMode) {
        const currentNotes = cell.notes || [];
        const hasNote = currentNotes.includes(num);
        const newNotes = hasNote ? currentNotes.filter(n => n !== num) : [...currentNotes, num];
        newBoard[targetIndex] = { ...cell, value: null, isError: false, notes: newNotes };
        triggerVibration(10);
        return newBoard;
      } else {
        const isWrong = num !== cell.solution;
        const shouldFlagError = isWrong && settings.autoCheck;

        if (shouldFlagError) {
          setMistakes((prev) => prev + 1);
          setScore(s => Math.max(0, s - 50)); 
          setCombo(1); 
          triggerVibration([50, 100, 50]); 
        } else if (!isWrong) {
          setScore(s => s + (50 * combo)); 
          setCombo(c => c + 1); 
          triggerVibration(15); 
        }

        newBoard[targetIndex] = { ...cell, value: num, isError: shouldFlagError, notes: [] };
        
        if (!isWrong) {
          const clearedBoard = clearNotesFromPeers(newBoard, targetIndex, num);
          checkForCompletionAnimations(clearedBoard, newBoard[targetIndex]);
          return clearedBoard;
        }
        return newBoard;
      }
    });
  };

  const handleCellClick = (index) => {
    if (isPaused || gameStatus !== 'playing') return;
    if (lockedNumber !== null) handleNumberInput(lockedNumber, index);
    else {
      setSelectedCell(index === selectedCell ? null : index);
      triggerVibration(5); 
    }
  };

  const handleNumberPadClick = (num) => {
    if (isPaused || gameStatus !== 'playing') return;
    if (selectedCell !== null) handleNumberInput(num, selectedCell);
    else {
      setLockedNumber(prev => prev === num ? null : num);
      triggerVibration(10);
    }
  };

  const toggleSetting = (key) => setSettings(prev => ({ ...prev, [key]: !prev[key] }));

  const getCellBorders = (row, col) => {
    let classes = "border border-[var(--border-thin)] "; 
    if (row === 2 || row === 5) classes += "border-b-[var(--border-thick)] border-b-2 ";
    if (col === 2 || col === 5) classes += "border-r-[var(--border-thick)] border-r-2 ";
    if (row === 0) classes += "border-t-[var(--border-thick)] border-t-2 ";
    if (row === 8) classes += "border-b-[var(--border-thick)] border-b-2 ";
    if (col === 0) classes += "border-l-[var(--border-thick)] border-l-2 ";
    if (col === 8) classes += "border-r-[var(--border-thick)] border-r-2 ";
    return classes;
  };

  const activeCell = selectedCell !== null ? board[selectedCell] : null;
  const highlightValue = lockedNumber !== null ? lockedNumber : (activeCell ? activeCell.value : null);
  const controlsDisabled = gameStatus !== 'playing' || isPaused;
  const themeClass = theme === 'dark' ? 'theme-dark' : theme === 'sepia' ? 'theme-sepia' : '';

  // --- RENDER HELPERS FOR EACH TAB ---

  const renderMainTab = () => (
    <div className="flex flex-col items-center w-full max-w-md h-full px-4 pt-12 pb-24 relative">
      <h1 className="text-2xl font-extrabold text-[#0b5394] mb-8 tracking-wide">Alandoku</h1>
      
      {/* Daily Challenge Card matches screenshot */}
      <div className="w-full flex gap-4 mb-10">
        <button onClick={() => setActiveTab('daily')} className="flex-1 aspect-square bg-blue-500 rounded-xl shadow-md flex flex-col items-center justify-center text-white p-4 transition-transform active:scale-95">
          <div className="text-4xl mb-2">📅</div>
          <div className="text-[10px] uppercase font-bold opacity-80 mb-1 tracking-wider">Daily Challenge</div>
          <div className="text-sm font-semibold">{monthName} {today.getDate()}</div>
        </button>
        <button className="flex-1 aspect-square bg-green-500 rounded-xl shadow-md flex flex-col items-center justify-center text-white p-4 opacity-80 cursor-not-allowed">
          <div className="text-4xl mb-2">🌿</div>
          <div className="text-[10px] uppercase font-bold opacity-80 mb-1 tracking-wider">Event</div>
          <div className="text-sm font-semibold">Coming Soon</div>
        </button>
      </div>

      {/* All Time Best Score matches screenshot */}
      <div className="text-center mb-auto mt-4">
        <div className="text-sm text-[var(--text-muted)] font-semibold mb-1">All-Time Best Score</div>
        <div className="text-3xl font-extrabold text-[var(--text-main)] flex items-center justify-center gap-2">
          <span className="text-[#f59e0b]">🏆</span> {allTimeBestScore.toLocaleString()}
        </div>
      </div>

      {/* Continue or New Game Button */}
      <div className="w-full flex flex-col gap-3 mt-12">
        {(gameStatus === 'playing' || gameStatus === 'paused') && board.length > 0 && (
          <button onClick={() => setActiveTab('game')} className="w-full bg-[var(--text-user)] text-[var(--bg-board)] font-bold text-lg py-4 rounded-full shadow-lg active:scale-95 transition-transform">
            Continue Game
          </button>
        )}
        <button onClick={() => setShowDifficultySheet(true)} className={`w-full font-bold text-lg py-4 rounded-full shadow-md active:scale-95 transition-transform ${gameStatus === 'playing' ? 'bg-[var(--btn-active)] text-[var(--text-main)]' : 'bg-[var(--text-user)] text-[var(--bg-board)] shadow-lg'}`}>
          New Game
        </button>
      </div>
    </div>
  );

  const renderDailyTab = () => (
    <div className="flex flex-col items-center w-full max-w-md h-full pb-24 overflow-y-auto">
      {/* Blue header matches screenshot */}
      <div className="w-full bg-gradient-to-b from-blue-500 to-blue-600 text-white flex flex-col items-center pt-10 pb-8 rounded-b-3xl shadow-md">
        <h2 className="text-lg font-bold mb-4">Daily Challenges</h2>
        <div className="text-7xl">🏆</div>
      </div>

      <div className="w-full px-6 pt-6 flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-[var(--text-main)]">{monthName} {currentYear}</h3>
        <div className="text-sm font-bold text-[#f59e0b]">⭐ {Object.keys(dailyProgress).length}/{daysInMonth}</div>
      </div>
      
      <div className="w-full px-6 grid grid-cols-7 gap-y-4 gap-x-2 mb-8">
        {['S','M','T','W','T','F','S'].map((d, i) => (
          <div key={i} className="text-center text-xs font-bold text-[var(--text-muted)]">{d}</div>
        ))}
        
        {/* Padding for first day */}
        {[...Array(new Date(currentYear, currentMonth, 1).getDay())].map((_, i) => (
          <div key={`empty-${i}`}></div>
        ))}

        {[...Array(daysInMonth)].map((_, i) => {
          const day = i + 1;
          const dateStr = `${currentYear}-${currentMonth + 1}-${day}`;
          const isCompleted = dailyProgress[dateStr]?.won;
          const isToday = day === today.getDate();
          const isFuture = day > today.getDate();
          
          return (
            <button 
              key={day}
              disabled={isFuture}
              onClick={() => startNewGame('Medium', dateStr)}
              className={`
                aspect-square rounded-full flex items-center justify-center text-sm font-semibold transition-all relative
                ${isFuture ? 'opacity-30 cursor-not-allowed' : 'active:scale-90 hover:opacity-80'}
                ${isCompleted ? 'bg-[var(--text-user)] text-[var(--bg-app)] shadow-sm' : 'bg-[var(--btn-active)] text-[var(--text-main)]'}
                ${isToday && !isCompleted ? 'border-2 border-[var(--text-user)] bg-[var(--text-user)] text-[var(--bg-app)]' : ''}
              `}
            >
              {isCompleted ? '⭐' : day}
            </button>
          )
        })}
      </div>
    </div>
  );

  const renderMeTab = () => {
    // If a subview is active (Stats or Settings), render that instead of the list
    if (meSubView === 'stats') {
      return (
        <div className="flex flex-col items-center w-full max-w-md h-full px-6 pt-10 pb-24 overflow-y-auto">
          <div className="w-full flex items-center mb-6">
            <button onClick={() => setMeSubView(null)} className="text-[var(--text-user)] text-2xl font-bold pr-4">‹</button>
            <h2 className="text-xl font-bold text-[var(--text-main)] mx-auto pr-8">Statistics</h2>
          </div>
          
          <div className="flex flex-wrap gap-2 mb-8 justify-center">
            {[...Object.keys(DIFFICULTIES), 'Daily'].map((level) => (
              <button key={level} onClick={() => setStatsTab(level)} className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${statsTab === level ? 'bg-[var(--text-user)] text-[var(--bg-board)] shadow-md' : 'bg-[var(--btn-active)] text-[var(--text-main)] hover:opacity-80'}`}>
                {level}
              </button>
            ))}
          </div>
          
          <div className="w-full grid grid-cols-2 gap-y-8 gap-x-4">
            <div><div className="text-3xl font-bold">{stats.gamesStarted[statsTab] || 0}</div><div className="text-xs text-[var(--text-muted)] uppercase font-semibold mt-1 tracking-wide">Games Started</div></div>
            <div><div className="text-3xl font-bold">{stats.gamesWon[statsTab] || 0}</div><div className="text-xs text-[var(--text-muted)] uppercase font-semibold mt-1 tracking-wide">Games Won</div></div>
            <div><div className="text-3xl font-bold">{stats.gamesStarted[statsTab] > 0 ? Math.round(((stats.gamesWon[statsTab] || 0) / stats.gamesStarted[statsTab]) * 100) : 0}%</div><div className="text-xs text-[var(--text-muted)] uppercase font-semibold mt-1 tracking-wide">Win Rate</div></div>
            <div><div className="text-3xl font-bold">{stats.gamesWon[statsTab] > 0 ? formatTime(Math.floor(stats.totalTime[statsTab] / stats.gamesWon[statsTab])) : "--:--"}</div><div className="text-xs text-[var(--text-muted)] uppercase font-semibold mt-1 tracking-wide">Avg Time</div></div>
            <div><div className="text-3xl font-bold text-[var(--text-user)]">{formatTime(stats.bestTime[statsTab])}</div><div className="text-xs text-[var(--text-muted)] uppercase font-semibold mt-1 tracking-wide">Best Time</div></div>
            <div><div className="text-3xl font-bold text-[var(--text-user)]">{stats.bestScore ? stats.bestScore[statsTab] || 0 : 0}</div><div className="text-xs text-[var(--text-muted)] uppercase font-semibold mt-1 tracking-wide">Best Score</div></div>
            <div><div className="text-3xl font-bold text-[var(--text-user)]">{stats.currentStreak[statsTab] || 0} <span className="text-lg font-normal opacity-60">/ {stats.bestStreak[statsTab] || 0}</span></div><div className="text-xs text-[var(--text-muted)] uppercase font-semibold mt-1 tracking-wide">Streak (Cur/Best)</div></div>
          </div>
        </div>
      );
    }

    if (meSubView === 'settings') {
      return (
        <div className="flex flex-col items-center w-full max-w-md h-full px-6 pt-10 pb-24 overflow-y-auto">
          <div className="w-full flex items-center mb-6">
            <button onClick={() => setMeSubView(null)} className="text-[var(--text-user)] text-2xl font-bold pr-4">‹</button>
            <h2 className="text-xl font-bold text-[var(--text-main)] mx-auto pr-8">Settings</h2>
          </div>
          
          <div className="w-full flex flex-col gap-2">
            <div className="bg-[var(--bg-board)] rounded-xl shadow-sm border border-[var(--border-thin)] p-4 flex justify-between items-center">
              <span className="font-medium">Theme</span>
              <div className="flex gap-3">
                <button onClick={() => setTheme('light')} className={`w-8 h-8 rounded-full border-2 bg-[#f9fafb] ${theme === 'light' ? 'border-blue-500 scale-110 shadow-md' : 'border-gray-300'}`}></button>
                <button onClick={() => setTheme('dark')} className={`w-8 h-8 rounded-full border-2 bg-[#111827] ${theme === 'dark' ? 'border-blue-500 scale-110 shadow-md' : 'border-gray-700'}`}></button>
                <button onClick={() => setTheme('sepia')} className={`w-8 h-8 rounded-full border-2 bg-[#f4ecd8] ${theme === 'sepia' ? 'border-blue-500 scale-110 shadow-md' : 'border-[#d9c8a3]'}`}></button>
              </div>
            </div>

            <div className="bg-[var(--bg-board)] rounded-xl shadow-sm border border-[var(--border-thin)] p-4 flex justify-between items-center mt-4">
              <div><span className="block font-medium">Auto-Check Errors</span><span className="text-xs text-[var(--text-muted)]">Instantly highlight wrong numbers</span></div>
              <button onClick={() => toggleSetting('autoCheck')} className={`w-12 h-6 rounded-full flex items-center transition-colors px-1 ${settings.autoCheck ? 'bg-[var(--text-user)]' : 'bg-gray-400'}`}>
                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${settings.autoCheck ? 'translate-x-6' : ''}`}></div>
              </button>
            </div>

            <div className="bg-[var(--bg-board)] rounded-xl shadow-sm border border-[var(--border-thin)] p-4 flex justify-between items-center mt-2">
              <div><span className="block font-medium">Mistake Limit</span><span className="text-xs text-[var(--text-muted)]">Game over after 3 mistakes</span></div>
              <button onClick={() => toggleSetting('mistakeLimit')} className={`w-12 h-6 rounded-full flex items-center transition-colors px-1 ${settings.mistakeLimit ? 'bg-[var(--text-user)]' : 'bg-gray-400'}`}>
                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform ${settings.mistakeLimit ? 'translate-x-6' : ''}`}></div>
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Default 'Me' List matches screenshot
    return (
      <div className="flex flex-col items-center w-full max-w-md h-full px-4 pt-10 pb-24 overflow-y-auto">
        <h2 className="text-xl font-bold text-[var(--text-main)] mb-6">Me</h2>
        
        <div className="w-full flex flex-col gap-3">
          <div className="bg-[var(--bg-board)] rounded-xl shadow-sm border border-[var(--border-thin)] overflow-hidden">
            <button onClick={() => setMeSubView('stats')} className="w-full flex items-center justify-between p-4 active:bg-[var(--bg-selected)] transition-colors border-b border-[var(--border-thin)]">
              <div className="flex items-center gap-3"><div className="text-2xl">📊</div><span className="font-semibold text-[var(--text-main)] text-lg">Statistics</span></div>
              <span className="text-[var(--text-muted)] text-xl">›</span>
            </button>
            <button onClick={() => setMeSubView('settings')} className="w-full flex items-center justify-between p-4 active:bg-[var(--bg-selected)] transition-colors">
              <div className="flex items-center gap-3"><div className="text-2xl">⚙️</div><span className="font-semibold text-[var(--text-main)] text-lg">Settings</span></div>
              <span className="text-[var(--text-muted)] text-xl">›</span>
            </button>
          </div>
          
          <div className="bg-[var(--bg-board)] rounded-xl shadow-sm border border-[var(--border-thin)] overflow-hidden mt-4">
            <button className="w-full flex items-center justify-between p-4 active:bg-[var(--bg-selected)] transition-colors border-b border-[var(--border-thin)]">
              <div className="flex items-center gap-3"><div className="text-2xl">🎓</div><span className="font-semibold text-[var(--text-main)] text-lg">How to Play</span></div>
              <span className="text-[var(--text-muted)] text-xl">›</span>
            </button>
            <button className="w-full flex items-center justify-between p-4 active:bg-[var(--bg-selected)] transition-colors">
              <div className="flex items-center gap-3"><div className="text-2xl">📖</div><span className="font-semibold text-[var(--text-main)] text-lg">Rules</span></div>
              <span className="text-[var(--text-muted)] text-xl">›</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderGame = () => (
    <div className="w-full max-w-md h-full flex flex-col items-center pt-2 pb-6 relative">
      
      {/* Top Header matching screenshot */}
      <div className="w-full flex justify-between items-center px-4 mb-3">
        <button onClick={() => { setActiveTab('main'); setIsPaused(true); }} className="text-[var(--text-user)] text-3xl font-bold w-10 active:scale-90">‹</button>
        <div className="text-lg font-bold text-[var(--text-main)] tracking-widest">{formatTime(time)}</div>
        <div className="flex items-center gap-4 w-auto">
          <button onClick={restartCurrentGame} className="text-xl text-[var(--text-user)] font-bold active:scale-90">↺</button>
          <button onClick={() => setIsPaused(!isPaused)} disabled={gameStatus !== 'playing'} className="text-[var(--text-user)] text-xl active:scale-90">{isPaused ? '▶️' : '⏸'}</button>
          <button onClick={() => { setActiveTab('me'); setMeSubView('settings'); setIsPaused(true); }} className="text-xl text-[var(--text-user)] active:scale-90">⚙️</button>
        </div>
      </div>

      {/* Sub Header matching screenshot */}
      <div className="w-full flex justify-between px-4 mb-4 text-[10px] sm:text-xs text-[var(--text-muted)] uppercase font-semibold">
        <div className="text-center">All Time<br/><span className="text-[var(--text-main)] font-bold text-xs sm:text-sm lowercase tracking-tight">🏆 {allTimeBestScore.toLocaleString()}</span></div>
        <div className="text-center">Difficulty<br/><span className="text-[var(--text-main)] font-bold text-xs sm:text-sm capitalize">{difficulty}</span></div>
        <div className="text-center">Score<br/><span className="text-[var(--text-main)] font-bold text-xs sm:text-sm">{score}</span></div>
        <div className="text-center transition-opacity" style={{ opacity: settings.mistakeLimit ? 1 : 0 }}>
          Mistakes<br/><span className={`font-bold text-xs sm:text-sm ${mistakes >= 3 ? "text-[var(--text-error)]" : "text-[var(--text-main)]"}`}>{mistakes}/3</span>
        </div>
      </div>

      {/* Game Over / Paused Overlays */}
      <div className="w-full relative px-1 sm:px-4 mb-4">
        
        {isPaused && gameStatus === 'playing' && (
          <div className="absolute inset-0 z-20 mx-4 bg-[var(--bg-app)] flex flex-col items-center justify-center p-6 text-center border-2 border-[var(--border-thin)] shadow-sm">
            <div className="text-6xl mb-4">⏸</div>
            <h2 className="text-3xl font-bold mb-6">Paused</h2>
            <button onClick={() => setIsPaused(false)} className="bg-[var(--text-user)] text-[var(--bg-board)] font-bold py-3 px-10 rounded-full shadow-lg active:scale-95 transition-transform">Resume</button>
          </div>
        )}

        {gameStatus !== 'playing' && (
          <div className="absolute inset-0 z-10 mx-4 bg-[var(--modal-bg)] backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center border border-[var(--border-thin)] shadow-lg">
            <h2 className={`text-4xl font-bold mb-2 ${gameStatus === 'won' ? 'text-[var(--text-user)]' : 'text-[var(--text-error)]'}`}>{gameStatus === 'won' ? 'Excellent!' : 'Game Over'}</h2>
            <p className="text-[var(--text-muted)] mb-2 font-medium">{gameStatus === 'won' ? `You solved it in ${formatTime(time)}` : 'You made 3 mistakes.'}</p>
            <p className="text-xl font-bold text-[var(--text-user)] mb-6">Final Score: {score}</p>
            <button onClick={() => { setActiveTab('main'); }} className="bg-[var(--text-user)] text-[var(--bg-board)] font-bold py-3 px-8 rounded-full shadow-lg active:scale-95 transition-transform">Done</button>
          </div>
        )}

        {/* Grid */}
        <div className="aspect-square grid grid-cols-9 bg-[var(--border-thin)] gap-px p-px mx-auto w-full border-2 border-[var(--border-thick)]">
          {board.map((cell) => {
            const isSelected = selectedCell === cell.index;
            const isHighlightedPeer = !isSelected && activeCell && isPeer(cell, activeCell);
            const isSameValue = !isSelected && highlightValue !== null && cell.value === highlightValue;
            const isAnimating = animatingCells.includes(cell.index);

            let bgClass = "bg-[var(--bg-cell)]";
            if (isSelected) bgClass = "bg-[var(--bg-selected)]";
            else if (isSameValue) bgClass = "bg-[var(--bg-same)]";
            else if (isHighlightedPeer) bgClass = "bg-[var(--bg-peer)]";

            let textClass = "text-[var(--text-user)] font-medium";
            if (cell.isGiven) textClass = "text-[var(--text-given)] font-bold";
            if (cell.isError) textClass = "text-[var(--text-error)] font-medium";

            // Determine if we need to draw thick grid lines
            const isRightBorder = cell.col === 2 || cell.col === 5;
            const isBottomBorder = cell.row === 2 || cell.row === 5;
            
            return (
              <div 
                key={cell.index} 
                onClick={() => handleCellClick(cell.index)} 
                className={`
                  flex items-center justify-center text-3xl sm:text-4xl cursor-pointer transition-colors duration-200 relative
                  ${bgClass} ${textClass}
                  ${isRightBorder ? 'border-r-2 border-r-[var(--border-thick)]' : ''}
                  ${isBottomBorder ? 'border-b-2 border-b-[var(--border-thick)]' : ''}
                `}
              >
                <div className={`absolute inset-0 bg-[var(--text-main)] pointer-events-none transition-opacity duration-500 ease-out ${isAnimating ? 'opacity-20' : 'opacity-0'}`}></div>
                {cell.value && <span className="relative z-10">{cell.value}</span>}
                {!cell.value && cell.notes && cell.notes.length > 0 && (
                  <div className="relative z-10 grid grid-cols-3 grid-rows-3 w-full h-full text-[10px] sm:text-[11px] text-[var(--text-notes)] p-[1px] pointer-events-none">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                      <div key={n} className="flex items-center justify-center leading-none">{cell.notes.includes(n) ? n : ''}</div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Bar matching screenshot */}
      <div className="w-full px-6 flex justify-between mb-6">
        <button onClick={handleUndo} disabled={history.length === 0 || controlsDisabled} className={`flex flex-col items-center gap-1 ${history.length === 0 || controlsDisabled ? 'opacity-40' : 'active:scale-95'}`}>
          <div className="text-2xl text-[var(--text-user)] mb-1">↺</div>
          <span className="text-xs font-semibold text-[var(--text-muted)]">Undo</span>
        </button>
        <button onClick={handleErase} disabled={controlsDisabled} className={`flex flex-col items-center gap-1 ${controlsDisabled ? 'opacity-40' : 'active:scale-95'}`}>
          <div className="text-2xl text-[var(--text-user)] mb-1">⌫</div>
          <span className="text-xs font-semibold text-[var(--text-muted)]">Erase</span>
        </button>
        <button onClick={() => setNotesMode(!notesMode)} disabled={controlsDisabled} className={`flex flex-col items-center gap-1 ${controlsDisabled ? 'opacity-40' : 'active:scale-95'} relative`}>
          <div className="text-2xl text-[var(--text-user)] mb-1 relative">
            ✎
            <div className={`absolute -top-1 -right-2 text-[8px] font-bold px-1 rounded-sm text-white ${notesMode ? 'bg-[var(--text-user)]' : 'bg-gray-400'}`}>{notesMode ? 'ON' : 'OFF'}</div>
          </div>
          <span className="text-xs font-semibold text-[var(--text-muted)]">Notes</span>
        </button>
        <button onClick={handleHint} disabled={controlsDisabled} className={`flex flex-col items-center gap-1 ${controlsDisabled ? 'opacity-40' : 'active:scale-95'}`}>
          <div className="text-2xl text-[var(--text-user)] mb-1 relative">
            💡
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-[var(--text-user)] text-white text-[8px] font-bold rounded-full flex items-center justify-center">∞</div>
          </div>
          <span className="text-xs font-semibold text-[var(--text-muted)]">Hint</span>
        </button>
      </div>

      {/* Number Pad matching screenshot */}
      <div className="w-full flex justify-between px-4">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
          const isLocked = lockedNumber === num;
          return (
            <button key={num} onClick={() => handleNumberPadClick(num)} disabled={controlsDisabled} className={`text-3xl sm:text-4xl font-normal transition-all duration-200 w-full text-center ${controlsDisabled ? 'opacity-50' : ''} ${numberCounts[num] >= 9 ? 'opacity-0 pointer-events-none' : ''} ${isLocked ? 'text-[var(--text-user)] font-bold scale-125' : 'text-[var(--text-user)] active:scale-90 hover:opacity-70'}`}>
              {num}
            </button>
          )
        })}
      </div>
    </div>
  );

  return (
    <div className={`h-screen w-screen bg-[var(--bg-app)] text-[var(--text-main)] flex justify-center font-sans select-none overflow-hidden transition-colors duration-300 ${themeClass}`}>
      
      {/* Render the Active View */}
      {activeTab === 'main' && renderMainTab()}
      {activeTab === 'daily' && renderDailyTab()}
      {activeTab === 'me' && renderMeTab()}
      {activeTab === 'game' && renderGame()}

      {/* BOTTOM NAVIGATION TABS - Hidden during gameplay */}
      {activeTab !== 'game' && (
        <div className="absolute bottom-0 w-full max-w-md bg-[var(--bg-board)] border-t border-[var(--border-thin)] flex justify-around items-center pb-8 pt-3 z-40">
          <button onClick={() => { setActiveTab('main'); setMeSubView(null); }} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'main' ? 'text-[var(--text-user)]' : 'text-[var(--text-muted)] hover:opacity-80'}`}>
            <div className="text-2xl">🏠</div>
            <span className="text-[10px] font-bold">Main</span>
          </button>
          <button onClick={() => { setActiveTab('daily'); setMeSubView(null); }} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'daily' ? 'text-[var(--text-user)]' : 'text-[var(--text-muted)] hover:opacity-80'}`}>
            <div className="text-2xl">📅</div>
            <span className="text-[10px] font-bold">Daily Challenges</span>
          </button>
          <button onClick={() => setActiveTab('me')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'me' ? 'text-[var(--text-user)]' : 'text-[var(--text-muted)] hover:opacity-80'}`}>
            <div className="text-2xl">👤</div>
            <span className="text-[10px] font-bold">Me</span>
          </button>
        </div>
      )}

      {/* iOS-Style Difficulty Bottom Sheet matches screenshot */}
      {showDifficultySheet && activeTab === 'main' && (
        <>
          {/* Dark backdrop */}
          <div className="absolute inset-0 bg-black/40 z-50 transition-opacity" onClick={() => setShowDifficultySheet(false)}></div>
          
          {/* Action Sheet */}
          <div className="absolute bottom-0 w-full max-w-md bg-[var(--bg-board)] rounded-t-3xl shadow-2xl z-50 flex flex-col pb-10 pt-4 animate-[slideUp_0.3s_ease-out]">
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-4"></div>
            {Object.keys(DIFFICULTIES).map((level, index, arr) => (
              <div key={level} className="w-full">
                <button 
                  onClick={() => startNewGame(level)} 
                  className="w-full py-4 text-xl font-normal text-[var(--text-user)] hover:bg-[var(--bg-selected)] transition-colors"
                >
                  {level}
                </button>
                {index < arr.length - 1 && <div className="w-[90%] mx-auto h-px bg-[var(--border-thin)]"></div>}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Standard CSS keyframes for the bottom sheet slide up animation */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}} />
    </div>
  );
}

export default App;