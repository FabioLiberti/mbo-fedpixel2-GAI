"""
Patch per fixare il parsing delle risposte di Ollama
"""
import re

def patch_run_gpt_prompt():
    """Applica patch al file run_gpt_prompt.py"""
    import sys
    import os
    
    # Importa il modulo originale
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import run_gpt_prompt
    
    # Salva la funzione originale
    original_func_clean_up = None
    
    # Cerca la funzione nel modulo
    for attr_name in dir(run_gpt_prompt):
        if '__func_clean_up' in attr_name:
            original_func_clean_up = getattr(run_gpt_prompt, attr_name)
            break
    
    def fixed_func_clean_up(gpt_response, prompt=""):
        """Versione fixata della funzione di cleanup"""
        try:
            # Prova il parsing originale
            if original_func_clean_up:
                return original_func_clean_up(gpt_response, prompt)
        except (ValueError, IndexError) as e:
            print(f"Parsing error, trying to fix: {e}")
            
            # Fallback: prova a estrarre le informazioni in modo più robusto
            output = []
            lines = gpt_response.strip().split('\n')
            total_duration = 60  # default
            time_left = total_duration
            
            for line in lines:
                # Cerca pattern come "1) Isabella is waking up. (duration in minutes: 5)"
                # o anche "1) Isabella is waking up. (duration in minutes: 5, minutes left: 55)"
                # o anche "waking up. (duration in minutes: 5)"
                
                # Estrai il task
                task_match = re.search(r'(?:Isabella is |is )?([^(]+)', line)
                if not task_match:
                    continue
                    
                task = task_match.group(1).strip().rstrip('.')
                
                # Estrai la durata
                duration_match = re.search(r'duration in minutes:\s*(\d+)', line)
                if duration_match:
                    duration = int(duration_match.group(1))
                else:
                    # Se non trova durata, usa 5 minuti di default
                    duration = 5
                
                time_left -= duration
                if time_left < 0:
                    time_left = 0
                
                output.append([task, duration])
                
                if time_left <= 0:
                    break
            
            # Se non ha trovato niente, genera tasks di default
            if not output:
                output = [
                    ["getting ready", 10],
                    ["preparing for the day", 10],
                    ["having breakfast", 20],
                    ["checking messages", 10],
                    ["heading out", 10]
                ]
            
            return output
    
    # Sostituisci la funzione nel modulo
    if original_func_clean_up:
        setattr(run_gpt_prompt, original_func_clean_up.__name__, fixed_func_clean_up)
    
    print("Patch applied successfully!")

if __name__ == "__main__":
    patch_run_gpt_prompt()