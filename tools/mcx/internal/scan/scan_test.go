package scan

import (
	"strings"
	"testing"

	"github.com/emmahyde/mcx/internal/observe"
)

// buildTranscript assembles JSONL lines. big is a result payload sized above the
// cruft threshold; small is below it.
func buildTranscript() string {
	big := strings.Repeat("x", (observe.CruftTokenThreshold+200)*4)
	small := "ok"
	lines := []string{
		toolUse("mcp__jira__getJiraIssue", "u1"),
		toolResult("u1", big),
		toolUse("mcp__jira__getJiraIssue", "u2"),
		toolResult("u2", small),
		toolUse("mcp__jira__getJiraIssue", "u3"),
		toolResult("u3", small),
		toolUse("Bash", "b1"), // native tool — must be ignored
		toolResult("b1", big),
		toolUse("mcp__notion__search", "n1"), // single large call — filter, not chain
		toolResult("n1", big),
		`{"type":"user","message":{"content":"a plain text turn"}}`, // string content, skipped
	}
	return strings.Join(lines, "\n") + "\n"
}

func toolUse(name, id string) string {
	return `{"type":"assistant","message":{"content":[{"type":"tool_use","name":"` +
		name + `","id":"` + id + `"}]}}`
}

func toolResult(id, content string) string {
	return `{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"` +
		id + `","content":"` + content + `"}]}}`
}

func TestScan_ChainAndFilterCandidates(t *testing.T) {
	rep, err := Scan(strings.NewReader(buildTranscript()), nil)
	if err != nil {
		t.Fatalf("Scan: %v", err)
	}
	if rep.Calls != 4 { // 3 getJiraIssue + 1 notion search; Bash excluded
		t.Errorf("Calls = %d, want 4", rep.Calls)
	}
	// Total MCP calls (4) is >= observe.SequentialThreshold, so every distinct
	// tool seen is a chain candidate — not just the one called repeatedly.
	if len(rep.ChainCandidates) != 2 {
		t.Fatalf("chain candidates = %+v, want getJiraIssue and notion search", rep.ChainCandidates)
	}
	counts := map[string]int{}
	for _, c := range rep.ChainCandidates {
		counts[c.Tool] = c.Count
	}
	if counts["mcp__jira__getJiraIssue"] != 3 {
		t.Errorf("getJiraIssue count = %d, want 3", counts["mcp__jira__getJiraIssue"])
	}
	if counts["mcp__notion__search"] != 1 {
		t.Errorf("notion search count = %d, want 1", counts["mcp__notion__search"])
	}
	// Both mcp tools returned a big result and neither is filtered -> two filter candidates.
	if len(rep.FilterCandidates) != 2 {
		t.Fatalf("filter candidates = %+v, want 2", rep.FilterCandidates)
	}
	// Sorted biggest-tokens first; both are equal-ish, so just assert membership.
	names := map[string]bool{}
	for _, f := range rep.FilterCandidates {
		names[f.Tool] = true
		if f.Tokens < observe.CruftTokenThreshold {
			t.Errorf("%s tokens %d below threshold", f.Tool, f.Tokens)
		}
	}
	if !names["mcp__jira__getJiraIssue"] || !names["mcp__notion__search"] {
		t.Errorf("filter candidates missing expected tools: %+v", rep.FilterCandidates)
	}
}

func TestScan_FilteredToolExcluded(t *testing.T) {
	filtered := map[string]bool{"mcp__jira__getJiraIssue": true}
	rep, err := Scan(strings.NewReader(buildTranscript()), filtered)
	if err != nil {
		t.Fatalf("Scan: %v", err)
	}
	for _, f := range rep.FilterCandidates {
		if f.Tool == "mcp__jira__getJiraIssue" {
			t.Errorf("filtered tool should be excluded from filter candidates: %+v", rep.FilterCandidates)
		}
	}
	// Both tools are still chain candidates (a filter doesn't collapse repeated calls).
	if len(rep.ChainCandidates) != 2 {
		t.Errorf("chain candidates = %+v, want both tools still present", rep.ChainCandidates)
	}
}

func TestScan_Empty(t *testing.T) {
	rep, err := Scan(strings.NewReader(""), nil)
	if err != nil {
		t.Fatalf("Scan: %v", err)
	}
	if !rep.Empty() {
		t.Errorf("empty transcript should yield empty report, got %+v", rep)
	}
}
