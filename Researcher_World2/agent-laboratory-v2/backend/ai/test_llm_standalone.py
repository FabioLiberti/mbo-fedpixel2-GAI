"""
Test standalone per il connettore LLM di Agent Laboratory.
"""

import os
import asyncio
import logging
import json
import aiohttp
import sys

# Configurazione logger con output su console
logging.basicConfig(
    level=logging.DEBUG,  # Impostato a DEBUG per vedere più informazioni
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)  # Forza l'output su stdout
    ]
)
logger = logging.getLogger("llm_standalone_test")

print("=== Starting LLM Standalone Test ===")  # Messaggio di debug iniziale

# Percorso al file di configurazione
config_path = os.path.join(os.path.dirname(__file__), '..', 'config', 'llm_config.json')
print(f"Looking for config at: {config_path}")

# Carica configurazione se esiste, altrimenti usa valori di default
try:
    with open(config_path, 'r') as f:
        CONFIG = json.load(f)
        print(f"Loaded config: {CONFIG}")
except FileNotFoundError:
    print(f"Config file not found at {config_path}. Using default values.")
    CONFIG = {
        "ollama_base_url": "http://localhost:11434",
        "model_name": "qwen:0.6b",
        "temperature": 0.7,
        "max_tokens": 1000,
        "enable_cache": True
    }
    print(f"Default config: {CONFIG}")
except Exception as e:
    print(f"Error loading config: {str(e)}")
    CONFIG = {
        "ollama_base_url": "http://localhost:11434",
        "model_name": "qwen:0.6b",
        "temperature": 0.7,
        "max_tokens": 1000,
        "enable_cache": True
    }

class SimpleLLMConnector:
    """Versione semplificata del connettore LLM per test standalone."""
    
    def __init__(self):
        llm_config = CONFIG.get('llm', {})
        self.base_url = llm_config.get('ollama_base_url', 'http://localhost:11434')
        self.model = llm_config.get('llm', {}).get('model', 'qwen3:0.6b')


        self.session = None
        self.cache = {}
        print(f"LLM Connector initialized with URL: {self.base_url}, Model: {self.model}")
        
    async def initialize(self):
        """Inizializza la sessione HTTP."""
        print("Initializing HTTP session")
        self.session = aiohttp.ClientSession()
        
    async def close(self):
        """Chiude la sessione HTTP."""
        print("Closing HTTP session")
        if self.session:
            await self.session.close()
            
    async def generate_text(self, prompt, temperature=0.7):
        """Genera testo usando Ollama."""
        print(f"Generating text with prompt: {prompt[:30]}...")
        
        if not self.session:
            print("Session not initialized, initializing now")
            await self.initialize()
            
        # Check cache
        cache_key = f"{prompt}_{temperature}"
        if cache_key in self.cache:
            print("Using cached response")
            return self.cache[cache_key]
            
        try:
            url = f"{self.base_url}/api/generate"
            payload = {
                "model": self.model,
                "prompt": prompt,
                "temperature": temperature,
                "stream": False
            }
            
            print(f"Sending request to Ollama API: {url}")
            print(f"Payload: {payload}")
            
            async with self.session.post(url, json=payload) as response:
                print(f"Response status: {response.status}")
                
                if response.status != 200:
                    error_text = await response.text()
                    print(f"Error response: {error_text}")
                    return f"Error: {error_text}"
                    
                result = await response.json()
                print(f"Response received, length: {len(str(result))}")
                generated_text = result.get('response', '')
                
                # Cache the result
                self.cache[cache_key] = generated_text
                return generated_text
                
        except Exception as e:
            print(f"Exception in generate_text: {str(e)}")
            return f"Error: {str(e)}"
            
    async def generate_researcher_dialog(self, researcher_type, specialization, context, current_situation):
        """Genera dialogo per un ricercatore usando un prompt template."""
        print(f"Generating dialog for {researcher_type} specialized in {specialization}")
        
        prompt_template = f"""
        Sei un {researcher_type} specializzato in {specialization}.
        Context attuale:
        - Stato laboratorio: {context.get('lab_state', 'normale')}
        - Agenti vicini: {', '.join(context.get('nearby_agents', []))}
        - Progresso FL: {context.get('fl_progress', 'iniziale')}
        - Conoscenze attuali: {context.get('knowledge_base', '')}
        
        Situazione corrente: {current_situation}
        
        Genera una breve frase (max 30 parole) che potresti dire in questa situazione, coerente con il tuo ruolo e specializzazione.
        """
        
        print(f"Prompt template prepared: {prompt_template[:50]}...")
        return await self.generate_text(prompt_template, temperature=0.8)

async def test_llm_standalone():
    """Test standalone per il connettore LLM."""
    print("=== Test LLM Connector Standalone ===")
    connector = SimpleLLMConnector()
    
    try:
        # Test di generazione semplice
        prompt = "Hello, who are you?"
        print(f"Testing basic generation with prompt: '{prompt}'")
        response = await connector.generate_text(prompt)
        print(f"Response received: {response[:100]}...")
        
        # Test di generazione dialogo ricercatore
        print("Testing researcher dialog generation")
        dialog = await connector.generate_researcher_dialog(
            researcher_type="PhD Student",
            specialization="Privacy Engineering",
            context={
                "lab_state": "attivo",
                "nearby_agents": ["Professor di FL Systems Architecture", "ML Engineer"],
                "fl_progress": "fase intermedia",
                "knowledge_base": "Differential Privacy, Secure Aggregation"
            },
            current_situation="Hai appena scoperto un miglioramento nell'algoritmo di secure aggregation"
        )
        print(f"Researcher dialog: '{dialog}'")
        
        if not dialog or dialog.startswith("Error"):
            print("LLM dialog generation failed")
            return False
            
        print("LLM connector test successful")
        return True
    except Exception as e:
        print(f"Test LLM standalone failed with exception: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        await connector.close()

if __name__ == "__main__":
    print("Script starting...")
    try:
        asyncio.run(test_llm_standalone())
        print("Script completed successfully")
    except Exception as e:
        print(f"Script failed with unhandled exception: {str(e)}")
        import traceback
        traceback.print_exc()