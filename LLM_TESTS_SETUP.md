# LLM Tests Setup Guide

This guide explains how to set up and run the LLM (Large Language Model) integration tests for MQTT Explorer.

## Quick Start

### For GitHub Copilot / CI Environment

If you're running in a GitHub environment with injected secrets:

```bash
# 1. Create .env file from injected secrets
./scripts/setup-llm-env.sh

# 2. Source the environment file
source .env.llm-tests

# 3. Run the tests
./scripts/run-llm-tests.sh
```

### For Local Development

If you're running locally with your own API key:

```bash
# 1. Copy the example environment file
cp .env.example .env.llm-tests

# 2. Edit .env.llm-tests and add your API key
# Replace 'sk-your-openai-api-key-here' with your actual key

# 3. Source the environment file
source .env.llm-tests

# 4. Run the tests
./scripts/run-llm-tests.sh
```

## Environment Variables

### Required

- `OPENAI_API_KEY` - Your OpenAI API key (starts with `sk-`)
  - OR `GEMINI_API_KEY` - Your Google Gemini API key
  - OR `LLM_API_KEY` - Generic API key (requires `LLM_PROVIDER` to be set)
- `RUN_LLM_TESTS=true` - Flag to enable live LLM tests

### Optional

- `LLM_PROVIDER` - Set to `openai` or `gemini` (auto-detected from API key)
- `LLM_NEIGHBORING_TOPICS_TOKEN_LIMIT` - Token limit for context (default: 500)

## Getting API Keys

### OpenAI (Recommended for Development)

1. Visit https://platform.openai.com/api-keys
2. Create an account or sign in
3. Click "Create new secret key"
4. Copy the key (starts with `sk-`)
5. Add billing information (required for API access)

**Cost:** ~$0.01-$0.05 per test run (~11 API calls)

### Google Gemini

1. Visit https://ai.google.dev/
2. Sign in with your Google account
3. Get an API key from Google AI Studio
4. Copy the API key

**Cost:** Free tier available, then pay-as-you-go

## Security Notes

⚠️ **IMPORTANT:**
- Never commit `.env.llm-tests` to version control
- The `.gitignore` file already excludes `.env*` files
- The `.env.llm-tests` file has restricted permissions (600)
- API keys are never logged in error messages

## Troubleshooting

### "No API key found"

**Problem:** The setup script can't find an API key.

**Solutions:**
1. If in CI/GitHub: Ensure the `OPENAI_API_KEY` secret is configured in GitHub
2. If local: Create `.env.llm-tests` manually and add your API key
3. Verify the environment variable is exported: `echo $OPENAI_API_KEY`

### "Tests are skipped"

**Problem:** Tests show as "pending" instead of running.

**Solutions:**
1. Make sure you sourced the `.env` file: `source .env.llm-tests`
2. Verify `RUN_LLM_TESTS=true` is set: `echo $RUN_LLM_TESTS`
3. Check that the API key is in the environment: `echo ${OPENAI_API_KEY:0:10}...`

### "API call failed"

**Problem:** Tests fail with API errors.

**Solutions:**
1. Check your API key is valid
2. Verify you have billing set up (OpenAI requires it)
3. Check for rate limits (wait a few minutes and try again)
4. Ensure you have internet access

### "Permission denied"

**Problem:** Can't execute scripts.

**Solution:**
```bash
chmod +x scripts/setup-llm-env.sh
chmod +x scripts/run-llm-tests.sh
```

## Manual Testing

You can also run tests manually without the scripts:

```bash
# Source the environment
source .env.llm-tests

# Run all tests (LLM tests will be included)
cd app && yarn test

# Or run with environment variables inline
RUN_LLM_TESTS=true OPENAI_API_KEY=sk-your-key yarn test:app
```

## Cost Management

The LLM tests make real API calls and incur costs:

- **Per run:** ~$0.01-$0.05 (11 API calls)
- **Recommended:** Run manually or on schedule (not on every commit)
- **Models used:**
  - OpenAI: `gpt-4o-mini` (cheapest GPT-4 variant)
  - Gemini: `gemini-1.5-flash-latest` (fast and cost-effective)

### Cost-Saving Tips

1. Run tests only when needed (not on every commit)
2. Use a separate API key for testing (easier to track costs)
3. Set up billing alerts in your API provider console
4. Consider running only on main branch or release tags

## CI/CD Integration

### GitHub Actions

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
          
      - name: Setup LLM environment
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: ./scripts/setup-llm-env.sh
          
      - name: Run LLM Integration Tests
        run: |
          source .env.llm-tests
          ./scripts/run-llm-tests.sh
```

## Files

- `.env.example` - Example environment file (safe to commit)
- `.env.llm-tests` - Your actual environment file (DO NOT COMMIT)
- `scripts/setup-llm-env.sh` - Creates `.env.llm-tests` from environment
- `scripts/run-llm-tests.sh` - Runs the LLM integration tests
- `scripts/validate-llm-test-setup.sh` - Validates setup without API calls

## Further Reading

- [LLM Test Improvements](../LLM_TEST_IMPROVEMENTS.md) - Detailed change log
- [LLM Testing Strategy](../app/src/services/spec/README.md) - Test documentation
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Gemini API Documentation](https://ai.google.dev/docs)

## Support

For issues or questions:
1. Check this README first
2. Run the validation script: `./scripts/validate-llm-test-setup.sh`
3. Check the test documentation: `app/src/services/spec/README.md`
4. Review logs for specific error messages
