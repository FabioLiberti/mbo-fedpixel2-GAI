// frontend/src/phaser/utils/pathfinder.ts
//
// Simple A* pathfinder operating on a 2D grid (0=walkable, 1=blocked).
// Returns a path of pixel waypoints at 32px tile centers.

const TILE_SIZE = 32;

interface Node {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: Node | null;
}

/**
 * Find a path from (sx,sy) to (ex,ey) in pixel coordinates.
 * Returns an array of {x,y} waypoints (pixel centers of tiles), or
 * a direct line if no grid path is found (fallback).
 */
export function findPath(
  grid: number[][],
  sx: number, sy: number,
  ex: number, ey: number,
): { x: number; y: number }[] {
  const rows = grid.length;
  if (rows === 0) return [{ x: sx, y: sy }, { x: ex, y: ey }];
  const cols = grid[0].length;

  // Convert pixel → tile
  const startCol = clamp(Math.floor(sx / TILE_SIZE), 0, cols - 1);
  const startRow = clamp(Math.floor(sy / TILE_SIZE), 0, rows - 1);
  const endCol   = clamp(Math.floor(ex / TILE_SIZE), 0, cols - 1);
  const endRow   = clamp(Math.floor(ey / TILE_SIZE), 0, rows - 1);

  // If start or end is blocked, fallback
  if (grid[startRow]?.[startCol] === 1 || grid[endRow]?.[endCol] === 1) {
    return [{ x: sx, y: sy }, { x: ex, y: ey }];
  }

  // A*
  const open: Node[] = [];
  const closed = new Set<string>();
  const key = (x: number, y: number) => `${x},${y}`;

  const startNode: Node = { x: startCol, y: startRow, g: 0, h: 0, f: 0, parent: null };
  startNode.h = heuristic(startCol, startRow, endCol, endRow);
  startNode.f = startNode.h;
  open.push(startNode);

  // 4-directional neighbors
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  let iterations = 0;
  const maxIter = cols * rows * 2; // safety cap

  while (open.length > 0 && iterations++ < maxIter) {
    // Find node with lowest f
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[bestIdx].f) bestIdx = i;
    }
    const current = open.splice(bestIdx, 1)[0];

    if (current.x === endCol && current.y === endRow) {
      return reconstructPath(current);
    }

    closed.add(key(current.x, current.y));

    for (const [dx, dy] of dirs) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      if (grid[ny]?.[nx] === 1) continue;
      if (closed.has(key(nx, ny))) continue;

      const g = current.g + 1;
      const existing = open.find(n => n.x === nx && n.y === ny);
      if (existing) {
        if (g < existing.g) {
          existing.g = g;
          existing.f = g + existing.h;
          existing.parent = current;
        }
      } else {
        const h = heuristic(nx, ny, endCol, endRow);
        open.push({ x: nx, y: ny, g, h, f: g + h, parent: current });
      }
    }
  }

  // No path found — fallback to direct line
  return [{ x: sx, y: sy }, { x: ex, y: ey }];
}

function heuristic(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by); // Manhattan
}

function reconstructPath(node: Node): { x: number; y: number }[] {
  const path: { x: number; y: number }[] = [];
  let n: Node | null = node;
  while (n) {
    // Convert tile → pixel center
    path.unshift({ x: n.x * TILE_SIZE + TILE_SIZE / 2, y: n.y * TILE_SIZE + TILE_SIZE / 2 });
    n = n.parent;
  }
  return path;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
