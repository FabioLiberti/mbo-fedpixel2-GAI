# Legenda Agenti per Agent Laboratory

Questo componente fornisce una legenda interattiva che mostra i vari tipi di agenti presenti nei laboratori dell'Agent Laboratory. La legenda visualizza sia l'immagine/sprite che la classe dell'agente, con possibilità di espandere le informazioni per vedere dettagli, competenze e ruolo.

## Caratteristiche

- Visualizzazione delle classi di agenti (professor, researcher, student, ecc.)
- Mostra gli sprite effettivi utilizzati nel gioco
- Pannello espandibile con informazioni dettagliate
- Configurazione tramite file JSON
- Possibilità di nascondere/mostrare la legenda
- Design visuale coerente con lo stile dell'applicazione

## File inclusi

1. **agentTypes.json** - Configurazione degli agenti con dettagli su ogni classe
2. **LegendInfoPanel.ts** - Pannello per visualizzare informazioni dettagliate
3. **AgentsLegend.ts** - Componente principale che gestisce la legenda
4. **AgentsLegendIntegration.ts** - Esempio di integrazione nelle scene

## Installazione

1. Copia i file nelle rispettive posizioni del progetto:
   - `agentTypes.json` in `frontend/public/assets/config/`
   - `LegendInfoPanel.ts` in `frontend/src/phaser/ui/`
   - `AgentsLegend.ts` in `frontend/src/phaser/ui/`
   - `AgentsLegendIntegration.ts` in `frontend/src/phaser/examples/` (opzionale)

2. Assicurati che il file JSON sia disponibile nel percorso corretto, o creane una copia durante il build.

## Utilizzo

### Metodo 1: Utilizzo diretto in una scena

```typescript
import { AgentsLegend } from '../ui/AgentsLegend';

// Nel metodo create() della tua scena
async function createLegend() {
  try {
    // Carica il file di configurazione
    const agentTypes = await AgentsLegend.loadAgentTypesConfig(this);
    
    // Crea la legenda
    const legend = new AgentsLegend(
      this,                   // riferimento alla scena
      this.cameras.main.width - 220,  // posizione X
      20,                     // posizione Y
      agentTypes              // configurazione
    );
  } catch (error) {
    console.error('Error creating legend:', error);
  }
}

createLegend();
```

### Metodo 2: Utilizzo della funzione di integrazione

```typescript
import { integrateAgentsLegend } from '../examples/AgentsLegendIntegration';

// Nel metodo create() della tua scena
integrateAgentsLegend(this);
```

### Metodo 3: Configurazione inline (senza file JSON)

```typescript
import { AgentsLegend } from '../ui/AgentsLegend';
import { AgentTypeInfo } from '../ui/LegendInfoPanel';

// Definisci la configurazione direttamente nel codice
const agentTypesConfig: Record<string, AgentTypeInfo> = {
  "professor": {
    "title": "Professor",
    "description": "Esperto accademico che supervisiona le ricerche",
    "skills": ["FL Systems Architecture", "Theoretical Guarantees", "Privacy Economics"],
    "role": "Supervisiona progetti di ricerca",
    "background": "Esperienza pluriennale in ricerca sul federated learning",
    "color": "#1E88E5",
    "spritesheetPath": "assets/characters/professor_spritesheet.png"
  },
  // Altri tipi di agenti...
};

// Crea la legenda
const legend = new AgentsLegend(this, 20, 20, agentTypesConfig);
```

## Personalizzazione

### Modifica dello stile

Puoi personalizzare l'aspetto della legenda modificando i valori nei costruttori:

```typescript
// In AgentsLegend.ts
private width: number = 200;        // Larghezza della legenda
private itemHeight: number = 50;    // Altezza di ogni item
private padding: number = 10;       // Padding interno
private collapsedHeight: number = 40; // Altezza quando collassata
```

### Aggiunta di nuovi tipi di agenti

Per aggiungere nuovi tipi di agenti, modifica il file `agentTypes.json` aggiungendo una nuova voce con la struttura appropriata.

## Integrazione con BlekingeLabScene

Per integrare la legenda in `BlekingeLabScene.ts`, segui queste istruzioni:

1. Importa le classi necessarie
```typescript
import { AgentsLegend } from '../ui/AgentsLegend';
```

2. Nel metodo `create()` della classe `BlekingeLabScene`, aggiungi:
```typescript
// Aggiungi la legenda degli agenti
this.createAgentsLegend();
```

3. Aggiungi il metodo `createAgentsLegend()` alla classe:
```typescript
private async createAgentsLegend(): Promise<void> {
  try {
    // Carica la configurazione degli agenti
    const response = await fetch('assets/config/agentTypes.json');
    const agentTypes = await response.json();
    
    // Crea la legenda
    const legend = new AgentsLegend(
      this,
      this.cameras.main.width - 220,
      20,
      agentTypes
    );
    
    // Opzionale: pulsante per toggle della legenda
    const toggleButton = this.add.text(
      10,
      this.cameras.main.height - 40,
      'Legenda Agenti',
      {
        fontSize: '14px',
        backgroundColor: this.theme.colorPalette.primary,
        padding: { left: 10, right: 10, top: 5, bottom: 5 }
      }
    );
    toggleButton.setInteractive({ useHandCursor: true });
    toggleButton.on('pointerdown', () => legend.toggleVisibility());
    toggleButton.setScrollFactor(0);
    toggleButton.setDepth(100);
  } catch (error) {
    console.error('Error creating agents legend:', error);
  }
}
```

## Note importanti

- Assicurati che i nomi dei tipi nel file JSON (`professor`, `researcher`, ecc.) corrispondano esattamente ai nomi delle texture degli sprite nel gioco.
- Il file JSON dovrebbe essere compilato e copiato in `public/assets/config/` durante il build.
- Se la legenda non viene visualizzata, controlla la console per eventuali errori.

## Estensioni future

- Filtri per tipo di agente
- Animazioni per le sprite nella legenda
- Statistiche sugli agenti presenti nella scena
- Integrazione con il sistema di tutorial