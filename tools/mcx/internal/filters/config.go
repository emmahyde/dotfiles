package filters

import (
	"fmt"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

// Config maps full MCP tool keys such as "mcp__jira__getJiraIssue" to result filters.
type Config map[string]Filter

// Load merges filter configs by precedence, most-specific winning per tool key:
//
//	base (plugin default) -> <cwd>/.mcx/filters.yml -> <configDir>/mcx/filters.yml
//
// base may be "" (no plugin default). A missing file at any layer is skipped,
// not an error — so a fresh install with only shipped defaults still works.
// Merge is per tool key: a later layer's entry replaces an earlier layer's entry
// for the same tool wholesale (it does not field-merge two filters).
func Load(base string) (Config, error) {
	sources := []string{}
	if base != "" {
		sources = append(sources, base)
	}
	if cwd, err := os.Getwd(); err == nil {
		sources = append(sources, filepath.Join(cwd, ".mcx", "filters.yml"))
	}
	sources = append(sources, filepath.Join(userConfigDir(), "filters.yml"))

	merged := Config{}
	for _, src := range sources {
		c, err := loadFile(src)
		if err != nil {
			return nil, err
		}
		for tool, mod := range c {
			merged[tool] = mod
		}
	}
	return merged, nil
}

// loadFile reads one filters.yml. A missing file yields an empty
// config and no error; a present-but-malformed file is a hard error so a typo in
// a config the user wrote is surfaced rather than silently ignored.
func loadFile(path string) (Config, error) {
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return Config{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", path, err)
	}
	var c Config
	if err := yaml.Unmarshal(data, &c); err != nil {
		return nil, fmt.Errorf("parse %s: %w", path, err)
	}
	if c == nil {
		return Config{}, nil
	}
	return c, nil
}

// userConfigDir is mcx's per-user state directory (~/.config/mcx), honoring
// XDG_CONFIG_HOME — matching the copies in internal/keychain and internal/registry.
func userConfigDir() string {
	if x := os.Getenv("XDG_CONFIG_HOME"); x != "" {
		return filepath.Join(x, "mcx")
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return filepath.Join(os.TempDir(), "mcx")
	}
	return filepath.Join(home, ".config", "mcx")
}
