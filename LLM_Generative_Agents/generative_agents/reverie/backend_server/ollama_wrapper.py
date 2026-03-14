import ollama
import json
import numpy as np
from typing import List, Dict, Any
import hashlib

class OllamaWrapper:
    """Wrapper per sostituire le chiamate OpenAI con Ollama"""
    
    def __init__(self, model_name="qwen3:0.6b"):
        self.model_name = model_name
        self.embedding_cache = {}
        
    def create_chat_completion(self, messages: List[Dict], temperature: float = 0.7, 
                              max_tokens: int = 1000, top_p: float = 1.0) -> Dict:
        """Simula la chiamata ChatCompletion di OpenAI usando Ollama"""
        
        # Converti il formato dei messaggi da OpenAI a Ollama
        ollama_messages = []
        for msg in messages:
            role = msg.get('role', 'user')
            content = msg.get('content', '')
            
            # Ollama usa 'assistant' invece di 'assistant' 
            if role == 'system':
                ollama_messages.append({'role': 'system', 'content': content})
            elif role == 'user':
                ollama_messages.append({'role': 'user', 'content': content})
            elif role == 'assistant':
                ollama_messages.append({'role': 'assistant', 'content': content})
        
        try:
            # Chiamata a Ollama
            response = ollama.chat(
                model=self.model_name,
                messages=ollama_messages,
                options={
                    'temperature': temperature,
                    'num_predict': max_tokens,
                    'top_p': top_p,
                }
            )
            
            # Formatta la risposta nel formato OpenAI
            return {
                'choices': [{
                    'message': {
                        'role': 'assistant',
                        'content': response['message']['content']
                    },
                    'finish_reason': 'stop',
                    'index': 0
                }],
                'usage': {
                    'prompt_tokens': response.get('prompt_eval_count', 0),
                    'completion_tokens': response.get('eval_count', 0),
                    'total_tokens': response.get('prompt_eval_count', 0) + response.get('eval_count', 0)
                }
            }
        except Exception as e:
            print(f"Errore nella chiamata a Ollama: {e}")
            raise
    
    def create_completion(self, prompt: str, temperature: float = 0.7, 
                         max_tokens: int = 1000, top_p: float = 1.0) -> Dict:
        """Simula la chiamata Completion di OpenAI usando Ollama"""
        
        try:
            response = ollama.generate(
                model=self.model_name,
                prompt=prompt,
                options={
                    'temperature': temperature,
                    'num_predict': max_tokens,
                    'top_p': top_p,
                }
            )
            
            return {
                'choices': [{
                    'text': response['response'],
                    'finish_reason': 'stop',
                    'index': 0
                }],
                'usage': {
                    'prompt_tokens': response.get('prompt_eval_count', 0),
                    'completion_tokens': response.get('eval_count', 0),
                    'total_tokens': response.get('prompt_eval_count', 0) + response.get('eval_count', 0)
                }
            }
        except Exception as e:
            print(f"Errore nella chiamata a Ollama: {e}")
            raise
    
    def create_embedding(self, text: str) -> List[float]:
        """Simula gli embeddings di OpenAI"""
        
        # Cache per velocizzare embeddings ripetuti
        text_hash = hashlib.md5(text.encode()).hexdigest()
        if text_hash in self.embedding_cache:
            return self.embedding_cache[text_hash]
        
        try:
            # Ollama supporta embeddings con alcuni modelli
            # Se il modello non supporta embeddings, usa un fallback
            try:
                response = ollama.embeddings(
                    model='nomic-embed-text',  # Modello specifico per embeddings
                    prompt=text
                )
                embedding = response['embedding']
            except:
                # Fallback: genera un embedding fittizio basato su hash del testo
                # Questo non è ideale ma permette al sistema di funzionare
                print("Warning: Usando embedding fittizio. Installa 'nomic-embed-text' per embeddings reali")
                print("Esegui: ollama pull nomic-embed-text")
                
                # Genera un vettore deterministico di 1536 dimensioni (come text-embedding-ada-002)
                np.random.seed(int(text_hash[:8], 16))
                embedding = np.random.randn(1536).tolist()
            
            self.embedding_cache[text_hash] = embedding
            return embedding
            
        except Exception as e:
            print(f"Errore nella generazione dell'embedding: {e}")
            # Ritorna un embedding casuale se fallisce
            return np.random.randn(1536).tolist()

# Istanza globale
ollama_client = OllamaWrapper(model_name="qwen3:0.6b")  # Puoi cambiare il modello qui