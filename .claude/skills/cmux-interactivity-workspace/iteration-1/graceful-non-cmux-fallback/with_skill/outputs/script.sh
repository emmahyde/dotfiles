#!/bin/bash

# Database Migration Script with graceful cmux fallback
# Runs `python manage.py migrate` and provides rich feedback in cmux,
# or falls back to plain stdout if cmux is not available.

set -e

# Detect cmux availability
CMUX_AVAILABLE=false
SOCK="${CMUX_SOCKET_PATH:-/tmp/cmux.sock}"

if [ -n "$CMUX_WORKSPACE_ID" ] && [ -n "$CMUX_SURFACE_ID" ]; then
  CMUX_AVAILABLE=true
elif [ -S "$SOCK" ]; then
  CMUX_AVAILABLE=true
elif command -v cmux &>/dev/null; then
  CMUX_AVAILABLE=true
fi

# Helper function: log to cmux or stdout
log_message() {
  local message="$1"
  local level="${2:-info}"

  if [ "$CMUX_AVAILABLE" = true ]; then
    cmux log --level "$level" "$message" 2>/dev/null || echo "$message"
  else
    echo "$message"
  fi
}

# Helper function: set status in cmux or stdout
set_status() {
  local key="$1"
  local value="$2"
  local icon="${3:-gear}"
  local color="${4:-#ff9500}"

  if [ "$CMUX_AVAILABLE" = true ]; then
    cmux set-status "$key" "$value" --icon "$icon" --color "$color" 2>/dev/null || echo "[STATUS] $key: $value"
  else
    echo "[STATUS] $key: $value"
  fi
}

# Helper function: set progress in cmux or stdout
set_progress() {
  local progress="$1"
  local label="$2"

  if [ "$CMUX_AVAILABLE" = true ]; then
    cmux set-progress "$progress" --label "$label" 2>/dev/null || echo "[PROGRESS] $progress: $label"
  else
    echo "[PROGRESS] $progress: $label"
  fi
}

# Helper function: clear cmux metadata
cleanup_sidebar() {
  if [ "$CMUX_AVAILABLE" = true ]; then
    cmux clear-status migration 2>/dev/null || true
    cmux clear-progress 2>/dev/null || true
  fi
}

# Helper function: send notification
notify_user() {
  local title="$1"
  local body="$2"

  if [ "$CMUX_AVAILABLE" = true ]; then
    cmux notify --title "$title" --body "$body" 2>/dev/null || true
  fi
}

# Setup cleanup trap
trap cleanup_sidebar EXIT

# Main migration logic
main() {
  echo "Starting database migration..."
  log_message "Database migration starting"
  set_status migration "initializing" --icon gear --color "#ff9500"
  set_progress 0.0 --label "Preparing migration..."

  # Check if manage.py exists
  if [ ! -f "manage.py" ]; then
    echo "ERROR: manage.py not found in current directory"
    log_message "Migration failed: manage.py not found" error
    set_status migration "failed" --icon xmark --color "#ff3b30"
    notify_user "Migration Failed" "manage.py not found in current directory"
    return 1
  fi

  set_progress 0.25 --label "Running migration..."
  set_status migration "running" --icon hourglass --color "#ff9500"

  # Run migration
  if python manage.py migrate; then
    echo "Database migration completed successfully"
    set_progress 1.0 --label "Migration complete"
    log_message "Database migration completed successfully" success
    set_status migration "complete" --icon checkmark --color "#34c759"
    notify_user "Migration Complete" "Database migration succeeded"
    return 0
  else
    echo "ERROR: Database migration failed"
    log_message "Migration failed with errors" error
    set_status migration "failed" --icon xmark --color "#ff3b30"
    notify_user "Migration Failed" "Database migration encountered errors"
    return 1
  fi
}

# Run main function
main
exit $?
