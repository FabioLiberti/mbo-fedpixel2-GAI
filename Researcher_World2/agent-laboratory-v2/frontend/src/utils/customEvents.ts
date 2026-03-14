/**
 * Utility per gestire eventi personalizzati tra Phaser e React
 * Questo file fornisce un modo alternativo per comunicare tra i componenti
 * quando gli eventi standard di Phaser non funzionano come previsto
 */

// Evento DOM personalizzato per gestire il toggle del pannello FL
export const emitFLPanelToggle = (visible: boolean): void => {
  try {
    const customEvent = new CustomEvent('fl-panel-toggle', {
      detail: { visible }
    });
    document.dispatchEvent(customEvent);
    console.log('Emitted custom fl-panel-toggle event with visible:', visible);
  } catch (error) {
    console.error('Error emitting custom event:', error);
  }
};

// Funzione per registrare un listener per l'evento toggle
export const addFLPanelToggleListener = (callback: (visible: boolean) => void): () => void => {
  const handler = (event: Event) => {
    const customEvent = event as CustomEvent;
    callback(customEvent.detail.visible);
  };
  
  document.addEventListener('fl-panel-toggle', handler);
  
  // Restituisce una funzione di pulizia
  return () => {
    document.removeEventListener('fl-panel-toggle', handler);
  };
};

// Funzione per aggiornare lo stato del pannello FL nel localStorage
// Questo è un fallback quando il game registry non funziona
export const updateFLPanelState = (visible: boolean): void => {
  try {
    localStorage.setItem('fl-panel-visible', JSON.stringify(visible));
  } catch (error) {
    console.error('Error updating FL panel state in localStorage:', error);
  }
};

// Funzione per ottenere lo stato del pannello FL dal localStorage
export const getFLPanelState = (): boolean => {
  try {
    const storedValue = localStorage.getItem('fl-panel-visible');
    return storedValue ? JSON.parse(storedValue) : true; // Default a true
  } catch (error) {
    console.error('Error getting FL panel state from localStorage:', error);
    return true; // Default a true in caso di errore
  }
};