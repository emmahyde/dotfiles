#!/usr/bin/env python3
"""
Task Dependency Validator Hook

Pattern: Create tasks first, then link dependencies with TaskUpdate.

This hook is now a passthrough - dependency linking happens via TaskUpdate
which has native addBlockedBy/addBlocks parameters.
"""

import json
import sys

def main():
    # Allow all TaskCreate calls - dependencies are set via TaskUpdate
    print(json.dumps({'permissionDecision': 'allow'}))
    sys.exit(0)

if __name__ == '__main__':
    main()
