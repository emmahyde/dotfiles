package keychain

import (
	"os"
	"path/filepath"
)

// configDir is mcx's per-user state directory (~/.config/mcx), honoring
// XDG_CONFIG_HOME. Used for the refresh lock files.
func configDir() string {
	if x := os.Getenv("XDG_CONFIG_HOME"); x != "" {
		return filepath.Join(x, "mcx")
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return filepath.Join(os.TempDir(), "mcx")
	}
	return filepath.Join(home, ".config", "mcx")
}
