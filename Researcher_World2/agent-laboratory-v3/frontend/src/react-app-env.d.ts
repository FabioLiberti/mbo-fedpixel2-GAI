/// <reference types="react-scripts" />

// Estensione per Window per includere il game Phaser
interface Window {
    game: Phaser.Game;
    // Aggiungi qui eventuali altre proprietà globali
    fs?: {
      readFile: (path: string, options?: { encoding?: string }) => Promise<any>;
    };
  }
  
  // Tipi per la documentazione
  declare module 'react-pdf' {
    export const Document: React.FC<any>;
    export const Page: React.FC<any>;
    export const pdfjs: any;
  }
  
  declare module 'react-markdown' {
    const ReactMarkdown: React.FC<any>;
    export default ReactMarkdown;
  }