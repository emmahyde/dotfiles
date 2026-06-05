# Browser Automation Skill

Best practices for using browser automation MCP tools (chrome-dev-navigator, puppeteer, playwright, etc.)

## Output Filtering Rules

### evaluate_script
Always filter output aggressively. Never return raw error objects or full data structures.

```javascript
// BAD - returns massive stack traces
} catch (e) {
  return { error: e };
}

// GOOD - concise error info
} catch (e) {
  return { error: e.message, name: e.name };
}
```

```javascript
// BAD - returns entire cache
const data = cache.extract();
return data;

// GOOD - return only what you need
const data = cache.extract();
return {
  relevantKeys: Object.keys(data).filter(k => k.includes('feature')).slice(0, 10),
  hasData: Object.keys(data).length > 0
};
```

### take_snapshot
- Use `verbose: false` (default) unless you specifically need full a11y tree details
- Use `filePath` parameter to save large snapshots to disk instead of inline
- When searching for elements, note the `uid` for later interaction

### list_console_messages
- Always filter by `types` when looking for specific issues: `["error"]`, `["warn"]`, `["log"]`
- Use `pageSize` to limit results (default returns all)
- Use `includePreservedMessages: true` only when debugging across navigations

### list_network_requests
- Filter by `resourceTypes`: `["fetch", "xhr"]` for API calls, `["document"]` for page loads
- Use `pageSize` to limit results
- Use `includePreservedRequests: true` only when debugging across navigations

### get_network_request
- Use `responseFilePath` to save large response bodies to disk
- Use `requestFilePath` for large request bodies

## Efficient Patterns

### Finding elements
```javascript
// Take snapshot first, note uids, then interact
// Don't repeatedly snapshot - cache the uid mapping mentally
```

### Debugging React apps
```javascript
// Look for __APOLLO_CLIENT__ for GraphQL state
// Look for __REACT_DEVTOOLS_GLOBAL_HOOK__ to confirm React
// Feature flags often in module-level state, not easily accessible
```

### Checking API responses
```javascript
// Use list_network_requests with resourceTypes: ["fetch", "xhr"]
// Then get_network_request for specific reqid
// Filter response in JS if checking specific fields
```

### Form interaction
- Use `fill_form` for multiple fields at once instead of multiple `fill` calls
- Use `includeSnapshot: true` on the final action to verify state

## Common Mistakes to Avoid

1. **Returning full error objects** - Stack traces can be 200+ lines
2. **Not filtering object keys** - Apollo cache can have thousands of entries
3. **Repeated snapshots** - Take once, reference uids
4. **Not using pagination** - Console/network lists can be huge
5. **Verbose snapshots by default** - Only when needed
6. **Synchronous waits** - Use `wait_for` with text instead of arbitrary delays

## Response Size Guidelines

Target response sizes:
- evaluate_script: < 50 lines ideally, < 200 max
- take_snapshot: Use non-verbose unless debugging a11y
- network/console lists: Use pageSize of 10-20 for exploration

When in doubt, return counts and summaries first, then drill down.
