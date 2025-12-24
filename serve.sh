#!/bin/bash

# ScoutLens - Quick Server Launcher
# Run this script to start a local server

echo "🔭 Starting ScoutLens..."
echo ""

# Check for Python 3
if command -v python3 &> /dev/null; then
    echo "📡 Server running at: http://localhost:8000"
    echo "Press Ctrl+C to stop"
    echo ""
    python3 -m http.server 8000
# Check for Python 2
elif command -v python &> /dev/null; then
    echo "📡 Server running at: http://localhost:8000"
    echo "Press Ctrl+C to stop"
    echo ""
    python -m SimpleHTTPServer 8000
# Check for Node.js
elif command -v npx &> /dev/null; then
    echo "📡 Server running at: http://localhost:3000"
    echo "Press Ctrl+C to stop"
    echo ""
    npx serve .
else
    echo "❌ No server available!"
    echo ""
    echo "Please install one of:"
    echo "  - Python: https://python.org"
    echo "  - Node.js: https://nodejs.org"
    echo ""
    echo "Or just open index.html directly in your browser."
fi

