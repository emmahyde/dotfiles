#!/bin/bash

# Check if pyright-langserver is installed and available in PATH

if command -v pyright-langserver &> /dev/null; then
    exit 0
fi

# Check if pip is available
if ! command -v pip &> /dev/null; then
    echo "[pyright] pip is not installed. Please install Python first."
    echo "          Then run: pip install pyright"
    exit 0
fi

# Install via pip
echo "[pyright] Installing pyright..."
pip install pyright

if command -v pyright-langserver &> /dev/null; then
    echo "[pyright] Installed successfully"
else
    echo "[pyright] Failed to install. Please run manually:"
    echo "          pip install pyright"
fi

exit 0
