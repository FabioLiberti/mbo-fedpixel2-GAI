"""
Test per Incremento 4: MazeAdapter
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from mesa.space import MultiGrid
from models.maze_adapter import MazeAdapter


def test_init():
    """Verifica creazione MazeAdapter da Mesa grid."""
    grid = MultiGrid(20, 20, True)
    maze = MazeAdapter(grid)
    assert maze.maze_width == 20
    assert maze.maze_height == 20
    assert len(maze.tiles) == 20
    assert len(maze.tiles[0]) == 20
    assert len(maze.address_tiles) > 0
    print(f"  Addresses: {len(maze.address_tiles)}")
    print("  [OK] Init")


def test_access_tile():
    """Verifica access_tile restituisce info corrette."""
    grid = MultiGrid(20, 20, True)
    maze = MazeAdapter(grid)

    # Tile in mercatorum workspace
    tile = maze.access_tile((2, 5))
    assert tile["world"] == "fl_research_center"
    assert tile["sector"] == "mercatorum"
    assert tile["arena"] == "workspace"
    assert tile["game_object"] != ""
    assert isinstance(tile["events"], set)
    print(f"  Tile (2,5): {tile['sector']}/{tile['arena']}/{tile['game_object']}")

    # Tile in blekinge
    tile = maze.access_tile((10, 5))
    assert tile["sector"] == "blekinge"
    print(f"  Tile (10,5): {tile['sector']}/{tile['arena']}")

    # Tile in opbg
    tile = maze.access_tile((16, 5))
    assert tile["sector"] == "opbg"
    print(f"  Tile (16,5): {tile['sector']}/{tile['arena']}")

    # Corridor tile
    tile = maze.access_tile((6, 5))
    assert tile["sector"] == "corridor"
    print(f"  Tile (6,5): {tile['sector']}/{tile['arena']}")

    # Out of bounds
    tile = maze.access_tile((25, 25))
    assert tile["collision"] == True

    print("  [OK] access_tile")


def test_get_tile_path():
    """Verifica get_tile_path a vari livelli."""
    grid = MultiGrid(20, 20, True)
    maze = MazeAdapter(grid)

    path = maze.get_tile_path((2, 5), "world")
    assert path == "fl_research_center"

    path = maze.get_tile_path((2, 5), "sector")
    assert "mercatorum" in path

    path = maze.get_tile_path((2, 5), "arena")
    assert "workspace" in path

    path = maze.get_tile_path((2, 5), "game_object")
    assert len(path.split(":")) == 4

    print(f"  Arena path: {maze.get_tile_path((2, 5), 'arena')}")
    print("  [OK] get_tile_path")


def test_get_nearby_tiles():
    """Verifica get_nearby_tiles."""
    grid = MultiGrid(20, 20, True)
    maze = MazeAdapter(grid)

    nearby = maze.get_nearby_tiles((10, 10), 2)
    assert len(nearby) == 25  # (2*2+1)^2
    assert (10, 10) in nearby
    assert (8, 8) in nearby
    assert (12, 12) in nearby

    # Edge case: corner
    nearby = maze.get_nearby_tiles((0, 0), 1)
    assert (0, 0) in nearby
    assert len(nearby) == 4  # Only tiles within bounds

    print(f"  Nearby (10,10) r=2: {len(nearby)} tiles")
    print("  [OK] get_nearby_tiles")


def test_events():
    """Verifica add/remove events."""
    grid = MultiGrid(20, 20, True)
    maze = MazeAdapter(grid)

    tile = (5, 5)
    event = ("Alice", "is", "working", None)

    # Add event
    maze.add_event_from_tile(event, tile)
    assert event in maze.access_tile(tile)["events"]

    # Remove event
    maze.remove_event_from_tile(event, tile)
    assert event not in maze.access_tile(tile)["events"]

    # Add and turn idle
    maze.add_event_from_tile(event, tile)
    maze.turn_event_from_tile_idle(event, tile)
    events = maze.access_tile(tile)["events"]
    assert event not in events
    assert ("Alice", None, None, None) in events

    # Remove by subject
    maze.remove_subject_events_from_tile("Alice", tile)
    assert len(maze.access_tile(tile)["events"]) == 0

    print("  [OK] Event management")


def test_address_tiles():
    """Verifica address_tiles mapping."""
    grid = MultiGrid(20, 20, True)
    maze = MazeAdapter(grid)

    # Sector level
    addr = "fl_research_center:mercatorum"
    assert addr in maze.address_tiles
    tiles = maze.address_tiles[addr]
    assert len(tiles) > 0
    # All tiles should be in mercatorum bounds
    for x, y in tiles:
        assert 0 <= x <= 5

    # Arena level
    addr = "fl_research_center:blekinge:workspace"
    assert addr in maze.address_tiles
    tiles = maze.address_tiles[addr]
    assert len(tiles) > 0
    for x, y in tiles:
        assert 7 <= x <= 12
        assert 0 <= y <= 9

    print(f"  Mercatorum tiles: {len(maze.address_tiles['fl_research_center:mercatorum'])}")
    print(f"  Blekinge workspace tiles: {len(tiles)}")
    print("  [OK] address_tiles")


def test_lab_spawn_tiles():
    """Verifica utility per spawn tiles."""
    grid = MultiGrid(20, 20, True)
    maze = MazeAdapter(grid)

    for lab in ["mercatorum", "blekinge", "opbg"]:
        spawn = maze.get_lab_spawn_tiles(lab)
        assert len(spawn) > 0
        print(f"  {lab} spawn tiles: {len(spawn)}")

    print("  [OK] Lab spawn tiles")


def test_collision_maze():
    """Verifica collision maze (tutto aperto per layout lab)."""
    grid = MultiGrid(20, 20, True)
    maze = MazeAdapter(grid)

    assert len(maze.collision_maze) == 20
    assert len(maze.collision_maze[0]) == 20
    # All passable
    for row in maze.collision_maze:
        for cell in row:
            assert cell == "0"

    print("  [OK] Collision maze")


if __name__ == "__main__":
    tests = [
        ("Init", test_init),
        ("Access Tile", test_access_tile),
        ("Tile Path", test_get_tile_path),
        ("Nearby Tiles", test_get_nearby_tiles),
        ("Events", test_events),
        ("Address Tiles", test_address_tiles),
        ("Lab Spawn Tiles", test_lab_spawn_tiles),
        ("Collision Maze", test_collision_maze),
    ]

    passed = 0
    failed = 0
    for name, test_fn in tests:
        print(f"\n--- {name} ---")
        try:
            test_fn()
            passed += 1
        except Exception as e:
            import traceback
            print(f"  [FAIL] {e}")
            traceback.print_exc()
            failed += 1

    print(f"\n{'='*40}")
    print(f"Results: {passed} passed, {failed} failed out of {len(tests)}")
    if failed == 0:
        print("ALL TESTS PASSED")
    else:
        print("SOME TESTS FAILED")
        sys.exit(1)
