// frontend/src/phaser/utils/pathfinder.ts
//
// A* pathfinder on a 2D grid (0=walkable, 1=blocked).
// Returns pixel waypoints at 32px tile centers, or [] if unreachable.

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
 * Returns an array of {x,y} waypoints, or **empty array** if no valid path
 * exists — the caller must handle that case (e.g. pick a new destination).
 */
export function findPath(
  grid: number[][],
  sx: number, sy: number,
  ex: number, ey: number,
): { x: number; y: number }[] {
  const rows = grid.length;
  if (rows === 0) return [];
  const cols = grid[0].length;

  // Convert pixel → tile
  let startCol = clamp(Math.floor(sx / TILE_SIZE), 0, cols - 1);
  let startRow = clamp(Math.floor(sy / TILE_SIZE), 0, rows - 1);
  const endCol   = clamp(Math.floor(ex / TILE_SIZE), 0, cols - 1);
  const endRow   = clamp(Math.floor(ey / TILE_SIZE), 0, rows - 1);

  // If start is inside a wall, snap to nearest walkable tile
  if (grid[startRow]?.[startCol] === 1) {
    const snapped = nearestWalkable(grid, startCol, startRow, cols, rows);
    if (!snapped) return [];
    startCol = snapped.x;
    startRow = snapped.y;
  }

  // If destination is blocked, no valid path
  if (grid[endRow]?.[endCol] === 1) return [];

  // Trivial case
  if (startCol === endCol && startRow === endRow) {
    return [{ x: endCol * TILE_SIZE + TILE_SIZE / 2, y: endRow * TILE_SIZE + TILE_SIZE / 2 }];
  }

  // A*
  const open: Node[] = [];
  const closed = new Set<string>();
  const key = (x: number, y: number) => `${x},${y}`;

  const startNode: Node = { x: startCol, y: startRow, g: 0, h: 0, f: 0, parent: null };
  startNode.h = heuristic(startCol, startRow, endCol, endRow);
  startNode.f = startNode.h;
  open.push(startNode);

  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  let iterations = 0;
  const maxIter = cols * rows * 2;

  while (open.length > 0 && iterations++ < maxIter) {
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

  // No path found — do NOT fallback to direct line
  return [];
}

/** Find the nearest walkable cell via BFS (small radius). */
function nearestWalkable(
  grid: number[][], cx: number, cy: number, cols: number, rows: number,
): { x: number; y: number } | null {
  const visited = new Set<string>();
  const queue: { x: number; y: number }[] = [{ x: cx, y: cy }];
  visited.add(`${cx},${cy}`);
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (grid[cur.y]?.[cur.x] === 0) return cur;
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const k = `${nx},${ny}`;
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !visited.has(k)) {
        visited.add(k);
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return null;
}

function heuristic(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

function reconstructPath(node: Node): { x: number; y: number }[] {
  const path: { x: number; y: number }[] = [];
  let n: Node | null = node;
  while (n) {
    path.unshift({ x: n.x * TILE_SIZE + TILE_SIZE / 2, y: n.y * TILE_SIZE + TILE_SIZE / 2 });
    n = n.parent;
  }
  return path;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
