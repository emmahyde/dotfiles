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

// fixture includes sibling keys so credential updates prove they preserve unrelated data.
func fixture(expiresAt int64) []byte {
	blob := map[string]any{
		"claudeAiOauth": map[string]any{"accessToken": "keep-me"},
		"otherOauth":    map[string]any{"accessToken": "keep-me-too"},
		"mcpOAuth": map[string]any{
			"jira|0000000000000000": map[string]any{
				"serverName":   "jira",
				"serverUrl":    "https://example.invalid/mcp/jira",
				"clientId":     "client-id",
				"clientSecret": "client-secret",
				"accessToken":  "jira-access-token",
				"refreshToken": "jira-refresh-token",
				"scope":        "read",
				"redirectUri":  "http://127.0.0.1/callback",
				"expiresAt":    expiresAt,
			},
			"gdocs|1111111111111111": map[string]any{
				"serverName":   "gdocs",
				"serverUrl":    "https://example.invalid/mcp/gdocs",
				"clientId":     "other-client-id",
				"clientSecret": "other-client-secret",
				"accessToken":  "gdocs-access-token",
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
	c, ok := creds["jira"]
	if !ok {
		t.Fatal("jira credential missing")
	}
	if c.AccessToken != "jira-access-token" {
		t.Errorf("accessToken = %q, want jira-access-token", c.AccessToken)
	}
	if c.RefreshToken != "jira-refresh-token" {
		t.Errorf("refreshToken = %q, want jira-refresh-token", c.RefreshToken)
	}
	if c.ExpiresAt != future {
		t.Errorf("expiresAt = %d, want %d", c.ExpiresAt, future)
	}
	if c.EntryKey != "jira|0000000000000000" {
		t.Errorf("entryKey = %q", c.EntryKey)
	}
	if _, ok := creds["gdocs"]; !ok {
		t.Error("gdocs credential missing")
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
			if r.Form.Get("refresh_token") != "jira-refresh-token" {
				t.Errorf("refresh_token = %q", r.Form.Get("refresh_token"))
			}
			fmt.Fprint(w, `{"access_token":"new-access-token","refresh_token":"new-refresh-token","expires_in":3600,"scope":"read"}`)
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	ctx := context.Background()
	cred := Credential{
		ServerName:   "jira",
		ServerURL:    srv.URL + "/mcp/jira",
		ClientID:     "client-id",
		ClientSecret: "client-secret",
		RefreshToken: "jira-refresh-token",
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
	if tr.AccessToken != "new-access-token" || tr.RefreshToken != "new-refresh-token" {
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
		ServerName:   "jira",
		EntryKey:     "jira|0000000000000000",
		AccessToken:  "rotated-access-token",
		RefreshToken: "rotated-refresh-token",
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
	if _, ok := top["otherOauth"]; !ok {
		t.Error("otherOauth key was dropped")
	}
	creds, err := ParseCredentials([]byte(fake.data))
	if err != nil {
		t.Fatalf("reparse creds: %v", err)
	}
	if creds["jira"].AccessToken != "rotated-access-token" {
		t.Errorf("jira token = %q, want rotated-access-token", creds["jira"].AccessToken)
	}
	if creds["gdocs"].AccessToken != "gdocs-access-token" {
		t.Errorf("gdocs entry was clobbered: %q", creds["gdocs"].AccessToken)
	}
}
