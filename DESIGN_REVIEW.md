# LLM Code Refactoring - Design Review

## Current Situation

We have LLM API logic duplicated in three places:
1. **Server** (`src/server.ts`) - Handles RPC calls from frontend, ~200 lines of Gemini/OpenAI code
2. **Frontend Tests** (`app/src/services/spec/llmIntegration.spec.ts`) - Direct API calls for testing
3. **Frontend Service** (`app/src/services/llmService.ts`) - Uses RPC to call backend

## Problem

Code duplication violates DRY principle and creates maintenance burden:
- Changes to API parameters need to be made in multiple places
- Risk of configuration drift between server and tests
- Currently: Server uses OpenAI SDK, tests use axios - inconsistent

## Proposed Solution (Current)

Created `LLMApiClient` class and tried to use it in both places:
```
app/src/services/llmApiClient.ts (frontend)
backend/src/llmApiClient.ts (copy for backend)
```

## Design Issues to Consider

### 1. Code Location & Architecture

**Option A: Shared Module (Monorepo)**
```
shared/
  llmApiClient.ts  <- Single source of truth
server/
  server.ts        <- imports from ../shared
app/
  tests/           <- imports from ../../shared
```
✅ Pros: True single source, no duplication
❌ Cons: Need new directory structure, may not fit existing architecture

**Option B: Backend-Only Client**
```
backend/src/
  llmApiClient.ts  <- Single source
src/
  server.ts        <- imports from ../backend/src
app/src/services/spec/
  tests            <- imports from ../../../backend/src
```
✅ Pros: Fits existing structure, backend owns API logic
❌ Cons: Frontend tests importing from backend (architectural oddness)

**Option C: Keep Current Duplication**
```
Keep server logic in server.ts (200 lines)
Keep test logic in tests (100 lines)
Accept duplication as architectural boundary
```
✅ Pros: Clear separation of concerns
❌ Cons: Violates DRY, maintenance burden

### 2. What Are We Actually Testing?

**Current tests** (`llmIntegration.spec.ts`):
- Test LLM API behavior (Gemini/OpenAI responses)
- Test proposal extraction from responses
- Test system-specific patterns (zigbee2mqtt, Home Assistant)

**Question: Should these be backend tests or frontend tests?**

- **Backend tests**: Yes - they test API integration
- **Frontend tests**: No - frontend doesn't call API directly, it uses RPC

**Better architecture:**
```
backend/test/
  llmApiClient.spec.ts    <- Test API client
  llmIntegration.spec.ts  <- Test LLM behavior
  
app/src/services/spec/
  llmService.spec.ts      <- Mock RPC, test frontend logic only
```

### 3. Dependencies

**Current:**
- Server: Uses `openai` SDK (type-safe) + `axios` for Gemini
- Tests: Uses `axios` for both

**Issue:** Mixing approaches creates inconsistency

**Options:**
1. Use `axios` everywhere (current LLMApiClient approach)
2. Use OpenAI SDK for OpenAI, axios for Gemini (current server)
3. Abstract over both

### 4. What Frontend Logic Actually Needs Testing?

Looking at `llmService.ts`, the frontend:
- Formats topic context
- Manages conversation history
- Parses proposals from responses
- Generates suggested questions

**These can be tested WITHOUT making real API calls:**
```typescript
// Mock the RPC layer
const mockRpc = {
  call: async () => ({ response: 'mocked response', debugInfo: {} })
}

// Test the frontend logic
const service = new LLMService()
const result = await service.sendMessage('test', mockRpc)
// Assert on result
```

## Recommendation

### Phase 1: Immediate (No Duplication)
1. **Move `LLMApiClient` to backend only**: `backend/src/llmApiClient.ts`
2. **Server uses client**: Refactor `src/server.ts` to use `LLMApiClient`
3. **Move integration tests to backend**: `backend/test/llmIntegration.spec.ts`
4. **Frontend tests mock RPC**: Test frontend logic, not API

**Result:**
```
backend/src/
  llmApiClient.ts          <- Single source of API logic

backend/test/
  llmIntegration.spec.ts   <- Tests LLM API behavior (imports client)

src/
  server.ts                <- Uses LLMApiClient (imports from ../backend)

app/src/services/
  llmService.ts            <- Frontend logic (uses RPC)
  spec/
    llmService.spec.ts     <- Tests with mocked RPC
```

### Phase 2: Future (If Needed)
- Extract to `shared/` directory if codebase grows
- Consider publishing as internal package if used by other services

## Questions to Answer

1. **Is frontend code allowed to import from backend?**
   - In this monorepo: Probably yes
   - In separate repos: No, need shared package

2. **Are current "frontend tests" actually integration tests?**
   - Yes - they test LLM API, not frontend UI logic
   - Should move to backend test suite

3. **Do we need real API calls in frontend tests?**
   - No - frontend should only test its own logic
   - API integration is backend's responsibility

## Verdict

**Recommended approach: Option B (Backend-Only Client)**

**Why:**
- ✅ Zero code duplication
- ✅ Single source of truth for API logic
- ✅ Clear ownership (backend owns API calls)
- ✅ Tests live with the code they test
- ✅ Frontend tests stay focused on frontend logic
- ✅ Fits existing directory structure

**Trade-off:**
- Frontend tests import from backend (acceptable in monorepo)
- OR: Move tests to backend (better separation)

**Next steps:**
1. Confirm this design is acceptable
2. Proceed with refactoring
3. Move tests to appropriate location
