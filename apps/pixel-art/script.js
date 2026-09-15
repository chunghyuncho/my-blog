(() => {
  'use strict';

  const GRID_SIZE = 16;
  const CELL_COUNT = GRID_SIZE * GRID_SIZE;
  const DISPLAY_CELL_PX = 24; // internal canvas resolution per cell (crisp, scaled by CSS)
  const CANVAS_PX = GRID_SIZE * DISPLAY_CELL_PX;
  const SAVE_SCALE = 32; // exported PNG resolution per cell

  const PALETTE_COLORS = [
    { color: '#000000', name: '검정' },
    { color: '#ffffff', name: '흰색' },
    { color: '#888888', name: '회색' },
    { color: '#e74c3c', name: '빨강' },
    { color: '#e67e22', name: '주황' },
    { color: '#f1c40f', name: '노랑' },
    { color: '#a3e635', name: '연두' },
    { color: '#2ecc71', name: '초록' },
    { color: '#1abc9c', name: '청록' },
    { color: '#38bdf8', name: '하늘색' },
    { color: '#2563eb', name: '파랑' },
    { color: '#1e3a8a', name: '남색' },
    { color: '#8e44ad', name: '보라' },
    { color: '#f472b6', name: '분홍' },
    { color: '#92400e', name: '갈색' },
    { color: '#d1d5db', name: '연회색' },
  ];

  const state = {
    grid: new Array(CELL_COUNT).fill(null),
    currentColor: '#000000',
    tool: 'draw', // 'draw' | 'erase'
    isPointerDown: false,
    lastPaintedIndex: -1,
    focusIndex: 0, // for keyboard navigation on the canvas
  };

  const canvas = document.getElementById('pixel-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = CANVAS_PX;
  canvas.height = CANVAS_PX;

  const paletteEl = document.getElementById('palette');
  const customColorInput = document.getElementById('custom-color');
  const currentColorPreview = document.getElementById('current-color-preview');
  const eraserBtn = document.getElementById('eraser-btn');
  const clearBtn = document.getElementById('clear-btn');
  const saveBtn = document.getElementById('save-btn');

  let swatchButtons = [];

  function buildPalette() {
    PALETTE_COLORS.forEach(({ color, name }) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'swatch';
      btn.style.backgroundColor = color;
      btn.dataset.color = color;
      btn.setAttribute('aria-label', `${name} 선택`);
      btn.setAttribute('aria-pressed', 'false');
      btn.addEventListener('click', () => {
        state.currentColor = color;
        state.tool = 'draw';
        updateSelectionUI();
      });
      paletteEl.appendChild(btn);
      swatchButtons.push(btn);
    });
  }

  function updateSelectionUI() {
    currentColorPreview.style.backgroundColor = state.currentColor;
    const normalizedCurrent = state.currentColor.toLowerCase();
    swatchButtons.forEach((btn) => {
      const isSelected = state.tool === 'draw' && btn.dataset.color.toLowerCase() === normalizedCurrent;
      btn.setAttribute('aria-pressed', String(isSelected));
    });
    eraserBtn.setAttribute('aria-pressed', String(state.tool === 'erase'));
  }

  function renderGrid() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const index = row * GRID_SIZE + col;
        const color = state.grid[index];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(col * DISPLAY_CELL_PX, row * DISPLAY_CELL_PX, DISPLAY_CELL_PX, DISPLAY_CELL_PX);
        }
      }
    }

    // grid lines
    ctx.strokeStyle = 'rgba(150, 150, 160, 0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
      const pos = i * DISPLAY_CELL_PX + 0.5;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, canvas.height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(canvas.width, pos);
      ctx.stroke();
    }

    // keyboard focus indicator
    if (document.activeElement === canvas) {
      const focusRow = Math.floor(state.focusIndex / GRID_SIZE);
      const focusCol = state.focusIndex % GRID_SIZE;
      ctx.strokeStyle = '#3a6df0';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        focusCol * DISPLAY_CELL_PX + 1,
        focusRow * DISPLAY_CELL_PX + 1,
        DISPLAY_CELL_PX - 2,
        DISPLAY_CELL_PX - 2
      );
    }
  }

  function paintCell(index) {
    if (index < 0 || index >= CELL_COUNT) return;
    const newValue = state.tool === 'erase' ? null : state.currentColor;
    if (state.grid[index] !== newValue) {
      state.grid[index] = newValue;
      renderGrid();
    }
  }

  // Paints every cell on the straight line between fromIndex and toIndex
  // (Bresenham's line algorithm) so fast drags/swipes don't leave gaps
  // between the sparse pointermove samples the browser delivers.
  function paintLine(fromIndex, toIndex) {
    if (fromIndex === -1 || fromIndex === toIndex) {
      paintCell(toIndex);
      return;
    }
    let x0 = fromIndex % GRID_SIZE;
    let y0 = Math.floor(fromIndex / GRID_SIZE);
    const x1 = toIndex % GRID_SIZE;
    const y1 = Math.floor(toIndex / GRID_SIZE);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;

    while (true) {
      paintCell(y0 * GRID_SIZE + x0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  function getCellFromEvent(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const col = Math.floor((x / rect.width) * GRID_SIZE);
    const row = Math.floor((y / rect.height) * GRID_SIZE);
    if (col < 0 || col >= GRID_SIZE || row < 0 || row >= GRID_SIZE) return -1;
    return row * GRID_SIZE + col;
  }

  // ---- Mouse events ----
  canvas.addEventListener('mousedown', (e) => {
    state.isPointerDown = true;
    const index = getCellFromEvent(e.clientX, e.clientY);
    if (index !== -1) {
      state.lastPaintedIndex = index;
      state.focusIndex = index;
      paintCell(index);
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!state.isPointerDown) return;
    const index = getCellFromEvent(e.clientX, e.clientY);
    if (index !== -1 && index !== state.lastPaintedIndex) {
      paintLine(state.lastPaintedIndex, index);
      state.lastPaintedIndex = index;
      state.focusIndex = index;
    }
  });

  window.addEventListener('mouseup', () => {
    state.isPointerDown = false;
    state.lastPaintedIndex = -1;
  });

  // ---- Touch events ----
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    state.isPointerDown = true;
    const touch = e.touches[0];
    const index = getCellFromEvent(touch.clientX, touch.clientY);
    if (index !== -1) {
      state.lastPaintedIndex = index;
      state.focusIndex = index;
      paintCell(index);
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!state.isPointerDown) return;
    const touch = e.touches[0];
    const index = getCellFromEvent(touch.clientX, touch.clientY);
    if (index !== -1 && index !== state.lastPaintedIndex) {
      paintLine(state.lastPaintedIndex, index);
      state.lastPaintedIndex = index;
      state.focusIndex = index;
    }
  }, { passive: false });

  canvas.addEventListener('touchend', () => {
    state.isPointerDown = false;
    state.lastPaintedIndex = -1;
  });

  canvas.addEventListener('touchcancel', () => {
    state.isPointerDown = false;
    state.lastPaintedIndex = -1;
  });

  // ---- Keyboard navigation (optional accessibility enhancement) ----
  canvas.addEventListener('keydown', (e) => {
    const row = Math.floor(state.focusIndex / GRID_SIZE);
    const col = state.focusIndex % GRID_SIZE;
    let handled = true;

    switch (e.key) {
      case 'ArrowUp':
        if (row > 0) state.focusIndex -= GRID_SIZE;
        break;
      case 'ArrowDown':
        if (row < GRID_SIZE - 1) state.focusIndex += GRID_SIZE;
        break;
      case 'ArrowLeft':
        if (col > 0) state.focusIndex -= 1;
        break;
      case 'ArrowRight':
        if (col < GRID_SIZE - 1) state.focusIndex += 1;
        break;
      case ' ':
      case 'Enter':
        paintCell(state.focusIndex);
        break;
      default:
        handled = false;
    }

    if (handled) {
      e.preventDefault();
      renderGrid();
    }
  });

  canvas.addEventListener('focus', renderGrid);
  canvas.addEventListener('blur', renderGrid);

  // ---- Palette / tools ----
  customColorInput.addEventListener('input', (e) => {
    state.currentColor = e.target.value;
    state.tool = 'draw';
    updateSelectionUI();
  });

  eraserBtn.addEventListener('click', () => {
    state.tool = state.tool === 'erase' ? 'draw' : 'erase';
    updateSelectionUI();
  });

  clearBtn.addEventListener('click', () => {
    const confirmed = window.confirm('정말 전체 그림을 지우시겠습니까?');
    if (!confirmed) return;
    state.grid.fill(null);
    renderGrid();
  });

  saveBtn.addEventListener('click', () => {
    const offscreen = document.createElement('canvas');
    offscreen.width = GRID_SIZE * SAVE_SCALE;
    offscreen.height = GRID_SIZE * SAVE_SCALE;
    const offCtx = offscreen.getContext('2d');
    offCtx.clearRect(0, 0, offscreen.width, offscreen.height);

    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const color = state.grid[row * GRID_SIZE + col];
        if (color) {
          offCtx.fillStyle = color;
          offCtx.fillRect(col * SAVE_SCALE, row * SAVE_SCALE, SAVE_SCALE, SAVE_SCALE);
        }
      }
    }

    offscreen.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const timestamp = new Date()
        .toISOString()
        .replace(/[-:]/g, '')
        .replace('T', '-')
        .slice(0, 15);
      a.href = url;
      a.download = `pixel-art-${timestamp}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  });

  // ---- Init ----
  buildPalette();
  updateSelectionUI();
  renderGrid();
})();
