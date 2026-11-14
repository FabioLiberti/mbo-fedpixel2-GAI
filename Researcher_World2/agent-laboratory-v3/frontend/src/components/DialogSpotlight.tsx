// frontend/src/components/DialogSpotlight.tsx
//
// Pop-up grande sopra la scena: mostra a caratteri molto grandi chi sta
// parlando, a chi, e che cosa dice, nello stesso istante in cui il fumetto
// compare sull'agente. Mostra allo stesso modo le decisioni del consorzio.
// Serve a far seguire la dinamica della scena anche da lontano.

import React, { useEffect, useRef, useState } from 'react';
import { getGameInstance } from '../phaser/game';

interface SpotlightProps {
  backendSimData?: any;
}

interface SpotlightItem {
  key: number;
  kind: 'speech' | 'decision';
  speaker: string;
  role: string;          // tipo di agente (famiglia)
  target: string | null;
  text: string;
  isLLM: boolean;
  remoteLab: string | null;
  atTop: boolean;        // posizione del pop-up: in alto se chi parla è in basso
  until: number;
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

const STYLE_ID = 'dialog-spotlight-style';
const CSS = `
@keyframes spotlight-pop {
  0%   { opacity: 0; transform: translateX(-50%) scale(0.82); }
  60%  { opacity: 1; transform: translateX(-50%) scale(1.03); }
  100% { opacity: 1; transform: translateX(-50%) scale(1); }
}
.dialog-spotlight {
  position: absolute; left: 50%; transform: translateX(-50%);
  width: 88%; max-width: 1000px; z-index: 40; pointer-events: none;
  background: rgba(14, 20, 40, 0.93); color: #fff; border-radius: 20px;
  padding: 16px 26px 20px; box-shadow: 0 14px 40px rgba(0, 0, 0, 0.55);
  animation: spotlight-pop 320ms ease-out;
  font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; text-align: left;
}
.dialog-spotlight-who { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 8px; }
.dialog-spotlight-name { font-size: 28px; font-weight: 800; line-height: 1.1; }
.dialog-spotlight-chip {
  font-size: 16px; font-weight: 700; padding: 3px 12px; border-radius: 999px; color: #fff;
}
.dialog-spotlight-to { font-size: 20px; color: #c9d2ea; font-weight: 600; }
.dialog-spotlight-ai {
  font-size: 15px; font-weight: 800; padding: 2px 9px; border-radius: 6px; background: #3b6fd4; color: #fff;
}
.dialog-spotlight-text { font-weight: 700; line-height: 1.22; }
`;

/** Dimensione del testo: enorme per le battute brevi, un po' meno per le lunghe. */
function textSize(text: string): number {
  if (text.length <= 60) return 44;
  if (text.length <= 100) return 38;
  if (text.length <= 150) return 32;
  return 27;
}

const DialogSpotlight: React.FC<SpotlightProps> = ({ backendSimData }) => {
  const [item, setItem] = useState<SpotlightItem | null>(null);
  const counterRef = useRef(0);
  const rolesRef = useRef<Record<string, { role: string; lab: string }>>({});
  const lockedUntilRef = useRef(0);        // una decisione resta a schermo per un tempo minimo
  const seenDecisionRef = useRef<number | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stile (una sola volta)
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

  const show = (next: Omit<SpotlightItem, 'key' | 'until'>, duration: number) => {
    const now = Date.now();
    if (next.kind === 'speech' && now < lockedUntilRef.current) return;
    counterRef.current += 1;
    const until = now + duration;
    if (next.kind === 'decision') lockedUntilRef.current = now + Math.min(duration, 6000);
    setItem({ ...next, key: counterRef.current, until });
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    const key = counterRef.current;
    hideTimerRef.current = setTimeout(() => {
      setItem(current => (current && current.key === key ? null : current));
    }, duration);
  };

  // Battute: lo stesso evento che fa comparire il fumetto sull'agente
  useEffect(() => {
    let attached: any = null;
    let retry: ReturnType<typeof setInterval> | null = null;

    const onDialog = (d: any) => {
      if (!d || d.kind !== 'speech' || !d.text) return;
      const info = rolesRef.current[d.speakerName] || { role: d.speakerRole || 'researcher', lab: '' };
      show({
        kind: 'speech',
        speaker: d.speakerName || 'Agente',
        role: ROLE_FAMILY[info.role] || 'researcher',
        target: d.targetName || null,
        text: String(d.text),
        isLLM: Boolean(d.isLLM),
        remoteLab: d.remote ? (LAB_LABEL[info.lab] || info.lab || 'altro laboratorio') : null,
        atTop: typeof d.y === 'number' && typeof d.sceneHeight === 'number'
          ? d.y > d.sceneHeight * 0.5
          : false,
      }, Math.max(2500, Math.min(Number(d.duration) || 4500, 9000)));
    };

    const attach = () => {
      const game = getGameInstance();
      if (!game) return false;
      game.events.on('dialog-shown', onDialog);
      attached = game;
      return true;
    };
    if (!attach()) {
      retry = setInterval(() => { if (attach() && retry) { clearInterval(retry); retry = null; } }, 500);
    }
    return () => {
      if (retry) clearInterval(retry);
      if (attached) attached.events.off('dialog-shown', onDialog);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Decisioni del consorzio: ogni nuova decisione compare a tutto schermo
  useEffect(() => {
    const decisions = backendSimData?.fl?.decisions;
    if (!Array.isArray(decisions) || decisions.length === 0) {
      seenDecisionRef.current = null;
      return;
    }
    const last = decisions[decisions.length - 1];
    if (seenDecisionRef.current === last.round) return;
    const first = seenDecisionRef.current === null && decisions.length > 1;
    seenDecisionRef.current = last.round;
    if (first) return; // pagina appena aperta su una sessione già avviata: niente arretrati

    const winners = (last.proposals || [])
      .filter((p: any) => p.option === last.option)
      .map((p: any) => p.agent);
    const change = last.changed
      ? (last.before.noise !== last.after.noise
        ? `da ${Number(last.before.noise).toFixed(2)} a ${Number(last.after.noise).toFixed(2)}`
        : `da ${last.before.epochs} a ${last.after.epochs}`)
      : '';
    const text = last.changed
      ? `Si è deciso di ${last.option_text}, ${change}.`
      : 'Dopo la discussione si è deciso di non cambiare nulla.';
    show({
      kind: 'decision',
      speaker: `Decisione del round ${last.round}`,
      role: 'consortium',
      target: winners.length ? `su proposta di ${winners.join(' e ')}` : null,
      text,
      isLLM: (last.proposals || []).some((p: any) => p.from_llm),
      remoteLab: null,
      atTop: false,
    }, 7000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendSimData?.fl?.decisions]);

  if (!item) return null;
  const style = FAMILY_STYLE[item.role] || FAMILY_STYLE.researcher;

  return (
    <div
      key={item.key}
      className="dialog-spotlight"
      style={{
        ...(item.atTop ? { top: 14 } : { bottom: 14 }),
        border: `5px solid ${style.color}`,
      }}
    >
      <div className="dialog-spotlight-who">
        <span style={{ fontSize: 34 }}>{style.icon}</span>
        <span className="dialog-spotlight-name" style={{ color: style.color }}>{item.speaker}</span>
        <span className="dialog-spotlight-chip" style={{ background: style.color }}>{style.label}</span>
        {item.remoteLab && (
          <span className="dialog-spotlight-chip" style={{ background: '#555d75' }}>
            in collegamento da {item.remoteLab}
          </span>
        )}
        {item.target && (
          <span className="dialog-spotlight-to">
            {item.kind === 'decision' ? item.target : `→ a ${item.target}`}
          </span>
        )}
        {item.isLLM && <span className="dialog-spotlight-ai">AI</span>}
      </div>
      <div className="dialog-spotlight-text" style={{ fontSize: textSize(item.text) }}>
        {item.text}
      </div>
    </div>
  );
};

export default DialogSpotlight;
