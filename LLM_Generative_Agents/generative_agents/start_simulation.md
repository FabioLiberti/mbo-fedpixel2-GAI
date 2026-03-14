# 🚀 Guida Avvio Simulazione Corretta

## ✅ Problemi Risolti

1. **FileNotFoundError per movement directory** → Creazione automatica directory
2. **File exists error** → Rimozione automatica simulazioni esistenti  
3. **Missing dummy movement files** → Creazione file movimento base

## 📋 Procedura di Avvio

### 1. **Cleanup (se necessario)**
```bash
python cleanup_and_restart.py
```

### 2. **Avvio Frontend Server**
```bash
cd environment/frontend_server
python manage.py runserver
```

### 3. **Avvio Backend Server** 
```bash
cd reverie/backend_server
python reverie.py
```

### 4. **Input Richiesti**
- **Fork simulation**: `base_the_ville_isabella_maria_klaus`
- **New simulation**: `test-simulation-21` (o nome univoco)

### 5. **Accesso Interfacce**
- **Simulatore Standard**: http://localhost:8000/simulator_home
- **Simulatore Potenziato**: http://localhost:8000/simulator_enhanced/
- **Log Viewer**: http://localhost:8000/log_viewer/

## 🔧 Miglioramenti Implementati

### Backend
- ✅ Creazione automatica directory `movement/`
- ✅ Gestione sovrascrittura simulazioni esistenti
- ✅ File dummy movimento per inizializzazione
- ✅ Fallback robusti per errori spaziali

### Frontend  
- ✅ Interfaccia debug con controlli avanzati
- ✅ Visualizzazione movimento fluida
- ✅ Chat bubble visive sulla mappa
- ✅ API status e logs real-time
- ✅ Supporto multi-modello per agenti

### Modelli LLM
- ✅ Assegnazione automatica modelli per personalità:
  - **qwen3:0.6b** → default/veloce
  - **llama3:7b** → creativi/artistici
  - **mistral:7b** → analitici/logici  
  - **gemma:7b** → sociali/empatici

## 🐛 Troubleshooting

### Se il backend crasha:
1. Controllare che Ollama sia attivo: `ollama list`
2. Verificare modelli disponibili
3. Pulire con `python cleanup_and_restart.py`

### Se il frontend non mostra agenti:
1. Verificare connessione API: http://localhost:8000/api/status/
2. Controllare log browser console (F12)
3. Controllare file movimento in storage/

### Performance Issues:
- Ridurre speed multiplier (1x invece di 8x)
- Disabilitare debug mode per performance migliori
- Usare modelli più leggeri (phi3:mini)

## 📊 Monitoring

L'interfaccia debug mostra:
- **FPS Counter** per performance
- **Backend Status** (online/offline)  
- **Update Status** (processing/waiting/executing)
- **Agent Count** attivi
- **Current Step** e **Phase**

Le chat bubble appaiono automaticamente quando gli agenti conversano, e i trail di movimento sono visibili in debug mode.