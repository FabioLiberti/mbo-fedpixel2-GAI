#!/usr/bin/env python
import subprocess
import sys
import re
from datetime import datetime

def monitor_simulation():
    """Monitora la simulazione e mostra log formattati"""
    
    print("="*60)
    print("GENERATIVE AGENTS MONITOR")
    print("="*60)
    
    process = subprocess.Popen(
        ['python', 'reverie.py'],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        universal_newlines=True,
        bufsize=1
    )
    
    for line in iter(process.stdout.readline, ''):
        # Filtra e formatta l'output
        if "Isabella" in line:
            print(f"\033[95m[ISABELLA] {line}\033[0m", end='')
        elif "Maria" in line:
            print(f"\033[94m[MARIA] {line}\033[0m", end='')
        elif "Klaus" in line:
            print(f"\033[93m[KLAUS] {line}\033[0m", end='')
        elif "ERROR" in line or "Error" in line:
            print(f"\033[91m[ERROR] {line}\033[0m", end='')
        else:
            print(line, end='')

if __name__ == "__main__":
    monitor_simulation()