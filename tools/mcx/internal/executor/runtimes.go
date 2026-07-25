package executor

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

// Runtime knows how to execute code in one language.
type Runtime interface {
	Name() string
	ScriptExt() string
	WrapCode(code string) string
	// Command returns an exec.Cmd configured with the given context.
	// scriptPath is the on-disk script; cwd is the working directory.
	Command(ctx context.Context, scriptPath, cwd string) (*exec.Cmd, error)
}

// ShellRuntime executes code as a POSIX shell script.
type ShellRuntime struct{}

func (ShellRuntime) Name() string             { return "shell" }
func (ShellRuntime) ScriptExt() string        { return ".sh" }
func (ShellRuntime) WrapCode(s string) string { return s }
func (ShellRuntime) Command(ctx context.Context, script, cwd string) (*exec.Cmd, error) {
	cmd := exec.CommandContext(ctx, "/bin/sh", script)
	cmd.Dir = cwd
	return cmd, nil
}

// PythonRuntime executes code via uv or system python3.
type PythonRuntime struct{ interpreter string }

func NewPythonRuntime() (*PythonRuntime, error) {
	for _, name := range []string{"uv", "python3", "python"} {
		if p, err := exec.LookPath(name); err == nil {
			return &PythonRuntime{interpreter: p}, nil
		}
	}
	return nil, fmt.Errorf("python runtime: no python3 or uv found in PATH")
}

func (r *PythonRuntime) Name() string      { return "python" }
func (r *PythonRuntime) ScriptExt() string { return ".py" }

// pythonPreamble bakes forward/emit/args so Python chains need no client plumbing.
const pythonPreamble = `import json as _json, subprocess as _subprocess, sys as _sys

def forward(server, tool, args=None):
    _raw = _subprocess.run(["mcx", "forward", "--server", str(server), "--tool", str(tool), "--args", _json.dumps(args or {})], capture_output=True, text=True).stdout
    _res = _json.loads(_raw)
    if _res.get("isError"):
        raise RuntimeError("mcx forward %s.%s: %s" % (server, tool, (_res.get("content") or [{}])[0].get("text")))
    _txt = (_res.get("content") or [{}])[0].get("text")
    return _json.loads(_txt) if _txt else _res

def emit(obj):
    print(obj if isinstance(obj, str) else _json.dumps(obj))

_mcx_in = _sys.stdin.read()
args = _json.loads(_mcx_in) if _mcx_in.strip() else {}
`

func (r *PythonRuntime) WrapCode(s string) string { return pythonPreamble + s }
func (r *PythonRuntime) Command(ctx context.Context, script, cwd string) (*exec.Cmd, error) {
	var cmd *exec.Cmd
	if filepath.Base(r.interpreter) == "uv" {
		cmd = exec.CommandContext(ctx, r.interpreter, "run", "python3", script)
	} else {
		cmd = exec.CommandContext(ctx, r.interpreter, script)
	}
	cmd.Dir = cwd
	return cmd, nil
}

// JSRuntime executes code via bun (preferred) or node.
type JSRuntime struct{ interpreter string }

func NewJSRuntime() (*JSRuntime, error) {
	for _, name := range []string{"bun", "node"} {
		if p, err := exec.LookPath(name); err == nil {
			return &JSRuntime{interpreter: p}, nil
		}
	}
	return nil, fmt.Errorf("js runtime: no bun or node found in PATH")
}

func (r *JSRuntime) Name() string      { return "javascript" }
func (r *JSRuntime) ScriptExt() string { return ".mjs" }

// jsPreamble bakes forward/emit/args so JS chains (ESM) need no client plumbing.
const jsPreamble = `import { execFileSync as _execFileSync } from "node:child_process";
import { readFileSync as _readFileSync } from "node:fs";
function forward(server, tool, args = {}) {
  const raw = _execFileSync("mcx", ["forward", "--server", String(server), "--tool", String(tool), "--args", JSON.stringify(args)], { encoding: "utf8" });
  const res = JSON.parse(raw);
  if (res.isError) throw new Error("mcx forward " + server + "." + tool + ": " + (res.content?.[0]?.text ?? ""));
  const txt = res.content?.[0]?.text;
  return txt ? JSON.parse(txt) : res;
}
function emit(obj) {
  process.stdout.write((typeof obj === "string" ? obj : JSON.stringify(obj)) + "\n");
}
const _mcxIn = _readFileSync(0, "utf8");
const args = _mcxIn.trim() ? JSON.parse(_mcxIn) : {};
`

func (r *JSRuntime) WrapCode(s string) string { return jsPreamble + s }
func (r *JSRuntime) Command(ctx context.Context, script, cwd string) (*exec.Cmd, error) {
	cmd := exec.CommandContext(ctx, r.interpreter, script)
	cmd.Dir = cwd
	return cmd, nil
}

// RubyRuntime executes code via ruby.
type RubyRuntime struct{ interpreter string }

func NewRubyRuntime() (*RubyRuntime, error) {
	for _, name := range []string{"ruby", "ruby3", "ruby3.2", "ruby3.1"} {
		if p, err := exec.LookPath(name); err == nil {
			return &RubyRuntime{interpreter: p}, nil
		}
	}
	return nil, fmt.Errorf("ruby runtime: no ruby found in PATH")
}

func (r *RubyRuntime) Name() string      { return "ruby" }
func (r *RubyRuntime) ScriptExt() string { return ".rb" }

// rubyPreamble is baked in front of every Ruby script so registered tools can
// call `forward`/`emit` without redefining the mcx client plumbing. It shells
// back to `mcx forward` (which must be on PATH) and raises on tool errors.
const rubyPreamble = `require "json"
module MCX
  module_function
  def forward(server, tool, args = {})
    raw = IO.popen(["mcx", "forward", "--server", server.to_s, "--tool", tool.to_s, "--args", JSON.generate(args)], &:read)
    res = JSON.parse(raw)
    raise "mcx forward #{server}.#{tool}: #{res.dig('content', 0, 'text')}" if res["isError"]
    txt = res.dig("content", 0, "text")
    txt ? JSON.parse(txt) : res
  end
  def emit(obj) = $stdout.puts(obj.is_a?(String) ? obj : JSON.generate(obj))
end
def forward(server, tool, args = {}) = MCX.forward(server, tool, args)
def emit(obj) = MCX.emit(obj)
_mcx_in = $stdin.read
args = _mcx_in.empty? ? {} : JSON.parse(_mcx_in)
`

func (r *RubyRuntime) WrapCode(s string) string { return rubyPreamble + s }
func (r *RubyRuntime) Command(ctx context.Context, script, cwd string) (*exec.Cmd, error) {
	cmd := exec.CommandContext(ctx, r.interpreter, script)
	cmd.Dir = cwd
	return cmd, nil
}

func defaultRuntimes() map[string]Runtime {
	m := map[string]Runtime{
		"shell": ShellRuntime{},
		"sh":    ShellRuntime{},
	}
	if rt, err := NewPythonRuntime(); err == nil {
		m["python"] = rt
	}
	if rt, err := NewJSRuntime(); err == nil {
		m["javascript"] = rt
		m["js"] = rt
		m["typescript"] = rt
		m["ts"] = rt
	}
	if rt, err := NewRubyRuntime(); err == nil {
		m["ruby"] = rt
		m["rb"] = rt
	}
	return m
}

// safeEnv returns a minimal allow-listed environment for sandboxed subprocesses.
// Only variables required for correct interpreter lookup and locale are forwarded;
// all others (API keys, tokens, injection vectors, etc.) are default-denied.
func safeEnv() []string {
	allow := map[string]bool{
		"PATH": true, "HOME": true,
		"TMPDIR": true, "TMP": true, "TEMP": true,
		"LANG": true, "LC_ALL": true, "LC_CTYPE": true,
		"TERM": true, "USER": true, "SHELL": true,
		// Offline-benchmark seam: lets the nested `mcx forward` replay from a
		// fixture instead of calling the network. Unset in normal operation.
		"MCX_FORWARD_REPLAY": true,
	}
	env := os.Environ()
	out := make([]string, 0, len(allow))
	pathIdx := -1
	for _, e := range env {
		if allow[envKey(e)] {
			if envKey(e) == "PATH" {
				pathIdx = len(out)
			}
			out = append(out, e)
		}
	}
	// A chain's baked forward() shells to bare `mcx`; when mcx runs from a plugin
	// scripts/ dir that isn't on the user's PATH, prepend the running binary's own
	// directory so the sandbox resolves the same mcx.
	if dir := executableDir(); dir != "" {
		if pathIdx >= 0 {
			out[pathIdx] = "PATH=" + dir + string(os.PathListSeparator) + out[pathIdx][len("PATH="):]
		} else {
			out = append(out, "PATH="+dir)
		}
	}
	return out
}

// executableDir is the directory of the running mcx binary, or "" if it cannot
// be determined (in which case PATH is left as the inherited allow-listed value).
func executableDir() string {
	exe, err := os.Executable()
	if err != nil {
		return ""
	}
	return filepath.Dir(exe)
}

func envKey(e string) string {
	for i := range e {
		if e[i] == '=' {
			return e[:i]
		}
	}
	return e
}
