(function () {
  'use strict';

  var SIZE = 4;
  var BEST_KEY = '2048-best-score';
  var REMOVE_DELAY = 160; // ms, slightly longer than CSS transition (120ms)

  var boardEl = document.getElementById('board');
  var scoreEl = document.getElementById('score');
  var bestEl = document.getElementById('best');
  var overlayEl = document.getElementById('overlay');
  var overlayMessageEl = document.getElementById('overlay-message');
  var keepPlayingBtn = document.getElementById('keep-playing-btn');
  var retryBtn = document.getElementById('retry-btn');
  var newGameBtn = document.getElementById('new-game-btn');

  var tileIdSeq = 1;
  var tileElements = Object.create(null); // id -> DOM element (includes tiles pending removal)
  var tileLayerEl = null; // created in buildBackgroundCells()

  var state = {
    grid: null, // SIZE x SIZE array, each cell null or tile object {id, row, col, value}
    score: 0,
    best: 0,
    isGameOver: false,
    hasWon: false,
    keepPlayingAfterWin: false
  };

  // ---------- persistence ----------

  function loadBest() {
    try {
      var raw = localStorage.getItem(BEST_KEY);
      var n = raw ? parseInt(raw, 10) : 0;
      return isFinite(n) && n > 0 ? n : 0;
    } catch (e) {
      return 0;
    }
  }

  function saveBest(value) {
    try {
      localStorage.setItem(BEST_KEY, String(value));
    } catch (e) {
      // localStorage unavailable (e.g. private mode) - ignore, game still works.
    }
  }

  // ---------- grid helpers ----------

  function emptyGrid() {
    var g = [];
    for (var r = 0; r < SIZE; r++) {
      g.push(new Array(SIZE).fill(null));
    }
    return g;
  }

  function getEmptyCells(grid) {
    var cells = [];
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        if (!grid[r][c]) cells.push({ row: r, col: c });
      }
    }
    return cells;
  }

  function addRandomTile(grid) {
    var empties = getEmptyCells(grid);
    if (empties.length === 0) return null;
    var spot = empties[Math.floor(Math.random() * empties.length)];
    var value = Math.random() < 0.9 ? 2 : 4;
    var tile = { id: tileIdSeq++, row: spot.row, col: spot.col, value: value, isNew: true, isMergedResult: false };
    grid[spot.row][spot.col] = tile;
    return tile;
  }

  function withinBounds(r, c) {
    return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
  }

  function canMove(grid) {
    if (getEmptyCells(grid).length > 0) return true;
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var v = grid[r][c].value;
        if (c + 1 < SIZE && grid[r][c + 1].value === v) return true;
        if (r + 1 < SIZE && grid[r + 1][c].value === v) return true;
      }
    }
    return false;
  }

  function buildTraversal(dr, dc) {
    var rows = [0, 1, 2, 3];
    var cols = [0, 1, 2, 3];
    if (dr === 1) rows = rows.slice().reverse(); // moving down: settle bottom row first
    if (dc === 1) cols = cols.slice().reverse(); // moving right: settle rightmost column first
    return { rows: rows, cols: cols };
  }

  // ---------- game lifecycle ----------

  function startGame() {
    // remove any leftover DOM tiles from a previous game
    for (var id in tileElements) {
      if (tileElements[id] && tileElements[id].parentNode) {
        tileElements[id].parentNode.removeChild(tileElements[id]);
      }
    }
    tileElements = Object.create(null);

    state.grid = emptyGrid();
    state.score = 0;
    state.isGameOver = false;
    state.hasWon = false;
    state.keepPlayingAfterWin = false;
    state.best = loadBest();

    addRandomTile(state.grid);
    addRandomTile(state.grid);

    hideOverlay();
    renderScore();
    renderGrid([]);
  }

  // Move the whole board one step in a direction. dr/dc are one of -1,0,1.
  function move(dr, dc) {
    if (overlayIsBlocking()) return;

    var grid = state.grid;
    var moved = false;
    var gained = 0;
    var removedTiles = []; // { id, row, col } -> final (merge target) position, for slide-out animation

    // reset per-move transient flags
    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var t = grid[r][c];
        if (t) {
          t.isNew = false;
          t.isMergedResult = false;
        }
      }
    }

    var traversal = buildTraversal(dr, dc);

    traversal.rows.forEach(function (row) {
      traversal.cols.forEach(function (col) {
        var tile = grid[row][col];
        if (!tile) return;

        var curR = row;
        var curC = col;
        var nextR = curR + dr;
        var nextC = curC + dc;

        while (withinBounds(nextR, nextC) && !grid[nextR][nextC]) {
          grid[curR][curC] = null;
          grid[nextR][nextC] = tile;
          tile.row = nextR;
          tile.col = nextC;
          curR = nextR;
          curC = nextC;
          nextR = curR + dr;
          nextC = curC + dc;
          moved = true;
        }

        if (withinBounds(nextR, nextC)) {
          var target = grid[nextR][nextC];
          if (target && target.value === tile.value && !target.isMergedResult) {
            grid[curR][curC] = null;
            target.value = target.value * 2;
            target.isMergedResult = true;
            gained += target.value;
            moved = true;
            removedTiles.push({ id: tile.id, row: nextR, col: nextC });
            if (target.value === 2048 && !state.hasWon) {
              state.hasWon = true;
            }
          }
        }
      });
    });

    if (!moved) return;

    state.score += gained;
    if (state.score > state.best) {
      state.best = state.score;
      saveBest(state.best);
    }

    addRandomTile(grid);

    state.isGameOver = !canMove(grid);

    renderScore();
    renderGrid(removedTiles);

    if (state.hasWon && !state.keepPlayingAfterWin) {
      showOverlay('win');
    } else if (state.isGameOver) {
      showOverlay('gameover');
    }
  }

  // ---------- rendering ----------

  function renderScore() {
    scoreEl.textContent = String(state.score);
    bestEl.textContent = String(state.best);
  }

  function digitClass(value) {
    return String(value).length;
  }

  function renderGrid(removedTiles) {
    var grid = state.grid;
    var seenIds = Object.create(null);

    for (var r = 0; r < SIZE; r++) {
      for (var c = 0; c < SIZE; c++) {
        var tile = grid[r][c];
        if (!tile) continue;
        seenIds[tile.id] = true;

        var el = tileElements[tile.id];
        if (!el) {
          el = document.createElement('div');
          el.className = 'tile';
          el.style.setProperty('--row', tile.row);
          el.style.setProperty('--col', tile.col);
          tileLayerEl.appendChild(el);
          tileElements[tile.id] = el;
        }

        el.dataset.value = String(tile.value);
        el.dataset.digits = String(digitClass(tile.value));
        el.textContent = String(tile.value);
        el.style.setProperty('--row', tile.row);
        el.style.setProperty('--col', tile.col);

        el.classList.remove('tile-new', 'tile-merged');
        if (tile.isNew) {
          // force reflow so the animation restarts reliably
          void el.offsetWidth;
          el.classList.add('tile-new');
        } else if (tile.isMergedResult) {
          void el.offsetWidth;
          el.classList.add('tile-merged');
        }
      }
    }

    // animate tiles that merged away: slide them to the merge target, then remove.
    removedTiles.forEach(function (info) {
      var el = tileElements[info.id];
      if (!el) return;
      el.style.setProperty('--row', info.row);
      el.style.setProperty('--col', info.col);
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
        if (tileElements[info.id] === el) delete tileElements[info.id];
      }, REMOVE_DELAY);
    });

    // remove any stray elements that no longer correspond to a live tile
    // and were not part of this move's merge animation (e.g. after reset).
    Object.keys(tileElements).forEach(function (id) {
      if (seenIds[id]) return;
      var isPendingRemoval = removedTiles.some(function (info) {
        return String(info.id) === String(id);
      });
      if (isPendingRemoval) return;
      var el = tileElements[id];
      if (el && el.parentNode) el.parentNode.removeChild(el);
      delete tileElements[id];
    });
  }

  // ---------- background grid cells ----------

  function buildBackgroundCells() {
    var fragment = document.createDocumentFragment();
    for (var i = 0; i < SIZE * SIZE; i++) {
      var cell = document.createElement('div');
      cell.className = 'cell';
      fragment.appendChild(cell);
    }
    boardEl.appendChild(fragment);

    tileLayerEl = document.createElement('div');
    tileLayerEl.className = 'tile-layer';
    boardEl.appendChild(tileLayerEl);
  }

  // ---------- overlay ----------

  function overlayIsBlocking() {
    return !overlayEl.hidden;
  }

  function showOverlay(kind) {
    if (kind === 'win') {
      overlayMessageEl.textContent = '축하합니다! 2048을 만들었어요!';
      keepPlayingBtn.hidden = false;
    } else {
      overlayMessageEl.textContent = '게임 오버! 최종 점수: ' + state.score;
      keepPlayingBtn.hidden = true;
    }
    overlayEl.hidden = false;
    retryBtn.focus();
  }

  function hideOverlay() {
    overlayEl.hidden = true;
  }

  keepPlayingBtn.addEventListener('click', function () {
    state.keepPlayingAfterWin = true;
    hideOverlay();
  });

  retryBtn.addEventListener('click', function () {
    startGame();
  });

  newGameBtn.addEventListener('click', function () {
    startGame();
  });

  // ---------- keyboard input ----------

  var KEY_DIRS = {
    ArrowUp: { dr: -1, dc: 0 },
    ArrowDown: { dr: 1, dc: 0 },
    ArrowLeft: { dr: 0, dc: -1 },
    ArrowRight: { dr: 0, dc: 1 },
    w: { dr: -1, dc: 0 },
    W: { dr: -1, dc: 0 },
    s: { dr: 1, dc: 0 },
    S: { dr: 1, dc: 0 },
    a: { dr: 0, dc: -1 },
    A: { dr: 0, dc: -1 },
    d: { dr: 0, dc: 1 },
    D: { dr: 0, dc: 1 }
  };

  document.addEventListener('keydown', function (event) {
    var dir = KEY_DIRS[event.key];
    if (!dir) return;
    event.preventDefault();
    move(dir.dr, dir.dc);
  });

  // ---------- touch / swipe input ----------

  var touchStartX = 0;
  var touchStartY = 0;
  var touchActive = false;
  var SWIPE_THRESHOLD = 24;

  boardEl.addEventListener(
    'touchstart',
    function (event) {
      if (event.touches.length !== 1) return;
      touchActive = true;
      touchStartX = event.touches[0].clientX;
      touchStartY = event.touches[0].clientY;
    },
    { passive: true }
  );

  boardEl.addEventListener(
    'touchmove',
    function (event) {
      if (touchActive) event.preventDefault();
    },
    { passive: false }
  );

  boardEl.addEventListener('touchend', function (event) {
    if (!touchActive) return;
    touchActive = false;
    var touch = event.changedTouches[0];
    var dx = touch.clientX - touchStartX;
    var dy = touch.clientY - touchStartY;

    if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) return;

    if (Math.abs(dx) > Math.abs(dy)) {
      move(0, dx > 0 ? 1 : -1);
    } else {
      move(dy > 0 ? 1 : -1, 0);
    }
  });

  // ---------- init ----------

  buildBackgroundCells();
  startGame();
})();
