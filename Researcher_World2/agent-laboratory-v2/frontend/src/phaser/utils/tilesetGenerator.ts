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
  // Arena zone tiles (24-30)
  FLOOR_MEETING: 24,  // meeting room floor (blue-tinted)
  FLOOR_BREAK:   25,  // break room floor (warm-tinted)
  FLOOR_SERVER:  26,  // server room floor (green-tinted)
  WALL_INTERNAL: 27,  // thin internal divider
  FLOOR_PROF:    28,  // professor office (warm amber)
  FLOOR_PRIVACY: 29,  // privacy lab (purple-tinted)
  FLOOR_RESEARCH:30,  // research area (teal-tinted)
  // Row 4: extra furniture (31-38)
  LAMP:          31,
  PAINTING:      32,
  PROJECTOR:     33,
  COFFEE_TABLE:  34,
  FRIDGE:        35,
  VENDING:       36,
  PRINTER:       37,
  UPS:           38,
};

// ── Generator ─────────────────────────────────────────────────────────

const TILE_SIZE = 32;
const COLS = 8;
const ROWS = 5;

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
  drawTile(ctx, TILE.FLOOR_MEETING, theme, drawFloorMeeting);
  drawTile(ctx, TILE.FLOOR_BREAK, theme, drawFloorBreak);
  drawTile(ctx, TILE.FLOOR_SERVER, theme, drawFloorServer);
  drawTile(ctx, TILE.WALL_INTERNAL, theme, drawWallInternal);
  drawTile(ctx, TILE.FLOOR_PROF, theme, drawFloorProf);
  drawTile(ctx, TILE.FLOOR_PRIVACY, theme, drawFloorPrivacy);
  drawTile(ctx, TILE.FLOOR_RESEARCH, theme, drawFloorResearch);
  drawTile(ctx, TILE.LAMP, theme, drawLamp);
  drawTile(ctx, TILE.PAINTING, theme, drawPainting);
  drawTile(ctx, TILE.PROJECTOR, theme, drawProjector);
  drawTile(ctx, TILE.COFFEE_TABLE, theme, drawCoffeeTable);
  drawTile(ctx, TILE.FRIDGE, theme, drawFridge);
  drawTile(ctx, TILE.VENDING, theme, drawVending);
  drawTile(ctx, TILE.PRINTER, theme, drawPrinter);
  drawTile(ctx, TILE.UPS, theme, drawUPS);

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

// ── Arena zone floor tiles ──────────────────────────────────────────

/** Blend hex color with a tint at given ratio (0-1). */
function blendColor(base: string, tint: string, ratio: number): string {
  const b = parseInt(base.replace('#', ''), 16);
  const t = parseInt(tint.replace('#', ''), 16);
  const mix = (shift: number) => {
    const bv = (b >> shift) & 0xff;
    const tv = (t >> shift) & 0xff;
    return Math.round(bv + (tv - bv) * ratio);
  };
  const r = mix(16), g = mix(8), bl = mix(0);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
}

function drawFloorMeeting(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: TilesetTheme): void {
  ctx.fillStyle = blendColor(t.floor, '#bbdefb', 0.35);
  ctx.fillRect(x, y, s, s);
  ctx.strokeStyle = blendColor(t.floorAlt, '#90caf9', 0.3);
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
}

function drawFloorBreak(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: TilesetTheme): void {
  ctx.fillStyle = blendColor(t.floor, '#fff9c4', 0.35);
  ctx.fillRect(x, y, s, s);
  ctx.strokeStyle = blendColor(t.floorAlt, '#fff176', 0.3);
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
}

function drawFloorServer(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: TilesetTheme): void {
  ctx.fillStyle = blendColor(t.floor, '#c8e6c9', 0.35);
  ctx.fillRect(x, y, s, s);
  ctx.strokeStyle = blendColor(t.floorAlt, '#a5d6a7', 0.3);
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
}

function drawFloorProf(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: TilesetTheme): void {
  ctx.fillStyle = blendColor(t.floor, '#ffe0b2', 0.35);
  ctx.fillRect(x, y, s, s);
  ctx.strokeStyle = blendColor(t.floorAlt, '#ffcc80', 0.3);
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
}

function drawFloorPrivacy(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: TilesetTheme): void {
  ctx.fillStyle = blendColor(t.floor, '#e1bee7', 0.35);
  ctx.fillRect(x, y, s, s);
  ctx.strokeStyle = blendColor(t.floorAlt, '#ce93d8', 0.3);
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
}

function drawFloorResearch(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: TilesetTheme): void {
  ctx.fillStyle = blendColor(t.floor, '#b2dfdb', 0.35);
  ctx.fillRect(x, y, s, s);
  ctx.strokeStyle = blendColor(t.floorAlt, '#80cbc4', 0.3);
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
}

function drawWallInternal(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: TilesetTheme): void {
  // Floor base with a thin horizontal divider stripe
  ctx.fillStyle = t.floor;
  ctx.fillRect(x, y, s, s);
  ctx.fillStyle = t.wallEdge;
  ctx.globalAlpha = 0.6;
  ctx.fillRect(x, y + s / 2 - 2, s, 4);
  ctx.globalAlpha = 1.0;
  // Subtle dots for visual interest
  ctx.fillStyle = t.wall;
  ctx.fillRect(x + 4, y + s / 2 - 1, 2, 2);
  ctx.fillRect(x + s - 6, y + s / 2 - 1, 2, 2);
}

// ── Extra furniture tiles ────────────────────────────────────────────

function drawLamp(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: TilesetTheme): void {
  ctx.fillStyle = t.floor;
  ctx.fillRect(x, y, s, s);
  // Base
  ctx.fillStyle = t.metal;
  ctx.fillRect(x + 12, y + 24, 8, 6);
  // Pole
  ctx.fillStyle = '#888';
  ctx.fillRect(x + 15, y + 8, 2, 16);
  // Shade
  ctx.fillStyle = '#fff8e1';
  ctx.beginPath();
  ctx.moveTo(x + 8, y + 10);
  ctx.lineTo(x + 24, y + 10);
  ctx.lineTo(x + 20, y + 4);
  ctx.lineTo(x + 12, y + 4);
  ctx.closePath();
  ctx.fill();
  // Glow
  ctx.fillStyle = '#ffeb3b';
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.arc(x + 16, y + 8, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1.0;
}

function drawPainting(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: TilesetTheme): void {
  ctx.fillStyle = t.wall;
  ctx.fillRect(x, y, s, s);
  // Frame
  ctx.fillStyle = t.woodDark;
  ctx.fillRect(x + 4, y + 4, s - 8, s - 8);
  // Canvas
  ctx.fillStyle = '#f5f0e0';
  ctx.fillRect(x + 6, y + 6, s - 12, s - 12);
  // Abstract art
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(x + 8, y + 10, 6, 8);
  ctx.fillStyle = '#2980b9';
  ctx.fillRect(x + 16, y + 8, 8, 6);
  ctx.fillStyle = '#27ae60';
  ctx.fillRect(x + 10, y + 18, 10, 4);
}

function drawProjector(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: TilesetTheme): void {
  ctx.fillStyle = t.floor;
  ctx.fillRect(x, y, s, s);
  // Ceiling mount
  ctx.fillStyle = t.metal;
  ctx.fillRect(x + 13, y, 6, 6);
  // Projector body
  ctx.fillStyle = '#444';
  ctx.fillRect(x + 8, y + 6, 16, 10);
  // Lens
  ctx.fillStyle = '#1565c0';
  ctx.fillRect(x + 10, y + 8, 4, 4);
  // Light beam (faint)
  ctx.fillStyle = '#bbdefb';
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.moveTo(x + 12, y + 16);
  ctx.lineTo(x + 4, y + 30);
  ctx.lineTo(x + 28, y + 30);
  ctx.lineTo(x + 20, y + 16);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1.0;
}

function drawCoffeeTable(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: TilesetTheme): void {
  ctx.fillStyle = t.floor;
  ctx.fillRect(x, y, s, s);
  // Small round table
  ctx.fillStyle = t.woodDark;
  ctx.beginPath();
  ctx.arc(x + 16, y + 16, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = t.wood;
  ctx.beginPath();
  ctx.arc(x + 16, y + 16, 8, 0, Math.PI * 2);
  ctx.fill();
  // Coffee cup
  ctx.fillStyle = '#fff';
  ctx.fillRect(x + 13, y + 12, 6, 5);
  ctx.fillStyle = '#6d4c41';
  ctx.fillRect(x + 14, y + 13, 4, 3);
  // Steam
  ctx.strokeStyle = '#bbb';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(x + 15, y + 11);
  ctx.quadraticCurveTo(x + 14, y + 8, x + 16, y + 6);
  ctx.stroke();
}

function drawFridge(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: TilesetTheme): void {
  ctx.fillStyle = t.floor;
  ctx.fillRect(x, y, s, s);
  // Body
  ctx.fillStyle = '#eceff1';
  ctx.fillRect(x + 6, y + 2, s - 12, s - 4);
  // Door line
  ctx.strokeStyle = '#b0bec5';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 6, y + 14);
  ctx.lineTo(x + s - 6, y + 14);
  ctx.stroke();
  // Handle
  ctx.fillStyle = '#78909c';
  ctx.fillRect(x + s - 10, y + 6, 2, 6);
  ctx.fillRect(x + s - 10, y + 16, 2, 8);
}

function drawVending(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: TilesetTheme): void {
  ctx.fillStyle = t.floor;
  ctx.fillRect(x, y, s, s);
  // Machine body
  ctx.fillStyle = '#37474f';
  ctx.fillRect(x + 4, y + 2, s - 8, s - 4);
  // Display window
  ctx.fillStyle = '#bbdefb';
  ctx.fillRect(x + 6, y + 4, s - 12, 12);
  // Product rows
  ctx.fillStyle = '#e65100';
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      ctx.fillRect(x + 8 + c * 5, y + 5 + r * 5, 3, 3);
    }
  }
  // Coin slot
  ctx.fillStyle = '#ffd700';
  ctx.fillRect(x + s - 10, y + 20, 3, 4);
  // Dispenser slot
  ctx.fillStyle = '#222';
  ctx.fillRect(x + 8, y + 22, 10, 4);
}

function drawPrinter(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: TilesetTheme): void {
  ctx.fillStyle = t.floor;
  ctx.fillRect(x, y, s, s);
  // Body
  ctx.fillStyle = '#eceff1';
  ctx.fillRect(x + 4, y + 8, s - 8, s - 14);
  // Top (feeder)
  ctx.fillStyle = '#cfd8dc';
  ctx.fillRect(x + 6, y + 4, s - 12, 6);
  // Paper
  ctx.fillStyle = '#fff';
  ctx.fillRect(x + 8, y + 2, s - 16, 4);
  // Output tray
  ctx.fillStyle = '#b0bec5';
  ctx.fillRect(x + 6, y + s - 8, s - 12, 4);
  // Status LED
  ctx.fillStyle = '#4caf50';
  ctx.fillRect(x + 8, y + 12, 3, 2);
  // Display
  ctx.fillStyle = '#1a237e';
  ctx.fillRect(x + 14, y + 11, 8, 4);
}

function drawUPS(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: TilesetTheme): void {
  ctx.fillStyle = t.floor;
  ctx.fillRect(x, y, s, s);
  // UPS body (black box)
  ctx.fillStyle = '#212121';
  ctx.fillRect(x + 6, y + 4, s - 12, s - 8);
  // Front panel
  ctx.fillStyle = '#333';
  ctx.fillRect(x + 8, y + 6, s - 16, s - 12);
  // LED indicators
  ctx.fillStyle = '#4caf50';
  ctx.fillRect(x + 10, y + 8, 3, 2);
  ctx.fillRect(x + 14, y + 8, 3, 2);
  ctx.fillStyle = '#ff9800';
  ctx.fillRect(x + 18, y + 8, 3, 2);
  // Battery icon
  ctx.strokeStyle = '#4caf50';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 10, y + 14, 10, 6);
  ctx.fillStyle = '#4caf50';
  ctx.fillRect(x + 11, y + 15, 7, 4);
  ctx.fillRect(x + 20, y + 16, 2, 2);
  // Outlets
  ctx.fillStyle = '#555';
  ctx.fillRect(x + 10, y + 22, 4, 2);
  ctx.fillRect(x + 16, y + 22, 4, 2);
}
