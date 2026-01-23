#!/bin/bash
# Script to install gonka-openai package

echo "Installing gonka-openai package..."
echo ""

# Check if pip3 is available
if command -v pip3 &> /dev/null; then
    echo "Using pip3..."
    pip3 install gonka-openai
elif command -v pip &> /dev/null; then
    echo "Using pip..."
    pip install gonka-openai
else
    echo "ERROR: Neither pip nor pip3 found!"
    echo "Please install pip first:"
    echo "  sudo apt-get install python3-pip  # Debian/Ubuntu"
    echo "  sudo yum install python3-pip     # CentOS/RHEL"
    exit 1
fi

echo ""
echo "✅ Installation complete!"
echo ""
echo "You can now run:"
echo "  python3 setup_client_example.py"
