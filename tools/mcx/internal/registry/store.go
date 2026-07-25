// Package registry is a durable store of named, runnable chains — the
// register_tool-style piece that promotes a proven script into a callable tool.
//
// Chains resolve across three layers, merged by name with the most specific
// winning: plugin default (CLAUDE_PLUGIN_ROOT, or the newest installed cache when
// unset — see PluginRoot) -> project (<cwd>/.mcx) -> user (~/.config/mcx). Each
// layer supplies chains two ways: entries in a chains.yaml
// (keyed by name, carrying an inline "source" or a "path" to a file; legacy
// chains.json is still read), and loose script files under a chains/ subdirectory
// (metadata inferred from the file).
// Writes (register/remove) always target the user layer.
package registry

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

// Tool is one chain's record. Exactly one of Source (inline script body) or Path
// (a file relative to its layer dir) is persisted; both resolve to the same
// executable code at load time.
type Tool struct {
	Name        string          `json:"name,omitempty"`
	Description string          `json:"description,omitempty"`
	Language    string          `json:"language,omitempty"`
	Schema      json.RawMessage `json:"schema,omitempty"`
	Path        string          `json:"path,omitempty"`
	Source      string          `json:"source,omitempty"`

	origin string // which layer resolved this chain: plugin | project | user
	code   string // resolved script body for execution
}

// Origin reports which layer a chain resolved from (plugin|project|user).
func (t Tool) Origin() string { return t.origin }

// Code is the resolved script body to execute.
func (t Tool) Code() string { return t.code }

// Store is the writable user layer; reads merge it with the project and plugin
// layers.
type Store struct {
	root string
}

// Open returns a Store whose writes land in the user layer (~/.config/mcx,
// honoring XDG_CONFIG_HOME), creating it if needed.
func Open() (*Store, error) {
	s := &Store{root: userDir()}
	if err := os.MkdirAll(s.root, 0o700); err != nil {
		return nil, fmt.Errorf("registry: create config dir: %w", err)
	}
	return s, nil
}

type layer struct {
	root   string
	origin string
}

// layers lists the resolution order, lowest precedence first.
func layers() []layer {
	var ls []layer
	if p := PluginRoot(); p != "" {
		ls = append(ls, layer{root: p, origin: "plugin"})
	}
	if cwd, err := os.Getwd(); err == nil {
		ls = append(ls, layer{root: filepath.Join(cwd, ".mcx"), origin: "project"})
	}
	ls = append(ls, layer{root: userDir(), origin: "user"})
	return ls
}

// PluginRoot resolves the plugin-default layer's root directory: CLAUDE_PLUGIN_ROOT
// when Claude Code set it (hooks and slash commands run with it), otherwise the
// newest installed mcx plugin cache. The fallback is what lets `mcx list`/`mcx run`
// see the shipped chains from a plain shell, where that env var is never set.
// Returns "" when no plugin is installed.
func PluginRoot() string {
	if p := os.Getenv("CLAUDE_PLUGIN_ROOT"); p != "" {
		return p
	}
	return newestPluginCache()
}

// newestPluginCache finds the most recently modified installed mcx plugin under
// ~/.claude/plugins/cache/<marketplace>/mcx/<version>, matching the version the
// plugin's own hooks would run (the /setup wrapper picks the same way). A match
// must contain scripts/mcx so a half-populated cache dir is ignored.
func newestPluginCache() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	matches, _ := filepath.Glob(filepath.Join(home, ".claude", "plugins", "cache", "*", "mcx", "*"))
	var newest string
	var newestMod time.Time
	for _, m := range matches {
		info, err := os.Stat(m)
		if err != nil || !info.IsDir() {
			continue
		}
		if _, err := os.Stat(filepath.Join(m, "scripts", "mcx")); err != nil {
			continue
		}
		if newest == "" || info.ModTime().After(newestMod) {
			newest, newestMod = m, info.ModTime()
		}
	}
	return newest
}

// resolveAll merges every layer's chains by name; a higher-precedence layer's
// entry replaces a lower one's.
func resolveAll() map[string]Tool {
	merged := map[string]Tool{}
	for _, l := range layers() {
		for name, t := range loadLayer(l) {
			merged[name] = t
		}
	}
	return merged
}

var scriptExts = map[string]bool{
	".rb": true, ".py": true, ".js": true, ".mjs": true, ".ts": true, ".sh": true,
}

// loadLayer resolves one layer's chains: chains.json entries first, then any
// loose scripts under <root>/chains/ not already named by the JSON. A single
// broken entry or an unparseable chains.json is warned about on stderr and
// skipped, never fatal — one typo in one layer must not hide every other chain.
func loadLayer(l layer) map[string]Tool {
	out := map[string]Tool{}

	entries, err := loadChainsConfig(l.root)
	if err != nil {
		warn("skipping %s layer chains config: %v", l.origin, err)
		entries = map[string]Tool{}
	}
	claimedPaths := map[string]bool{}
	for name, t := range entries {
		t.Name, t.origin = name, l.origin
		switch {
		case t.Source != "":
			t.code = t.Source
		case t.Path != "":
			data, err := os.ReadFile(filepath.Join(l.root, t.Path))
			if err != nil {
				warn("skipping %s chain %q: %v", l.origin, name, err)
				continue
			}
			t.code = string(data)
			if t.Language == "" {
				t.Language, _ = LangFromExt(t.Path)
			}
			claimedPaths[filepath.Clean(t.Path)] = true
		}
		if t.Description == "" {
			t.Description = DescFromSource(t.code)
		}
		out[name] = t
	}

	dir := filepath.Join(l.root, "chains")
	files, _ := os.ReadDir(dir)
	for _, f := range files {
		if f.IsDir() || !scriptExts[strings.ToLower(filepath.Ext(f.Name()))] {
			continue
		}
		// Claimed by path, not name — a snake_case key and this file's kebab-case InferName must not both register.
		if claimedPaths[filepath.Clean(filepath.Join("chains", f.Name()))] {
			continue
		}
		name := InferName(f.Name())
		if _, taken := out[name]; taken {
			continue
		}
		data, err := os.ReadFile(filepath.Join(dir, f.Name()))
		if err != nil {
			warn("skipping %s chain script %q: %v", l.origin, f.Name(), err)
			continue
		}
		lang, _ := LangFromExt(f.Name())
		out[name] = Tool{
			Name:        name,
			Description: DescFromSource(string(data)),
			Language:    lang,
			Schema:      json.RawMessage(`{"type":"object"}`),
			Path:        filepath.Join("chains", f.Name()),
			origin:      l.origin,
			code:        string(data),
		}
	}
	return out
}

// warn reports a non-fatal resolution problem to stderr without failing the
// whole command.
func warn(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "mcx: "+format+"\n", args...)
}

// chainsFiles is the config filename precedence within a layer: YAML first,
// then legacy JSON (YAML is a JSON superset, so one parser handles both).
var chainsFiles = []string{"chains.yaml", "chains.yml", "chains.json"}

// loadChainsConfig reads a layer's chain config (the first of chains.yaml/.yml/
// .json that exists) into name→Tool entries.
func loadChainsConfig(root string) (map[string]Tool, error) {
	for _, name := range chainsFiles {
		path := filepath.Join(root, name)
		data, err := os.ReadFile(path)
		if os.IsNotExist(err) {
			continue
		}
		if err != nil {
			return nil, fmt.Errorf("registry: read %s: %w", path, err)
		}
		m, err := parseChains(data)
		if err != nil {
			return nil, fmt.Errorf("registry: parse %s: %w", path, err)
		}
		return m, nil
	}
	return map[string]Tool{}, nil
}

// parseChains decodes YAML (or JSON) chain entries. It bridges through a generic
// value then JSON so the Tool struct's json tags and json.RawMessage Schema keep
// working regardless of source format.
func parseChains(data []byte) (map[string]Tool, error) {
	var generic map[string]any
	if err := yaml.Unmarshal(data, &generic); err != nil {
		return nil, err
	}
	if generic == nil {
		return map[string]Tool{}, nil
	}
	jb, err := json.Marshal(generic)
	if err != nil {
		return nil, err
	}
	var m map[string]Tool
	if err := json.Unmarshal(jb, &m); err != nil {
		return nil, err
	}
	if m == nil {
		m = map[string]Tool{}
	}
	return m, nil
}

func (s *Store) chainsPath() string { return filepath.Join(s.root, "chains.yaml") }

// userEntries loads only the user layer's chain config (the writable set).
func (s *Store) userEntries() (map[string]Tool, error) {
	return loadChainsConfig(s.root)
}

func (s *Store) save(m map[string]Tool) error {
	// Bridge each entry through JSON so Schema (json.RawMessage) decodes into a
	// real nested value; yaml.Marshal then emits multi-line source as a literal
	// block scalar, so the config stays human-authorable.
	clean := make(map[string]any, len(m))
	for name, t := range m {
		t.Name = "" // the key carries the name; don't duplicate it in the value
		jb, err := json.Marshal(t)
		if err != nil {
			return fmt.Errorf("registry: marshal chain %q: %w", name, err)
		}
		var v any
		if err := json.Unmarshal(jb, &v); err != nil {
			return fmt.Errorf("registry: bridge chain %q: %w", name, err)
		}
		clean[name] = v
	}
	data, err := yaml.Marshal(clean)
	if err != nil {
		return fmt.Errorf("registry: marshal chains: %w", err)
	}
	tmp := s.chainsPath() + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return fmt.Errorf("registry: write chains: %w", err)
	}
	if err := os.Rename(tmp, s.chainsPath()); err != nil {
		return fmt.Errorf("registry: replace chains: %w", err)
	}
	return nil
}

// List returns all resolved chains across layers, sorted by name.
func (s *Store) List() ([]Tool, error) {
	m := resolveAll()
	out := make([]Tool, 0, len(m))
	for _, t := range m {
		out = append(out, t)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out, nil
}

// Get returns the resolved chain named name.
func (s *Store) Get(name string) (Tool, bool, error) {
	t, ok := resolveAll()[name]
	return t, ok, nil
}

// Register stores scriptSrc as a chain in the user layer, inline in chains.yaml,
// replacing any existing user entry of the same name. schema may be nil
// (defaults to a permissive object schema). ext is unused for inline storage but
// kept in the signature so callers can pass an inferred extension.
func (s *Store) Register(name, description, language, ext, scriptSrc string, schema json.RawMessage) (Tool, error) {
	_ = ext
	if !validName(name) {
		return Tool{}, fmt.Errorf("registry: invalid tool name %q (use letters, digits, -, _)", name)
	}
	src, err := os.ReadFile(scriptSrc)
	if err != nil {
		return Tool{}, fmt.Errorf("registry: read script %q: %w", scriptSrc, err)
	}
	if len(schema) == 0 {
		schema = json.RawMessage(`{"type":"object"}`)
	} else if !json.Valid(schema) {
		return Tool{}, fmt.Errorf("registry: schema is not valid JSON")
	}

	m, err := s.userEntries()
	if err != nil {
		return Tool{}, err
	}
	t := Tool{Name: name, Description: description, Language: language, Schema: schema, Source: string(src)}
	m[name] = t
	if err := s.save(m); err != nil {
		return Tool{}, err
	}
	t.origin, t.code = "user", string(src)
	return t, nil
}

// Remove deletes a chain from the user layer. A chain that resolves only from the
// plugin or project layer cannot be removed here (it isn't ours to delete).
func (s *Store) Remove(name string) error {
	m, err := s.userEntries()
	if err != nil {
		return err
	}
	if _, ok := m[name]; !ok {
		return fmt.Errorf("registry: no user chain named %q (plugin/project chains can't be removed)", name)
	}
	delete(m, name)
	return s.save(m)
}

func validName(name string) bool {
	if name == "" {
		return false
	}
	for _, r := range name {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9', r == '-', r == '_':
		default:
			return false
		}
	}
	return !strings.ContainsAny(name, "/\\")
}

// userDir is mcx's per-user state directory (~/.config/mcx), honoring
// XDG_CONFIG_HOME — matching the copies in internal/keychain and internal/filters.
func userDir() string {
	if x := os.Getenv("XDG_CONFIG_HOME"); x != "" {
		return filepath.Join(x, "mcx")
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return filepath.Join(os.TempDir(), "mcx")
	}
	return filepath.Join(home, ".config", "mcx")
}

var extToLang = map[string]string{
	".py": "python",
	".js": "javascript", ".mjs": "javascript",
	".ts": "typescript",
	".rb": "ruby",
	".sh": "shell",
}

// LangFromExt maps a script path's extension to its canonical language.
func LangFromExt(path string) (string, bool) {
	l, ok := extToLang[strings.ToLower(filepath.Ext(path))]
	return l, ok
}

// InferFromFile reads a script and infers its chain name, language, extension,
// and description, so `register <path>` needs no other input.
func InferFromFile(path string) (name, language, ext, desc string, err error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", "", "", "", fmt.Errorf("registry: read script %q: %w", path, err)
	}
	name = InferName(path)
	ext = strings.ToLower(filepath.Ext(path))
	language, _ = LangFromExt(path)
	desc = DescFromSource(string(data))
	return name, language, ext, desc, nil
}

// InferName turns a script filename into a chain name: drop the extension,
// lowercase, and turn underscores/spaces into hyphens (sprint_to_sheet.rb -> sprint-to-sheet).
func InferName(path string) string {
	base := filepath.Base(path)
	base = strings.TrimSuffix(base, filepath.Ext(base))
	base = strings.ToLower(base)
	base = strings.ReplaceAll(base, "_", "-")
	base = strings.ReplaceAll(base, " ", "-")
	return base
}

// DescFromSource returns a script's first real comment line as its description,
// skipping a shebang and interpreter pragmas (frozen_string_literal, encoding).
// Returns "" if the script opens with code or has no leading comment.
func DescFromSource(code string) string {
	sc := bufio.NewScanner(strings.NewReader(code))
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" || strings.HasPrefix(line, "#!") {
			continue
		}
		matched := false
		for _, marker := range []string{"#", "//", "--"} {
			if strings.HasPrefix(line, marker) {
				text := strings.TrimSpace(strings.TrimPrefix(line, marker))
				if isMagicComment(text) {
					matched = true
					break
				}
				return text
			}
		}
		if matched {
			continue
		}
		return ""
	}
	return ""
}

// isMagicComment reports whether a comment is an interpreter pragma rather than a
// human description.
func isMagicComment(text string) bool {
	low := strings.ToLower(text)
	return strings.Contains(low, "frozen_string_literal") ||
		strings.Contains(low, "coding:") ||
		strings.Contains(low, "-*-")
}
