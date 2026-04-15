#!/usr/bin/env python3
"""
Task Dependency Analyzer Hook
Analyzes new tasks and automatically sets up realistic dependencies based on:
1. Task descriptions and relationships
2. Parallelizable work detection
3. Existing task list context
"""

import json
import sys
from pathlib import Path

def load_task_list():
    """Load current task list from the task list state if available."""
    # The task list is typically managed in memory by Claude Code
    # We'll pass it via stdin from the hook infrastructure if available
    return {}

def analyze_dependencies(new_task_subject, new_task_description, existing_tasks):
    """
    Analyze task description and existing tasks to determine dependencies.
    Returns {'blockedBy': [task_ids], 'parallelizable': bool}
    """

    # Keywords indicating sequential dependencies
    sequential_keywords = {
        'after': 'must happen after',
        'once': 'depends on completion',
        'first': 'prerequisite',
        'then': 'sequential step',
        'depends on': 'dependency',
        'requires': 'prerequisite',
        'prerequisite': 'must complete first',
        'wait for': 'blocking task',
        'following': 'sequential'
    }

    # Keywords indicating parallelizable work
    parallel_keywords = {
        'meanwhile': 'can run in parallel',
        'simultaneously': 'parallelizable',
        'in parallel': 'parallelizable',
        'alongside': 'independent work',
        'while': 'concurrent work',
        'independent': 'no dependencies',
        'separate': 'independent concern'
    }

    combined_text = (new_task_subject + " " + new_task_description).lower()

    # Check for parallelizable indicators
    is_parallelizable = any(keyword in combined_text for keyword in parallel_keywords.keys())

    # Check for sequential dependencies
    has_sequential_markers = any(keyword in combined_text for keyword in sequential_keywords.keys())

    blocked_by = []

    # If task mentions specific dependencies, try to match with existing tasks
    if has_sequential_markers and existing_tasks:
        # Look for tasks that might be prerequisites
        for task_id, task_info in existing_tasks.items():
            task_text = (task_info.get('subject', '') + " " + task_info.get('description', '')).lower()

            # Simple heuristic: if current task mentions keywords from existing task, it might depend on it
            # Check for semantic relationships (simplified)
            common_terms = set(combined_text.split()) & set(task_text.split())

            # If there's significant overlap and the existing task is pending/in_progress, it might be a dependency
            if len(common_terms) > 2 and task_info.get('status') in ['pending', 'in_progress']:
                if task_info.get('status') == 'in_progress':
                    blocked_by.append(task_id)

    return {
        'blockedBy': blocked_by,
        'parallelizable': is_parallelizable,
        'analysis': {
            'has_sequential_markers': has_sequential_markers,
            'has_parallel_indicators': is_parallelizable
        }
    }

def main():
    try:
        # Read hook input from stdin
        input_data = json.load(sys.stdin)

        tool_name = input_data.get('tool_name', '')
        tool_input = input_data.get('tool_input', {})

        # Only process TaskCreate calls
        if tool_name != 'TaskCreate':
            # Pass through unchanged
            print(json.dumps({'continue': True}))
            sys.exit(0)

        subject = tool_input.get('subject', '')
        description = tool_input.get('description', '')

        # For now, we'll provide analysis but not modify the input
        # (The task management system should handle the actual dependency logic)
        # This hook serves as an analyzer and can guide the user

        analysis = analyze_dependencies(subject, description, {})

        # Output analysis for logging/visibility
        system_message = f"Task dependency analysis: parallelizable={analysis['parallelizable']}"

        if analysis['blockedBy']:
            system_message += f" | potential dependencies: {analysis['blockedBy']}"

        response = {
            'continue': True,
            'systemMessage': system_message
        }

        # If the task appears parallelizable, highlight that
        if analysis['parallelizable']:
            response['systemMessage'] += " ✓ [PARALLELIZABLE WORK DETECTED]"

        print(json.dumps(response))
        sys.exit(0)

    except Exception as e:
        # Log error but don't block
        error_response = {
            'continue': True,
            'systemMessage': f'Task dependency analyzer error: {str(e)}'
        }
        print(json.dumps(error_response), file=sys.stderr)
        sys.exit(0)

if __name__ == '__main__':
    main()
