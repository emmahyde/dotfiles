#!/bin/bash

# cmux commands to open Grafana in a browser split, wait for load, screenshot, and check for panel-1

# Split the current pane vertically (creates a right split)
tmux split-window -h

# Navigate to the right pane and open Grafana in a browser
tmux send-keys -t '{right}' 'open http://localhost:3000' Enter

# Wait for Grafana to load (5 seconds should be sufficient for localhost)
tmux send-keys -t '{right}' 'sleep 5' Enter

# Take a screenshot of the browser window
# Note: On macOS, this captures the entire screen. Adjust path as needed.
tmux send-keys -t '{right}' 'screencapture ~/grafana-dashboard-screenshot.png' Enter

# Check if element with id 'panel-1' is visible using JavaScript via osascript
# This opens a new browser tab and runs JavaScript to check the element
tmux send-keys -t '{right}' 'osascript -e "tell application \"Google Chrome\" to execute front window\'s active tab javascript \"document.getElementById(\'panel-1\') !== null && document.getElementById(\'panel-1\').offsetParent !== null\"" 2>/dev/null && echo "panel-1 is visible" || echo "panel-1 is not visible"' Enter
