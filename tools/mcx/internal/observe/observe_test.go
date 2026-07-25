package observe

import (
	"strings"
	"testing"
)

const tool = "mcp__jiraconfluencegusto__getJiraIssue"

const tool2 = "mcp__gsheetsgusto__fetch"

func TestCall_BatchFiresOnSecondCallEvenDifferentTool(t *testing.T) {
	st := NewState()
	small := 10 // below cruft threshold, so only the batch path can fire
	if msg := st.Call(tool, small, true, false); msg != "" {
		t.Fatalf("first call: expected no message, got %q", msg)
	}
	msg := st.Call(tool2, small, true, false)
	if msg == "" {
		t.Fatal("expected batching reminder on second MCP call, even for a different tool")
	}
	if !strings.Contains(msg, "mcx run") {
		t.Fatalf("batch message should mention mcx run: %q", msg)
	}
	if !strings.Contains(msg, "STOP") || !strings.Contains(msg, "MUST invoke `/mcx:new`") {
		t.Fatalf("batch message should impose the mcx routing gate: %q", msg)
	}
	if !strings.Contains(msg, "Invoke `/mcx:save` only if the user explicitly asks") {
		t.Fatalf("batch message should default to an ad-hoc chain: %q", msg)
	}
	// The reminder repeats on every subsequent call — more calls is more
	// fan-out, not less, so there is no once-per-session suppression here.
	if again := st.Call(tool, small, true, false); again == "" {
		t.Fatal("expected batching reminder to repeat on a third MCP call")
	}
}

func TestCall_ChainCoveredSuppressesBatch(t *testing.T) {
	st := NewState()
	for i := 0; i < SequentialThreshold+2; i++ {
		if msg := st.Call(tool, 10, true, true); msg != "" {
			t.Fatalf("chain-covered tool should never nudge, got %q", msg)
		}
	}
}

func TestCall_CruftFiresOnUnfilteredLargePayload(t *testing.T) {
	st := NewState()
	msg := st.Call(tool, CruftTokenThreshold, false, true)
	if msg == "" {
		t.Fatal("expected cruft reminder for large unfiltered payload")
	}
	if !strings.Contains(msg, "filter") {
		t.Fatalf("cruft message should mention a filter: %q", msg)
	}
	if !strings.Contains(msg, "Before calling this tool again") || !strings.Contains(msg, "MUST invoke `/mcx:new`") {
		t.Fatalf("cruft message should impose the mcx routing gate: %q", msg)
	}
	if again := st.Call(tool, CruftTokenThreshold*2, false, true); again != "" {
		t.Fatalf("expected silence after first cruft reminder, got %q", again)
	}
}

func TestCall_FilteredToolNoCruft(t *testing.T) {
	st := NewState()
	if msg := st.Call(tool, CruftTokenThreshold*10, true, true); msg != "" {
		t.Fatalf("configured filter should suppress cruft reminder, got %q", msg)
	}
}

func TestCall_BelowCruftThresholdSilent(t *testing.T) {
	st := NewState()
	if msg := st.Call(tool, CruftTokenThreshold-1, false, true); msg != "" {
		t.Fatalf("payload below threshold should not nudge, got %q", msg)
	}
}

func TestCall_BothFireSameCall(t *testing.T) {
	st := NewState()
	// Prime one prior call so this second call crosses the batch threshold,
	// and make it large + unfiltered + unchained so cruft also fires.
	st.Call(tool, 10, false, false)
	msg := st.Call(tool2, CruftTokenThreshold, false, false)
	if !strings.Contains(msg, "filter") || !strings.Contains(msg, "mcx run") {
		t.Fatalf("expected both reminders combined: %q", msg)
	}
}

func TestShort(t *testing.T) {
	cases := map[string]string{
		"mcp__jiraconfluencegusto__getJiraIssue": "getJiraIssue",
		"mcp__server__tool":                      "tool",
		"Bash":                                   "Bash",
		"":                                       "",
	}
	for in, want := range cases {
		if got := Short(in); got != want {
			t.Errorf("Short(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestChainCoversTool(t *testing.T) {
	sources := []string{
		`forward("jiraconfluencegusto", "getJiraIssue", args)`,
		`forward("notion", "search", args)`,
	}
	if !ChainCoversTool(sources, tool) {
		t.Error("expected getJiraIssue to be covered by a chain source")
	}
	if ChainCoversTool(sources, "mcp__slack__postMessage") {
		t.Error("postMessage is in no chain source; should not be covered")
	}
	if ChainCoversTool(nil, tool) {
		t.Error("no sources means nothing is covered")
	}
}

func TestEstimateTokens(t *testing.T) {
	if got := EstimateTokens([]byte("12345678")); got != 2 {
		t.Errorf("EstimateTokens(8 bytes) = %d, want 2", got)
	}
}
