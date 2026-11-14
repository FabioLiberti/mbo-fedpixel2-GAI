// DocumentationController.ts
// Gestisce il caricamento e la gestione dei documenti di progetto

import { EventEmitter } from 'events';

// Definizione dei tipi di documento supportati
export type DocumentType = 'pdf' | 'md' | 'markdown';

// Enumerazione per le categorie di documentazione
export enum DocumentCategory {
  Architecture = 'architecture',
  UserGuide = 'user-guide',
  Research = 'research',
  Development = 'development',
  Technical = 'technical', 
  Design = 'design',
  Planning = 'planning',
  All = 'all'
}

// Interfaccia per i documenti
export interface DocumentMetadata {
  id: string;
  title: string;
  type: DocumentType;
  path: string;
  category: DocumentCategory | string;
  description?: string;
  dateAdded?: string;
  version?: string;
}

// Interface per le opzioni di configurazione
export interface DocumentationOptions {
  baseUrl?: string;
  enableCaching?: boolean;
  defaultCategory?: DocumentCategory | string;
}

/**
 * Controller per la gestione della documentazione del progetto
 * Fornisce metodi per caricare, filtrare e visualizzare documenti
 */
export class DocumentationController extends EventEmitter {
  private documents: DocumentMetadata[] = [];
  private documentsMap: Map<string, DocumentMetadata> = new Map();
  private categories: Set<string> = new Set();
  private options: DocumentationOptions;
  private isInitialized: boolean = false;
  private loadingPromise: Promise<void> | null = null;

  constructor(options: DocumentationOptions = {}) {
    super();
    this.options = {
      baseUrl: options.baseUrl || '/docs',
      enableCaching: options.enableCaching !== undefined ? options.enableCaching : true,
      defaultCategory: options.defaultCategory || DocumentCategory.All
    };
  }

  /**
   * Inizializza il controller caricando l'indice dei documenti
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    if (this.loadingPromise) {
      return this.loadingPromise;
    }
    
    this.loadingPromise = new Promise<void>(async (resolve, reject) => {
      try {
        // Normalmente faremmo una richiesta fetch per caricare l'indice dei documenti
        // ma per questo esempio useremo un indice statico
        await this.simulateLoadingDelay();
        
        // Documenti di esempio
        const docsIndex = [
          {
            id: 'architecture',
            title: 'Architettura di Sistema',
            type: 'pdf' as DocumentType,
            path: `${this.options.baseUrl}/agent-laboratory-architecture.pdf`,
            category: DocumentCategory.Technical,
            description: 'Panoramica dell\'architettura del sistema e dei componenti principali',
            version: '1.0.0',
            dateAdded: '2025-04-30'
          },
          {
            id: 'user-guide',
            title: 'Guida Utente',
            type: 'markdown' as DocumentType,
            path: `${this.options.baseUrl}/user-guide.md`,
            category: DocumentCategory.UserGuide,
            description: 'Istruzioni complete per l\'utilizzo dell\'applicazione Agent Laboratory',
            version: '1.1.0',
            dateAdded: '2025-04-29'
          },
          {
            id: 'federated-learning-intro',
            title: 'Federated Learning',
            type: 'markdown' as DocumentType,
            path: `${this.options.baseUrl}/federated-learning-intro.md`,
            category: DocumentCategory.Research,
            description: 'Spiegazione dettagliata del federated learning e dell\'implementazione nel progetto',
            version: '1.0.1',
            dateAdded: '2025-04-28'
          },
          {
            id: 'labs-description',
            title: 'Laboratori Virtuali',
            type: 'pdf' as DocumentType,
            path: `${this.options.baseUrl}/virtual-labs.pdf`,
            category: DocumentCategory.Architecture,
            description: 'Descrizione dei tre laboratori virtuali e delle loro specializzazioni',
            version: '1.0.0',
            dateAdded: '2025-04-27'
          },
          {
            id: 'agents-system',
            title: 'Sistema Agenti',
            type: 'markdown' as DocumentType,
            path: `${this.options.baseUrl}/agent-system.md`,
            category: DocumentCategory.Technical,
            description: 'Documentazione del sistema di agenti autonomi e loro comportamenti',
            version: '1.0.2',
            dateAdded: '2025-04-26'
          },
          {
            id: 'roadmap',
            title: 'Roadmap di Sviluppo',
            type: 'markdown' as DocumentType,
            path: `${this.options.baseUrl}/development-roadmap.md`,
            category: DocumentCategory.Planning,
            description: 'Piano di sviluppo futuro e milestone del progetto',
            version: '1.0.0',
            dateAdded: '2025-04-25'
          },
          {
            id: 'pixel-art-guidelines',
            title: 'Linee Guida Pixel Art',
            type: 'pdf' as DocumentType,
            path: `${this.options.baseUrl}/pixel-art-guidelines.pdf`,
            category: DocumentCategory.Design,
            description: 'Linee guida per la creazione e l\'implementazione della grafica pixel art',
            version: '1.0.0',
            dateAdded: '2025-04-24'
          },
          {
            id: 'improvement-proposals',
            title: 'Proposte di Miglioramento',
            type: 'markdown' as DocumentType,
            path: `${this.options.baseUrl}/improvement-proposals.md`,
            category: DocumentCategory.Development,
            description: 'Proposte per il miglioramento dell\'interfaccia e della simulazione',
            version: '1.0.0',
            dateAdded: '2025-04-23'
          }
        ];
        
        // Aggiorna la lista documenti e le categorie
        this.documents = docsIndex;
        
        // Popola la mappa documenti per accesso rapido
        this.documentsMap.clear();
        for (const doc of this.documents) {
          this.documentsMap.set(doc.id, doc);
          if (typeof doc.category === 'string') {
            this.categories.add(doc.category);
          }
        }
        
        this.isInitialized = true;
        this.emit('initialized', this.getStats());
        resolve();
      } catch (error) {
        console.error('Errore durante l\'inizializzazione della documentazione:', error);
        this.emit('error', error);
        reject(error);
      } finally {
        this.loadingPromise = null;
      }
    });
    
    return this.loadingPromise;
  }
  
  /**
   * Simula un ritardo di caricamento per i test
   */
  private async simulateLoadingDelay(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 300));
  }
  
  /**
   * Ottieni tutti i documenti disponibili
   */
  getAllDocuments(): DocumentMetadata[] {
    return [...this.documents];
  }
  
  /**
   * Ottieni un documento specifico tramite ID
   */
  getDocumentById(id: string): DocumentMetadata | undefined {
    return this.documentsMap.get(id);
  }
  
  /**
   * Filtra i documenti per categoria
   */
  getDocumentsByCategory(category: DocumentCategory | string): DocumentMetadata[] {
    if (category === DocumentCategory.All || category === this.options.defaultCategory) {
      return this.getAllDocuments();
    }
    return this.documents.filter(doc => doc.category === category);
  }
  
  /**
   * Ottieni tutte le categorie disponibili
   */
  getCategories(): string[] {
    // Assicuriamoci che DocumentCategory.All sia la prima categoria
    const defaultCategory = this.options.defaultCategory as string;
    const categoryList = Array.from(this.categories);
    return [defaultCategory, ...categoryList.filter(c => c !== defaultCategory)];
  }
  
  /**
   * Carica il contenuto di un documento markdown
   * In un ambiente reale, questo farebbe una richiesta fetch al server
   */
  async loadMarkdownContent(documentId: string): Promise<string> {
    const document = this.getDocumentById(documentId);
    
    if (!document) {
      throw new Error(`Documento non trovato: ${documentId}`);
    }
    
    if (document.type !== 'markdown' && document.type !== 'md') {
      throw new Error(`Il documento ${documentId} non è un file markdown`);
    }
    
    // Simula una richiesta di rete
    await this.simulateLoadingDelay();
    
    // In un'implementazione reale, qui faremmo una fetch
    // return fetch(document.path).then(response => response.text());
    
    // Per ora, restituiamo alcuni contenuti di esempio basati sull'ID
    const contentMap: Record<string, string> = {
      'user-guide': `# Guida Utente - Agent Laboratory

## Introduzione

Agent Laboratory è un simulatore interattivo che modella un ecosistema di ricerca sul federated learning attraverso tre laboratori virtuali rappresentati in grafica pixel art 2D.

## Laboratori Virtuali

* **Università Mercatorum**: Specializzato in business intelligence e analisi finanziaria federata
* **Blekinge University**: Specializzato in algoritmi di aggregazione avanzati e edge computing
* **OPBG IRCCS**: Specializzato in federated learning per dati medici altamente sensibili

## Controlli di Base

1. **Navigazione**: Clicca su un laboratorio nella mappa mondiale per visitarlo
2. **Informazioni**: Usa il pulsante "Info" per visualizzare dettagli su ciascun ambiente
3. **Simulazione**: Usa i controlli nella barra laterale per avviare, mettere in pausa o resettare la simulazione

## Visualizzazione FL Process

Attiva la visualizzazione del processo Federated Learning tramite il pulsante "FL Process" nel menu.`,

      'federated-learning-intro': `# Introduzione al Federated Learning

## Cos'è il Federated Learning?

Il Federated Learning è un approccio di machine learning che addestra un algoritmo attraverso più dispositivi o server decentralizzati che contengono campioni di dati locali, senza scambiare direttamente tali dati.

## Come funziona

1. **Inizializzazione**: Un modello iniziale viene inviato a tutti i dispositivi partecipanti
2. **Training Locale**: Ogni dispositivo addestra il modello utilizzando i propri dati locali
3. **Aggregazione**: I parametri aggiornati vengono inviati a un server centrale che li aggrega
4. **Distribuzione**: Il modello aggiornato viene redistribuito a tutti i dispositivi
5. **Iterazione**: Il processo si ripete fino alla convergenza

## Vantaggi principali

- **Privacy dei dati**: I dati rimangono sui dispositivi locali
- **Riduzione del trasferimento dati**: Solo i parametri del modello vengono trasferiti
- **Scalabilità**: Possibilità di addestrare su migliaia di dispositivi
- **Disponibilità offline**: I dispositivi possono addestrare anche senza connessione continua

## Algoritmi principali

### FedAvg (Federated Averaging)

\`\`\`typescript
// Algoritmo di base per FedAvg
function fedAvg(localModels: Model[]): Model {
  const globalModel = initializeModel();
  
  // Aggregazione dei pesi dei modelli locali
  for (const model of localModels) {
    for (let i = 0; i < globalModel.weights.length; i++) {
      globalModel.weights[i] += model.weights[i] / localModels.length;
    }
  }
  
  return globalModel;
}
\`\`\``,

      'agents-system': `# Sistema degli Agenti in Agent Laboratory

## Tipologie di Agenti

Agent Laboratory implementa diverse categorie di agenti autonomi:

### Ruoli Accademici
- PhD Student
- Researcher (Post-Doc)
- Professor

### Ruoli Tecnici
- ML Engineer
- Data Engineer
- Privacy Specialist

### Ruoli Medici
- Medical Doctor
- Biomedical Engineer

## Comportamenti Autonomi

Ogni agente opera secondo un sistema di stati:

\`\`\`typescript
enum AgentState {
    WORKING,
    MEETING,
    RESTING,
    MOVING,
    DISCUSSING,
    PRESENTING
}
\`\`\`

Gli agenti prendono decisioni autonome in base a:
- Necessità (riposo, socializzazione, focus)
- Stati emotivi (concentrazione, frustrazione, entusiasmo)
- Obiettivi di ricerca
- Relazioni con altri agenti`,

      'improvement-proposals': `# Proposte di Miglioramento per Agent Laboratory

## Interfaccia Utente

1. **Dashboard più informativo**: Integrare un pannello di statistiche più dettagliato che mostri metriche in tempo reale come:
   - Metriche di convergenza degli algoritmi FL
   - Interazioni tra agenti
   - Uso di risorse computazionali

2. **Rappresentazione visiva delle connessioni FL**: Le linee tratteggiate tra laboratori potrebbero animarsi o cambiare colore durante il trasferimento di conoscenze.

3. **Timeline interattiva**: Aggiungere una timeline che permetta di vedere l'evoluzione della simulazione nel tempo.

## Simulazione

1. **Indicatori di stato agenti**: Piccole icone o aure colorate intorno agli agenti che indichino il loro stato attuale.

2. **Eventi casuali**: Introdurre eventi imprevisti come "problemi di privacy", "breakthrough di ricerca" o "conferenze".

3. **Visualizzazione del progresso scientifico**: Grafici o indicatori che mostrino l'avanzamento della conoscenza.

## Funzionalità Avanzate

1. **Strumenti di configurazione avanzata**: Pannello per modificare i parametri degli algoritmi FL.

2. **Modalità esportazione dati**: Funzionalità per esportare i risultati della simulazione.

3. **Scenari predefiniti**: Introdurre scenari che simulino specifiche condizioni di ricerca.`
    };
    
    // Restituisci il contenuto corrispondente o un messaggio predefinito
    return contentMap[documentId] || 
      `# ${document.title}\n\nContenuto in fase di sviluppo per il documento '${document.title}'.`;
  }
  
  /**
   * Ottiene statistiche sui documenti disponibili
   */
  getStats(): Record<string, any> {
    return {
      totalDocuments: this.documents.length,
      categoriesCount: this.categories.size,
      typeDistribution: {
        pdf: this.documents.filter(doc => doc.type === 'pdf').length,
        markdown: this.documents.filter(doc => doc.type === 'markdown' || doc.type === 'md').length
      }
    };
  }
  
  /**
   * Cerca documenti in base a una query testuale
   */
  searchDocuments(query: string): DocumentMetadata[] {
    const lowerQuery = query.toLowerCase();
    return this.documents.filter(doc => 
      doc.title.toLowerCase().includes(lowerQuery) || 
      (doc.description && doc.description.toLowerCase().includes(lowerQuery))
    );
  }
}

// Esporta un'istanza singleton del controller
export const documentationController = new DocumentationController({
  defaultCategory: DocumentCategory.All
});

export default documentationController;