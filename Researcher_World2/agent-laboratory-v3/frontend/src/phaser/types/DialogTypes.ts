// frontend/src/phaser/types/DialogTypes.ts

/**
 * Tipi di dialogo per le nuvolette nel contesto del Federated Learning
 */
export enum FLDialogType {
    GENERAL = 'general',          // Dialogo generico
    MODEL = 'model',              // Aggiornamento del modello
    DATA = 'data',                // Condivisione di dati
    PRIVACY = 'privacy',          // Questioni di privacy
    RESEARCH = 'research'         // Attività di ricerca
}

/**
 * Tipi di processi cognitivi degli agenti
 */
export enum CognitiveProcessType {
    THINKING = 'thinking',   // Processo di pensiero generale
    DECISION = 'decision',   // Decisione FL
    PLANNING = 'planning',   // Pianificazione di azioni
    REACTION = 'reaction'    // Reazione a un evento
}

/**
 * Interfaccia per i dati di interazione tra agenti
 */
export interface AgentInteractionData {
    agentId1: string;
    agentId2: string;
    type: string;
}

/**
 * Messaggi per ciascun ruolo in un dialogo
 */
export interface DialogRoleMessages {
    initiator: string[];
    responder: string[];
}

/**
 * Libreria di messaggi predefiniti per tipo di interazione FL
 */
export const DIALOG_MESSAGES: Record<FLDialogType, DialogRoleMessages> = {
    [FLDialogType.GENERAL]: {
        initiator: [
            "Interessante questa ricerca...",
            "Parliamo di questo progetto",
            "Ho alcune idee da condividere",
            "Secondo me potremmo...",
            "Hai visto i nuovi risultati?"
        ],
        responder: [
            "Sì, concordo pienamente",
            "Interessante punto di vista",
            "Continua, ti ascolto",
            "Mi sembra valido",
            "Possiamo approfondire"
        ]
    },
    [FLDialogType.MODEL]: {
        initiator: [
            "Ho aggiornato il modello locale!",
            "I pesi sono migliorati del 4%",
            "Posso inviare gli aggiornamenti?",
            "L'accuratezza è salita al 87%",
            "Convergenza in corso..."
        ],
        responder: [
            "Ottimo, aggrego i parametri",
            "I tuoi aggiornamenti sono utili",
            "Noto miglioramenti significativi",
            "Posso integrare questi pesi",
            "La loss si è ridotta!"
        ]
    },
    [FLDialogType.DATA]: {
        initiator: [
            "Ho nuovi dati da analizzare",
            "Condivido ma preservo privacy",
            "Questi dati sono interessanti",
            "Nessun dato sensibile condiviso",
            "Campionamento stratificato completato"
        ],
        responder: [
            "Grazie per la condivisione",
            "Utile per il nostro modello",
            "La distribuzione sembra buona",
            "Verifichiamo le classi",
            "Dati accettati nel sistema"
        ]
    },
    [FLDialogType.PRIVACY]: {
        initiator: [
            "Privacy differenziale attivata",
            "Il budget ε è rispettato",
            "Dati locali protetti",
            "Secure aggregation in corso",
            "Minimizzando i rischi di inferenza"
        ],
        responder: [
            "Conferma: privacy preservata",
            "Sicurezza verificata",
            "Protocollo di protezione attivo",
            "Nessuna fuga di informazioni",
            "Parametri protetti correttamente"
        ]
    },
    [FLDialogType.RESEARCH]: {
        initiator: [
            "La mia ipotesi sta funzionando",
            "Abbiamo ridotto l'overfitting",
            "Non-IID data corretti",
            "Convergenza più rapida!",
            "Dobbiamo pubblicare questi risultati"
        ],
        responder: [
            "Risultati molto promettenti",
            "Potremmo estendere questo approccio",
            "Confrontiamo con lo stato dell'arte",
            "Preparo il paper",
            "Innovazione significativa"
        ]
    }
};

/**
 * Restituisce un messaggio casuale per un tipo di dialogo e ruolo
 */
export function getRandomDialogMessage(type: FLDialogType, role: 'initiator' | 'responder'): string {
    const messages = DIALOG_MESSAGES[type][role];
    const randomIndex = Math.floor(Math.random() * messages.length);
    return messages[randomIndex];
}