package connectors

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestPlan_DiffsAgainstLocalConfig(t *testing.T) {
	// mcpclient.ListServers also reads $HOME sources; isolate from the developer's real config.
	t.Setenv("HOME", t.TempDir())
	cwd := t.TempDir()
	mcpJSON := `{"mcpServers": {"Notion_Gusto": {"type": "http", "url": "https://runlayer.example.com/api/v1/proxy/aaa/mcp"}}}`
	if err := os.WriteFile(filepath.Join(cwd, ".mcp.json"), []byte(mcpJSON), 0o600); err != nil {
		t.Fatalf("write fixture: %v", err)
	}

	configs := map[string]string{
		"notiongusto": "https://runlayer.example.com/api/v1/proxy/aaa/mcp",
		"wizgusto":    "https://runlayer.example.com/api/v1/proxy/bbb/mcp",
	}

	plans := Plan(configs, cwd)
	if len(plans) != 2 {
		t.Fatalf("expected 2 plans, got %+v", plans)
	}
	byKey := map[string]PluginEntry{}
	for _, p := range plans {
		byKey[p.Key] = p
	}
	notion := byKey["notiongusto"]
	if !notion.AlreadyConfigured || notion.CurrentKey != "Notion_Gusto" {
		t.Errorf("notiongusto should be flagged already-configured under its current local key: %+v", notion)
	}
	if !notion.NeedsRename {
		t.Errorf("notiongusto's local key differs from its canonical key; NeedsRename should be true: %+v", notion)
	}
	wiz := byKey["wizgusto"]
	if wiz.AlreadyConfigured {
		t.Errorf("wizgusto has no matching local URL; should not be already-configured: %+v", wiz)
	}
}

func TestSync_AddsMissingAndPreservesUnrelatedKeys(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	claudeJSON := `{
		"someUnrelatedField": "keep-me",
		"mcpServers": {
			"existingother": {"type": "http", "url": "https://runlayer.example.com/api/v1/proxy/zzz/mcp"}
		}
	}`
	if err := os.WriteFile(filepath.Join(home, ".claude.json"), []byte(claudeJSON), 0o600); err != nil {
		t.Fatalf("write fixture: %v", err)
	}

	configs := map[string]string{
		"notiongusto": "https://runlayer.example.com/api/v1/proxy/aaa/mcp",
	}
	if _, err := Sync(configs); err != nil {
		t.Fatalf("Sync: %v", err)
	}

	data, err := os.ReadFile(filepath.Join(home, ".claude.json"))
	if err != nil {
		t.Fatalf("read result: %v", err)
	}
	var doc map[string]json.RawMessage
	if err := json.Unmarshal(data, &doc); err != nil {
		t.Fatalf("result is not valid JSON: %v", err)
	}
	if !bytes.Contains(doc["someUnrelatedField"], []byte("keep-me")) {
		t.Error("unrelated top-level field must be preserved")
	}
	var servers map[string]struct {
		URL string `json:"url"`
	}
	if err := json.Unmarshal(doc["mcpServers"], &servers); err != nil {
		t.Fatalf("mcpServers is not valid JSON: %v", err)
	}
	if servers["existingother"].URL != "https://runlayer.example.com/api/v1/proxy/zzz/mcp" {
		t.Error("pre-existing unrelated server entry must be preserved untouched")
	}
	if servers["notiongusto"].URL != "https://runlayer.example.com/api/v1/proxy/aaa/mcp" {
		t.Fatalf("expected new entry under key 'notiongusto', got %+v", servers)
	}

	// Idempotent: running again with the same input must not duplicate or change anything.
	if _, err := Sync(configs); err != nil {
		t.Fatalf("second Sync: %v", err)
	}
	data2, _ := os.ReadFile(filepath.Join(home, ".claude.json"))
	var servers2 map[string]json.RawMessage
	var doc2 map[string]json.RawMessage
	json.Unmarshal(data2, &doc2)
	json.Unmarshal(doc2["mcpServers"], &servers2)
	if len(servers2) != 2 {
		t.Fatalf("expected still exactly 2 server entries after rerun, got %d: %+v", len(servers2), servers2)
	}
}

func TestSync_RenamesMismatchedExistingKey(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	claudeJSON := `{
		"mcpServers": {
			"Notion_Gusto": {"type": "http", "url": "https://runlayer.example.com/api/v1/proxy/aaa/mcp"}
		}
	}`
	if err := os.WriteFile(filepath.Join(home, ".claude.json"), []byte(claudeJSON), 0o600); err != nil {
		t.Fatalf("write fixture: %v", err)
	}

	configs := map[string]string{
		"notiongusto": "https://runlayer.example.com/api/v1/proxy/aaa/mcp",
	}
	if _, err := Sync(configs); err != nil {
		t.Fatalf("Sync: %v", err)
	}

	data, _ := os.ReadFile(filepath.Join(home, ".claude.json"))
	var doc map[string]json.RawMessage
	json.Unmarshal(data, &doc)
	var servers map[string]json.RawMessage
	json.Unmarshal(doc["mcpServers"], &servers)
	if _, exists := servers["Notion_Gusto"]; exists {
		t.Error("mismatched-key entry should have been renamed away, not left in place")
	}
	if _, exists := servers["notiongusto"]; !exists {
		t.Fatalf("expected entry renamed to key 'notiongusto', got %+v", servers)
	}
	if len(servers) != 1 {
		t.Fatalf("rename must not duplicate the entry, got %d entries: %+v", len(servers), servers)
	}
}

func TestLoad_ParsesYAML(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "url_configs.yml")
	content := "notiongusto: https://runlayer.example.com/api/v1/proxy/aaa/mcp\njiraconfluencegusto: https://runlayer.example.com/api/v1/proxy/bbb/mcp\n"
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("write fixture: %v", err)
	}
	configs, err := Load(path)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if len(configs) != 2 {
		t.Fatalf("expected 2 entries, got %+v", configs)
	}
	if configs["notiongusto"] != "https://runlayer.example.com/api/v1/proxy/aaa/mcp" {
		t.Errorf("notiongusto url = %q", configs["notiongusto"])
	}
}
