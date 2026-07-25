package keychain

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// ErrNoCredential means no keychain OAuth entry exists for the server. Callers
// treat this as "no auth to inject" rather than a hard failure, so servers that
// carry static headers in config still forward normally.
var ErrNoCredential = errors.New("no keychain credential for server")

// httpTimeout bounds each OAuth metadata / token HTTP call.
const httpTimeout = 15 * time.Second

// Discover reads and parses the keychain credentials blob into a serverName map.
func Discover() (map[string]Credential, error) {
	raw, err := readKeychain(Service)
	if err != nil {
		return nil, err
	}
	return ParseCredentials(raw)
}

// EnsureBearer returns a currently-valid access token for serverName, refreshing
// via the refresh_token grant if the stored token is expired. Returns
// ErrNoCredential (wrapped) when the server has no keychain entry.
func EnsureBearer(ctx context.Context, serverName string) (string, error) {
	creds, err := Discover()
	if err != nil {
		return "", err
	}
	cred, ok := creds[serverName]
	if !ok {
		return "", fmt.Errorf("%w: %q", ErrNoCredential, serverName)
	}
	if !cred.IsExpired() {
		return cred.AccessToken, nil
	}
	updated, err := refreshCredential(ctx, cred)
	if err != nil {
		return "", err
	}
	return updated.AccessToken, nil
}

// oauthMetadata is the subset of RFC 8414 authorization-server metadata we need.
type oauthMetadata struct {
	Issuer        string `json:"issuer"`
	TokenEndpoint string `json:"token_endpoint"`
}

func originOf(serverURL string) (string, error) {
	u, err := url.Parse(serverURL)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return "", fmt.Errorf("invalid serverUrl %q", serverURL)
	}
	return u.Scheme + "://" + u.Host, nil
}

// fetchOAuthMetadata discovers the token endpoint via RFC 8414 well-known paths.
// Claude Code does not store the token endpoint, so we rediscover it here.
func fetchOAuthMetadata(ctx context.Context, client *http.Client, serverURL string) (oauthMetadata, error) {
	origin, err := originOf(serverURL)
	if err != nil {
		return oauthMetadata{}, err
	}
	candidates := []string{
		origin + "/.well-known/oauth-authorization-server",
		origin + "/.well-known/openid-configuration",
	}
	var lastErr error
	for _, u := range candidates {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
		if err != nil {
			lastErr = err
			continue
		}
		resp, err := client.Do(req)
		if err != nil {
			lastErr = err
			continue
		}
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			lastErr = fmt.Errorf("GET %s -> %d", u, resp.StatusCode)
			continue
		}
		var md oauthMetadata
		if err := json.Unmarshal(body, &md); err != nil {
			lastErr = fmt.Errorf("parse metadata %s: %w", u, err)
			continue
		}
		if md.TokenEndpoint == "" {
			lastErr = fmt.Errorf("metadata %s missing token_endpoint", u)
			continue
		}
		return md, nil
	}
	return oauthMetadata{}, fmt.Errorf("OAuth metadata discovery failed for %s: %w", serverURL, lastErr)
}

type tokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"`
	Scope        string `json:"scope"`
}

// exchangeRefreshToken POSTs the refresh_token grant to endpoint and returns the
// parsed token response.
func exchangeRefreshToken(ctx context.Context, client *http.Client, endpoint string, cred Credential) (tokenResponse, error) {
	form := url.Values{
		"grant_type":    {"refresh_token"},
		"refresh_token": {cred.RefreshToken},
		"client_id":     {cred.ClientID},
		"client_secret": {cred.ClientSecret},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return tokenResponse{}, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return tokenResponse{}, fmt.Errorf("token endpoint: %w", err)
	}
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		snippet := string(body)
		if len(snippet) > 200 {
			snippet = snippet[:200]
		}
		return tokenResponse{}, fmt.Errorf("token endpoint HTTP %d: %s", resp.StatusCode, snippet)
	}
	var tr tokenResponse
	if err := json.Unmarshal(body, &tr); err != nil {
		return tokenResponse{}, fmt.Errorf("parse token response: %w", err)
	}
	if tr.AccessToken == "" {
		return tokenResponse{}, errors.New("token response missing access_token")
	}
	return tr, nil
}

// refreshCredential exchanges the refresh token, persists the result to the
// keychain, and returns the updated credential. The HTTP exchange and the
// keychain write happen under one service lock so two processes seeing the same
// expired token cannot both spend a rotating refresh token; the loser re-reads.
func refreshCredential(ctx context.Context, cred Credential) (Credential, error) {
	if cred.RefreshToken == "" {
		return Credential{}, fmt.Errorf("cannot refresh %q: no refresh_token stored; re-authenticate in Claude Code", cred.ServerName)
	}

	var updated Credential
	lockErr := withServiceLock(Service, func() error {
		// Re-read under the lock: another process may have just refreshed.
		if fresh, err := Discover(); err == nil {
			if c, ok := fresh[cred.ServerName]; ok && !c.IsExpired() {
				updated = c
				return nil
			} else if ok {
				cred = c // use the freshest refresh_token available
			}
		}

		client := &http.Client{Timeout: httpTimeout}
		md, err := fetchOAuthMetadata(ctx, client, cred.ServerURL)
		if err != nil {
			return err
		}

		tr, err := exchangeRefreshToken(ctx, client, md.TokenEndpoint, cred)
		if err != nil {
			return err
		}

		expiresIn := tr.ExpiresIn
		if expiresIn <= 0 {
			expiresIn = 3600
		}
		updated = cred
		updated.AccessToken = tr.AccessToken
		updated.ExpiresAt = time.Now().UnixMilli() + expiresIn*1000
		if tr.RefreshToken != "" {
			updated.RefreshToken = tr.RefreshToken
		}
		if tr.Scope != "" {
			updated.Scope = tr.Scope
		}
		return persistLocked(updated)
	})
	if lockErr != nil {
		return Credential{}, lockErr
	}
	return updated, nil
}

// persistLocked re-reads the whole credentials blob and rewrites only this
// server's mcpOAuth entry, preserving every other top-level key (claudeAiOauth,
// designOauth) and every other mcpOAuth entry. Caller must hold the service lock.
func persistLocked(cred Credential) error {
	raw, err := readKeychain(Service)
	if err != nil {
		return fmt.Errorf("re-read for write-back: %w", err)
	}
	var top map[string]json.RawMessage
	if err := json.Unmarshal(raw, &top); err != nil {
		return fmt.Errorf("write-back: parse blob: %w", err)
	}

	mcp := map[string]json.RawMessage{}
	if mr, ok := top["mcpOAuth"]; ok {
		if err := json.Unmarshal(mr, &mcp); err != nil {
			return fmt.Errorf("write-back: parse mcpOAuth: %w", err)
		}
	}

	// Preserve unknown fields of the specific entry; overwrite only what changed.
	entry := map[string]any{}
	if er, ok := mcp[cred.EntryKey]; ok {
		if err := json.Unmarshal(er, &entry); err != nil {
			return fmt.Errorf("write-back: parse entry: %w", err)
		}
	}
	entry["accessToken"] = cred.AccessToken
	entry["expiresAt"] = cred.ExpiresAt
	if cred.RefreshToken != "" {
		entry["refreshToken"] = cred.RefreshToken
	}
	if cred.Scope != "" {
		entry["scope"] = cred.Scope
	}

	entryJSON, err := json.Marshal(entry)
	if err != nil {
		return fmt.Errorf("write-back: marshal entry: %w", err)
	}
	mcp[cred.EntryKey] = entryJSON
	mcpJSON, err := json.Marshal(mcp)
	if err != nil {
		return fmt.Errorf("write-back: marshal mcpOAuth: %w", err)
	}
	top["mcpOAuth"] = mcpJSON
	blob, err := json.Marshal(top)
	if err != nil {
		return fmt.Errorf("write-back: marshal blob: %w", err)
	}
	return writeKeychain(Service, string(blob))
}
