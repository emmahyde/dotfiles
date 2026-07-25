//go:build darwin

package keychain

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"syscall"
)

// readKeychainImpl returns the raw payload of the "-w" (password) field for service.
func readKeychainImpl(service string) ([]byte, error) {
	cmd := exec.Command("security", "find-generic-password", "-s", service, "-w")
	var out, errBuf bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &errBuf
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("security find-generic-password: %w: %s", err, bytes.TrimSpace(errBuf.Bytes()))
	}
	return bytes.TrimSpace(out.Bytes()), nil
}

// writeKeychainImpl updates (or creates) the service item's password payload.
func writeKeychainImpl(service, payload string) error {
	account := os.Getenv("USER")
	cmd := exec.Command("security", "add-generic-password",
		"-U", "-s", service, "-a", account, "-w", payload)
	var errBuf bytes.Buffer
	cmd.Stderr = &errBuf
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("security add-generic-password: %w: %s", err, bytes.TrimSpace(errBuf.Bytes()))
	}
	return nil
}

// withServiceLock runs fn while holding an exclusive lock keyed on service, so
// concurrent mcx invocations cannot both spend a rotating refresh token.
func withServiceLock(service string, fn func() error) error {
	dir := filepath.Join(configDir(), "locks")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return fmt.Errorf("lock dir: %w", err)
	}
	path := filepath.Join(dir, sanitize(service)+".lock")
	f, err := os.OpenFile(path, os.O_CREATE|os.O_RDWR, 0o600)
	if err != nil {
		return fmt.Errorf("open lock: %w", err)
	}
	defer f.Close()
	if err := syscall.Flock(int(f.Fd()), syscall.LOCK_EX); err != nil {
		return fmt.Errorf("acquire lock: %w", err)
	}
	defer syscall.Flock(int(f.Fd()), syscall.LOCK_UN)
	return fn()
}

func sanitize(s string) string {
	out := make([]rune, 0, len(s))
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9', r == '-', r == '_':
			out = append(out, r)
		default:
			out = append(out, '_')
		}
	}
	return string(out)
}
