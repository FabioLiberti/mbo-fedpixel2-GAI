"""
Enhanced conversation module with multi-model support and improved dialogue generation
"""
import math
import sys
import datetime
import random
import json
sys.path.append('../')

from global_methods import *
from persona.memory_structures.spatial_memory import *
from persona.memory_structures.associative_memory import *
from persona.memory_structures.scratch import *
from persona.cognitive_modules.retrieve import *
from persona.prompt_template.run_gpt_prompt import *

# Model configuration for different agent personalities
MODEL_CONFIGS = {
    "default": {
        "model": "qwen3:0.6b",
        "temperature": 0.7,
        "personality_traits": ["friendly", "curious"]
    },
    "creative": {
        "model": "llama3:7b",
        "temperature": 0.9,
        "personality_traits": ["artistic", "imaginative", "expressive"]
    },
    "analytical": {
        "model": "mistral:7b",
        "temperature": 0.5,
        "personality_traits": ["logical", "precise", "methodical"]
    },
    "social": {
        "model": "gemma:7b",
        "temperature": 0.8,
        "personality_traits": ["outgoing", "empathetic", "talkative"]
    }
}

def get_agent_model_config(persona):
    """
    Get the model configuration for a specific agent based on their personality
    """
    # Check if agent has specific model preference
    if hasattr(persona.scratch, 'llm_model_type'):
        model_type = persona.scratch.llm_model_type
    else:
        # Assign model based on personality traits
        if "artist" in persona.scratch.currently.lower() or "creative" in persona.scratch.currently.lower():
            model_type = "creative"
        elif "research" in persona.scratch.currently.lower() or "professor" in persona.scratch.currently.lower():
            model_type = "analytical"
        elif "cafe" in persona.scratch.currently.lower() or "social" in persona.scratch.currently.lower():
            model_type = "social"
        else:
            model_type = "default"
    
    return MODEL_CONFIGS.get(model_type, MODEL_CONFIGS["default"])

def generate_enhanced_chat_context(init_persona, target_persona, maze):
    """
    Generate enhanced context for more natural conversations
    """
    # Get recent shared experiences
    shared_locations = []
    if hasattr(init_persona.scratch, 'spatial_memory'):
        for loc in init_persona.scratch.spatial_memory.get_recent_locations(24):
            if loc in target_persona.scratch.spatial_memory.get_recent_locations(24):
                shared_locations.append(loc)
    
    # Build enhanced context
    context = {
        "current_activity": {
            "initiator": init_persona.scratch.act_description,
            "target": target_persona.scratch.act_description
        },
        "location": {
            "current": init_persona.scratch.curr_tile,
            "area": init_persona.scratch.curr_arena
        },
        "time": {
            "current": init_persona.scratch.curr_time,
            "day_phase": get_day_phase(init_persona.scratch.curr_time)
        },
        "relationship": {
            "familiarity": calculate_familiarity(init_persona, target_persona),
            "last_interaction": get_last_interaction_time(init_persona, target_persona),
            "shared_locations": shared_locations[:3]  # Last 3 shared locations
        },
        "mood": {
            "initiator": estimate_mood(init_persona),
            "target": estimate_mood(target_persona)
        }
    }
    
    return context

def calculate_familiarity(persona1, persona2):
    """
    Calculate familiarity score between two agents (0-100)
    """
    interaction_count = 0
    
    # Count past interactions
    for memory in persona1.a_mem.seq_event:
        if persona2.scratch.name in memory.embedding_key:
            interaction_count += 1
    
    # Cap at 100 for very familiar
    return min(interaction_count * 5, 100)

def get_last_interaction_time(persona1, persona2):
    """
    Get the last time two agents interacted
    """
    for memory in reversed(persona1.a_mem.seq_event):
        if persona2.scratch.name in memory.embedding_key and "conversation" in memory.embedding_key:
            return memory.created
    return None

def estimate_mood(persona):
    """
    Estimate agent's current mood based on recent activities
    """
    recent_events = persona.a_mem.get_recent_events(hours=2)
    
    positive_keywords = ["success", "happy", "enjoyed", "completed", "friend", "nice"]
    negative_keywords = ["failed", "tired", "frustrated", "problem", "difficult"]
    
    positive_score = 0
    negative_score = 0
    
    for event in recent_events:
        for keyword in positive_keywords:
            if keyword in event.embedding_key.lower():
                positive_score += 1
        for keyword in negative_keywords:
            if keyword in event.embedding_key.lower():
                negative_score += 1
    
    if positive_score > negative_score:
        return "positive"
    elif negative_score > positive_score:
        return "negative"
    else:
        return "neutral"

def get_day_phase(curr_time):
    """
    Determine the phase of day
    """
    hour = curr_time.hour
    if 5 <= hour < 12:
        return "morning"
    elif 12 <= hour < 17:
        return "afternoon"
    elif 17 <= hour < 21:
        return "evening"
    else:
        return "night"

def generate_conversation_topics(init_persona, target_persona, context):
    """
    Generate relevant conversation topics based on context
    """
    topics = []
    
    # Activity-based topics
    if "work" in context["current_activity"]["initiator"].lower():
        topics.append("work progress")
    if "coffee" in context["current_activity"]["target"].lower():
        topics.append("coffee preferences")
    
    # Time-based topics
    if context["time"]["day_phase"] == "morning":
        topics.append("morning routines")
    elif context["time"]["day_phase"] == "evening":
        topics.append("dinner plans")
    
    # Relationship-based topics
    if context["relationship"]["familiarity"] > 50:
        topics.extend(["shared memories", "future plans"])
    else:
        topics.extend(["introductions", "common interests"])
    
    # Location-based topics
    if "cafe" in context["location"]["area"].lower():
        topics.append("cafe atmosphere")
    elif "park" in context["location"]["area"].lower():
        topics.append("weather")
    
    # Mood-based adjustments
    if context["mood"]["target"] == "negative":
        topics.append("offering help")
    
    return topics

def generate_enhanced_dialogue(maze, init_persona, target_persona, context, topics):
    """
    Generate enhanced dialogue with personality-aware responses
    """
    # Get model configurations for both agents
    init_config = get_agent_model_config(init_persona)
    target_config = get_agent_model_config(target_persona)
    
    # Create dialogue prompt with personality traits
    dialogue_prompt = f"""
    Context: {json.dumps(context, indent=2)}
    Topics to potentially discuss: {', '.join(topics)}
    
    {init_persona.scratch.name} (personality: {', '.join(init_config['personality_traits'])}) 
    initiates a conversation with {target_persona.scratch.name} 
    (personality: {', '.join(target_config['personality_traits'])}).
    
    Generate a natural, personality-appropriate conversation with 3-5 exchanges.
    Each person should speak in a way that reflects their personality traits and current activity.
    """
    
    # Generate dialogue using appropriate models
    # This would call the LLM with model-specific parameters
    dialogue = run_gpt_prompt_enhanced_chat(
        maze, 
        init_persona, 
        target_persona,
        dialogue_prompt,
        init_config,
        target_config
    )
    
    return dialogue

def agent_chat_enhanced(maze, init_persona, target_persona):
    """
    Enhanced chat function with multi-model support and rich context
    """
    # Generate enhanced context
    context = generate_enhanced_chat_context(init_persona, target_persona, maze)
    
    # Generate conversation topics
    topics = generate_conversation_topics(init_persona, target_persona, context)
    
    # Retrieve relevant memories for both agents
    focal_points = [f"{target_persona.scratch.name}"] + topics[:2]
    init_retrieved = new_retrieve(init_persona, focal_points, 30)
    target_retrieved = new_retrieve(target_persona, [f"{init_persona.scratch.name}"] + topics[:2], 30)
    
    # Generate relationship summaries
    init_relationship = generate_summarize_agent_relationship(init_persona, target_persona, init_retrieved)
    target_relationship = generate_summarize_agent_relationship(target_persona, init_persona, target_retrieved)
    
    # Add relationship info to context
    context["relationship"]["init_perspective"] = init_relationship
    context["relationship"]["target_perspective"] = target_relationship
    
    # Generate dialogue
    dialogue = generate_enhanced_dialogue(maze, init_persona, target_persona, context, topics)
    
    # Post-process dialogue for naturalness
    processed_dialogue = post_process_dialogue(dialogue, init_persona, target_persona)
    
    # Store conversation in memory for both agents
    store_conversation_memory(init_persona, target_persona, processed_dialogue, context)
    store_conversation_memory(target_persona, init_persona, processed_dialogue, context)
    
    return processed_dialogue

def post_process_dialogue(dialogue, init_persona, target_persona):
    """
    Post-process dialogue for more natural flow
    """
    processed = []
    
    for exchange in dialogue:
        speaker_name = exchange[0]
        utterance = exchange[1]
        
        # Add conversational fillers based on personality
        if speaker_name == init_persona.scratch.name:
            config = get_agent_model_config(init_persona)
            if "expressive" in config["personality_traits"]:
                utterance = add_expressive_elements(utterance)
            elif "precise" in config["personality_traits"]:
                utterance = ensure_precision(utterance)
        
        # Add appropriate emotional markers
        utterance = add_emotional_markers(utterance, estimate_mood(
            init_persona if speaker_name == init_persona.scratch.name else target_persona
        ))
        
        processed.append([speaker_name, utterance])
    
    return processed

def add_expressive_elements(utterance):
    """
    Add expressive elements for creative personalities
    """
    expressive_additions = [
        "Oh, ", "Wow, ", "Actually, ", "You know, "
    ]
    if random.random() < 0.3:
        return random.choice(expressive_additions) + utterance.lower()
    return utterance

def ensure_precision(utterance):
    """
    Ensure precision for analytical personalities
    """
    # Remove vague terms
    vague_terms = ["maybe", "probably", "sort of", "kind of"]
    for term in vague_terms:
        utterance = utterance.replace(term, "")
    return utterance.strip()

def add_emotional_markers(utterance, mood):
    """
    Add subtle emotional markers based on mood
    """
    if mood == "positive" and random.random() < 0.3:
        utterance += " 😊"
    elif mood == "negative" and random.random() < 0.2:
        utterance = utterance.replace(".", "...")
    return utterance

def store_conversation_memory(persona, other_persona, dialogue, context):
    """
    Store conversation in agent's memory with rich metadata
    """
    conversation_summary = f"Had a conversation with {other_persona.scratch.name} about "
    conversation_summary += ", ".join(context.get("topics", ["general topics"])[:2])
    
    # Create memory with enhanced metadata
    memory_metadata = {
        "type": "conversation",
        "participants": [persona.scratch.name, other_persona.scratch.name],
        "location": context["location"]["area"],
        "time": context["time"]["current"],
        "mood": context["mood"],
        "familiarity": context["relationship"]["familiarity"],
        "dialogue_length": len(dialogue)
    }
    
    # Store in associative memory
    persona.a_mem.add_memory(
        conversation_summary,
        metadata=memory_metadata,
        importance=calculate_conversation_importance(context, dialogue)
    )

def calculate_conversation_importance(context, dialogue):
    """
    Calculate importance score for a conversation
    """
    base_importance = 6
    
    # Adjust based on familiarity (new relationships are more important)
    if context["relationship"]["familiarity"] < 20:
        base_importance += 2
    
    # Adjust based on dialogue length
    if len(dialogue) > 5:
        base_importance += 1
    
    # Adjust based on time since last interaction
    last_interaction = context["relationship"].get("last_interaction")
    if last_interaction:
        days_since = (context["time"]["current"] - last_interaction).days
        if days_since > 7:
            base_importance += 1
    
    return min(base_importance, 10)  # Cap at 10

# Additional helper functions for multi-model support
def run_gpt_prompt_enhanced_chat(maze, init_persona, target_persona, 
                                 prompt, init_config, target_config):
    """
    Run enhanced chat prompt with model-specific configurations
    """
    # This would integrate with the Ollama wrapper to use different models
    # For now, return a sample dialogue
    sample_dialogue = [
        [init_persona.scratch.name, "Hey! How's your day going?"],
        [target_persona.scratch.name, "Oh, hi! It's been pretty good, just busy with work."],
        [init_persona.scratch.name, "I know what you mean. What are you working on?"],
        [target_persona.scratch.name, "Just finishing up some reports. How about you?"],
        [init_persona.scratch.name, "Taking a quick break. We should catch up properly soon!"],
        [target_persona.scratch.name, "Definitely! Maybe coffee tomorrow?"]
    ]
    
    return sample_dialogue