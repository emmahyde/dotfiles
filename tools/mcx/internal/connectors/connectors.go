// Package connectors syncs caller-configured MCP endpoints into local server config.
package connectors

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"

	"gopkg.in/yaml.v3"

	"github.com/emmahyde/dotfiles/tools/mcx/internal/mcpclient"
)

// Load keeps connector endpoints data-driven so installations can supply their own URLs.
func Load(path string) (map[string]string, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("sync-connectors: read %s: %w", path, err)
	}
	var configs map[string]string
	if err := yaml.Unmarshal(raw, &configs); err != nil {
		return nil, fmt.Errorf("sync-connectors: parse %s: %w", path, err)
	}
	return configs, nil
}

// PluginEntry is one shipped default connector and its current local status.
type PluginEntry struct {
	Key               string `json:"key"`
	AlreadyConfigured bool   `json:"alreadyConfigured"`
	CurrentKey        string `json:"currentKey,omitempty"`
	NeedsRename       bool   `json:"needsRename"`
}

// Plan reports, per shipped default connector, whether a local server already
// targets its URL and under what key — without writing anything. Matching is by
// URL only: display names and `claude mcp list` output are irrelevant since the
// URLs are known ahead of time. Entries are returned sorted by canonical key.
func Plan(configs map[string]string, cwd string) []PluginEntry {
	byURL := map[string]string{} // url -> local server name
	for name, e := range mcpclient.ListServers(cwd) {
		if e.URL != "" {
			byURL[e.URL] = name
		}
	}

	plans := make([]PluginEntry, 0, len(configs))
	for _, key := range sortedKeys(configs) {
		p := PluginEntry{Key: key}
		if current, ok := byURL[configs[key]]; ok {
			p.AlreadyConfigured = true
			p.CurrentKey = current
			p.NeedsRename = current != key
		}
		plans = append(plans, p)
	}
	return plans
}

// Result summarizes what Sync changed in ~/.claude.json.
type Result struct {
	Added             []string
	Renamed           []string
	AlreadyConfigured []string
	Changed           bool
}

// Sync read-modify-writes ~/.claude.json's top-level mcpServers map so every
// shipped default (configs) is present under its canonical key: a server already
// at the right URL but a different key is renamed in place; a URL missing entirely
// is added fresh. Every untouched top-level field and every untouched server entry
// round-trips as raw JSON bytes rather than being reserialized. Idempotent across
// reruns.
func Sync(configs map[string]string) (Result, error) {
	var res Result
	home, err := os.UserHomeDir()
	if err != nil {
		return res, err
	}
	path := filepath.Join(home, ".claude.json")
	raw, err := os.ReadFile(path)
	if err != nil {
		return res, fmt.Errorf("sync-connectors: read ~/.claude.json: %w", err)
	}
	var doc map[string]json.RawMessage
	if err := json.Unmarshal(raw, &doc); err != nil {
		return res, fmt.Errorf("sync-connectors: parse ~/.claude.json: %w", err)
	}
	var servers map[string]json.RawMessage
	if existing, ok := doc["mcpServers"]; ok {
		if err := json.Unmarshal(existing, &servers); err != nil {
			return res, fmt.Errorf("sync-connectors: parse mcpServers: %w", err)
		}
	}
	if servers == nil {
		servers = map[string]json.RawMessage{}
	}

	byURL := map[string]string{} // url -> current key in servers
	for key, entry := range servers {
		if u := rawEntryURL(entry); u != "" {
			byURL[u] = key
		}
	}

	for _, key := range sortedKeys(configs) {
		url := configs[key]
		if existingKey, ok := byURL[url]; ok {
			if existingKey == key {
				res.AlreadyConfigured = append(res.AlreadyConfigured, key)
				continue
			}
			entry := servers[existingKey]
			delete(servers, existingKey)
			newKey := uniqueKey(servers, key)
			servers[newKey] = entry
			byURL[url] = newKey
			res.Renamed = append(res.Renamed, fmt.Sprintf("%s -> %s", existingKey, newKey))
			res.Changed = true
			continue
		}
		newKey := uniqueKey(servers, key)
		entryJSON, err := json.Marshal(map[string]string{"type": "http", "url": url})
		if err != nil {
			return res, err
		}
		servers[newKey] = entryJSON
		byURL[url] = newKey
		res.Added = append(res.Added, newKey)
		res.Changed = true
	}

	if res.Changed {
		serversRaw, err := json.MarshalIndent(servers, "", "  ")
		if err != nil {
			return res, err
		}
		doc["mcpServers"] = serversRaw
		out, err := json.MarshalIndent(doc, "", "  ")
		if err != nil {
			return res, err
		}
		if err := os.WriteFile(path, out, 0o600); err != nil {
			return res, fmt.Errorf("sync-connectors: write ~/.claude.json: %w", err)
		}
	}
	return res, nil
}

func sortedKeys(m map[string]string) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

// rawEntryURL pulls the "url" field out of a raw mcpServers entry without forcing
// it through mcpclient.ServerEntry, whose non-omitempty tags would reserialize
// every untouched sibling entry if used for the whole map.
func rawEntryURL(raw json.RawMessage) string {
	var e struct {
		URL string `json:"url"`
	}
	if json.Unmarshal(raw, &e) != nil {
		return ""
	}
	return e.URL
}

// uniqueKey returns base if free in servers, else base with a numeric suffix.
func uniqueKey(servers map[string]json.RawMessage, base string) string {
	if _, exists := servers[base]; !exists {
		return base
	}
	for i := 2; ; i++ {
		candidate := fmt.Sprintf("%s_%d", base, i)
		if _, exists := servers[candidate]; !exists {
			return candidate
		}
	}
}
