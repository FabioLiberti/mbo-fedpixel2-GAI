"""
Spatial Memory (MemoryTree) for generative agents.
Ported from Park et al. (UIST 2023).

Stores hierarchical world knowledge:
  world -> sector (lab) -> arena (room) -> game_objects (equipment)

Example for FL research context:
  "FL Research Ecosystem" -> "Mercatorum Lab" -> "Server Room" -> ["GPU Cluster", "Switch"]
"""
import json
import os

from cognitive import check_if_file_exists


class MemoryTree:
    def __init__(self, f_saved=None):
        self.tree = {}
        if f_saved and check_if_file_exists(f_saved):
            with open(f_saved) as f:
                self.tree = json.load(f)

    def print_tree(self):
        def _print_tree(tree, depth):
            dash = " >" * depth
            if isinstance(tree, list):
                if tree:
                    print(dash, tree)
                return
            for key, val in tree.items():
                if key:
                    print(dash, key)
                _print_tree(val, depth + 1)
        _print_tree(self.tree, 0)

    def save(self, out_json):
        with open(out_json, "w") as outfile:
            json.dump(self.tree, outfile, indent=2)

    def get_str_accessible_sectors(self, curr_world):
        """Returns comma-separated string of sectors accessible in curr_world."""
        if curr_world not in self.tree:
            return ""
        return ", ".join(list(self.tree[curr_world].keys()))

    def get_str_accessible_sector_arenas(self, sector):
        """
        Returns comma-separated string of arenas in a sector.
        Input sector format: "world:sector"
        """
        curr_world, curr_sector = sector.split(":")
        if not curr_sector:
            return ""
        try:
            return ", ".join(list(self.tree[curr_world][curr_sector].keys()))
        except KeyError:
            return ""

    def get_str_accessible_arena_game_objects(self, arena):
        """
        Returns comma-separated string of game objects in an arena.
        Input arena format: "world:sector:arena"
        """
        curr_world, curr_sector, curr_arena = arena.split(":")
        if not curr_arena:
            return ""
        try:
            return ", ".join(list(self.tree[curr_world][curr_sector][curr_arena]))
        except KeyError:
            try:
                return ", ".join(list(self.tree[curr_world][curr_sector][curr_arena.lower()]))
            except KeyError:
                return ""
