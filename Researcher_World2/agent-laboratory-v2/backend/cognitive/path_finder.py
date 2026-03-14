"""
Path finding for generative agents.
Ported from Park et al. (UIST 2023), cleaned up.
"""
import numpy as np

# Default collision block identifier (matches GA's utils.py)
COLLISION_BLOCK_ID = "32125"


def path_finder(maze, start, end, collision_block_char=None, verbose=False):
    """
    Find shortest path from start to end in a collision maze.
    Uses BFS (wave propagation) for optimal paths.

    Args:
        maze: 2D list representing the maze
        start: (x, y) tuple for start position
        end: (x, y) tuple for end position
        collision_block_char: Character/ID that represents walls
    Returns:
        List of (x, y) coordinate tuples forming the path
    """
    if collision_block_char is None:
        collision_block_char = COLLISION_BLOCK_ID

    if start == end:
        return [start]

    # GA swaps coordinates (emergency patch from original)
    start = (start[1], start[0])
    end = (end[1], end[0])

    path = _path_finder_bfs(maze, start, end, collision_block_char)

    # Swap back
    return [(i[1], i[0]) for i in path]


def _path_finder_bfs(a, start, end, collision_block_char):
    """BFS-based pathfinding (GA's path_finder_v2)."""
    def make_step(m, k):
        for i in range(len(m)):
            for j in range(len(m[i])):
                if m[i][j] == k:
                    if i > 0 and m[i-1][j] == 0 and a[i-1][j] == 0:
                        m[i-1][j] = k + 1
                    if j > 0 and m[i][j-1] == 0 and a[i][j-1] == 0:
                        m[i][j-1] = k + 1
                    if i < len(m)-1 and m[i+1][j] == 0 and a[i+1][j] == 0:
                        m[i+1][j] = k + 1
                    if j < len(m[i])-1 and m[i][j+1] == 0 and a[i][j+1] == 0:
                        m[i][j+1] = k + 1

    # Convert maze to binary (1 = wall, 0 = passable)
    new_maze = []
    for row in a:
        new_row = []
        for j in row:
            new_row.append(1 if j == collision_block_char else 0)
        new_maze.append(new_row)
    a = new_maze

    # Initialize distance matrix
    m = [[0] * len(row) for row in a]
    i, j = start
    m[i][j] = 1

    # Wave propagation
    k = 0
    max_iter = 150
    while m[end[0]][end[1]] == 0:
        k += 1
        make_step(m, k)
        max_iter -= 1
        if max_iter == 0:
            break

    # Trace back path
    i, j = end
    k = m[i][j]
    the_path = [(i, j)]
    while k > 1:
        if i > 0 and m[i-1][j] == k - 1:
            i, j = i - 1, j
            the_path.append((i, j))
            k -= 1
        elif j > 0 and m[i][j-1] == k - 1:
            i, j = i, j - 1
            the_path.append((i, j))
            k -= 1
        elif i < len(m) - 1 and m[i+1][j] == k - 1:
            i, j = i + 1, j
            the_path.append((i, j))
            k -= 1
        elif j < len(m[i]) - 1 and m[i][j+1] == k - 1:
            i, j = i, j + 1
            the_path.append((i, j))
            k -= 1
        else:
            break

    the_path.reverse()
    return the_path


def closest_coordinate(curr_coordinate, target_coordinates):
    """Find the closest coordinate from a list of target coordinates."""
    min_dist = None
    closest = None
    for coordinate in target_coordinates:
        a = np.array(coordinate)
        b = np.array(curr_coordinate)
        dist = abs(np.linalg.norm(a - b))
        if closest is None or min_dist > dist:
            min_dist = dist
            closest = coordinate
    return closest
