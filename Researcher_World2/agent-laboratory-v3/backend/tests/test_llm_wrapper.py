"""
Test per Incremento 2: LLM Wrapper Unificato (gpt_structure.py)
Richiede Ollama attivo con qwen3.5:4b e nomic-embed-text.
"""
import sys
import os
import tempfile

# Aggiungi backend al path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from cognitive.prompts.gpt_structure import (
    ChatGPT_request,
    GPT4_request,
    safe_generate_response,
    generate_prompt,
    get_embedding,
    clean_ollama_response,
    _load_config,
    OLLAMA_MODEL,
)


def test_config_loading():
    """Verifica che la config venga caricata da llm_config.json."""
    _load_config()
    print(f"  Model loaded: {OLLAMA_MODEL}")
    assert OLLAMA_MODEL == "qwen3.5:4b", f"Expected qwen3.5:4b, got {OLLAMA_MODEL}"
    print("  [OK] Config loading")


def test_clean_response():
    """Verifica pulizia risposta con tag <think>."""
    raw = "<think>Let me think about this...</think>Hello, I am an AI."
    cleaned = clean_ollama_response(raw)
    assert "<think>" not in cleaned
    assert "Hello" in cleaned
    print("  [OK] Response cleaning")


def test_chatgpt_request():
    """Verifica chiamata ChatGPT_request con risposta valida."""
    response = ChatGPT_request("Respond with exactly one word: hello")
    print(f"  Response: '{response[:80]}...' " if len(response) > 80 else f"  Response: '{response}'")
    assert response != "OLLAMA ERROR", "Ollama returned error"
    assert response != "OLLAMA NOT AVAILABLE", "Ollama not available"
    assert len(response) > 0, "Empty response"
    print("  [OK] ChatGPT_request")


def test_gpt4_request():
    """Verifica chiamata GPT4_request."""
    response = GPT4_request("What is 2+2? Answer with just the number.")
    print(f"  Response: '{response[:80]}...' " if len(response) > 80 else f"  Response: '{response}'")
    assert response != "OLLAMA ERROR"
    assert response != "OLLAMA NOT AVAILABLE"
    assert len(response) > 0
    print("  [OK] GPT4_request")


def test_get_embedding():
    """Verifica generazione embedding."""
    embedding = get_embedding("test federated learning")
    assert isinstance(embedding, list), f"Expected list, got {type(embedding)}"
    assert len(embedding) > 0, "Empty embedding"
    print(f"  Embedding dim: {len(embedding)}")
    # Verifica che il caching funzioni
    embedding2 = get_embedding("test federated learning")
    assert embedding == embedding2, "Cache not working"
    print("  [OK] get_embedding (with cache)")


def test_generate_prompt():
    """Verifica template prompt con placeholder."""
    # Crea file template temporaneo
    with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
        f.write("<commentblockmarker>###</commentblockmarker>\n")
        f.write("Agent !<INPUT 0>! is working on !<INPUT 1>! in lab !<INPUT 2>!.")
        f.flush()
        temp_path = f.name

    try:
        result = generate_prompt(["Alice", "federated learning", "Mercatorum"], temp_path)
        assert "Alice" in result
        assert "federated learning" in result
        assert "Mercatorum" in result
        assert "<commentblockmarker>" not in result
        print(f"  Prompt: '{result}'")
        print("  [OK] generate_prompt")
    finally:
        os.unlink(temp_path)


def test_safe_generate():
    """Verifica safe_generate_response con validazione."""
    gpt_param = {"temperature": 0.1, "max_tokens": 50}

    def validate(resp, prompt=""):
        return resp and len(resp.strip()) > 0

    def clean(resp, prompt=""):
        return resp.strip()

    result = safe_generate_response(
        prompt="What is 1+1? Answer with just the number.",
        gpt_parameter=gpt_param,
        repeat=2,
        fail_safe_response="error",
        func_validate=validate,
        func_clean_up=clean,
    )
    print(f"  Result: '{result}'")
    assert result != "error", "safe_generate_response failed all retries"
    print("  [OK] safe_generate_response")


if __name__ == "__main__":
    tests = [
        ("Config Loading", test_config_loading),
        ("Response Cleaning", test_clean_response),
        ("ChatGPT_request", test_chatgpt_request),
        ("GPT4_request", test_gpt4_request),
        ("get_embedding", test_get_embedding),
        ("generate_prompt", test_generate_prompt),
        ("safe_generate_response", test_safe_generate),
    ]

    passed = 0
    failed = 0
    for name, test_fn in tests:
        print(f"\n--- {name} ---")
        try:
            test_fn()
            passed += 1
        except Exception as e:
            print(f"  [FAIL] {e}")
            failed += 1

    print(f"\n{'='*40}")
    print(f"Results: {passed} passed, {failed} failed out of {len(tests)}")
    if failed == 0:
        print("ALL TESTS PASSED")
    else:
        print("SOME TESTS FAILED")
        sys.exit(1)
