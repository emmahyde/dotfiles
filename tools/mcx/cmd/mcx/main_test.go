package main

import (
	"bytes"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/emmahyde/mcx/internal/registry"
)

// captureStdout redirects os.Stdout for the duration of fn and returns what it wrote.
func captureStdout(t *testing.T, fn func()) string {
	t.Helper()
	orig := os.Stdout
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatalf("os.Pipe: %v", err)
	}
	os.Stdout = w
	fn()
	w.Close()
	os.Stdout = orig
	out, _ := io.ReadAll(r)
	return string(out)
}

func TestSplitName(t *testing.T) {
	cases := []struct {
		name     string
		in       []string
		wantName string
		wantRest []string
	}{
		{"name then flags", []string{"hello", "--lang", "python"}, "hello", []string{"--lang", "python"}},
		{"flags only (missing name)", []string{"--lang", "python"}, "", []string{"--lang", "python"}},
		{"name only", []string{"hello"}, "hello", []string{}},
		{"empty", nil, "", nil},
		// A leading flag with an attached value must not be mistaken for a name.
		{"flag with equals", []string{"--args=x", "hello"}, "", []string{"--args=x", "hello"}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			gotName, gotRest := splitName(c.in)
			if gotName != c.wantName {
				t.Errorf("name = %q, want %q", gotName, c.wantName)
			}
			if len(gotRest) != len(c.wantRest) {
				t.Fatalf("rest = %v, want %v", gotRest, c.wantRest)
			}
			for i := range gotRest {
				if gotRest[i] != c.wantRest[i] {
					t.Errorf("rest[%d] = %q, want %q", i, gotRest[i], c.wantRest[i])
				}
			}
		})
	}
}

func TestProjectSlug(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		{"/Users/dev/work/mcx", "-Users-dev-work-mcx"},
		{"/Users/dev/work/your-org-plugin-marketplace/plugins/scope-review", "-Users-dev-work-your-org-plugin-marketplace-plugins-scope-review"},
		{"/tmp/a_b.c", "-tmp-a-b-c"},
	}
	for _, c := range cases {
		if got := projectSlug(c.in); got != c.want {
			t.Errorf("projectSlug(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestIsHTTP(t *testing.T) {
	for _, ty := range []string{"http", "streamable-http", "streamable_http"} {
		if !isHTTP(ty) {
			t.Errorf("isHTTP(%q) = false, want true", ty)
		}
	}
	// stdio and empty must not be treated as HTTP — they take the keychain
	// injection path only when HTTP, so a false positive here would try to add
	// a bearer to a stdio server.
	for _, ty := range []string{"stdio", "", "HTTP", "grpc"} {
		if isHTTP(ty) {
			t.Errorf("isHTTP(%q) = true, want false", ty)
		}
	}
}

func TestHasAuthHeaderIsCaseInsensitive(t *testing.T) {
	// HTTP header names are case-insensitive; any casing must suppress keychain
	// injection so we never send two Authorization headers.
	for _, key := range []string{"Authorization", "authorization", "AUTHORIZATION", "AuThOrIzAtIoN"} {
		if !hasAuthHeader(map[string]string{key: "Bearer x"}) {
			t.Errorf("hasAuthHeader with key %q = false, want true", key)
		}
	}
	if hasAuthHeader(map[string]string{"X-Api-Key": "x"}) {
		t.Error("hasAuthHeader matched an unrelated header")
	}
	if hasAuthHeader(nil) {
		t.Error("hasAuthHeader(nil) = true, want false")
	}
}

func TestPrintNeedsAuth(t *testing.T) {
	out := captureStdout(t, func() {
		if err := printNeedsAuth("notiongusto"); err != nil {
			t.Fatalf("printNeedsAuth: %v", err)
		}
	})
	var result struct {
		IsError bool `json:"isError"`
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
	}
	if err := json.Unmarshal([]byte(out), &result); err != nil {
		t.Fatalf("output is not valid JSON: %v\noutput: %s", err, out)
	}
	if !result.IsError {
		t.Error("expected isError=true")
	}
	if len(result.Content) != 1 || result.Content[0].Type != "text" {
		t.Fatalf("expected one text content block, got %+v", result.Content)
	}
	if !bytes.Contains([]byte(result.Content[0].Text), []byte("notiongusto")) {
		t.Errorf("message should name the server: %q", result.Content[0].Text)
	}
	if !bytes.Contains([]byte(result.Content[0].Text), []byte("/mcp")) {
		t.Errorf("message should point at /mcp: %q", result.Content[0].Text)
	}
}

func TestCmdRegisterAndRemove_SyncsSkill(t *testing.T) {
	t.Setenv("CLAUDE_PLUGIN_ROOT", "")
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	t.Chdir(t.TempDir())

	scriptPath := filepath.Join(t.TempDir(), "hello.sh")
	if err := os.WriteFile(scriptPath, []byte("#!/bin/sh\ncat\n"), 0o755); err != nil {
		t.Fatal(err)
	}

	out := captureStdout(t, func() {
		if err := cmdRegister([]string{scriptPath, "--name", "hello", "--lang", "shell", "--desc", "says hello"}); err != nil {
			t.Fatalf("cmdRegister: %v", err)
		}
	})
	if !strings.Contains(out, "skill: added /hello") {
		t.Errorf("register output = %q, want a skill-sync line", out)
	}
	skillPath := filepath.Join(home, ".claude", "skills", "hello", "SKILL.md")
	data, err := os.ReadFile(skillPath)
	if err != nil {
		t.Fatalf("skill not synced on register: %v", err)
	}
	if !strings.Contains(string(data), "description: says hello") {
		t.Errorf("SKILL.md = %q, want the registered description", data)
	}

	out = captureStdout(t, func() {
		if err := cmdRemove([]string{"hello"}); err != nil {
			t.Fatalf("cmdRemove: %v", err)
		}
	})
	if !strings.Contains(out, "skill: removed /hello") {
		t.Errorf("remove output = %q, want a skill-sync line", out)
	}
	if _, err := os.Stat(skillPath); !os.IsNotExist(err) {
		t.Errorf("skill file still exists after remove: err=%v", err)
	}
}

func TestCmdRun_ScriptPathRunsWithoutRegistration(t *testing.T) {
	t.Setenv("CLAUDE_PLUGIN_ROOT", "")
	t.Setenv("HOME", t.TempDir())
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	t.Chdir(t.TempDir())

	scriptPath := filepath.Join(t.TempDir(), "ephemeral.sh")
	if err := os.WriteFile(scriptPath, []byte("cat\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	out := captureStdout(t, func() {
		if err := cmdRun([]string{`{"name":"world"}`, scriptPath}); err != nil {
			t.Fatalf("cmdRun: %v", err)
		}
	})
	if strings.TrimSpace(out) != `{"name":"world"}` {
		t.Fatalf("stdout = %q, want args JSON", out)
	}

	store, err := registry.Open()
	if err != nil {
		t.Fatal(err)
	}
	tools, err := store.List()
	if err != nil {
		t.Fatal(err)
	}
	if len(tools) != 0 {
		t.Fatalf("ad-hoc run registered chains: %+v", tools)
	}
}

func TestCmdRun_HeredocSourceRunsWithoutRegistration(t *testing.T) {
	t.Setenv("CLAUDE_PLUGIN_ROOT", "")
	t.Setenv("HOME", t.TempDir())
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	t.Chdir(t.TempDir())

	originalStdin := os.Stdin
	r, w, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	if _, err := w.WriteString("cat\n"); err != nil {
		t.Fatal(err)
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	os.Stdin = r
	t.Cleanup(func() {
		os.Stdin = originalStdin
		_ = r.Close()
	})

	out := captureStdout(t, func() {
		if err := cmdRun([]string{`{"mode":"heredoc"}`, "shell"}); err != nil {
			t.Fatalf("cmdRun: %v", err)
		}
	})
	if strings.TrimSpace(out) != `{"mode":"heredoc"}` {
		t.Fatalf("stdout = %q, want args JSON", out)
	}

	store, err := registry.Open()
	if err != nil {
		t.Fatal(err)
	}
	tools, err := store.List()
	if err != nil {
		t.Fatal(err)
	}
	if len(tools) != 0 {
		t.Fatalf("heredoc run registered chains: %+v", tools)
	}
}

func TestCanonicalLanguage(t *testing.T) {
	for input, want := range map[string]string{
		"py": "python", "ruby": "ruby", "js": "javascript", "ts": "typescript", "sh": "shell",
	} {
		got, ok := canonicalLanguage(input)
		if !ok || got != want {
			t.Errorf("canonicalLanguage(%q) = %q, %v; want %q, true", input, got, ok, want)
		}
	}
	if _, ok := canonicalLanguage("brainfuck"); ok {
		t.Error("unsupported language accepted")
	}
}

func TestParseRunInvocation_RequiresJSONFirstInCanonicalForm(t *testing.T) {
	_, _, _, err := parseRunInvocation([]string{"not-json", "ruby"})
	if err == nil || !strings.Contains(err.Error(), "first operand") {
		t.Fatalf("error = %v, want first-operand JSON error", err)
	}
}

func TestParseRunInvocation_RetainsLegacyTargetFirstForm(t *testing.T) {
	argsJSON, target, language, err := parseRunInvocation([]string{"saved-chain", "--args", `{"legacy":true}`})
	if err != nil {
		t.Fatal(err)
	}
	if argsJSON != `{"legacy":true}` || target != "saved-chain" || language != "" {
		t.Fatalf("got args=%q target=%q language=%q", argsJSON, target, language)
	}
}

func TestCmdRun_MissingScriptPathIsNotTreatedAsChainName(t *testing.T) {
	err := cmdRun([]string{"./missing.rb"})
	if err == nil || !strings.Contains(err.Error(), "read script") {
		t.Fatalf("error = %v, want missing script error", err)
	}
}
