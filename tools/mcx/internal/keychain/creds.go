// Package keychain resolves and refreshes the macOS-keychain-backed OAuth
// credentials that Claude Code stores for HTTP MCP servers. The credentials
// live in a single generic-password item named "Claude Code-credentials"
// whose payload is JSON with a top-level "mcpOAuth" map keyed "<name>|<hash>".
package keychain

import (
	"encoding/json"
	"fmt"
	"time"
)

// Service is the macOS keychain generic-password service name Claude Code uses.
const Service = "Claude Code-credentials"

// expirySkew is subtracted from now when deciding whether a token is expired,
// so we refresh slightly early rather than mid-request.
const expirySkew = 30 * time.Second

// readKeychain / writeKeychain indirect to the platform implementation so tests
// can swap in a fake backend without touching the real macOS keychain.
var (
	readKeychain  = readKeychainImpl
	writeKeychain = writeKeychainImpl
)

// Credential is one mcpOAuth entry plus its entry key (for write-back).
type Credential struct {
	ServerName   string
	ServerURL    string
	ClientID     string
	ClientSecret string
	AccessToken  string
	RefreshToken string
	Scope        string
	RedirectURI  string
	// ExpiresAt is epoch milliseconds (Claude Code stores ms, not seconds).
	ExpiresAt int64
	// EntryKey is the composite "<serverName>|<hash>" key within mcpOAuth.
	EntryKey string
}

// IsExpired reports whether the access token is at or past its expiry (with skew).
func (c Credential) IsExpired() bool {
	return c.ExpiresAt <= time.Now().UnixMilli()+expirySkew.Milliseconds()
}

// rawEntry mirrors the JSON fields of one mcpOAuth entry we read.
type rawEntry struct {
	ServerName   string `json:"serverName"`
	ServerURL    string `json:"serverUrl"`
	ClientID     string `json:"clientId"`
	ClientSecret string `json:"clientSecret"`
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
	Scope        string `json:"scope"`
	RedirectURI  string `json:"redirectUri"`
	ExpiresAt    int64  `json:"expiresAt"`
}

// ParseCredentials extracts serverName -> Credential from a raw credentials
// blob. On duplicate serverName it keeps the better entry: non-expired first,
// then refresh-capable, then the one that expires later.
func ParseCredentials(raw []byte) (map[string]Credential, error) {
	var top map[string]json.RawMessage
	if err := json.Unmarshal(raw, &top); err != nil {
		return nil, fmt.Errorf("parse credentials blob: %w", err)
	}
	mcpRaw, ok := top["mcpOAuth"]
	if !ok {
		return map[string]Credential{}, nil
	}
	var entries map[string]rawEntry
	if err := json.Unmarshal(mcpRaw, &entries); err != nil {
		return nil, fmt.Errorf("parse mcpOAuth: %w", err)
	}

	out := map[string]Credential{}
	for key, e := range entries {
		if e.ServerName == "" {
			continue
		}
		cred := Credential{
			ServerName:   e.ServerName,
			ServerURL:    e.ServerURL,
			ClientID:     e.ClientID,
			ClientSecret: e.ClientSecret,
			AccessToken:  e.AccessToken,
			RefreshToken: e.RefreshToken,
			Scope:        e.Scope,
			RedirectURI:  e.RedirectURI,
			ExpiresAt:    e.ExpiresAt,
			EntryKey:     key,
		}
		if existing, dup := out[cred.ServerName]; !dup || better(existing, cred) {
			out[cred.ServerName] = cred
		}
	}
	return out, nil
}

// better reports whether candidate should win over existing for the same server.
func better(existing, candidate Credential) bool {
	rank := func(c Credential) (int, int, int64) {
		notExpired := 0
		if !c.IsExpired() {
			notExpired = 1
		}
		hasRefresh := 0
		if c.RefreshToken != "" {
			hasRefresh = 1
		}
		return notExpired, hasRefresh, c.ExpiresAt
	}
	en, er, ee := rank(existing)
	cn, cr, ce := rank(candidate)
	if cn != en {
		return cn > en
	}
	if cr != er {
		return cr > er
	}
	return ce > ee
}
