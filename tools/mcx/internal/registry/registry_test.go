package registry

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/emmahyde/mcx/internal/executor"
)

// isolate points every layer at temp dirs: an empty plugin root (skipped), a
// project cwd with no .mcx, and a user store under XDG_CONFIG_HOME. HOME is a
// temp dir too, so PluginRoot's cache auto-detect can't pick up a real installed
// mcx plugin and leak its chains into a test.
func isolate(t *testing.T) {
	t.Helper()
	t.Setenv("CLAUDE_PLUGIN_ROOT", "")
	t.Setenv("HOME", t.TempDir())
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	t.Chdir(t.TempDir())
}

func TestRegisterRunRemoveRoundTrip(t *testing.T) {
	isolate(t)

	scriptDir := t.TempDir()
	scriptPath := filepath.Join(scriptDir, "hello.sh")
	if err := os.WriteFile(scriptPath, []byte("cat\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	store, err := Open()
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	if _, err := store.Register("hello", "echo args back", "shell", ".sh", scriptPath, nil); err != nil {
		t.Fatalf("Register: %v", err)
	}

	// Stored inline in chains.yaml — no separate script file on disk.
	raw, err := os.ReadFile(filepath.Join(store.root, "chains.yaml"))
	if err != nil {
		t.Fatalf("chains.yaml not written: %v", err)
	}
	if !strings.Contains(string(raw), "source:") || !strings.Contains(string(raw), "cat") {
		t.Errorf("chains.yaml missing inline source: %s", raw)
	}

	tools, err := store.List()
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(tools) != 1 || tools[0].Name != "hello" || tools[0].Origin() != "user" {
		t.Fatalf("List = %+v, want one user chain named hello", tools)
	}
	var buf bytes.Buffer
	if err := json.Compact(&buf, tools[0].Schema); err != nil {
		t.Fatalf("schema not valid JSON: %v", err)
	}
	if buf.String() != `{"type":"object"}` {
		t.Errorf("default schema = %s", buf.String())
	}

	ex := executor.New(func() string { return scriptDir })
	res, err := store.Run(context.Background(), ex, "hello", `{"name":"world"}`)
	if err != nil {
		t.Fatalf("Run: %v", err)
	}
	if strings.TrimSpace(res.Stdout) != `{"name":"world"}` {
		t.Fatalf("Run stdout = %q, want the args echoed back", res.Stdout)
	}

	if err := store.Remove("hello"); err != nil {
		t.Fatalf("Remove: %v", err)
	}
	tools, err = store.List()
	if err != nil {
		t.Fatalf("List after remove: %v", err)
	}
	if len(tools) != 0 {
		t.Fatalf("List after remove = %+v, want empty", tools)
	}
}

func TestLayerPrecedence(t *testing.T) {
	isolate(t)

	// plugin layer: a loose script file under chains/ (dir-backed, inferred)
	plugin := t.TempDir()
	os.MkdirAll(filepath.Join(plugin, "chains"), 0o755)
	os.WriteFile(filepath.Join(plugin, "chains", "shared_tool.sh"), []byte("# plugin version\necho plugin\n"), 0o644)
	os.WriteFile(filepath.Join(plugin, "chains", "plugin_only.sh"), []byte("# only in plugin\necho po\n"), 0o644)
	t.Setenv("CLAUDE_PLUGIN_ROOT", plugin)

	// user layer: an inline chains.json that overrides shared_tool by name
	store, err := Open()
	if err != nil {
		t.Fatal(err)
	}
	userJSON := `{"shared-tool":{"language":"shell","source":"echo user\n"}}`
	os.WriteFile(filepath.Join(store.root, "chains.json"), []byte(userJSON), 0o600)

	got := map[string]Tool{}
	tools, err := store.List()
	if err != nil {
		t.Fatal(err)
	}
	for _, tl := range tools {
		got[tl.Name] = tl
	}

	if got["plugin-only"].Origin() != "plugin" {
		t.Errorf("plugin-only should resolve from plugin, got %q", got["plugin-only"].Origin())
	}
	shared, ok := got["shared-tool"]
	if !ok || shared.Origin() != "user" {
		t.Fatalf("shared-tool should be overridden by user layer, got %+v", shared)
	}
	if !strings.Contains(shared.Code(), "echo user") {
		t.Errorf("user layer did not win: code=%q", shared.Code())
	}
}

func TestRemoveRefusesNonUserChain(t *testing.T) {
	isolate(t)
	plugin := t.TempDir()
	os.MkdirAll(filepath.Join(plugin, "chains"), 0o755)
	os.WriteFile(filepath.Join(plugin, "chains", "builtin.sh"), []byte("echo hi\n"), 0o644)
	t.Setenv("CLAUDE_PLUGIN_ROOT", plugin)

	store, err := Open()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Remove("builtin"); err == nil {
		t.Error("expected error removing a plugin-layer chain")
	}
}

func TestBrokenLayerDoesNotHideOthers(t *testing.T) {
	isolate(t)

	// plugin layer has a valid chain; project layer's chains.json is garbage.
	plugin := t.TempDir()
	os.MkdirAll(filepath.Join(plugin, "chains"), 0o755)
	os.WriteFile(filepath.Join(plugin, "chains", "good.sh"), []byte("echo ok\n"), 0o644)
	t.Setenv("CLAUDE_PLUGIN_ROOT", plugin)
	os.MkdirAll(".mcx", 0o755)
	os.WriteFile(filepath.Join(".mcx", "chains.json"), []byte("{ not json"), 0o600)

	store, err := Open()
	if err != nil {
		t.Fatal(err)
	}
	tools, err := store.List()
	if err != nil {
		t.Fatalf("List should not fail on a malformed layer: %v", err)
	}
	var names []string
	for _, tl := range tools {
		names = append(names, tl.Name)
	}
	if len(names) != 1 || names[0] != "good" {
		t.Errorf("malformed project layer hid others; got %v, want [good]", names)
	}
}

func TestBadPathEntrySkippedSiblingSurvives(t *testing.T) {
	isolate(t)
	store, err := Open()
	if err != nil {
		t.Fatal(err)
	}
	// one entry points at a missing file, a sibling is inline
	cj := `{"broken":{"language":"shell","path":"nope.sh"},"fine":{"language":"shell","source":"echo hi\n"}}`
	os.WriteFile(filepath.Join(store.root, "chains.json"), []byte(cj), 0o600)

	if _, ok, _ := store.Get("broken"); ok {
		t.Error("broken chain with missing path should be skipped")
	}
	if _, ok, _ := store.Get("fine"); !ok {
		t.Error("sibling inline chain should still resolve")
	}
}

// fakePluginCache builds ~/.claude/plugins/cache/<mp>/mcx/<version> under home
// with a scripts/mcx marker and one loose chain, and returns the version dir.
func fakePluginCache(t *testing.T, home, mp, version, chainName string) string {
	t.Helper()
	root := filepath.Join(home, ".claude", "plugins", "cache", mp, "mcx", version)
	if err := os.MkdirAll(filepath.Join(root, "scripts"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "scripts", "mcx"), []byte("binary"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(root, "chains"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "chains", chainName+".sh"), []byte("# "+chainName+"\necho hi\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	return root
}

func TestPluginRootAutoDetectsCache(t *testing.T) {
	isolate(t) // CLAUDE_PLUGIN_ROOT="" simulates a plain shell
	home := t.TempDir()
	t.Setenv("HOME", home)
	root := fakePluginCache(t, home, "marketplace", "0.1.0", "auto_found")

	if got := PluginRoot(); got != root {
		t.Fatalf("PluginRoot() = %q, want auto-detected %q", got, root)
	}

	store, err := Open()
	if err != nil {
		t.Fatal(err)
	}
	got, ok, err := store.Get("auto-found")
	if err != nil || !ok {
		t.Fatalf("Get(auto-found) = %v, ok=%v; auto-detected plugin chains should resolve", err, ok)
	}
	if got.Origin() != "plugin" {
		t.Errorf("origin = %q, want plugin", got.Origin())
	}
}

func TestPluginRootEnvWinsOverCache(t *testing.T) {
	isolate(t)
	home := t.TempDir()
	t.Setenv("HOME", home)
	fakePluginCache(t, home, "marketplace", "0.1.0", "cached_chain")

	explicit := t.TempDir()
	t.Setenv("CLAUDE_PLUGIN_ROOT", explicit)
	if got := PluginRoot(); got != explicit {
		t.Fatalf("PluginRoot() = %q, want the explicit env root %q", got, explicit)
	}
}

func TestPluginRootPicksNewestCache(t *testing.T) {
	isolate(t)
	home := t.TempDir()
	t.Setenv("HOME", home)
	older := fakePluginCache(t, home, "marketplace", "0.1.0", "old")
	newer := fakePluginCache(t, home, "marketplace", "0.2.0", "new")

	old := time.Now().Add(-time.Hour)
	recent := time.Now()
	if err := os.Chtimes(older, old, old); err != nil {
		t.Fatal(err)
	}
	if err := os.Chtimes(newer, recent, recent); err != nil {
		t.Fatal(err)
	}
	if got := PluginRoot(); got != newer {
		t.Fatalf("PluginRoot() = %q, want newest %q", got, newer)
	}
}

func TestInferName(t *testing.T) {
	cases := map[string]string{
		"/tmp/sprint_to_sheet.rb":      "sprint-to-sheet",
		"./chains/FanOut.py":           "fanout",
		"my script.sh":                 "my-script",
		"/a/b/notion-jira-crossref.js": "notion-jira-crossref",
	}
	for in, want := range cases {
		if got := InferName(in); got != want {
			t.Errorf("InferName(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestDescFromSource(t *testing.T) {
	if got := DescFromSource("#!/usr/bin/env ruby\n# does a thing\nputs 1\n"); got != "does a thing" {
		t.Errorf("ruby desc = %q", got)
	}
	if got := DescFromSource("// joins two sources\n"); got != "joins two sources" {
		t.Errorf("js desc = %q", got)
	}
	if got := DescFromSource("import sys\n# late comment\n"); got != "" {
		t.Errorf("code-first desc = %q, want empty", got)
	}
	// Ruby magic comment is skipped in favor of the real description below it
	if got := DescFromSource("# frozen_string_literal: true\n# fans out over issues\ncode\n"); got != "fans out over issues" {
		t.Errorf("magic-comment skip desc = %q", got)
	}
}

func TestYAMLBlockScalarChain(t *testing.T) {
	isolate(t)
	store, err := Open()
	if err != nil {
		t.Fatal(err)
	}
	yaml := "greet:\n" +
		"  language: shell\n" +
		"  source: |\n" +
		"    read line\n" +
		"    echo \"hi $line\"\n"
	if err := os.WriteFile(filepath.Join(store.root, "chains.yaml"), []byte(yaml), 0o600); err != nil {
		t.Fatal(err)
	}
	got, ok, err := store.Get("greet")
	if err != nil || !ok {
		t.Fatalf("Get(greet) = %v, ok=%v", err, ok)
	}
	if got.Language != "shell" {
		t.Errorf("language = %q, want shell", got.Language)
	}
	if !strings.Contains(got.Code(), "read line\n") || !strings.Contains(got.Code(), "echo \"hi $line\"") {
		t.Errorf("block scalar not preserved as multi-line source: %q", got.Code())
	}
}

func TestLangFromExt(t *testing.T) {
	for path, want := range map[string]string{"a.py": "python", "b.rb": "ruby", "c.mjs": "javascript", "d.sh": "shell", "e.ts": "typescript"} {
		if got, ok := LangFromExt(path); !ok || got != want {
			t.Errorf("LangFromExt(%q) = %q,%v want %q", path, got, ok, want)
		}
	}
	if _, ok := LangFromExt("x.bin"); ok {
		t.Error("LangFromExt(.bin) should not resolve")
	}
}
