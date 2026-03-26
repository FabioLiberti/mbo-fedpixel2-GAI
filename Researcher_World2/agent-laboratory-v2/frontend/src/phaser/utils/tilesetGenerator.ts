// frontend/src/phaser/utils/tilesetGenerator.ts
//
// Generates themed tileset textures at runtime using canvas.
// Each lab gets its own color palette applied to the same tile shapes.
// Tileset: 8 columns x 4 rows = 32 tiles, each 32x32 px (total 256x128).

export interface TilesetTheme {
  floor: string;        // main floor color
  floorAlt: string;     // accent floor color
  wall: string;         // wall color
  wallEdge: string;     // wall edge/border
  wood: string;         // desk/furniture wood
  woodDark: string;     // darker wood accent
  metal: string;        // equipment/server
  accent: string;       // decorative accent
}

// ── Preset themes ─────────────────────────────────────────────────────

export const THEME_MERCATORUM: TilesetTheme = {
  floor: '#e8c9a0',      // warm sand
  floorAlt: '#dbb98a',   // darker sand
  wall: '#8b4513',        // saddle brown
  wallEdge: '#5c2e0e',    // dark brown
  wood: '#cd853f',        // peru
  woodDark: '#8b6914',    // dark goldenrod
  metal: '#708090',       // slate gray
  accent: '#d2691e',      // chocolate (terracotta)
};

export const THEME_BLEKINGE: TilesetTheme = {
  floor: '#d6e4f0',      // ice blue
  floorAlt: '#c4d8ec',   // darker ice
  wall: '#37474f',        // blue-gray
  wallEdge: '#263238',    // dark blue-gray
  wood: '#90a4ae',        // light blue-gray
  woodDark: '#607d8b',    // blue-gray
  metal: '#546e7a',       // steel
  accent: '#4fc3f7',      // light blue
};

export const THEME_OPBG: TilesetTheme = {
  floor: '#e8f5e9',      // mint
  floorAlt: '#c8e6c9',   // light green
  wall: '#37474f',        // blue-gray
  wallEdge: '#263238',    // dark
  wood: '#8d6e63',        // brown
  woodDark: '#5d4037',    // dark brown
  metal: '#78909c',       // blue-gray metal
  accent: '#66bb6a',      // medical green
};

// ── Tile index constants (0-based) ────────────────────────────────────

export const TILE = {
  EMPTY:      0,
  FLOOR:      1,
  FLOOR_ALT:  2,
  WALL:       3,
  WALL_H:     4,   // horizontal wall segment
  DESK:       5,
  BOOKSHELF:  6,
  SERVER:     7,
  TABLE:      8,
  PLANT:      9,
  RUG:        10,
  WHITEBOARD: 11,
  CHAIR:      12,
  DOOR:       13,
  EQUIPMENT:  14,
  WINDOW:     15,
  // Row 2-3: additional tiles (16-31)
  FLOOR_EDGE_T: 16,
  FLOOR_EDGE_B: 17,
  FLOOR_EDGE_L: 18,
  FLOOR_EDGE_R: 19,
  WALL_CORNER: 20,
  CABINET:     21,
  MONITOR:     22,
  COUCH:       23,
};

// ── Generator ─────────────────────────────────────────────────────────

const TILE_SIZE = 32;
const COLS = 8;
const ROWS = 4;

/**
 * Generate a themed tileset canvas. Returns the canvas element.
 * Add it to Phaser via: scene.textures.addCanvas(key, canvas)
 */
export function generateTilesetCanvas(theme: TilesetTheme): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = COLS * TILE_SIZE;
  canvas.height = ROWS * TILE_SIZE;
  const ctx = canvas.getContext('2d')!;

  // Clear
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw each tile
  drawTile(ctx, TILE.FLOOR, theme, drawFloor);
  drawTile(ctx, TILE.FLOOR_ALT, theme, drawFloorAlt);
  drawTile(ctx, TILE.WALL, theme, drawWall);
  drawTile(ctx, TILE.WALL_H, theme, drawWallH);
  drawTile(ctx, TILE.DESK, theme, drawDesk);
  drawTile(ctx, TILE.BOOKSHELF, theme, drawBookshelf);
  drawTile(ctx, TILE.SERVER, theme, drawServer);
  drawTile(ctx, TILE.TABLE, theme, drawTable);
  drawTile(ctx, TILE.PLANT, theme, drawPlant);
  drawTile(ctx, TILE.RUG, theme, drawRug);
  drawTile(ctx, TILE.WHITEBOARD, theme, drawWhiteboard);
  drawTile(ctx, TILE.CHAIR, theme, drawChair);
  drawTile(ctx, TILE.DOOR, theme, drawDoor);
  drawTile(ctx, TILE.EQUIPMENT, theme, drawEquipment);
  drawTile(ctx, TILE.WINDOW, theme, drawWindow);
  drawTile(ctx, TILE.FLOOR_EDGE_T, theme, drawFloorEdgeT);
  drawTile(ctx, TILE.FLOOR_EDGE_B, theme, drawFloorEdgeB);
  drawTile(ctx, TILE.FLOOR_EDGE_L, theme, drawFloorEdgeL);
  drawTile(ctx, TILE.FLOOR_EDGE_R, theme, drawFloorEdgeR);
  drawTile(ctx, TILE.WALL_CORNER, theme, drawWallCorner);
  drawTile(ctx, TILE.CABINET, theme, drawCabinet);
  drawTile(ctx, TILE.MONITOR, theme, drawMonitor);
  drawTile(ctx, TILE.COUCH, theme, drawCouch);

  return canvas;
}

// ── Helpers ───────────────────────────────────────────────────────────

type TileDrawFn = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: TilesetTheme) => void;

function drawTile(ctx: CanvasRenderingContext2D, index: number, theme: TilesetTheme, fn: TileDrawFn): void {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  const x = col * TILE_SIZE;
  const y = row * TILE_SIZE;
  fn(ctx, x, y, TILE_SIZE, theme);
}

// ── Individual tile renderers ─────────────────────────────────────────

function drawFloor(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: TilesetTheme): void {
  ctx.fillStyle = t.floor;
  ctx.fillRect(x, y, s, s);
  // Subtle grid lines
  ctx.strokeStyle = t.floorAlt;
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
}

function drawFloorAlt(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: TilesetTheme): void {
  ctx.fillStyle = t.floorAlt;
  ctx.fillRect(x, y, s, s);
  ctx.strokeStyle = t.floor;
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
}

function drawWall(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: TilesetTheme): void {
  ctx.fillStyle = t.wall;
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = t.wallEdge;
  ctx.fillRect(x, y, s, 4);
  ctx.fillRect(x, y + s - 4, s, 4);
  ctx.fillRect(x, y, 4, s);
  ctx.fillRect(x + s - 4, y, 4, s);
}

function drawWallH(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: TilesetTheme): void {
  ctx.fillStyle = t.wall;
  ctx.fillRect(x, y, s, s);
  // Horizontal beam accent
  ctx.fillStyle = t.wallEdge;
  ctx.fillRect(x, y + 12, s, 8);
}

function drawDesk(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: TilesetTheme): void {
  ctx.fillStyle = t.floor;
  ctx.fillRect(x, y, s, s);
  // Desk surface
  ctx.fillStyle = t.woodDark;
  ctx.fillRect(x + 3, y + 4, s - 6, s - 8);
  ctx.fillStyle = t.wood;
  ctx.fillRect(x + 4, y + 5, s - 8, s - 10);
  // Monitor hint
  ctx.fillStyle = '#333';
  ctx.fillRect(x + 10, y + 8, 12, 8);
  ctx.fillStyle = '#6cf';
  ctx.fillRect(x + 11, y + 9, 10, 6);
}

function drawBookshelf(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: TilesetTheme): void {
  ctx.fillStyle = t.woodDark;
  ctx.fillRect(x, y, s, s);
  // Shelves
  ctx.fillStyle = t.wood;
  for (let row = 0; row < 4; row++) {
    ctx.fillRect(x + 2, y + 2 + row * 8, s - 4, 6);
  }
  // Book spines (colored rectangles)
  const bookColors = ['#c0392b', '#2980b9', '#27ae60', '#f39c12', '#8e44ad', '#e67e22'];
  for (let row = 0; row < 4; row++) {
    for (let b = 0; b < 6; b++) {
      ctx.fillStyle = bookColors[(row + b) % bookColors.length];
      ctx.fillRect(x + 3 + b * 4, y + 3 + row * 8, 3, 4);
    }
  }
}

function drawServer(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: TilesetTheme): void {
  ctx.fillStyle = t.floor;
  ctx.fillRect(x, y, s, s);
  // Server rack
  ctx.fillStyle = t.metal;
  ctx.fillRect(x + 4, y + 2, s - 8, s - 4);
  // Rack units
  ctx.fillStyle = '#444';
  for (let u = 0; u < 4; u++) {
    ctx.fillRect(x + 6, y + 4 + u * 7, s - 12, 5);
  }
  // LED indicators
  ctx.fillStyle = '#0f0';
  ctx.fillRect(x + 8, y + 5, 2, 2);
  ctx.fillRect(x + 8, y + 12, 2, 2);
  ctx.fillStyle = '#ff0';
  ctx.fillRect(x + 8, y + 19, 2, 2);
}

function drawTable(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: TilesetTheme): void {
  ctx.fillStyle = t.floor;
  ctx.fillRect(x, y, s, s);
  // Table surface
  ctx.fillStyle = t.woodDark;
  ctx.fillRect(x + 2, y + 2, s - 4, s - 4);
  ctx.fillStyle = t.wood;
  ctx.fillRect(x + 3, y + 3, s - 6, s - 6);
}

function drawPlant(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: TilesetTheme): void {
  ctx.fillStyle = t.floor;
  ctx.fillRect(x, y, s, s);
  // Pot
  ctx.fillStyle = '#8d6e63';
  ctx.fillRect(x + 10, y + 20, 12, 10);
  ctx.fillRect(x + 8, y + 18, 16, 4);
  // Leaves
  ctx.fillStyle = '#4caf50';
  ctx.beginPath();
  ctx.arc(x + 16, y + 14, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#66bb6a';
  ctx.beginPath();
  ctx.arc(x + 13, y + 11, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + 19, y + 11, 5, 0, Math.PI * 2);
  ctx.fill();
}

function drawRug(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: TilesetTheme): void {
  ctx.fillStyle = t.floor;
  ctx.fillRect(x, y, s, s);
  // Rug
  ctx.fillStyle = t.accent;
  ctx.globalAlpha = 0.3;
  ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = t.accent;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 3, y + 3, s - 6, s - 6);
  ctx.globalAlpha = 1.0;
}

function drawWhiteboard(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: TilesetTheme): void {
  ctx.fillStyle = t.wall;
  ctx.fillRect(x, y, s, s);
  // Board frame
  ctx.fillStyle = '#bbb';
  ctx.fillRect(x + 3, y + 4, s - 6, s - 12);
  // White surface
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(x + 5, y + 6, s - 10, s - 16);
  // Some scribbles
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 8, y + 10);
  ctx.lineTo(x + 20, y + 14);
  ctx.moveTo(x + 8, y + 16);
  ctx.lineTo(x + 24, y + 16);
  ctx.stroke();
}

function drawChair(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: TilesetTheme): void {
  ctx.fillStyle = t.floor;
  ctx.fillRect(x, y, s, s);
  // Chair seat
  ctx.fillStyle = t.metal;
  ctx.fillRect(x + 8, y + 12, 16, 14);
  // Chair back
  ctx.fillStyle = t.accent;
  ctx.fillRect(x + 9, y + 6, 14, 8);
}

function drawDoor(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: TilesetTheme): void {
  ctx.fillStyle = t.wall;
  ctx.fillRect(x, y, s, s);
  // Door
  ctx.fillStyle = t.wood;
  ctx.fillRect(x + 6, y + 2, s - 12, s - 4);
  // Handle
  ctx.fillStyle = '#ffd700';
  ctx.fillRect(x + s - 11, y + s / 2 - 1, 3, 3);
}

function drawEquipment(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: TilesetTheme): void {
  ctx.fillStyle = t.floor;
  ctx.fillRect(x, y, s, s);
  // Equipment box
  ctx.fillStyle = t.metal;
  ctx.fillRect(x + 4, y + 6, s - 8, s - 10);
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 4, y + 6, s - 8, s - 10);
  // Display
  ctx.fillStyle = '#1a237e';
  ctx.fillRect(x + 7, y + 8, s - 14, 10);
  // Buttons
  ctx.fillStyle = '#f44336';
  ctx.fillRect(x + 8, y + 22, 4, 3);
  ctx.fillStyle = '#4caf50';
  ctx.fillRect(x + 14, y + 22, 4, 3);
}

function drawWindow(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: TilesetTheme): void {
  ctx.fillStyle = t.wall;
  ctx.fillRect(x, y, s, s);
  // Window frame
  ctx.fillStyle = '#eceff1';
  ctx.fillRect(x + 4, y + 4, s - 8, s - 8);
  // Glass
  ctx.fillStyle = '#b3e5fc';
  ctx.fillRect(x + 6, y + 6, s - 12, s - 12);
  // Cross bar
  ctx.fillStyle = '#eceff1';
  ctx.fillRect(x + s / 2 - 1, y + 4, 2, s - 8);
  ctx.fillRect(x + 4, y + s / 2 - 1, s - 8, 2);
}

function drawFloorEdgeT(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: TilesetTheme): void {
  ctx.fillStyle = t.floor;
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = t.wallEdge;
  ctx.fillRect(x, y, s, 3);
}

function drawFloorEdgeB(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: TilesetTheme): void {
  ctx.fillStyle = t.floor;
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = t.wallEdge;
  ctx.fillRect(x, y + s - 3, s, 3);
}

function drawFloorEdgeL(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: TilesetTheme): void {
  ctx.fillStyle = t.floor;
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = t.wallEdge;
  ctx.fillRect(x, y, 3, s);
}

function drawFloorEdgeR(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: TilesetTheme): void {
  ctx.fillStyle = t.floor;
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = t.wallEdge;
  ctx.fillRect(x + s - 3, y, 3, s);
}

function drawWallCorner(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: TilesetTheme): void {
  ctx.fillStyle = t.wallEdge;
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = t.wall;
  ctx.fillRect(x + 4, y + 4, s - 8, s - 8);
}

function drawCabinet(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: TilesetTheme): void {
  ctx.fillStyle = t.floor;
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = t.woodDark;
  ctx.fillRect(x + 4, y + 2, s - 8, s - 4);
  ctx.fillStyle = t.wood;
  ctx.fillRect(x + 5, y + 3, s - 10, (s - 6) / 2 - 1);
  ctx.fillRect(x + 5, y + 3 + (s - 6) / 2 + 1, s - 10, (s - 6) / 2 - 1);
  // Handles
  ctx.fillStyle = '#999';
  ctx.fillRect(x + s / 2 - 2, y + 10, 4, 2);
  ctx.fillRect(x + s / 2 - 2, y + 22, 4, 2);
}

function drawMonitor(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: TilesetTheme): void {
  ctx.fillStyle = t.floor;
  ctx.fillRect(x, y, s, s);
  // Screen
  ctx.fillStyle = '#222';
  ctx.fillRect(x + 4, y + 4, s - 8, s - 14);
  ctx.fillStyle = '#1565c0';
  ctx.fillRect(x + 6, y + 6, s - 12, s - 18);
  // Stand
  ctx.fillStyle = '#555';
  ctx.fillRect(x + s / 2 - 2, y + s - 12, 4, 6);
  ctx.fillRect(x + s / 2 - 5, y + s - 7, 10, 3);
}

function drawCouch(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: TilesetTheme): void {
  ctx.fillStyle = t.floor;
  ctx.fillRect(x, y, s, s);
  // Couch body
  ctx.fillStyle = t.accent;
  ctx.fillRect(x + 2, y + 8, s - 4, s - 12);
  // Back
  ctx.fillStyle = t.accent;
  ctx.globalAlpha = 0.7;
  ctx.fillRect(x + 2, y + 4, s - 4, 8);
  ctx.globalAlpha = 1.0;
  // Cushion line
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(x + s / 2, y + 10);
  ctx.lineTo(x + s / 2, y + s - 5);
  ctx.stroke();
}
