# Tool Calling Implementation for MQTT Explorer LLM

## Overview

Implemented Model Context Protocol (MCP) style tool calling to allow the LLM to query MQTT topic information from the frontend.

## Tools Implemented

### 1. query_topic_history
Get recent message history for a specific MQTT topic.

**Parameters:**
- `topic` (required): The MQTT topic path to query
- `limit` (optional): Maximum number of messages to return (default 10, max 20)

**Use case:** View historical values to understand patterns and trends in data

### 2. get_topic  
Get detailed information about a specific MQTT topic.

**Parameters:**
- `topic` (required): The MQTT topic path to query

**Use case:** Get current value, message count, and metadata for a topic

### 3. list_children
List all child topics (sub-topics) under a given MQTT topic path.

**Parameters:**
- `topic` (required): The parent MQTT topic path (use empty string for root)
- `limit` (optional): Maximum number of children to return (default 20, max 50)

**Use case:** Explore topic hierarchy and discover related topics

### 4. list_parents
Get the parent topic path hierarchy for a given MQTT topic.

**Parameters:**
- `topic` (required): The MQTT topic path to get parents for

**Use case:** Understand topic tree structure from root to specified topic

## Architecture

### Backend (Server)
1. **Tool Definitions** - Four tools defined in `src/server.ts`
2. **LLM API Client** - Enhanced to support OpenAI function calling
3. **RPC Handler** - Accepts tool results and returns tool calls

### Flow
```
1. Frontend → Backend: Send user message
2. Backend → OpenAI: Request with tools defined
3. OpenAI → Backend: Response with tool_calls (if needed)
4. Backend → Frontend: Return tool_calls
5. Frontend: Execute tools against local topic tree
6. Frontend → Backend: Send tool results
7. Backend → OpenAI: Continue conversation with tool results
8. OpenAI → Backend: Final response with context
9. Backend → Frontend: Return final answer
```

## Implementation Status

### ✅ Completed
- RPC types updated (EventsV2.ts)
- LLMApiClient supports tools (backend/src/llmApiClient.ts)
- Server defines 4 tools (src/server.ts)
- Server accepts toolResults parameter
- Server returns toolCalls in response
- Build succeeds

### 📋 To Do - Frontend Implementation
1. Update `llmService.ts` to:
   - Handle `toolCalls` in RPC response
   - Implement tool execution methods:
     - `queryTopicHistory(topic, limit)` - with 200 token limit
     - `getTopic(topic)`
     - `listChildren(topic, limit)`  
     - `listParents(topic)`
   - Send tool results back to backend for completion

2. Token Limiting:
   - All tool responses must be limited to 200 tokens max
   - Use `estimateTokens` and `truncateToTokenLimit` methods
   - Ensure concise, useful information in responses

## Token Limits

To prevent context overflow:
- **topic_history**: 200 tokens max
- **get_topic**: 200 tokens max  
- **list_children**: 200 tokens max
- **list_parents**: 100 tokens max (simpler output)

## Example Tool Usage

### Query Topic History
```typescript
LLM: I need to see the historical values
Tool Call: query_topic_history("zigbee2mqtt/bedroom/lamp", 10)
Frontend: Returns last 10 messages, limited to 200 tokens
LLM: Based on the history, I can see the lamp toggles frequently
```

### Explore Hierarchy
```typescript
LLM: What topics are under zigbee2mqtt?
Tool Call: list_children("zigbee2mqtt", 20)
Frontend: Returns child topics list
LLM: I see devices: bedroom/lamp, kitchen/switch, etc.
```

## Benefits

1. **Better Context**: LLM can query actual data instead of relying on partial context
2. **Discovery**: LLM can explore topic tree to find related devices
3. **Pattern Analysis**: Historical data helps identify trends
4. **Informed Decisions**: Tool calls provide data for better suggestions

## Testing Plan

1. Test tool call generation by LLM
2. Test each tool execution in frontend
3. Test 200 token limit enforcement
4. Test multi-turn conversation with tools
5. Test error handling (topic not found, etc.)

## Security Considerations

- Tools only query read-only data (no modifications)
- Topic paths validated before access
- Token limits prevent excessive data transfer
- All execution happens in frontend (no backend access to topics)
