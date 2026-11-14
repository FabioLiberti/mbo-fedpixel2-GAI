// frontend/src/components/FederationStrip.tsx
//
// Fascia della federazione, sempre visibile sopra la scena.
//
// Dentro un laboratorio si vede un laboratorio solo: questa fascia mostra che
// fa parte di una federazione. I tre laboratori, l'aggregatore con il modello
// globale, la fase del round in corso (i pesi che partono, l'aggregazione, il
// modello che torna) e, per ogni laboratorio, che cosa gli dà la federazione:
// il modello globale a confronto con il modello che quel laboratorio addestra
// da solo. Ogni numero arriva dal backend ed è misurato su pazienti che
// nessuno ha usato per addestrare.

import React, { useState } from 'react';
import { LABS } from './federationTheme';

interface StripProps {
  backendSimData?: any;
  /** Simulazione avviata e non in pausa */
  active: boolean;
  /** Laboratorio in cui ci si trova (null sulla mappa generale) */
  currentLabId: string | null;
}

// Fase del round, come la comunica il backend
const PHASES: Record<string, { label: string; detail: string }> = {
  training:    { label: 'Addestramento locale', detail: 'ogni laboratorio addestra il modello sui propri pazienti' },
  sending:     { label: 'Invio dei pesi', detail: 'i laboratori inviano i pesi del modello, non i dati' },
  aggregating: { label: 'Aggregazione', detail: "l'aggregatore fa la media pesata dei modelli ricevuti" },
  receiving:   { label: 'Ritorno del modello globale', detail: 'ogni laboratorio riceve il modello comune' },
};

const STRIP_STYLES = `
@keyframes fed-up   { 0% { transform: translateY(16px); opacity: 0; } 20% { opacity: 1; } 80% { opacity: 1; } 100% { transform: translateY(-4px); opacity: 0; } }
@keyframes fed-down { 0% { transform: translateY(-4px); opacity: 0; } 20% { opacity: 1; } 80% { opacity: 1; } 100% { transform: translateY(16px); opacity: 0; } }
@keyframes fed-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(240, 138, 60, 0.0); } 50% { box-shadow: 0 0 0 4px rgba(240, 138, 60, 0.55); } }
@keyframes fed-work  { 0%, 100% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.0); } 50% { box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.35); } }
.fed-strip {
  background: #0e1428; color: #fff; padding: 8px 12px 10px; border-radius: 8px 8px 0 0;
  font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; text-align: left;
}
.fed-strip.fed-idle { opacity: 0.78; }
.fed-head { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 12px; margin-bottom: 6px; }
.fed-title { font-size: 15px; font-weight: 800; letter-spacing: 1.5px; color: #f08a3c; }
.fed-round { font-size: 15px; font-weight: 800; }
.fed-phase { font-size: 14px; font-weight: 700; padding: 2px 10px; border-radius: 999px; background: #26304f; }
.fed-phase.fed-on { background: #f08a3c; color: #14182b; }
.fed-detail { font-size: 13px; color: #c9d2ea; }
.fed-legend { margin-left: auto; }
.fed-grid { display: grid; grid-template-columns: repeat(3, 1fr); column-gap: 10px; }
.fed-agg {
  grid-column: 1 / span 3; display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 4px 12px;
  background: #1b2440; border: 2px solid #f08a3c; border-radius: 8px; padding: 4px 10px; font-size: 14px;
}
.fed-agg.fed-busy { animation: fed-pulse 1.1s ease-in-out infinite; }
.fed-agg b { font-size: 15px; }
.fed-agg-acc { font-size: 18px; font-weight: 800; color: #f08a3c; }
.fed-channel { height: 18px; position: relative; }
.fed-channel::before { content: ''; position: absolute; left: 50%; top: 0; bottom: 0; border-left: 2px dashed #3a4568; }
.fed-dot { position: absolute; left: 50%; top: 0; margin-left: -3.5px; width: 8px; height: 8px; border-radius: 50%; opacity: 0; }
.fed-channel.fed-up .fed-dot   { animation: fed-up 1s linear infinite; }
.fed-channel.fed-down .fed-dot { animation: fed-down 1s linear infinite; background: #f08a3c !important; }
.fed-dot:nth-child(2) { animation-delay: 0.33s !important; }
.fed-dot:nth-child(3) { animation-delay: 0.66s !important; }
.fed-lab { background: #1b2440; border: 2px solid #2c3757; border-radius: 8px; padding: 5px 9px 6px; min-width: 0; }
.fed-lab.fed-here { background: #232e52; }
.fed-lab.fed-training { animation: fed-work 1.1s ease-in-out infinite; }
.fed-lab-head { display: flex; align-items: baseline; flex-wrap: wrap; gap: 2px 8px; }
.fed-lab-name { font-size: 16px; font-weight: 800; }
.fed-here-chip { font-size: 11px; font-weight: 800; padding: 1px 7px; border-radius: 999px; color: #14182b; }
.fed-lab-data { font-size: 12.5px; color: #c9d2ea; }
.fed-bar-row { display: flex; align-items: center; gap: 6px; font-size: 12.5px; margin-top: 3px; }
.fed-bar-label { width: 58px; flex: none; color: #dfe6fa; font-weight: 600; }
.fed-bar-track { flex: 1; height: 9px; background: #0e1428; border-radius: 5px; overflow: hidden; min-width: 30px; }
.fed-bar-fill { height: 100%; border-radius: 5px; transition: width 600ms ease; }
.fed-bar-value { width: 38px; flex: none; text-align: right; font-weight: 800; font-size: 13.5px; }
.fed-gain { font-size: 12.5px; font-weight: 700; margin-top: 2px; }
.fed-note { font-size: 12px; color: #9aa5c4; margin-top: 3px; }
.fed-foot { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 8px; margin-top: 6px; font-size: 12.5px; color: #c9d2ea; }
.fed-toggle { white-space: nowrap; border: 1px solid #3a4568; background: transparent; color: #c9d2ea; font-size: 12.5px; padding: 2px 9px; border-radius: 999px; cursor: pointer; }
.fed-toggle.fed-sel { background: #dfe6fa; color: #14182b; border-color: #dfe6fa; font-weight: 700; }
`;

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

const FederationStrip: React.FC<StripProps> = ({ backendSimData, active, currentLabId }) => {
  // Su quali pazienti si confrontano i due modelli: quelli di tutti i
  // laboratori (ciò a cui serve un modello comune) o solo i propri
  const [onOwn, setOnOwn] = useState(false);

  const fl = backendSimData?.fl;
  const federation = fl?.federation;
  const round: number = fl?.round ?? 0;
  const phase: string | null = active ? (fl?.current_phase ?? null) : null;
  const accuracyHistory: number[] = fl?.metrics?.accuracy || [];
  const accuracy = accuracyHistory.length ? accuracyHistory[accuracyHistory.length - 1] : null;
  const noise = fl?.params?.noise_multiplier;
  const privacyOn = fl?.dp?.enabled !== false;
  const commonRows: number = federation?.common_test_rows ?? 0;
  const wait = Math.max(0, Math.round(fl?.seconds_to_next_round ?? 0));

  const agents: any[] = Array.isArray(backendSimData?.agent_states) ? backendSimData.agent_states : [];
  const agentCount = (labId: string) => agents.filter(a => a?.lab_id === labId).length;

  let phaseLabel: string;
  let phaseDetail = '';
  if (!fl) {
    phaseLabel = 'La federazione parte con Avvia Simulazione';
  } else if (!active) {
    phaseLabel = round > 0 ? 'Federazione ferma' : 'La federazione parte con Avvia Simulazione';
  } else if (phase && PHASES[phase]) {
    phaseLabel = PHASES[phase].label;
    phaseDetail = PHASES[phase].detail;
  } else {
    phaseLabel = wait > 0 ? `Prossimo round tra ${wait} s` : 'In attesa del prossimo round';
  }

  return (
    <div className={`fed-strip${active ? '' : ' fed-idle'}`}>
      <style>{STRIP_STYLES}</style>

      <div className="fed-head">
        <span className="fed-title">FEDERAZIONE</span>
        <span className="fed-round">Round {round}</span>
        <span className={`fed-phase${phase ? ' fed-on' : ''}`}>{phaseLabel}</span>
        {phaseDetail && <span className="fed-detail">{phaseDetail}</span>}
      </div>

      <div className="fed-grid">
        <div className={`fed-agg${phase === 'aggregating' ? ' fed-busy' : ''}`}>
          <b>Aggregatore · modello globale</b>
          {accuracy !== null ? (
            <>
              <span className="fed-agg-acc">{pct(accuracy)}</span>
              <span>di accuracy su {commonRows} pazienti di test di tutti i laboratori</span>
            </>
          ) : (
            <span>nessun round completato</span>
          )}
        </div>

        {LABS.map(lab => (
          <div
            key={`ch-${lab.id}`}
            className={`fed-channel${phase === 'sending' ? ' fed-up' : phase === 'receiving' ? ' fed-down' : ''}`}
          >
            <span className="fed-dot" style={{ background: lab.color }} />
            <span className="fed-dot" style={{ background: lab.color }} />
            <span className="fed-dot" style={{ background: lab.color }} />
          </div>
        ))}

        {LABS.map(lab => {
          const info = federation?.labs?.[lab.id];
          const benefit = info?.benefit;
          const here = currentLabId === lab.id;
          const alone = benefit ? (onOwn ? benefit.alone_own : benefit.alone_common) : null;
          const federated = benefit ? (onOwn ? benefit.federated_own : benefit.federated_common) : null;
          const gain = alone !== null && federated !== null ? Math.round(federated * 100) - Math.round(alone * 100) : null;
          const count = agentCount(lab.id);
          return (
            <div
              key={lab.id}
              className={`fed-lab${here ? ' fed-here' : ''}${phase === 'training' ? ' fed-training' : ''}`}
              style={{ borderColor: here ? lab.color : undefined }}
            >
              <div className="fed-lab-head">
                <span className="fed-lab-name" style={{ color: lab.color }}>{lab.label}</span>
                {here && <span className="fed-here-chip" style={{ background: lab.color }}>SEI QUI</span>}
                <span className="fed-lab-data">
                  {info
                    ? `${info.train_rows} pazienti di ${info.age_min}–${info.age_max} anni`
                    : ''}
                  {count > 0 ? `${info ? ' · ' : ''}${count} agenti` : ''}
                </span>
              </div>

              {alone !== null && federated !== null ? (
                <>
                  <div className="fed-bar-row">
                    <span className="fed-bar-label">Da solo</span>
                    <span className="fed-bar-track">
                      <span className="fed-bar-fill" style={{ display: 'block', width: pct(alone), background: '#8d97b3' }} />
                    </span>
                    <span className="fed-bar-value">{pct(alone)}</span>
                  </div>
                  <div className="fed-bar-row">
                    <span className="fed-bar-label">Federato</span>
                    <span className="fed-bar-track">
                      <span className="fed-bar-fill" style={{ display: 'block', width: pct(federated), background: '#f08a3c' }} />
                    </span>
                    <span className="fed-bar-value" style={{ color: '#f08a3c' }}>{pct(federated)}</span>
                  </div>
                  <div className="fed-gain" style={{ color: gain! > 0 ? '#7bd88f' : gain! < 0 ? '#ff9c8a' : '#c9d2ea' }}>
                    {gain! > 0 && `La federazione dà ${gain} punti in più`}
                    {gain! < 0 && `Da solo fa ${-gain!} punti in più`}
                    {gain === 0 && 'Alla pari'}
                    {onOwn && <span className="fed-note"> su {benefit.own_test_rows} suoi pazienti di test</span>}
                  </div>
                </>
              ) : (
                <div className="fed-note">
                  {fl && federation && !federation.baseline_available
                    ? 'Confronto con il modello "da solo" non disponibile: questo run riprende da un salvataggio che non lo conteneva. Con Reset riparte.'
                    : 'Il confronto tra il modello "da solo" e quello federato compare dal primo round.'}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="fed-foot">
        <span>
          🔒 I dati dei pazienti restano nei laboratori: viaggiano solo i pesi del modello
          {privacyOn && typeof noise === 'number' ? `, con rumore di privacy ${noise.toFixed(2)}` : ''}
        </span>
        <span className="fed-legend">
          <b>Da solo</b> = modello addestrato solo sui propri pazienti, senza scambi · <b>Federato</b> = modello globale · confronto su
        </span>
        <button type="button" className={`fed-toggle${!onOwn ? ' fed-sel' : ''}`} onClick={() => setOnOwn(false)}>
          {commonRows > 0 ? `${commonRows} pazienti di test di tutti i laboratori` : 'pazienti di test di tutti i laboratori'}
        </button>
        <button type="button" className={`fed-toggle${onOwn ? ' fed-sel' : ''}`} onClick={() => setOnOwn(true)}>
          i propri pazienti di test
        </button>
      </div>
    </div>
  );
};

export default FederationStrip;
