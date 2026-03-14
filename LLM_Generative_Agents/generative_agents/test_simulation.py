#!/usr/bin/env python3
"""
Test script to verify simulation is working correctly
"""
import os
import json
import time

def check_simulation_status():
    """Check current simulation status"""
    print("🔍 Checking simulation status...")
    
    # Check temp storage files
    temp_files = [
        "environment/frontend_server/temp_storage/curr_sim_code.json",
        "environment/frontend_server/temp_storage/curr_step.json"
    ]
    
    sim_code = None
    step = None
    
    for file_path in temp_files:
        if os.path.exists(file_path):
            try:
                with open(file_path) as f:
                    data = json.load(f)
                    if "sim_code" in data:
                        sim_code = data["sim_code"]
                        print(f"✓ Current simulation: {sim_code}")
                    if "step" in data:
                        step = data["step"]
                        print(f"✓ Current step: {step}")
            except Exception as e:
                print(f"✗ Error reading {file_path}: {e}")
        else:
            print(f"⚠ Missing: {file_path}")
    
    return sim_code, step

def check_simulation_files(sim_code):
    """Check simulation files exist"""
    if not sim_code:
        print("❌ No active simulation found")
        return False
    
    sim_path = f"environment/frontend_server/storage/{sim_code}"
    
    required_dirs = ["personas", "environment", "movement"]
    missing_dirs = []
    
    for dir_name in required_dirs:
        dir_path = os.path.join(sim_path, dir_name)
        if os.path.exists(dir_path):
            print(f"✓ Directory exists: {dir_name}")
            
            # Check contents
            contents = os.listdir(dir_path)
            print(f"  📁 Contains: {len(contents)} items")
            
            if dir_name == "personas" and contents:
                # Check first persona has required files
                first_persona = contents[0]
                persona_path = os.path.join(dir_path, first_persona, "bootstrap_memory")
                if os.path.exists(persona_path):
                    persona_files = os.listdir(persona_path)
                    print(f"  👤 {first_persona} has {len(persona_files)} memory files")
                
        else:
            missing_dirs.append(dir_name)
            print(f"✗ Missing directory: {dir_name}")
    
    return len(missing_dirs) == 0

def check_movement_files(sim_code, step):
    """Check if movement files are being generated"""
    if not sim_code or step is None:
        return False
    
    movement_dir = f"environment/frontend_server/storage/{sim_code}/movement"
    
    if not os.path.exists(movement_dir):
        print(f"✗ Movement directory missing: {movement_dir}")
        return False
    
    # Check for recent movement files
    movement_files = []
    for i in range(max(0, step-5), step+5):
        movement_file = os.path.join(movement_dir, f"{i}.json")
        if os.path.exists(movement_file):
            movement_files.append(i)
            
            # Check file content
            try:
                with open(movement_file) as f:
                    data = json.load(f)
                    if "persona" in data and data["persona"]:
                        print(f"✓ Movement file {i}.json has {len(data['persona'])} agents")
                    else:
                        print(f"⚠ Movement file {i}.json is empty")
            except Exception as e:
                print(f"✗ Error reading movement file {i}.json: {e}")
    
    print(f"📊 Found movement files for steps: {movement_files}")
    return len(movement_files) > 0

def check_backend_connection():
    """Test backend connection"""
    try:
        import requests
        response = requests.get("http://localhost:8000/api/status/", timeout=2)
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Backend connected: {data}")
            return True
        else:
            print(f"⚠ Backend responded with status {response.status_code}")
            return False
    except ImportError:
        print("⚠ requests module not available, skipping API test")
        return None
    except Exception as e:
        print(f"✗ Backend connection failed: {e}")
        return False

def main():
    print("🚀 Generative Agents Simulation Test")
    print("=" * 50)
    
    # Test 1: Check simulation status
    sim_code, step = check_simulation_status()
    
    # Test 2: Check simulation files
    if sim_code:
        files_ok = check_simulation_files(sim_code)
        if files_ok:
            print("✅ Simulation files are valid")
        else:
            print("❌ Some simulation files are missing")
        
        # Test 3: Check movement files
        movement_ok = check_movement_files(sim_code, step)
        if movement_ok:
            print("✅ Movement files are being generated")
        else:
            print("❌ Movement files are missing")
    
    # Test 4: Check backend connection
    backend_ok = check_backend_connection()
    
    print("\n📋 Summary:")
    print(f"Simulation: {sim_code or 'None'}")
    print(f"Step: {step or 'Unknown'}")
    print(f"Files: {'✅' if sim_code and check_simulation_files(sim_code) else '❌'}")
    print(f"Movement: {'✅' if sim_code and step and check_movement_files(sim_code, step) else '❌'}")
    print(f"Backend: {'✅' if backend_ok else '❌' if backend_ok is False else '⚠'}")
    
    print("\n🎯 Next steps:")
    if not sim_code:
        print("1. Start backend: cd reverie/backend_server && python reverie.py")
        print("2. Start frontend: cd environment/frontend_server && python manage.py runserver")
    elif backend_ok is False:
        print("1. Check if frontend server is running on port 8000")
        print("2. Check browser console for errors")
    else:
        print("1. Open http://localhost:8000/simulator_enhanced/")
        print("2. Check browser console for debug info")
        print("3. Monitor agent movement and interactions")

if __name__ == "__main__":
    main()