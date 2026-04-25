import { db, auth } from "./firebase-config.js";

import {
  collection,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  increment
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

const GAME_TIME = 200;
const GRID_SIZE = 5;
const TILE_COUNT = 24;

let board = [];
let blankIndex = 24;
let score = 0;
let timeLeft = GAME_TIME;
let timerInterval = null;
let gameEnded = false;
let frozen = false;

let usedWords = new Set();
let foundWords = [];
let frozenRoundMultiplier = 2;
let selectedPath = [];
let isDragging = false;
let currentDirection = null;

let awardedChainBonuses = new Set();

// DOM
const boardEl = document.getElementById("board");
const scoreEl = document.getElementById("score");
const timerEl = document.getElementById("timer");
const freezeBtn = document.getElementById("freezeBtn");
const messageEl = document.getElementById("message");
const endScreenEl = document.getElementById("endScreen");
const endMessageEl = document.getElementById("endMessage");
const playAgainBtn = document.getElementById("playAgainBtn");
const homeBtn = document.getElementById("homeBtn");
const comboPopup = document.getElementById("comboPopup");
const submitScoreBtn = document.getElementById("submitScoreBtn");

function getTodayId() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

// Dictionary
function getDictionarySet() {
  if (typeof getDictionaryArray === "function" && getDictionaryArray().length > 0) {
    return new Set(getDictionaryArray().map(word => word.toUpperCase()));
  }

  return new Set([
    "END","LEND","BLEND",
    "INK","LINK","BLINK",
    "AIR","HAIR","CHAIR",
    "ICE","LICE","SLICE",
    "ATE","LATE","PLATE",
    "ILL","HILL","CHILL",
    "AND","BAND","BLAND",
    "ROW","BROW","BROWN"
  ]);
}

let DICTIONARY = getDictionarySet();

function getLetterCounts(word) {
  const counts = {};
  for (const ch of word) {
    counts[ch] = (counts[ch] || 0) + 1;
  }
  return counts;
}

function checkChainBonus(foundWords) {
  const foundSet = new Set(foundWords.map(w => w.toUpperCase()));
  let bonus = 0;

  for (const w5 of foundSet) {
    if (w5.length !== 5) continue;

    const fourLetterSlices = [w5.slice(0, 4), w5.slice(1, 5)];
    const threeLetterSlices = [w5.slice(0, 3), w5.slice(1, 4), w5.slice(2, 5)];

    for (const w4 of fourLetterSlices) {
      if (!foundSet.has(w4)) continue;

      for (const w3 of threeLetterSlices) {
        if (!foundSet.has(w3)) continue;

        const chainKey = `${w3}|${w4}|${w5}`;

        if (!awardedChainBonuses.has(chainKey)) {
          awardedChainBonuses.add(chainKey);
          bonus += 5;
        }
      }
    }
  }

  return bonus;
}

// Chains
const CHAIN_FAMILIES = [
  { w3: "END", w4: "LEND", w5: "BLEND" },
  { w3: "INK", w4: "LINK", w5: "BLINK" },
  { w3: "AIR", w4: "HAIR", w5: "CHAIR" },
  { w3: "ICE", w4: "MICE", w5: "SLICE" },
  { w3: "ATE", w4: "LATE", w5: "PLATE" },
  { w3: "WEE", w4: "WEED", w5: "TWEED" },
  { w3: "HAT", w4: "CHAT", w5: "CHATS" },
  { w3: "ICE", w4: "DICE", w5: "DICED" },
  { w3: "ATE", w4: "MATE", w5: "MATES" },
  { w3: "ARE", w4: "AREA", w5: "AREAS" },
  { w3: "CAR", w4: "CARD", w5: "CARDS" },
  { w3: "BAR", w4: "BARE", w5: "BARED" },
  { w3: "TEN", w4: "TEND", w5: "TENDS" },
  { w3: "EAR", w4: "EARN", w5: "YEARN" },
  { w3: "ALL", w4: "BALL", w5: "BALLS" },
  { w3: "ASH", w4: "WASH", w5: "WASHY" },
  { w3: "OWN", w4: "DOWN", w5: "DROWN" },
  { w3: "LAY", w4: "PLAY", w5: "PLAYS" },
  { w3: "BIN", w4: "BING", w5: "BINGO" },
  { w3: "BIN", w4: "BING", w5: "BINGE" },
  { w3: "BIN", w4: "BING", w5: "BINGS" },
  { w3: "BAN", w4: "BANG", w5: "BANGS" }
];

const LETTER_POOL = [
  ..."EEEEEEEEEE",
  ..."AAAAAAAAA",
  ..."IIIIIIII",
  ..."OOOOOOOO",
  ..."NNNNNNNN",
  ..."RRRRRRRR",
  ..."TTTTTTTT",
  ..."LLLLLLLL",
  ..."SSSSSSSS",
  ..."DDDDD",
  ..."GGGGG",
  ..."BBCCMMPP",
  ..."FFHHVVVWWY",
  ..."KJXQZ"
];

function getDailySeed() {
  const now = new Date();
  return Math.floor(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  ) / 86400000);
}

function mulberry32(seed) {
  let t = seed;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleArray(arr, rng) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickWeightedLetter(rng) {
  return LETTER_POOL[Math.floor(rng() * LETTER_POOL.length)];
}

function boardHasWord(board, word) {
  const letters = board.filter(cell => cell !== "");
  const counts = {};

  for (const ch of letters) {
    counts[ch] = (counts[ch] || 0) + 1;
  }

  for (const ch of word) {
    if (!counts[ch]) return false;
    counts[ch]--;
  }

  return true;
}

function boardHasAnyChain(board) {
  for (const chain of CHAIN_FAMILIES) {
    if (
      boardHasWord(board, chain.w3) &&
      boardHasWord(board, chain.w4) &&
      boardHasWord(board, chain.w5)
    ) {
      return true;
    }
  }
  return false;
}

function buildDailyPuzzle() {
  const seed = getDailySeed();
  let attempt = 0;

  while (true) {
    const rng = mulberry32(seed + attempt);
    const letters = [];

    for (let i = 0; i < TILE_COUNT; i++) {
      letters.push(pickWeightedLetter(rng));
    }

    const shuffledLetters = shuffleArray(letters, rng);
    const candidateBoard = [...shuffledLetters, ""];

    if (boardHasAnyChain(candidateBoard)) {
      return { board: candidateBoard };
    }

    attempt++;
  }
}

function rowOf(i) { return Math.floor(i / GRID_SIZE); }
function colOf(i) { return i % GRID_SIZE; }

function areAdjacent(a, b) {
  return Math.abs(rowOf(a) - rowOf(b)) + Math.abs(colOf(a) - colOf(b)) === 1;
}

function moveTile(i) {
  if (gameEnded || frozen) return;
  if (!areAdjacent(i, blankIndex)) return;

  [board[i], board[blankIndex]] = [board[blankIndex], board[i]];
  blankIndex = i;
  renderBoard();
}

function getWord(path) {
  return path.map(i => board[i]).join("");
}

function isRight(path) {
  const r = rowOf(path[0]);
  return path.every((p, i) => i === 0 || (rowOf(p) === r && p === path[i - 1] + 1));
}

function isDown(path) {
  const c = colOf(path[0]);
  return path.every((p, i) => i === 0 || (colOf(p) === c && p === path[i - 1] + GRID_SIZE));
}

function basePoints(len) {
  if (len === 3) return 1;
  if (len === 4) return 2;
  if (len === 5) return 3;
  return 0;
}

function clearSelection() {
  selectedPath = [];
  isDragging = false;
  currentDirection = null;
  renderBoard();
}

function extendSelection(i) {
  if (!frozen || board[i] === "") return;

  if (selectedPath.length === 0) {
    selectedPath.push(i);
    return renderBoard();
  }

  const last = selectedPath[selectedPath.length - 1];

  const dir =
    (rowOf(last) === rowOf(i) && i === last + 1) ? "right" :
    (colOf(last) === colOf(i) && i === last + GRID_SIZE) ? "down" : null;

  if (!dir) return;

  if (!currentDirection) {
    currentDirection = dir;
    selectedPath.push(i);
  } else if (dir === currentDirection) {
    selectedPath.push(i);
  }

  renderBoard();
}

function submitWord() {
  if (selectedPath.length < 3 || selectedPath.length > 5) {
    clearSelection();
    return;
  }

  if (!(isRight(selectedPath) || isDown(selectedPath))) {
    clearSelection();
    return;
  }

  const word = getWord(selectedPath).toUpperCase();
  const direction = isRight(selectedPath) ? "right" : "down";

  const liveDictionary =
    (typeof getDictionaryArray === "function" && getDictionaryArray().length > 0)
      ? new Set(getDictionaryArray().map(word => word.toUpperCase()))
      : DICTIONARY;

  if (!liveDictionary.has(word)) {
    messageEl.textContent = `"${word}" is not a valid word`;
    clearSelection();
    return;
  }

  if (usedWords.has(word + "-" + direction)) {
    messageEl.textContent = `"${word}" already used in that direction`;
    clearSelection();
    return;
  }

  let comboBonus = frozenRoundMultiplier;
  let pts = basePoints(word.length) + comboBonus;

  usedWords.add(word + "-" + direction);

  if (!foundWords.includes(word)) {
    foundWords.push(word);
  }

  let chainJustCompleted = false;
  let chainBonus = checkChainBonus(foundWords);

  if (chainBonus > 0) {
    pts += chainBonus;
    chainJustCompleted = true;
  }

  score += pts;

  if (comboBonus > 0) {
    showComboPopup(comboBonus);
  }

  frozenRoundMultiplier++;
  scoreEl.textContent = score;

  if (chainJustCompleted) {
    showChainBonus(5);
    messageEl.textContent = `Chain bonus! ${word} earned +5 chain bonus`;
  } else {
    messageEl.textContent = `${word} scored ${pts} points`;
  }

  clearSelection();
}

function showChainBonus(points) {
  const bonus = document.createElement("div");
  bonus.className = "chain-bonus";
  bonus.textContent = `CHAIN BONUS +${points}`;

  document.body.appendChild(bonus);

  requestAnimationFrame(() => {
    bonus.style.opacity = "1";
  });

  setTimeout(() => {
    bonus.remove();
  }, 800);
}

function freezeGrid() {
  frozen = !frozen;

  if (frozen) {
    frozenRoundMultiplier = 0;
    freezeBtn.textContent = "Unfreeze";
    freezeBtn.classList.add("freeze-active");
    document.body.classList.add("frozen-background");
  } else {
    freezeBtn.textContent = "Freeze Grid";
    freezeBtn.classList.remove("freeze-active");
    document.body.classList.remove("frozen-background");
    clearSelection();
  }

  renderBoard();
}

function startTimer() {
  timerInterval = setInterval(() => {
    if (gameEnded) return;

    timeLeft--;
    timerEl.textContent = timeLeft;

    if (timeLeft <= 0) endGame();
  }, 1000);
}

function endGame() {
  gameEnded = true;
  clearInterval(timerInterval);
  timeLeft = 0;
  timerEl.textContent = timeLeft;

  endMessageEl.textContent = `Time's up! You scored ${score}. Submit your score to the Word Shuffle leaderboard.`;
  endScreenEl.classList.remove("hidden");
  endScreenEl.style.display = "flex";
}

async function submitScore() {
  const user = auth.currentUser;

  if (!user) {
    alert("Please sign in to submit your score.");
    window.location.href = "account.html";
    return;
  }

  if (score <= 0) {
    alert("You need to score at least 1 point before submitting.");
    return;
  }

  try {
    const todayId = getTodayId();

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    let username = user.email || "Player";

    if (userSnap.exists()) {
      const userData = userSnap.data();
      username =
        userData.username ||
        userData.displayName ||
        userData.firstName ||
        user.email ||
        "Player";
    }

    const scoreRef = doc(
      db,
      "leaderboards",
      "word-shuffle",
      "days",
      todayId,
      "scores",
      user.uid
    );

    const existingScoreSnap = await getDoc(scoreRef);

    if (existingScoreSnap.exists()) {
      const existingScore = existingScoreSnap.data().score || 0;

      if (existingScore >= score) {
        alert(`Score already submitted. Your best score today is ${existingScore}.`);
        return;
      }
    }

    await setDoc(scoreRef, {
      uid: user.uid,
      username: username,
      score: score,
      game: "word-shuffle",
      day: todayId,
      submittedAt: serverTimestamp()
    });

    const statsRef = doc(db, "users", user.uid, "gameStats", "word-shuffle");

    await setDoc(statsRef, {
      gamesPlayed: increment(1),
      totalScore: increment(score),
      bestScore: score,
      lastPlayed: serverTimestamp()
    }, { merge: true });

    alert("Score submitted to the Word Shuffle leaderboard!");

  } catch (error) {
    console.error("Error submitting score:", error);
    alert("Error submitting score: " + error.message);
  }
}

function resetGame() {
  const puzzle = buildDailyPuzzle();

  board = puzzle.board;
  blankIndex = board.indexOf("");

  score = 0;
  timeLeft = GAME_TIME;
  gameEnded = false;
  frozen = false;
  usedWords.clear();
  foundWords = [];
  awardedChainBonuses.clear();
  frozenRoundMultiplier = 2;
  selectedPath = [];
  isDragging = false;
  currentDirection = null;

  freezeBtn.classList.remove("freeze-active");
  document.body.classList.remove("frozen-background");

  scoreEl.textContent = score;
  timerEl.textContent = timeLeft;
  freezeBtn.textContent = "Freeze Grid";
  messageEl.textContent = "";
  endScreenEl.style.display = "none";

  renderBoard();
}

function startGame() {
  document.getElementById("home-screen").classList.remove("active");
  document.getElementById("game-screen").classList.add("active");

  clearInterval(timerInterval);
  resetGame();
  startTimer();
}

function renderBoard() {
  boardEl.innerHTML = "";

  board.forEach((l, i) => {
    const t = document.createElement("div");
    t.className = "tile";
    t.textContent = l;

    if (l === "") t.classList.add("blank");
    if (selectedPath.includes(i)) t.classList.add("selected");

    t.onclick = () => {
      if (gameEnded || frozen) return;
      moveTile(i);
    };

    t.onpointerdown = () => {
      if (!frozen) return;

      isDragging = true;
      selectedPath = [];
      currentDirection = null;
      extendSelection(i);
    };

    t.onpointermove = () => {
      if (!isDragging) return;
      extendSelection(i);
    };

    t.onpointerup = () => {
      if (isDragging) submitWord();
      isDragging = false;
    };

    boardEl.appendChild(t);
  });
}

document.addEventListener("pointerup", () => {
  if (isDragging) {
    isDragging = false;
    submitWord();
  }
});

if (freezeBtn) {
  freezeBtn.onclick = freezeGrid;
}

if (playAgainBtn) {
  playAgainBtn.addEventListener("click", () => {
    endScreenEl.style.display = "none";
    startGame();
  });
}

if (submitScoreBtn) {
  submitScoreBtn.addEventListener("click", submitScore);
}

if (homeBtn) {
  homeBtn.addEventListener("click", () => {
    clearInterval(timerInterval);
    endScreenEl.style.display = "none";
    document.getElementById("game-screen").classList.remove("active");
    document.getElementById("home-screen").classList.add("active");
  });
}

function showComboPopup(amount) {
  comboPopup.textContent = `Combo +${amount}`;
  comboPopup.classList.remove("show");
  void comboPopup.offsetWidth;
  comboPopup.classList.add("show");
}
window.startGame = startGame;
resetGame();