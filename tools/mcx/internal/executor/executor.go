package executor

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"time"
)

const (
	defaultTimeout = 120 * time.Second
	hardCapBytes   = 200_000
)

// envTimeout reads a duration from env var name — either a Go duration ("5m",
// "90s") or a bare number treated as seconds ("300") — falling back to def when
// unset or unparseable.
func envTimeout(name string, def time.Duration) time.Duration {
	v := os.Getenv(name)
	if v == "" {
		return def
	}
	if d, err := time.ParseDuration(v); err == nil && d > 0 {
		return d
	}
	if d, err := time.ParseDuration(v + "s"); err == nil && d > 0 {
		return d
	}
	return def
}

// ExecOptions controls a single sandbox execution.
type ExecOptions struct {
	Language string
	Code     string
	CWD      string        // working directory; "" uses project root for shell, tmpdir otherwise
	Timeout  time.Duration // 0 → defaultTimeout
	Stdin    string        // fed to the script's stdin (registered tools receive their args JSON here)
}

// ExecResult is the output of one sandbox execution.
type ExecResult struct {
	Stdout    string
	Stderr    string
	ExitCode  int
	Elapsed   time.Duration
	TimedOut  bool
	Truncated bool
}

// Executor runs user-supplied code in sandboxed subprocesses.
type Executor struct {
	runtimes   map[string]Runtime
	projectCWD func() string
}

// New returns an Executor with the default runtime set (shell, python, js, ruby).
func New(projectCWD func() string) *Executor {
	return &Executor{
		runtimes:   defaultRuntimes(),
		projectCWD: projectCWD,
	}
}

// Languages returns the set of runtime keys available on this host.
func (e *Executor) Languages() []string {
	out := make([]string, 0, len(e.runtimes))
	for k := range e.runtimes {
		out = append(out, k)
	}
	return out
}

// Execute runs code in the named language sandbox and returns the result.
func (e *Executor) Execute(ctx context.Context, opts ExecOptions) (ExecResult, error) {
	rt, ok := e.runtimes[opts.Language]
	if !ok {
		return ExecResult{}, fmt.Errorf("executor: unknown language %q", opts.Language)
	}

	timeout := opts.Timeout
	if timeout == 0 {
		timeout = envTimeout("MCX_EXECUTE_TIMEOUT", defaultTimeout)
	}

	tmpDir, err := os.MkdirTemp("", "mcx-exec-*")
	if err != nil {
		return ExecResult{}, fmt.Errorf("executor: tempdir: %w", err)
	}
	defer os.RemoveAll(tmpDir)

	scriptPath := filepath.Join(tmpDir, "script"+rt.ScriptExt())
	if err := os.WriteFile(scriptPath, []byte(rt.WrapCode(opts.Code)), 0o600); err != nil {
		return ExecResult{}, fmt.Errorf("executor: write script: %w", err)
	}

	cwd := opts.CWD
	if cwd == "" {
		if opts.Language == "shell" || opts.Language == "sh" {
			cwd = e.projectCWD()
		} else {
			cwd = tmpDir
		}
	}

	execCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	cmd, err := rt.Command(execCtx, scriptPath, cwd)
	if err != nil {
		return ExecResult{}, fmt.Errorf("executor: build command: %w", err)
	}
	cmd.Env = safeEnv()
	// Place the child in its own process group so that on cancellation we can
	// kill the entire group (direct child + any forked grandchildren).
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	cmd.Cancel = func() error {
		if cmd.Process == nil {
			return nil
		}
		return syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
	}
	// After Cancel fires, give pipe-drain goroutines a short window to flush
	// before exec forcibly closes the pipes (preventing a deadlock when
	// grandchildren hold the write end of the pipe open).
	cmd.WaitDelay = 500 * time.Millisecond

	if opts.Stdin != "" {
		cmd.Stdin = strings.NewReader(opts.Stdin)
	}

	var stdout bytes.Buffer
	cmd.Stdout = &cappedWriter{buf: &stdout, cap: hardCapBytes}
	var stderr bytes.Buffer
	cmd.Stderr = &cappedWriter{buf: &stderr, cap: hardCapBytes}

	start := time.Now()
	if err := cmd.Start(); err != nil {
		return ExecResult{}, fmt.Errorf("executor: start: %w", err)
	}
	waitErr := cmd.Wait()
	elapsed := time.Since(start)

	timedOut := execCtx.Err() == context.DeadlineExceeded

	exitCode := 0
	if waitErr != nil && cmd.ProcessState != nil {
		exitCode = cmd.ProcessState.ExitCode()
	} else if waitErr != nil && !timedOut {
		exitCode = 1
	}

	out := stdout.String()
	truncated := len(out) >= hardCapBytes
	if truncated {
		out = out[:hardCapBytes] + "\n[stdout truncated]"
	}

	se := stderr.String()
	if len(se) > hardCapBytes {
		se = se[:hardCapBytes] + "\n[stderr truncated]"
	}

	return ExecResult{
		Stdout:    out,
		Stderr:    se,
		ExitCode:  exitCode,
		Elapsed:   elapsed,
		TimedOut:  timedOut,
		Truncated: truncated,
	}, nil
}

// cappedWriter is an io.Writer that accepts at most cap bytes; further writes
// are silently dropped so that a flooding subprocess cannot OOM the process.
type cappedWriter struct {
	buf *bytes.Buffer
	cap int
}

func (w *cappedWriter) Write(p []byte) (int, error) {
	total := len(p)
	remaining := w.cap - w.buf.Len()
	if remaining <= 0 {
		return total, nil // cap exhausted; pretend success so exec.Cmd does not abort
	}
	if len(p) > remaining {
		p = p[:remaining]
	}
	_, _ = w.buf.Write(p) // bytes.Buffer.Write never errors
	return total, nil
}

var _ io.Writer = (*cappedWriter)(nil)
