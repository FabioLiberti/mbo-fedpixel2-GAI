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
          'professor': {
            title: 'Professore',
            description: 'Esperto in business intelligence e analisi dati',
            skills: ['Business analytics', 'Privacy economics', 'Data governance'],
            role: 'Supervisione progetti di analisi economica',
            background: 'Economia e statistica',
            color: '#d2691e', // Terracotta
            spritesheetPath: 'assets/characters/professor_spritesheet.png'
          },
          'researcher': {
            title: 'Ricercatore',
            description: 'Specialista in privacy e compliance normativa',
            skills: ['GDPR compliance', 'Privacy analytics', 'Data minimization'],
            role: 'Sviluppo metodologie di analisi privacy-preserving',
            background: 'Data Science e regolamentazione',
            color: '#1a365d', // Blu navy
            spritesheetPath: 'assets/characters/researcher_spritesheet.png'
          }
        },
        'blekinge': {
          'professor': {
            title: 'Professor',
            description: 'Esperto in algoritmi di aggregazione',
            skills: ['Advanced aggregation', 'Edge computing', 'Architecture design'],
            role: 'Coordina ricerche su FL avanzato',
            background: 'Computer Science',
            color: '#3f51b5', // Blu
            spritesheetPath: 'assets/characters/professor_spritesheet.png'
          },
          'researcher': {
            title: 'Researcher',
            description: 'Specialista in ottimizzazione per IoT',
            skills: ['Client selection', 'Communication efficiency', 'Quantization'],
            role: 'Sviluppo algoritmi ottimizzati',
            background: 'Distributed systems',
            color: '#4fc3f7', // Azzurro
            spritesheetPath: 'assets/characters/researcher_spritesheet.png'
          }
        },
        'opbg': {
          'doctor': {
            title: 'Medico',
            description: 'Medico specializzato in informatica medica',
            skills: ['Diagnostica', 'Modelli clinici', 'Analisi dati medici'],
            role: 'Validazione clinica',
            background: 'Medicina pediatrica',
            color: '#009688', // Verde acqua
            spritesheetPath: 'assets/characters/doctor.png'
          },
          'researcher': {
            title: 'Ricercatore',
            description: 'Ricercatore in imaging medico',
            skills: ['Medical imaging', 'Privacy medica', 'Integrazione dati'],
            role: 'Analisi dati sanitari',
            background: 'Bioinformatica',
            color: '#26a69a', // Verde
            spritesheetPath: 'assets/characters/researcher_spritesheet.png'
          }
        }
      };
      
      // Restituisci la configurazione di fallback per il laboratorio specificato
      return fallbackConfigs[labKey] || {};
    }
  }