// Stati dell'agente di base
export enum AgentState {
    IDLE = 'idle',
    WORKING = 'working',
    MEETING = 'meeting',
    RESTING = 'resting',
    MOVING = 'moving',
    DISCUSSING = 'discussing',
    PRESENTING = 'presenting'
  }
  
  // Tipi di ricercatori (sia per ResearcherAgent che per MedicalResearcher)
  export type ResearcherType = 
    'phd-student' | 
    'researcher' | 
    'professor' | 
    'ml-engineer' | 
    'data-engineer' | 
    'privacy-specialist' |
    'medical-doctor' |
    'biomedical-engineer' |
    'postdoc';
  
  // Specializzazioni per i ricercatori
  export type Specialization = 
    // PhD Student
    'data-science' | 
    'privacy-engineering' | 
    'optimization-theory' |
    // Researcher
    'secure-aggregation' | 
    'non-iid-data' | 
    'communication-efficiency' |
    // Professor
    'fl-architecture' | 
    'theoretical-guarantees' | 
    'privacy-economics' |
    // ML Engineer
    'model-optimization' | 
    'systems-integration' | 
    'empirical-evaluation' |
    // Data Engineer
    'data-pipeline' | 
    'heterogeneous-data' | 
    'quality-assurance' |
    // Privacy Specialist
    'differential-privacy' | 
    'attack-simulation' | 
    'compliance-verification' |
    // Medical Doctor
    'clinical-data' |
    'diagnostic-model' |
    'patient-specific' |
    // Biomedical Engineer
    'medical-imaging' |
    'biosignal-processing' |
    'medical-device';
  
  // Stati specifici per ricercatori
  export type ResearcherState = 
    'idle' |
    'moving' |
    'working' |
    'resting' |
    'meeting' |
    'discussing' |
    'presenting' |
    'researching';
  
  // Stati specifici per ricercatori medici
  export type MedicalResearcherState = 
    'idle' |
    'moving' |
    'working' |
    'resting' |
    'researching' |
    'analyzing' |
    'writing' |
    'diagnostics' |
    'patient-review' |
    'medical-analysis' |
    // Stati aggiuntivi per compatibilità
    'meeting' | 
    'discussing' | 
    'presenting' | 
    'collaborating';
  
  // Tema per i laboratori
  export interface LabTheme {
    name: string;
    backgroundColor: number;
    tilesetKey: string;
    colorPalette: {
      primary: number;
      secondary: number;
      accent: number;
      background: number;
    };
  }
  
  // Skills medici
  export interface MedicalSkills {
    diagnostics: number;
    'patient-care': number;
    'medical-analytics': number;
    research: number;
    ethics: number;
    collaboration: number;
  }