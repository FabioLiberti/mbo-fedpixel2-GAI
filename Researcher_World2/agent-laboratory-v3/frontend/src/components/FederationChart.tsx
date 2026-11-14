// frontend/src/components/FederationChart.tsx
//
// Andamento della federazione, sotto la scena.
//
// Round per round, l'accuracy del modello federato a confronto con quella dei
// modelli che i tre laboratori addestrano da soli, tutti misurati sugli stessi
// pazienti di test (quelli di tutti i laboratori). Sul grafico sono segnate le
// decisioni prese dagli agenti sui parametri del federated learning, con
// l'effetto misurato nei round successivi. Tutti i valori arrivano dal backend.

import React, { useRef, useState } from 'react';
import { LABS } from './federationTheme';

interface ChartProps {
  backendSimData?: any;
}

interface Decision {
  round: number;
  label: string;
  effect: string;
}

const FEDERATED_COLOR = '#f2f4fb';
const W = 1000;
const H = 210;
const LEFT = 46;
const RIGHT = 16;
const TOP = 26;
const BOTTOM = 26;
const Y_MIN = 0.3;
const Y_MAX = 1.0;
const MIN_ROUNDS = 15;

const CHART_STYLES = `
.fed-chart {
  position: relative; background: #0e1428; color: #fff; padding: 10px 12px 8px; border-radius: 0 0 8px 8px;
  font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; text-align: left;
}
.fed-chart-head { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 14px; margin-bottom: 2px; }
.fed-chart-title { font-size: 15px; font-weight: 800; letter-spacing: 1.5px; color: #f08a3c; text-transform: uppercase; }
.fed-chart-sub { font-size: 13px; color: #c9d2ea; }
.fed-chart-legend { display: flex; flex-wrap: wrap; gap: 4px 16px; margin-left: auto; font-size: 13px; color: #dfe6fa; }
.fed-chart-key { display: inline-flex; align-items: center; gap: 6px; }
.fed-chart-key i { display: inline-block; width: 20px; border-radius: 2px; }
.fed-chart-key b { color: #fff; }
.fed-chart svg { display: block; width: 100%; height: auto; }
.fed-chart-tip {
  position: absolute; pointer-events: none; z-index: 5; background: #232e52; border: 1px solid #3a4568; border-radius: 8px;
  padding: 6px 10px; font-size: 13px; color: #dfe6fa; white-space: nowrap; box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45);
}
.fed-chart-tip b { color: #fff; font-size: 14px; }
.fed-chart-tip-row { display: flex; align-items: center; gap: 7px; }
.fed-chart-tip-row i { display: inline-block; width: 14px; border-radius: 2px; }
.fed-chart-decisions { font-size: 13px; color: #c9d2ea; margin-top: 2px; }
.fed-chart-decisions b { color: #fff; }
.fed-chart details { font-size: 12.5px; color: #9aa5c4; margin-top: 4px; }
.fed-chart summary { cursor: pointer; }
.fed-chart table { border-collapse: collapse; margin-top: 4px; }
.fed-chart th, .fed-chart td { padding: 1px 10px 1px 0; text-align: right; font-variant-numeric: tabular-nums; }
.fed-chart th { color: #c9d2ea; font-weight: 600; }
`;

function pct(value: number | null | undefined): string {
  return typeof value === 'number' ? `${Math.round(value * 100)}%` : '–';
}

const FederationChart: React.FC<ChartProps> = ({ backendSimData }) => {
  const [hover, setHover] = useState<number | null>(null);   // round sotto il puntatore
  const boxRef = useRef<HTMLDivElement>(null);

  const fl = backendSimData?.fl;
  const accuracy: number[] = fl?.metrics?.accuracy || [];
  const benefit: any[] = fl?.metrics?.federation_benefit || [];
  const rawDecisions: any[] = fl?.decisions || [];
  const commonRows: number = fl?.federation?.common_test_rows ?? 0;

  const rounds = accuracy.length;
  const xMax = Math.max(MIN_ROUNDS, rounds);
  const x = (round: number) => LEFT + ((round - 1) / (xMax - 1)) * (W - LEFT - RIGHT);
  const y = (value: number) => {
    const clamped = Math.max(Y_MIN, Math.min(Y_MAX, value));
    return TOP + (1 - (clamped - Y_MIN) / (Y_MAX - Y_MIN)) * (H - TOP - BOTTOM);
  };

  // Una serie per il modello federato e una per ogni modello "da solo"
  const series = (() => {
    const alone = LABS.map(lab => ({
      id: lab.id,
      label: `${lab.label} da solo`,
      color: lab.color,
      width: 2,
      values: accuracy.map((_, i) => {
        const v = benefit[i]?.[lab.id]?.alone_common;
        return typeof v === 'number' ? v : null;
      }),
    }));
    return [
      { id: 'federated', label: 'Federato', color: FEDERATED_COLOR, width: 3.5, values: accuracy.map(v => v as number | null) },
      ...alone,
    ];
  })();

  const decisions: Decision[] = rawDecisions.filter(d => d && d.round <= xMax).map(d => {
    let label = 'nessun cambiamento';
    if (d.changed && d.before && d.after) {
      label = d.before.noise !== d.after.noise
        ? `rumore ${Number(d.before.noise).toFixed(2)} → ${Number(d.after.noise).toFixed(2)}`
        : `epoche ${d.before.epochs} → ${d.after.epochs}`;
    }
    const effect = d.changed && typeof d.accuracy_after === 'number'
      ? `accuracy media prima ${pct(d.accuracy_before)}, dopo ${pct(d.accuracy_after)}`
      : d.changed ? 'effetto in misura nei 3 round successivi' : '';
    return { round: Number(d.round), label, effect };
  });

  const path = (values: Array<number | null>): string => {
    let out = '';
    let pen = false;
    values.forEach((v, i) => {
      if (v === null) { pen = false; return; }
      out += `${pen ? 'L' : 'M'}${x(i + 1).toFixed(1)},${y(v).toFixed(1)} `;
      pen = true;
    });
    return out.trim();
  };

  const onMove = (event: React.MouseEvent<SVGSVGElement>) => {
    if (rounds === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * W;
    const round = Math.round(1 + ((px - LEFT) / (W - LEFT - RIGHT)) * (xMax - 1));
    setHover(Math.max(1, Math.min(rounds, round)));
  };

  const ticksY = [0.4, 0.6, 0.8, 1.0];
  const ticksX: number[] = [];
  for (let r = 5; r <= xMax; r += 5) ticksX.push(r);
  const hoverDecision = hover !== null ? decisions.find(d => d.round === hover) : undefined;
  const tipLeft = hover !== null ? (x(hover) / W) * 100 : 0;

  return (
    <div className="fed-chart" ref={boxRef}>
      <style>{CHART_STYLES}</style>
      <div className="fed-chart-head">
        <span className="fed-chart-title">Andamento della federazione</span>
        <span className="fed-chart-sub">
          accuracy round per round{commonRows > 0 ? ` sui ${commonRows} pazienti di test di tutti i laboratori` : ''}
        </span>
        <span className="fed-chart-legend">
          {series.map(s => {
            const last = s.values.length ? s.values[s.values.length - 1] : null;
            return (
              <span key={s.id} className="fed-chart-key">
                <i style={{ background: s.color, height: s.width }} />
                {s.label} <b>{pct(last)}</b>
              </span>
            );
          })}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Accuracy del modello federato e dei modelli addestrati da soli, round per round"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {ticksY.map(t => (
          <g key={t}>
            <line x1={LEFT} x2={W - RIGHT} y1={y(t)} y2={y(t)} stroke="#26304f" strokeWidth={1} />
            <text x={LEFT - 8} y={y(t) + 4} textAnchor="end" fontSize={12} fill="#9aa5c4">{pct(t)}</text>
          </g>
        ))}
        {ticksX.map(r => (
          <text key={r} x={x(r)} y={H - 8} textAnchor={r === xMax ? 'end' : 'middle'} fontSize={12} fill="#9aa5c4">round {r}</text>
        ))}

        {/* Decisioni degli agenti: una linea verticale con ciò che è cambiato */}
        {decisions.map((d, i) => (
          <g key={`${d.round}-${i}`}>
            <line x1={x(d.round)} x2={x(d.round)} y1={TOP - 6} y2={H - BOTTOM} stroke="#f08a3c" strokeWidth={1.5} strokeDasharray="4 4" />
            <text
              x={x(d.round) + (d.round > xMax - 3 ? -5 : 5)}
              y={TOP - 12 + (i % 2) * 12}
              textAnchor={d.round > xMax - 3 ? 'end' : 'start'}
              fontSize={12}
              fontWeight={700}
              fill="#dfe6fa"
            >
              🗳️ {d.label}
            </text>
          </g>
        ))}

        {series.slice().reverse().map(s => (
          <path
            key={s.id}
            d={path(s.values)}
            fill="none"
            stroke={s.color}
            strokeWidth={s.width}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {/* Con un solo round una linea non si vede: un punto per serie */}
        {rounds === 1 && series.map(s => (s.values[0] !== null
          ? <circle key={s.id} cx={x(1)} cy={y(s.values[0] as number)} r={4} fill={s.color} stroke="#0e1428" strokeWidth={2} />
          : null))}

        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={TOP} y2={H - BOTTOM} stroke="#dfe6fa" strokeWidth={1} />
            {series.map(s => {
              const v = s.values[hover - 1];
              return v === null || v === undefined
                ? null
                : <circle key={s.id} cx={x(hover)} cy={y(v)} r={4.5} fill={s.color} stroke="#0e1428" strokeWidth={2} />;
            })}
          </g>
        )}

        {rounds === 0 && (
          <text x={(LEFT + W - RIGHT) / 2} y={(TOP + H - BOTTOM) / 2} textAnchor="middle" fontSize={15} fill="#9aa5c4">
            Il grafico si riempie a ogni round, da Avvia Simulazione
          </text>
        )}
      </svg>

      {hover !== null && (
        <div
          className="fed-chart-tip"
          style={tipLeft > 60 ? { right: `${100 - tipLeft + 1.5}%`, top: 44 } : { left: `${tipLeft + 1.5}%`, top: 44 }}
        >
          <div><b>Round {hover}</b></div>
          {series.map(s => (
            <div key={s.id} className="fed-chart-tip-row">
              <i style={{ background: s.color, height: s.width }} />
              <b>{pct(s.values[hover - 1])}</b> {s.label}
            </div>
          ))}
          {hoverDecision && (
            <div>🗳️ {hoverDecision.label}{hoverDecision.effect ? ` · ${hoverDecision.effect}` : ''}</div>
          )}
        </div>
      )}

      {decisions.length > 0 && (
        <div className="fed-chart-decisions">
          {decisions.map((d, i) => (
            <span key={`${d.round}-${i}`}>
              {i > 0 ? ' · ' : '🗳️ Decisioni degli agenti: '}
              <b>round {d.round}</b> {d.label}{d.effect ? ` (${d.effect})` : ''}
            </span>
          ))}
        </div>
      )}

      {rounds > 0 && (
        <details>
          <summary>Tabella dei valori</summary>
          <table>
            <thead>
              <tr>
                <th>Round</th>
                {series.map(s => <th key={s.id}>{s.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {accuracy.map((_, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  {series.map(s => <td key={s.id}>{pct(s.values[i])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
};

export default FederationChart;
