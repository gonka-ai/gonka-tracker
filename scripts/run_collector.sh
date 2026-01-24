#!/bin/bash
# Run metrics collector using uv

cd "$(dirname "$0")/../backend"

# Set environment variables if not already set
export POSTGRES_HOST=${POSTGRES_HOST:-localhost}
export POSTGRES_PORT=${POSTGRES_PORT:-5432}
export POSTGRES_USER=${POSTGRES_USER:-postgres}
export POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-postgres}
export POSTGRES_DB=${POSTGRES_DB:-gonka_tracker}
export API_URL=${API_URL:-http://localhost/api/v1}
export COLLECT_INTERVAL=${COLLECT_INTERVAL:-30}

# Run the collector using uv
uv run python3 ../scripts/collect_metrics.py
