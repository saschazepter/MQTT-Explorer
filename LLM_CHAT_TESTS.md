# LLM Chat Frontend Tests

This document describes how to run and use the Playwright tests for the AI Assistant chat feature.

## Overview

The AI Assistant chat tests verify that the frontend can:
1. Expand the AI Assistant panel
2. Send messages to the LLM
3. Receive and display responses from the LLM
4. Clear chat history

## Prerequisites

- Node.js >= 20
- Yarn package manager
- LLM API key (OpenAI, Gemini, or generic LLM)
- Running mosquitto MQTT broker
- Built project (`yarn build:server`)

## Quick Start

### 1. Set up API Key

The easiest way is to use the existing `.env.llm-tests` file:

```bash
# Source the environment variables
source .env.llm-tests

# Run the tests
./scripts/runBrowserTestsWithLLM.sh
```

### 2. Or Provide API Key Directly

```bash
# With OpenAI
OPENAI_API_KEY=sk-your-key-here ./scripts/runBrowserTestsWithLLM.sh

# With Gemini
GEMINI_API_KEY=your-key-here ./scripts/runBrowserTestsWithLLM.sh

# With generic LLM API key
LLM_API_KEY=your-key LLM_PROVIDER=openai ./scripts/runBrowserTestsWithLLM.sh
```

## Test Suite Details

### Test 1: Expand AI Assistant Panel
**Purpose:** Verifies the UI can expand the AI Assistant panel

**Steps:**
1. Selects a topic (e.g., "livingroom/lamp")
2. Clicks the AI Assistant header
3. Verifies the messages container becomes visible

**Expected Result:** AI Assistant panel expands and shows the chat interface

---

### Test 2: Send Message and Receive Response
**Purpose:** Verifies the complete chat flow with live LLM API

**Steps:**
1. Types a test message: "What is this device?"
2. Clicks the send button
3. Waits for user message to appear
4. Waits for LLM response (up to 45 seconds)
5. Validates response content

**Expected Result:** 
- User message appears immediately
- LLM response appears within 45 seconds
- Response contains meaningful content (>10 characters)

**Typical Response Time:** 2-5 seconds

---

### Test 3: Clear Chat History
**Purpose:** Verifies chat can be cleared

**Steps:**
1. Verifies messages exist from previous test
2. Clicks the clear button
3. Verifies message count returns to 0

**Expected Result:** All messages are removed from the chat

---

## Test Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | None (required) |
| `GEMINI_API_KEY` | Gemini API key alternative | None |
| `LLM_API_KEY` | Generic LLM API key | None |
| `LLM_PROVIDER` | LLM provider: 'openai' or 'gemini' | openai |
| `MQTT_EXPLORER_USERNAME` | Browser auth username | test |
| `MQTT_EXPLORER_PASSWORD` | Browser auth password | test123 |
| `PORT` | Server port | 3000 |
| `TESTS_MQTT_BROKER_HOST` | MQTT broker host | 127.0.0.1 |
| `TESTS_MQTT_BROKER_PORT` | MQTT broker port | 1883 |

### LLM Configuration

The server uses the following LLM settings:
- **Model:** `gpt-5-mini`
- **Max Tokens:** 1000 completion tokens
- **Timeout:** 30 seconds
- **Retries:** 2 (with exponential backoff)

## Screenshots

The tests automatically generate screenshots:
- `test-screenshot-ai-assistant-expanded.png` - Panel expanded
- `test-screenshot-ai-assistant-response.png` - Chat with response
- `test-screenshot-ai-assistant-cleared.png` - After clearing

## Troubleshooting

### Tests Skip Automatically

**Problem:** Tests show as skipped
```
Skipping AI Assistant tests: No LLM API key found
```

**Solution:** Ensure you have set one of the API key environment variables:
```bash
echo $OPENAI_API_KEY  # Should not be empty
```

### No Response from LLM

**Problem:** Test times out waiting for response

**Possible Causes:**
1. Invalid API key
2. API rate limits
3. Network issues
4. Model not available

**Check Server Logs:**
```bash
# Server logs show detailed API requests/responses
# Look for error messages in the server output
```

### Tests Fail in CI/CD

**Problem:** Tests fail when run in CI

**Solution:** 
1. Add API key as a secret in your CI/CD system
2. Set it as an environment variable in the workflow
3. Ensure mosquitto service is available

**Example GitHub Actions:**
```yaml
- name: Run LLM Chat Tests
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  run: |
    source .env.llm-tests
    ./scripts/runBrowserTestsWithLLM.sh
```

## Cost Considerations

Each test run makes **2 LLM API calls**:
1. Generate suggested questions (on panel expand)
2. Respond to user message

**Estimated Cost per Test Run:**
- OpenAI (gpt-4o-mini): ~$0.001 - $0.005
- Gemini (flash): Usually free tier

**Total tokens per run:** ~1,000-2,000 tokens

## Test Data Attributes

The following `data-testid` attributes are used:

| Test ID | Element | Purpose |
|---------|---------|---------|
| `ai-assistant` | Root container | Locate component |
| `ai-assistant-header` | Header (clickable) | Expand panel |
| `ai-assistant-toggle` | Toggle icon | Alternative expand |
| `ai-assistant-messages` | Messages container | Verify visibility |
| `ai-message-user` | User message | Find user messages |
| `ai-message-assistant` | Assistant message | Find LLM responses |
| `ai-assistant-input` | Text input | Type messages |
| `ai-assistant-send` | Send button | Submit messages |
| `ai-assistant-clear` | Clear button | Clear history |

## Security

- API keys are never logged or exposed in test output
- All LLM calls are proxied through the backend server
- Tests skip gracefully if no API key is available
- Rate limiting is handled by the server

## Running Individual Tests

To run only the LLM chat tests:

```bash
# Set up environment
source .env.llm-tests
yarn build:server

# Start services manually
mosquitto &
node dist/src/server.js &

# Run specific test file
export BROWSER_MODE_URL="http://localhost:3000"
yarn mocha dist/src/spec/ui-tests.spec.ts --grep "AI Assistant"

# Cleanup
killall mosquitto node
```

## Integration with Existing Tests

The LLM chat tests are part of the main UI test suite (`ui-tests.spec.ts`). They run after the standard MQTT Explorer tests and are skipped automatically if no API key is present.

**Full test suite:** 11 tests (8 standard + 3 LLM)
**Test time:** ~80 seconds total

## Development

When adding new LLM features to test:

1. Add `data-testid` attributes to new UI elements
2. Add test cases to the "AI Assistant Chat" describe block
3. Use appropriate timeouts (LLM calls can take 30+ seconds)
4. Always include `.skip()` logic for missing API keys

**Example:**
```typescript
it('should do something with LLM', async function() {
  this.timeout(60000) // Generous timeout for LLM
  
  // Test code here
  const response = await page.getByTestId('ai-message-assistant').first()
  await response.waitFor({ state: 'visible', timeout: 45000 })
})
```
