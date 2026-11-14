// frontend/src/components/federationTheme.ts
//
// Ciò che la fascia della federazione e il pop-up dei dialoghi hanno in
// comune: i tre laboratori con i loro colori e il ritratto di ogni agente
// (la stessa immagine con cui compare nella scena del suo laboratorio).

export interface LabTheme {
  id: string;
  label: string;
  color: string;
}

export const LABS: LabTheme[] = [
  // Colori distinguibili tra loro anche con una visione ridotta dei colori, su fondo scuro
  { id: 'mercatorum', label: 'Mercatorum', color: '#c48626' },
  { id: 'blekinge',   label: 'Blekinge',   color: '#4a90d9' },
  { id: 'opbg',       label: 'OPBG',       color: '#3aa56c' },
];

export const LAB_BY_ID: Record<string, LabTheme> = Object.fromEntries(LABS.map(lab => [lab.id, lab]));

export interface Portrait {
  url: string;
  /** Foglio di sprite 128x48 con 4 fotogrammi da 32x48 (si mostra il primo), oppure immagine intera */
  sheet: boolean;
}

const CHARACTERS = `${process.env.PUBLIC_URL || ''}/assets/characters`;

// Foglio di sprite per ruolo, come nelle scene dei laboratori
const ROLE_SHEET: Record<string, string> = {
  professor: 'professor_spritesheet.png',
  professor_senior: 'professor_spritesheet.png',
  student: 'student_spritesheet.png',
  student_postdoc: 'student_spritesheet.png',
  researcher: 'researcher_spritesheet.png',
  sw_engineer: 'researcher_spritesheet.png',
  privacy_specialist: 'researcher_spritesheet.png',
  engineer: 'engineer_spritesheet.png',
  doctor: 'doctor_spritesheet.png',
};

// Agenti che nella scena hanno un'immagine propria
const OWN_PORTRAIT: Record<string, Portrait> = {
  'Elena Conti': { url: `${CHARACTERS}/professor6_spritesheet_32x48.png`, sheet: true },
  'Luca Bianchi': { url: `${process.env.PUBLIC_URL || ''}/assets/sprites/1024x1536/_Manager.png`, sheet: false },
};

export function portraitOf(name: string, role: string): Portrait {
  return OWN_PORTRAIT[name] || { url: `${CHARACTERS}/${ROLE_SHEET[role] || ROLE_SHEET.researcher}`, sheet: true };
}
