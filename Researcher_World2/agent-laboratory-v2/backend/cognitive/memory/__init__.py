"""
Memory structures for generative agents.
Three-level memory architecture:
  - SpatialMemory (MemoryTree): hierarchical world knowledge
  - AssociativeMemory: long-term memory stream with ConceptNodes
  - Scratch: short-term working memory
"""
from .spatial_memory import MemoryTree
from .associative_memory import AssociativeMemory, ConceptNode
from .scratch import Scratch
