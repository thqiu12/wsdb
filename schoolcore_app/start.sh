#!/bin/bash
export PORT=${PORT:-8765}
export AUTH_TOKEN=${AUTH_TOKEN:-schoolcore-dev-token}
export DATA_DIR=${DATA_DIR:-$(dirname "$0")/data}
export EXPORT_DIR=${EXPORT_DIR:-$(dirname "$0")/exports}
export TEMPLATES_DIR=${TEMPLATES_DIR:-$(dirname "$0")/templates}

mkdir -p "$DATA_DIR" "$EXPORT_DIR" "$TEMPLATES_DIR"

cd "$(dirname "$0")"
echo "Starting SchoolCore V2 on port $PORT"
echo "Auth token: $AUTH_TOKEN"
echo "API docs: http://127.0.0.1:$PORT/api/docs"
python3 main.py
