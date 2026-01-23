# Installing gonka-openai Package

The error `ModuleNotFoundError: No module named 'gonka_openai'` means the package is not installed.

## Quick Install

```bash
pip3 install gonka-openai
```

Or if you're using `pip`:

```bash
pip install gonka-openai
```

## If You Get Permission Errors

If you get permission errors, use `--user` flag:

```bash
pip3 install --user gonka-openai
```

Or use a virtual environment (recommended):

```bash
# Create virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate  # On Linux/Mac
# or
venv\Scripts\activate  # On Windows

# Install package
pip install gonka-openai
```

## Verify Installation

After installing, verify it works:

```bash
python3 -c "from gonka_openai import GonkaOpenAI; print('✅ gonka-openai installed successfully!')"
```

## Dependencies

The `gonka-openai` package will automatically install its dependencies:
- `openai` (OpenAI SDK)
- `ecdsa` (for cryptographic signatures)
- `httpx` (HTTP client)

## Troubleshooting

### "pip3: command not found"

Install pip first:

```bash
# Debian/Ubuntu
sudo apt-get update
sudo apt-get install python3-pip

# CentOS/RHEL
sudo yum install python3-pip

# macOS (with Homebrew)
brew install python3
```

### "Permission denied"

Use `--user` flag or virtual environment (see above).

### "No module named 'gonka_openai'" after installation

Make sure you're using the same Python interpreter:

```bash
# Check which Python you're using
which python3

# Check if package is installed
pip3 show gonka-openai

# If installed but still not found, try:
python3 -m pip install gonka-openai
```

## After Installation

Once installed, you can run your script:

```bash
python3 setup_client_example.py
```
