//go:build !darwin

package keychain

import "errors"

// errUnsupported is returned by keychain operations on non-macOS platforms.
// Forwarding via static headers from config still works there; only the
// keychain-backed OAuth path is unavailable.
var errUnsupported = errors.New("keychain OAuth is only supported on macOS")

func readKeychainImpl(string) ([]byte, error) { return nil, errUnsupported }

func writeKeychainImpl(string, string) error { return errUnsupported }

func withServiceLock(_ string, fn func() error) error { return fn() }
