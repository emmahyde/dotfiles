# Claude Code Global Hooks

This directory contains global hooks that apply to all Claude Code sessions.

## Active Hooks

### enforce-explicit-subagent-model.py

**Type:** PreToolUse hook
**Matcher:** Task tool
**Purpose:** Enforces explicit model selection for all subagent launches

#### What it does

This hook blocks any Task tool call (subagent launch) that doesn't explicitly specify a model parameter. It ensures that every subagent must explicitly choose between:

- `haiku` - Fast, cost-effective model for simple tasks
- `sonnet` - Balanced performance for most tasks
- `opus` - Most capable model for complex reasoning

#### Why this matters

Without this enforcement, subagents might use implicit/default models, which can lead to:
- Unexpected costs (accidentally using opus when haiku would suffice)
- Performance issues (using haiku for complex tasks that need opus)
- Lack of intentionality in model selection
- Difficulty tracking which models are being used where

#### Configuration

The hook is registered in `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Task",
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/hooks/enforce-explicit-subagent-model.py"
          }
        ]
      }
    ]
  }
}
```

#### Examples

**Blocked (no model):**
```json
{
  "tool_name": "Task",
  "tool_input": {
    "subject": "Analyze code",
    "description": "Review this file"
  }
}
```

**Blocked (invalid model):**
```json
{
  "tool_name": "Task",
  "tool_input": {
    "subject": "Analyze code",
    "description": "Review this file",
    "model": "gpt-4"
  }
}
```

**Allowed (valid model):**
```json
{
  "tool_name": "Task",
  "tool_input": {
    "subject": "Analyze code",
    "description": "Review this file",
    "model": "sonnet"
  }
}
```

#### Testing

You can test the hook manually:

```bash
# Test with missing model (should block)
cat > /tmp/test-no-model.json << 'EOF'
{
  "session_id": "test",
  "transcript_path": "/tmp/test",
  "cwd": "/tmp",
  "hook_event_name": "PreToolUse",
  "tool_name": "Task",
  "tool_input": {
    "subject": "Test",
    "description": "Test task"
  }
}
EOF
~/.claude/hooks/enforce-explicit-subagent-model.py < /tmp/test-no-model.json

# Test with valid model (should allow)
cat > /tmp/test-with-model.json << 'EOF'
{
  "session_id": "test",
  "transcript_path": "/tmp/test",
  "cwd": "/tmp",
  "hook_event_name": "PreToolUse",
  "tool_name": "Task",
  "tool_input": {
    "subject": "Test",
    "description": "Test task",
    "model": "sonnet"
  }
}
EOF
~/.claude/hooks/enforce-explicit-subagent-model.py < /tmp/test-with-model.json
```

#### Disabling the hook

To temporarily disable this hook, edit `~/.claude/settings.json` and remove or comment out the hooks section.

## Hook Development Guidelines

When creating new hooks:

1. **Security:** Always validate input and handle errors gracefully
2. **Performance:** Keep hooks fast - they run on every matching tool call
3. **Documentation:** Document what the hook does and why it exists
4. **Testing:** Test both success and failure cases
5. **Exit codes:**
   - `0` = Allow (with or without JSON output)
   - `1` = Error
   - `2` = Block with stderr shown to Claude (deprecated for PreToolUse)
6. **JSON output:** Use `hookSpecificOutput` for event-specific control

## References

- [Claude Code Hooks Documentation](https://code.claude.com/docs/claude-code/hooks)
- [Hook Examples](https://github.com/anthropics/claude-code/tree/main/examples/hooks)
