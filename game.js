alert("JS LOADED");
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
let frozenRoundMultiplier = 2;
let selectedPath = [];
let isDragging = false;
let currentDirection = null;

let currentPuzzle = null;
let fullChainWord = "";

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

// Dictionary
function getDictionarySet() {
  if (typeof getDictionaryArray === "function") {
    const arr = getDictionaryArray();
    return new Set(arr.map(w => w.trim().toUpperCase()));
  }

  return new Set([
    "END","LEND","BLEND",
    "INK","LINK","BLINK",
    "AIR","HAIR","CHAIR",
    "ICE","MICE","SLICE",
    "ATE","LATE","PLATE",
    "ILL","HILL","CHILL",
    "AND","BAND","BLAND",
    "ROW","BROW","BROWN"
  ]);
}

const DICTIONARY = getDictionarySet();

// Chains
const CHAIN_FAMILIES = [
  { w3: "END", w4: "LEND", w5: "BLEND" },
  { w3: "INK", w4: "LINK", w5: "BLINK" },
  { w3: "AIR", w4: "HAIR", w5: "CHAIR" },
  { w3: "ICE", w4: "MICE", w5: "SLICE" },
  { w3: "ATE", w4: "LATE", w5: "PLATE" }
];

// Weighted letters
const LETTER_POOL = [
  ..."EEEEEEEEEEE",
  ..."AAAAAAAAA",
  ..."IIIIIIIII",
  ..."OOOOOOOO",
  ..."NNNNNNNN",
  ..."RRRRRRRR",
  ..."TTTTTTTT",
  ..."LLLLLLLL",
  ..."SSSSSSSS",
  ..."DDDD",
  ..."GGGG",
  ..."BCMP",
  ..."FHVWY",
  ..."KJXQZ"
];

// Seed
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

// Build puzzle
function buildDailyPuzzle() {
  const seed = getDailySeed();
  const rng = mulberry32(seed);

  const chain = CHAIN_FAMILIES[Math.floor(rng() * CHAIN_FAMILIES.length)];
  fullChainWord = chain.w5;

  const guaranteed = chain.w5.split("");

  const extras = [];
  for (let i = 0; i < TILE_COUNT - guaranteed.length; i++) {
    extras.push(pickWeightedLetter(rng));
  }

  const letters = shuffleArray([...guaranteed, ...extras], rng);

  return {
    board: [...letters, ""],
    chain
  };
}

// Helpers
function rowOf(i){ return Math.floor(i / GRID_SIZE); }
function colOf(i){ return i % GRID_SIZE; }

function areAdjacent(a,b){
  return Math.abs(rowOf(a)-rowOf(b)) + Math.abs(colOf(a)-colOf(b)) === 1;
}

function moveTile(i){
  if (gameEnded || frozen) return;
  if (!areAdjacent(i, blankIndex)) return;

  [board[i], board[blankIndex]] = [board[blankIndex], board[i]];
  blankIndex = i;
  renderBoard();
}

function getWord(path){
  return path.map(i => board[i]).join("");
}

function isRight(path){
  const r = rowOf(path[0]);
  return path.every((p,i)=> i===0 || (rowOf(p)===r && p===path[i-1]+1));
}

function isDown(path){
  const c = colOf(path[0]);
  return path.every((p,i)=> i===0 || (colOf(p)===c && p===path[i-1]+GRID_SIZE));
}

function basePoints(len){
  if (len===3) return 1;
  if (len===4) return 2;
  if (len===5) return 3;
  return 0;
}
function clearSelection(){
  selectedPath = [];
  isDragging = false;
  currentDirection = null;
  renderBoard();
}

function extendSelection(i){
  if (!frozen || board[i]==="") return;

  if (selectedPath.length===0){
    selectedPath.push(i);
    return renderBoard();
  }

  const last = selectedPath[selectedPath.length-1];

  const dir =
    (rowOf(last)===rowOf(i) && i===last+1) ? "right" :
    (colOf(last)===colOf(i) && i===last+GRID_SIZE) ? "down" : null;

  if (!dir) return;

  if (!currentDirection){
    currentDirection = dir;
    selectedPath.push(i);
  } else if (dir===currentDirection){
    selectedPath.push(i);
  }

  renderBoard();
}

function submitWord(){
  if (selectedPath.length<3 || selectedPath.length>5){
    clearSelection(); return;
  }

  if (!(isRight(selectedPath) || isDown(selectedPath))){
    clearSelection(); return;
  }

  const word = getWord(selectedPath).toUpperCase();

  if (!DICTIONARY.has(word)){
    clearSelection(); return;
  }

  if (usedWords.has(word)){
    clearSelection(); return;
  }

  let pts = basePoints(word.length) * frozenRoundMultiplier;

  if (word === fullChainWord){
    pts += 10;
  }

  score += pts;
  usedWords.add(word);
  frozenRoundMultiplier++;

  scoreEl.textContent = score;
  clearSelection();
}

function freezeGrid(){
  frozen = !frozen;

  if (frozen){
    frozenRoundMultiplier = 2;
    freezeBtn.textContent = "Unfreeze";
  } else {
    freezeBtn.textContent = "Freeze Grid";
    clearSelection();
  }
}

function startTimer(){
  timerInterval = setInterval(()=>{
    if (gameEnded) return;

    timeLeft--;
    timerEl.textContent = timeLeft;

    if (timeLeft<=0) endGame();
  },1000);
}

function endGame(){
  gameEnded = true;
  clearInterval(timerInterval);

  endScreenEl.style.display = "block";
  endMessageEl.textContent =
    `Time’s up! You scored ${score}. Come back tomorrow!`;
}

function resetGame(){
  const puzzle = buildDailyPuzzle();

  board = puzzle.board;
  blankIndex = board.indexOf("");

  score = 0;
  timeLeft = GAME_TIME;
  gameEnded = false;
  frozen = false;
  usedWords.clear();

  scoreEl.textContent = score;
  timerEl.textContent = timeLeft;
  freezeBtn.textContent = "Freeze Grid";

  endScreenEl.style.display = "none";

  renderBoard();
  startTimer();
}

function renderBoard(){
  boardEl.innerHTML = "";

  board.forEach((l,i)=>{
    const t = document.createElement("div");
    t.className = "tile";
    t.textContent = l;

    if (l==="") t.classList.add("blank");

    if (selectedPath.includes(i)) t.classList.add("selected");

    t.onclick = ()=> moveTile(i);

    t.onpointerdown = ()=>{
      if (!frozen) return;
      isDragging = true;
      selectedPath = [];
      currentDirection = null;
      extendSelection(i);
    };

    t.onpointerenter = ()=>{
      if (!isDragging) return;
      extendSelection(i);
    };

    t.onpointerup = ()=>{
      isDragging = false;
      submitWord();
    };

    boardEl.appendChild(t);
  });
}

document.addEventListener("pointerup", ()=>{
  if (isDragging){
    isDragging = false;
    submitWord();
  }
});

freezeBtn.onclick = freezeGrid;
playAgainBtn.onclick = resetGame;

// INIT
resetGame();