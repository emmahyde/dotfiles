// Package filters applies declarative JSON reshaping to MCP tool results.
// It is pure data transformation — no code execution, no sandbox, no network.
package filters

import (
	"strings"
)

// Filter is the declarative reshaping applied to one tool's result payload.
// Operations run in a fixed order: keep, drop, rename, truncate (legacy) or transforms (new, exclusive).
// When transforms is non-empty, it runs exclusively and ignores keep/drop/rename/truncate.
// All paths are dotted (e.g. "fields.status.name"); wildcards are intentionally unsupported so
// every field a filter touches is explicit and auditable.
type Filter struct {
	Keep       []string          `json:"keep,omitempty"`
	Drop       []string          `json:"drop,omitempty"`
	Rename     map[string]string `json:"rename,omitempty"`
	Truncate   map[string]int    `json:"truncate,omitempty"`
	Transforms []Transform       `json:"transforms,omitempty"`
}

// Transform is a single step in the transforms pipeline (parse, project, or truncate).
type Transform struct {
	Type   string         `json:"type"`             // "parse", "project", "truncate"
	Field  string         `json:"field,omitempty"`  // for parse and truncate
	Format string         `json:"format,omitempty"` // for parse, e.g. "adf"
	Output string         `json:"output,omitempty"` // for parse, scratch key to store result
	Into   map[string]any `json:"into,omitempty"`   // for project, unmarshaled with custom logic
	Length int            `json:"length,omitempty"` // for truncate
	Suffix string         `json:"suffix,omitempty"` // for truncate
}

// ProjectValue represents a value in the Into map, which can be either a bare
// dotted path string or an object with source/op/default fields.
type ProjectValue struct {
	Source  string
	Op      string // e.g. "length"
	Default interface{}
}

// projectValueFrom builds a ProjectValue from an already-decoded Into value:
// a bare string is a source path, an object carries source/op/default.
func projectValueFrom(raw any) ProjectValue {
	switch v := raw.(type) {
	case string:
		return ProjectValue{Source: v}
	case map[string]any:
		pv := ProjectValue{Default: v["default"]}
		pv.Source, _ = v["source"].(string)
		pv.Op, _ = v["op"].(string)
		return pv
	}
	return ProjectValue{}
}

// Apply reshapes v in place and returns the result. v is the decoded inner JSON
// payload; a non-map value (JSON array or scalar) is returned untouched.
// When transforms is non-empty, it runs exclusively; otherwise keep/drop/rename/truncate apply.
func (m Filter) Apply(v any) any {
	if len(m.Transforms) > 0 {
		return m.applyTransforms(v)
	}

	if len(m.Keep) > 0 {
		if obj, ok := v.(map[string]any); ok {
			kept := map[string]any{}
			for _, p := range m.Keep {
				if val, found := getPath(obj, p); found {
					setPath(kept, p, val)
				}
			}
			v = kept
		}
	}
	obj, ok := v.(map[string]any)
	if !ok {
		return v
	}
	for _, p := range m.Drop {
		deletePath(obj, p)
	}
	for from, to := range m.Rename {
		if val, found := getPath(obj, from); found {
			deletePath(obj, from)
			setPath(obj, to, val)
		}
	}
	for p, n := range m.Truncate {
		if val, found := getPath(obj, p); found {
			if s, isStr := val.(string); isStr && n >= 0 && len(s) > n {
				setPath(obj, p, s[:n])
			}
		}
	}
	return obj
}

// applyTransforms runs the transforms pipeline on v, returning the final result.
// Fail-open: on any error, returns v unchanged.
func (m Filter) applyTransforms(v any) any {
	obj, ok := v.(map[string]any)
	if !ok {
		return v
	}

	scratch := map[string]any{}
	var pipeline any = obj
	for _, t := range m.Transforms {
		switch t.Type {
		case "parse":
			if t.Field == "" || t.Output == "" {
				return obj
			}
			if val, found := getPath(obj, t.Field); found && t.Format == "adf" {
				scratch[t.Output] = strings.Join(strings.Fields(adfText(val)), " ")
			}
		case "project":
			if len(t.Into) == 0 {
				return obj
			}
			newObj := map[string]any{}
			for key, rawVal := range t.Into {
				pv := projectValueFrom(rawVal)
				if val := m.lookupProjectValue(&pv, obj, scratch); val != nil {
					newObj[key] = val
				}
			}
			pipeline = newObj
		case "truncate":
			if t.Field == "" {
				return obj
			}
			if pipelineMap, ok := pipeline.(map[string]any); ok {
				if val, found := getPath(pipelineMap, t.Field); found {
					if s, isStr := val.(string); isStr && t.Length >= 0 {
						runes := []rune(s)
						if len(runes) > t.Length {
							truncated := string(runes[:t.Length]) + t.Suffix
							setPath(pipelineMap, t.Field, truncated)
						}
					}
				}
			}
		}
	}
	if pipelineMap, ok := pipeline.(map[string]any); ok {
		return pipelineMap
	}
	return obj
}

// lookupProjectValue resolves a ProjectValue by checking scratch first, then the original object.
func (m Filter) lookupProjectValue(pv *ProjectValue, original map[string]any, scratch map[string]any) any {
	if pv.Source == "" {
		return pv.Default
	}
	var val any
	// Check scratch map first (exact match)
	if v, found := scratch[pv.Source]; found {
		val = v
	} else {
		// Fall back to original object
		var found bool
		val, found = getPath(original, pv.Source)
		if !found {
			// If op is "length" and source is missing, return 0 for length of missing/nil
			if pv.Op == "length" {
				return 0
			}
			return pv.Default
		}
	}

	if pv.Op == "length" {
		if arr, ok := val.([]interface{}); ok {
			return len(arr)
		}
		// If val is not an array but op is length, treat nil/missing as 0
		return 0
	}
	return val
}

// adfText recursively extracts plain text from Atlassian Document Format nodes.
func adfText(node interface{}) string {
	if node == nil {
		return ""
	}
	switch v := node.(type) {
	case []interface{}:
		var result strings.Builder
		for _, item := range v {
			result.WriteString(adfText(item))
		}
		return result.String()
	case string:
		return v
	case map[string]interface{}:
		var result strings.Builder
		if text, ok := v["text"].(string); ok {
			result.WriteString(text)
		}
		if content, ok := v["content"]; ok {
			result.WriteString(adfText(content))
		}
		if nodeType, ok := v["type"].(string); ok {
			if nodeType == "paragraph" || nodeType == "heading" {
				result.WriteString("\n")
			}
		}
		return result.String()
	default:
		return ""
	}
}

func splitPath(path string) []string {
	if path == "" {
		return nil
	}
	return strings.Split(path, ".")
}

func getPath(obj map[string]any, path string) (any, bool) {
	segs := splitPath(path)
	if len(segs) == 0 {
		return nil, false
	}
	var cur any = obj
	for _, s := range segs {
		m, ok := cur.(map[string]any)
		if !ok {
			return nil, false
		}
		cur, ok = m[s]
		if !ok {
			return nil, false
		}
	}
	return cur, true
}

// setPath overwrites an intermediate non-map segment with a fresh map.
func setPath(obj map[string]any, path string, value any) {
	segs := splitPath(path)
	if len(segs) == 0 {
		return
	}
	cur := obj
	for _, s := range segs[:len(segs)-1] {
		next, ok := cur[s].(map[string]any)
		if !ok {
			next = map[string]any{}
			cur[s] = next
		}
		cur = next
	}
	cur[segs[len(segs)-1]] = value
}

func deletePath(obj map[string]any, path string) {
	segs := splitPath(path)
	if len(segs) == 0 {
		return
	}
	cur := obj
	for _, s := range segs[:len(segs)-1] {
		next, ok := cur[s].(map[string]any)
		if !ok {
			return
		}
		cur = next
	}
	delete(cur, segs[len(segs)-1])
}
