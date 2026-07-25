package filters

import "encoding/json"

type hookOutput struct {
	HookSpecificOutput hookSpecific `json:"hookSpecificOutput"`
}

type hookSpecific struct {
	HookEventName     string `json:"hookEventName"`
	UpdatedToolOutput any    `json:"updatedToolOutput"`
}

// Run reads a PostToolUse hook payload and returns the JSON to write to stdout
// plus whether to write it. It is fail-open by construction: any condition that
// isn't an unambiguous, applied reshape returns emit=false (the caller then
// exits 0 with no output, leaving the original tool result untouched). It never
// returns a partial or empty updatedToolOutput.
func Run(input []byte, cfg Config) (out []byte, emit bool) {
	var payload map[string]any
	if err := json.Unmarshal(input, &payload); err != nil {
		return nil, false
	}
	toolName, _ := payload["tool_name"].(string)
	if toolName == "" {
		return nil, false
	}
	mod, ok := cfg[toolName]
	if !ok {
		return nil, false
	}
	resp, ok := payload["tool_response"]
	if !ok {
		return nil, false
	}
	updated, changed := reshapeToolResponse(resp, mod)
	if !changed {
		return nil, false
	}
	out, err := json.Marshal(hookOutput{
		HookSpecificOutput: hookSpecific{
			HookEventName:     "PostToolUse",
			UpdatedToolOutput: updated,
		},
	})
	if err != nil {
		return nil, false
	}
	return out, true
}
