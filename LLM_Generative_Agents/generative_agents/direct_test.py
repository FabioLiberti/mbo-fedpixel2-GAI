#!/usr/bin/env python3
"""
Direct test of movement files without running servers
"""
import json
import os

def test_movement_files():
    """Test movement files directly"""
    sim_code = "test-simulation-24"
    sim_path = f"environment/frontend_server/storage/{sim_code}"
    
    print(f"🔍 Testing simulation: {sim_code}")
    print(f"📁 Path: {sim_path}")
    
    if not os.path.exists(sim_path):
        print(f"❌ Simulation directory doesn't exist: {sim_path}")
        return
    
    movement_dir = f"{sim_path}/movement"
    if not os.path.exists(movement_dir):
        print(f"❌ Movement directory doesn't exist: {movement_dir}")
        return
    
    movement_files = sorted([f for f in os.listdir(movement_dir) if f.endswith('.json')])
    print(f"📊 Found {len(movement_files)} movement files: {movement_files}")
    
    for file_name in movement_files:
        file_path = os.path.join(movement_dir, file_name)
        try:
            with open(file_path) as f:
                data = json.load(f)
            
            step = file_name.replace('.json', '')
            agents = list(data.get('persona', {}).keys())
            time = data.get('meta', {}).get('curr_time', 'Unknown')
            
            print(f"\n📋 Step {step} - {time}")
            
            for agent_name, agent_data in data.get('persona', {}).items():
                pos = agent_data.get('movement', [0, 0])
                desc = agent_data.get('description', 'No description')
                emoji = agent_data.get('pronunciatio', '🤖')
                chat = agent_data.get('chat')
                
                print(f"  👤 {agent_name} {emoji}")
                print(f"     Position: ({pos[0]}, {pos[1]})")
                print(f"     Action: {desc}")
                if chat:
                    print(f"     Chat: \"{chat[1]}\"")
                    
        except Exception as e:
            print(f"❌ Error reading {file_name}: {e}")

def simulate_update_environment_call():
    """Simulate what update_environment does"""
    print("\n🔄 Simulating update_environment call...")
    
    sim_code = "test-simulation-24"
    step = 2  # Test with step 2
    
    movement_file = f"environment/frontend_server/storage/{sim_code}/movement/{step}.json"
    
    if os.path.exists(movement_file):
        try:
            with open(movement_file) as f:
                data = json.load(f)
            
            data['<step>'] = step
            
            print(f"✅ Would return data for step {step}:")
            print(f"   Agents: {list(data.get('persona', {}).keys())}")
            print(f"   Time: {data.get('meta', {}).get('curr_time', 'Unknown')}")
            print(f"   Response size: ~{len(json.dumps(data))} bytes")
            
            return data
        except Exception as e:
            print(f"❌ Error reading movement file: {e}")
            return {"<step>": -1}
    else:
        print(f"❌ Movement file doesn't exist: {movement_file}")
        return {"<step>": -1}

def check_temp_files():
    """Check temp files that control the simulation"""
    print("\n🗃️ Checking temp files...")
    
    temp_files = {
        "sim_code": "environment/frontend_server/temp_storage/curr_sim_code.json",
        "step": "environment/frontend_server/temp_storage/curr_step.json"
    }
    
    for name, path in temp_files.items():
        if os.path.exists(path):
            try:
                with open(path) as f:
                    data = json.load(f)
                print(f"✅ {name}: {data}")
            except Exception as e:
                print(f"❌ Error reading {name}: {e}")
        else:
            print(f"⚠️ Missing {name} file: {path}")

if __name__ == "__main__":
    print("🧪 Direct Movement Files Test")
    print("=" * 50)
    
    check_temp_files()
    test_movement_files()
    simulate_update_environment_call()
    
    print("\n🎯 Recommendations:")
    print("1. Access: http://localhost:8000/simple_debug/")
    print("2. Check browser console for JavaScript errors")
    print("3. Verify Phaser.js is loading correctly") 
    print("4. Test with simple debug view first")