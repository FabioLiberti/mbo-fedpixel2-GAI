/**
 * Typed WebSocket message interfaces for backend ↔ frontend communication.
 */

// --- Inbound messages (backend → frontend) ---

export interface SimulationUpdateMessage {
  type: 'simulation_update';
  data: SimulationUpdateData;
}

export interface SimulationUpdateData {
  step: number;
  sim_time: string | null;
  agent_count: number;
  agent_states: AgentStateData[];
  simulation: {
    running: boolean;
    paused: boolean;
    speed: number;
  };
  fl?: FLUpdateData;
}

export interface AgentStateData {
  unique_id: number;
  name: string;
  role: string;
  lab_id: string;
  state: string;
  pos: [number, number];
  last_dialog: string;
  dialog_is_llm: boolean;
  fl_task: string | null;
  fl_progress: number;
  fl_role: string | null;
  specialization: string;
  act_description: string;
}

export interface FLUpdateData {
  enabled: boolean;
  round_in_progress: boolean;
  current_phase: string | null;
  step_counter: number;
  steps_per_round: number;
  round: number;
  metrics: FLMetrics;
}

export interface FLMetrics {
  accuracy: number | number[];
  loss: number | number[];
  communication_overhead?: number;
  privacy_budget?: number;
}

export interface SimulationStatusMessage {
  type: 'simulationStatus';
  status: 'running' | 'paused' | 'stopped';
  flProgress?: number;
  agentCount?: number;
}

// --- Outbound messages (frontend → backend) ---

export interface SimulationCommandMessage {
  type: 'simulation_command';
  command: 'start' | 'stop' | 'pause' | 'resume' | 'reset' | 'set_speed' | 'enable_fl' | 'toggle_llm' | 'get_agent';
  [key: string]: unknown;
}

// --- Union type for all inbound messages ---

export type InboundWSMessage = SimulationUpdateMessage | SimulationStatusMessage;
