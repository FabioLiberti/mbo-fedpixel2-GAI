import React, { useEffect, useRef, useState } from 'react';
import './LLMDialogPanel.css';

interface DialogEntry {
  timestamp: string;
  agentName: string;
  agentRole: string;
  labId: string;
  dialog: string;
  isLlm: boolean;
  state: string;
  chattingWith: string | null;
}

interface LLMDialogPanelProps {
  backendSimData: any;
  selectedLab?: string;
  visible: boolean;
  onClose: () => void;
}

// Mappa lab_id backend → labType frontend
const LAB_DISPLAY: Record<string, string> = {
  mercatorum: 'Mercatorum',
  blekinge: 'Blekinge',
  opbg: 'OPBG',
};

// Mappa sceneKey → lab_id backend
const SCENE_TO_LAB: Record<string, string> = {
  MercatorumLabScene: 'mercatorum',
  BlekingeLabScene: 'blekinge',
  OPBGLabScene: 'opbg',
};

const ROLE_COLORS: Record<string, string> = {
  professor: '#e6b800',
  researcher: '#3498db',
  phd_student: '#2ecc71',
  doctor: '#e74c3c',
  student: '#9b59b6',
};

const LLMDialogPanel: React.FC<LLMDialogPanelProps> = ({
  backendSimData,
  selectedLab,
  visible,
  onClose,
}) => {
  const [dialogLog, setDialogLog] = useState<DialogEntry[]>([]);
  const [filterLlmOnly, setFilterLlmOnly] = useState<boolean>(false);
  const lastDialogsRef = useRef<Record<string, string>>({});
  const logEndRef = useRef<HTMLDivElement>(null);

  // Accumula dialoghi dal broadcast backend
  useEffect(() => {
    if (!backendSimData?.agent_states) return;

    const agents = backendSimData.agent_states as any[];
    const simTime = backendSimData.sim_time || new Date().toISOString();
    const newEntries: DialogEntry[] = [];

    for (const agent of agents) {
      const dialog = agent.dialog || '';
      const agentKey = agent.name || agent.id?.toString() || 'unknown';

      // Aggiungi solo se il dialogo è cambiato rispetto all'ultimo
      if (dialog && dialog !== 'idle' && dialog !== lastDialogsRef.current[agentKey]) {
        lastDialogsRef.current[agentKey] = dialog;
        newEntries.push({
          timestamp: simTime,
          agentName: agent.name || `Agent ${agent.id}`,
          agentRole: agent.role || 'unknown',
          labId: agent.lab_id || 'unknown',
          dialog,
          isLlm: agent.dialog_is_llm || false,
          state: agent.state || 'idle',
          chattingWith: agent.chatting_with || null,
        });
      }
    }

    if (newEntries.length > 0) {
      setDialogLog(prev => {
        const updated = [...prev, ...newEntries];
        // Mantieni max 500 entries
        return updated.length > 500 ? updated.slice(-500) : updated;
      });
    }
  }, [backendSimData]);

  // Auto-scroll verso il basso
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [dialogLog]);

  if (!visible) return null;

  // Filtra per lab se non siamo in worldmap
  const isWorldMap = !selectedLab || selectedLab === 'WorldMapScene';
  const labFilter = selectedLab ? SCENE_TO_LAB[selectedLab] : null;

  const filteredLog = dialogLog.filter(entry => {
    if (!isWorldMap && labFilter && entry.labId !== labFilter) return false;
    if (filterLlmOnly && !entry.isLlm) return false;
    return true;
  });

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '--:--';
    }
  };

  return (
    <div className="llm-dialog-panel">
      <div className="llm-dialog-header">
        <h3>LLM Dialoghi</h3>
        <div className="llm-dialog-controls">
          <label className="llm-filter-toggle" title="Mostra solo messaggi LLM">
            <input
              type="checkbox"
              checked={filterLlmOnly}
              onChange={(e) => setFilterLlmOnly(e.target.checked)}
            />
            Solo LLM
          </label>
          <span className="llm-dialog-count">{filteredLog.length}</span>
          <button className="llm-dialog-clear" onClick={() => {
            setDialogLog([]);
            lastDialogsRef.current = {};
          }} title="Cancella log">
            &#x1f5d1;
          </button>
          <button className="llm-dialog-close" onClick={onClose} title="Chiudi">&#x2715;</button>
        </div>
      </div>

      <div className="llm-dialog-context">
        {isWorldMap ? 'Tutte le scene' : `${LAB_DISPLAY[labFilter || ''] || selectedLab}`}
      </div>

      <div className="llm-dialog-log">
        {filteredLog.length === 0 ? (
          <p className="llm-dialog-empty">
            {dialogLog.length === 0
              ? 'Avvia la simulazione per vedere i dialoghi degli agenti'
              : 'Nessun dialogo per il filtro selezionato'}
          </p>
        ) : (
          filteredLog.map((entry, i) => (
            <div
              key={i}
              className={`llm-dialog-entry ${entry.isLlm ? 'llm-generated' : 'stub-generated'}`}
            >
              <div className="llm-dialog-meta">
                <span className="llm-dialog-time">{formatTime(entry.timestamp)}</span>
                <span
                  className="llm-dialog-agent"
                  style={{ color: ROLE_COLORS[entry.agentRole] || '#ccc' }}
                >
                  {entry.agentName}
                </span>
                <span className="llm-dialog-lab">{LAB_DISPLAY[entry.labId] || entry.labId}</span>
                {entry.isLlm && <span className="llm-badge">LLM</span>}
                {entry.chattingWith && (
                  <span className="llm-dialog-chat-with">con {entry.chattingWith}</span>
                )}
              </div>
              <div className="llm-dialog-text">{entry.dialog}</div>
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
};

export default LLMDialogPanel;
