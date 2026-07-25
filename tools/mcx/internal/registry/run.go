package registry

import (
	"context"
	"fmt"

	"github.com/emmahyde/mcx/internal/executor"
)

// Run executes the resolved chain named name, feeding argsJSON to the script's
// stdin, and returns the execution result.
func (s *Store) Run(ctx context.Context, exec *executor.Executor, name, argsJSON string) (executor.ExecResult, error) {
	t, ok, err := s.Get(name)
	if err != nil {
		return executor.ExecResult{}, err
	}
	if !ok {
		return executor.ExecResult{}, fmt.Errorf("registry: no chain named %q", name)
	}
	if argsJSON == "" {
		argsJSON = "{}"
	}
	return exec.Execute(ctx, executor.ExecOptions{
		Language: t.Language,
		Code:     t.code,
		Stdin:    argsJSON,
	})
}
