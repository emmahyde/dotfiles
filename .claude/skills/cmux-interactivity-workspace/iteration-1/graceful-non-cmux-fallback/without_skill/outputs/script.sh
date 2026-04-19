#!/bin/bash

set -euo pipefail

# Database migration script with graceful cmux fallback
# Runs `python manage.py migrate` with optional cmux integration if available

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Determine if cmux is available and socket exists
CMUX_AVAILABLE=false
CMUX_SOCKET=""

if command -v cmux &> /dev/null; then
    # Check if a cmux session socket exists
    if [ -n "${CMUX_SOCKET_PATH:-}" ] && [ -S "$CMUX_SOCKET_PATH" ]; then
        CMUX_AVAILABLE=true
        CMUX_SOCKET="$CMUX_SOCKET_PATH"
    elif [ -S "/tmp/cmux_default.sock" ]; then
        CMUX_AVAILABLE=true
        CMUX_SOCKET="/tmp/cmux_default.sock"
    fi
fi

# Function to run migration via cmux
run_migration_with_cmux() {
    local msg="Running migration via cmux..."
    echo -e "${BLUE}${msg}${NC}"

    if cmux run-interactive \
        --socket "$CMUX_SOCKET" \
        --command "python manage.py migrate" \
        --timeout 300; then
        echo -e "${GREEN}Migration completed successfully via cmux${NC}"
        return 0
    else
        local exit_code=$?
        echo -e "${YELLOW}cmux migration failed with exit code ${exit_code}, falling back to direct execution${NC}"
        return $exit_code
    fi
}

# Function to run migration directly
run_migration_direct() {
    local msg="Running migration directly..."
    echo -e "${BLUE}${msg}${NC}"

    if python manage.py migrate; then
        echo -e "${GREEN}Migration completed successfully${NC}"
        return 0
    else
        local exit_code=$?
        echo -e "${YELLOW}Migration failed with exit code ${exit_code}${NC}"
        return $exit_code
    fi
}

# Main execution logic
main() {
    echo -e "${BLUE}=== Database Migration ====${NC}"

    if [ "$CMUX_AVAILABLE" = true ]; then
        echo "cmux is available (socket: $CMUX_SOCKET)"

        # Attempt migration via cmux first
        if run_migration_with_cmux; then
            exit 0
        else
            # Fall back to direct execution
            echo -e "${YELLOW}Attempting direct migration as fallback...${NC}"
            run_migration_direct
            exit $?
        fi
    else
        # cmux not available, run directly
        if [ -z "$(command -v cmux 2>/dev/null || true)" ]; then
            echo "cmux is not installed"
        else
            echo "cmux is installed but socket is not available"
        fi
        echo "Running migration directly..."
        run_migration_direct
        exit $?
    fi
}

main
