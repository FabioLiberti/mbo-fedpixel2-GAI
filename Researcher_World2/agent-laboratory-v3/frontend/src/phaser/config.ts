// frontend/src/phaser/config.ts
//
// Centralized tuning constants for the Phaser frontend.
// Import from here instead of hardcoding values across modules.

// =========================================================================
// Agent Behavior
// =========================================================================

/** Seconds between autonomous decisions (min, max) */
export const AGENT_DECISION_INTERVAL = { min: 6, max: 14 } as const;

/** Seconds of WORKING state (min, max) */
export const AGENT_WORK_DURATION = { min: 8, max: 16 } as const;

/** Seconds of DISCUSSING/MEETING state (min, max) */
export const AGENT_INTERACTION_DURATION = { min: 14, max: 18 } as const;

/** Seconds idle before spontaneous thought (min, max) */
export const AGENT_THOUGHT_INTERVAL = { min: 12, max: 20 } as const;

/** Minimum seconds between interactions with same agent */
export const AGENT_INTERACTION_COOLDOWN = 15;

/** Pixels — radius to search for nearby agents */
export const AGENT_INTERACTION_RADIUS = 100;

/** Pixels — approach distance before speaking */
export const AGENT_APPROACH_DISTANCE = 50;

// =========================================================================
// Dialog System
// =========================================================================

/** Base duration for speech bubble (ms) */
export const BUBBLE_BASE_DURATION = 8000;

/** Additional ms per character of text */
export const BUBBLE_CHAR_DURATION = 50;

/** Maximum bubble duration (ms) */
export const BUBBLE_MAX_DURATION = 18000;

/** Delay between queued dialogs (ms) */
export const DIALOG_QUEUE_DELAY = 300;

/** Vertical offset for question bubble (px) */
export const BUBBLE_OFFSET_QUESTION = -40;

/** Vertical offset for response bubble (px) */
export const BUBBLE_OFFSET_RESPONSE = -80;

/** Max characters in a bubble */
export const BUBBLE_MAX_CHARS = 150;

// =========================================================================
// Fallback Dialog Probabilities (sum = 1.0)
// =========================================================================
export const DIALOG_PROBABILITY = {
  rolePair:   0.35,
  topical:    0.25,
  greeting:   0.10,
  coffeeBreak: 0.10,
  meetingRoom: 0.10,
  serverRoom: 0.10,
} as const;

// =========================================================================
// Pathfinding
// =========================================================================

/** Grid cell size in pixels */
export const GRID_CELL_SIZE = 32;

// =========================================================================
// Analytics
// =========================================================================

/** Max dialog records stored in localStorage */
export const ANALYTICS_MAX_RECORDS = 500;

/** localStorage key for dialog analytics */
export const ANALYTICS_STORAGE_KEY = 'dialog_analytics';

// =========================================================================
// Camera & Zoom
// =========================================================================

/** Default camera dimensions */
export const CAMERA_WIDTH = 800;
export const CAMERA_HEIGHT = 600;
