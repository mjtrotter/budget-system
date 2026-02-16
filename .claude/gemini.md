# Gemini CLI & Antigravity Integration Guide

> This file provides context for Gemini CLI (`gemini`) and Antigravity when working on this project.

## Project Context

This project uses the **Delegation Toolkit** - a simplified AI orchestration system that routes tasks to multiple executors:

- **Gemini CLI** (you): Primary code generation (1500/day quota)
- **Jules**: Complex multi-file refactors (15/day quota)
- **QwenAgent**: Local fallback, unlimited, good for data sifting
- **Perplexity**: Research only (via Chrome extension)

## Key Files to Read First

Before generating code, ALWAYS read these files:

```
.claude/settings.json      # MCP configuration, available tools
planning/STATUS.md         # Current project state, active tasks
src/README.md              # Architecture overview (if exists)
CLAUDE.md                  # Project-specific rules (if exists)
```

## Code Generation Guidelines

### Style & Patterns

1. **Follow existing patterns** - Read similar files in `src/` before writing new code
2. **Type hints required** - Python: type hints + docstrings; TypeScript: explicit types
3. **Error handling** - Wrap external calls in try/catch, return structured errors
4. **No hardcoded paths** - Use environment variables or config files

### Output Format

When generating code:

```python
# Python: Include module docstring
"""
Module description.

Usage:
    from module import function
    result = function(args)
"""

from typing import Optional
import os

def function(arg: str, optional: Optional[int] = None) -> dict:
    """Brief description.

    Args:
        arg: What this is
        optional: What this does

    Returns:
        dict with keys: success, result, error
    """
    try:
        # Implementation
        return {"success": True, "result": data}
    except Exception as e:
        return {"success": False, "error": str(e)}
```

```typescript
// TypeScript: Include JSDoc and explicit types
/**
 * Brief description.
 * @param arg - What this is
 * @returns Object with success and result
 */
export async function functionName(arg: string): Promise<{ success: boolean; result?: Data; error?: string }> {
  try {
    // Implementation
    return { success: true, result: data };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
```

## Project Structure

```
project/
├── .claude/
│   ├── settings.json       # MCP server config
│   ├── delegation/         # Delegation toolkit
│   │   ├── server.py       # FastMCP server (do not modify)
│   │   ├── executors/      # Executor implementations
│   │   └── quota.py        # Quota management
│   ├── skills/             # Reusable skill files
│   └── gemini.md           # This file
├── src/                    # Source code (your focus)
├── tests/                  # Test files
├── planning/
│   └── STATUS.md           # Current state
└── _scratch/               # Ephemeral coordination files
```

## What NOT to Modify

- `.claude/delegation/` - Core toolkit, managed separately
- `.claude/settings.json` - MCP configuration
- `planning/` files - Documentation, update through Claude Code

## Task Routing Hints

When you receive a task through `delegate_code`:

1. **Context files are provided** - Read them carefully, they contain real project code
2. **Output path is specified** - Write complete file, not snippets
3. **Preserve imports** - Check what's imported in context files
4. **Match testing patterns** - If context includes tests, follow their style

## Testing Requirements

All generated code should be testable:

```bash
# Python projects
pytest tests/ -v --tb=short

# TypeScript/Node projects
npm test
```

Write tests alongside implementation when the task involves new functionality.

## Communication Protocol

When generating code, provide:

1. **Brief summary** (1-2 lines) of what was implemented
2. **Files created/modified** list
3. **Dependencies added** (if any)
4. **Next steps** or integration notes

Example response format:

```
## Summary
Implemented user authentication middleware with JWT validation.

## Files
- src/middleware/auth.ts (created)
- src/types/auth.ts (created)

## Dependencies
- jsonwebtoken (add with: npm install jsonwebtoken @types/jsonwebtoken)

## Next Steps
- Add AUTH_SECRET to .env
- Import middleware in routes/index.ts
```

## Quota Awareness

You (Gemini CLI) have 1500 calls/day. For efficiency:

- **Batch related changes** into single responses
- **Include complete files** - avoid snippets that need follow-up
- **Ask clarifying questions upfront** if task is ambiguous

If quota runs low, tasks will route to QwenAgent (local, unlimited).
