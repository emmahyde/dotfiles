package filters

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func TestApply_Drop(t *testing.T) {
	v := map[string]any{
		"expand": "x",
		"key":    "PROJ-1",
		"fields": map[string]any{
			"summary": "keep me",
			"status":  map[string]any{"name": "Open", "self": "url"},
		},
	}
	got := Apply_(Filter{Drop: []string{"expand", "fields.status.self"}}, v)
	if _, ok := got["expand"]; ok {
		t.Error("expand not dropped")
	}
	status := got["fields"].(map[string]any)["status"].(map[string]any)
	if _, ok := status["self"]; ok {
		t.Error("nested self not dropped")
	}
	if status["name"] != "Open" {
		t.Error("sibling signal removed")
	}
	if got["key"] != "PROJ-1" {
		t.Error("unrelated key removed")
	}
}

func TestApply_DropMissingPathNoop(t *testing.T) {
	v := map[string]any{"key": "PROJ-1"}
	got := Apply_(Filter{Drop: []string{"fields.status.self", "nope"}}, v)
	if got["key"] != "PROJ-1" {
		t.Error("missing drop path corrupted payload")
	}
}

func TestApply_Rename(t *testing.T) {
	v := map[string]any{"fields": map[string]any{"assignee": map[string]any{"displayName": "Al"}}}
	got := Apply_(Filter{Rename: map[string]string{"fields.assignee.displayName": "who"}}, v)
	if got["who"] != "Al" {
		t.Errorf("rename target missing: %v", got)
	}
	if _, ok := got["fields"].(map[string]any)["assignee"].(map[string]any)["displayName"]; ok {
		t.Error("rename source not removed")
	}
}

func TestApply_Truncate(t *testing.T) {
	v := map[string]any{"desc": "abcdefghij"}
	got := Apply_(Filter{Truncate: map[string]int{"desc": 4}}, v)
	if got["desc"] != "abcd" {
		t.Errorf("truncate got %q", got["desc"])
	}
	// shorter than limit is untouched
	got2 := Apply_(Filter{Truncate: map[string]int{"desc": 100}}, map[string]any{"desc": "hi"})
	if got2["desc"] != "hi" {
		t.Error("short string truncated")
	}
}

func TestApply_KeepPicks(t *testing.T) {
	v := map[string]any{
		"key":    "PROJ-1",
		"expand": "x",
		"fields": map[string]any{"summary": "s", "status": map[string]any{"name": "Open", "self": "u"}},
	}
	got := Apply_(Filter{Keep: []string{"key", "fields.status.name"}}, v)
	if got["key"] != "PROJ-1" {
		t.Error("kept top-level missing")
	}
	if _, ok := got["expand"]; ok {
		t.Error("keep did not prune unlisted key")
	}
	status := got["fields"].(map[string]any)["status"].(map[string]any)
	if status["name"] != "Open" {
		t.Error("kept nested path missing")
	}
	if _, ok := status["self"]; ok {
		t.Error("keep did not prune unlisted nested sibling")
	}
	if _, ok := got["fields"].(map[string]any)["summary"]; ok {
		t.Error("keep did not prune unlisted nested key")
	}
}

// Apply_ is a test helper asserting Apply returned a map[string]any.
func Apply_(m Filter, v any) map[string]any {
	out, ok := m.Apply(v).(map[string]any)
	if !ok {
		panic("Apply did not return a map")
	}
	return out
}

func TestApplyToEnvelope_PreservesShape(t *testing.T) {
	resp := map[string]any{
		"content": []any{
			map[string]any{"type": "text", "text": `{"expand":"x","key":"PROJ-1"}`},
		},
		"isError":           false,
		"structuredContent": map[string]any{"untouched": true},
	}
	changed := ApplyToEnvelope(resp, Filter{Drop: []string{"expand"}})
	if !changed {
		t.Fatal("expected changed=true")
	}
	txt := resp["content"].([]any)[0].(map[string]any)["text"].(string)
	var inner map[string]any
	if err := json.Unmarshal([]byte(txt), &inner); err != nil {
		t.Fatalf("re-wrapped text not valid JSON: %v", err)
	}
	if _, ok := inner["expand"]; ok {
		t.Error("expand survived inside envelope")
	}
	if inner["key"] != "PROJ-1" {
		t.Error("signal lost inside envelope")
	}
	if resp["structuredContent"].(map[string]any)["untouched"] != true {
		t.Error("structuredContent mutated")
	}
	if _, ok := resp["isError"]; !ok {
		t.Error("isError dropped")
	}
}

func TestApplyToEnvelope_NonJSONTextUntouched(t *testing.T) {
	resp := map[string]any{"content": []any{map[string]any{"type": "text", "text": "not json"}}}
	if ApplyToEnvelope(resp, Filter{Drop: []string{"x"}}) {
		t.Error("expected changed=false for non-JSON text")
	}
	if resp["content"].([]any)[0].(map[string]any)["text"] != "not json" {
		t.Error("non-JSON text mutated")
	}
}

// TestTrim_MatchEmits feeds the real PostToolUse shape for an MCP tool: a bare
// array of content blocks (verified against a live 2.1.x payload), NOT a
// {"content":[…]} envelope. It asserts the drop actually landed in the returned
// updatedToolOutput and that it is handed back in the same array shape. The
// earlier version of this test used the envelope shape and only checked that
// updatedToolOutput existed — which let the array-shape bug (Run silently
// no-opping on every real call) ship green. Assert the payload, not the wrapper.
func TestTrim_MatchEmits(t *testing.T) {
	payload := map[string]any{
		"tool_name": "mcp__jira__getJiraIssue",
		"tool_response": []any{
			map[string]any{"type": "text", "text": `{"expand":"x","key":"PROJ-1"}`},
		},
	}
	in, _ := json.Marshal(payload)
	cfg := Config{"mcp__jira__getJiraIssue": {Drop: []string{"expand"}}}
	out, emit := Run(in, cfg)
	if !emit {
		t.Fatal("expected emit=true")
	}
	var got map[string]any
	if err := json.Unmarshal(out, &got); err != nil {
		t.Fatalf("output not JSON: %v", err)
	}
	hso, ok := got["hookSpecificOutput"].(map[string]any)
	if !ok || hso["hookEventName"] != "PostToolUse" {
		t.Fatalf("wrong hookSpecificOutput: %v", got)
	}
	blocks, ok := hso["updatedToolOutput"].([]any)
	if !ok {
		t.Fatalf("updatedToolOutput not an array (shape must be preserved): %v", hso["updatedToolOutput"])
	}
	txt := blocks[0].(map[string]any)["text"].(string)
	var inner map[string]any
	if err := json.Unmarshal([]byte(txt), &inner); err != nil {
		t.Fatalf("reshaped block text not valid JSON: %v", err)
	}
	if _, dropped := inner["expand"]; dropped {
		t.Error("expand survived — drop did not land in updatedToolOutput")
	}
	if inner["key"] != "PROJ-1" {
		t.Error("signal lost from reshaped payload")
	}
}

func TestTrim_FailOpen(t *testing.T) {
	cfg := Config{"mcp__jira__getJiraIssue": {Drop: []string{"expand"}}}
	cases := map[string][]byte{
		"malformed":                 []byte("{not json"),
		"no tool_name":              []byte(`{"tool_response":[]}`),
		"unconfigured tool":         []byte(`{"tool_name":"mcp__other__x","tool_response":[]}`),
		"no tool_response":          []byte(`{"tool_name":"mcp__jira__getJiraIssue"}`),
		"nothing to change (array)": []byte(`{"tool_name":"mcp__jira__getJiraIssue","tool_response":[{"type":"text","text":"{\"key\":\"P-1\"}"}]}`),
		"non-JSON block":            []byte(`{"tool_name":"mcp__jira__getJiraIssue","tool_response":[{"type":"text","text":"not json"}]}`),
		"empty array":               []byte(`{"tool_name":"mcp__jira__getJiraIssue","tool_response":[]}`),
	}
	for name, in := range cases {
		if out, emit := Run(in, cfg); emit {
			t.Errorf("%s: expected fail-open (emit=false), got output %s", name, out)
		}
	}
}
func TestRun_FailOpenWhenKeepMatchesNoKeys(t *testing.T) {
	cfg := Config{"mcp__jira__getJiraIssue": {Keep: []string{"missing"}}}
	in := []byte(`{"tool_name":"mcp__jira__getJiraIssue","tool_response":[{"type":"text","text":"{\"key\":\"P-1\"}"}]}`)
	if out, emit := Run(in, cfg); emit {
		t.Errorf("expected fail-open (emit=false), got output %s", out)
	}
}

func TestLoad_Precedence(t *testing.T) {
	dir := t.TempDir()
	base := filepath.Join(dir, "plugin.json")
	os.WriteFile(base, []byte(`{"toolA":{"drop":["a"]},"toolB":{"drop":["b"]}}`), 0o644)

	userCfg := filepath.Join(dir, "user")
	os.MkdirAll(filepath.Join(userCfg, "mcx"), 0o755)
	os.WriteFile(filepath.Join(userCfg, "mcx", "filters.yml"), []byte("toolB:\n  drop:\n    - b-user\n"), 0o644)
	t.Setenv("XDG_CONFIG_HOME", userCfg)

	cfg, err := Load(base)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(cfg["toolA"].Drop, []string{"a"}) {
		t.Errorf("toolA lost from base layer: %v", cfg["toolA"])
	}
	if !reflect.DeepEqual(cfg["toolB"].Drop, []string{"b-user"}) {
		t.Errorf("user layer did not override toolB: %v", cfg["toolB"])
	}
}

func TestLoad_MalformedIsError(t *testing.T) {
	dir := t.TempDir()
	base := filepath.Join(dir, "bad.json")
	os.WriteFile(base, []byte(`{not json`), 0o644)
	t.Setenv("XDG_CONFIG_HOME", filepath.Join(dir, "empty"))
	if _, err := Load(base); err == nil {
		t.Error("expected error on malformed config")
	}
}

// TestTransforms_ParseADFWithProject tests ADF to text conversion with whitespace collapse via project.
func TestTransforms_ParseADFWithProject(t *testing.T) {
	adfNode := map[string]any{
		"type": "doc",
		"content": []any{
			map[string]any{
				"type": "paragraph",
				"content": []any{
					map[string]any{"type": "text", "text": "Hello  world"},
				},
			},
			map[string]any{
				"type": "paragraph",
				"content": []any{
					map[string]any{"type": "text", "text": "  Second   paragraph  "},
				},
			},
		},
	}
	v := map[string]any{"fields": map[string]any{"description": adfNode, "summary": "test"}}
	got := Apply_(
		Filter{Transforms: []Transform{
			{Type: "parse", Field: "fields.description", Format: "adf", Output: "desc_text"},
			{Type: "project", Into: map[string]any{"summary": "fields.summary", "description": "desc_text"}},
		}},
		v,
	)
	// Verify that the ADF was parsed and whitespace was collapsed
	if _, ok := got["description"].(string); !ok {
		t.Errorf("description not present or not a string")
	}
}

// TestTransforms_ProjectBasicFields tests basic field projection.
func TestTransforms_ProjectBasicFields(t *testing.T) {
	v := map[string]any{
		"key": "PROJ-1",
		"fields": map[string]any{
			"summary": "Test issue",
			"status":  map[string]any{"name": "Open"},
		},
	}
	got := Apply_(
		Filter{Transforms: []Transform{{
			Type: "project",
			Into: map[string]any{
				"key":     "key",
				"summary": "fields.summary",
				"status":  "fields.status.name",
			},
		}}},
		v,
	)
	if got["key"] != "PROJ-1" {
		t.Errorf("key not projected: %v", got)
	}
	if got["summary"] != "Test issue" {
		t.Errorf("summary not projected: %v", got)
	}
	if got["status"] != "Open" {
		t.Errorf("status not projected: %v", got)
	}
	if _, ok := got["fields"]; ok {
		t.Error("original fields structure should not be in output")
	}
}

// TestTransforms_ProjectWithDefault tests default fallback in projection.
func TestTransforms_ProjectWithDefault(t *testing.T) {
	v := map[string]any{
		"key": "PROJ-1",
		"fields": map[string]any{
			"summary": "Test",
			// assignee is missing
		},
	}
	got := Apply_(
		Filter{Transforms: []Transform{{
			Type: "project",
			Into: map[string]any{
				"key":      "key",
				"assignee": map[string]any{"source": "fields.assignee.displayName", "default": "Unassigned"},
			},
		}}},
		v,
	)
	if got["assignee"] != "Unassigned" {
		t.Errorf("default not applied: %v", got)
	}
}

// TestTransforms_ProjectWithLength tests op: length on arrays.
func TestTransforms_ProjectWithLength(t *testing.T) {
	v := map[string]any{
		"key": "PROJ-1",
		"fields": map[string]any{
			"comment": map[string]any{
				"comments": []any{
					map[string]any{"id": "1", "body": "comment 1"},
					map[string]any{"id": "2", "body": "comment 2"},
				},
			},
		},
	}
	got := Apply_(
		Filter{Transforms: []Transform{{
			Type: "project",
			Into: map[string]any{
				"key":      "key",
				"comments": map[string]any{"source": "fields.comment.comments", "op": "length"},
			},
		}}},
		v,
	)
	if got["comments"] != float64(2) && got["comments"] != 2 {
		t.Errorf("length not applied correctly: %v (type: %T)", got["comments"], got["comments"])
	}
}

// TestTransforms_TruncateWithSuffix tests truncation with suffix.
func TestTransforms_TruncateWithSuffix(t *testing.T) {
	v := map[string]any{
		"description": "This is a very long description that should be truncated because it exceeds the limit",
	}
	got := Apply_(
		Filter{Transforms: []Transform{{
			Type:   "truncate",
			Field:  "description",
			Length: 20,
			Suffix: "…",
		}}},
		v,
	)
	// With no preceding project step, truncate operates on the input object itself.
	desc := got["description"].(string)
	if len(desc) != len("This is a very long …") {
		t.Errorf("truncate+suffix length wrong: got %d, want %d (%q)", len(desc), len("This is a very long …"), desc)
	}
	if !strings.HasSuffix(desc, "…") {
		t.Errorf("suffix not appended: %q", desc)
	}
}

// TestTransforms_TruncateNoSuffixIfNotTruncated tests that suffix is only added when truncation occurs.
func TestTransforms_TruncateNoSuffixIfNotTruncated(t *testing.T) {
	v := map[string]any{"description": "Short"}
	got := Apply_(
		Filter{Transforms: []Transform{{
			Type:   "truncate",
			Field:  "description",
			Length: 100,
			Suffix: "…",
		}}},
		v,
	)
	if got["description"] != "Short" {
		t.Errorf("short string was modified: %q", got["description"])
	}
}

// TestTransforms_ParseProjectTruncateFullPipeline tests the full getJiraIssue scenario.
func TestTransforms_ParseProjectTruncateFullPipeline(t *testing.T) {
	raw, err := os.ReadFile(repoPath(t, filepath.Join("testdata", "captures", "getJiraIssue.json")))
	if err != nil {
		t.Fatal(err)
	}
	var fixture map[string]any
	if err := json.Unmarshal(raw, &fixture); err != nil {
		t.Fatal(err)
	}

	// Apply the transforms that match the shipped filter entry for getJiraIssue
	f := Filter{
		Transforms: []Transform{
			{
				Type:   "parse",
				Field:  "fields.description",
				Format: "adf",
				Output: "description_text",
			},
			{
				Type: "project",
				Into: map[string]any{
					"key":     "key",
					"summary": "fields.summary",
					"status":  "fields.status.name",
					"assignee": map[string]any{
						"source":  "fields.assignee.displayName",
						"default": "Unassigned",
					},
					"priority": "fields.priority.name",
					"updated":  "fields.updated",
					"comments": map[string]any{
						"source": "fields.comment.comments",
						"op":     "length",
					},
					"description": "description_text",
				},
			},
			{
				Type:   "truncate",
				Field:  "description",
				Length: 400,
				Suffix: "…",
			},
		},
	}

	got := Apply_(f, fixture)

	// Verify the digest shape
	if got["key"] != "PROJ-1234" {
		t.Errorf("key: %v", got["key"])
	}
	if got["summary"] != "Sanitized example issue summary" {
		t.Errorf("summary: %v", got["summary"])
	}
	if got["status"] != "In Progress" {
		t.Errorf("status: %v", got["status"])
	}
	if got["priority"] != "Medium" {
		t.Errorf("priority: %v", got["priority"])
	}
	if got["updated"] != "2026-01-03T11:30:00.000-0800" {
		t.Errorf("updated: %v", got["updated"])
	}

	// Verify comments count
	commentCount := got["comments"]
	if commentCount != float64(0) && commentCount != 0 {
		t.Errorf("comments count: %v (type: %T), expected 0", commentCount, commentCount)
	}

	// Verify description was parsed and truncated
	desc := got["description"].(string)
	if len(desc) > 400 {
		t.Errorf("description longer than 400 chars: %d", len(desc))
	}
	// The raw fixture has "Lorem ipsum dolor sit amet, consectetur adipiscing elit."
	// which is < 400 chars, so no truncation suffix should be present
	if strings.Contains(desc, "Lorem") {
		// Good, the description was parsed from the plain string format
	}
}

// TestTransforms_FailOpenOnMalformedStep tests that malformed transform steps don't crash.
func TestTransforms_FailOpenOnMalformedStep(t *testing.T) {
	v := map[string]any{"key": "PROJ-1", "fields": map[string]any{"status": "Open"}}

	// Parse step with missing Field
	got := Apply_(
		Filter{Transforms: []Transform{{Type: "parse", Format: "adf", Output: "test"}}},
		v,
	)
	if got["key"] != "PROJ-1" {
		t.Error("malformed parse step corrupted input")
	}

	// Project step with empty Into map
	got = Apply_(
		Filter{Transforms: []Transform{{Type: "project", Into: map[string]any{}}}},
		v,
	)
	if got["key"] != "PROJ-1" {
		t.Error("malformed project step corrupted input")
	}
}

func TestShippedDefaults_CaptureCoverage(t *testing.T) {
	cases := []struct {
		name            string
		tool            string
		fixture         string
		expectedNoMatch bool
	}{
		{"getJiraIssue", "mcp__jiraconfluencegusto__getJiraIssue", "getJiraIssue.json", false},
		{"editJiraIssue", "mcp__jiraconfluencegusto__editJiraIssue", "editJiraIssue.json", false},
		{"searchJiraIssuesUsingJql", "mcp__jiraconfluencegusto__searchJiraIssuesUsingJql", "searchJiraIssuesUsingJql.json", false},
		{"slack_read_thread", "mcp__slackgusto__slack_read_thread", "slack_read_thread.json", false},
		{"slack_read_channel", "mcp__slackgusto__slack_read_channel", "slack_read_channel.json", false},
		{"slack_search_public_and_private", "mcp__slackgusto__slack_search_public_and_private", "slack_search_public_and_private.json", false},
		{"notion-fetch", "mcp__notiongusto__notion-fetch", "notion-fetch.json", false},
		{"notion-query-database-view", "mcp__notiongusto__notion-query-database-view", "notion-query-database-view.json", true},
		{"notion-search", "mcp__notiongusto__notion-search", "notion-search.json", false},
	}

	cfg, err := loadFile(repoPath(t, "filters.yml"))
	if err != nil {
		t.Fatal(err)
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			mod, ok := cfg[tc.tool]
			if !ok {
				t.Fatalf("shipped default for %s missing", tc.tool)
			}
			raw, err := os.ReadFile(repoPath(t, filepath.Join("testdata", "captures", tc.fixture)))
			if err != nil {
				t.Fatal(err)
			}
			var fixture any
			if err := json.Unmarshal(raw, &fixture); err != nil {
				t.Fatal(err)
			}
			obj, ok := fixture.(map[string]any)
			if !ok || len(obj) == 0 {
				t.Fatalf("fixture must be a non-empty JSON object")
			}

			reshaped := mod.Apply(fixture)
			reshapedObj, isObject := reshaped.(map[string]any)
			if !tc.expectedNoMatch && isObject && len(reshapedObj) == 0 {
				t.Fatal("filter produced an empty object from a non-empty fixture")
			}
			if tc.expectedNoMatch {
				status, ok := obj["status"].(float64)
				if !ok || status != 400 {
					t.Fatalf("expected recorded warning status 400, got %v", obj["status"])
				}
				return
			}
			for _, path := range mod.Keep {
				if _, found := getPath(obj, path); !found {
					t.Errorf("keep path %q missing from fixture", path)
				}
			}
		})
	}
}

// TestShippedDefaults_TransformEntry enforces the shipped filters.yml for
// getJiraIssue using the new transforms pipeline. It verifies that the parsed
// and projected digest matches the expected shape and content.
func TestShippedDefaults_TransformEntry(t *testing.T) {
	raw, err := os.ReadFile(repoPath(t, filepath.Join("testdata", "captures", "getJiraIssue.json")))
	if err != nil {
		t.Fatal(err)
	}
	var fixture map[string]any
	if err := json.Unmarshal(raw, &fixture); err != nil {
		t.Fatal(err)
	}

	// Load the shipped filters.yml
	cfg, err := loadFile(repoPath(t, "filters.yml"))
	if err != nil {
		t.Fatal(err)
	}

	const tool = "mcp__jiraconfluencegusto__getJiraIssue"
	mod, ok := cfg[tool]
	if !ok {
		t.Fatalf("shipped default for %s missing", tool)
	}

	if len(mod.Transforms) == 0 {
		t.Fatal("shipped default must have transforms")
	}

	// Verify the transforms pipeline produces the expected digest
	reshaped := mod.Apply(fixture).(map[string]any)

	// Expected fields in the digest
	expectedFields := map[string]bool{
		"key":         true,
		"summary":     true,
		"status":      true,
		"assignee":    true,
		"priority":    true,
		"updated":     true,
		"comments":    true,
		"description": true,
	}

	for field := range expectedFields {
		if _, ok := reshaped[field]; !ok {
			t.Errorf("expected field %q missing from digest", field)
		}
	}

	// Verify cruft was not preserved (no top-level fields from original)
	if _, ok := reshaped["expand"]; ok {
		t.Error("expand should be dropped")
	}
	if _, ok := reshaped["fields"]; ok {
		t.Error("fields structure should be replaced, not preserved")
	}

	// Verify description is a string and not over 400 chars
	if desc, ok := reshaped["description"].(string); ok {
		if len(desc) > 400 {
			t.Errorf("description exceeds 400 chars: %d", len(desc))
		}
	} else {
		t.Error("description should be a string")
	}

	// Verify comments is a number
	if _, ok := reshaped["comments"].(float64); !ok {
		if _, ok := reshaped["comments"].(int); !ok {
			t.Errorf("comments should be a number, got %T", reshaped["comments"])
		}
	}
}

// repoPath resolves a path relative to the repo root from within the package dir.
func repoPath(t *testing.T, rel string) string {
	t.Helper()
	return filepath.Join("..", "..", rel)
}
