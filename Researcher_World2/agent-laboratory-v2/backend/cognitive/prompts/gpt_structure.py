"""
Unified LLM wrapper for Federated Generative Agents.
Ported from Park et al. (UIST 2023), adapted for Ollama/qwen3.5:4b.

Provides:
  - ChatGPT_request / GPT4_request: direct LLM calls
  - safe_generate_response: validated generation with retry
  - generate_prompt: template-based prompt construction
  - get_embedding: text embedding via Ollama or deterministic fallback
"""
import json
import re
import time
import hashlib
import os
import logging

import numpy as np

logger = logging.getLogger(__name__)

# ============================================================================
# Configuration - loaded from llm_config.json or defaults
# ============================================================================

_config_loaded = False
OLLAMA_MODEL = "qwen3.5:4b"
EMBEDDING_MODEL = "nomic-embed-text"
OLLAMA_TEMPERATURE = 0.05
OLLAMA_MAX_TOKENS = 60
OLLAMA_NUM_CTX = 256

EMBEDDING_CACHE = {}
RESPONSE_CACHE = {}
MAX_CACHE_SIZE = 500

# Tracks whether any LLM call succeeded since last check
_llm_call_succeeded = False


def get_and_reset_llm_success() -> bool:
    """Return True if at least one LLM call succeeded since last check, then reset."""
    global _llm_call_succeeded
    result = _llm_call_succeeded
    _llm_call_succeeded = False
    return result


def _load_config():
    """Load LLM config from llm_config.json if available."""
    global _config_loaded, OLLAMA_MODEL, EMBEDDING_MODEL
    global OLLAMA_TEMPERATURE, OLLAMA_MAX_TOKENS, OLLAMA_NUM_CTX, MAX_CACHE_SIZE

    if _config_loaded:
        return

    config_paths = [
        os.path.join(os.path.dirname(__file__), '..', '..', 'config', 'llm_config.json'),
    ]

    for config_path in config_paths:
        config_path = os.path.abspath(config_path)
        if os.path.exists(config_path):
            try:
                with open(config_path) as f:
                    cfg = json.load(f)
                llm = cfg.get("llm", {})
                OLLAMA_MODEL = llm.get("model", OLLAMA_MODEL)
                params = llm.get("parameters", {})
                OLLAMA_TEMPERATURE = params.get("temperature", OLLAMA_TEMPERATURE)
                OLLAMA_MAX_TOKENS = params.get("max_tokens", OLLAMA_MAX_TOKENS)

                caching = cfg.get("caching", cfg.get("advanced_settings", {}))
                MAX_CACHE_SIZE = caching.get("max_cache_size", MAX_CACHE_SIZE)

                logger.info(f"LLM config loaded: model={OLLAMA_MODEL}")
                break
            except Exception as e:
                logger.warning(f"Failed to load LLM config from {config_path}: {e}")

    _config_loaded = True


_ollama_client = None

def _get_ollama():
    """Lazy creation of ollama Client with 60s timeout (qwen3.5:4b on CPU needs ~25-40s)."""
    global _ollama_client
    if _ollama_client is not None:
        return _ollama_client
    try:
        import ollama
        _ollama_client = ollama.Client(timeout=60)
        return _ollama_client
    except ImportError:
        logger.error("ollama package not installed. Run: pip install ollama")
        return None


# ============================================================================
# Cache Management
# ============================================================================

def manage_cache():
    """Remove oldest 20% of cache entries when size limit exceeded."""
    if len(RESPONSE_CACHE) > MAX_CACHE_SIZE:
        items_to_remove = int(MAX_CACHE_SIZE * 0.2)
        for i, key in enumerate(list(RESPONSE_CACHE.keys())):
            if i >= items_to_remove:
                break
            del RESPONSE_CACHE[key]


def temp_sleep(seconds=0.01):
    time.sleep(seconds)


# ============================================================================
# Response Cleaning
# ============================================================================

def clean_ollama_response(response):
    """Clean Ollama response removing thinking tags and verbose output."""
    # Remove <think> tags
    if '<think>' in response:
        parts = response.split('</think>')
        if len(parts) > 1:
            response = parts[-1].strip()
        else:
            response = response.split('<think>')[-1].strip()

    # Remove verbose thinking patterns
    response = re.sub(r'TOODOOOOOO.*?(?=\d+\)|\n\n|$)', '', response, flags=re.DOTALL)
    response = re.sub(r'Okay, let\'s.*?(?=\d+\)|\n\n|$)', '', response, flags=re.DOTALL)
    response = re.sub(r'Wait,.*?(?=\d+\)|\n\n|$)', '', response, flags=re.DOTALL)
    response = re.sub(r'Hmm,.*?(?=\d+\)|\n\n|$)', '', response, flags=re.DOTALL)
    response = re.sub(r'First,.*?(?=\d+\)|\n\n|$)', '', response, flags=re.DOTALL)

    # Remove math and code blocks
    response = re.sub(r'\$.*?\$', '', response, flags=re.DOTALL)
    response = re.sub(r'\\boxed\{.*?\}', '', response, flags=re.DOTALL)
    response = re.sub(r'\*\*Final Answer\*\*.*?(?=\d+\)|\n\n|$)', '', response, flags=re.DOTALL)
    response = re.sub(r'```python.*?```', '', response, flags=re.DOTALL)
    response = re.sub(r'```.*?```', '', response, flags=re.DOTALL)

    # Remove common tags
    response = response.replace('<|im_end|>', '')
    response = response.replace('<|im_start|>', '')

    # Clean non-task lines
    lines = response.split('\n')
    cleaned_lines = []
    for line in lines:
        line = line.strip()
        if line and (re.match(r'^\d+\)', line) or
                     not line.startswith(('$', '\\', '**', '#', '`', '---', 'Thinking'))):
            cleaned_lines.append(line)

    return '\n'.join(cleaned_lines).strip()


# ============================================================================
# Core LLM Call Functions
# ============================================================================

def ollama_chat_request(prompt, model=None, temperature=None, max_tokens=None):
    """Make a chat request to Ollama with caching."""
    _load_config()
    model = model or OLLAMA_MODEL
    temperature = temperature if temperature is not None else OLLAMA_TEMPERATURE
    max_tokens = max_tokens or OLLAMA_MAX_TOKENS

    cache_key = hashlib.md5(f"{prompt}_{model}_{temperature}".encode()).hexdigest()
    if cache_key in RESPONSE_CACHE:
        return RESPONSE_CACHE[cache_key]

    ol = _get_ollama()
    if not ol:
        return "OLLAMA NOT AVAILABLE"

    try:
        response = ol.chat(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            options={
                'temperature': temperature,
                'num_predict': max_tokens,
                'top_k': 5,
                'top_p': 0.2,
                'repeat_penalty': 1.0,
                'num_ctx': OLLAMA_NUM_CTX,
            }
        )
        msg = response.message if hasattr(response, 'message') else response['message']
        content = msg.content if hasattr(msg, 'content') else msg['content']
        result = clean_ollama_response(content)
        RESPONSE_CACHE[cache_key] = result
        manage_cache()
        global _llm_call_succeeded
        _llm_call_succeeded = True
        return result
    except Exception as e:
        logger.warning(f"Ollama chat: {e}")
        return "OLLAMA ERROR"


def ollama_generate_request(prompt, model=None, temperature=None, max_tokens=None):
    """Make a generate request to Ollama with caching."""
    _load_config()
    model = model or OLLAMA_MODEL
    temperature = temperature if temperature is not None else OLLAMA_TEMPERATURE
    max_tokens = max_tokens or OLLAMA_MAX_TOKENS

    cache_key = hashlib.md5(f"gen_{prompt}_{model}_{temperature}".encode()).hexdigest()
    if cache_key in RESPONSE_CACHE:
        return RESPONSE_CACHE[cache_key]

    ol = _get_ollama()
    if not ol:
        return "OLLAMA NOT AVAILABLE"

    try:
        response = ol.generate(
            model=model,
            prompt=prompt,
            options={
                'temperature': temperature,
                'num_predict': max_tokens,
                'top_k': 5,
                'top_p': 0.2,
                'repeat_penalty': 1.0,
                'num_ctx': OLLAMA_NUM_CTX,
            },
            think=False,
        )
        raw = response.response if hasattr(response, 'response') else response['response']
        result = clean_ollama_response(raw)
        RESPONSE_CACHE[cache_key] = result
        manage_cache()
        global _llm_call_succeeded
        _llm_call_succeeded = True
        return result
    except Exception as e:
        logger.warning(f"Ollama generate: {e}")
        return "OLLAMA ERROR"


# ============================================================================
# Public API (compatible with GA's interface)
# ============================================================================

def ChatGPT_single_request(prompt):
    temp_sleep()
    return ollama_chat_request(prompt)


def GPT4_request(prompt):
    """Request using the primary model (replaces GPT-4 calls)."""
    temp_sleep()
    return ollama_chat_request(prompt, temperature=0.05, max_tokens=80)


def ChatGPT_request(prompt):
    """Request with higher temperature for creative output."""
    try:
        return ollama_chat_request(prompt, temperature=0.7, max_tokens=80)
    except:
        logger.error("Ollama ERROR in ChatGPT_request")
        return "OLLAMA ERROR"


def GPT4_safe_generate_response(prompt,
                                example_output,
                                special_instruction,
                                repeat=1,
                                fail_safe_response="error",
                                func_validate=None,
                                func_clean_up=None,
                                verbose=False):
    """Validated generation with JSON output parsing."""
    prompt = 'Prompt:\n"""\n' + prompt + '\n"""\n'
    prompt += f"Output the response to the prompt above in json. {special_instruction}\n"
    prompt += "Example output json:\n"
    prompt += '{"output": "' + str(example_output) + '"}'

    if verbose:
        print("OLLAMA PROMPT")
        print(prompt)

    for i in range(repeat):
        try:
            curr_response = GPT4_request(prompt).strip()

            if '{"output":' in curr_response:
                start_index = curr_response.find('{"output":')
                end_index = curr_response.rfind('}') + 1
                curr_response = curr_response[start_index:end_index]
            else:
                curr_response = json.dumps({"output": curr_response})

            curr_response = json.loads(curr_response)["output"]

            if func_validate(curr_response, prompt=prompt):
                return func_clean_up(curr_response, prompt=prompt)

            if verbose:
                print(f"---- repeat count: {i}")
                print(curr_response)
        except Exception as e:
            if verbose:
                print(f"JSON parsing error: {e}")

    return fail_safe_response


def ChatGPT_safe_generate_response(prompt,
                                   example_output,
                                   special_instruction,
                                   repeat=1,
                                   fail_safe_response="error",
                                   func_validate=None,
                                   func_clean_up=None,
                                   verbose=False):
    """Validated generation with JSON output parsing (ChatGPT variant)."""
    prompt = '"""\n' + prompt + '\n"""\n'
    prompt += f"Output the response to the prompt above in json. {special_instruction}\n"
    prompt += "Example output json:\n"
    prompt += '{"output": "' + str(example_output) + '"}'

    if verbose:
        print("OLLAMA PROMPT")
        print(prompt)

    for i in range(repeat):
        try:
            curr_response = ChatGPT_request(prompt).strip()

            if '{"output":' in curr_response:
                start_index = curr_response.find('{"output":')
                end_index = curr_response.rfind('}') + 1
                curr_response = curr_response[start_index:end_index]
            else:
                curr_response = json.dumps({"output": curr_response})

            curr_response = json.loads(curr_response)["output"]

            if func_validate(curr_response, prompt=prompt):
                return func_clean_up(curr_response, prompt=prompt)

            if verbose:
                print(f"---- repeat count: {i}")
                print(curr_response)
        except Exception as e:
            if verbose:
                print(f"JSON parsing error: {e}")

    return fail_safe_response


def GPT_request(prompt, gpt_parameter):
    """Legacy-compatible generation with parameter dict."""
    temp_sleep()
    try:
        temperature = gpt_parameter.get("temperature", 0.3)
        max_tokens = gpt_parameter.get("max_tokens", 500)
        return ollama_generate_request(prompt=prompt, temperature=temperature, max_tokens=max_tokens)
    except:
        logger.error("OLLAMA ERROR in GPT_request")
        return "OLLAMA ERROR"


def generate_prompt(curr_input, prompt_lib_file):
    """
    Load a prompt template and fill in placeholders.
    Placeholders: !<INPUT 0>!, !<INPUT 1>!, etc.
    """
    if isinstance(curr_input, str):
        curr_input = [curr_input]
    curr_input = [str(i) for i in curr_input]

    with open(prompt_lib_file, "r") as f:
        prompt = f.read()

    for count, i in enumerate(curr_input):
        prompt = prompt.replace(f"!<INPUT {count}>!", i)

    if "<commentblockmarker>###</commentblockmarker>" in prompt:
        prompt = prompt.split("<commentblockmarker>###</commentblockmarker>")[1]

    return prompt.strip()


def safe_generate_response(prompt,
                           gpt_parameter,
                           repeat=1,
                           fail_safe_response="error",
                           func_validate=None,
                           func_clean_up=None,
                           verbose=False):
    """Generate response with validation and retry logic."""
    if verbose:
        print(prompt)

    for i in range(repeat):
        curr_response = GPT_request(prompt, gpt_parameter)
        if func_validate(curr_response, prompt=prompt):
            return func_clean_up(curr_response, prompt=prompt)
        if verbose:
            print(f"---- repeat count: {i}")
            print(curr_response)

    return fail_safe_response


def get_embedding(text, model=None):
    """
    Generate text embeddings via Ollama or deterministic fallback.
    Uses caching for performance.
    """
    _load_config()
    global EMBEDDING_CACHE

    text = text.replace("\n", " ")
    if not text:
        text = "this is blank"

    text_hash = hashlib.md5(text.encode()).hexdigest()
    if text_hash in EMBEDDING_CACHE:
        return EMBEDDING_CACHE[text_hash]

    ol = _get_ollama()
    if ol and not getattr(get_embedding, '_ollama_embed_failed', False):
        try:
            # Check if model is available before calling (avoids pull-hang)
            model_list = ol.list()
            if hasattr(model_list, 'models'):
                # New API: ListResponse with .models attribute
                available = [
                    (m.model if hasattr(m, 'model') else m.name).split(':')[0]
                    for m in model_list.models
                ]
            else:
                # Old API: dict with 'models' key
                available = [m['name'].split(':')[0] for m in model_list.get('models', [])]
            if EMBEDDING_MODEL.split(':')[0] in available:
                response = ol.embeddings(model=EMBEDDING_MODEL, prompt=text)
                embedding = response.embedding if hasattr(response, 'embedding') else response['embedding']
                EMBEDDING_CACHE[text_hash] = embedding
                return embedding
            else:
                logger.warning(f"Embedding model '{EMBEDDING_MODEL}' not available, using fallback")
                get_embedding._ollama_embed_failed = True
        except Exception:
            get_embedding._ollama_embed_failed = True

    # Deterministic fallback: hash-based pseudo-embedding (1536-dim for compatibility)
    logger.warning(f"Using deterministic embedding fallback. Install '{EMBEDDING_MODEL}' with: ollama pull {EMBEDDING_MODEL}")
    np.random.seed(int(text_hash[:8], 16))
    embedding = np.random.randn(1536).tolist()
    EMBEDDING_CACHE[text_hash] = embedding
    return embedding
