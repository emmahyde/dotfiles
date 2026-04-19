#!/bin/bash

# cmux-aware task lifecycle script
# Runs npm build and test in a well-behaved cmux agent manner

set -euo pipefail

PROJECT_DIR="/tmp/fake-project"

# Verify cmux environment
if [[ -z "${CMUX_WORKSPACE_ID:-}" || -z "${CMUX_SURFACE_ID:-}" ]]; then
  echo "Error: cmux environment variables not set" >&2
  exit 1
fi

# Change to project directory
cd "$PROJECT_DIR" || exit 1

# Run build
echo "Starting npm build..."
npm run build
BUILD_EXIT=$?

if [[ $BUILD_EXIT -eq 0 ]]; then
  echo "Build completed successfully"
else
  echo "Build failed with exit code $BUILD_EXIT" >&2
  exit $BUILD_EXIT
fi

# Run tests
echo "Starting npm test..."
npm test
TEST_EXIT=$?

if [[ $TEST_EXIT -eq 0 ]]; then
  echo "Tests completed successfully"
else
  echo "Tests failed with exit code $TEST_EXIT" >&2
  exit $TEST_EXIT
fi

echo "Task lifecycle complete: build and test both succeeded"
exit 0
