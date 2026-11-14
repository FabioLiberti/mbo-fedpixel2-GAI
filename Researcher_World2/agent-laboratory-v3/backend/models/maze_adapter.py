"""
MazeAdapter: wraps Mesa MultiGrid as a GA-compatible Maze.

Exposes the same interface as GA's Maze class (access_tile, get_nearby_tiles,
get_tile_path, collision_maze, address_tiles) while using Mesa's grid underneath.

Spatial topology:
  World: "fl_research_center"
  Sectors: one per lab (mercatorum, blekinge, opbg)
  Arenas: rooms per lab (workspace, meeting_room, break_room, server_room)
  Game objects: desk, whiteboard, server, coffee_machine, etc.
"""
import logging
from typing import Dict, List, Set, Tuple, Optional, Any

logger = logging.getLogger(__name__)

# Default spatial layout for a 20x20 grid with 3 labs
DEFAULT_LAYOUT = {
    "world": "fl_research_center",
    "labs": {
        "mercatorum": {
            "name": "Mercatorum Lab",
            "bounds": {"x_min": 0, "x_max": 5, "y_min": 0, "y_max": 19},
            "arenas": {
                "workspace":    {"x_min": 0, "x_max": 5, "y_min": 0,  "y_max": 9},
                "meeting_room": {"x_min": 0, "x_max": 5, "y_min": 10, "y_max": 14},
                "break_room":   {"x_min": 0, "x_max": 2, "y_min": 15, "y_max": 19},
                "server_room":  {"x_min": 3, "x_max": 5, "y_min": 15, "y_max": 19},
            },
        },
        "blekinge": {
            "name": "Blekinge Lab",
            "bounds": {"x_min": 7, "x_max": 12, "y_min": 0, "y_max": 19},
            "arenas": {
                "workspace":    {"x_min": 7,  "x_max": 12, "y_min": 0,  "y_max": 9},
                "meeting_room": {"x_min": 7,  "x_max": 12, "y_min": 10, "y_max": 14},
                "break_room":   {"x_min": 7,  "x_max": 9,  "y_min": 15, "y_max": 19},
                "server_room":  {"x_min": 10, "x_max": 12, "y_min": 15, "y_max": 19},
            },
        },
        "opbg": {
            "name": "OPBG Lab",
            "bounds": {"x_min": 14, "x_max": 19, "y_min": 0, "y_max": 19},
            "arenas": {
                "workspace":    {"x_min": 14, "x_max": 19, "y_min": 0,  "y_max": 9},
                "meeting_room": {"x_min": 14, "x_max": 19, "y_min": 10, "y_max": 14},
                "break_room":   {"x_min": 14, "x_max": 16, "y_min": 15, "y_max": 19},
                "server_room":  {"x_min": 17, "x_max": 19, "y_min": 15, "y_max": 19},
            },
        },
    },
    # Corridors: x=6, x=13 are corridors (not part of any lab)
    "corridor_columns": [6, 13],
    # Game objects placed within arenas
    "game_objects": {
        "workspace": ["desk_1", "desk_2", "desk_3", "whiteboard", "bookshelf"],
        "meeting_room": ["conference_table", "projector", "whiteboard"],
        "break_room": ["coffee_machine", "table", "couch"],
        "server_room": ["server_rack", "monitor_station", "cooling_unit"],
    },
}


class MazeAdapter:
    """
    Adapter that wraps Mesa MultiGrid to expose GA Maze interface.

    Key attributes matching GA Maze:
        collision_maze: 2D matrix of collision IDs
        tiles: 2D matrix of tile info dicts
        address_tiles: dict mapping addresses to sets of (x,y)
    """

    def __init__(self, mesa_grid, layout=None):
        """
        Args:
            mesa_grid: Mesa MultiGrid instance
            layout: Optional spatial layout dict. Uses DEFAULT_LAYOUT if None.
        """
        self.grid = mesa_grid
        self.maze_width = mesa_grid.width
        self.maze_height = mesa_grid.height
        self.layout = layout or DEFAULT_LAYOUT
        self.world_name = self.layout["world"]

        # Build tile info matrix (GA-compatible)
        self.tiles = self._build_tiles()

        # Build collision maze (corridors are passable, everything is open)
        self.collision_maze = self._build_collision_maze()

        # Build address -> tile coordinate mapping
        self.address_tiles = self._build_address_tiles()

        logger.info(f"MazeAdapter initialized: {self.maze_width}x{self.maze_height}, "
                     f"{len(self.address_tiles)} addresses")

    def _build_tiles(self):
        """Build 2D matrix of tile info dicts."""
        tiles = []
        for y in range(self.maze_height):
            row = []
            for x in range(self.maze_width):
                tile_info = self._classify_tile(x, y)
                row.append(tile_info)
            tiles.append(row)
        return tiles

    def _classify_tile(self, x, y):
        """Determine world/sector/arena/object for a tile coordinate."""
        info = {
            "world": self.world_name,
            "sector": "",
            "arena": "",
            "game_object": "",
            "spawning_location": "",
            "collision": False,
            "events": set(),
        }

        # Check which lab this tile belongs to
        for lab_id, lab_cfg in self.layout["labs"].items():
            bounds = lab_cfg["bounds"]
            if (bounds["x_min"] <= x <= bounds["x_max"] and
                    bounds["y_min"] <= y <= bounds["y_max"]):
                info["sector"] = lab_id
                # Check which arena
                for arena_name, arena_bounds in lab_cfg["arenas"].items():
                    if (arena_bounds["x_min"] <= x <= arena_bounds["x_max"] and
                            arena_bounds["y_min"] <= y <= arena_bounds["y_max"]):
                        info["arena"] = arena_name
                        # Assign game object based on position within arena
                        objects = self.layout.get("game_objects", {}).get(arena_name, [])
                        if objects:
                            # Distribute objects across arena tiles
                            obj_idx = (x + y) % len(objects)
                            info["game_object"] = objects[obj_idx]
                        break
                break

        # Corridor tiles
        if x in self.layout.get("corridor_columns", []):
            info["sector"] = "corridor"
            info["arena"] = "hallway"

        return info

    def _build_collision_maze(self):
        """Build collision maze. All tiles are passable (open lab layout)."""
        collision_id = "32125"
        maze = []
        for y in range(self.maze_height):
            row = []
            for x in range(self.maze_width):
                # No collisions in our open lab layout
                row.append("0")
            maze.append(row)
        return maze

    def _build_address_tiles(self):
        """Build reverse lookup: address string -> set of (x,y) coordinates."""
        address_tiles = {}
        for y in range(self.maze_height):
            for x in range(self.maze_width):
                tile = self.tiles[y][x]
                w = tile["world"]
                s = tile["sector"]
                a = tile["arena"]
                g = tile["game_object"]

                if not s:
                    continue

                # World:Sector level
                addr_ws = f"{w}:{s}"
                address_tiles.setdefault(addr_ws, set()).add((x, y))

                # World:Sector:Arena level
                if a:
                    addr_wsa = f"{w}:{s}:{a}"
                    address_tiles.setdefault(addr_wsa, set()).add((x, y))

                    # World:Sector:Arena:Object level
                    if g:
                        addr_wsag = f"{w}:{s}:{a}:{g}"
                        address_tiles.setdefault(addr_wsag, set()).add((x, y))

        return address_tiles

    # ========================================================================
    # GA Maze Interface
    # ========================================================================

    def access_tile(self, tile):
        """
        Get tile info dict for a coordinate.

        Args:
            tile: (x, y) tuple or list
        Returns:
            dict with world, sector, arena, game_object, events, collision
        """
        x, y = int(tile[0]), int(tile[1])
        if 0 <= x < self.maze_width and 0 <= y < self.maze_height:
            return self.tiles[y][x]
        return {
            "world": self.world_name,
            "sector": "",
            "arena": "",
            "game_object": "",
            "spawning_location": "",
            "collision": True,
            "events": set(),
        }

    def get_tile_path(self, tile, level):
        """
        Get address string for a tile at a given level.

        Args:
            tile: (x, y) coordinate
            level: "world", "sector", "arena", or "game_object"
        Returns:
            Address string like "fl_research_center:mercatorum:workspace"
        """
        info = self.access_tile(tile)
        if level == "world":
            return info["world"]
        elif level == "sector":
            return f"{info['world']}:{info['sector']}"
        elif level == "arena":
            return f"{info['world']}:{info['sector']}:{info['arena']}"
        elif level == "game_object":
            return f"{info['world']}:{info['sector']}:{info['arena']}:{info['game_object']}"
        return info["world"]

    def get_nearby_tiles(self, tile, vision_r):
        """
        Get all tiles within a square radius.

        Args:
            tile: (x, y) center coordinate
            vision_r: radius in tiles
        Returns:
            List of (x, y) tuples within bounds
        """
        x, y = tile
        nearby = []
        for dx in range(-vision_r, vision_r + 1):
            for dy in range(-vision_r, vision_r + 1):
                nx, ny = x + dx, y + dy
                if 0 <= nx < self.maze_width and 0 <= ny < self.maze_height:
                    nearby.append((nx, ny))
        return nearby

    def add_event_from_tile(self, curr_event, tile):
        """Add an event to a tile's event set."""
        x, y = int(tile[0]), int(tile[1])
        if 0 <= x < self.maze_width and 0 <= y < self.maze_height:
            self.tiles[y][x]["events"].add(curr_event)

    def remove_event_from_tile(self, curr_event, tile):
        """Remove an event from a tile's event set."""
        x, y = int(tile[0]), int(tile[1])
        if 0 <= x < self.maze_width and 0 <= y < self.maze_height:
            self.tiles[y][x]["events"].discard(curr_event)

    def remove_subject_events_from_tile(self, subject, tile):
        """Remove all events with a given subject from a tile."""
        x, y = int(tile[0]), int(tile[1])
        if 0 <= x < self.maze_width and 0 <= y < self.maze_height:
            to_remove = {e for e in self.tiles[y][x]["events"] if e[0] == subject}
            self.tiles[y][x]["events"] -= to_remove

    def turn_event_from_tile_idle(self, curr_event, tile):
        """Replace event with idle version."""
        self.remove_event_from_tile(curr_event, tile)
        idle_event = (curr_event[0], None, None, None)
        self.add_event_from_tile(idle_event, tile)

    # ========================================================================
    # Utility Methods
    # ========================================================================

    def get_lab_spawn_tiles(self, lab_id):
        """Get workspace tiles for a lab (used for spawning agents)."""
        addr = f"{self.world_name}:{lab_id}:workspace"
        return list(self.address_tiles.get(addr, set()))

    def get_lab_for_tile(self, tile):
        """Get lab ID for a tile coordinate."""
        info = self.access_tile(tile)
        sector = info.get("sector", "")
        if sector in self.layout["labs"]:
            return sector
        return None
