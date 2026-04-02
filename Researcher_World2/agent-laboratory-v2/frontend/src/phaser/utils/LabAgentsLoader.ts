// frontend/src/phaser/utils/LabAgentsLoader.ts

/**
 * Classe utilitaria per caricare agenti specifici per un determinato laboratorio
 */
export class LabAgentsLoader {
    /**
     * Carica la configurazione degli agenti specifica per un laboratorio
     * @param scene La scena Phaser
     * @param labKey Chiave del laboratorio (mercatorum, blekinge, opbg)
     * @returns Promise con i dati degli agenti filtrati per il laboratorio specificato
     */
    public static async loadLabSpecificAgents(
      scene: Phaser.Scene, 
      labKey: 'mercatorum' | 'blekinge' | 'opbg'
    ): Promise<Record<string, any>> {
      return new Promise((resolve, reject) => {
        try {
          // Carica il file JSON con tutte le configurazioni
          scene.load.json('labAgentTypesConfig', 'assets/config/labAgentTypes.json');
          
          // Gestisci il completamento del caricamento
          scene.load.once('complete', () => {
            try {
              // Ottieni la configurazione completa
              const fullConfig = scene.cache.json.get('labAgentTypesConfig');
              
              // Verifica che esista la configurazione per il laboratorio specificato
              if (!fullConfig || !fullConfig[labKey]) {
                console.warn(`No configuration found for lab: ${labKey}`);
                resolve({});
                return;
              }
              
              // Estrai e restituisci solo la configurazione per il laboratorio specificato
              const labConfig = fullConfig[labKey];
              console.log(`Loaded agent configuration for ${labKey} lab:`, 
                Object.keys(labConfig).length, 'agent types');
              
              resolve(labConfig);
            } catch (error) {
              console.error('Error processing lab agent types:', error);
              reject(error);
            }
          });
          
          // Gestisci errori di caricamento
          scene.load.once('loaderror', (fileObj: any) => {
            // Se il file non esiste o c'è un errore, prova a utilizzare un fallback
            console.warn('Error loading lab agent types config, using fallback');
            this.getLabSpecificAgentsFallback(labKey).then(resolve).catch(reject);
          });
          
          // Avvia il caricamento
          scene.load.start();
        } catch (error) {
          console.error('Error in loadLabSpecificAgents:', error);
          // Fallback in caso di errore
          this.getLabSpecificAgentsFallback(labKey).then(resolve).catch(reject);
        }
      });
    }
    
    /**
     * Fornisce una configurazione di fallback se il file JSON non può essere caricato
     * @param labKey Chiave del laboratorio
     * @returns Promise con configurazione di fallback
     */
    private static async getLabSpecificAgentsFallback(
      labKey: 'mercatorum' | 'blekinge' | 'opbg'
    ): Promise<Record<string, any>> {
      // Configurazioni di fallback predefinite per ciascun laboratorio
      const fallbackConfigs: Record<string, Record<string, any>> = {
        'mercatorum': {
          'professor6': {
            title: 'Professoressa', description: 'Esperto in business intelligence',
            skills: ['Business analytics', 'Privacy economics'], role: 'Supervisione progetti',
            background: 'Economia', color: '#7B1FA2',
            spritesheetPath: 'assets/characters/professor6_spritesheet_32x48.png'
          },
          'privacy_specialist_portrait': {
            title: 'Privacy Specialist', description: 'Esperto in privacy e compliance',
            skills: ['GDPR compliance', 'Differential Privacy'], role: 'Garanzia privacy',
            background: 'Crittografia', color: '#607D8B',
            spritesheetPath: 'assets/sprites/1024x1536/_Manager.png'
          },
          'student': {
            title: 'Dottorando', description: 'Studente di dottorato',
            skills: ['Data Science', 'Business analytics'], role: 'Supporto ricerca',
            background: 'Finanza Quantitativa', color: '#FB8C00',
            spritesheetPath: 'assets/characters/student_spritesheet.png'
          },
          'researcher': {
            title: 'Ricercatore', description: 'Specialista in privacy analytics',
            skills: ['GDPR compliance', 'Privacy analytics'], role: 'Analisi privacy-preserving',
            background: 'Data Science', color: '#1a365d',
            spritesheetPath: 'assets/characters/researcher_spritesheet.png'
          }
        },
        'blekinge': {
          'professor_senior': {
            title: 'Professor Senior', description: 'Esperto in algoritmi di aggregazione',
            skills: ['Advanced aggregation', 'Edge computing'], role: 'Coordina ricerche FL',
            background: 'Computer Science', color: '#0D47A1',
            spritesheetPath: 'assets/characters/professor_spritesheet.png'
          },
          'student': {
            title: 'PhD Student', description: 'Studente specializzato in edge computing',
            skills: ['Quantizzazione', 'Privacy Engineering'], role: 'Ricerca IoT',
            background: 'Ingegneria', color: '#FB8C00',
            spritesheetPath: 'assets/characters/student_spritesheet.png'
          },
          'sw_engineer': {
            title: 'SW Engineer', description: 'Ingegnere piattaforme FL',
            skills: ['Platform Development', 'API Design'], role: 'Sviluppo infrastruttura',
            background: 'Sistemi distribuiti', color: '#26A69A',
            spritesheetPath: 'assets/characters/researcher_spritesheet.png'
          },
          'engineer': {
            title: 'ML Engineer', description: 'Implementazione algoritmi FL',
            skills: ['Model Optimization', 'Systems Integration'], role: 'Implementazione efficiente',
            background: 'ML applicato', color: '#F44336',
            spritesheetPath: 'assets/characters/engineer_spritesheet.png'
          }
        },
        'opbg': {
          'doctor': {
            title: 'Medico', description: 'Medico in informatica medica',
            skills: ['Diagnostica', 'Modelli clinici'], role: 'Validazione clinica',
            background: 'Pediatria', color: '#00B8D4',
            spritesheetPath: 'assets/characters/doctor_spritesheet.png'
          },
          'student_postdoc': {
            title: 'Post-Doc', description: 'Ricercatore post-doc',
            skills: ['Algorithm Implementation', 'Data Preprocessing'], role: 'Test prototipi',
            background: 'Informatica', color: '#FB8C00',
            spritesheetPath: 'assets/characters/student_spritesheet.png'
          },
          'engineer': {
            title: 'Biomedical Engineer', description: 'Integrazione dispositivi medici',
            skills: ['Biosegnali', 'Sistemi sanitari'], role: 'Integrazione dati medici',
            background: 'Ingegneria biomedica', color: '#F44336',
            spritesheetPath: 'assets/characters/engineer_spritesheet.png'
          },
          'researcher': {
            title: 'Ricercatore Biomedico', description: 'Imaging medico e dati genetici',
            skills: ['Medical imaging', 'Privacy medica'], role: 'Diagnosi collaborativa',
            background: 'Bioinformatica', color: '#7B1FA2',
            spritesheetPath: 'assets/characters/researcher_spritesheet.png'
          }
        }
      };
      
      // Restituisci la configurazione di fallback per il laboratorio specificato
      return fallbackConfigs[labKey] || {};
    }
  }