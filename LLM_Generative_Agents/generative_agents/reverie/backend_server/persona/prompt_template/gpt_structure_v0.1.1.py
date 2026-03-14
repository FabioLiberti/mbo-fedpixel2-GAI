"""
Author: Joon Sung Park (joonspk@stanford.edu)
Modified for Ollama integration

File: gpt_structure.py
Description: Wrapper functions for calling Ollama APIs instead of OpenAI.
"""
import json
import random
import time
import ollama
import numpy as np
import hashlib

from utils import *

# Configurazione Ollama
OLLAMA_MODEL = "qwen3:0.6b"  # Cambia con il modello che preferisci
EMBEDDING_MODEL = "nomic-embed-text"  # Per embeddings
EMBEDDING_CACHE = {}  # Cache per embeddings

def temp_sleep(seconds=0.1):
  time.sleep(seconds)

def ollama_chat_request(prompt, model=OLLAMA_MODEL, temperature=0.7, max_tokens=500):
  """
  Funzione helper per fare richieste chat a Ollama
  """
  try:
    response = ollama.chat(
      model=model,
      messages=[{"role": "user", "content": prompt}],
      options={
        'temperature': temperature,
        'num_predict': max_tokens,
      }
    )
    return response['message']['content']
  except Exception as e:
    print(f"Errore Ollama: {e}")
    return "OLLAMA ERROR"

def ollama_generate_request(prompt, model=OLLAMA_MODEL, temperature=0.7, max_tokens=500):
  """
  Funzione helper per fare richieste generate a Ollama
  """
  try:
    response = ollama.generate(
      model=model,
      prompt=prompt,
      options={
        'temperature': temperature,
        'num_predict': max_tokens,
      }
    )
    return response['response']
  except Exception as e:
    print(f"Errore Ollama: {e}")
    return "OLLAMA ERROR"

def ChatGPT_single_request(prompt): 
  temp_sleep()
  return ollama_chat_request(prompt)

# ============================================================================
# #####################[SECTION 1: CHATGPT-3 STRUCTURE] ######################
# ============================================================================

def GPT4_request(prompt): 
  """
  Given a prompt and a dictionary of GPT parameters, make a request to Ollama
  server and returns the response. 
  ARGS:
    prompt: a str prompt
  RETURNS: 
    a str of Ollama's response. 
  """
  temp_sleep()
  
  try:
    # Usa un modello più potente per le richieste "GPT-4"
    # Se hai un modello più grande disponibile, usalo qui
    return ollama_chat_request(prompt, model=OLLAMA_MODEL, temperature=0.7, max_tokens=1000)
  except: 
    print ("Ollama ERROR")
    return "Ollama ERROR"


def ChatGPT_request(prompt): 
  """
  Given a prompt, make a request to Ollama server and returns the response. 
  ARGS:
    prompt: a str prompt
  RETURNS: 
    a str of Ollama's response. 
  """
  try:
    return ollama_chat_request(prompt, temperature=0.7, max_tokens=500)
  except: 
    print ("Ollama ERROR")
    return "Ollama ERROR"


def GPT4_safe_generate_response(prompt, 
                                   example_output,
                                   special_instruction,
                                   repeat=3,
                                   fail_safe_response="error",
                                   func_validate=None,
                                   func_clean_up=None,
                                   verbose=False): 
  prompt = 'Prompt:\n"""\n' + prompt + '\n"""\n'
  prompt += f"Output the response to the prompt above in json. {special_instruction}\n"
  prompt += "Example output json:\n"
  prompt += '{"output": "' + str(example_output) + '"}'

  if verbose: 
    print ("OLLAMA PROMPT")
    print (prompt)

  for i in range(repeat): 
    try: 
      curr_gpt_response = GPT4_request(prompt).strip()
      
      # Prova a estrarre JSON dalla risposta
      if '{"output":' in curr_gpt_response:
        start_index = curr_gpt_response.find('{"output":')
        end_index = curr_gpt_response.rfind('}') + 1
        curr_gpt_response = curr_gpt_response[start_index:end_index]
      else:
        # Se non c'è JSON, crea una struttura JSON con la risposta
        curr_gpt_response = json.dumps({"output": curr_gpt_response})
      
      curr_gpt_response = json.loads(curr_gpt_response)["output"]
      
      if func_validate(curr_gpt_response, prompt=prompt): 
        return func_clean_up(curr_gpt_response, prompt=prompt)
      
      if verbose: 
        print ("---- repeat count: \n", i, curr_gpt_response)
        print (curr_gpt_response)
        print ("~~~~")

    except Exception as e: 
      if verbose:
        print(f"Errore nel parsing JSON: {e}")
      pass

  return fail_safe_response


def ChatGPT_safe_generate_response(prompt, 
                                   example_output,
                                   special_instruction,
                                   repeat=3,
                                   fail_safe_response="error",
                                   func_validate=None,
                                   func_clean_up=None,
                                   verbose=False): 
  prompt = '"""\n' + prompt + '\n"""\n'
  prompt += f"Output the response to the prompt above in json. {special_instruction}\n"
  prompt += "Example output json:\n"
  prompt += '{"output": "' + str(example_output) + '"}'

  if verbose: 
    print ("OLLAMA PROMPT")
    print (prompt)

  for i in range(repeat): 
    try: 
      curr_gpt_response = ChatGPT_request(prompt).strip()
      
      # Prova a estrarre JSON dalla risposta
      if '{"output":' in curr_gpt_response:
        start_index = curr_gpt_response.find('{"output":')
        end_index = curr_gpt_response.rfind('}') + 1
        curr_gpt_response = curr_gpt_response[start_index:end_index]
      else:
        # Se non c'è JSON, crea una struttura JSON con la risposta
        curr_gpt_response = json.dumps({"output": curr_gpt_response})
      
      curr_gpt_response = json.loads(curr_gpt_response)["output"]
      
      if func_validate(curr_gpt_response, prompt=prompt): 
        return func_clean_up(curr_gpt_response, prompt=prompt)
      
      if verbose: 
        print ("---- repeat count: \n", i, curr_gpt_response)
        print (curr_gpt_response)
        print ("~~~~")

    except Exception as e:
      if verbose:
        print(f"Errore nel parsing JSON: {e}")
      pass

  return fail_safe_response


def ChatGPT_safe_generate_response_OLD(prompt, 
                                   repeat=3,
                                   fail_safe_response="error",
                                   func_validate=None,
                                   func_clean_up=None,
                                   verbose=False): 
  if verbose: 
    print ("OLLAMA PROMPT")
    print (prompt)

  for i in range(repeat): 
    try: 
      curr_gpt_response = ChatGPT_request(prompt).strip()
      if func_validate(curr_gpt_response, prompt=prompt): 
        return func_clean_up(curr_gpt_response, prompt=prompt)
      if verbose: 
        print (f"---- repeat count: {i}")
        print (curr_gpt_response)
        print ("~~~~")

    except: 
      pass
  print ("FAIL SAFE TRIGGERED") 
  return fail_safe_response


# ============================================================================
# ###################[SECTION 2: ORIGINAL GPT-3 STRUCTURE] ###################
# ============================================================================

def GPT_request(prompt, gpt_parameter): 
  """
  Given a prompt and a dictionary of GPT parameters, make a request to Ollama
  server and returns the response. 
  ARGS:
    prompt: a str prompt
    gpt_parameter: a python dictionary with the keys indicating the names of  
                   the parameter and the values indicating the parameter 
                   values.   
  RETURNS: 
    a str of Ollama's response. 
  """
  temp_sleep()
  try:
    # Estrai parametri rilevanti per Ollama
    temperature = gpt_parameter.get("temperature", 0.7)
    max_tokens = gpt_parameter.get("max_tokens", 500)
    
    response = ollama_generate_request(
      prompt=prompt,
      temperature=temperature,
      max_tokens=max_tokens
    )
    return response
  except: 
    print ("OLLAMA ERROR")
    return "OLLAMA ERROR"


def generate_prompt(curr_input, prompt_lib_file): 
  """
  Takes in the current input (e.g. comment that you want to classifiy) and 
  the path to a prompt file. The prompt file contains the raw str prompt that
  will be used, which contains the following substr: !<INPUT>! -- this 
  function replaces this substr with the actual curr_input to produce the 
  final promopt that will be sent to the GPT3 server. 
  ARGS:
    curr_input: the input we want to feed in (IF THERE ARE MORE THAN ONE
                INPUT, THIS CAN BE A LIST.)
    prompt_lib_file: the path to the promopt file. 
  RETURNS: 
    a str prompt that will be sent to Ollama server.  
  """
  if type(curr_input) == type("string"): 
    curr_input = [curr_input]
  curr_input = [str(i) for i in curr_input]

  f = open(prompt_lib_file, "r")
  prompt = f.read()
  f.close()
  for count, i in enumerate(curr_input):   
    prompt = prompt.replace(f"!<INPUT {count}>!", i)
  if "<commentblockmarker>###</commentblockmarker>" in prompt: 
    prompt = prompt.split("<commentblockmarker>###</commentblockmarker>")[1]
  return prompt.strip()


def safe_generate_response(prompt, 
                           gpt_parameter,
                           repeat=5,
                           fail_safe_response="error",
                           func_validate=None,
                           func_clean_up=None,
                           verbose=False): 
  if verbose: 
    print (prompt)

  for i in range(repeat): 
    curr_gpt_response = GPT_request(prompt, gpt_parameter)
    if func_validate(curr_gpt_response, prompt=prompt): 
      return func_clean_up(curr_gpt_response, prompt=prompt)
    if verbose: 
      print ("---- repeat count: ", i, curr_gpt_response)
      print (curr_gpt_response)
      print ("~~~~")
  return fail_safe_response


def get_embedding(text, model="text-embedding-ada-002"):
  """
  Genera embeddings usando Ollama o un fallback deterministico
  """
  global EMBEDDING_CACHE
  
  text = text.replace("\n", " ")
  if not text: 
    text = "this is blank"
  
  # Usa cache per velocizzare
  text_hash = hashlib.md5(text.encode()).hexdigest()
  if text_hash in EMBEDDING_CACHE:
    return EMBEDDING_CACHE[text_hash]
  
  try:
    # Prova a usare il modello di embedding di Ollama
    response = ollama.embeddings(
      model=EMBEDDING_MODEL,
      prompt=text
    )
    embedding = response['embedding']
  except:
    # Fallback: genera embedding deterministico basato su hash
    # Dimensione 1536 per compatibilità con ada-002
    print(f"Warning: Usando embedding deterministico. Installa '{EMBEDDING_MODEL}' con: ollama pull {EMBEDDING_MODEL}")
    np.random.seed(int(text_hash[:8], 16))
    embedding = np.random.randn(1536).tolist()
  
  EMBEDDING_CACHE[text_hash] = embedding
  return embedding


if __name__ == '__main__':
  # Test del sistema
  print("Testing Ollama integration...")
  
  # Test ChatGPT_request
  response = ChatGPT_request("Ciao, come stai?")
  print(f"Chat response: {response[:100]}...")
  
  # Test embedding
  embedding = get_embedding("test text")
  print(f"Embedding size: {len(embedding)}")
  print(f"First 5 values: {embedding[:5]}")
  
  print("\nOllama integration test completed!")

