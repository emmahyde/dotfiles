package mcpclient

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// simpleConfig is the shape of a plain `.mcp.json` / claude_desktop_config.json.
type simpleConfig struct {
	MCPServers map[string]ServerEntry `json:"mcpServers"`
}

// claudeJSONConfig is the shape of ~/.claude.json: a top-level global mcpServers
// map plus a per-project map keyed by absolute project path, each carrying its
// own mcpServers.
type claudeJSONConfig struct {
	MCPServers map[string]ServerEntry `json:"mcpServers"`
	Projects   map[string]struct {
		MCPServers map[string]ServerEntry `json:"mcpServers"`
	} `json:"projects"`
}

func loadSimple(path string) map[string]ServerEntry {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	var cfg simpleConfig
	if json.Unmarshal(data, &cfg) != nil {
		return nil
	}
	return cfg.MCPServers
}

func loadClaudeJSON(path string) *claudeJSONConfig {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	var cfg claudeJSONConfig
	if json.Unmarshal(data, &cfg) != nil {
		return nil
	}
	return &cfg
}

// ResolveServer finds a server by name across every MCP config source, in
// precedence order:
//  1. <cwd>/.mcp.json                    (project-local, checked in)
//  2. ~/.claude.json → projects[<cwd>]   (this project's servers)
//  3. ~/.claude.json → global mcpServers
//  4. ~/.claude.json → projects[<other>] (other projects; keys sorted)
//  5. ~/.claude/claude_desktop_config.json
//  6. ~/.claude/.mcp.json
//
// First match wins. Missing or unparseable files are skipped, not fatal.
func ResolveServer(name, cwd string) (ServerEntry, error) {
	home, _ := os.UserHomeDir()
	var tried []string

	try := func(m map[string]ServerEntry, label string) (ServerEntry, bool) {
		if m == nil {
			return ServerEntry{}, false
		}
		tried = append(tried, label)
		e, ok := m[name]
		return e, ok
	}

	if e, ok := try(loadSimple(filepath.Join(cwd, ".mcp.json")), filepath.Join(cwd, ".mcp.json")); ok {
		return e, nil
	}

	if home != "" {
		if cj := loadClaudeJSON(filepath.Join(home, ".claude.json")); cj != nil {
			if proj, ok := cj.Projects[cwd]; ok {
				if e, ok := try(proj.MCPServers, "~/.claude.json:projects["+cwd+"]"); ok {
					return e, nil
				}
			}
			if e, ok := try(cj.MCPServers, "~/.claude.json:mcpServers"); ok {
				return e, nil
			}
			others := make([]string, 0, len(cj.Projects))
			for p := range cj.Projects {
				if p != cwd {
					others = append(others, p)
				}
			}
			sort.Strings(others)
			for _, p := range others {
				if e, ok := try(cj.Projects[p].MCPServers, "~/.claude.json:projects["+p+"]"); ok {
					return e, nil
				}
			}
		}

		for _, path := range []string{
			filepath.Join(home, ".claude", "claude_desktop_config.json"),
			filepath.Join(home, ".claude", ".mcp.json"),
		} {
			if e, ok := try(loadSimple(path), path); ok {
				return e, nil
			}
		}
	}

	if len(tried) == 0 {
		return ServerEntry{}, fmt.Errorf("server %q: no MCP config files found", name)
	}
	return ServerEntry{}, fmt.Errorf("server %q not found; searched: %s", name, strings.Join(tried, ", "))
}

// ListServers returns the union of server names across every config source,
// with the config entry for each (first match wins on name collision).
func ListServers(cwd string) map[string]ServerEntry {
	home, _ := os.UserHomeDir()
	out := map[string]ServerEntry{}
	add := func(m map[string]ServerEntry) {
		for name, e := range m {
			if _, seen := out[name]; !seen {
				out[name] = e
			}
		}
	}

	add(loadSimple(filepath.Join(cwd, ".mcp.json")))
	if home != "" {
		if cj := loadClaudeJSON(filepath.Join(home, ".claude.json")); cj != nil {
			if proj, ok := cj.Projects[cwd]; ok {
				add(proj.MCPServers)
			}
			add(cj.MCPServers)
			others := make([]string, 0, len(cj.Projects))
			for p := range cj.Projects {
				if p != cwd {
					others = append(others, p)
				}
			}
			sort.Strings(others)
			for _, p := range others {
				add(cj.Projects[p].MCPServers)
			}
		}
		add(loadSimple(filepath.Join(home, ".claude", "claude_desktop_config.json")))
		add(loadSimple(filepath.Join(home, ".claude", ".mcp.json")))
	}
	return out
}
