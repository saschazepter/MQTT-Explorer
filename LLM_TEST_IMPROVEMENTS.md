# LLM Live Tests - Improvements Summary

## Overview
This document summarizes the improvements made to the LLM (Large Language Model) live integration tests for MQTT Explorer.

## What Was Changed

### 1. Live API Integration (Major Improvement)
**Before:** Tests only validated expected proposal structures without making actual API calls.

**After:** Tests now make real API calls to OpenAI or Gemini and validate actual LLM responses.

#### Key Improvements:
- ✅ **Real API calls** using axios to OpenAI Chat Completions or Gemini GenerativeAI endpoints
- ✅ **Multi-provider support** - Works with both OpenAI (gpt-4o-mini) and Gemini (gemini-1.5-flash-latest)
- ✅ **Comprehensive validation** - Checks topic format, payload structure, QoS levels, descriptions
- ✅ **Better logging** - Detailed console output for debugging test failures
- ✅ **Error handling** - Proper timeout handling (up to 45s for Gemini), API error reporting with sanitized messages, and graceful degradation

### 2. Enhanced Test Coverage

#### Home Automation System Detection
- **zigbee2mqtt**: Validates JSON payload format, /set topic pattern, state field presence
- **Home Assistant**: Validates homeassistant/ prefix, /set pattern, proper payload format
- **Tasmota**: Validates cmnd/ prefix, simple string payloads (ON/OFF/TOGGLE)

#### Proposal Quality Validation
- **Multiple actions**: Tests that LLM suggests multiple relevant actions for controllable devices
- **Clear descriptions**: Validates descriptions are actionable (start with action verbs) and concise (<100 chars)
- **System-specific payloads**: Ensures JSON for zigbee2mqtt, simple strings for Tasmota

#### Edge Cases
- **Read-only sensors**: Tests appropriate handling of sensors (no write actions)
- **Complex nested topics**: Validates deep topic structures (5+ levels)
- **Special characters**: Tests hyphens, underscores, numbers in topics

#### Question Generation
- **Follow-up questions**: Validates question-proposal format and relevance
- **Question quality**: Checks questions end with '?', have categories (analysis/control/etc.)

### 3. Developer Experience Improvements

#### Helper Scripts
1. **`scripts/run-llm-tests.sh`** - Easy test execution
   - Checks for API key presence
   - Shows which provider is being used
   - Provides clear error messages
   - Sets RUN_LLM_TESTS automatically

2. **`scripts/validate-llm-test-setup.sh`** - Validation without API calls
   - Verifies test skip logic works correctly
   - Checks test count (107 passing, 11 pending)
   - Validates helper script is executable
   - No API costs incurred

#### Documentation Updates
- Updated `app/src/services/spec/README.md` with:
  - Clear "Recent Improvements" section
  - Better quick start instructions
  - Multi-provider examples
  - Cost warnings

### 4. Test Configuration

#### Environment Variables
```bash
# Primary API keys (pick one)
OPENAI_API_KEY=sk-...          # For OpenAI GPT models
GEMINI_API_KEY=...             # For Google Gemini models
LLM_API_KEY=...                # Generic (needs LLM_PROVIDER set)

# Required to enable live tests
RUN_LLM_TESTS=true

# Optional
LLM_PROVIDER=openai            # or 'gemini'
```

#### Provider Detection Logic
```typescript
const getProvider = (): 'openai' | 'gemini' | null => {
  if (process.env.OPENAI_API_KEY) return 'openai'
  if (process.env.GEMINI_API_KEY) return 'gemini'
  if (process.env.LLM_API_KEY && process.env.LLM_PROVIDER) {
    return process.env.LLM_PROVIDER as 'openai' | 'gemini'
  }
  return null
}
```

## How to Use

### Running Tests Locally

#### Without API Key (Default)
```bash
cd app && yarn test
# Result: 107 passing, 11 pending (LLM tests skipped)
```

#### With API Key (Live Tests)
```bash
# Method 1: Use helper script (recommended)
OPENAI_API_KEY=sk-your-key ./scripts/run-llm-tests.sh

# Method 2: Manual
export OPENAI_API_KEY=sk-your-key
export RUN_LLM_TESTS=true
cd app && yarn test
```

#### Validation (No API Key Needed)
```bash
./scripts/validate-llm-test-setup.sh
# Checks test setup without making API calls
```

### Running in CI/CD

#### GitHub Actions Example
```yaml
name: LLM Integration Tests
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:     # Manual trigger

jobs:
  llm-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: |
          yarn install
          cd app && yarn install
          
      - name: Run LLM Integration Tests
        env:
          RUN_LLM_TESTS: true
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: yarn test:app
```

## Cost Considerations

### Typical Test Run
- **Number of API calls**: ~11 tests
- **Tokens per call**: ~500-1000 total (prompt + response)
- **Estimated cost**: $0.01 - $0.05 per run
- **Recommended frequency**: Daily or on-demand only

### Cost-Saving Strategies
1. Run tests only on schedule (not on every commit)
2. Use cheaper models (gpt-4o-mini instead of gpt-4)
3. Cache successful responses (future improvement)
4. Set up cost alerts in cloud provider console

## Test Results Interpretation

### Success Criteria
✅ **Pass**: All assertions pass, LLM generates valid proposals with correct format
❌ **Fail**: Assertions fail, API errors, invalid proposals

### Common Failure Modes
1. **API Rate Limit**: "Rate limit exceeded" - Wait and retry
2. **Invalid API Key**: "Unauthorized" - Check key is set correctly
3. **Timeout**: Connection or response timeout - Check network/API status
4. **Unexpected Response**: LLM doesn't follow format - May need prompt tuning

### Debugging Failed Tests
```bash
# Run with detailed logging
RUN_LLM_TESTS=true OPENAI_API_KEY=sk-... yarn test 2>&1 | tee test-output.log

# Check logs for:
# - "[TEST] Calling LLM with..." - Request being made
# - "[TEST] LLM Response length: X" - Response received
# - "[TEST] Extracted proposals: X" - Parsing worked
# - Assertion errors - What validation failed
```

## Future Improvements

### Planned Enhancements
- [ ] Response caching to reduce API costs
- [ ] Retry logic for transient failures
- [ ] Performance benchmarks (response time)
- [ ] Cost tracking and reporting
- [ ] Snapshot testing for common scenarios
- [ ] Support for additional providers (Claude, etc.)
- [ ] Mock mode for local development without API key

### Test Coverage Expansion
- [ ] Multi-language MQTT payloads
- [ ] Binary MQTT payloads (protobuf, sparkplug)
- [ ] Very large topic hierarchies (1000+ topics)
- [ ] Real-time data streams
- [ ] Historical data analysis

## Migration Notes

### For Existing Installations
No changes needed! Tests default to skip mode and require explicit opt-in.

### For CI/CD Pipelines
1. Add `OPENAI_API_KEY` or `GEMINI_API_KEY` to secrets
2. Optionally add scheduled workflow for LLM tests
3. Default test runs (`yarn test`) continue to work without API key

### Backward Compatibility
✅ All existing tests continue to pass
✅ No breaking changes to test infrastructure
✅ Opt-in design - won't break builds without API key

## Technical Details

### API Endpoints Used

#### OpenAI
```typescript
POST https://api.openai.com/v1/chat/completions
{
  "model": "gpt-4o-mini",
  "messages": [...],
  "temperature": 0.7,
  "max_tokens": 1000
}
```

#### Gemini
```typescript
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent
{
  "contents": [...],
  "generationConfig": {
    "temperature": 0.7,
    "maxOutputTokens": 1000
  }
}
```
Note: Per Gemini REST API documentation, the API key must be passed as a query parameter.

### Response Parsing
Proposals are extracted using regex:
```typescript
const proposalRegex = /```proposal\s*\n([\s\S]*?)\n```/g
```

Questions are extracted using:
```typescript
const questionRegex = /```question-proposal\s*\n([\s\S]*?)\n```/g
```

## Questions?

For questions or issues with the LLM tests:
1. Check `app/src/services/spec/README.md` for detailed docs
2. Run `./scripts/validate-llm-test-setup.sh` to verify setup
3. Review test output logs for specific error messages
4. Check API provider status (openai.com/status)

## Summary

The LLM live tests have been significantly improved to provide real validation of the AI assistant feature. Tests now:
- ✅ Make actual API calls to validate real behavior
- ✅ Support multiple LLM providers (OpenAI, Gemini)
- ✅ Have comprehensive validation of proposals
- ✅ Include helpful debugging logs
- ✅ Are easy to run with helper scripts
- ✅ Remain optional and won't break builds

**Next step**: Run tests with actual API key to validate the improvements work in production!
