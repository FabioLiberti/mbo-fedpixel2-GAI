"""
Prompt system for generative agents.
Contains LLM wrapper, prompt generation, and template management.
"""
from .gpt_structure import (
    ChatGPT_request,
    GPT4_request,
    GPT_request,
    ChatGPT_safe_generate_response,
    GPT4_safe_generate_response,
    safe_generate_response,
    generate_prompt,
    get_embedding,
)
