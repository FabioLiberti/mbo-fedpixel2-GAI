// src/phaser/agents/agentConfig.ts

export const AGENT_CONFIG = {
    mercatorum: {
      agents: [
        {
          type: 'professor',
          name: 'Prof. Bianchi',
          position: { x: 100, y: 150 },
          specialization: 'business_intelligence'
        },
        {
          type: 'researcher',
          name: 'Dr. Rossi',
          position: { x: 250, y: 200 },
          specialization: 'financial_analysis'
        }
        // Altri operatori specifici per Mercatorum
      ]
    },
    blekinge: {
      agents: [
        {
          type: 'professor',
          name: 'Prof. Johansson',
          position: { x: 150, y: 200 },
          specialization: 'algorithms'
        },
        {
          type: 'researcher',
          name: 'Dr. Andersson',
          position: { x: 300, y: 250 },
          specialization: 'iot_optimization'
        },
        {
          type: 'phdstudent',
          name: 'Dr. Letizia',
          position: { x: 200, y: 150 },
          specialization: 'fl_heterogeneous'
        }
        // Altri operatori specifici per Blekinge
      ]
    },
    opbg: {
      agents: [
        {
          type: 'doctor',
          name: 'Dr. Verdi',
          position: { x: 200, y: 180 },
          specialization: 'clinical_data'
        },
        {
          type: 'researcher',
          name: 'Dr. Ferrari',
          position: { x: 350, y: 230 },
          specialization: 'medical_imaging'
        }
        // Altri operatori specifici per OPBG
      ]
    }
  };