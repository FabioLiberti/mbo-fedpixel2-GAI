"""
Cognitive module for Federated Generative Agents.
Ported from Park et al. (UIST 2023) Generative Agents architecture,
adapted for federated learning research simulation context.

Sub-modules:
  - memory/: spatial_memory, associative_memory, scratch
  - prompts/: gpt_structure (LLM wrapper), run_gpt_prompt (prompt functions)
  - perceive, retrieve, plan, reflect, execute, converse
  - path_finder: A*/BFS pathfinding
"""
import os
import csv
import shutil
import errno

# Debug flag (replaces GA's utils.debug)
debug = False


def check_if_file_exists(curr_file):
    """Check if a file exists at the given path."""
    try:
        with open(curr_file):
            pass
        return True
    except:
        return False


def create_folder_if_not_there(curr_path):
    """Create folder if it doesn't exist. Works for both file and folder paths."""
    outfolder_name = curr_path.split("/")
    if len(outfolder_name) != 1:
        if "." in outfolder_name[-1]:
            outfolder_name = outfolder_name[:-1]
        outfolder_name = "/".join(outfolder_name)
        if not os.path.exists(outfolder_name):
            os.makedirs(outfolder_name)
            return True
    return False


def copyanything(src, dst):
    """Copy everything from src folder to dst folder."""
    try:
        if os.path.exists(dst):
            shutil.rmtree(dst)
        shutil.copytree(src, dst)
    except OSError as exc:
        if exc.errno in (errno.ENOTDIR, errno.EINVAL):
            shutil.copy(src, dst)
        else:
            raise
