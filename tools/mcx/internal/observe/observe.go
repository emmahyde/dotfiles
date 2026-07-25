// Package observe turns a stream of PostToolUse events into explicit gates that
// route MCP traffic through mcx: a batching gate on every MCP call once
// two or more have landed in one session (regardless of tool identity, and
// repeating on every subsequent call — there is no such thing as "too chained"),
// or a filter gate when a tool returns a large result with no filter
// configured (at most once per tool per session).
package observe

import (
	"strconv"
	"strings"
)

const (
	// SequentialThreshold is how many MCP calls — of any tool, live in one
	// session or total in a scanned transcript — mark a chain candidate. It is
	// never restricted to repeats of the same tool: two different MCP calls in
	// a row are exactly the fan-out a chain collapses.
	SequentialThreshold = 2
	// CruftTokenThreshold is the approximate token size above which an unfiltered
	// result triggers the "consider a filter" reminder.
	CruftTokenThreshold = 800
)

// ToolStat is per-tool, per-session bookkeeping.
type ToolStat struct {
	Count       int  `json:"count"`
	NudgedCruft bool `json:"nudged_cruft"`
}

// State is the whole per-session observation record, persisted as JSON.
type State struct {
	Tools      map[string]*ToolStat `json:"tools"`
	TotalCalls int                  `json:"total_calls"`
}

// NewState returns an initialized, empty State.
func NewState() *State { return &State{Tools: map[string]*ToolStat{}} }

// Call records one invocation of tool and returns the reminder to inject (empty
// string = nothing to say). filtered reports whether a filter is configured for
// the tool; chained reports whether a registered chain already references it;
// approxTokens is the estimated size of the tool's result. The batching
// reminder fires on every call once the session has reached SequentialThreshold
// MCP calls — it repeats by design, since each additional call is more fan-out,
// not less. The cruft reminder fires at most once per tool per session. Call
// mutates the receiver.
func (st *State) Call(tool string, approxTokens int, filtered, chained bool) string {
	if st.Tools == nil {
		st.Tools = map[string]*ToolStat{}
	}
	s := st.Tools[tool]
	if s == nil {
		s = &ToolStat{}
		st.Tools[tool] = s
	}
	s.Count++
	st.TotalCalls++

	var msgs []string
	if !filtered && !s.NudgedCruft && approxTokens >= CruftTokenThreshold {
		s.NudgedCruft = true
		msgs = append(msgs, cruftMessage(tool, approxTokens))
	}
	if !chained && st.TotalCalls >= SequentialThreshold {
		msgs = append(msgs, batchMessage(st.TotalCalls))
	}
	return strings.Join(msgs, " ")
}

func batchMessage(count int) string {
	return "mcx routing gate: " + strconv.Itoa(count) + " MCP calls have landed back to back this session. " +
		"STOP before making another direct MCP call. You MUST invoke `/mcx:new` now and decide whether the remaining calls belong in one `mcx run`. " +
		"Use a matching registered chain; otherwise run ad-hoc script source for the fan-out. Invoke `/mcx:save` only if the user explicitly asks to persist it. " +
		"Continue directly only for an isolated call that cannot benefit from a chain."
}

func cruftMessage(tool string, tokens int) string {
	return "mcx routing gate: " + Short(tool) + " returned ~" + strconv.Itoa(tokens) +
		" tokens and no mcx filter is configured for it. Before calling this tool again, you MUST invoke `/mcx:new`; it will evaluate a filter from the observed result. " +
		"Configure one when unused fields dominate; continue unfiltered only when the payload is already mostly signal or its exact shape is required."
}

// Short returns the bare tool name from a full MCP tool id
// ("mcp__server__getJiraIssue" -> "getJiraIssue"); a non-MCP name is returned
// unchanged.
func Short(tool string) string {
	t := strings.TrimPrefix(tool, "mcp__")
	if i := strings.LastIndex(t, "__"); i >= 0 {
		return t[i+2:]
	}
	return t
}

// ChainCoversTool reports whether any chain source references tool's bare name —
// a heuristic for "a chain already automates this tool", used to suppress the
// repeat reminder so mcx never nags about calls a chain would make anyway.
func ChainCoversTool(sources []string, tool string) bool {
	short := Short(tool)
	if short == "" {
		return false
	}
	for _, src := range sources {
		if strings.Contains(src, short) {
			return true
		}
	}
	return false
}

// EstimateTokens is a cheap byte-based token estimate (~4 bytes/token) — enough
// to gate the cruft reminder without pulling in a real tokenizer.
func EstimateTokens(b []byte) int { return len(b) / 4 }
