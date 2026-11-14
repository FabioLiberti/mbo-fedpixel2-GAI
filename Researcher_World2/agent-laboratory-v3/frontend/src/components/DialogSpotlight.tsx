// frontend/src/components/DialogSpotlight.tsx
//
// Pop-up grande sopra la scena e regia delle battute.
//
// Tutto ciò che gli agenti dicono è scritto dal modello sui dati reali del
// federated learning e arriva dal backend. Questo componente lo mette in fila
// e lo mostra UNA battuta alla volta, a caratteri molto grandi, per un tempo
// sufficiente a leggerla (almeno 6 secondi), dicendo alla scena chi si avvicina
// a chi e chi sta parlando. Non scrive alcuna battuta: se il modello non ha
// prodotto nulla, non viene mostrato nulla.

import React, { useEffect, useRef, useState } from 'react';
import { getGameInstance } from '../phaser/game';

interface SpotlightProps {
  backendSimData?: any;
  /** Simulazione avviata e non in pausa: solo allora le battute scorrono */
  active: boolean;
  /** Il modello è acceso e raggiungibile */
  modelReady: boolean;
}

interface Line {
  kind: 'speech' | 'decision';
  speaker: string;
  listener: string | null;
  text: string;
  detail?: string;
  isLLM: boolean;
}

interface Shown extends Line {
  key: number;
  role: string;
  remoteLab: string | null;
}

// Durata a schermo di una battuta: almeno 6 secondi, di più se è lunga
const MIN_LINE_MS = 6500;
const MAX_LINE_MS = 10000;
// Una conversazione parla dei risultati di un certo round: se quando viene il
// suo turno la simulazione è già più avanti di così, non viene più mostrata
const MAX_ROUNDS_OLD = 3;
const GAP_MS = 500;            // pausa tra una battuta e la successiva
const APPROACH_MS = 3500;      // tempo dato ai due agenti per avvicinarsi
const MAX_QUEUE = 3;           // oltre, le conversazioni più vecchie si saltano

function lineDuration(text: string): number {
  return Math.max(MIN_LINE_MS, Math.min(MAX_LINE_MS, MIN_LINE_MS + (text.length - 80) * 40));
}

// Tipo di agente → famiglia (come nel backend: cognitive/role_dialogs.py)
const ROLE_FAMILY: Record<string, string> = {
  student: 'student', student_postdoc: 'student',
  professor: 'professor', professor_senior: 'professor',
  researcher: 'researcher', privacy_specialist: 'privacy',
  doctor: 'doctor', engineer: 'engineer', sw_engineer: 'engineer',
};

const FAMILY_STYLE: Record<string, { label: string; icon: string; color: string }> = {
  student:    { label: 'Studente',               icon: '📚', color: '#3fae5a' },
  professor:  { label: 'Professore',             icon: '🎓', color: '#9b5de5' },
  researcher: { label: 'Ricercatore',            icon: '🔬', color: '#2f8fe0' },
  privacy:    { label: 'Specialista di privacy', icon: '🔒', color: '#e0483c' },
  doctor:     { label: 'Medico',                 icon: '🩺', color: '#17a2a2' },
  engineer:   { label: 'Ingegnere',              icon: '🛠️', color: '#e08a1e' },
  consortium: { label: 'Consorzio federato',     icon: '🗳️', color: '#d9733a' },
};

const LAB_LABEL: Record<string, string> = {
  mercatorum: 'Mercatorum', blekinge: 'Blekinge', opbg: 'OPBG',
};
const SCENE_LAB: Record<string, string> = {
  MercatorumLabScene: 'mercatorum', BlekingeLabScene: 'blekinge', OPBGLabScene: 'opbg',
};

const STYLE_ID = 'dialog-spotlight-style';
const CSS = `
@keyframes spotlight-pop {
  0%   { opacity: 0; transform: translateX(-50%) scale(0.82); }
  60%  { opacity: 1; transform: translateX(-50%) scale(1.03); }
  100% { opacity: 1; transform: translateX(-50%) scale(1); }
}
.dialog-spotlight {
  position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%);
  width: 88%; max-width: 1000px; z-index: 40; pointer-events: none;
  background: rgba(14, 20, 40, 0.93); color: #fff; border-radius: 20px;
  padding: 16px 26px 20px; box-shadow: 0 14px 40px rgba(0, 0, 0, 0.55);
  animation: spotlight-pop 320ms ease-out;
  font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; text-align: left;
}
.dialog-spotlight-who { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 8px; }
.dialog-spotlight-name { font-size: 28px; font-weight: 800; line-height: 1.1; }
.dialog-spotlight-chip { font-size: 16px; font-weight: 700; padding: 3px 12px; border-radius: 999px; color: #fff; }
.dialog-spotlight-to { font-size: 20px; color: #c9d2ea; font-weight: 600; }
.dialog-spotlight-ai { font-size: 15px; font-weight: 800; padding: 2px 9px; border-radius: 6px; background: #3b6fd4; color: #fff; }
.dialog-spotlight-text { font-weight: 700; line-height: 1.22; }
.dialog-spotlight-detail { font-size: 20px; color: #c9d2ea; font-weight: 600; margin-top: 8px; }
.dialog-spotlight-wait {
  position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%); z-index: 39;
  pointer-events: none; background: rgba(14, 20, 40, 0.78); color: #dfe6fa; border-radius: 999px;
  padding: 7px 18px; font-size: 15px; font-weight: 600; white-space: nowrap;
  font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}
`;

/** Dimensione del testo: enorme per le battute brevi, un po' meno per le lunghe. */
function textSize(text: string): number {
  if (text.length <= 60) return 44;
  if (text.length <= 100) return 38;
  if (text.length <= 150) return 32;
  return 27;
}

/** Le battute di un elemento del flusso del backend (conversazione, proposta, decisione). */
function linesOf(item: any): Line[] {
  if (item.kind === 'decision' && item.decision) {
    const d = item.decision;
    const winners = (d.proposals || []).filter((p: any) => p.option === d.option).map((p: any) => p.agent);
    const change = d.changed
      ? (d.before.noise !== d.after.noise
        ? `da ${Number(d.before.noise).toFixed(2)} a ${Number(d.after.noise).toFixed(2)}`
        : `da ${d.before.epochs} a ${d.after.epochs}`)
      : '';
    return [{
      kind: 'decision',
      speaker: `Decisione del round ${d.round}`,
      listener: null,
      text: d.changed ? `Si è deciso di ${d.option_text}, ${change}.` : 'Si è deciso di non cambiare nulla.',
      detail: winners.length ? `Voto: ${winners.join(', ')}` : undefined,
      isLLM: false,
    }];
  }
  const names: string[] = item.agents || [];
  return (item.dialog || []).map(([speaker, text]: [string, string]) => ({
    kind: 'speech' as const,
    speaker,
    listener: names.find(n => n !== speaker) || null,
    text: String(text),
    detail: item.kind === 'proposal' ? `Proposta per il round ${item.round}: ${item.option_text}` : undefined,
    isLLM: Boolean(item.is_llm),
  }));
}

const DialogSpotlight: React.FC<SpotlightProps> = ({ backendSimData, active, modelReady }) => {
  const [shown, setShown] = useState<Shown | null>(null);
  const queueRef = useRef<any[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const playingRef = useRef(false);
  const runRef = useRef(0);                 // cambia a ogni arresto: ferma la regia in corso
  const counterRef = useRef(0);
  const activeRef = useRef(active);
  const rolesRef = useRef<Record<string, { role: string; lab: string }>>({});
  const roundRef = useRef<number>(0);
  activeRef.current = active;
  roundRef.current = Number(backendSimData?.fl?.round || 0);

  useEffect(() => {
    if (document.getElementById(STYLE_ID)) return;
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = CSS;
    document.head.appendChild(el);
  }, []);

  // Ruolo e laboratorio di ogni agente, dal backend
  useEffect(() => {
    const agents = backendSimData?.agent_states;
    if (!Array.isArray(agents)) return;
    const map: Record<string, { role: string; lab: string }> = {};
    for (const a of agents) {
      if (a?.name) map[a.name] = { role: a.role || 'researcher', lab: a.lab_id || '' };
    }
    rolesRef.current = map;
  }, [backendSimData?.agent_states]);

  const emit = (event: string, data?: any) => {
    try {
      const game = getGameInstance();
      if (game) game.events.emit(event, data);
    } catch (err) {
      console.error(`[DialogSpotlight] ${event} error:`, err);
    }
  };

  const currentLab = (): string | null => {
    try {
      const game = getGameInstance();
      const scenes = game ? game.scene.getScenes(true) : [];
      for (const sc of scenes) {
        const lab = SCENE_LAB[sc.scene.key];
        if (lab) return lab;
      }
    } catch { /* nessuna scena attiva */ }
    return null;
  };

  const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

  // Regia: un elemento alla volta, una battuta alla volta
  const play = async () => {
    if (playingRef.current) return;
    playingRef.current = true;
    const run = runRef.current;
    const stopped = () => run !== runRef.current || !activeRef.current;
    try {
      while (queueRef.current.length > 0 && !stopped()) {
        const item = queueRef.current.shift();
        const lines = linesOf(item);
        if (lines.length === 0) continue;
        // Una conversazione rimasta troppo in coda parlerebbe di numeri che a
        // schermo non ci sono più: si salta (le decisioni si mostrano sempre)
        const roundNow = Number(roundRef.current || 0);
        if ((item.kind || 'conversation') !== 'decision'
            && roundNow - Number(item.round || 0) > MAX_ROUNDS_OLD) continue;

        const names: string[] = item.agents || [];
        if (item.kind === 'conversation' && names.length === 2) {
          emit('stage-approach', { agents: names });
          await sleep(APPROACH_MS);
          if (stopped()) break;
        }

        for (let i = 0; i < lines.length && !stopped(); i++) {
          const line = lines[i];
          const duration = lineDuration(line.text);
          const info = rolesRef.current[line.speaker];
          const lab = currentLab();
          counterRef.current += 1;
          setShown({
            ...line,
            key: counterRef.current,
            role: line.kind === 'decision' ? 'consortium' : (ROLE_FAMILY[info?.role || ''] || 'researcher'),
            remoteLab: line.kind === 'speech' && info && lab && info.lab !== lab
              ? (LAB_LABEL[info.lab] || info.lab)
              : null,
          });
          if (line.kind === 'speech') {
            emit('stage-line', {
              speakerName: line.speaker, listenerName: line.listener,
              text: line.text, duration, isLLM: line.isLLM, index: i,
            });
          }
          await sleep(duration);
          if (stopped()) break;
          setShown(null);
          await sleep(GAP_MS);
        }
        emit('stage-end');
      }
    } finally {
      playingRef.current = false;
      if (stopped()) setShown(null);
    }
  };

  // Nuovi elementi dal backend entrano in coda (una sola volta ciascuno)
  useEffect(() => {
    const feed = backendSimData?.fl?.conversations;
    if (!Array.isArray(feed)) return;
    if (feed.length === 0) { seenRef.current = new Set(); return; }
    for (const item of feed) {
      const key = `${item.kind || 'conversation'}|${item.round}|${item.lab_id}|${(item.agents || []).join('+')}`;
      if (seenRef.current.has(key)) continue;
      seenRef.current.add(key);
      if (!activeRef.current) continue;       // a simulazione ferma non si accoda nulla
      queueRef.current.push(item);
    }
    // Se il modello produce più in fretta di quanto si riesca a leggere, le
    // conversazioni più vecchie si saltano; proposte e decisioni restano
    while (queueRef.current.length > MAX_QUEUE) {
      const idx = queueRef.current.findIndex(q => (q.kind || 'conversation') === 'conversation');
      queueRef.current.splice(idx >= 0 ? idx : 0, 1);
    }
    if (activeRef.current) play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendSimData?.fl?.conversations]);

  // Arresto o pausa: la regia si ferma e la scena si svuota
  useEffect(() => {
    if (active) { play(); return; }
    runRef.current += 1;
    queueRef.current = [];
    setShown(null);
    emit('stage-end');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (!shown) {
    if (!active) return null;
    const round = backendSimData?.fl?.round;
    return (
      <div className="dialog-spotlight-wait">
        {modelReady
          ? `💭 Il modello sta scrivendo la prossima conversazione${round ? ` sui risultati del round ${round}` : ''}…`
          : '⚠️ Modello non disponibile: il federated learning prosegue, ma gli agenti non parlano'}
      </div>
    );
  }

  const style = FAMILY_STYLE[shown.role] || FAMILY_STYLE.researcher;
  return (
    <div key={shown.key} className="dialog-spotlight" style={{ border: `5px solid ${style.color}` }}>
      <div className="dialog-spotlight-who">
        <span style={{ fontSize: 34 }}>{style.icon}</span>
        <span className="dialog-spotlight-name" style={{ color: style.color }}>{shown.speaker}</span>
        <span className="dialog-spotlight-chip" style={{ background: style.color }}>{style.label}</span>
        {shown.remoteLab && (
          <span className="dialog-spotlight-chip" style={{ background: '#555d75' }}>
            in collegamento da {shown.remoteLab}
          </span>
        )}
        {shown.kind === 'speech' && shown.listener && (
          <span className="dialog-spotlight-to">→ a {shown.listener}</span>
        )}
        {shown.isLLM && <span className="dialog-spotlight-ai">AI</span>}
      </div>
      <div className="dialog-spotlight-text" style={{ fontSize: textSize(shown.text) }}>
        {shown.text}
      </div>
      {shown.detail && <div className="dialog-spotlight-detail">{shown.detail}</div>}
    </div>
  );
};

export default DialogSpotlight;
