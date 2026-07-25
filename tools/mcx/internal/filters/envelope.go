package filters

import (
	"bytes"
	"encoding/json"
)

// reshapeToolResponse applies m to a PostToolUse tool_response in whatever shape
// Claude Code delivers it. For an MCP tool the real shape (verified against a live
// 2.1.x payload) is a bare array of content blocks — [{"type":"text","text":
// "<json>"}]. A {"content":[…]} CallToolResult envelope and a bare JSON string are
// also handled, defensively, in case the shape differs by version or tool. It
// mutates array/map shapes in place and returns the value to hand back as
// updatedToolOutput (the same shape it received) plus whether anything changed.
func reshapeToolResponse(resp any, m Filter) (any, bool) {
	switch v := resp.(type) {
	case []any:
		return v, applyToBlocks(v, m)
	case map[string]any:
		if blocks, ok := v["content"].([]any); ok {
			return v, applyToBlocks(blocks, m)
		}
		return v, false
	case string:
		return applyToText(v, m)
	default:
		return resp, false
	}
}

// ApplyToEnvelope reshapes the JSON payload inside the content blocks of a
// {"content":[…]} CallToolResult envelope, mutating resp in place; every other
// field (isError, structuredContent, _meta, non-text blocks) is preserved. It
// returns true if any text block was reshaped. Kept for the map-shaped
// tool_response path and its direct tests; reshapeToolResponse is the entry point.
func ApplyToEnvelope(resp map[string]any, m Filter) bool {
	blocks, ok := resp["content"].([]any)
	if !ok {
		return false
	}
	return applyToBlocks(blocks, m)
}

// applyToBlocks reshapes the JSON payload inside every text block of an MCP
// content-block array, mutating blocks in place. A block whose text is not valid
// JSON is left as-is (never an error, so callers fail open). Returns true if any
// block changed.
func applyToBlocks(blocks []any, m Filter) bool {
	changed := false
	for _, item := range blocks {
		block, ok := item.(map[string]any)
		if !ok || block["type"] != "text" {
			continue
		}
		text, ok := block["text"].(string)
		if !ok {
			continue
		}
		out, ok := applyToText(text, m)
		if !ok {
			continue
		}
		block["text"] = out
		changed = true
	}
	return changed
}

// applyToText reshapes one JSON string. It canonicalizes before transforming so a
// filter that matches nothing reports unchanged rather than re-emitting. Non-JSON
// text or a no-op filter returns the input unchanged with false.
func applyToText(text string, m Filter) (string, bool) {
	var payload any
	if err := json.Unmarshal([]byte(text), &payload); err != nil {
		return text, false
	}
	before, err := json.Marshal(payload)
	if err != nil {
		return text, false
	}
	reshaped := m.Apply(payload)
	if original, ok := payload.(map[string]any); ok && len(original) > 0 {
		if result, ok := reshaped.(map[string]any); ok && len(result) == 0 {
			return text, false
		}
	}
	after, err := json.Marshal(reshaped)
	if err != nil {
		return text, false
	}
	if bytes.Equal(before, after) {
		return text, false
	}
	return string(after), true
}
