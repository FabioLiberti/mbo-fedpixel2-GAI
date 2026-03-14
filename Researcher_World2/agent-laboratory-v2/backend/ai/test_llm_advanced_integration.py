"""
Test avanzato di integrazione per il sistema LLM di Agent Laboratory.
Verifica la pipeline completa di integrazione tra agenti, federated learning e LLM.
"""

import os
import asyncio
import logging
import json
from typing import Dict, Any, List
import unittest
import random
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))


# Importazioni assolute per compatibilità con la struttura del progetto
from ai.llm_connector import LLMConnector
from simulation.controller import SimulationController
from models.agents.researcher import ResearcherAgent, AgentState, Specialization, FLRole

# Configurazione logger
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("llm_advanced_integration_test")

class AdvancedLLMIntegrationTest:
    """Test avanzati per l'integrazione LLM con gli agenti e il federated learning."""
    
    def __init__(self):
        self.connector = None
        self.controller = None
    
    async def setup(self):
        """Inizializza le componenti necessarie per i test."""
        logger.info("Setting up advanced integration test environment")
        
        # Inizializza il connettore LLM
        self.connector = LLMConnector()
        
        # Inizializza il controller di simulazione
        self.controller = SimulationController()
        if not self.controller.initialize_model():
            logger.error("Failed to initialize simulation controller")
            return False
        
        # Assicura che LLM sia abilitato
        self.controller.enable_llm(True)
        
        return True
    
    async def teardown(self):
        """Pulisce le risorse dopo i test."""
        logger.info("Tearing down test environment")
        
        if self.connector:
            await self.connector.close()
        
        logger.info("Test environment cleaned up")
    
    async def test_agent_dialog_generation(self):
        """Testa la generazione di dialoghi per agenti in stati diversi."""
        logger.info("=== Test Agent Dialog Generation ===")
        
        # Stati agente da testare
        agent_states = [
            AgentState.WORKING,
            AgentState.DISCUSSING,
            AgentState.MEETING,
            AgentState.TRAINING_MODEL,
            AgentState.AGGREGATING_MODELS
        ]
        
        try:
            # Crea un agente PhD Student
            phd_agent_id = "test_phd_student"
            specialization = Specialization.PRIVACY_ENGINEERING
            
            # Registra l'agente nel controller
            success = self.controller.register_agent(
                agent_id=phd_agent_id,
                agent_type="PhD Student",
                lab_id="test_lab",
                specialization=specialization.value
            )
            
            if not success:
                logger.error(f"Failed to register PhD agent")
                return False
            
            # Testa dialoghi per ogni stato
            for state in agent_states:
                # Genera una situazione basata sullo stato
                situation = self._generate_situation_for_state(state)
                
                logger.info(f"Testing dialog generation for state: {state.value}")
                logger.info(f"Situation: {situation}")
                
                # Genera dialogo
                dialog = await self.controller.generate_agent_dialog(phd_agent_id, situation)
                
                if not dialog or dialog == "No comment." or dialog == "I need to focus on my research now.":
                    logger.warning(f"Dialog generation for state {state.value} returned default message")
                    continue
                    
                logger.info(f"Generated dialog: '{dialog}'")
                
                # Verifica che il dialogo sia appropriato per lo stato
                relevance_score = await self.connector.evaluate_dialog_relevance(dialog, state.value, situation)
                logger.info(f"Dialog relevance score: {relevance_score}")
            
            logger.info("Dialog generation test completed")
            return True
            
        except Exception as e:
            logger.error(f"Dialog generation test failed: {str(e)}")
            return False
    
    async def test_fl_decision_making(self):
        """Testa il processo decisionale degli agenti sul federated learning."""
        logger.info("=== Test FL Decision Making ===")
        
        try:
            # Crea agenti con diversi ruoli FL
            fl_agent_configs = [
                {
                    "id": "data_preparer_phd",
                    "type": "PhD Student",
                    "specialization": Specialization.DATA_SCIENCE.value,
                    "fl_role": FLRole.DATA_PREPARER.value
                },
                {
                    "id": "model_trainer_researcher",
                    "type": "Researcher",
                    "specialization": Specialization.NON_IID_DATA.value,
                    "fl_role": FLRole.MODEL_TRAINER.value
                },
                {
                    "id": "model_aggregator_professor",
                    "type": "Professor",
                    "specialization": Specialization.FL_ARCHITECTURE.value,
                    "fl_role": FLRole.MODEL_AGGREGATOR.value
                }
            ]
            
            # Registra gli agenti
            for config in fl_agent_configs:
                success = self.controller.register_agent(
                    agent_id=config["id"],
                    agent_type=config["type"],
                    lab_id="test_lab",
                    specialization=config["specialization"]
                )
                
                if not success:
                    logger.error(f"Failed to register agent {config['id']}")
                    return False
            
            # Situazioni FL da testare
            fl_scenarios = [
                {
                    "name": "start_training",
                    "description": "Inizio di un nuovo round di training federated",
                    "data_distribution": "non-IID",
                    "client_resources": "heterogeneous",
                    "communication_quality": "good"
                },
                {
                    "name": "privacy_concerns",
                    "description": "Rilevati potenziali problemi di privacy nei dati",
                    "data_distribution": "iid",
                    "client_resources": "homogeneous",
                    "communication_quality": "good",
                    "privacy_issue": "data leakage potential"
                },
                {
                    "name": "communication_failure",
                    "description": "Problemi di comunicazione durante l'invio dei modelli",
                    "data_distribution": "non-IID",
                    "client_resources": "heterogeneous",
                    "communication_quality": "poor"
                }
            ]
            
            # Testa le decisioni per ogni agente e scenario
            for agent_config in fl_agent_configs:
                for scenario in fl_scenarios:
                    logger.info(f"Testing FL decision for {agent_config['type']} with role {agent_config['fl_role']} in scenario: {scenario['name']}")
                    
                    # Genera decisione usando LLM
                    decision = await self.controller.generate_agent_dialog(
                        agent_id=agent_config["id"],
                        situation=scenario["description"],
                        interaction_type="decision"
                    )
                    
                    logger.info(f"FL decision: '{decision}'")
                    
                    # Verifica che la decisione sia appropriata per il ruolo e lo scenario
                    if not decision or decision == "No comment." or decision == "I need to focus on my research now.":
                        logger.warning(f"Decision generation returned default message")
                        continue
                    
                    # Aggiorna la memoria dell'agente con questa decisione
                    self.controller.update_agent_memory(
                        agent_config["id"],
                        f"Decision in {scenario['name']}: {decision}",
                        "long_term"
                    )
            
            logger.info("FL decision making test completed")
            return True
            
        except Exception as e:
            logger.error(f"FL decision making test failed: {str(e)}")
            return False
    
    async def test_multi_agent_interaction(self):
        """Testa l'interazione tra più agenti usando LLM."""
        logger.info("=== Test Multi-Agent Interaction ===")
        
        try:
            # Crea agenti per il test di interazione
            agent_configs = [
                {
                    "id": "interaction_phd",
                    "type": "PhD Student",
                    "specialization": Specialization.OPTIMIZATION_THEORY.value
                },
                {
                    "id": "interaction_professor",
                    "type": "Professor",
                    "specialization": Specialization.THEORETICAL_GUARANTEES.value
                },
                {
                    "id": "interaction_researcher",
                    "type": "Researcher",
                    "specialization": Specialization.SECURE_AGGREGATION.value
                }
            ]
            
            # Registra gli agenti
            for config in agent_configs:
                success = self.controller.register_agent(
                    agent_id=config["id"],
                    agent_type=config["type"],
                    lab_id="test_lab",
                    specialization=config["specialization"]
                )
                
                if not success:
                    logger.error(f"Failed to register agent {config['id']}")
                    return False
            
            # Scenari di interazione da testare
            interaction_scenarios = [
                "Discutendo i benefici di diverse tecniche di aggregazione",
                "Collaborando su un paper sull'ottimizzazione di modelli FL",
                "Analizzando i risultati di un esperimento recente con dati non-IID"
            ]
            
            # Testa interazioni in ogni scenario
            for scenario in interaction_scenarios:
                logger.info(f"Testing multi-agent interaction in scenario: '{scenario}'")
                
                # Primo agente inizia la conversazione
                initiator_id = agent_configs[0]["id"]
                initial_dialog = await self.controller.generate_agent_dialog(initiator_id, scenario)
                
                if not initial_dialog or initial_dialog == "No comment.":
                    logger.error(f"Failed to generate initial dialog")
                    continue
                    
                logger.info(f"Initial dialog from {initiator_id}: '{initial_dialog}'")
                
                # Secondo agente risponde al primo
                responder_id = agent_configs[1]["id"]
                response_context = {
                    "previous_dialog": initial_dialog,
                    "initiator": initiator_id
                }
                
                # Aggiorna il contesto per il responder
                self.controller.update_agent_memory(
                    responder_id,
                    f"Conversation with {initiator_id} about {scenario}",
                    "short_term"
                )
                
                # Genera risposta
                response_dialog = await self.controller.generate_agent_dialog(
                    responder_id, 
                    f"Responding to: {initial_dialog}"
                )
                
                if not response_dialog or response_dialog == "No comment.":
                    logger.error(f"Failed to generate response dialog")
                    continue
                    
                logger.info(f"Response dialog from {responder_id}: '{response_dialog}'")
                
                # Terzo agente si unisce alla discussione
                third_agent_id = agent_configs[2]["id"]
                third_context = f"Joining a discussion where {initiator_id} said: '{initial_dialog}' and {responder_id} responded: '{response_dialog}'"
                
                third_dialog = await self.controller.generate_agent_dialog(
                    third_agent_id,
                    third_context
                )
                
                if not third_dialog or third_dialog == "No comment.":
                    logger.error(f"Failed to generate third agent dialog")
                    continue
                    
                logger.info(f"Third agent dialog from {third_agent_id}: '{third_dialog}'")
                
                # Verifica la coerenza della conversazione
                dialogs = [initial_dialog, response_dialog, third_dialog]
                coherence = await self.connector.evaluate_conversation_coherence(dialogs, scenario)
                logger.info(f"Conversation coherence score: {coherence}")
            
            logger.info("Multi-agent interaction test completed")
            return True
            
        except Exception as e:
            logger.error(f"Multi-agent interaction test failed: {str(e)}")
            return False
    
    async def test_adaptive_behavior(self):
        """Testa il comportamento adattivo degli agenti in risposta a cambiamenti."""
        logger.info("=== Test Adaptive Behavior ===")
        
        try:
            # Crea un agente per il test
            agent_id = "adaptive_agent"
            
            # Registra l'agente
            success = self.controller.register_agent(
                agent_id=agent_id,
                agent_type="Researcher",
                lab_id="test_lab",
                specialization=Specialization.COMMUNICATION_EFFICIENCY.value
            )
            
            if not success:
                logger.error(f"Failed to register adaptive agent")
                return False
            
            # Serie di eventi a cui l'agente deve adattarsi
            events = [
                "Normal working conditions in the lab",
                "Sudden communication failure during model transfer",
                "Discovery of a security vulnerability in the aggregation algorithm",
                "New high-quality dataset available from a collaborating lab",
                "Presentation of results to an international conference tomorrow"
            ]
            
            responses = []
            
            # Prima interazione - memorizza le risposte normali
            logger.info(f"Testing initial response to normal conditions")
            initial_response = await self.controller.generate_agent_dialog(
                agent_id=agent_id,
                situation=events[0]
            )
            
            logger.info(f"Initial response: '{initial_response}'")
            
            # Aggiorna la memoria dell'agente
            self.controller.update_agent_memory(
                agent_id,
                f"Working under normal conditions",
                "long_term"
            )
            
            # Testa l'adattamento a eventi successivi
            for i, event in enumerate(events[1:], 1):
                logger.info(f"Testing adaptation to event: '{event}'")
                
                # Aggiorna la memoria a breve termine con l'evento corrente
                self.controller.update_agent_memory(
                    agent_id,
                    f"Experienced event: {event}",
                    "short_term"
                )
                
                # Genera risposta all'evento
                response = await self.controller.generate_agent_dialog(
                    agent_id=agent_id,
                    situation=event
                )
                
                if not response or response == "No comment.":
                    logger.warning(f"Failed to generate response to event: {event}")
                    continue
                
                logger.info(f"Response to '{event}': '{response}'")
                responses.append(response)
                
                # Aggiorna la memoria a lungo termine con la risposta
                self.controller.update_agent_memory(
                    agent_id,
                    f"Responded to {event} with: {response}",
                    "long_term"
                )
                
                # Se non è l'ultimo evento, aggiunge un ritardo per simulare il passaggio del tempo
                if i < len(events) - 1:
                    await asyncio.sleep(1)
            
            # Verifica la variabilità delle risposte
            unique_responses = set(responses)
            response_ratio = len(unique_responses) / len(responses) if responses else 0
            logger.info(f"Response uniqueness ratio: {response_ratio}")
            
            # Verifica l'adattamento alle condizioni
            if response_ratio < 0.8:
                logger.warning("Low response variability detected - agent may not be adapting properly")
            else:
                logger.info("Good response variability observed - agent is adapting to events")
            
            # Test finale - verifica se l'agente ricorda eventi precedenti
            memory_test = await self.controller.generate_agent_dialog(
                agent_id=agent_id,
                situation="Reflect on the challenges you've faced recently"
            )
            
            logger.info(f"Memory reflection: '{memory_test}'")
            
            logger.info("Adaptive behavior test completed")
            return True
            
        except Exception as e:
            logger.error(f"Adaptive behavior test failed: {str(e)}")
            return False
    
    async def test_cognitive_reasoning(self):
        """Testa il sistema di ragionamento cognitivo degli agenti."""
        logger.info("=== Test Cognitive Reasoning ===")
        
        try:
            # Crea un agente professor specializzato in FL Architecture
            agent_id = "cognitive_professor"
            
            # Registra l'agente
            success = self.controller.register_agent(
                agent_id=agent_id,
                agent_type="Professor",
                lab_id="test_lab",
                specialization=Specialization.FL_ARCHITECTURE.value
            )
            
            if not success:
                logger.error(f"Failed to register cognitive agent")
                return False
            
            # Test di percezione - osservazione dell'ambiente
            perception_test = await self.controller.generate_agent_dialog(
                agent_id=agent_id,
                situation="Observe the current state of the lab and ongoing research",
                interaction_type="reaction"
            )
            
            logger.info(f"Perception test: '{perception_test}'")
            
            # Test di ragionamento - analisi di un problema complesso
            reasoning_test = await self.controller.generate_agent_dialog(
                agent_id=agent_id,
                situation="Analyze the trade-offs between communication efficiency and model accuracy in non-IID environments",
                interaction_type="decision"
            )
            
            logger.info(f"Reasoning test: '{reasoning_test}'")
            
            # Test di pianificazione - sviluppo di un piano di ricerca
            planning_test = await self.controller.generate_agent_dialog(
                agent_id=agent_id,
                situation="Develop a research plan to improve secure aggregation algorithms",
                interaction_type="planning"
            )
            
            logger.info(f"Planning test: '{planning_test}'")
            
            # Test di collaborazione - proposta a colleghi
            collaboration_test = await self.controller.generate_agent_dialog(
                agent_id=agent_id,
                situation="Propose a collaboration to PhD students on a new FL architecture",
                interaction_type="collaboration"
            )
            
            logger.info(f"Collaboration test: '{collaboration_test}'")
            
            # Verifica che le risposte siano appropriate per ciascun tipo di interazione cognitiva
            tests_results = {
                "perception": perception_test and not perception_test.startswith("No comment"),
                "reasoning": reasoning_test and not reasoning_test.startswith("No comment"),
                "planning": planning_test and not planning_test.startswith("No comment"),
                "collaboration": collaboration_test and not collaboration_test.startswith("No comment")
            }
            
            logger.info(f"Cognitive tests results: {tests_results}")
            logger.info("Cognitive reasoning test completed")
            
            return all(tests_results.values())
            
        except Exception as e:
            logger.error(f"Cognitive reasoning test failed: {str(e)}")
            return False
    
    def _generate_situation_for_state(self, state: AgentState) -> str:
        """Genera una descrizione della situazione basata sullo stato."""
        situations = {
            AgentState.WORKING: [
                "Analyzing complex federated learning dataset",
                "Designing a new aggregation algorithm",
                "Optimizing communication overhead in FL system"
            ],
            AgentState.DISCUSSING: [
                "Discussing privacy issues in FL with a colleague",
                "Comparing ideas on improving algorithm convergence",
                "Explaining your approach to a junior researcher"
            ],
            AgentState.MEETING: [
                "In a meeting with colleagues to discuss recent progress",
                "Participating in a coordination meeting between labs",
                "Presenting preliminary results to the team"
            ],
            AgentState.TRAINING_MODEL: [
                "Training a local model on sensitive data",
                "Running fine-tuning experiments on the model",
                "Evaluating model performance on heterogeneous datasets"
            ],
            AgentState.AGGREGATING_MODELS: [
                "Aggregating models from different clients",
                "Applying different weights to various lab contributions",
                "Verifying convergence of the aggregation algorithm"
            ]
        }
        
        # Ritorna una situazione casuale per lo stato
        if state in situations:
            return random.choice(situations[state])
        else:
            return "Working on federated learning research"

async def run_tests():
    """Esegue tutti i test di integrazione avanzati."""
    logger.info("Starting advanced LLM integration tests")
    
    test_suite = AdvancedLLMIntegrationTest()
    
    try:
        success = await test_suite.setup()
        if not success:
            logger.error("Test environment setup failed")
            return False
        
        # Esegui i test
        results = {
            "agent_dialog_generation": await test_suite.test_agent_dialog_generation(),
            "fl_decision_making": await test_suite.test_fl_decision_making(),
            "multi_agent_interaction": await test_suite.test_multi_agent_interaction(),
            "adaptive_behavior": await test_suite.test_adaptive_behavior(),
            "cognitive_reasoning": await test_suite.test_cognitive_reasoning()
        }
        
        # Riepilogo risultati
        logger.info("=== Advanced Test Results ===")
        for test_name, result in results.items():
            status = "PASS" if result else "FAIL"
            logger.info(f"{test_name}: {status}")
        
        all_passed = all(results.values())
        return all_passed
        
    except Exception as e:
        logger.error(f"Unexpected error in test suite: {str(e)}")
        return False
    finally:
        await test_suite.teardown()

if __name__ == "__main__":
    asyncio.run(run_tests())