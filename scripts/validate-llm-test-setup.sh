#!/bin/bash

# Script to validate LLM test setup without making real API calls
# This checks that:
# 1. Tests properly detect API keys
# 2. Tests skip appropriately when keys are missing
# 3. Environment variables are handled correctly

set -e

echo "========================================"
echo "  LLM Test Setup Validator             "
echo "========================================"
echo ""

cd "$(dirname "$0")/.."

# Test 1: Verify tests skip when RUN_LLM_TESTS is not set
echo "Test 1: Checking default behavior (tests should skip)..."
cd app
OUTPUT=$(yarn test 2>&1 | grep -A 2 "LLM Integration Tests" || true)
if echo "$OUTPUT" | grep -q "Skipping"; then
    echo "✅ PASS: Tests skip by default"
else
    echo "❌ FAIL: Tests should skip when RUN_LLM_TESTS is not set"
    exit 1
fi
cd ..

# Test 2: Verify tests skip when API key is missing
echo ""
echo "Test 2: Checking with RUN_LLM_TESTS=true but no API key..."
cd app
OUTPUT=$(RUN_LLM_TESTS=true yarn test 2>&1 | grep -A 2 "LLM Integration Tests" || true)
if echo "$OUTPUT" | grep -q "No API key found"; then
    echo "✅ PASS: Tests skip when API key is missing"
else
    echo "❌ FAIL: Tests should skip when API key is missing"
    exit 1
fi
cd ..

# Test 3: Verify test count
echo ""
echo "Test 3: Verifying test structure..."
cd app
OUTPUT=$(yarn test 2>&1)
PASSING=$(echo "$OUTPUT" | grep "passing" | awk '{print $1}')
PENDING=$(echo "$OUTPUT" | grep "pending" | awk '{print $1}')

echo "  - Passing tests: $PASSING"
echo "  - Pending tests: $PENDING"

# Check that we have LLM tests pending (flexible count)
if [ -n "$PENDING" ] && [ "$PENDING" -gt 0 ]; then
    echo "✅ PASS: LLM integration tests are pending (skipped without API key)"
    if [ "$PENDING" != "11" ]; then
        echo "  Note: Test count changed from expected 11 to $PENDING"
        echo "  This may be expected if tests were added/removed"
    fi
else
    echo "⚠️  WARNING: No pending tests found"
fi
cd ..

# Test 4: Check if helper script exists and is executable
echo ""
echo "Test 4: Checking helper script..."
if [ -x "scripts/run-llm-tests.sh" ]; then
    echo "✅ PASS: Helper script exists and is executable"
else
    echo "❌ FAIL: Helper script should be executable"
    exit 1
fi

echo ""
echo "========================================"
echo "✅ All validation tests passed!"
echo "========================================"
echo ""
echo "To run the actual LLM tests with API calls:"
echo "  OPENAI_API_KEY=sk-your-key ./scripts/run-llm-tests.sh"
echo ""
