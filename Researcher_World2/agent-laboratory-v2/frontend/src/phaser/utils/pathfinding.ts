/**
 * Pathfinding utility for Agent Laboratory
 * Implements A* algorithm for agent navigation within lab environments
 */

import { Scene } from 'phaser';

/**
 * Represents a node in the pathfinding grid
 */
interface GridNode {
  x: number;
  y: number;
  f: number; // total cost (g + h)
  g: number; // cost from start to this node
  h: number; // heuristic (estimated cost from this node to goal)
  walkable: boolean;
  parent: GridNode | null;
}

/**
 * Represents a simple point in 2D space
 */
interface Point {
  x: number;
  y: number;
}

/**
 * Class that handles pathfinding operations for agents
 */
export class Pathfinder {
  private grid: GridNode[][];
  private gridWidth: number;
  private gridHeight: number;
  private tileSize: number;
  private scene: Scene;

  /**
   * Create a new pathfinder instance
   * 
   * @param scene - The Phaser scene this pathfinder operates in
   * @param tileSize - Size of each tile in pixels
   * @param collisionLayer - Tile layer used for collision detection
   */
  constructor(scene: Scene, gridWidth: number, gridHeight: number, tileSize: number = 16) {
    this.scene = scene;
    this.tileSize = tileSize;
    this.gridWidth = gridWidth;
    this.gridHeight = gridHeight;
    
    // Initialize the navigation grid
    this.grid = this.createGrid(gridWidth, gridHeight);
  }

  /**
   * Creates the initial navigation grid
   */
  private createGrid(width: number, height: number): GridNode[][] {
    const grid: GridNode[][] = [];
    
    for (let y = 0; y < height; y++) {
      grid[y] = [];
      for (let x = 0; x < width; x++) {
        grid[y][x] = {
          x,
          y,
          f: 0,
          g: 0,
          h: 0,
          walkable: true,
          parent: null
        };
      }
    }
    
    return grid;
  }

  /**
   * Updates the walkable status of a specific tile
   * 
   * @param x - X coordinate in the grid
   * @param y - Y coordinate in the grid
   * @param walkable - Whether the tile is walkable
   */
  public setWalkable(x: number, y: number, walkable: boolean): void {
    if (this.isWithinGrid(x, y)) {
      this.grid[y][x].walkable = walkable;
    }
  }

  /**
   * Updates the navigation grid based on a collision layer
   * 
   * @param collisionLayer - Tile layer containing collision information
   */
  public updateGridFromTilemap(collisionLayer: Phaser.Tilemaps.TilemapLayer): void {
    if (!collisionLayer) return;

    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        // Check if the tile at this position has collision
        const tile = collisionLayer.getTileAt(x, y);
        const isWalkable = !tile || !tile.collides;
        this.setWalkable(x, y, isWalkable);
      }
    }
  }

  /**
   * Checks if coordinates are within grid bounds
   */
  private isWithinGrid(x: number, y: number): boolean {
    return x >= 0 && x < this.gridWidth && y >= 0 && y < this.gridHeight;
  }

  /**
   * Calculates the Manhattan distance heuristic between two points
   */
  private heuristic(a: Point, b: Point): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  /**
   * Finds adjacent walkable nodes
   */
  private getNeighbors(node: GridNode): GridNode[] {
    const { x, y } = node;
    const neighbors: GridNode[] = [];
    const directions = [
      { x: 0, y: -1 }, // Up
      { x: 1, y: 0 },  // Right
      { x: 0, y: 1 },  // Down
      { x: -1, y: 0 }, // Left
      // Uncomment for diagonal movement
      // { x: 1, y: -1 }, // Top-right
      // { x: 1, y: 1 },  // Bottom-right
      // { x: -1, y: 1 }, // Bottom-left
      // { x: -1, y: -1 } // Top-left
    ];

    for (const dir of directions) {
      const newX = x + dir.x;
      const newY = y + dir.y;

      if (this.isWithinGrid(newX, newY) && this.grid[newY][newX].walkable) {
        neighbors.push(this.grid[newY][newX]);
      }
    }

    return neighbors;
  }

  /**
   * Finds the path between start and goal positions using A* algorithm
   * 
   * @param startX - Starting X position in grid coordinates
   * @param startY - Starting Y position in grid coordinates  
   * @param goalX - Goal X position in grid coordinates
   * @param goalY - Goal Y position in grid coordinates
   * @returns An array of points representing the path or null if no path found
   */
  public findPath(startX: number, startY: number, goalX: number, goalY: number): Point[] | null {
    // Validate input
    if (!this.isWithinGrid(startX, startY) || !this.isWithinGrid(goalX, goalY)) {
      return null;
    }

    if (!this.grid[startY][startX].walkable || !this.grid[goalY][goalX].walkable) {
      return null;
    }

    // Reset grid nodes
    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        const node = this.grid[y][x];
        node.f = 0;
        node.g = 0;
        node.h = 0;
        node.parent = null;
      }
    }

    const start = this.grid[startY][startX];
    const goal = this.grid[goalY][goalX];
    
    // Initialize open and closed lists
    const openList: GridNode[] = [];
    const closedList: Set<GridNode> = new Set();
    
    // Add start node to open list
    openList.push(start);
    
    // Loop until open list is empty
    while (openList.length > 0) {
      // Find node with lowest f cost
      let currentIndex = 0;
      for (let i = 1; i < openList.length; i++) {
        if (openList[i].f < openList[currentIndex].f) {
          currentIndex = i;
        }
      }
      
      const current = openList[currentIndex];
      
      // Check if we've reached the goal
      if (current.x === goal.x && current.y === goal.y) {
        return this.reconstructPath(current);
      }
      
      // Move current node from open to closed list
      openList.splice(currentIndex, 1);
      closedList.add(current);
      
      // Check all neighboring nodes
      const neighbors = this.getNeighbors(current);
      
      for (const neighbor of neighbors) {
        // Skip if neighbor is in closed list
        if (closedList.has(neighbor)) {
          continue;
        }
        
        // Calculate tentative g score
        const tentativeG = current.g + 1; // Assuming uniform cost of 1
        
        // Check if neighbor is not in open list or has a better g score
        const inOpenList = openList.includes(neighbor);
        if (!inOpenList || tentativeG < neighbor.g) {
          // Update neighbor's scores
          neighbor.parent = current;
          neighbor.g = tentativeG;
          neighbor.h = this.heuristic(neighbor, goal);
          neighbor.f = neighbor.g + neighbor.h;
          
          // Add to open list if not already there
          if (!inOpenList) {
            openList.push(neighbor);
          }
        }
      }
    }
    
    // No path found
    return null;
  }

  /**
   * Reconstructs the path by tracing parent nodes
   */
  private reconstructPath(endNode: GridNode): Point[] {
    const path: Point[] = [];
    let current: GridNode | null = endNode;
    
    while (current) {
      path.unshift({ x: current.x, y: current.y });
      current = current.parent;
    }
    
    return path;
  }

  /**
   * Converts grid coordinates to world coordinates
   */
  public gridToWorld(x: number, y: number): Point {
    return {
      x: x * this.tileSize + this.tileSize / 2,
      y: y * this.tileSize + this.tileSize / 2
    };
  }

  /**
   * Converts world coordinates to grid coordinates
   */
  public worldToGrid(x: number, y: number): Point {
    return {
      x: Math.floor(x / this.tileSize),
      y: Math.floor(y / this.tileSize)
    };
  }

  /**
   * Finds a path between world coordinates
   * 
   * @returns An array of world coordinate points or null if no path found
   */
  public findPathWorld(
    startWorldX: number,
    startWorldY: number,
    goalWorldX: number,
    goalWorldY: number
  ): Point[] | null {
    // Convert world coordinates to grid coordinates
    const startGrid = this.worldToGrid(startWorldX, startWorldY);
    const goalGrid = this.worldToGrid(goalWorldX, goalWorldY);
    
    // Find path in grid coordinates
    const gridPath = this.findPath(startGrid.x, startGrid.y, goalGrid.x, goalGrid.y);
    
    if (!gridPath) {
      return null;
    }
    
    // Convert path back to world coordinates
    return gridPath.map(point => this.gridToWorld(point.x, point.y));
  }

  /**
   * Adds temporary obstacle at a specific position
   * Useful for dynamic obstacles like other agents
   */
  public addTemporaryObstacle(worldX: number, worldY: number): void {
    const gridPos = this.worldToGrid(worldX, worldY);
    if (this.isWithinGrid(gridPos.x, gridPos.y)) {
      this.grid[gridPos.y][gridPos.x].walkable = false;
    }
  }

  /**
   * Removes temporary obstacle at a specific position
   */
  public removeTemporaryObstacle(worldX: number, worldY: number): void {
    const gridPos = this.worldToGrid(worldX, worldY);
    if (this.isWithinGrid(gridPos.x, gridPos.y)) {
      this.grid[gridPos.y][gridPos.x].walkable = true;
    }
  }

  /**
   * Debug method to visualize the navigation grid
   * Useful during development and testing
   */
  public debugDrawGrid(graphics: Phaser.GameObjects.Graphics): void {
    graphics.clear();

    // Draw walkable/non-walkable tiles
    for (let y = 0; y < this.gridHeight; y++) {
      for (let x = 0; x < this.gridWidth; x++) {
        const node = this.grid[y][x];
        const worldPos = this.gridToWorld(x, y);
        
        if (node.walkable) {
          graphics.fillStyle(0x00ff00, 0.2);  // Green for walkable
        } else {
          graphics.fillStyle(0xff0000, 0.4);  // Red for obstacles
        }
        
        graphics.fillRect(
          worldPos.x - this.tileSize / 2, 
          worldPos.y - this.tileSize / 2, 
          this.tileSize, 
          this.tileSize
        );
      }
    }
  }
}