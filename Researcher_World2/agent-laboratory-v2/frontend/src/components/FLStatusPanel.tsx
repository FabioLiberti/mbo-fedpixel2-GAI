import React, { useEffect, useState, useRef, useCallback } from 'react';
import './FLStatusPanel.css';
import { FLStatusData } from '../phaser/fl/FLController';
import { addFLPanelToggleListener, getFLPanelState, emitFLPanelToggle, updateFLPanelState } from '../utils/customEvents';

/* ------------------------------------------------------------------ */
/* Sparkline: canvas mini-chart for accuracy & loss history            */
/* ------------------------------------------------------------------ */

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color: string;
  label: string;
  formatValue?: (v: number) => string;
}

const Sparkline: React.FC<SparklineProps> = ({
  data, width = 200, height = 60, color, label,
  formatValue = (v) => v.toFixed(4),
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    if (data.length < 2) {
      ctx.fillStyle = '#666';
      ctx.font = '10px monospace';
      ctx.fillText('waiting for data...', 8, height / 2 + 3);
      return;
    }

    const pad = { top: 14, bottom: 4, left: 4, right: 4 };
    const w = width - pad.left - pad.right;
    const h = height - pad.top - pad.bottom;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    // Label + latest value
    ctx.fillStyle = '#999';
    ctx.font = '9px monospace';
    ctx.fillText(label, pad.left, 10);
    ctx.fillStyle = color;
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(formatValue(data[data.length - 1]), width - pad.right, 10);
    ctx.textAlign = 'left';

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (h * i) / 4;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + w, y); ctx.stroke();
    }

    // Sparkline path
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    data.forEach((v, i) => {
      const x = pad.left + (i / (data.length - 1)) * w;
      const y = pad.top + h - ((v - min) / range) * h;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Fill under curve
    const lastX = pad.left + w;
    const baseY = pad.top + h;
    ctx.lineTo(lastX, baseY);
    ctx.lineTo(pad.left, baseY);
    ctx.closePath();
    ctx.fillStyle = color.replace(')', ', 0.10)').replace('rgb(', 'rgba(');
    ctx.fill();

    // Dot on last point
    const lx = pad.left + w;
    const ly = pad.top + h - ((data[data.length - 1] - min) / range) * h;
    ctx.beginPath();
    ctx.arc(lx, ly, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }, [data, width, height, color, label, formatValue]);

  useEffect(() => { draw(); }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className="fl-sparkline-canvas"
      style={{ width, height }}
    />
  );
};

interface FLStatusPanelProps {
  flStatus: FLStatusData | null;
  onToggleFL: (enabled: boolean) => void;
  totalAgentCount?: number;
  currentLabName?: string | null;
}

/**
 * Pannello che mostra lo stato del Federated Learning e consente di controllarlo.
 * La visibilità è gestita interamente via localStorage + evento DOM personalizzato,
 * senza dipendere dal registry Phaser (che si perde al cambio scena).
 */
const FLStatusPanel: React.FC<FLStatusPanelProps> = ({ flStatus, onToggleFL, totalAgentCount, currentLabName }) => {
  const [visible, setVisible] = useState<boolean>(getFLPanelState());
  const [collapsed, setCollapsed] = useState<boolean>(true);

  // Ascolta toggle dal pulsante "FL Process" (evento DOM personalizzato)
  useEffect(() => {
    const cleanup = addFLPanelToggleListener((isVisible: boolean) => {
      setVisible(isVisible);
    });
    return cleanup;
  }, []);

  // Se il pannello non è visibile, non mostrare nulla
  if (!visible) return null;

  // Handler per minimizzare il pannello
  const handleMinimize = () => {
    updateFLPanelState(false);
    emitFLPanelToggle(false);
  };

  const { enabled, currentState, activeAgents, metrics, connections } = flStatus || {};

  const formatMetric = (value: number | undefined): string => {
    return value !== undefined ? value.toFixed(4) : 'N/A';
  };

  const agentStateCount = Array.isArray(activeAgents)
    ? activeAgents.reduce((acc, agent) => {
        acc[agent.state] = (acc[agent.state] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    : {};

  const stateLabel = currentState || 'IDLE';

  return (
    <div className={`fl-status-panel visible ${collapsed ? 'fl-collapsed' : ''}`}>
      <div className="fl-status-header" onClick={() => setCollapsed(c => !c)} style={{ cursor: 'pointer' }}>
        <h3>
          Federated Learning
          {flStatus && enabled && (
            <span className={`fl-state-inline fl-state-${stateLabel.toLowerCase()}`}>{stateLabel}</span>
          )}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={e => e.stopPropagation()}>
          {flStatus && (
            <div className="fl-toggle">
              <input
                type="checkbox"
                id="fl-toggle-switch"
                checked={enabled || false}
                onChange={(e) => onToggleFL(e.target.checked)}
              />
              <label htmlFor="fl-toggle-switch">
                {enabled ? 'On' : 'Off'}
              </label>
            </div>
          )}
          <button className="fl-minimize-btn" onClick={handleMinimize} title="Minimizza">&#x2715;</button>
        </div>
      </div>

      {!collapsed && !flStatus && (
        <p style={{ color: '#888', fontStyle: 'italic', fontSize: '12px', margin: '8px 12px' }}>
          Avvia la simulazione per visualizzare i dati FL
        </p>
      )}

      {!collapsed && flStatus && enabled && (
        <>
          <div className="fl-current-state">
            <span className="fl-state-label">State:</span>
            <span className={`fl-state-value fl-state-${stateLabel.toLowerCase()}`}>
              {stateLabel}
            </span>
          </div>

          <div className="fl-metrics">
            <h4>Metrics</h4>
            <div className="fl-metrics-grid">
              <div className="fl-metric">
                <span className="fl-metric-label">Accuracy:</span>
                <span className="fl-metric-value">{formatMetric(metrics?.accuracy)}</span>
              </div>
              <div className="fl-metric">
                <span className="fl-metric-label">Loss:</span>
                <span className="fl-metric-value">{formatMetric(metrics?.loss)}</span>
              </div>
              <div className="fl-metric">
                <span className="fl-metric-label">Round:</span>
                <span className="fl-metric-value">{metrics?.round || 0}</span>
              </div>
              <div className="fl-metric">
                <span className="fl-metric-label">Clients:</span>
                <span className="fl-metric-value">
                  {metrics?.clientFraction ? `${(metrics.clientFraction * 100).toFixed(0)}%` : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Sparkline charts — accuracy & loss history */}
          {(metrics?.accuracyHistory?.length ?? 0) >= 2 && (
            <div className="fl-sparklines">
              <Sparkline
                data={metrics!.accuracyHistory!}
                color="rgb(46, 204, 113)"
                label="Accuracy"
              />
              <Sparkline
                data={metrics!.lossHistory || []}
                color="rgb(231, 76, 60)"
                label="Loss"
              />
            </div>
          )}

          <div className="fl-agents">
            <h4>
              Agents ({activeAgents?.length || 0}
              {currentLabName && totalAgentCount ? `/${totalAgentCount}` : ''})
              {currentLabName && <span className="fl-lab-context"> — {currentLabName}</span>}
            </h4>
            <div className="fl-agent-states">
              {Object.entries(agentStateCount).map(([state, count]) => (
                <div key={state} className={`fl-agent-state fl-state-${state.toLowerCase()}`}>
                  <span className="fl-agent-state-label">{state}:</span>
                  <span className="fl-agent-state-count">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="fl-connections">
            <h4>Connections ({connections?.length || 0})</h4>
            <div className="fl-connection-list">
              {connections?.map((conn, index) => (
                <div key={index} className={`fl-connection ${conn.active ? 'fl-connection-active' : ''}`}>
                  <span className="fl-connection-source">{conn.source}</span>
                  <span className="fl-connection-arrow">→</span>
                  <span className="fl-connection-target">{conn.target}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default FLStatusPanel;
