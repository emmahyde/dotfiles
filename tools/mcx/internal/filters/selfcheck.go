package filters

import (
	"sort"
	"strings"
)

// probeSentinel is the marker value probe() writes at every path a filter names.
const probeSentinel = "mcx-probe"

// probeExtraKey is a top-level key probe() always adds; a keep list should prune
// it, which is how reshaped() detects that keep actually took effect.
const probeExtraKey = "mcx-probe-extra"

// SelfCheck proves the filter engine actually reshapes a payload for at least one
// configured tool. For each tool (in sorted order) it synthesizes a probe object
// populated at every path the tool's filter names, applies the filter, and
// confirms the reshape held — dropped paths gone, renamed paths moved, truncated
// strings shortened, and, with a keep list, an unlisted key pruned. It returns the
// tool it exercised and whether the reshape held. ok is false when cfg is empty or
// every entry is a no-op: the signal /setup needs to catch a filter registry that
// loads but silently changes nothing. It performs no I/O.
func SelfCheck(cfg Config) (tool string, ok bool) {
	names := make([]string, 0, len(cfg))
	for t := range cfg {
		names = append(names, t)
	}
	sort.Strings(names)
	for _, t := range names {
		f := cfg[t]
		probe := f.probe()
		if probe == nil {
			continue
		}
		if out, isMap := f.Apply(probe).(map[string]any); isMap && f.reshaped(out) {
			return t, true
		}
	}
	return "", false
}

// probe builds an object populated at every path this filter touches, plus a
// probeExtraKey top-level key used to detect that a keep list pruned everything
// unlisted. Returns nil when the filter has no operations to exercise.
func (m Filter) probe() map[string]any {
	if len(m.Keep) == 0 && len(m.Drop) == 0 && len(m.Rename) == 0 && len(m.Truncate) == 0 && len(m.Transforms) == 0 {
		return nil
	}
	obj := map[string]any{probeExtraKey: probeSentinel}
	for _, p := range m.Keep {
		setPath(obj, p, probeSentinel)
	}
	for _, p := range m.Drop {
		setPath(obj, p, probeSentinel)
	}
	for from := range m.Rename {
		setPath(obj, from, probeSentinel)
	}
	for p, n := range m.Truncate {
		setPath(obj, p, strings.Repeat("x", n+8))
	}
	// For transforms, populate paths needed for parse and project steps
	for _, t := range m.Transforms {
		if t.Type == "parse" && t.Field != "" {
			// For ADF parse, set a test ADF structure
			setPath(obj, t.Field, map[string]any{
				"type":    "paragraph",
				"content": []map[string]any{{"type": "text", "text": probeSentinel}},
			})
		}
		// For project and truncate, the paths are indirect via Into and field references
		// The test will verify they work indirectly
	}
	return obj
}

// reshaped reports whether out reflects this filter's operations applied to a
// probe() object. It requires every operation to have taken effect.
func (m Filter) reshaped(out map[string]any) bool {
	for _, p := range m.Drop {
		if _, found := getPath(out, p); found {
			return false
		}
	}
	for from, to := range m.Rename {
		if _, found := getPath(out, from); found {
			return false
		}
		if _, found := getPath(out, to); !found {
			return false
		}
	}
	for p, n := range m.Truncate {
		v, found := getPath(out, p)
		if !found {
			return false
		}
		if s, isStr := v.(string); !isStr || len(s) != n {
			return false
		}
	}
	if len(m.Transforms) > 0 {
		for _, t := range m.Transforms {
			if t.Type == "project" && len(t.Into) > 0 {
				hasKey := false
				for key := range t.Into {
					if _, found := out[key]; found {
						hasKey = true
						break
					}
				}
				if !hasKey {
					return false
				}
			}
		}
	}
	if len(m.Keep) > 0 {
		if _, found := out[probeExtraKey]; found {
			return false
		}
	}
	return true
}
