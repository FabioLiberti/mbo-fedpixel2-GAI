import React, { useEffect, useRef, useState, useCallback } from 'react';
import './LLMDialogPanel.css';
import { addPhaserDialogListener, PhaserDialogDetail } from '../utils/customEvents';
import { getGameInstance } from '../utils/gameInstance';

interface DialogEntry {
  timestamp: string;
  agentName: string;
  agentRole: string;
  labId: string;
  dialog: string;
  isLlm: boolean;
  source: 'backend' | 'phaser' | 'fl-convo' | 'generated';
  cognitiveType?: string;
  state: string;
  chattingWith: string | null;
  flRound?: number;
  isSimulated?: boolean;
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

const MSG_TYPES = [
  { id: 'dialog', label: 'Dialogo' },
  { id: 'thinking', label: 'Pensiero' },
  { id: 'decision', label: 'Decisione' },
];

function getApiBaseUrl(): string {
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  return `${protocol}//${hostname}:8091`;
}

const LLMDialogPanel: React.FC<LLMDialogPanelProps> = ({
  backendSimData,
  selectedLab,
  visible,
  onClose,
}) => {
  const [dialogLog, setDialogLog] = useState<DialogEntry[]>([]);
  const [filterLlmOnly, setFilterLlmOnly] = useState<boolean>(false);
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const lastDialogsRef = useRef<Record<string, string>>({});
  const recentTextsRef = useRef<{ text: string; ts: number }[]>([]);


  // Controls state
  const [llmEnabled, setLlmEnabled] = useState<boolean>(true);
  const [msgFrequency, setMsgFrequency] = useState<number>(50);
  const [msgType, setMsgType] = useState<string>('dialog');
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [generating, setGenerating] = useState<boolean>(false);
  const [controlsOpen, setControlsOpen] = useState<boolean>(false);
  const [qualityScores, setQualityScores] = useState<any>(null);
  const [qualityOpen, setQualityOpen] = useState<boolean>(false);

  const DEDUP_WINDOW_MS = 60_000;

  const normalize = (t: string) => t.trim().toLowerCase().replace(/\s+/g, ' ');

  const isDuplicate = useCallback((text: string): boolean => {
    const now = Date.now();
    const norm = normalize(text);
    recentTextsRef.current = recentTextsRef.current.filter(e => now - e.ts < DEDUP_WINDOW_MS);
    if (recentTextsRef.current.some(e => e.text === norm)) return true;
    recentTextsRef.current.push({ text: norm, ts: now });
    return false;
  }, []);

  const appendEntries = useCallback((entries: DialogEntry[]) => {
    if (entries.length === 0) return;
    const unique = entries.filter(e => !isDuplicate(e.dialog));
    if (unique.length === 0) return;
    setDialogLog(prev => {
      const updated = [...prev, ...unique];
      return updated.length > 500 ? updated.slice(-500) : updated;
    });
  }, [isDuplicate]);

  // Backend status check — uses /simulation/state only (no Ollama dependency)
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let consecutiveFails = 0;
    const check = async () => {
      try {
        const r = await fetch(`${getApiBaseUrl()}/simulation/state`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!cancelled && r.ok) {
          setBackendStatus('connected');
          consecutiveFails = 0;
          return;
        }
      } catch { /* failed */ }
      consecutiveFails++;
      if (!cancelled && consecutiveFails >= 3) setBackendStatus('disconnected');
    };
    check();
    const interval = setInterval(check, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [visible]);

  // Mark connected whenever we receive simulation data
  useEffect(() => {
    if (backendSimData) setBackendStatus('connected');
  }, [backendSimData]);

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

  // 2) Phaser-side LLM dialogs
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

  // 3) FL post-round conversations
  const lastFlRoundRef = useRef<number>(-1);
  useEffect(() => {
    const convos = backendSimData?.fl?.conversations;
    if (!Array.isArray(convos) || convos.length === 0) return;

    const latest = convos[convos.length - 1];
    if (!latest || latest.round === lastFlRoundRef.current) return;
    lastFlRoundRef.current = latest.round;

    const simTime = backendSimData.sim_time || new Date().toISOString();
    const newEntries: DialogEntry[] = [];

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

    const gameInstance = getGameInstance();
    if (gameInstance) {
      for (const convo of convos.filter((c: any) => c.round === latest.round)) {
        gameInstance.events.emit('analytics-fl-conversation', convo);
      }
    }
  }, [backendSimData?.fl?.conversations, appendEntries]);

  // No auto-scroll needed: newest dialogs appear at top

  // Generate message handler
  const handleGenerate = useCallback(async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const agents = backendSimData?.agent_states as any[] | undefined;
      const agent = agents && agents.length > 0
        ? agents[Math.floor(Math.random() * agents.length)]
        : { id: 'system', name: 'System Agent', role: 'researcher' };

      const isConnected = backendStatus === 'connected';
      let messageText = '';
      let isSimulated = !isConnected;

      if (isConnected) {
        try {
          const r = await fetch(`${getApiBaseUrl()}/ai/generate-dialog`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              agentId: agent.id,
              agentName: agent.name || `Agent ${agent.id}`,
              agentRole: agent.role || 'researcher',
              agentSpecialization: 'Federated Learning',
              interactionType: msgType === 'dialog' ? 'working' : msgType,
              labType: agent.lab_id || 'mercatorum',
            }),
            signal: AbortSignal.timeout(8000),
          });
          if (r.ok) {
            const data = await r.json();
            messageText = data.dialog || data.message || 'No response from LLM';
          } else {
            isSimulated = true;
          }
        } catch {
          isSimulated = true;
        }
      }

      if (isSimulated || !messageText) {
        const simulated: Record<string, string[]> = {
          dialog: [
            "Let's analyze this federated learning approach in more detail.",
            "Have you considered the impact of non-IID data distribution?",
            "We should implement differential privacy techniques.",
          ],
          thinking: [
            "The current aggregation method might be introducing bias...",
            "If we implement quantization, we could reduce bandwidth by 70%...",
            "The privacy-utility tradeoff is crucial here...",
          ],
          decision: [
            "Decision: Implement FedProx instead of FedAvg for non-IID data.",
            "Decision: Adopt adaptive learning rates based on local data distributions.",
            "Decision: Apply differential privacy with decreasing epsilon.",
          ],
        };
        const pool = simulated[msgType] || simulated.dialog;
        messageText = pool[Math.floor(Math.random() * pool.length)];
      }

      const entry: DialogEntry = {
        timestamp: new Date().toISOString(),
        agentName: agent.name || `Agent ${agent.id}`,
        agentRole: agent.role || 'researcher',
        labId: agent.lab_id || 'unknown',
        dialog: messageText,
        isLlm: !isSimulated,
        source: 'generated',
        cognitiveType: msgType,
        state: 'active',
        chattingWith: null,
        isSimulated,
      };
      appendEntries([entry]);

      // Emit to Phaser game events
      const gameInstance = getGameInstance();
      if (gameInstance) {
        gameInstance.events.emit('dialog-created', {
          type: isSimulated ? 'simulated' : 'llm',
          isSimulated,
        });
      }
    } catch (err) {
      console.error('[LLMDialogPanel] Generate error:', err);
    } finally {
      setGenerating(false);
    }
  }, [backendSimData, backendStatus, msgType, generating, appendEntries]);

  // Toggle LLM on Phaser side
  useEffect(() => {
    const gameInstance = getGameInstance();
    if (gameInstance) {
      gameInstance.events.emit('llm-toggle', { enabled: llmEnabled });
    }
  }, [llmEnabled]);

  if (!visible) return null;

  const isWorldMap = !selectedLab || selectedLab === 'WorldMapScene';
  const labFilter = selectedLab ? SCENE_TO_LAB[selectedLab] : null;

  const filteredLog = dialogLog.filter(entry => {
    if (!isWorldMap && labFilter) {
      const isCrossLab = entry.labId.includes('\u2194');
      if (isCrossLab ? !entry.labId.includes(labFilter) : entry.labId !== labFilter) return false;
    }
    if (filterLlmOnly && !entry.isLlm) return false;
    return true;
  });

  const llmCount = filteredLog.filter(e => e.isLlm).length;
  const simCount = filteredLog.filter(e => e.isSimulated).length;

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '--:--';
    }
  };

  const statusColor = backendStatus === 'connected' ? '#4caf50'
    : backendStatus === 'disconnected' ? '#f44336' : '#bbbbbb';
  const statusLabel = backendStatus === 'connected' ? 'Connesso'
    : backendStatus === 'disconnected' ? 'Disconnesso' : 'Verifica...';

  return (
    <div
      className={`llm-dialog-panel ${collapsed ? 'llm-collapsed' : ''}`}
      onPointerDown={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
      onWheel={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="llm-dialog-header" onClick={() => setCollapsed(c => !c)} style={{ cursor: 'pointer' }}>
        <h3>
          Pannello LLM
          <span className="llm-dialog-count">{filteredLog.length}</span>
          {llmCount > 0 && <span className="llm-badge" style={{ marginLeft: 4 }}>AI {llmCount}</span>}
        </h3>
        <div className="llm-dialog-controls" onClick={e => e.stopPropagation()}>
          <span className="llm-backend-status" style={{ color: statusColor }} title={`Backend: ${statusLabel}`}>
            &#x25CF; {statusLabel}
          </span>
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
          {/* Toolbar: filtri tipo + qualita + solo LLM — sempre visibile */}
          <div className="llm-toolbar">
            <div className="llm-type-buttons">
              {MSG_TYPES.map(t => (
                <button
                  key={t.id}
                  className={`llm-type-btn ${msgType === t.id ? 'active' : ''}`}
                  onClick={() => setMsgType(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <label className="llm-filter-toggle" title="Mostra solo messaggi LLM">
              <input
                type="checkbox"
                checked={filterLlmOnly}
                onChange={(e) => setFilterLlmOnly(e.target.checked)}
              />
              Solo LLM
            </label>
            <button
              className="llm-quality-btn"
              onClick={async (e) => {
                e.stopPropagation();
                const opening = !qualityOpen;
                setQualityOpen(opening);
                if (opening) {
                  try {
                    const r = await fetch(`${getApiBaseUrl()}/dialog-quality/summary`, {
                      signal: AbortSignal.timeout(5000),
                    });
                    if (r.ok) {
                      setQualityScores(await r.json());
                    } else {
                      setQualityScores({ total_evaluated: 0, average_scores: {}, error: 'Backend error' });
                    }
                  } catch {
                    setQualityScores({ total_evaluated: 0, average_scores: {}, error: 'Connessione fallita' });
                  }
                }
              }}
            >
              {qualityOpen ? '[-]' : '[+]'} Qualita
            </button>
            <span style={{ fontSize: 10, color: '#888', marginLeft: 'auto' }}>
              LLM:{llmCount} Tot:{filteredLog.length}
            </span>
          </div>

          {/* Quality scores expandable */}
          {qualityOpen && (
            <div className="llm-quality-body">
              {!qualityScores ? (
                <div className="llm-quality-empty">Caricamento...</div>
              ) : (
              <>
              <div className="llm-quality-total">
                Valutati: <strong>{qualityScores.total_evaluated || 0}</strong>
              </div>
              {qualityScores.average_scores && Object.keys(qualityScores.average_scores).length > 0 ? (
                <>
                  {[
                    { key: 'overall_quality', label: 'Overall', icon: '*' },
                    { key: 'data_grounding', label: 'Dati FL', icon: '#' },
                    { key: 'role_differentiation', label: 'Ruoli', icon: 'R' },
                    { key: 'memory_integration', label: 'Memoria', icon: 'M' },
                    { key: 'repetition_score', label: 'Novita', icon: 'N' },
                    { key: 'format_compliance', label: 'Formato', icon: 'F' },
                  ].map(m => {
                    const val = qualityScores.average_scores[m.key] || 0;
                    const pct = Math.round(val * 100);
                    const color = val >= 0.7 ? '#4caf50' : val >= 0.4 ? '#ff9800' : '#f44336';
                    return (
                      <div key={m.key} className="llm-quality-row">
                        <span className="llm-quality-label">{m.icon} {m.label}</span>
                        <div className="llm-quality-bar-bg">
                          <div
                            className="llm-quality-bar-fill"
                            style={{ width: `${pct}%`, backgroundColor: color }}
                          />
                        </div>
                        <span className="llm-quality-value" style={{ color }}>{pct}%</span>
                      </div>
                    );
                  })}
                </>
              ) : (
                <div className="llm-quality-empty">Nessun dialogo valutato</div>
              )}
              <button
                className="llm-quality-refresh"
                onClick={async () => {
                  try {
                    const r = await fetch(`${getApiBaseUrl()}/dialog-quality/summary`, {
                      signal: AbortSignal.timeout(5000),
                    });
                    if (r.ok) setQualityScores(await r.json());
                  } catch { /* ignore */ }
                }}
              >
                Aggiorna
              </button>
              </>
              )}
            </div>
          )}

          {/* Controls avanzati (collapsible) */}
          <div className="llm-controls-section">
            <div className="llm-controls-header" onClick={() => setControlsOpen(c => !c)}>
              <span>{controlsOpen ? '\u25BC' : '\u25B6'} Controlli avanzati</span>
            </div>
            {controlsOpen && (
              <div className="llm-controls-body">
                <div className="llm-control-row">
                  <span>Messaggi LLM</span>
                  <label className="llm-switch">
                    <input type="checkbox" checked={llmEnabled} onChange={e => setLlmEnabled(e.target.checked)} />
                    <span className="llm-switch-slider" />
                  </label>
                  <span className={`llm-switch-label ${llmEnabled ? 'on' : 'off'}`}>
                    {llmEnabled ? 'ON' : 'OFF'}
                  </span>
                </div>
                <div className="llm-control-row">
                  <span>Frequenza</span>
                  <input type="range" min={0} max={100} value={msgFrequency}
                    onChange={e => setMsgFrequency(Number(e.target.value))} className="llm-slider" />
                  <span className="llm-slider-value">{msgFrequency}%</span>
                </div>
                <button className="llm-generate-btn" onClick={handleGenerate} disabled={generating}>
                  {generating ? 'Generazione...' : (
                    backendStatus === 'connected' ? 'Genera Messaggio LLM' : 'Genera Messaggio Simulato'
                  )}
                </button>
                <div className="llm-model-info">
                  <div className="llm-model-info-title">Modello LLM</div>
                  <div className="llm-model-info-row"><span>Modello</span><span>qwen3.5:4b</span></div>
                  <div className="llm-model-info-row"><span>Provider</span><span>Ollama (locale)</span></div>
                  <div className="llm-model-info-row"><span>Endpoint</span><span>localhost:11434</span></div>
                  <div className="llm-model-info-row"><span>Temperature</span><span>0.7</span></div>
                  <div className="llm-model-info-row"><span>Max Tokens</span><span>1024</span></div>
                  <div className="llm-model-info-row">
                    <span>Stato</span>
                    <span style={{ color: statusColor }}>{statusLabel}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Dialog log */}
          <div className="llm-dialog-log">
            {filteredLog.length === 0 ? (
              <p className="llm-dialog-empty">
                {dialogLog.length === 0
                  ? 'Avvia la simulazione per vedere i dialoghi degli agenti'
                  : 'Nessun dialogo per il filtro selezionato'}
              </p>
            ) : (
              [...filteredLog].reverse().map((entry, i) => (
                <div
                  key={i}
                  className={`llm-dialog-entry ${entry.isLlm ? 'llm-generated' : 'stub-generated'} ${entry.source === 'phaser' ? 'phaser-source' : ''} ${entry.source === 'fl-convo' ? 'fl-convo-source' : ''} ${entry.source === 'generated' ? 'generated-source' : ''}`}
                >
                  <div className="llm-dialog-meta">
                    <span className="llm-dialog-time">{formatTime(entry.timestamp)}</span>
                    <span
                      className="llm-dialog-agent"
                      style={{ color: ROLE_COLORS[entry.agentRole] || '#ccc' }}
                    >
                      {entry.agentName}
                    </span>
                    <span className="llm-dialog-lab">
                      {entry.labId.includes('\u2194')
                        ? entry.labId.split('\u2194').map(l => LAB_DISPLAY[l] || l).join(' \u2194 ')
                        : (LAB_DISPLAY[entry.labId] || entry.labId)}
                    </span>
                    {entry.labId.includes('\u2194') && <span className="cross-lab-badge">Cross-Lab</span>}
                    {entry.isLlm && <span className="llm-badge">LLM</span>}
                    {entry.isSimulated && <span className="sim-badge">SIM</span>}
                    {entry.source === 'fl-convo' && <span className="fl-convo-badge">FL R{entry.flRound}</span>}
                    {entry.source === 'phaser' && <span className="phaser-badge">AI</span>}
                    {entry.source === 'generated' && <span className="gen-badge">GEN</span>}
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
          </div>
        </>
      )}
    </div>
  );
};

export default LLMDialogPanel;
