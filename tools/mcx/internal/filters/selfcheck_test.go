package filters

import "testing"

func TestSelfCheck_DropConfigReshapes(t *testing.T) {
	cfg := Config{
		"mcp__x__getThing": {Drop: []string{"expand", "self", "fields.status.self"}},
	}
	tool, ok := SelfCheck(cfg)
	if !ok {
		t.Fatal("SelfCheck should confirm a drop-only config reshapes")
	}
	if tool != "mcp__x__getThing" {
		t.Errorf("tool = %q, want mcp__x__getThing", tool)
	}
}

func TestSelfCheck_RenameAndTruncate(t *testing.T) {
	cfg := Config{
		"a": {Rename: map[string]string{"old": "new"}},
		"b": {Truncate: map[string]int{"body": 4}},
	}
	if _, ok := SelfCheck(cfg); !ok {
		t.Error("SelfCheck should confirm rename/truncate configs reshape")
	}
}

func TestSelfCheck_KeepPrunesExtras(t *testing.T) {
	cfg := Config{"a": {Keep: []string{"key"}}}
	if _, ok := SelfCheck(cfg); !ok {
		t.Error("SelfCheck should confirm a keep list prunes unlisted keys")
	}
}

func TestSelfCheck_EmptyAndNoOp(t *testing.T) {
	if _, ok := SelfCheck(Config{}); ok {
		t.Error("empty config should not pass SelfCheck")
	}
	// An entry with no operations is a no-op and must not count as a live filter.
	if _, ok := SelfCheck(Config{"a": {}}); ok {
		t.Error("no-op filter should not pass SelfCheck")
	}
}

func TestSelfCheck_PicksFirstWorkingTool(t *testing.T) {
	// A no-op entry is skipped; a later working entry still makes SelfCheck pass.
	cfg := Config{
		"aaa-noop":  {},
		"zzz-drops": {Drop: []string{"expand"}},
	}
	tool, ok := SelfCheck(cfg)
	if !ok || tool != "zzz-drops" {
		t.Errorf("SelfCheck = %q,%v; want zzz-drops,true", tool, ok)
	}
}
