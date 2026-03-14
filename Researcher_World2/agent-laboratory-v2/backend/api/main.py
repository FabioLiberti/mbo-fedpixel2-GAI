# Path: backend/api/main.py
#
# FastAPI application with WebSocket for real-time simulation updates.
# LLM dialog is now handled internally by cognitive modules in agents.

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import json
import logging
import uvicorn
import sys
import os
import asyncio
from typing import Dict, List, Any, Optional

# Importa il router AI
from .routes.ai import router as ai_router

# Path setup
current_file = os.path.abspath(__file__)
api_dir = os.path.dirname(current_file)
backend_dir = os.path.dirname(api_dir)
project_dir = os.path.dirname(backend_dir)
sys.path.insert(0, backend_dir)

# Dummy fallback controller
class DummySimulationController:
    def __init__(self):
        self.running = False
        self.fl_system = None
        self.fl_enabled = False
        self.fl_round_in_progress = False
        self.fl_current_phase = "idle"
        self.on_step_callback = None
        self.model = None

    def start_simulation(self): return True
    def stop_simulation(self): return True
    def pause_simulation(self): return True
    def resume_simulation(self): return True
    def reset_simulation(self): return True
    def set_speed(self, speed): return True
    def get_simulation_state(self): return {}
    def enable_federated_learning(self, enabled): return True
    def get_agent(self, agent_id): return None

# Try real controller import
try:
    controller_path = os.path.join(backend_dir, 'simulation', 'controller.py')
    if os.path.exists(controller_path):
        print(f"File controller.py trovato in: {controller_path}")
    from simulation.controller import SimulationController
    print("Importazione di SimulationController riuscita!")
except ImportError as e:
    print(f"ERRORE: Impossibile importare SimulationController: {e}")
    SimulationController = DummySimulationController
    print("Usando DummySimulationController come fallback")

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# FastAPI instance
app = FastAPI(
    title="Agent Laboratory API",
    description="Backend API for Federated Learning simulation with cognitive agents",
    version="0.3.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# AI router
app.include_router(ai_router)


# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"Client connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        logger.info(f"Client disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, message: Dict[str, Any]):
        for conn in self.active_connections:
            try:
                await conn.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting: {e}")


manager = ConnectionManager()

# Controller instance
controller = SimulationController()

# Simulation callback -> WebSocket broadcast
async def simulation_callback(data: Dict[str, Any]):
    try:
        await manager.broadcast({"type": "simulation_update", "data": data})
    except Exception as e:
        logger.error(f"Error in simulation callback: {e}")

controller.on_step_callback = simulation_callback


# --- REST API Routes ---

@app.get("/")
async def root():
    return {"message": "Agent Laboratory API", "status": "running"}


@app.get("/config")
async def get_config():
    state = controller.get_simulation_state()
    return {
        "simulation": {
            "speed": state.get("speed", 1.0),
            "active_labs": ["mercatorum", "blekinge", "opbg"]
        },
        "agents": {
            "count": state.get("agent_count", 0),
            "types": ["phd_student", "researcher", "professor"]
        },
        "fl": {
            "algorithm": "fedavg",
            "rounds": 5
        }
    }


@app.post("/simulation/start")
async def start_simulation():
    if controller.running:
        return {"status": "already_running"}
    success = controller.start_simulation()
    return {"status": "started" if success else "error"}


@app.post("/simulation/stop")
async def stop_simulation():
    if not controller.running:
        return {"status": "not_running"}
    success = controller.stop_simulation()
    return {"status": "stopped" if success else "error"}


@app.post("/simulation/pause")
async def pause_simulation():
    if not controller.running:
        return {"status": "not_running"}
    success = controller.pause_simulation()
    return {"status": "paused" if success else "error"}


@app.post("/simulation/resume")
async def resume_simulation():
    if not controller.running:
        return {"status": "not_running"}
    success = controller.resume_simulation()
    return {"status": "resumed" if success else "error"}


@app.post("/simulation/reset")
async def reset_simulation():
    success = controller.reset_simulation()
    return {"status": "reset" if success else "error"}


@app.post("/simulation/speed")
async def set_simulation_speed(speed: float):
    if speed <= 0:
        raise HTTPException(status_code=400, detail="Speed must be > 0")
    controller.set_speed(speed)
    return {"status": "speed_set", "speed": speed}


@app.get("/simulation/state")
async def get_simulation_state():
    return controller.get_simulation_state()


# --- FL Routes ---

@app.post("/fl/enable")
async def enable_fl(enabled: bool = True):
    if not controller.running:
        raise HTTPException(status_code=400, detail="Simulation not running")
    controller.enable_federated_learning(enabled)
    return {"status": "fl_enabled" if enabled else "fl_disabled"}


@app.get("/fl/state")
async def get_fl_state():
    if not controller.fl_system:
        raise HTTPException(status_code=400, detail="FL system not initialized")
    fl_state = controller.fl_system.get_state()
    fl_state.update({
        "enabled": controller.fl_enabled,
        "round_in_progress": controller.fl_round_in_progress,
        "current_phase": controller.fl_current_phase
    })
    return fl_state


# --- LLM Toggle Routes ---

@app.post("/llm/toggle")
async def toggle_llm(enabled: bool = True):
    """Enable/disable real LLM calls (Ollama). When disabled, stubs are used."""
    from cognitive.prompts.run_gpt_prompt import set_llm_enabled, is_llm_enabled
    set_llm_enabled(enabled)
    return {"llm_enabled": is_llm_enabled()}


@app.get("/llm/status")
async def get_llm_status():
    """Check if LLM calls are enabled and if Ollama is reachable."""
    from cognitive.prompts.run_gpt_prompt import is_llm_enabled
    llm_on = is_llm_enabled()
    ollama_ok = False
    if llm_on:
        try:
            import httpx
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get("http://localhost:11434/api/tags")
                ollama_ok = resp.status_code == 200
        except Exception:
            pass
    return {"llm_enabled": llm_on, "ollama_reachable": ollama_ok}


# --- Agent Inspection Route ---

@app.get("/agent/{agent_id}")
async def get_agent_details(agent_id: int):
    """Get detailed cognitive + FL state for a specific agent."""
    agent = controller.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found")
    return agent.get_state_data()


# --- WebSocket Endpoint ---

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            message_type = message.get("type", "")

            if message_type == "simulation_command":
                command = message.get("command", "")
                params = message.get("params", {})

                if command == "start":
                    controller.start_simulation()
                elif command == "stop":
                    controller.stop_simulation()
                elif command == "pause":
                    controller.pause_simulation()
                elif command == "resume":
                    controller.resume_simulation()
                elif command == "reset":
                    controller.reset_simulation()
                elif command == "set_speed":
                    controller.set_speed(params.get("speed", 1.0))
                elif command == "enable_fl":
                    controller.enable_federated_learning(params.get("enabled", True))
                elif command == "toggle_llm":
                    from cognitive.prompts.run_gpt_prompt import set_llm_enabled, is_llm_enabled
                    set_llm_enabled(params.get("enabled", True))
                    await websocket.send_json({
                        "type": "llm_status",
                        "data": {"llm_enabled": is_llm_enabled()}
                    })
                elif command == "get_agent":
                    agent_id = params.get("agent_id")
                    agent = controller.get_agent(agent_id) if agent_id is not None else None
                    await websocket.send_json({
                        "type": "agent_details",
                        "data": agent.get_state_data() if agent else None
                    })

                # Send updated state
                await websocket.send_json({
                    "type": "simulation_state",
                    "data": controller.get_simulation_state()
                })
            else:
                await websocket.send_json({"type": "echo", "data": message})

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"Error in WebSocket: {e}")
        manager.disconnect(websocket)


if __name__ == "__main__":
    uvicorn.run("api.main:app", host="0.0.0.0", port=8091, reload=True)
