#!/bin/bash
set -e

PROJECT_DIR="/tmp/fake-project"
cd "$PROJECT_DIR"

# Cleanup function
cleanup_sidebar() {
  cmux clear-status build 2>/dev/null
  cmux clear-status tests 2>/dev/null
  cmux clear-progress 2>/dev/null
}

trap cleanup_sidebar EXIT

# Initialize sidebar state
cmux set-status build "starting" --icon hammer --color "#ff9500"
cmux log "Task started: npm run build && npm test in $PROJECT_DIR"

# Run build
cmux set-progress 0.0 --label "Running npm run build..."
cmux set-status build "running" --icon hammer --color "#ff9500"

if npm run build; then
  cmux log --level success "Build completed successfully"
  cmux set-status build "complete" --icon checkmark --color "#34c759"
  cmux set-progress 0.5 --label "Build complete, running tests..."
else
  cmux log --level error --source build "Build failed"
  cmux set-status build "failed" --icon xmark --color "#ff3b30"
  cmux notify --title "Build Failed" --body "Check logs for details"
  exit 1
fi

# Run tests
cmux set-status tests "running" --icon checkmark --color "#ff9500"

if npm test; then
  cmux log --level success "All tests passed"
  cmux set-status tests "passed" --icon checkmark --color "#34c759"
  cmux set-progress 1.0 --label "Complete"
  cmux notify --title "Task Complete" --body "Build and tests passed successfully"
else
  cmux log --level error --source tests "Tests failed"
  cmux set-status tests "failed" --icon xmark --color "#ff3b30"
  cmux notify --title "Tests Failed" --body "Check logs for details"
  exit 1
fi
