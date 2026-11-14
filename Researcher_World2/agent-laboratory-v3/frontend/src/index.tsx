import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
//import reportWebVitals from './reportWebVitals';

// Assicurarsi che l'elemento esista prima di tentare il rendering
const rootElement = document.getElementById('root');

if (!rootElement) {
  // Se non esiste, creiamo un elemento e lo aggiungiamo al body
  const newRootElement = document.createElement('div');
  newRootElement.id = 'root';
  document.body.appendChild(newRootElement);
  
  console.log('Elemento root creato dinamicamente perché non esisteva nel DOM');
  
  const root = createRoot(newRootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  // Se esiste, usa l'elemento normalmente
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

// Se vuoi iniziare a misurare le performance nella tua app, passa una funzione
// per registrare i risultati (per esempio: reportWebVitals(console.log))
//reportWebVitals();