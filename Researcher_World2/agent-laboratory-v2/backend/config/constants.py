# backend/config/constants.py
#
# Centralized tuning constants for the simulation backend.
# Import from here instead of hardcoding values across modules.

# =========================================================================
# Simulation
# =========================================================================
TICK_RATE = 30                          # Hz, simulation ticks per second
BROADCAST_INTERVAL = 10                 # steps between WebSocket broadcasts
MEMORY_CHECKPOINT_INTERVAL = 500        # steps between agent memory checkpoints

# =========================================================================
# Agent Cognitive Pipeline
# =========================================================================
COGNITIVE_STEP_INTERVAL_BASE = 10       # steps between cognitive cycles (no LLM)
COGNITIVE_STEP_INTERVAL_LLM = 100       # steps between cognitive cycles (LLM active)
VISION_RADIUS = 4                       # tiles, perception range
ATTENTION_BANDWIDTH = 3                 # max events perceivable at once
RETENTION_WINDOW = 5                    # novelty detection temporal window

# Memory retrieval weights
RECENCY_WEIGHT = 1.0
RELEVANCE_WEIGHT = 1.0
IMPORTANCE_WEIGHT = 1.0

# Reflection
IMPORTANCE_TRIGGER_MAX = 150            # max steps before forced reflection
DAILY_REFLECTION_SIZE = 5               # insights per reflection cycle

# =========================================================================
# Federated Learning
# =========================================================================
FL_STEPS_PER_PHASE = 50                 # steps per FL phase (training/sending/aggregating/receiving)
FL_AGGREGATION_ROUNDS = 5               # default number of FL rounds
FL_CLIENT_FRACTION = 0.8                # fraction of labs selected per round
FL_TRAINING_EPOCHS = 5                  # local training epochs per client
FL_LEARNING_RATE = 0.05                 # SGD learning rate
FL_BATCH_SIZE = 32                      # local training batch size
FL_SAMPLES_PER_CLIENT = 120             # synthetic data samples per lab

# FedProx
FEDPROX_MU_DEFAULT = 0.01               # default proximal term coefficient

# DP-SGD
DP_EPSILON_TOTAL = 20.0                 # total privacy budget
DP_MAX_GRAD_NORM = 1.0                  # gradient clipping threshold
DP_NOISE_MULTIPLIER = 0.5              # Gaussian noise scale

# =========================================================================
# Agent Behavior (FL task progress rates per step)
# =========================================================================
FL_PROGRESS_TRAIN = 0.1                 # base progress per step (x efficiency)
FL_PROGRESS_AGGREGATE = 0.15
FL_PROGRESS_SEND = 0.2
FL_PROGRESS_RECEIVE = 0.2

# =========================================================================
# Memory Temporal Decay (hours)
# =========================================================================
DECAY_BASE_HOURS_EVENT = 24              # routine events: ~1-2 sim days
DECAY_BASE_HOURS_THOUGHT = 72           # reflections: ~3-6 sim days
DECAY_BASE_HOURS_CHAT = 48              # conversations: ~2-4 sim days
MEMORY_DECAY_INTERVAL = 100             # steps between memory decay runs

# =========================================================================
# Parallel Cognitive Cycles
# =========================================================================
PARALLEL_MAX_WORKERS = 4                 # max threads for agent step parallelism

# =========================================================================
# Cross-lab FL Conversations
# =========================================================================
CROSS_LAB_CONVOS_PER_ROUND = 2           # max cross-lab conversations per FL round
CROSS_LAB_MEMORY_POIGNANCY = 8           # poignancy of cross-lab conversation memories

# =========================================================================
# LLM
# =========================================================================
LLM_MODEL = "qwen3.5:4b"
LLM_EMBEDDING_MODEL = "nomic-embed-text"
LLM_TEMPERATURE = 0.05
LLM_MAX_TOKENS = 150
LLM_CONTEXT_WINDOW = 512
LLM_CACHE_SIZE = 500
LLM_TIMEOUT = 60                        # seconds
