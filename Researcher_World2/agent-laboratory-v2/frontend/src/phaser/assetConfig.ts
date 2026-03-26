// frontend/src/phaser/assetConfig.ts

/**
 * Configurazione degli asset per il gioco
 * Centralizza i path e le configurazioni di tutti gli asset
 */
export const ASSETS = {
    // Asset UI generali
    ui: {
      placeholder: '/assets/ui/placeholder.png',
      mercatorumLogo: '/assets/ui/mercatorum_logo.png'
    },
    
    // Tilesets per i laboratori (TODO: generate real tilesets)
    tilesets: {
      blekinge: '/assets/labs/blekinge/tileset.png',
    },

    // Asset per i laboratori specifici
    labs: {
      mercatorum: {
        background: '/assets/labs/mercatorum/background.png',
        furniture: '/assets/labs/mercatorum/furniture.png'
      },
      blekinge: {
        background: '/assets/labs/blekinge/background.png',
        furniture: '/assets/labs/blekinge/furniture.png'
      },
      opbg: {
        background: '/assets/labs/opbg/background.png',
        furniture: '/assets/labs/opbg/furniture.png'
      }
    },
    
    // Sprite e configurazioni per i personaggi
    characters: {
      professor: {
        path: '/assets/characters/professor_spritesheet.png',
        config: {
          frameWidth: 32,
          frameHeight: 48
        }
      },
      researcher: {
        path: '/assets/characters/researcher_spritesheet.png',
        config: {
          frameWidth: 32,
          frameHeight: 48
        }
      },
      student: {
        path: '/assets/characters/student_spritesheet.png',
        config: {
          frameWidth: 32,
          frameHeight: 48
        }
      },
      doctor: {
        path: '/assets/characters/doctor_spritesheet.png',
        config: {
          frameWidth: 32,
          frameHeight: 48
        }
      }
    },
    
    // Configurazione delle animazioni
    animations: {
      professor: {
        idle: {
          key: 'professor_idle',
          frames: { start: 0, end: 3 },
          frameRate: 5,
          repeat: -1 // Loop infinito
        },
        walk: {
          key: 'professor_walk',
          frames: { start: 4, end: 9 },
          frameRate: 10,
          repeat: -1
        },
        discuss: {
          key: 'professor_discuss',
          frames: { start: 10, end: 13 },
          frameRate: 7,
          repeat: -1
        }
      },
      researcher: {
        idle: {
          key: 'researcher_idle',
          frames: { start: 0, end: 3 },
          frameRate: 5,
          repeat: -1
        },
        walk: {
          key: 'researcher_walk',
          frames: { start: 4, end: 9 },
          frameRate: 10,
          repeat: -1
        },
        discuss: {
          key: 'researcher_discuss',
          frames: { start: 10, end: 13 },
          frameRate: 7,
          repeat: -1
        }
      }
    },
    
    // Asset per effetti visivi
    effects: {
      communication: '/assets/effects/communication_bubbles.png',
      learning: '/assets/effects/learning_effect.png'
    }
  };
  
  /**
   * Verifica che tutti gli asset siano correttamente configurati
   * Utile in fase di sviluppo per individuare errori di configurazione
   */
  export function verifyAssets(): void {
    // Controlla che tutti i path siano stringhe non vuote
    const checkPath = (path: string, name: string) => {
      if (typeof path !== 'string' || path.trim() === '') {
        console.warn(`Asset path issue detected: ${name} has invalid path: "${path}"`);
      }
    };
    
    // Controlla le proprietà nidificate dell'oggetto ASSETS
    const checkNestedPaths = (obj: any, parentKey: string = '') => {
      for (const key in obj) {
        const currentPath = parentKey ? `${parentKey}.${key}` : key;
        
        if (typeof obj[key] === 'string') {
          checkPath(obj[key], currentPath);
        } else if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          if (key === 'config' || key === 'frames') continue; // Salta configurazioni e frame
          checkNestedPaths(obj[key], currentPath);
        }
      }
    };
    
    checkNestedPaths(ASSETS);
    console.log('Asset verification completed');
  }