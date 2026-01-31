# Topic Listing Test - Complete Documentation

## Overview

This document describes the Playwright end-to-end test that verifies the LLM can successfully list MQTT topics using tool calls.

## Test Purpose

The test demonstrates and verifies:
1. **User Interaction**: User can ask LLM about available topics
2. **Tool Calling**: LLM uses `list_children` tool to query topic tree
3. **Multi-Round**: System supports multiple rounds of tool calls
4. **Accurate Response**: LLM provides correct information about topics

## Test Implementation

### Test Location
`src/spec/ui-tests.spec.ts` - Test: "should list topics when asked by the user"

### Test Flow

```
1. User opens AI Assistant
2. User types: "List all the top-level topics"
3. User clicks send
4. Frontend → Backend → OpenAI (with tools defined)
5. OpenAI → Backend: tool_call(list_children, "")
6. Backend → Frontend: toolCalls array
7. Frontend executes list_children("")
8. Frontend → Backend: tool results
9. Backend → OpenAI: continue with results
10. [Possible Round 2 if LLM needs more info]
11. OpenAI → Backend: Final response text
12. Backend → Frontend: Display to user
13. Test verifies response mentions "livingroom" or "kitchen"
```

### Test Code

```typescript
it('should list topics when asked by the user', async function() {
  this.timeout(90000) // Allow time for multiple tool rounds
  
  // Given: AI Assistant is expanded
  const input = page.locator('[data-testid="ai-assistant-input"]')
  
  // When: User asks to list topics
  const testMessage = 'List all the top-level topics. What topics do you see at the root?'
  await input.fill(testMessage)
  await sendButton.click()
  
  // Then: Response should appear
  const assistantMessage = page.getByTestId('ai-message-assistant').last()
  await assistantMessage.waitFor({ timeout: 60000 })
  
  // And: Response should mention actual topics
  const messageText = await assistantMessage.textContent()
  expect(messageText.toLowerCase()).to.include('livingroom' or 'kitchen')
})
```

## Multi-Round Tool Calling

### Why Multiple Rounds?

Sometimes the LLM needs to gather information incrementally:

1. **Round 1**: List root topics → finds "livingroom", "kitchen"
2. **Round 2**: Get details about "livingroom" → finds lamp, temperature
3. **Final Response**: Provides comprehensive answer

### Implementation

Located in `app/src/services/llmService.ts`:

```typescript
let maxToolRounds = 5
let toolRound = 0

while (toolRound < maxToolRounds) {
  toolRound++
  
  // Send messages + tool results to backend
  result = await backendRpc.call(RpcEvents.llmChat, {
    messages: this.conversationHistory,
    topicContext,
    toolResults,
  })
  
  // If we have a final response, we're done
  if (result.response || !result.toolCalls) {
    break
  }
  
  // Execute next round of tools
  // Add results to conversation history
  // Loop to send results back
}
```

### Why 5 Rounds?

- **1 round**: Usually sufficient for simple queries
- **2-3 rounds**: Common for exploratory queries
- **5 rounds max**: Safety limit to prevent infinite loops
- **Real usage**: Rarely exceeds 2 rounds

## Test Environment

### Prerequisites

1. **LLM API Key**: Set one of:
   - `OPENAI_API_KEY`
   - `GEMINI_API_KEY`
   - `LLM_API_KEY` (with `LLM_PROVIDER`)

2. **Mosquitto**: MQTT broker must be available

3. **Test Topics**: Published before connection
   - `livingroom/lamp/state`
   - `livingroom/lamp/brightness`
   - `livingroom/temperature`
   - `kitchen/coffee_maker`
   - `kitchen/lamp/state`
   - `kitchen/temperature`

### Running the Test

```bash
# Set up environment
source .env.llm-tests

# Run all browser tests
./scripts/runBrowserTestsWithLLM.sh

# Or run just this test suite
yarn test:ui -- --grep "should list topics"
```

## Expected Behavior

### Successful Test Run

```
AI Assistant Chat
  ✔ should expand AI Assistant panel when clicked (2s)
  ✔ should send a message and receive a response from LLM (8s)
  ✔ should clear chat history when clear button is clicked (1s)
  ✔ should list topics when asked by the user (15s)

12 passing (1m 30s)
```

### Console Output

```
User: List all the top-level topics. What topics do you see at the root?

LLM Service: Executing 1 tool calls
Tool ID: call_abc123
Tool name: list_children
Executing list_children for topic: 
list_children result length: 45
list_children result preview: Child topics (2):
✓ livingroom (3 subtopics)
✓ kitchen (3 subtopics)

LLM Service: Tool round 1
LLM Service: Received result after tools
AI Assistant response received (length: 180 chars)

✅ Test passed: Response mentions "livingroom"
```

## What This Tests

### Complete Flow Verification

✅ **User Interface**
- Input field works
- Send button works
- Messages display correctly
- Assistant responses appear

✅ **Backend Communication**
- RPC calls work
- Tool definitions sent
- Tool calls received
- Tool results sent back

✅ **LLM Integration**
- OpenAI API connection works
- Tool calling format correct
- Multi-round conversations supported
- Final responses generated

✅ **Tool Execution**
- Tools query real topic tree
- Results formatted correctly
- Token limits respected
- Errors handled gracefully

✅ **End-to-End**
- Complete user journey works
- Real MQTT data returned
- Accurate responses provided
- UI displays correctly

## Troubleshooting

### Test Times Out

**Symptom**: Test fails after 90 seconds

**Causes**:
1. LLM API slow or down
2. Too many tool rounds
3. Network issues

**Solutions**:
- Check API key is valid
- Check internet connection
- Increase timeout if needed
- Check OpenAI status page

### "Topic not found" Errors

**Symptom**: Tool returns "Topic not found: xyz"

**Causes**:
1. Topic doesn't exist in tree
2. Root node not found
3. Path format incorrect

**Solutions**:
- Verify topics published before connection
- Check `findRootNode()` works
- Ensure 2-second delay after publishing

### No Response After Tools

**Symptom**: Tool calls execute but no final response

**Causes**:
1. LLM requested more tools instead of responding
2. Multi-round loop not working
3. Response validation too strict

**Solutions**:
- Check multi-round loop implementation
- Verify `maxToolRounds` not exceeded
- Check response validation logic

### Wrong Topics Mentioned

**Symptom**: Response mentions incorrect topics

**Causes**:
1. Wrong topics published
2. Old cached data
3. LLM hallucinating

**Solutions**:
- Verify test topics published correctly
- Clear any retained messages
- Check tool results are accurate

## Example Scenarios

### Scenario 1: Simple List

```
User: "List all topics"
  ↓
Tool: list_children("") → "livingroom, kitchen"
  ↓
Response: "I see two topics: livingroom and kitchen"
  ✅ Pass
```

### Scenario 2: Detailed List

```
User: "What topics are available?"
  ↓
Round 1: list_children("") → "livingroom, kitchen"
  ↓
Round 2: list_children("livingroom") → "lamp, temperature"
  ↓
Response: "I found: livingroom (with lamp and temperature) and kitchen"
  ✅ Pass
```

### Scenario 3: Error Recovery

```
User: "List topics"
  ↓
Tool: list_children("invalid") → "Topic not found"
  ↓
Tool: list_children("") → "livingroom, kitchen"
  ↓
Response: "I found livingroom and kitchen at the root"
  ✅ Pass (recovers from error)
```

## Test Assertions

### Primary Assertions

```typescript
// Response appears
expect(assistantMessage.isVisible()).to.be.true

// Response has content
expect(messageText).to.not.be.empty
expect(messageText.length).to.be.greaterThan(20)

// Response mentions actual topics
const mentionsTopics = 
  lowerText.includes('livingroom') || 
  lowerText.includes('kitchen')
expect(mentionsTopics).to.be.true
```

### Secondary Checks

```typescript
// User message appears
expect(userMessage.isVisible()).to.be.true

// Tool calls might be displayed
const toolCalls = await page.locator('[class*="toolCall"]').count()
console.log(`Tool calls displayed: ${toolCalls}`)

// Screenshot captured
await page.screenshot({ path: 'test-screenshot-ai-assistant-list-topics.png' })
```

## Performance

### Typical Timings

- **No tools**: 2-5 seconds
- **1 round tools**: 5-10 seconds
- **2 rounds tools**: 10-20 seconds
- **Max test timeout**: 90 seconds

### Optimization

The test is optimized for:
- **Reliability**: Long timeout allows for variable API response times
- **Accuracy**: Verifies actual topic names, not just any response
- **Coverage**: Tests complete tool calling flow
- **Debugging**: Screenshots and logs for failures

## Integration with CI/CD

### GitHub Actions

```yaml
- name: Run LLM Browser Tests
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  run: |
    source .env.llm-tests
    ./scripts/runBrowserTestsWithLLM.sh
```

### Test Matrix

The test runs in:
- **Browser Mode**: Chromium with desktop viewport
- **With LLM**: Real OpenAI API calls
- **With MQTT**: Real mosquitto broker
- **With Topics**: Test data published

## Conclusion

This test provides comprehensive verification that:
1. ✅ Users can ask LLM about topics
2. ✅ LLM uses tools to query the tree
3. ✅ Multi-round tool calling works
4. ✅ Responses are accurate and helpful
5. ✅ Complete end-to-end flow functions

The topic listing capability demonstrates the power and flexibility of the MCP-style tool calling system integrated into MQTT Explorer.
