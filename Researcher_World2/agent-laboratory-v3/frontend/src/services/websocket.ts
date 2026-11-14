// Questo file è un adattatore che esporta solo la parte WebSocket dal file api.ts
// Serve a mantenere l'app.tsx compatibile con la struttura attuale del progetto

// Importa il servizio WebSocket dal file api.ts
import { webSocketService } from './api';

// Esporta solo il servizio WebSocket
export { webSocketService };