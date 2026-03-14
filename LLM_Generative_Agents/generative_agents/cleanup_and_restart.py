#!/usr/bin/env python3
"""
Cleanup script to remove test simulations and restart cleanly
"""
import os
import shutil
import glob

def cleanup_test_simulations():
    """Remove all test-simulation directories"""
    storage_path = "environment/frontend_server/storage"
    
    # Find all test-simulation directories
    test_dirs = glob.glob(f"{storage_path}/test-simulation*")
    
    for test_dir in test_dirs:
        print(f"Removing {test_dir}...")
        try:
            shutil.rmtree(test_dir)
            print(f"✓ Removed {test_dir}")
        except Exception as e:
            print(f"✗ Error removing {test_dir}: {e}")
    
    # Clean temp storage
    temp_files = [
        "environment/frontend_server/temp_storage/curr_sim_code.json",
        "environment/frontend_server/temp_storage/curr_step.json"
    ]
    
    for temp_file in temp_files:
        if os.path.exists(temp_file):
            try:
                os.remove(temp_file)
                print(f"✓ Removed {temp_file}")
            except Exception as e:
                print(f"✗ Error removing {temp_file}: {e}")

def create_movement_dirs():
    """Ensure movement directories exist in base simulations"""
    storage_path = "environment/frontend_server/storage"
    
    for sim_dir in os.listdir(storage_path):
        sim_path = os.path.join(storage_path, sim_dir)
        if os.path.isdir(sim_path) and not sim_dir.startswith('test-'):
            movement_dir = os.path.join(sim_path, "movement")
            if not os.path.exists(movement_dir):
                os.makedirs(movement_dir, exist_ok=True)
                print(f"✓ Created movement directory in {sim_dir}")

if __name__ == "__main__":
    print("🧹 Cleaning up test simulations...")
    cleanup_test_simulations()
    
    print("\n📁 Creating missing movement directories...")
    create_movement_dirs()
    
    print("\n✅ Cleanup complete!")
    print("\nYou can now run:")
    print("1. cd reverie/backend_server && python reverie.py")
    print("2. Enter simulation name: base_the_ville_isabella_maria_klaus")
    print("3. Enter new name: test-simulation-21")