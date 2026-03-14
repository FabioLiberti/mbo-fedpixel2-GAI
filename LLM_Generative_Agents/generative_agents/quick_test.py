#!/usr/bin/env python3
"""
Quick test script to verify frontend-backend communication
"""
import requests
import json

def test_api_status():
    """Test API status endpoint"""
    try:
        response = requests.get("http://localhost:8000/api/status/", timeout=2)
        print(f"API Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Data: {data}")
            return data
    except Exception as e:
        print(f"API Status Error: {e}")
        return None

def test_update_environment():
    """Test update environment endpoint"""
    try:
        payload = {"step": 2, "sim_code": "test-simulation-22"}
        response = requests.post(
            "http://localhost:8000/update_environment/", 
            json=payload,
            timeout=5
        )
        print(f"Update Environment: {response.status_code}")
        print(f"Response size: {len(response.text)} bytes")
        if response.status_code == 200:
            try:
                data = response.json()
                print(f"JSON Data: {data}")
                if "persona" in data:
                    print(f"Agents: {list(data['persona'].keys())}")
                return data
            except:
                print(f"Raw response: {response.text}")
        return None
    except Exception as e:
        print(f"Update Environment Error: {e}")
        return None

def test_api_logs():
    """Test logs endpoint"""
    try:
        response = requests.get("http://localhost:8000/api/logs/", timeout=2)
        print(f"API Logs: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Logs: {data}")
            return data
    except Exception as e:
        print(f"API Logs Error: {e}")
        return None

if __name__ == "__main__":
    print("🧪 Quick Frontend-Backend Communication Test")
    print("=" * 50)
    
    print("\n1. Testing API Status...")
    status = test_api_status()
    
    print("\n2. Testing Update Environment...")
    update_data = test_update_environment()
    
    print("\n3. Testing API Logs...")
    logs = test_api_logs()
    
    print("\n📋 Summary:")
    print(f"Status API: {'✅' if status else '❌'}")
    print(f"Update API: {'✅' if update_data and 'persona' in update_data else '❌'}")
    print(f"Logs API: {'✅' if logs and 'logs' in logs else '❌'}")
    
    if update_data and 'persona' in update_data:
        print(f"\n🎯 Agents found: {list(update_data['persona'].keys())}")
        for agent, data in update_data['persona'].items():
            pos = data.get('movement', [0, 0])
            desc = data.get('description', 'Unknown')
            print(f"  {agent}: Position {pos}, {desc}")
    else:
        print("\n❌ No agent movement data available")