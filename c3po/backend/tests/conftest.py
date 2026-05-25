import pytest
import sys
import os

# Add the parent directory to the path so we can import our modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Global test configuration and shared utilities can go here
# Module-specific fixtures are now in their respective conftest.py files 