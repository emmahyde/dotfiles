package keychain

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// fakeBackend stands in for the macOS keychain in tests: an in-memory blob.
type fakeBackend struct{ data string }

// swap points the package read/write hooks at fake (or restores the real impls
// when fake is nil).
func swap(fake *fakeBackend) {
	if fake == nil {
		readKeychain = readKeychainImpl
		writeKeychain = writeKeychainImpl
		return
	}
	readKeychain = func(string) ([]byte, error) { return []byte(fake.data), nil }
	writeKeychain = func(_, payload string) error { fake.data = payload; return nil }
}

// fixture mirrors the real "Claude Code-credentials" blob shape captured from
// the macOS keychain: top-level mcpOAuth plus sibling keys we must not disturb.
func fixture(expiresAt int64) []byte {
	blob := map[string]any{
		"claudeAiOauth": map[string]any{"accessToken": "keep-me"},
		"designOauth":   map[string]any{"accessToken": "keep-me-too"},
		"mcpOAuth": map[string]any{
			"context7|38086be306220b60": map[string]any{
				"serverName":   "context7",
				"serverUrl":    "https://runlayer.example.com/api/v1/proxy/abc/mcp",
				"clientId":     "cid",
				"clientSecret": "csec",
				"accessToken":  "at-context7",
				"refreshToken": "rt-context7",
				"scope":        "read",
				"redirectUri":  "http://127.0.0.1/callback",
				"expiresAt":    expiresAt,
			},
			"gdocsgusto|deadbeef": map[string]any{
				"serverName":   "gdocsgusto",
				"serverUrl":    "https://runlayer.example.com/api/v1/proxy/xyz/mcp",
				"clientId":     "cid2",
				"clientSecret": "csec2",
				"accessToken":  "at-gdocs",
				"expiresAt":    expiresAt,
			},
		},
	}
	b, _ := json.Marshal(blob)
	return b
}

func TestParseCredentials(t *testing.T) {
	future := time.Now().Add(time.Hour).UnixMilli()
	creds, err := ParseCredentials(fixture(future))
	if err != nil {
		t.Fatalf("ParseCredentials: %v", err)
	}
	c, ok := creds["context7"]
	if !ok {
		t.Fatal("context7 credential missing")
	}
	if c.AccessToken != "at-context7" {
		t.Errorf("accessToken = %q, want at-context7", c.AccessToken)
	}
	if c.RefreshToken != "rt-context7" {
		t.Errorf("refreshToken = %q, want rt-context7", c.RefreshToken)
	}
	if c.ExpiresAt != future {
		t.Errorf("expiresAt = %d, want %d", c.ExpiresAt, future)
	}
	if c.EntryKey != "context7|38086be306220b60" {
		t.Errorf("entryKey = %q", c.EntryKey)
	}
	if _, ok := creds["gdocsgusto"]; !ok {
		t.Error("gdocsgusto credential missing")
	}
}

func TestIsExpiredUsesMilliseconds(t *testing.T) {
	// A value that is far in the future as ms but ancient as seconds — proves
	// we compare against UnixMilli, not Unix.
	future := time.Now().Add(2 * time.Hour).UnixMilli()
	if (Credential{ExpiresAt: future}).IsExpired() {
		t.Error("credential with future ms expiry reported expired")
	}
	past := time.Now().Add(-time.Hour).UnixMilli()
	if !(Credential{ExpiresAt: past}).IsExpired() {
		t.Error("credential with past expiry reported valid")
	}
}

func TestFetchOAuthMetadataAndRefresh(t *testing.T) {
	var tokenHits int
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/.well-known/oauth-authorization-server":
			fmt.Fprintf(w, `{"issuer":%q,"token_endpoint":%q}`, "http://"+r.Host, "http://"+r.Host+"/oauth/token")
		case "/oauth/token":
			tokenHits++
			if err := r.ParseForm(); err != nil {
				t.Errorf("parse form: %v", err)
			}
			if r.Form.Get("grant_type") != "refresh_token" {
				t.Errorf("grant_type = %q, want refresh_token", r.Form.Get("grant_type"))
			}
			if r.Form.Get("refresh_token") != "rt-context7" {
				t.Errorf("refresh_token = %q", r.Form.Get("refresh_token"))
			}
			fmt.Fprint(w, `{"access_token":"new-at","refresh_token":"new-rt","expires_in":3600,"scope":"read"}`)
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	ctx := context.Background()
	cred := Credential{
		ServerName:   "context7",
		ServerURL:    srv.URL + "/api/v1/proxy/abc/mcp",
		ClientID:     "cid",
		ClientSecret: "csec",
		RefreshToken: "rt-context7",
	}

	md, err := fetchOAuthMetadata(ctx, srv.Client(), cred.ServerURL)
	if err != nil {
		t.Fatalf("fetchOAuthMetadata: %v", err)
	}
	if md.TokenEndpoint != srv.URL+"/oauth/token" {
		t.Fatalf("token_endpoint = %q", md.TokenEndpoint)
	}

	tr, err := exchangeRefreshToken(ctx, srv.Client(), md.TokenEndpoint, cred)
	if err != nil {
		t.Fatalf("exchangeRefreshToken: %v", err)
	}
	if tr.AccessToken != "new-at" || tr.RefreshToken != "new-rt" {
		t.Fatalf("token response = %+v", tr)
	}
	if tokenHits != 1 {
		t.Fatalf("token endpoint hit %d times, want 1", tokenHits)
	}
}

func TestPersistLockedPreservesOtherKeys(t *testing.T) {
	// persistLocked reads and rewrites the whole blob; verify the JSON merge
	// keeps sibling top-level keys and other mcpOAuth entries intact, without
	// touching the real keychain (we drive the merge via a fake backend).
	future := time.Now().Add(time.Hour).UnixMilli()
	fake := &fakeBackend{data: string(fixture(future))}
	swap(fake)
	defer swap(nil)

	updated := Credential{
		ServerName:   "context7",
		EntryKey:     "context7|38086be306220b60",
		AccessToken:  "rotated-at",
		RefreshToken: "rotated-rt",
		Scope:        "read",
		ExpiresAt:    future + 1000,
	}
	if err := persistLocked(updated); err != nil {
		t.Fatalf("persistLocked: %v", err)
	}

	var top map[string]json.RawMessage
	if err := json.Unmarshal([]byte(fake.data), &top); err != nil {
		t.Fatalf("reparse: %v", err)
	}
	if _, ok := top["claudeAiOauth"]; !ok {
		t.Error("claudeAiOauth key was dropped")
	}
	if _, ok := top["designOauth"]; !ok {
		t.Error("designOauth key was dropped")
	}
	creds, err := ParseCredentials([]byte(fake.data))
	if err != nil {
		t.Fatalf("reparse creds: %v", err)
	}
	if creds["context7"].AccessToken != "rotated-at" {
		t.Errorf("context7 token = %q, want rotated-at", creds["context7"].AccessToken)
	}
	if creds["gdocsgusto"].AccessToken != "at-gdocs" {
		t.Errorf("gdocsgusto entry was clobbered: %q", creds["gdocsgusto"].AccessToken)
	}
}
