#!/usr/bin/env python3
"""
Test runner script for the chat manager backend.
"""

import subprocess
import sys
import os

def run_tests():
    """Run the test suite with pytest."""
    # Change to the backend directory
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(backend_dir)
    
    # Install test dependencies if needed
    print("Installing test dependencies...")
    subprocess.run([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"], check=True)
    
    # Run the tests
    print("Running tests...")
    result = subprocess.run([
        sys.executable, "-m", "pytest", 
        "tests/", 
        "-v", 
        "--tb=short",
        "--cov=chat_manager",
        "--cov-report=term-missing"
    ])
    
    return result.returncode

def run_chat_manager_tests():
    """Run only chat manager tests."""
    # Change to the backend directory
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(backend_dir)
    
    print("Running chat manager tests...")
    result = subprocess.run([
        sys.executable, "-m", "pytest", 
        "tests/chat_manager/", 
        "-v", 
        "--tb=short",
        "--cov=chat_manager.routes.chat_routes",
        "--cov-report=term-missing"
    ])
    
    return result.returncode



if __name__ == "__main__":
    if len(sys.argv) > 1:
        if sys.argv[1] == "chat_manager":
            exit_code = run_chat_manager_tests()
        else:
            print("Usage: python run_tests.py [chat_manager]")
            print("  chat_manager: Run only chat manager tests")
            print("  (no args): Run all tests")
            sys.exit(1)
    else:
        exit_code = run_tests()
    
    sys.exit(exit_code) 