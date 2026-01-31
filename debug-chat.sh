#!/bin/bash

# Script to debug AI Assistant chat with Playwright

set -e

echo "=== Starting Chat Debug Test ==="

# Check for API key
if [ -z "$OPENAI_API_KEY" ] && [ -z "$GEMINI_API_KEY" ] && [ -z "$LLM_API_KEY" ]; then
  echo "Error: No LLM API key found. Please set OPENAI_API_KEY, GEMINI_API_KEY, or LLM_API_KEY"
  exit 1
fi

echo "✓ API key found"

# Start mosquitto if not running
if ! pgrep -x "mosquitto" > /dev/null; then
  echo "Starting mosquitto..."
  mosquitto -c /dev/null -p 1883 &
  MOSQUITTO_PID=$!
  sleep 2
else
  echo "✓ Mosquitto already running"
fi

# Build the server
echo "Building server..."
yarn build:server

# Start the server in background
echo "Starting server..."
export MQTT_EXPLORER_USERNAME=test
export MQTT_EXPLORER_PASSWORD=test123
export PORT=3000
export TESTS_MQTT_BROKER_HOST=127.0.0.1
export TESTS_MQTT_BROKER_PORT=1883

node dist/src/server.js &
SERVER_PID=$!

echo "Server PID: $SERVER_PID"

# Wait for server to start
echo "Waiting for server to be ready..."
for i in {1..30}; do
  if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo "✓ Server is ready"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "Error: Server failed to start"
    kill $SERVER_PID 2>/dev/null || true
    kill $MOSQUITTO_PID 2>/dev/null || true
    exit 1
  fi
  sleep 1
done

# Run the test
echo ""
echo "=== Running Playwright Test ==="
echo ""

npx playwright test test-chat-debug.ts --headed || TEST_FAILED=1

# Cleanup
echo ""
echo "=== Cleanup ==="
kill $SERVER_PID 2>/dev/null || true
if [ ! -z "$MOSQUITTO_PID" ]; then
  kill $MOSQUITTO_PID 2>/dev/null || true
fi

if [ "$TEST_FAILED" = "1" ]; then
  echo ""
  echo "Test failed. Check the screenshots:"
  ls -lh screenshot-*.png 2>/dev/null || echo "No screenshots found"
  exit 1
fi

echo ""
echo "✓ Test completed successfully"
