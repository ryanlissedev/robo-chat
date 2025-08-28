# Manual Testing Guide: Reasoning Models and Tool Calling

## Test Cases

### 1. Test GPT-5 Models with Reasoning Effort

#### GPT-5-mini
1. Open http://localhost:3000
2. Select "GPT-5 Mini" model from the model selector
3. **Expected**: Reasoning effort button should be visible
4. Test different reasoning levels:
   - Set to "low" - Send "What is 2+2?"
   - Set to "medium" - Send "Explain quantum computing"
   - Set to "high" - Send "Design a distributed system for real-time data processing"

#### GPT-5 (full model)
1. Select "GPT-5" model
2. **Expected**: Reasoning effort button should be visible
3. Verify all reasoning levels work

### 2. Test GPT-4o Models with Reasoning

#### GPT-4o-mini
1. Select "GPT-4o Mini" model
2. **Expected**: Reasoning effort button should be visible
3. Test reasoning levels work correctly

### 3. Test Non-Reasoning Models

#### GPT-4.1
1. Select "GPT-4.1" model
2. **Expected**: Reasoning effort button should NOT be visible
3. Verify model works without reasoning effort

### 4. Test File Search Tool Calling

#### Upload Test File
1. Create a test document with sample content about RoboRail safety procedures
2. Upload the file using the file upload button
3. Ask: "What safety equipment is needed according to the uploaded document?"

#### Expected Behavior:
- Tool calling should be visible in the UI (if preferences.showToolInvocations is true)
- Should see "fileSearch" tool being invoked
- Tool should return results
- Assistant should provide an answer based on the search results
- Should NOT say "I cannot answer" or attempt to hand off to another model

### 5. Test Tool Response Flow

1. With a file uploaded, ask a question that requires file search
2. **Verify**:
   - Tool invocation card appears showing:
     - Tool name: "fileSearch"
     - Input parameters (query)
     - Output results (document snippets)
   - Assistant message includes the answer based on tool results
   - Sources section shows retrieved documents

## Verification Checklist

- [ ] GPT-5 models show reasoning effort selector
- [ ] GPT-4o models with reasoning show selector
- [ ] Non-reasoning models do NOT show selector
- [ ] File search tool invocation is visible
- [ ] Tool returns proper results (not errors)
- [ ] Assistant provides answers based on tool results
- [ ] Sources are displayed when documents are retrieved

## Common Issues to Watch For

1. **Reasoning button missing**: Check model has `reasoningText: true` in config
2. **Tool not visible**: Check preferences.showToolInvocations setting
3. **Tool errors**: Check retrieval system message doesn't restrict responses
4. **No response after tool**: Verify system prompt allows answering

## Test Data

### Sample Safety Document Content
```
RoboRail Safety Equipment Requirements:
- Hard hat (ANSI Z89.1 compliant)
- Safety glasses with side shields
- Steel-toed boots (ASTM F2413 rated)
- High-visibility vest
- Cut-resistant gloves (Level 3 or higher)
- Hearing protection (when noise exceeds 85 dB)
```