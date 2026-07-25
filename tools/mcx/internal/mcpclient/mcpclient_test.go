package mcpclient

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestTransportType(t *testing.T) {
	cases := []struct {
		name    string
		entry   ServerEntry
		want    string
		wantErr bool
	}{
		{"stdio explicit", ServerEntry{Type: "stdio", Command: "foo"}, transportStdio, false},
		{"stdio implicit (empty type)", ServerEntry{Command: "foo"}, transportStdio, false},
		{"stdio missing command", ServerEntry{Type: "stdio"}, "", true},
		{"http ok", ServerEntry{Type: "http", URL: "https://x.example/mcp"}, transportHTTP, false},
		{"http alias streamable-http", ServerEntry{Type: "streamable-http", URL: "https://x.example/mcp"}, transportHTTP, false},
		{"http missing url", ServerEntry{Type: "http"}, "", true},
		{"http bad scheme", ServerEntry{Type: "http", URL: "ftp://x.example"}, "", true},
		{"http empty header name", ServerEntry{Type: "http", URL: "https://x.example", Headers: map[string]string{"": "v"}}, "", true},
		{"unknown type", ServerEntry{Type: "grpc", Command: "x"}, "", true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, err := c.entry.transportType()
			if c.wantErr {
				if err == nil {
					t.Fatalf("expected error, got type %q", got)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != c.want {
				t.Errorf("type = %q, want %q", got, c.want)
			}
		})
	}
}

func TestHeaderRoundTripperInjects(t *testing.T) {
	var gotAuth, gotCustom string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		gotCustom = r.Header.Get("X-Custom")
	}))
	defer srv.Close()

	rt := &headerRoundTripper{
		headers: map[string]string{"Authorization": "Bearer tok", "X-Custom": "v"},
		next:    http.DefaultTransport,
	}
	client := &http.Client{Transport: rt}
	resp, err := client.Get(srv.URL)
	if err != nil {
		t.Fatalf("GET: %v", err)
	}
	resp.Body.Close()

	if gotAuth != "Bearer tok" {
		t.Errorf("server saw Authorization = %q, want 'Bearer tok'", gotAuth)
	}
	if gotCustom != "v" {
		t.Errorf("server saw X-Custom = %q, want 'v'", gotCustom)
	}
}

func TestHeaderRoundTripperDoesNotMutateOriginalRequest(t *testing.T) {
	// RoundTrip clones the request; the caller's request headers must be
	// untouched, or a retried/reused request would leak the bearer.
	srv := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
	defer srv.Close()

	req, _ := http.NewRequest(http.MethodGet, srv.URL, nil)
	rt := &headerRoundTripper{headers: map[string]string{"Authorization": "Bearer tok"}, next: http.DefaultTransport}
	resp, err := rt.RoundTrip(req)
	if err != nil {
		t.Fatalf("RoundTrip: %v", err)
	}
	resp.Body.Close()

	if req.Header.Get("Authorization") != "" {
		t.Errorf("original request was mutated: Authorization = %q", req.Header.Get("Authorization"))
	}
}

func writeJSON(t *testing.T, path, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
}

func TestResolveServerPrecedence(t *testing.T) {
	home := t.TempDir()
	cwd := t.TempDir()
	t.Setenv("HOME", home)

	// Same server name defined in three sources with distinct URLs so we can
	// tell which one won.
	claudeJSON := `{
      "mcpServers": {"svc": {"type":"http","url":"https://global"}},
      "projects": {"` + cwd + `": {"mcpServers": {"svc": {"type":"http","url":"https://project"}}}}
    }`
	writeJSON(t, filepath.Join(home, ".claude.json"), claudeJSON)

	// With no project-local .mcp.json, the project entry in ~/.claude.json wins
	// over the global one.
	e, err := ResolveServer("svc", cwd)
	if err != nil {
		t.Fatalf("ResolveServer: %v", err)
	}
	if e.URL != "https://project" {
		t.Errorf("URL = %q, want project entry to win over global", e.URL)
	}

	// Project-local .mcp.json takes highest precedence.
	writeJSON(t, filepath.Join(cwd, ".mcp.json"), `{"mcpServers":{"svc":{"type":"http","url":"https://local"}}}`)
	e, err = ResolveServer("svc", cwd)
	if err != nil {
		t.Fatalf("ResolveServer: %v", err)
	}
	if e.URL != "https://local" {
		t.Errorf("URL = %q, want project-local .mcp.json to win", e.URL)
	}
}

func TestResolveServerNotFound(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	_, err := ResolveServer("nope", t.TempDir())
	if err == nil {
		t.Fatal("expected not-found error, got nil")
	}
}

func TestListServersUnion(t *testing.T) {
	home := t.TempDir()
	cwd := t.TempDir()
	t.Setenv("HOME", home)
	writeJSON(t, filepath.Join(home, ".claude.json"), `{"mcpServers":{"g":{"type":"http","url":"https://g"}}}`)
	writeJSON(t, filepath.Join(cwd, ".mcp.json"), `{"mcpServers":{"l":{"type":"stdio","command":"x"}}}`)

	got := ListServers(cwd)
	if _, ok := got["g"]; !ok {
		t.Error("global server 'g' missing from union")
	}
	if _, ok := got["l"]; !ok {
		t.Error("local server 'l' missing from union")
	}
}
