"""
Multi-model wrapper for Ollama to support different LLMs for different agents
"""
import json
import time
from typing import Dict, List, Tuple, Optional
import subprocess
import sys

# Model registry with characteristics
MODEL_REGISTRY = {
    "qwen3.5:4b": {
        "size": "small",
        "speed": "fast",
        "creativity": "high",
        "accuracy": "high",
        "context_length": 256000,
        "multimodal": True
    },
    "llama3:7b": {
        "size": "medium",
        "speed": "medium",
        "creativity": "high",
        "accuracy": "high",
        "context_length": 4096
    },
    "mistral:7b": {
        "size": "medium", 
        "speed": "medium",
        "creativity": "medium",
        "accuracy": "very_high",
        "context_length": 8192
    },
    "gemma:7b": {
        "size": "medium",
        "speed": "medium", 
        "creativity": "high",
        "accuracy": "high",
        "context_length": 8192
    },
    "phi3:mini": {
        "size": "tiny",
        "speed": "very_fast",
        "creativity": "low",
        "accuracy": "medium",
        "context_length": 4096
    }
}

class MultiModelOllama:
    def __init__(self):
        self.model_cache = {}
        self.conversation_history = {}
        self.model_performance = {}
        
    def ensure_model_loaded(self, model_name: str) -> bool:
        """
        Ensure a specific model is loaded in Ollama
        """
        if model_name in self.model_cache:
            return True
            
        try:
            # Check if model exists
            result = subprocess.run(
                ["ollama", "list"],
                capture_output=True,
                text=True
            )
            
            if model_name in result.stdout:
                self.model_cache[model_name] = True
                return True
            else:
                print(f"Model {model_name} not found. Pulling...")
                subprocess.run(["ollama", "pull", model_name], check=True)
                self.model_cache[model_name] = True
                return True
                
        except Exception as e:
            print(f"Error loading model {model_name}: {e}")
            return False
    
    def generate_with_model(self, 
                          model_name: str,
                          prompt: str,
                          temperature: float = 0.7,
                          max_tokens: int = 150,
                          agent_name: Optional[str] = None) -> str:
        """
        Generate response using a specific model
        """
        if not self.ensure_model_loaded(model_name):
            # Fallback to default model
            model_name = "qwen3.5:4b"
            self.ensure_model_loaded(model_name)
        
        # Track performance
        start_time = time.time()
        
        try:
            # Prepare the command
            cmd = [
                "ollama", "run", model_name,
                "--temperature", str(temperature),
            ]
            
            # Add conversation context if available
            if agent_name and agent_name in self.conversation_history:
                recent_context = self.get_recent_context(agent_name)
                full_prompt = f"{recent_context}\n\n{prompt}"
            else:
                full_prompt = prompt
            
            # Run the model
            result = subprocess.run(
                cmd,
                input=full_prompt,
                capture_output=True,
                text=True,
                timeout=30  # 30 second timeout
            )
            
            response = result.stdout.strip()
            
            # Track performance metrics
            elapsed_time = time.time() - start_time
            self.track_performance(model_name, elapsed_time, len(response))
            
            # Store in conversation history
            if agent_name:
                self.update_conversation_history(agent_name, prompt, response)
            
            return response
            
        except subprocess.TimeoutExpired:
            print(f"Model {model_name} timed out, switching to faster model")
            # Fallback to faster model
            if model_name != "phi3:mini":
                return self.generate_with_model("phi3:mini", prompt, temperature, max_tokens, agent_name)
            else:
                return "I need a moment to think about that..."
                
        except Exception as e:
            print(f"Error generating with {model_name}: {e}")
            return "I'm having trouble formulating a response right now."
    
    def generate_conversation(self,
                            agent1_name: str,
                            agent1_model: str,
                            agent2_name: str, 
                            agent2_model: str,
                            context: Dict,
                            num_exchanges: int = 3) -> List[Tuple[str, str]]:
        """
        Generate a conversation between two agents using different models
        """
        conversation = []
        
        # Initial prompt for agent1
        init_prompt = self.create_conversation_starter(agent1_name, agent2_name, context)
        
        # Generate first utterance
        utterance1 = self.generate_with_model(
            agent1_model,
            init_prompt,
            temperature=0.8,
            agent_name=agent1_name
        )
        conversation.append((agent1_name, utterance1))
        
        # Continue conversation
        for i in range(num_exchanges - 1):
            # Agent2 responds
            response_prompt = self.create_response_prompt(
                agent2_name, 
                agent1_name,
                utterance1,
                context
            )
            
            utterance2 = self.generate_with_model(
                agent2_model,
                response_prompt,
                temperature=0.8,
                agent_name=agent2_name
            )
            conversation.append((agent2_name, utterance2))
            
            # Agent1 responds back if not last exchange
            if i < num_exchanges - 2:
                response_prompt = self.create_response_prompt(
                    agent1_name,
                    agent2_name, 
                    utterance2,
                    context
                )
                
                utterance1 = self.generate_with_model(
                    agent1_model,
                    response_prompt,
                    temperature=0.8,
                    agent_name=agent1_name
                )
                conversation.append((agent1_name, utterance1))
        
        return conversation
    
    def create_conversation_starter(self, speaker: str, listener: str, context: Dict) -> str:
        """
        Create initial conversation prompt
        """
        prompt = f"""
        You are {speaker}. You are currently {context['current_activity']['initiator']}.
        You see {listener} who is {context['current_activity']['target']}.
        Location: {context['location']['area']}
        Time: {context['time']['day_phase']}
        Your relationship: {context['relationship']['familiarity']} familiarity level
        
        Start a natural conversation with {listener}. Be friendly and contextual.
        Respond in 1-2 sentences only.
        """
        return prompt
    
    def create_response_prompt(self, speaker: str, other: str, previous_utterance: str, context: Dict) -> str:
        """
        Create response prompt for ongoing conversation
        """
        prompt = f"""
        You are {speaker}. You are currently {context['current_activity']['target'] if speaker != context.get('initiator') else context['current_activity']['initiator']}.
        {other} just said: "{previous_utterance}"
        Location: {context['location']['area']}
        
        Respond naturally and appropriately. Keep it brief (1-2 sentences).
        """
        return prompt
    
    def get_recent_context(self, agent_name: str, num_exchanges: int = 5) -> str:
        """
        Get recent conversation context for an agent
        """
        if agent_name not in self.conversation_history:
            return ""
            
        history = self.conversation_history[agent_name]
        recent = history[-num_exchanges:] if len(history) > num_exchanges else history
        
        context = "Recent conversation history:\n"
        for h in recent:
            context += f"{h['speaker']}: {h['utterance']}\n"
            
        return context
    
    def update_conversation_history(self, agent_name: str, prompt: str, response: str):
        """
        Update conversation history for an agent
        """
        if agent_name not in self.conversation_history:
            self.conversation_history[agent_name] = []
            
        self.conversation_history[agent_name].append({
            "timestamp": time.time(),
            "speaker": agent_name,
            "prompt": prompt,
            "utterance": response
        })
        
        # Keep only last 20 exchanges
        if len(self.conversation_history[agent_name]) > 20:
            self.conversation_history[agent_name] = self.conversation_history[agent_name][-20:]
    
    def track_performance(self, model_name: str, elapsed_time: float, response_length: int):
        """
        Track model performance metrics
        """
        if model_name not in self.model_performance:
            self.model_performance[model_name] = {
                "total_calls": 0,
                "total_time": 0,
                "avg_response_length": 0
            }
        
        stats = self.model_performance[model_name]
        stats["total_calls"] += 1
        stats["total_time"] += elapsed_time
        stats["avg_response_length"] = (
            (stats["avg_response_length"] * (stats["total_calls"] - 1) + response_length) 
            / stats["total_calls"]
        )
    
    def get_performance_report(self) -> Dict:
        """
        Get performance report for all models
        """
        report = {}
        for model, stats in self.model_performance.items():
            if stats["total_calls"] > 0:
                report[model] = {
                    "avg_response_time": stats["total_time"] / stats["total_calls"],
                    "total_calls": stats["total_calls"],
                    "avg_response_length": stats["avg_response_length"]
                }
        return report
    
    def recommend_model_for_agent(self, agent_personality: List[str], 
                                 performance_priority: str = "balanced") -> str:
        """
        Recommend a model based on agent personality and performance needs
        """
        if "creative" in agent_personality or "artistic" in agent_personality:
            if performance_priority == "speed":
                return "phi3:mini"
            else:
                return "llama3:7b"
                
        elif "analytical" in agent_personality or "logical" in agent_personality:
            return "mistral:7b"
            
        elif "social" in agent_personality or "empathetic" in agent_personality:
            return "gemma:7b"
            
        else:
            # Default based on performance priority
            if performance_priority == "speed":
                return "qwen3.5:4b"
            elif performance_priority == "quality":
                return "llama3:7b"
            else:
                return "qwen3.5:4b"
    
    def batch_generate(self, requests: List[Dict]) -> List[str]:
        """
        Process multiple generation requests efficiently
        """
        results = []
        
        # Group by model for efficiency
        model_groups = {}
        for req in requests:
            model = req.get("model", "qwen3.5:4b")
            if model not in model_groups:
                model_groups[model] = []
            model_groups[model].append(req)
        
        # Process each model group
        for model, group_requests in model_groups.items():
            self.ensure_model_loaded(model)
            
            for req in group_requests:
                response = self.generate_with_model(
                    model,
                    req["prompt"],
                    req.get("temperature", 0.7),
                    req.get("max_tokens", 150),
                    req.get("agent_name")
                )
                results.append(response)
        
        return results

# Global instance
multi_model_ollama = MultiModelOllama()

def get_multi_model_instance():
    """Get the global multi-model instance"""
    return multi_model_ollama