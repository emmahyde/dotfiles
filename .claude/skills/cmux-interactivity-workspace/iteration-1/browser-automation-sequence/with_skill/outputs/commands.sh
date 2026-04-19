#!/bin/bash
# cmux browser automation sequence
# Task: Open Grafana dashboard at http://localhost:3000 in a browser split,
# wait for page load, take a screenshot, and check visibility of element with id 'panel-1'

# Step 1: Open browser in a new split
cmux browser open-split http://localhost:3000

# Step 2: List surfaces to discover the new browser surface ID
SURFACES=$(cmux list-surfaces --json)
BROWSER_SURFACE=$(echo "$SURFACES" | jq -r '.surfaces[-1].id')

# Step 3: Wait for the page to fully load
cmux browser "$BROWSER_SURFACE" wait --load-state complete --timeout-ms 15000

# Step 4: Take a screenshot for visual inspection
cmux browser "$BROWSER_SURFACE" screenshot --out /tmp/grafana-screenshot.png

# Step 5: Check if element with id 'panel-1' is visible
cmux browser "$BROWSER_SURFACE" is visible "#panel-1"
