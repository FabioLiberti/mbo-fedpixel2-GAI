import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import ReactMarkdown from 'react-markdown';
import './DocumentationViewer.css';
import documentationController, { DocumentMetadata, DocumentCategory } from '../services/DocumentationController';

// Inizializzazione della libreria PDF.js con il worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface DocumentationViewerProps {
  onClose: () => void; // Callback per tornare alla schermata principale
}

const DocumentationViewer: React.FC<DocumentationViewerProps> = ({ onClose }) => {
  // Stati del componente
  const [selectedDoc, setSelectedDoc] = useState<DocumentMetadata | null>(null);
  const [pdfNumPages, setPdfNumPages] = useState<number | null>(null);
  const [pdfPageNumber, setPdfPageNumber] = useState<number>(1);
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>(DocumentCategory.All);
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [isControllerInitialized, setIsControllerInitialized] = useState<boolean>(false);

  // Inizializza il controller della documentazione
  useEffect(() => {
    const initializeController = async () => {
      try {
        setIsLoading(true);
        await documentationController.initialize();
        setIsControllerInitialized(true);
        setIsLoading(false);
      } catch (error) {
        console.error('Errore durante l\'inizializzazione del controller:', error);
        setError('Impossibile caricare il sistema di documentazione');
        setIsLoading(false);
      }
    };

    initializeController();
  }, []);

  // Quando il controller è inizializzato, carica i documenti e le categorie
  useEffect(() => {
    if (isControllerInitialized) {
      setDocuments(documentationController.getAllDocuments());
      setCategories(documentationController.getCategories());
    }
  }, [isControllerInitialized]);

  // Quando cambia la categoria, aggiorna i documenti filtrati
  useEffect(() => {
    if (isControllerInitialized) {
      setDocuments(documentationController.getDocumentsByCategory(selectedCategory));
    }
  }, [selectedCategory, isControllerInitialized]);

  // Quando cambia il documento selezionato, carica il contenuto
  useEffect(() => {
    if (!selectedDoc) return;
    
    setIsLoading(true);
    setError(null);
    
    // Resetta gli stati specifici per tipo di documento
    setPdfNumPages(null);
    setPdfPageNumber(1);
    setMarkdownContent('');
    
    if (selectedDoc.type === 'markdown' || selectedDoc.type === 'md') {
      // Carica il contenuto markdown dal controller
      documentationController.loadMarkdownContent(selectedDoc.id)
        .then(content => {
          setMarkdownContent(content);
          setIsLoading(false);
        })
        .catch(error => {
          console.error('Errore nel caricamento del markdown:', error);
          setError(`Errore nel caricamento del documento: ${error.message}`);
          setIsLoading(false);
        });
    }
  }, [selectedDoc]);

  // Gestisce il cambiamento di pagina nel PDF
  const handlePdfPageChange = (newPage: number) => {
    if (pdfNumPages && newPage >= 1 && newPage <= pdfNumPages) {
      setPdfPageNumber(newPage);
    }
  };

  // Funzione per il caricamento documento PDF
  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setPdfNumPages(numPages);
    setIsLoading(false);
  }

  // Componenti personalizzati per ReactMarkdown
  const MarkdownComponents = {
    // Aggiungiamo classi ai componenti invece di usare className direttamente su ReactMarkdown
    h1: ({node, ...props}: any) => <h1 className="markdown-heading-1" {...props} />,
    h2: ({node, ...props}: any) => <h2 className="markdown-heading-2" {...props} />,
    h3: ({node, ...props}: any) => <h3 className="markdown-heading-3" {...props} />,
    p: ({node, ...props}: any) => <p className="markdown-paragraph" {...props} />,
    ul: ({node, ...props}: any) => <ul className="markdown-list" {...props} />,
    ol: ({node, ...props}: any) => <ol className="markdown-ordered-list" {...props} />,
    li: ({node, ...props}: any) => <li className="markdown-list-item" {...props} />,
    code: ({node, inline, ...props}: any) => 
      inline 
        ? <code className="markdown-inline-code" {...props} />
        : <code className="markdown-block-code" {...props} />,
    pre: ({node, ...props}: any) => <pre className="markdown-code-block" {...props} />,
    // Si può aggiungere altri elementi se necessario
  };

  // Rendering condizionale per i diversi tipi di documenti
  const renderDocumentContent = () => {
    if (!selectedDoc) {
      return (
        <div className="doc-placeholder">
          <div className="pixel-art-placeholder"></div>
          <p>Seleziona un documento dalla libreria</p>
        </div>
      );
    }

    if (isLoading) {
      return <div className="loading-indicator">Caricamento...</div>;
    }

    if (error) {
      return <div className="error-message">Errore: {error}</div>;
    }

    if (selectedDoc.type === 'pdf') {
      return (
        <div className="pdf-container">
          <Document
            file={selectedDoc.path}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={(error: Error) => {
              console.error("Errore caricamento PDF", error);
              setError("Impossibile caricare il documento PDF");
              setIsLoading(false);
            }}
            className="pdf-document"
          >
            <Page 
              pageNumber={pdfPageNumber} 
              renderTextLayer={false}
              renderAnnotationLayer={false}
              className="pdf-page"
            />
          </Document>
          
          {pdfNumPages && (
            <div className="pdf-controls">
              <button 
                className="pixel-button" 
                onClick={() => handlePdfPageChange(pdfPageNumber - 1)}
                disabled={pdfPageNumber <= 1}
              >
                ◀
              </button>
              <span className="page-indicator">
                Pagina {pdfPageNumber} di {pdfNumPages}
              </span>
              <button 
                className="pixel-button" 
                onClick={() => handlePdfPageChange(pdfPageNumber + 1)}
                disabled={pdfPageNumber >= pdfNumPages}
              >
                ▶
              </button>
            </div>
          )}
        </div>
      );
    }

    if (selectedDoc.type === 'markdown' || selectedDoc.type === 'md') {
      return (
        <div className="markdown-container">
          {/* Utilizziamo components per passare gli stili personalizzati invece di className */}
          <div className="markdown-content">
            <ReactMarkdown components={MarkdownComponents}>
              {markdownContent}
            </ReactMarkdown>
          </div>
        </div>
      );
    }

    return null;
  };

  // Ottieni l'icona in base al tipo di documento
  const getDocumentIconClass = (type: string) => {
    switch (type) {
      case 'pdf':
        return 'pdf';
      case 'markdown':
      case 'md':
        return 'md';
      default:
        return 'unknown';
    }
  };

  return (
    <div className="documentation-viewer">
      <div className="documentation-header">
        <h1 className="pixel-title">DOCUMENTAZIONE DI PROGETTO</h1>
        <button className="close-button" onClick={onClose}>X</button>
      </div>
      
      <div className="documentation-content">
        <div className="documents-sidebar">
          <div className="category-selector">
            <div className="pixel-select-wrapper">
              <select 
                className="pixel-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat === DocumentCategory.All ? 'Tutti' : cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="documents-shelf">
            {documents.map(doc => (
              <div 
                key={doc.id}
                className={`document-item ${selectedDoc?.id === doc.id ? 'selected' : ''}`}
                onClick={() => setSelectedDoc(doc)}
              >
                <div className="document-icon">
                  <div className={`pixel-icon ${getDocumentIconClass(doc.type)}`}></div>
                </div>
                <div className="document-info">
                  <div className="document-title">{doc.title}</div>
                  <div className="document-type">{doc.type.toUpperCase()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="document-viewer">
          <div className="viewer-inner">
            {renderDocumentContent()}
          </div>
          
          {selectedDoc && (
            <div className="viewer-footer">
              <button className="pixel-button" onClick={() => setSelectedDoc(null)}>
                <div className="button-icon home-icon"></div>
                Indietro
              </button>
              
              {selectedDoc.type === 'pdf' && (
                <button className="pixel-button" 
                  onClick={() => window.open(selectedDoc.path, '_blank')}
                >
                  <div className="button-icon download-icon"></div>
                  Download
                </button>
              )}
              
              <button className="pixel-button" 
                onClick={() => window.print()}
                disabled={!selectedDoc}
              >
                <div className="button-icon print-icon"></div>
                Stampa
              </button>
              
              <div className="document-title-display">
                {selectedDoc.title}
                {selectedDoc.version && ` (v${selectedDoc.version})`}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentationViewer;