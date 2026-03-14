"""
Author: Joon Sung Park (joonspk@stanford.edu)
File: views.py
"""
import os
import string
import random
import json
from os import listdir
import os

import datetime
from django.shortcuts import render, redirect, HttpResponseRedirect
from django.http import HttpResponse, JsonResponse
from global_methods import *

from django.contrib.staticfiles.templatetags.staticfiles import static
from .models import *

def landing(request): 
  context = {}
  template = "landing/landing.html"
  return render(request, template, context)


def demo(request, sim_code, step, play_speed="2"): 
  move_file = f"compressed_storage/{sim_code}/master_movement.json"
  meta_file = f"compressed_storage/{sim_code}/meta.json"
  step = int(step)
  play_speed_opt = {"1": 1, "2": 2, "3": 4,
                    "4": 8, "5": 16, "6": 32}
  if play_speed not in play_speed_opt: play_speed = 2
  else: play_speed = play_speed_opt[play_speed]

  # Loading the basic meta information about the simulation.
  meta = dict() 
  with open (meta_file) as json_file: 
    meta = json.load(json_file)

  sec_per_step = meta["sec_per_step"]
  start_datetime = datetime.datetime.strptime(meta["start_date"] + " 00:00:00", 
                                              '%B %d, %Y %H:%M:%S')
  for i in range(step): 
    start_datetime += datetime.timedelta(seconds=sec_per_step)
  start_datetime = start_datetime.strftime("%Y-%m-%dT%H:%M:%S")

  # Loading the movement file
  raw_all_movement = dict()
  with open(move_file) as json_file: 
    raw_all_movement = json.load(json_file)
 
  # Loading all names of the personas
  persona_names = dict()
  persona_names = []
  persona_names_set = set()
  for p in list(raw_all_movement["0"].keys()): 
    persona_names += [{"original": p, 
                       "underscore": p.replace(" ", "_"), 
                       "initial": p[0] + p.split(" ")[-1][0]}]
    persona_names_set.add(p)

  # <all_movement> is the main movement variable that we are passing to the 
  # frontend. Whereas we use ajax scheme to communicate steps to the frontend
  # during the simulation stage, for this demo, we send all movement 
  # information in one step. 
  all_movement = dict()

  # Preparing the initial step. 
  # <init_prep> sets the locations and descriptions of all agents at the
  # beginning of the demo determined by <step>. 
  init_prep = dict() 
  for int_key in range(step+1): 
    key = str(int_key)
    val = raw_all_movement[key]
    for p in persona_names_set: 
      if p in val: 
        init_prep[p] = val[p]
  persona_init_pos = dict()
  for p in persona_names_set: 
    persona_init_pos[p.replace(" ","_")] = init_prep[p]["movement"]
  all_movement[step] = init_prep

  # Finish loading <all_movement>
  for int_key in range(step+1, len(raw_all_movement.keys())): 
    all_movement[int_key] = raw_all_movement[str(int_key)]

  context = {"sim_code": sim_code,
             "step": step,
             "persona_names": persona_names,
             "persona_init_pos": json.dumps(persona_init_pos), 
             "all_movement": json.dumps(all_movement), 
             "start_datetime": start_datetime,
             "sec_per_step": sec_per_step,
             "play_speed": play_speed,
             "mode": "demo"}
  template = "demo/demo.html"

  return render(request, template, context)


def UIST_Demo(request): 
  return demo(request, "March20_the_ville_n25_UIST_RUN-step-1-141", 2160, play_speed="3")


def home(request):
  f_curr_sim_code = "temp_storage/curr_sim_code.json"
  f_curr_step = "temp_storage/curr_step.json"

  if not check_if_file_exists(f_curr_step): 
    context = {}
    template = "home/error_start_backend.html"
    return render(request, template, context)

  with open(f_curr_sim_code) as json_file:  
    sim_code = json.load(json_file)["sim_code"]
  
  with open(f_curr_step) as json_file:  
    step = json.load(json_file)["step"]

  os.remove(f_curr_step)

  persona_names = []
  persona_names_set = set()
  for i in find_filenames(f"storage/{sim_code}/personas", ""): 
    x = i.split("/")[-1].strip()
    if x[0] != ".": 
      persona_names += [[x, x.replace(" ", "_")]]
      persona_names_set.add(x)

  persona_init_pos = []
  file_count = []
  for i in find_filenames(f"storage/{sim_code}/environment", ".json"):
    x = i.split("/")[-1].strip()
    if x[0] != ".": 
      file_count += [int(x.split(".")[0])]
  curr_json = f'storage/{sim_code}/environment/{str(max(file_count))}.json'
  with open(curr_json) as json_file:  
    persona_init_pos_dict = json.load(json_file)
    for key, val in persona_init_pos_dict.items(): 
      if key in persona_names_set: 
        persona_init_pos += [[key, val["x"], val["y"]]]

  context = {"sim_code": sim_code,
             "step": step, 
             "persona_names": persona_names,
             "persona_init_pos": persona_init_pos,
             "mode": "simulate"}
  template = "home/home.html"
  return render(request, template, context)


def replay(request, sim_code, step): 
  sim_code = sim_code
  step = int(step)

  persona_names = []
  persona_names_set = set()
  for i in find_filenames(f"storage/{sim_code}/personas", ""): 
    x = i.split("/")[-1].strip()
    if x[0] != ".": 
      persona_names += [[x, x.replace(" ", "_")]]
      persona_names_set.add(x)

  persona_init_pos = []
  file_count = []
  for i in find_filenames(f"storage/{sim_code}/environment", ".json"):
    x = i.split("/")[-1].strip()
    if x[0] != ".": 
      file_count += [int(x.split(".")[0])]
  curr_json = f'storage/{sim_code}/environment/{str(max(file_count))}.json'
  with open(curr_json) as json_file:  
    persona_init_pos_dict = json.load(json_file)
    for key, val in persona_init_pos_dict.items(): 
      if key in persona_names_set: 
        persona_init_pos += [[key, val["x"], val["y"]]]

  context = {"sim_code": sim_code,
             "step": step,
             "persona_names": persona_names,
             "persona_init_pos": persona_init_pos, 
             "mode": "replay"}
  template = "home/home.html"
  return render(request, template, context)


def replay_persona_state(request, sim_code, step, persona_name): 
  sim_code = sim_code
  step = int(step)

  persona_name_underscore = persona_name
  persona_name = " ".join(persona_name.split("_"))
  memory = f"storage/{sim_code}/personas/{persona_name}/bootstrap_memory"
  if not os.path.exists(memory): 
    memory = f"compressed_storage/{sim_code}/personas/{persona_name}/bootstrap_memory"

  with open(memory + "/scratch.json") as json_file:  
    scratch = json.load(json_file)

  with open(memory + "/spatial_memory.json") as json_file:  
    spatial = json.load(json_file)

  with open(memory + "/associative_memory/nodes.json") as json_file:  
    associative = json.load(json_file)

  a_mem_event = []
  a_mem_chat = []
  a_mem_thought = []

  for count in range(len(associative.keys()), 0, -1): 
    node_id = f"node_{str(count)}"
    node_details = associative[node_id]

    if node_details["type"] == "event":
      a_mem_event += [node_details]

    elif node_details["type"] == "chat":
      a_mem_chat += [node_details]

    elif node_details["type"] == "thought":
      a_mem_thought += [node_details]
  
  context = {"sim_code": sim_code,
             "step": step,
             "persona_name": persona_name, 
             "persona_name_underscore": persona_name_underscore, 
             "scratch": scratch,
             "spatial": spatial,
             "a_mem_event": a_mem_event,
             "a_mem_chat": a_mem_chat,
             "a_mem_thought": a_mem_thought}
  template = "persona_state/persona_state.html"
  return render(request, template, context)


def path_tester(request):
  context = {}
  template = "path_tester/path_tester.html"
  return render(request, template, context)


def process_environment(request): 
  """
  <FRONTEND to BACKEND> 
  This sends the frontend visual world information to the backend server. 
  It does this by writing the current environment representation to 
  "storage/environment.json" file. 

  ARGS:
    request: Django request
  RETURNS: 
    HttpResponse: string confirmation message. 
  """
  # f_curr_sim_code = "temp_storage/curr_sim_code.json"
  # with open(f_curr_sim_code) as json_file:  
  #   sim_code = json.load(json_file)["sim_code"]

  data = json.loads(request.body)
  step = data["step"]
  sim_code = data["sim_code"]
  environment = data["environment"]

  with open(f"storage/{sim_code}/environment/{step}.json", "w") as outfile:
    outfile.write(json.dumps(environment, indent=2))

  return HttpResponse("received")


def update_environment(request): 
  """
  <BACKEND to FRONTEND> 
  This sends the backend computation of the persona behavior to the frontend
  visual server. 
  It does this by reading the new movement information from 
  "storage/movement.json" file.

  ARGS:
    request: Django request
  RETURNS: 
    HttpResponse
  """
  # f_curr_sim_code = "temp_storage/curr_sim_code.json"
  # with open(f_curr_sim_code) as json_file:  
  #   sim_code = json.load(json_file)["sim_code"]

  data = json.loads(request.body)
  step = data["step"]
  sim_code = data["sim_code"]

  response_data = {"<step>": -1}
  if (check_if_file_exists(f"storage/{sim_code}/movement/{step}.json")):
    with open(f"storage/{sim_code}/movement/{step}.json") as json_file: 
      response_data = json.load(json_file)
      response_data["<step>"] = step

  return JsonResponse(response_data)


def path_tester_update(request): 
  """
  Processing the path and saving it to path_tester_env.json temp storage for 
  conducting the path tester. 

  ARGS:
    request: Django request
  RETURNS: 
    HttpResponse: string confirmation message. 
  """
  data = json.loads(request.body)
  camera = data["camera"]

  with open(f"temp_storage/path_tester_env.json", "w") as outfile:
    outfile.write(json.dumps(camera, indent=2))

  return HttpResponse("received")


def debug_frontend(request):
  """Vista per il debugger frontend"""
  return render(request, 'debug_frontend.html')


def check_backend_connection(request):
  """Verifica la connessione al backend"""
  import json
  try:
    # Controlla se il backend è attivo
    with open('temp_storage/curr_sim_code.json', 'r') as f:
      data = json.load(f)
      return JsonResponse({'status': 'online', 'sim_code': data.get('sim_code')})
  except:
    return JsonResponse({'status': 'offline'})


def get_curr_sim_code(request):
  """Ottiene il codice della simulazione corrente"""
  import json
  try:
    with open('temp_storage/curr_sim_code.json', 'r') as f:
      data = json.load(f)
      return JsonResponse(data)
  except:
    return JsonResponse({'sim_code': None})


def log_viewer(request):
  """Vista per il log viewer - mostra le azioni dei personaggi generate da LLM"""
  f_curr_sim_code = "temp_storage/curr_sim_code.json"
  
  sim_code = "default"
  if check_if_file_exists(f_curr_sim_code):
    with open(f_curr_sim_code) as json_file:  
      sim_code = json.load(json_file)["sim_code"]
  
  context = {"sim_code": sim_code}
  return render(request, 'log_viewer.html', context)

def simulator_enhanced(request):
  """
  Enhanced simulator with improved visualization and multi-model support
  """
  import datetime
  
  # Load current simulation info
  f_curr_sim_code = "temp_storage/curr_sim_code.json"
  f_curr_step = "temp_storage/curr_step.json"
  
  sim_code = "default"
  step = 0
  
  if check_if_file_exists(f_curr_sim_code):
    with open(f_curr_sim_code) as json_file:
      sim_code = json.load(json_file)["sim_code"]
  
  if check_if_file_exists(f_curr_step):
    with open(f_curr_step) as json_file:
      step = json.load(json_file)["step"]
  
  # Get personas and their positions
  sim_folder = f"storage/{sim_code}"
  persona_names = []
  persona_init_pos = []
  
  if os.path.exists(f"{sim_folder}/personas/"):
    for persona_folder in os.listdir(f"{sim_folder}/personas/"):
      if not persona_folder.startswith('.'):
        persona_name = persona_folder.replace('_', ' ')
        persona_names.append(persona_name)
        
        # Get initial position
        scratch_file = f"{sim_folder}/personas/{persona_folder}/bootstrap_memory/scratch.json"
        if os.path.exists(scratch_file):
          try:
            with open(scratch_file) as f:
              scratch = json.load(f)
              if "curr_tile" in scratch:
                x, y = scratch["curr_tile"]
                persona_init_pos.append([persona_name, x, y])
              else:
                persona_init_pos.append([persona_name, 0, 0])
          except:
            persona_init_pos.append([persona_name, 0, 0])
        else:
          persona_init_pos.append([persona_name, 0, 0])
  
  # Get current positions from latest movement file if available
  current_positions = []
  latest_movement_file = f"storage/{sim_code}/movement/{step}.json"
  if os.path.exists(latest_movement_file):
    try:
      with open(latest_movement_file) as f:
        movement_data = json.load(f)
        for persona_name in persona_names:
          if persona_name in movement_data.get("persona", {}):
            pos = movement_data["persona"][persona_name]["movement"]
            current_positions.append([persona_name, pos[0], pos[1]])
          else:
            # Fallback to init position
            for init_pos in persona_init_pos:
              if init_pos[0] == persona_name:
                current_positions.append(init_pos)
                break
    except Exception as e:
      print(f"Error reading movement data: {e}")
      current_positions = persona_init_pos
  else:
    current_positions = persona_init_pos

  context = {
    "sim_code": sim_code,
    "step": step,
    "persona_names": [[p, p.replace(' ', '_')] for p in persona_names],
    "persona_init_pos": current_positions,
    "persona_name_str": ",".join(persona_names)
  }
  
  template = "home/simulator_debug.html"
  return render(request, template, context)

def simple_debug(request):
  """
  Simple debug view without Phaser for testing
  """
  import datetime
  
  # Load current simulation info
  f_curr_sim_code = "temp_storage/curr_sim_code.json"
  f_curr_step = "temp_storage/curr_step.json"
  
  sim_code = "test-simulation-24"
  step = 0
  
  if check_if_file_exists(f_curr_sim_code):
    with open(f_curr_sim_code) as json_file:
      data = json.load(json_file)
      sim_code = data.get("sim_code", sim_code)
  
  if check_if_file_exists(f_curr_step):
    with open(f_curr_step) as json_file:
      step = json.load(json_file).get("step", step)

  context = {
    "sim_code": sim_code,
    "step": step
  }
  
  template = "home/simple_debug.html"
  return render(request, template, context)

def fixed_simulator(request):
  """
  Fixed simulator view with proper data loading
  """
  import datetime
  
  # Load current simulation info
  f_curr_sim_code = "temp_storage/curr_sim_code.json"
  f_curr_step = "temp_storage/curr_step.json"
  
  sim_code = "test-simulation-25"
  step = 2
  
  if check_if_file_exists(f_curr_sim_code):
    with open(f_curr_sim_code) as json_file:
      data = json.load(json_file)
      sim_code = data.get("sim_code", sim_code)
  
  if check_if_file_exists(f_curr_step):
    with open(f_curr_step) as json_file:
      step = json.load(json_file).get("step", step)

  context = {
    "sim_code": sim_code,
    "step": step
  }
  
  template = "home/fixed_simulator.html"
  return render(request, template, context)

def api_status(request):
  """
  API endpoint to check backend status
  """
  try:
    f_curr_sim_code = "temp_storage/curr_sim_code.json"
    f_curr_step = "temp_storage/curr_step.json"
    
    sim_code = "unknown"
    step = 0
    
    if check_if_file_exists(f_curr_sim_code):
      with open(f_curr_sim_code) as json_file:
        sim_code = json.load(json_file)["sim_code"]
    
    if check_if_file_exists(f_curr_step):
      with open(f_curr_step) as json_file:
        step = json.load(json_file)["step"]
    
    return JsonResponse({
      "status": "online",
      "sim_code": sim_code,
      "step": step
    })
  except:
    return JsonResponse({"status": "offline"}, status=503)

def api_logs(request):
  """
  API endpoint to get real-time logs from the simulation
  """
  try:
    import datetime
    logs = []
    
    f_curr_sim_code = "temp_storage/curr_sim_code.json"
    
    if not check_if_file_exists(f_curr_sim_code):
      return JsonResponse({"logs": []})
    
    with open(f_curr_sim_code) as json_file:
      sim_code = json.load(json_file)["sim_code"]
    
    # Read recent agent activities
    sim_folder = f"storage/{sim_code}"
    
    if os.path.exists(f"{sim_folder}/personas/"):
      for persona_folder in os.listdir(f"{sim_folder}/personas/"):
        if not persona_folder.startswith('.'):
          persona_name = persona_folder.replace('_', ' ')
          
          # Get current action from scratch
          scratch_file = f"{sim_folder}/personas/{persona_folder}/bootstrap_memory/scratch.json"
          if os.path.exists(scratch_file):
            try:
              with open(scratch_file) as f:
                scratch = json.load(f)
                
                # Try different fields for activity description
                message = "idle"
                if "act_description" in scratch and scratch["act_description"]:
                  message = scratch["act_description"]
                elif "currently" in scratch and scratch["currently"]:
                  message = scratch["currently"]
                elif "act_event" in scratch and scratch["act_event"]:
                  message = str(scratch["act_event"])
                
                logs.append({
                  "agent": persona_name,
                  "type": "action", 
                  "message": message,
                  "timestamp": datetime.datetime.now().isoformat()
                })
            except:
              pass
    
    return JsonResponse({"logs": logs})
  
  except Exception as e:
    return JsonResponse({"error": str(e)}, status=500)