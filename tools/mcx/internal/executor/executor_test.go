package executor

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"
)

func newShellExec() *Executor {
	return New(func() string { return "" })
}

func TestExecuteStdinDelivery(t *testing.T) {
	ex := newShellExec()
	res, err := ex.Execute(context.Background(), ExecOptions{
		Language: "shell",
		Code:     "cat",
		Stdin:    "hello-from-stdin",
	})
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}
	if strings.TrimSpace(res.Stdout) != "hello-from-stdin" {
		t.Errorf("stdout = %q, want the stdin echoed back", res.Stdout)
	}
	if res.ExitCode != 0 {
		t.Errorf("exit = %d, want 0", res.ExitCode)
	}
}

func TestExecuteExitCodePropagates(t *testing.T) {
	ex := newShellExec()
	res, err := ex.Execute(context.Background(), ExecOptions{Language: "shell", Code: "exit 7"})
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}
	if res.ExitCode != 7 {
		t.Errorf("exit = %d, want 7", res.ExitCode)
	}
	if res.TimedOut {
		t.Error("TimedOut = true, want false")
	}
}

func TestExecuteStripsSecretsFromEnv(t *testing.T) {
	// The sandbox forwards only an allow-list (PATH/HOME/locale). API keys and
	// tokens in the parent environment must NOT reach the script — this is the
	// whole point of safeEnv, and easy to regress by widening the allow-list.
	t.Setenv("MCX_TEST_SECRET", "topsecret")
	ex := newShellExec()
	res, err := ex.Execute(context.Background(), ExecOptions{
		Language: "shell",
		Code:     `printf '%s' "$MCX_TEST_SECRET"`,
	})
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}
	if res.Stdout != "" {
		t.Errorf("secret leaked to script: stdout = %q, want empty", res.Stdout)
	}
}

func TestExecutePreservesPATH(t *testing.T) {
	// PATH must survive the allow-list or interpreter lookup breaks.
	ex := newShellExec()
	res, err := ex.Execute(context.Background(), ExecOptions{
		Language: "shell",
		Code:     `printf '%s' "$PATH"`,
	})
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}
	if res.Stdout == "" {
		t.Error("PATH was stripped; interpreter lookup would fail")
	}
}

func TestSafeEnvPrependsExecutableDir(t *testing.T) {
	// A chain's baked forward() shells to bare `mcx`; the sandbox PATH must lead
	// with the running binary's own directory so a plugin-relocated mcx resolves.
	dir := executableDir()
	if dir == "" {
		t.Skip("os.Executable() unavailable")
	}
	var path string
	for _, e := range safeEnv() {
		if strings.HasPrefix(e, "PATH=") {
			path = e[len("PATH="):]
		}
	}
	if path == "" {
		t.Fatal("PATH missing from safeEnv")
	}
	first := strings.SplitN(path, string(os.PathListSeparator), 2)[0]
	if first != dir {
		t.Errorf("PATH does not lead with executable dir: first=%q want=%q", first, dir)
	}
}

func TestExecuteTimeout(t *testing.T) {
	ex := newShellExec()
	start := time.Now()
	res, err := ex.Execute(context.Background(), ExecOptions{
		Language: "shell",
		Code:     "sleep 5",
		Timeout:  200 * time.Millisecond,
	})
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}
	if !res.TimedOut {
		t.Error("TimedOut = false, want true")
	}
	if elapsed := time.Since(start); elapsed > 3*time.Second {
		t.Errorf("took %v; process-group kill did not fire promptly", elapsed)
	}
}

func TestExecuteTimeoutKillsChildProcessGroup(t *testing.T) {
	// A backgrounded grandchild holding the stdout pipe must not keep Execute
	// blocked past the timeout — the whole process group is signalled.
	ex := newShellExec()
	start := time.Now()
	res, err := ex.Execute(context.Background(), ExecOptions{
		Language: "shell",
		Code:     "sleep 30 & wait",
		Timeout:  200 * time.Millisecond,
	})
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}
	if !res.TimedOut {
		t.Error("TimedOut = false, want true")
	}
	if elapsed := time.Since(start); elapsed > 3*time.Second {
		t.Errorf("took %v; grandchild kept the run alive", elapsed)
	}
}

func TestExecuteCapsStdout(t *testing.T) {
	ex := newShellExec()
	res, err := ex.Execute(context.Background(), ExecOptions{
		Language: "shell",
		Code:     `head -c 300000 /dev/zero | tr '\0' 'a'`,
	})
	if err != nil {
		t.Fatalf("Execute: %v", err)
	}
	if !res.Truncated {
		t.Error("Truncated = false, want true for a 300KB flood")
	}
	if len(res.Stdout) > hardCapBytes+len("\n[stdout truncated]") {
		t.Errorf("stdout len = %d, exceeds cap+marker", len(res.Stdout))
	}
}

func TestExecuteUnknownLanguage(t *testing.T) {
	ex := newShellExec()
	_, err := ex.Execute(context.Background(), ExecOptions{Language: "cobol", Code: "x"})
	if err == nil {
		t.Fatal("expected error for unknown language, got nil")
	}
	if !strings.Contains(err.Error(), "unknown language") {
		t.Errorf("error = %q, want 'unknown language'", err)
	}
}

func TestBakedArgsAndEmit(t *testing.T) {
	// Every scripting runtime bakes `args` (parsed stdin JSON) and `emit`; a chain
	// reads neither stdin nor JSON itself. Regresses if a preamble is dropped.
	ex := newShellExec()
	cases := []struct{ lang, code string }{
		{"ruby", `emit(args["name"])`},
		{"python", `emit(args["name"])`},
		{"javascript", `emit(args.name)`},
	}
	for _, c := range cases {
		t.Run(c.lang, func(t *testing.T) {
			if !hasLang(ex, c.lang) {
				t.Skipf("%s runtime not available on this host", c.lang)
			}
			res, err := ex.Execute(context.Background(), ExecOptions{
				Language: c.lang,
				Code:     c.code,
				Stdin:    `{"name":"world"}`,
			})
			if err != nil {
				t.Fatalf("Execute: %v", err)
			}
			if strings.TrimSpace(res.Stdout) != "world" {
				t.Errorf("stdout = %q, want world (baked args+emit)", res.Stdout)
			}
		})
	}
}

func hasLang(ex *Executor, lang string) bool {
	for _, l := range ex.Languages() {
		if l == lang {
			return true
		}
	}
	return false
}
