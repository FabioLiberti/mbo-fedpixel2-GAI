/**
 * AgentInspectorPanel: displays cognitive + FL state for a selected agent.
 * Shown when user clicks on an agent in the Phaser scene.
 */
import React from 'react';
import { CognitiveAgentState } from '../phaser/types/AgentTypes';

interface AgentInspectorPanelProps {
  agent: CognitiveAgentState | null;
  onClose: () => void;
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 320,
    maxHeight: '80vh',
    overflowY: 'auto',
    backgroundColor: 'rgba(20, 20, 30, 0.95)',
    border: '1px solid rgba(100, 140, 255, 0.3)',
    borderRadius: 8,
    padding: 16,
    color: '#e0e0e0',
    fontFamily: 'monospace',
    fontSize: 12,
    zIndex: 1000,
    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottom: '1px solid rgba(100, 140, 255, 0.2)',
    paddingBottom: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#88bbff',
  },
  closeBtn: {
    background: 'none',
    border: '1px solid rgba(255,255,255,0.3)',
    color: '#aaa',
    cursor: 'pointer',
    borderRadius: 4,
    padding: '2px 8px',
    fontSize: 12,
  },
  section: {
    marginBottom: 10,
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#6699cc',
    textTransform: 'uppercase' as const,
    marginBottom: 4,
    letterSpacing: 1,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  label: {
    color: '#888',
  },
  value: {
    color: '#ccc',
    textAlign: 'right' as const,
    maxWidth: 180,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap' as const,
  },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    marginTop: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    transition: 'width 0.3s ease',
  },
  pronunciatio: {
    fontSize: 24,
    textAlign: 'center' as const,
    marginBottom: 8,
  },
  dialog: {
    fontSize: 11,
    color: '#aabbcc',
    fontStyle: 'italic',
    padding: 6,
    backgroundColor: 'rgba(100,140,255,0.1)',
    borderRadius: 4,
    borderLeft: '2px solid rgba(100,140,255,0.4)',
  },
};

const Row: React.FC<{ label: string; value: string | number | null }> = ({ label, value }) => (
  <div style={styles.row}>
    <span style={styles.label}>{label}</span>
    <span style={styles.value}>{value ?? '-'}</span>
  </div>
);

const AgentInspectorPanel: React.FC<AgentInspectorPanelProps> = ({ agent, onClose }) => {
  if (!agent) return null;

  const flProgressPct = Math.round(agent.fl_progress * 100);

  return (
    <div style={styles.overlay}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.name}>
          {agent.act_pronunciatio || ''} {agent.name}
        </span>
        <button style={styles.closeBtn} onClick={onClose}>X</button>
      </div>

      {/* Identity */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Identity</div>
        <Row label="Role" value={agent.role} />
        <Row label="Lab" value={agent.lab_id} />
        <Row label="State" value={agent.state} />
        {agent.position && (
          <Row label="Position" value={`(${agent.position[0]}, ${agent.position[1]})`} />
        )}
      </div>

      {/* Cognitive State */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Cognitive State</div>
        <Row label="Action" value={agent.act_description} />
        <Row label="Location" value={agent.act_address} />
        <Row label="Schedule" value={agent.current_schedule_task} />
        <Row label="Chatting with" value={agent.chatting_with} />
        <Row label="Memories" value={agent.memory_event_count} />
        <Row label="Reflections" value={agent.reflection_count} />
      </div>

      {/* Dialog */}
      {agent.dialog && agent.dialog !== 'idle' && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            Thought {agent.dialog_is_llm ? '(LLM)' : ''}
          </div>
          <div style={styles.dialog}>"{agent.dialog}"</div>
        </div>
      )}

      {/* FL State */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Federated Learning</div>
        <Row label="FL Role" value={agent.fl_role} />
        <Row label="Specialization" value={agent.fl_specialization} />
        <Row label="Contributing" value={agent.fl_contributing ? 'Yes' : 'No'} />
        {agent.fl_task && (
          <>
            <Row label="Task" value={agent.fl_task} />
            <Row label="Progress" value={`${flProgressPct}%`} />
            <div style={styles.progressBar}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${flProgressPct}%`,
                  backgroundColor: flProgressPct >= 100 ? '#4caf50' : '#2196f3',
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AgentInspectorPanel;
