package keychain

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// oauthServer is an httptest server that serves RFC 8414 metadata pointing at
// its own token endpoint, which returns a fresh token. tokenHits counts token
// exchanges so tests can assert whether an HTTP refresh actually happened.
func oauthServer(t *testing.T) (*httptest.Server, *int) {
	t.Helper()
	var tokenHits int
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/.well-known/oauth-authorization-server":
			fmt.Fprintf(w, `{"issuer":%q,"token_endpoint":%q}`, "http://"+r.Host, "http://"+r.Host+"/oauth/token")
		case "/oauth/token":
			tokenHits++
			fmt.Fprint(w, `{"access_token":"new-at","refresh_token":"new-rt","expires_in":3600,"scope":"read"}`)
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(srv.Close)
	return srv, &tokenHits
}

// blob builds a credentials payload with context7 (parametrized url/token/expiry
// + a refresh token) plus a sibling top-level key and a second mcpOAuth entry to
// prove write-back preserves them.
func blob(serverURL, accessToken string, expiresAt int64) string {
	m := map[string]any{
		"claudeAiOauth": map[string]any{"accessToken": "keep"},
		"mcpOAuth": map[string]any{
			"context7|hash": map[string]any{
				"serverName":   "context7",
				"serverUrl":    serverURL,
				"clientId":     "cid",
				"clientSecret": "csec",
				"accessToken":  accessToken,
				"refreshToken": "rt",
				"redirectUri":  "http://127.0.0.1/callback",
				"expiresAt":    expiresAt,
			},
			"other|h": map[string]any{
				"serverName":  "other",
				"serverUrl":   "https://other.example/mcp",
				"accessToken": "other-at",
				"expiresAt":   expiresAt,
			},
		},
	}
	b, _ := json.Marshal(m)
	return string(b)
}

func TestRefreshCredentialHappyPath(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir()) // keep the flock file out of real ~/.config
	srv, hits := oauthServer(t)

	past := time.Now().Add(-time.Hour).UnixMilli()
	fake := &fakeBackend{data: blob(srv.URL+"/api/v1/proxy/x/mcp", "old-at", past)}
	swap(fake)
	defer swap(nil)

	creds, _ := Discover()
	updated, err := refreshCredential(context.Background(), creds["context7"])
	if err != nil {
		t.Fatalf("refreshCredential: %v", err)
	}
	if *hits != 1 {
		t.Errorf("token endpoint hit %d times, want 1", *hits)
	}
	if updated.AccessToken != "new-at" || updated.RefreshToken != "new-rt" {
		t.Errorf("updated = %+v, want rotated access+refresh tokens", updated)
	}
	if updated.ExpiresAt <= time.Now().UnixMilli() {
		t.Error("new ExpiresAt should be in the future (expires_in applied as ms)")
	}

	after, err := ParseCredentials([]byte(fake.data))
	if err != nil {
		t.Fatalf("reparse: %v", err)
	}
	if after["context7"].AccessToken != "new-at" {
		t.Errorf("persisted context7 token = %q", after["context7"].AccessToken)
	}
	if after["other"].AccessToken != "other-at" {
		t.Errorf("other mcpOAuth entry clobbered: %q", after["other"].AccessToken)
	}
	var top map[string]json.RawMessage
	_ = json.Unmarshal([]byte(fake.data), &top)
	if _, ok := top["claudeAiOauth"]; !ok {
		t.Error("sibling claudeAiOauth key dropped on write-back")
	}
	// Unknown within-entry fields (clientId, redirectUri) must survive.
	var entry map[string]json.RawMessage
	var mcp map[string]json.RawMessage
	_ = json.Unmarshal(top["mcpOAuth"], &mcp)
	_ = json.Unmarshal(mcp["context7|hash"], &entry)
	if _, ok := entry["redirectUri"]; !ok {
		t.Error("within-entry redirectUri dropped on write-back")
	}
	if _, ok := entry["clientId"]; !ok {
		t.Error("within-entry clientId dropped on write-back")
	}
}

func TestRefreshCredentialConcurrentReReadSkipsHTTP(t *testing.T) {
	// Simulate another process having already refreshed: the stored token is
	// valid, but we call refreshCredential with a stale (expired) copy. The
	// under-lock re-read must find the fresh token and return it WITHOUT
	// spending the rotating refresh token at the endpoint.
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	srv, hits := oauthServer(t)

	future := time.Now().Add(time.Hour).UnixMilli()
	fake := &fakeBackend{data: blob(srv.URL+"/api/v1/proxy/x/mcp", "fresh-at", future)}
	swap(fake)
	defer swap(nil)

	stale := Credential{
		ServerName:   "context7",
		ServerURL:    srv.URL + "/api/v1/proxy/x/mcp",
		EntryKey:     "context7|hash",
		RefreshToken: "rt",
		AccessToken:  "old-at",
		ExpiresAt:    time.Now().Add(-time.Hour).UnixMilli(),
	}
	updated, err := refreshCredential(context.Background(), stale)
	if err != nil {
		t.Fatalf("refreshCredential: %v", err)
	}
	if *hits != 0 {
		t.Errorf("token endpoint hit %d times, want 0 (should reuse the fresh stored token)", *hits)
	}
	if updated.AccessToken != "fresh-at" {
		t.Errorf("returned token = %q, want the fresh stored token", updated.AccessToken)
	}
}

func TestRefreshCredentialNoRefreshToken(t *testing.T) {
	cred := Credential{ServerName: "context7", ExpiresAt: 0}
	_, err := refreshCredential(context.Background(), cred)
	if err == nil {
		t.Fatal("expected error when no refresh_token, got nil")
	}
	if !strings.Contains(err.Error(), "refresh_token") {
		t.Errorf("error = %q, want it to mention refresh_token", err)
	}
}

func TestRefreshCredentialTokenEndpointErrorLeavesBlobUnchanged(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/.well-known/oauth-authorization-server" {
			fmt.Fprintf(w, `{"issuer":%q,"token_endpoint":%q}`, "http://"+r.Host, "http://"+r.Host+"/oauth/token")
			return
		}
		http.Error(w, "nope", http.StatusBadRequest) // token endpoint fails
	}))
	defer srv.Close()

	past := time.Now().Add(-time.Hour).UnixMilli()
	original := blob(srv.URL+"/api/v1/proxy/x/mcp", "old-at", past)
	fake := &fakeBackend{data: original}
	swap(fake)
	defer swap(nil)

	creds, _ := Discover()
	_, err := refreshCredential(context.Background(), creds["context7"])
	if err == nil {
		t.Fatal("expected error on token endpoint failure, got nil")
	}
	if fake.data != original {
		t.Error("blob was modified despite refresh failure; write-back must not run on error")
	}
}

func TestEnsureBearerValidTokenSkipsRefresh(t *testing.T) {
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	srv, hits := oauthServer(t)
	future := time.Now().Add(time.Hour).UnixMilli()
	fake := &fakeBackend{data: blob(srv.URL+"/api/v1/proxy/x/mcp", "valid-at", future)}
	swap(fake)
	defer swap(nil)

	tok, err := EnsureBearer(context.Background(), "context7")
	if err != nil {
		t.Fatalf("EnsureBearer: %v", err)
	}
	if tok != "valid-at" {
		t.Errorf("token = %q, want the stored valid token", tok)
	}
	if *hits != 0 {
		t.Errorf("refresh was attempted (%d hits) for a still-valid token", *hits)
	}
}

func TestEnsureBearerMissingServer(t *testing.T) {
	future := time.Now().Add(time.Hour).UnixMilli()
	fake := &fakeBackend{data: blob("https://x.example/mcp", "at", future)}
	swap(fake)
	defer swap(nil)

	_, err := EnsureBearer(context.Background(), "does-not-exist")
	if !errors.Is(err, ErrNoCredential) {
		t.Fatalf("error = %v, want ErrNoCredential", err)
	}
}
