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
from threading import Lock

import numpy as np

logger = logging.getLogger(__name__)


# ============================================================================
# OllamaService — singleton encapsulating all LLM state
# ============================================================================

class OllamaService:
    """Thread-safe singleton managing Ollama client, config, and caches."""

    _instance = None
    _init_lock = Lock()

    def __new__(cls):
        if cls._instance is None:
            with cls._init_lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._lock = Lock()

        # Config defaults
        self.model = "qwen3.5:4b"
        self.embedding_model = "nomic-embed-text"
        self.temperature = 0.05
        self.max_tokens = 150
        self.num_ctx = 512
        self.max_cache_size = 500

        # State
        self._config_loaded = False
        self._client = None
        self._llm_call_succeeded = False
        self._embed_failed = False

        # Caches
        self.response_cache = {}
        self.embedding_cache = {}

    def load_config(self):
        if self._config_loaded:
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
                    self.model = llm.get("model", self.model)
                    params = llm.get("parameters", {})
                    self.temperature = params.get("temperature", self.temperature)
                    self.max_tokens = params.get("max_tokens", self.max_tokens)
                    caching = cfg.get("caching", cfg.get("advanced_settings", {}))
                    self.max_cache_size = caching.get("max_cache_size", self.max_cache_size)
                    logger.info(f"LLM config loaded: model={self.model}")
                    break
                except Exception as e:
                    logger.warning(f"Failed to load LLM config from {config_path}: {e}")
        self._config_loaded = True

    def get_client(self):
        if self._client is not None:
            return self._client
        try:
            import ollama
            self._client = ollama.Client(timeout=60)
            return self._client
        except ImportError:
            logger.error("ollama package not installed. Run: pip install ollama")
            return None

    def manage_cache(self):
        with self._lock:
            if len(self.response_cache) > self.max_cache_size:
                items_to_remove = int(self.max_cache_size * 0.2)
                for i, key in enumerate(list(self.response_cache.keys())):
                    if i >= items_to_remove:
                        break
                    del self.response_cache[key]

    def get_and_reset_llm_success(self) -> bool:
        with self._lock:
            result = self._llm_call_succeeded
            self._llm_call_succeeded = False
            return result

    def mark_llm_success(self):
        with self._lock:
            self._llm_call_succeeded = True


# Module-level singleton instance
_service = OllamaService()


def get_and_reset_llm_success() -> bool:
    """Return True if at least one LLM call succeeded since last check, then reset."""
    return _service.get_and_reset_llm_success()


def temp_sleep(seconds=0.01):
    time.sleep(seconds)


# ============================================================================
# Response Cleaning
# ============================================================================

def clean_ollama_response(response):
    """Clean Ollama response removing thinking tags and verbose output."""
    original = response

    # Remove <think> tags — keep content AFTER </think>, or inside if no closing tag
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

    result = '\n'.join(cleaned_lines).strip()

    # Safety: if cleaning removed everything but original had content,
    # extract the think block content as fallback
    if not result and original and len(original) > 10:
        think_match = re.search(r'<think>(.*?)</think>', original, flags=re.DOTALL)
        if think_match:
            inner = think_match.group(1).strip()
            paragraphs = [p.strip() for p in inner.split('\n\n') if p.strip()]
            if paragraphs:
                result = paragraphs[-1]
                result = re.sub(r'^(So|Okay|Hmm|Wait|Let me|First),?\s*', '', result)
                result = result.strip()

    return result


# ============================================================================
# Core LLM Call Functions
# ============================================================================

def ollama_chat_request(prompt, model=None, temperature=None, max_tokens=None):
    """Make a chat request to Ollama with caching."""
    _service.load_config()
    model = model or _service.model
    temperature = temperature if temperature is not None else _service.temperature
    max_tokens = max_tokens or _service.max_tokens

    cache_key = hashlib.md5(f"{prompt}_{model}_{temperature}".encode()).hexdigest()
    if cache_key in _service.response_cache:
        return _service.response_cache[cache_key]

    ol = _service.get_client()
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
                'num_ctx': _service.num_ctx,
            },
            think=False,
        )
        msg = response.message if hasattr(response, 'message') else response['message']
        content = msg.content if hasattr(msg, 'content') else msg['content']
        result = clean_ollama_response(content)
        _service.response_cache[cache_key] = result
        _service.manage_cache()
        _service.mark_llm_success()
        return result
    except Exception as e:
        logger.warning(f"Ollama chat: {e}")
        return "OLLAMA ERROR"


def ollama_generate_request(prompt, model=None, temperature=None, max_tokens=None):
    """Make a generate request to Ollama with caching."""
    _service.load_config()
    model = model or _service.model
    temperature = temperature if temperature is not None else _service.temperature
    max_tokens = max_tokens or _service.max_tokens

    cache_key = hashlib.md5(f"gen_{prompt}_{model}_{temperature}".encode()).hexdigest()
    if cache_key in _service.response_cache:
        return _service.response_cache[cache_key]

    ol = _service.get_client()
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
                'num_ctx': _service.num_ctx,
            },
            think=False,
        )
        raw = response.response if hasattr(response, 'response') else response['response']
        result = clean_ollama_response(raw)
        _service.response_cache[cache_key] = result
        _service.manage_cache()
        _service.mark_llm_success()
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
    return ollama_chat_request(prompt, temperature=0.05, max_tokens=150)


def ChatGPT_request(prompt):
    """Request with higher temperature for creative output."""
    try:
        return ollama_chat_request(prompt, temperature=0.7, max_tokens=150)
    except Exception as e:
        logger.error(f"Ollama ERROR in ChatGPT_request: {e}")
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
    except Exception as e:
        logger.error(f"OLLAMA ERROR in GPT_request: {e}")
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
    _service.load_config()

    text = text.replace("\n", " ")
    if not text:
        text = "this is blank"

    text_hash = hashlib.md5(text.encode()).hexdigest()
    if text_hash in _service.embedding_cache:
        return _service.embedding_cache[text_hash]

    ol = _service.get_client()
    if ol and not _service._embed_failed:
        try:
            model_list = ol.list()
            if hasattr(model_list, 'models'):
                available = [
                    (m.model if hasattr(m, 'model') else m.name).split(':')[0]
                    for m in model_list.models
                ]
            else:
                available = [m['name'].split(':')[0] for m in model_list.get('models', [])]
            if _service.embedding_model.split(':')[0] in available:
                response = ol.embeddings(model=_service.embedding_model, prompt=text)
                embedding = response.embedding if hasattr(response, 'embedding') else response['embedding']
                _service.embedding_cache[text_hash] = embedding
                return embedding
            else:
                logger.warning(f"Embedding model '{_service.embedding_model}' not available, using fallback")
                _service._embed_failed = True
        except Exception as e:
            logger.debug(f"Ollama embedding failed: {e}")
            _service._embed_failed = True

    # Deterministic fallback: hash-based pseudo-embedding (1536-dim for compatibility)
    logger.warning(f"Using deterministic embedding fallback. Install '{_service.embedding_model}' with: ollama pull {_service.embedding_model}")
    np.random.seed(int(text_hash[:8], 16))
    embedding = np.random.randn(1536).tolist()
    _service.embedding_cache[text_hash] = embedding
    return embedding
