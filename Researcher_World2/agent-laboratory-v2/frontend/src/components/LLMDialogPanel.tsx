import React, { useEffect, useRef, useState, useCallback } from 'react';
import './LLMDialogPanel.css';
import { addPhaserDialogListener, PhaserDialogDetail } from '../utils/customEvents';

interface DialogEntry {
  timestamp: string;
  agentName: string;
  agentRole: string;
  labId: string;
  dialog: string;
  isLlm: boolean;
  source: 'backend' | 'phaser' | 'fl-convo';
  cognitiveType?: string;
  state: string;
  chattingWith: string | null;
  flRound?: number;
}

interface LLMDialogPanelProps {
  backendSimData: any;
  selectedLab?: string;
  visible: boolean;
  onClose: () => void;
}

const LAB_DISPLAY: Record<string, string> = {
  mercatorum: 'Mercatorum',
  blekinge: 'Blekinge',
  opbg: 'OPBG',
};

const SCENE_TO_LAB: Record<string, string> = {
  MercatorumLabScene: 'mercatorum',
  BlekingeLabScene: 'blekinge',
  OPBGLabScene: 'opbg',
};

const ROLE_COLORS: Record<string, string> = {
  professor: '#e6b800',
  researcher: '#3498db',
  student_postdoc: '#2ecc71',
  doctor: '#e74c3c',
  student: '#9b59b6',
};

const COGNITIVE_LABELS: Record<string, string> = {
  thinking: 'pensiero',
  decision: 'decisione',
  planning: 'piano',
  dialog: 'dialogo',
};

const LLMDialogPanel: React.FC<LLMDialogPanelProps> = ({
  backendSimData,
  selectedLab,
  visible,
  onClose,
}) => {
  const [dialogLog, setDialogLog] = useState<DialogEntry[]>([]);
  const [filterLlmOnly, setFilterLlmOnly] = useState<boolean>(false);
  const [collapsed, setCollapsed] = useState<boolean>(true);
  const lastDialogsRef = useRef<Record<string, string>>({});
  const recentTextsRef = useRef<{ text: string; ts: number }[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  const DEDUP_WINDOW_MS = 60_000; // skip identical text within 60s

  /** Normalize text for dedup comparison */
  const normalize = (t: string) => t.trim().toLowerCase().replace(/\s+/g, ' ');

  /** Returns true if this text already appeared recently (global, cross-agent) */
  const isDuplicate = useCallback((text: string): boolean => {
    const now = Date.now();
    const norm = normalize(text);
    // Prune old entries
    recentTextsRef.current = recentTextsRef.current.filter(e => now - e.ts < DEDUP_WINDOW_MS);
    // Check
    if (recentTextsRef.current.some(e => e.text === norm)) return true;
    // Register
    recentTextsRef.current.push({ text: norm, ts: now });
    return false;
  }, []);

  // Append helper (deduplicates and caps at 500)
  const appendEntries = useCallback((entries: DialogEntry[]) => {
    if (entries.length === 0) return;
    // Filter out global duplicates (same text within 60s window)
    const unique = entries.filter(e => !isDuplicate(e.dialog));
    if (unique.length === 0) return;
    setDialogLog(prev => {
      const updated = [...prev, ...unique];
      return updated.length > 500 ? updated.slice(-500) : updated;
    });
  }, [isDuplicate]);

  // 1) Backend broadcast dialogs
  useEffect(() => {
    if (!backendSimData?.agent_states) return;

    const agents = backendSimData.agent_states as any[];
    const simTime = backendSimData.sim_time || new Date().toISOString();
    const newEntries: DialogEntry[] = [];

    for (const agent of agents) {
      const dialog = agent.dialog || '';
      const agentKey = agent.name || agent.id?.toString() || 'unknown';

      if (dialog && dialog !== 'idle' && dialog !== lastDialogsRef.current[agentKey]) {
        lastDialogsRef.current[agentKey] = dialog;
        newEntries.push({
          timestamp: simTime,
          agentName: agent.name || `Agent ${agent.id}`,
          agentRole: agent.role || 'unknown',
          labId: agent.lab_id || 'unknown',
          dialog,
          isLlm: agent.dialog_is_llm || false,
          source: 'backend',
          state: agent.state || 'idle',
          chattingWith: agent.chatting_with || null,
        });
      }
    }

    appendEntries(newEntries);
  }, [backendSimData, appendEntries]);

  // 2) Phaser-side LLM dialogs (via DOM CustomEvent bridge)
  useEffect(() => {
    const cleanup = addPhaserDialogListener((detail: PhaserDialogDetail) => {
      const entry: DialogEntry = {
        timestamp: new Date().toISOString(),
        agentName: detail.agentName,
        agentRole: detail.agentRole,
        labId: detail.labId,
        dialog: detail.text,
        isLlm: detail.isLlm,
        source: 'phaser',
        cognitiveType: detail.cognitiveType,
        state: 'active',
        chattingWith: null,
      };
      appendEntries([entry]);
    });
    return cleanup;
  }, [appendEntries]);

  // 3) FL post-round conversations (from backend fl.conversations)
  const lastFlRoundRef = useRef<number>(-1);
  useEffect(() => {
    const convos = backendSimData?.fl?.conversations;
    if (!Array.isArray(convos) || convos.length === 0) return;

    const latest = convos[convos.length - 1];
    if (!latest || latest.round === lastFlRoundRef.current) return;
    lastFlRoundRef.current = latest.round;

    const simTime = backendSimData.sim_time || new Date().toISOString();
    const newEntries: DialogEntry[] = [];

    // Process all conversations from this round
    for (const convo of convos.filter((c: any) => c.round === latest.round)) {
      const dialog = convo.dialog as [string, string][];
      const roles = convo.roles as string[];
      for (let i = 0; i < dialog.length; i++) {
        const [name, utterance] = dialog[i];
        const role = name === convo.agents[0] ? roles[0] : roles[1];
        const partner = name === convo.agents[0] ? convo.agents[1] : convo.agents[0];
        newEntries.push({
          timestamp: simTime,
          agentName: name,
          agentRole: role,
          labId: convo.lab_id,
          dialog: utterance,
          isLlm: true,
          source: 'fl-convo',
          cognitiveType: 'dialog',
          state: 'discussing',
          chattingWith: partner,
          flRound: convo.round,
        });
      }
    }

    appendEntries(newEntries);
  }, [backendSimData?.fl?.conversations, appendEntries]);

  // Auto-scroll
  useEffect(() => {
    if (!collapsed) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [dialogLog, collapsed]);

  if (!visible) return null;

  const isWorldMap = !selectedLab || selectedLab === 'WorldMapScene';
  const labFilter = selectedLab ? SCENE_TO_LAB[selectedLab] : null;

  const filteredLog = dialogLog.filter(entry => {
    if (!isWorldMap && labFilter && entry.labId !== labFilter) return false;
    if (filterLlmOnly && !entry.isLlm) return false;
    return true;
  });

  const llmCount = filteredLog.filter(e => e.isLlm).length;

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '--:--';
    }
  };

  return (
    <div className={`llm-dialog-panel ${collapsed ? 'llm-collapsed' : ''}`}>
      <div className="llm-dialog-header" onClick={() => setCollapsed(c => !c)} style={{ cursor: 'pointer' }}>
        <h3>
          LLM Dialoghi
          <span className="llm-dialog-count">{filteredLog.length}</span>
          {llmCount > 0 && <span className="llm-badge" style={{ marginLeft: 4 }}>AI {llmCount}</span>}
        </h3>
        <div className="llm-dialog-controls" onClick={e => e.stopPropagation()}>
          <label className="llm-filter-toggle" title="Mostra solo messaggi LLM">
            <input
              type="checkbox"
              checked={filterLlmOnly}
              onChange={(e) => setFilterLlmOnly(e.target.checked)}
            />
            Solo LLM
          </label>
          <button className="llm-dialog-clear" onClick={() => {
            setDialogLog([]);
            lastDialogsRef.current = {};
          }} title="Cancella log">
            &#x1f5d1;
          </button>
          <button className="llm-dialog-close" onClick={onClose} title="Chiudi">&#x2715;</button>
        </div>
      </div>

      {!collapsed && (
        <>
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
                  className={`llm-dialog-entry ${entry.isLlm ? 'llm-generated' : 'stub-generated'} ${entry.source === 'phaser' ? 'phaser-source' : ''} ${entry.source === 'fl-convo' ? 'fl-convo-source' : ''}`}
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
                    {entry.source === 'fl-convo' && <span className="fl-convo-badge">FL R{entry.flRound}</span>}
                    {entry.source === 'phaser' && <span className="phaser-badge">AI</span>}
                    {entry.cognitiveType && (
                      <span className="cognitive-badge">{COGNITIVE_LABELS[entry.cognitiveType] || entry.cognitiveType}</span>
                    )}
                    {entry.chattingWith && (
                      <span className="llm-dialog-chat-with">con {entry.chattingWith}</span>
                    )}
                  </div>
                  <div className="llm-dialog-text" style={{ whiteSpace: 'pre-wrap' }}>{entry.dialog}</div>
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </>
      )}
    </div>
  );
};

export default LLMDialogPanel;
