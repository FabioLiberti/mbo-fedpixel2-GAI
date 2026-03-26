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
  onAlgorithmChange?: (algorithm: string, mu: number) => void;
  totalAgentCount?: number;
  currentLabName?: string | null;
}

/**
 * Pannello che mostra lo stato del Federated Learning e consente di controllarlo.
 * La visibilità è gestita interamente via localStorage + evento DOM personalizzato,
 * senza dipendere dal registry Phaser (che si perde al cambio scena).
 */
const MILESTONE_THRESHOLD = 0.80;

const FLStatusPanel: React.FC<FLStatusPanelProps> = ({ flStatus, onToggleFL, onAlgorithmChange, totalAgentCount, currentLabName }) => {
  const [visible, setVisible] = useState<boolean>(getFLPanelState());
  const [collapsed, setCollapsed] = useState<boolean>(true);
  const [milestoneData, setMilestoneData] = useState<{
    accuracy: number;
    round: number;
    perClient: Record<string, { accuracy: number; loss: number }>;
  } | null>(null);
  const milestoneFiredRef = useRef<boolean>(false);

  // Ascolta toggle dal pulsante "FL Process" (evento DOM personalizzato)
  useEffect(() => {
    const cleanup = addFLPanelToggleListener((isVisible: boolean) => {
      setVisible(isVisible);
    });
    return cleanup;
  }, []);

  // Milestone detection: fire once when accuracy >= threshold
  useEffect(() => {
    if (milestoneFiredRef.current) return;
    const acc = flStatus?.metrics?.accuracy;
    if (acc === undefined || acc < MILESTONE_THRESHOLD) return;

    milestoneFiredRef.current = true;

    // Extract per-client data from the latest round
    const pcArr = flStatus?.metrics?.perClient;
    const latestPC = pcArr && pcArr.length > 0 ? pcArr[pcArr.length - 1] : {};

    setMilestoneData({
      accuracy: acc,
      round: flStatus?.metrics?.round ?? 0,
      perClient: latestPC,
    });

    // Auto-dismiss after 8s
    const timer = setTimeout(() => setMilestoneData(null), 8000);
    return () => clearTimeout(timer);
  }, [flStatus?.metrics?.accuracy, flStatus?.metrics?.round, flStatus?.metrics?.perClient]);

  // Se il pannello non è visibile, non mostrare nulla
  if (!visible) return null;

  // Handler per minimizzare il pannello
  const handleMinimize = () => {
    updateFLPanelState(false);
    emitFLPanelToggle(false);
  };

  const { enabled, currentState, activeAgents, metrics, connections, dp, algorithm, mu, dataDistribution } = flStatus || {};

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
          {/* Algorithm selector */}
          <div className="fl-algorithm-selector">
            <select
              className="fl-algo-select"
              value={algorithm || 'fedavg'}
              onChange={(e) => {
                const algo = e.target.value;
                onAlgorithmChange?.(algo, algo === 'fedprox' ? (mu || 0.01) : 0);
              }}
            >
              <option value="fedavg">FedAvg</option>
              <option value="fedprox">FedProx</option>
            </select>
            {algorithm === 'fedprox' && (
              <div className="fl-mu-control">
                <label className="fl-mu-label" title="Proximal term coefficient">
                  {(mu || 0.01).toFixed(3)}
                </label>
                <input
                  type="range"
                  className="fl-mu-slider"
                  min="0.001"
                  max="0.1"
                  step="0.001"
                  value={mu || 0.01}
                  onChange={(e) => {
                    const newMu = parseFloat(e.target.value);
                    onAlgorithmChange?.('fedprox', newMu);
                  }}
                />
              </div>
            )}
          </div>

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

          {/* Privacy Budget (DP-SGD) */}
          {dp?.enabled && (
            <div className="fl-privacy-budget">
              <div className="fl-privacy-header">
                <span className="fl-privacy-label">Privacy Budget</span>
                <span className="fl-privacy-value">
                  {dp.exhausted ? (
                    <span className="fl-privacy-exhausted">EXHAUSTED</span>
                  ) : (
                    <>
                      {`${(dp.budget_fraction * 100).toFixed(0)}%`}
                      <span className="fl-privacy-eps"> ({dp.epsilon_spent.toFixed(2)}/{dp.epsilon_total})</span>
                    </>
                  )}
                </span>
              </div>
              <div className="fl-privacy-bar-bg">
                <div
                  className={`fl-privacy-bar-fill ${dp.budget_fraction < 0.2 ? 'fl-privacy-low' : ''}`}
                  style={{ width: `${Math.max(0, dp.budget_fraction * 100)}%` }}
                />
              </div>
              <div className="fl-privacy-details">
                <span>noise {dp.noise_multiplier}</span>
                <span>clip {dp.max_grad_norm}</span>
              </div>
            </div>
          )}

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

          {/* Local vs Global — per-lab performance comparison */}
          {metrics?.localVsGlobal && Object.keys(metrics.localVsGlobal).length > 0 && (
            <div className="fl-lab-perf">
              <h4>Lab Performance</h4>
              {Object.entries(metrics.localVsGlobal).map(([lab, v]) => {
                const gain = v.gain;
                const gainClass = gain >= 0 ? 'fl-gain-positive' : 'fl-gain-negative';
                const labSigma = dp?.per_client_sigma?.[lab];
                return (
                  <div key={lab} className="fl-lab-perf-row">
                    <span className="fl-lab-perf-name">{lab}</span>
                    <span className="fl-lab-perf-local">loc {(v.local_acc * 100).toFixed(0)}%</span>
                    <span className="fl-lab-perf-global">fed {(v.global_acc * 100).toFixed(0)}%</span>
                    <span className={`fl-lab-perf-gain ${gainClass}`}>
                      {gain >= 0 ? '+' : ''}{(gain * 100).toFixed(1)}%
                    </span>
                    {labSigma !== undefined && (
                      <span className="fl-lab-perf-sigma" title="Noise sigma applied">
                        {labSigma.toFixed(3)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Cross-Evaluation — global model on each lab's data */}
          {metrics?.crossEval && Object.keys(metrics.crossEval).length > 0 && (
            <div className="fl-cross-eval">
              <h4>Cross-Evaluation</h4>
              {Object.entries(metrics.crossEval).map(([lab, v]) => (
                <div key={lab} className="fl-cross-eval-row">
                  <span className="fl-cross-eval-name">{lab}</span>
                  <span className="fl-cross-eval-acc">acc {(v.accuracy * 100).toFixed(0)}%</span>
                  <span className="fl-cross-eval-loss">loss {v.loss.toFixed(4)}</span>
                  <span className="fl-cross-eval-n">{v.samples}n</span>
                </div>
              ))}
            </div>
          )}

          {/* Data Distribution — non-IID partition visualization */}
          {dataDistribution && Object.keys(dataDistribution).length > 0 && (
            <div className="fl-data-dist">
              <h4>Data Distribution</h4>
              {Object.entries(dataDistribution).map(([lab, info]) => {
                const maxCount = Math.max(...(info.age_histogram?.counts || [1]));
                return (
                  <div key={lab} className="fl-data-dist-lab">
                    <div className="fl-data-dist-header">
                      <span className="fl-data-dist-name">{lab}</span>
                      <span className="fl-data-dist-n">{info.n_samples}n</span>
                      <span className="fl-data-dist-pos">{(info.positive_ratio * 100).toFixed(0)}% +</span>
                    </div>
                    <div className="fl-data-dist-age">
                      age {info.age_mean} &plusmn; {info.age_std}
                    </div>
                    {info.age_histogram && (
                      <div className="fl-data-dist-bars">
                        {info.age_histogram.counts.map((count, i) => (
                          <div key={i} className="fl-data-dist-bar-col" title={`${info.age_histogram.bins[i]}: ${count}`}>
                            <div
                              className="fl-data-dist-bar"
                              style={{ height: `${Math.max(2, (count / maxCount) * 20)}px` }}
                            />
                            <span className="fl-data-dist-bin">{info.age_histogram.bins[i]}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
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

      {/* Milestone popup — centered overlay */}
      {milestoneData && (
        <div className="fl-milestone-overlay" onClick={() => setMilestoneData(null)}>
          <div className="fl-milestone-popup">
            <div className="fl-milestone-icon">&#x2714;</div>
            <h3 className="fl-milestone-title">FL Milestone Reached!</h3>
            <p className="fl-milestone-acc">
              Accuracy: <strong>{(milestoneData.accuracy * 100).toFixed(1)}%</strong>
              &nbsp;at round {milestoneData.round}
            </p>
            {Object.keys(milestoneData.perClient).length > 0 && (
              <div className="fl-milestone-labs">
                {Object.entries(milestoneData.perClient).map(([lab, m]) => (
                  <div key={lab} className="fl-milestone-lab-row">
                    <span className="fl-milestone-lab-name">{lab}</span>
                    <span className="fl-milestone-lab-acc">
                      acc {(m.accuracy * 100).toFixed(1)}%
                    </span>
                    <span className="fl-milestone-lab-loss">
                      loss {m.loss.toFixed(4)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {dp?.enabled && (
              <p className="fl-milestone-privacy">
                Privacy: {dp.budget_fraction < 0.2 ? 'LOW' : 'OK'} ({(dp.budget_fraction * 100).toFixed(0)}% remaining)
              </p>
            )}
            <p className="fl-milestone-hint">click to dismiss</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default FLStatusPanel;
