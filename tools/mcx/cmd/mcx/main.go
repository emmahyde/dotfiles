// Command mcx is a standalone CLI that (1) forwards a tool call to any external
// MCP server discovered from Claude Code's config, injecting macOS-keychain
// OAuth tokens when present, and (2) runs ad-hoc scripts or registers, lists,
// runs, and removes durable local scripts as named tools. mcx is an MCP *client*;
// it is never an MCP server.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/emmahyde/dotfiles/tools/mcx/internal/connectors"
	"github.com/emmahyde/dotfiles/tools/mcx/internal/executor"
	"github.com/emmahyde/dotfiles/tools/mcx/internal/filters"
	"github.com/emmahyde/dotfiles/tools/mcx/internal/keychain"
	"github.com/emmahyde/dotfiles/tools/mcx/internal/mcpclient"
	"github.com/emmahyde/dotfiles/tools/mcx/internal/nudge"
	"github.com/emmahyde/dotfiles/tools/mcx/internal/observe"
	"github.com/emmahyde/dotfiles/tools/mcx/internal/registry"
	"github.com/emmahyde/dotfiles/tools/mcx/internal/scan"
	"github.com/emmahyde/dotfiles/tools/mcx/internal/skillsync"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}
	cmd, args := os.Args[1], os.Args[2:]
	var err error
	switch cmd {
	case "forward":
		err = cmdForward(args)
	case "register":
		err = cmdRegister(args)
	case "list":
		err = cmdList(args)
	case "run":
		err = cmdRun(args)
	case "remove":
		err = cmdRemove(args)
	case "filter":
		err = cmdFilter(args)
	case "nudge":
		err = cmdNudge(args)
	case "observe":
		err = cmdObserve(args)
	case "scan":
		err = cmdScan(args)
	case "doctor":
		err = cmdDoctor(args)
	case "sync-connectors":
		err = cmdSyncConnectors(args)
	case "-h", "--help", "help":
		usage()
		return
	default:
		fmt.Fprintf(os.Stderr, "mcx: unknown command %q\n\n", cmd)
		usage()
		os.Exit(2)
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "mcx: "+err.Error())
		os.Exit(1)
	}
}

func usage() {
	fmt.Fprint(os.Stderr, `mcx — forward MCP tool calls (with keychain OAuth) and run sandboxed scripts

Usage:
  mcx forward --server NAME --tool NAME [--args JSON]
  mcx forward --list
  mcx run JSON LANG < SCRIPT           (default: ad-hoc source from stdin)
  mcx run JSON PATH                    (ad-hoc file, no registration)
  mcx run JSON NAME                    (runs a registered chain)
  mcx register PATH                     (name/lang/desc inferred; --name/--lang/--desc/--schema override)
                                         (also syncs a /NAME skill into ~/.claude/skills)
  mcx list
  mcx remove NAME                       (also prunes its synced skill from ~/.claude/skills)
  mcx filter [--config PATH]            (PostToolUse hook: reshape a tool result from stdin)
  mcx nudge                             (UserPromptSubmit hook: route mcx mentions to its skill)
  mcx observe [--config PATH]           (PostToolUse hook: require chain/filter routing decisions)
  mcx scan [--transcript PATH] [--config PATH]   (report MCP calls a chain/filter could collapse)
  mcx doctor [--config PATH]            (verify the plugin's chains resolve and filters reshape)
  mcx sync-connectors [--config PATH]   (sync shipped default connectors into ~/.claude.json's mcpServers)
  mcx sync-connectors --list            (show what a sync would change, without writing)

Env:
  MCX_FORWARD_TIMEOUT   per-call forward timeout (default 120s)
  MCX_EXECUTE_TIMEOUT   per-run script timeout (default 120s)
  MCX_FILTER=off        disable all filter reshaping
  MCX_NUDGE=off         disable the prompt-mentions-mcx reminder
  MCX_OBSERVE=off       disable the live chain/filter routing gates
  MCX_HOOK_ECHO=on      also surface nudge/observe hook messages to the human (systemMessage)
`)
}

func cmdForward(args []string) error {
	fs := flag.NewFlagSet("forward", flag.ContinueOnError)
	server := fs.String("server", "", "MCP server name from config")
	tool := fs.String("tool", "", "tool name to call")
	argsJSON := fs.String("args", "{}", "JSON object of tool arguments")
	list := fs.Bool("list", false, "list known servers (config ∪ keychain) and exit")
	if err := fs.Parse(args); err != nil {
		return err
	}
	if *list {
		return listServers()
	}
	if *server == "" {
		return errors.New("forward: --server is required")
	}
	if *tool == "" {
		return errors.New("forward: --tool is required")
	}

	if replay := os.Getenv("MCX_FORWARD_REPLAY"); replay != "" {
		return replayForward(replay)
	}

	var toolArgs map[string]any
	if err := json.Unmarshal([]byte(*argsJSON), &toolArgs); err != nil {
		return fmt.Errorf("forward: --args is not a JSON object: %w", err)
	}

	cwd, _ := os.Getwd()
	entry, err := mcpclient.ResolveServer(*server, cwd)
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(context.Background(), mcpclient.Timeout())
	defer cancel()

	if err := injectAuth(ctx, &entry, *server); err != nil {
		if errors.Is(err, keychain.ErrNoCredential) {
			return printNeedsAuth(*server)
		}
		return err
	}

	result, err := mcpclient.CallTool(ctx, entry, *tool, toolArgs)
	if err != nil {
		return fmt.Errorf("forward %q.%q: %w", *server, *tool, err)
	}
	out, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		return err
	}
	fmt.Println(string(out))
	return nil
}

// replayForward serves the next entry from an ordered fixture queue instead of
// making a network call. Active only when MCX_FORWARD_REPLAY names a JSON-array
// file; the offline benchmark sets it so chains run through the real executor
// with the network boundary mocked. A flock'd cursor sidecar advances one entry
// per call, matching the chain's forward() call order.
func replayForward(fixturePath string) error {
	raw, err := os.ReadFile(fixturePath)
	if err != nil {
		return fmt.Errorf("forward replay: %w", err)
	}
	var queue []json.RawMessage
	if err := json.Unmarshal(raw, &queue); err != nil {
		return fmt.Errorf("forward replay: fixture must be a JSON array: %w", err)
	}

	cursorPath := fixturePath + ".cursor"
	lock, err := os.OpenFile(cursorPath+".lock", os.O_CREATE|os.O_RDWR, 0o600)
	if err != nil {
		return fmt.Errorf("forward replay: lock: %w", err)
	}
	defer lock.Close()
	if err := syscall.Flock(int(lock.Fd()), syscall.LOCK_EX); err != nil {
		return fmt.Errorf("forward replay: flock: %w", err)
	}
	defer func() { _ = syscall.Flock(int(lock.Fd()), syscall.LOCK_UN) }()

	idx := 0
	if b, err := os.ReadFile(cursorPath); err == nil {
		if n, convErr := strconv.Atoi(strings.TrimSpace(string(b))); convErr == nil {
			idx = n
		}
	}
	if idx >= len(queue) {
		return fmt.Errorf("forward replay: queue exhausted (%d entries, wanted #%d)", len(queue), idx+1)
	}
	if err := os.WriteFile(cursorPath, []byte(strconv.Itoa(idx+1)), 0o600); err != nil {
		return fmt.Errorf("forward replay: cursor write: %w", err)
	}

	// queue[idx] is already JSON; it becomes the text payload of a CallToolResult,
	// exactly the shape the baked forward() parses (res.content[0].text → JSON).
	text, err := json.Marshal(queue[idx])
	if err != nil {
		return err
	}
	result := map[string]any{
		"content": []map[string]any{{"type": "text", "text": string(text)}},
	}
	out, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		return err
	}
	fmt.Println(string(out))
	return nil
}

// injectAuth adds a bearer Authorization header from the keychain when the server is HTTP and
// carries no auth header of its own. Returns ErrNoCredential when no keychain entry exists; callers surface as "needs auth".
func injectAuth(ctx context.Context, entry *mcpclient.ServerEntry, name string) error {
	if !isHTTP(entry.Type) {
		return nil
	}
	if hasAuthHeader(entry.Headers) {
		return nil
	}
	token, err := keychain.EnsureBearer(ctx, name)
	if err != nil {
		return err
	}
	if entry.Headers == nil {
		entry.Headers = map[string]string{}
	}
	entry.Headers["Authorization"] = "Bearer " + token
	return nil
}

// printNeedsAuth writes a synthetic CallToolResult-shaped JSON to stdout with
// isError=true and returns nil (exit 0), reusing the ordinary tool-error path
// every runtime preamble already checks (res.isError) — a chain's forward()
// raises immediately with this message, with zero preamble changes needed.
func printNeedsAuth(server string) error {
	result := map[string]any{
		"isError": true,
		"content": []map[string]any{{
			"type": "text",
			"text": fmt.Sprintf("NEEDS_AUTH: %q is not authorized. Run /mcp in Claude Code to authenticate, then retry.", server),
		}},
	}
	out, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		return err
	}
	fmt.Println(string(out))
	return nil
}

func isHTTP(t string) bool {
	switch t {
	case "http", "streamable-http", "streamable_http":
		return true
	}
	return false
}

func hasAuthHeader(h map[string]string) bool {
	for k := range h {
		if strings.EqualFold(k, "Authorization") {
			return true
		}
	}
	return false
}

func listServers() error {
	cwd, _ := os.Getwd()
	configured := mcpclient.ListServers(cwd)
	creds, _ := keychain.Discover() // best-effort; nil on non-macOS

	names := map[string]bool{}
	for n := range configured {
		names[n] = true
	}
	for n := range creds {
		names[n] = true
	}
	sorted := make([]string, 0, len(names))
	for n := range names {
		sorted = append(sorted, n)
	}
	sort.Strings(sorted)

	for _, n := range sorted {
		e, inConfig := configured[n]
		_, keyed := creds[n]
		kind := e.Type
		if kind == "" && e.Command != "" {
			kind = "stdio"
		}
		target := e.URL
		if target == "" {
			target = e.Command
		}
		flags := ""
		if keyed {
			flags = " [keychain-auth]"
		}
		if !inConfig {
			flags += " [keychain-only]"
		}
		fmt.Printf("%-28s %-8s %s%s\n", n, kind, target, flags)
	}
	return nil
}

// splitName pulls a leading positional NAME off args (Go's flag package stops
// parsing at the first non-flag token, so "register NAME --lang" would never
// see the flags). Returns the name and the remaining flag args.
func splitName(args []string) (string, []string) {
	if len(args) > 0 && !strings.HasPrefix(args[0], "-") {
		return args[0], args[1:]
	}
	return "", args
}

var langExt = map[string]string{
	"python": ".py", "py": ".py",
	"javascript": ".js", "js": ".js",
	"typescript": ".ts", "ts": ".ts",
	"ruby": ".rb", "rb": ".rb",
	"shell": ".sh", "sh": ".sh",
}

// cmdRegister stores a script as a named chain. The minimal form is just a path:
//
//	mcx register ./chains/sprint_to_sheet.rb
//
// name (from the filename), language (from the extension), and description (from
// the script's first comment line) are all inferred; --name/--lang/--desc/--schema
// override any of them. The older `register NAME --script PATH` form still works.
func cmdRegister(args []string) error {
	arg0, rest := splitName(args)
	fs := flag.NewFlagSet("register", flag.ContinueOnError)
	name := fs.String("name", "", "chain name (default: inferred from the script filename)")
	lang := fs.String("lang", "", "script language (default: inferred from the file extension)")
	script := fs.String("script", "", "path to the script file (default: the positional argument)")
	desc := fs.String("desc", "", "description (default: the script's first comment line)")
	schemaPath := fs.String("schema", "", "path to a JSON Schema for the args (optional; default permissive)")
	if err := fs.Parse(rest); err != nil {
		return err
	}

	// --script wins as the path; otherwise the positional is the path. When
	// --script is given, the positional is the name (back-compat).
	scriptPath, toolName := *script, *name
	if scriptPath == "" {
		scriptPath = arg0
	} else if toolName == "" {
		toolName = arg0
	}
	if scriptPath == "" {
		return errors.New("register: need a script path, e.g. `mcx register ./chain.rb`")
	}

	inferredName, inferredLang, ext, inferredDesc, err := registry.InferFromFile(scriptPath)
	if err != nil {
		return err
	}
	if toolName == "" {
		toolName = inferredName
	}
	language := *lang
	if language == "" {
		language = inferredLang
	}
	if language == "" {
		return fmt.Errorf("register: cannot infer language from %q; pass --lang", filepath.Ext(scriptPath))
	}
	if _, ok := langExt[language]; !ok {
		return fmt.Errorf("register: unsupported language %q", language)
	}
	description := *desc
	if description == "" {
		description = inferredDesc
	}

	var schema json.RawMessage
	if *schemaPath != "" {
		data, err := os.ReadFile(*schemaPath)
		if err != nil {
			return fmt.Errorf("register: read schema: %w", err)
		}
		schema = json.RawMessage(data)
	}

	store, err := registry.Open()
	if err != nil {
		return err
	}
	t, err := store.Register(toolName, description, language, ext, scriptPath, schema)
	if err != nil {
		return err
	}
	fmt.Printf("registered %q (%s) inline in the user config\n", t.Name, t.Language)
	syncSkills(store)
	return nil
}

func cmdList(_ []string) error {
	store, err := registry.Open()
	if err != nil {
		return err
	}
	tools, err := store.List()
	if err != nil {
		return err
	}
	if len(tools) == 0 {
		fmt.Println("no registered chains")
		return nil
	}
	for _, t := range tools {
		fmt.Printf("%-20s %-8s %-8s %s\n", t.Name, t.Language, t.Origin(), t.Description)
	}
	return nil
}

func cmdRun(args []string) error {
	argsJSON, target, sourceLanguage, err := parseRunInvocation(args)
	if err != nil {
		return err
	}

	ex := executor.New(func() string { cwd, _ := os.Getwd(); return cwd })
	ctx := context.Background()

	var res executor.ExecResult
	if sourceLanguage != "" {
		code, err := io.ReadAll(os.Stdin)
		if err != nil {
			return fmt.Errorf("run: read script from stdin: %w", err)
		}
		if strings.TrimSpace(string(code)) == "" {
			return errors.New("run: script source on stdin is empty")
		}
		res, err = ex.Execute(ctx, executor.ExecOptions{
			Language: sourceLanguage,
			Code:     string(code),
			Stdin:    argsJSON,
		})
		if err != nil {
			return err
		}
		return printExecResult(res)
	}

	info, statErr := os.Stat(target)
	if statErr == nil {
		if info.IsDir() {
			return fmt.Errorf("run: script path %q is a directory", target)
		}
		language, ok := registry.LangFromExt(target)
		if !ok {
			return fmt.Errorf("run: cannot infer language from %q", filepath.Ext(target))
		}
		code, err := os.ReadFile(target)
		if err != nil {
			return fmt.Errorf("run: read script %q: %w", target, err)
		}
		res, err = ex.Execute(ctx, executor.ExecOptions{
			Language: language,
			Code:     string(code),
			Stdin:    argsJSON,
		})
		if err != nil {
			return err
		}
	} else {
		if looksLikeScriptPath(target) {
			return fmt.Errorf("run: read script %q: %w", target, statErr)
		}
		store, err := registry.Open()
		if err != nil {
			return err
		}
		res, err = store.Run(ctx, ex, target, argsJSON)
		if err != nil {
			return err
		}
	}

	return printExecResult(res)
}

// parseRunInvocation accepts the canonical two-positional form
//
//	mcx run JSON (LANG|PATH|NAME)
//
// and retains the older NAME/PATH --args JSON and --args JSON --lang LANG -
// forms so previously generated chain skills keep working.
func parseRunInvocation(args []string) (argsJSON, target, sourceLanguage string, err error) {
	if len(args) == 2 && !strings.HasPrefix(args[1], "--") {
		if !json.Valid([]byte(args[0])) {
			return "", "", "", errors.New("run: first operand must be valid args JSON")
		}
		if language, ok := canonicalLanguage(args[1]); ok {
			return args[0], args[1], language, nil
		}
		return args[0], args[1], "", nil
	}

	target, rest := splitName(args)
	fs := flag.NewFlagSet("run", flag.ContinueOnError)
	legacyArgsJSON := fs.String("args", "{}", "JSON arguments passed to the script's stdin")
	languageFlag := fs.String("lang", "", "language for ad-hoc script source read from stdin")
	if err := fs.Parse(rest); err != nil {
		return "", "", "", err
	}
	if target == "" {
		if fs.NArg() > 1 {
			return "", "", "", fmt.Errorf("run: expected one script operand, got %d", fs.NArg())
		}
		if fs.NArg() == 1 {
			target = fs.Arg(0)
		}
	}
	if target == "" {
		return "", "", "", errors.New("run: expected ARGS_JSON and a language, script path, or registered chain name")
	}
	if !json.Valid([]byte(*legacyArgsJSON)) {
		return "", "", "", errors.New("run: --args must be valid JSON")
	}
	if target == "-" {
		language, ok := canonicalLanguage(*languageFlag)
		if !ok {
			return "", "", "", errors.New("run: --lang is required with a supported language when the script operand is '-'")
		}
		return *legacyArgsJSON, target, language, nil
	}
	if *languageFlag != "" {
		return "", "", "", errors.New("run: --lang is only for legacy inline source with '-' as the script operand")
	}
	return *legacyArgsJSON, target, "", nil
}

func canonicalLanguage(language string) (string, bool) {
	ext, ok := langExt[strings.ToLower(language)]
	if !ok {
		return "", false
	}
	return registry.LangFromExt("script" + ext)
}

func looksLikeScriptPath(target string) bool {
	if strings.ContainsRune(target, os.PathSeparator) || strings.HasPrefix(target, ".") {
		return true
	}
	_, ok := registry.LangFromExt(target)
	return ok
}

func printExecResult(res executor.ExecResult) error {
	if res.Stdout != "" {
		fmt.Print(res.Stdout)
		if res.Stdout[len(res.Stdout)-1] != '\n' {
			fmt.Println()
		}
	}
	if res.Stderr != "" {
		fmt.Fprint(os.Stderr, res.Stderr)
	}
	if res.TimedOut {
		return errors.New("run: script timed out")
	}
	if res.ExitCode != 0 {
		os.Exit(res.ExitCode)
	}
	return nil
}

func cmdRemove(args []string) error {
	name, rest := splitName(args)
	fs := flag.NewFlagSet("remove", flag.ContinueOnError)
	if err := fs.Parse(rest); err != nil {
		return err
	}
	if name == "" {
		return errors.New("remove: tool NAME is required")
	}
	store, err := registry.Open()
	if err != nil {
		return err
	}
	if err := store.Remove(name); err != nil {
		return err
	}
	fmt.Printf("removed %q\n", name)
	syncSkills(store)
	return nil
}

// syncSkills reconciles ~/.claude/skills against every currently resolved
// chain after register/remove — including chains this call didn't touch, so
// a chain another process removed earlier gets its stray skill pruned too.
// Fail-open: sync trouble is reported but never fails the register/remove
// command that triggered it.
func syncSkills(store *registry.Store) {
	tools, err := store.List()
	if err != nil {
		fmt.Fprintf(os.Stderr, "mcx: skillsync: list chains: %v\n", err)
		return
	}
	created, removed, skipped, err := skillsync.Sync(tools)
	if err != nil {
		fmt.Fprintf(os.Stderr, "mcx: skillsync: %v\n", err)
		return
	}
	for _, name := range created {
		fmt.Printf("skill: added /%s\n", name)
	}
	for _, name := range removed {
		fmt.Printf("skill: removed /%s (chain no longer registered)\n", name)
	}
	for _, name := range skipped {
		fmt.Fprintf(os.Stderr, "mcx: skillsync: %q already exists as a hand-authored skill; left untouched\n", name)
	}
}

// cmdFilter is the PostToolUse hook handler. It reads the hook payload from stdin,
// applies the matching filter to the tool result, and writes a
// hookSpecificOutput.updatedToolOutput replacement to stdout. It is fail-open:
// on any error, a non-matching tool, or MCX_FILTER=off it exits 0 with no output,
// leaving the original tool result untouched. It never returns a non-zero exit —
// a filter failure must never break the tool call it is decorating.
func cmdFilter(args []string) error {
	fs := flag.NewFlagSet("filter", flag.ContinueOnError)
	config := fs.String("config", "", "path to shipped filters.yml (plugin default layer)")
	if err := fs.Parse(args); err != nil {
		return nil
	}
	if os.Getenv("MCX_FILTER") == "off" {
		return nil
	}
	input, err := io.ReadAll(os.Stdin)
	if err != nil {
		return nil
	}
	cfg, err := filters.Load(*config)
	if err != nil {
		return nil
	}
	out, emit := filters.Run(input, cfg)
	if !emit {
		return nil
	}
	fmt.Println(string(out))
	return nil
}

// additionalContext never reaches the transcript on these events; MCX_HOOK_ECHO=on also sets systemMessage.
func hookEcho() bool {
	return os.Getenv("MCX_HOOK_ECHO") == "on"
}

// emitHookOutput prints the hookSpecificOutput envelope shared by the nudge and
// observe handlers: additionalContext for the given event, plus systemMessage
// when echo is on. Fail-open — a marshal error yields no output.
func emitHookOutput(eventName, msg string) {
	payloadOut := map[string]any{
		"hookSpecificOutput": map[string]any{
			"hookEventName":     eventName,
			"additionalContext": msg,
		},
	}
	if hookEcho() {
		payloadOut["systemMessage"] = msg
	}
	if out, err := json.Marshal(payloadOut); err == nil {
		fmt.Println(string(out))
	}
}

// cmdNudge is the UserPromptSubmit hook handler. When a prompt implies MCP
// fan-out and the session has not yet been nudged, it injects additionalContext
// pointing at registered chains. Like trim it is fail-open (exit 0, no output on
// any error) and fires at most once per session so it never becomes noise.
func cmdNudge(_ []string) error {
	if os.Getenv("MCX_NUDGE") == "off" {
		return nil
	}
	input, err := io.ReadAll(os.Stdin)
	if err != nil {
		return nil
	}
	var payload struct {
		Prompt    string `json:"prompt"`
		SessionID string `json:"session_id"`
	}
	if err := json.Unmarshal(input, &payload); err != nil {
		return nil
	}
	if !nudge.MentionsMcx(payload.Prompt) || alreadyNudged(payload.SessionID) {
		return nil
	}
	markNudged(payload.SessionID)

	emitHookOutput("UserPromptSubmit", nudge.McxMessage())
	return nil
}

// nudgeStateDir is where the once-per-session marker lives: CLAUDE_PLUGIN_DATA
// when the hook runs inside a plugin, else a temp dir.
func nudgeStateDir() string {
	if d := os.Getenv("CLAUDE_PLUGIN_DATA"); d != "" {
		return d
	}
	return filepath.Join(os.TempDir(), "mcx-nudge")
}

func nudgeMarker(sessionID string) string {
	return filepath.Join(nudgeStateDir(), "nudged-"+sanitizeID(sessionID))
}

// sanitizeID makes a session id safe as a filename component (empty -> "default").
func sanitizeID(sessionID string) string {
	if sessionID == "" {
		sessionID = "default"
	}
	return strings.Map(func(r rune) rune {
		if r == '/' || r == '.' || r == os.PathSeparator {
			return '_'
		}
		return r
	}, sessionID)
}

func alreadyNudged(sessionID string) bool {
	_, err := os.Stat(nudgeMarker(sessionID))
	return err == nil
}

func markNudged(sessionID string) {
	_ = os.MkdirAll(nudgeStateDir(), 0o755)
	_ = os.WriteFile(nudgeMarker(sessionID), []byte("1"), 0o644)
}

// cmdObserve is the second PostToolUse hook on mcp__.* (alongside filter). It
// keeps a per-session tally and injects an explicit routing gate: a chain gate
// on every call from the second unchained MCP call onward, and a filter gate the
// first time each unfiltered tool returns a large result. Fail-open (exit 0, no
// output on any error). MCX_OBSERVE=off disables it.
func cmdObserve(args []string) error {
	fs := flag.NewFlagSet("observe", flag.ContinueOnError)
	config := fs.String("config", "", "path to shipped filters.yml (to know which tools are already filtered)")
	if err := fs.Parse(args); err != nil {
		return nil
	}
	if os.Getenv("MCX_OBSERVE") == "off" {
		return nil
	}
	input, err := io.ReadAll(os.Stdin)
	if err != nil {
		return nil
	}
	var payload struct {
		ToolName     string          `json:"tool_name"`
		ToolResponse json.RawMessage `json:"tool_response"`
		SessionID    string          `json:"session_id"`
	}
	if err := json.Unmarshal(input, &payload); err != nil {
		return nil
	}
	if !strings.HasPrefix(payload.ToolName, "mcp__") {
		return nil // mcx only manages MCP traffic
	}

	filtered := false
	if cfg, err := filters.Load(*config); err == nil {
		_, filtered = cfg[payload.ToolName]
	}
	chained := false
	if store, err := registry.Open(); err == nil {
		if tools, err := store.List(); err == nil {
			srcs := make([]string, 0, len(tools))
			for _, t := range tools {
				srcs = append(srcs, t.Code())
			}
			chained = observe.ChainCoversTool(srcs, payload.ToolName)
		}
	}

	st := loadObserveState(payload.SessionID)
	msg := st.Call(payload.ToolName, observe.EstimateTokens(payload.ToolResponse), filtered, chained)
	saveObserveState(payload.SessionID, st)
	if msg == "" {
		return nil
	}
	emitHookOutput("PostToolUse", msg)
	return nil
}

func observeStatePath(sessionID string) string {
	return filepath.Join(nudgeStateDir(), "observe-"+sanitizeID(sessionID)+".json")
}

// loadObserveState reads the per-session tally; a missing or corrupt file yields
// a fresh state so the hook never fails on it.
func loadObserveState(sessionID string) *observe.State {
	st := observe.NewState()
	data, err := os.ReadFile(observeStatePath(sessionID))
	if err != nil {
		return st
	}
	_ = json.Unmarshal(data, st)
	if st.Tools == nil {
		st.Tools = map[string]*observe.ToolStat{}
	}
	return st
}

func saveObserveState(sessionID string, st *observe.State) {
	data, err := json.Marshal(st)
	if err != nil {
		return
	}
	_ = os.MkdirAll(nudgeStateDir(), 0o755)
	_ = os.WriteFile(observeStatePath(sessionID), data, 0o644)
}

// cmdScan analyzes a Claude Code transcript for MCP call patterns mcx could
// collapse — tools called often enough to warrant a chain, and large results
// that warrant a filter — and prints a short digest. Used by the /setup command.
func cmdScan(args []string) error {
	fs := flag.NewFlagSet("scan", flag.ContinueOnError)
	transcript := fs.String("transcript", "", "path to a transcript .jsonl (default: newest for this project)")
	config := fs.String("config", "", "path to shipped filters.yml (to skip already-filtered tools)")
	if err := fs.Parse(args); err != nil {
		return err
	}
	path := *transcript
	if path == "" {
		p, err := newestTranscript()
		if err != nil {
			return fmt.Errorf("scan: %w", err)
		}
		path = p
	}
	f, err := os.Open(path)
	if err != nil {
		return fmt.Errorf("scan: open transcript: %w", err)
	}
	defer f.Close()

	filtered := map[string]bool{}
	if cfg, err := filters.Load(*config); err == nil {
		for tool := range cfg {
			filtered[tool] = true
		}
	}
	rep, err := scan.Scan(f, filtered)
	if err != nil {
		return fmt.Errorf("scan: %w", err)
	}
	printScanReport(path, rep)
	return nil
}

// cmdDoctor verifies the two things that fail silently: that the plugin's chains
// resolve (they don't from a plain shell if the cache can't be located) and that
// the shipped filters actually reshape a payload (a loaded-but-inert filter
// registry looks identical to a working one). It prints a report and returns a
// non-nil error when the plugin layer can't be found or the filter self-check
// fails, so the exit code signals health to /setup and to scripts.
func cmdDoctor(args []string) error {
	fs := flag.NewFlagSet("doctor", flag.ContinueOnError)
	config := fs.String("config", "", "path to filters.yml (default: <plugin root>/filters.yml)")
	if err := fs.Parse(args); err != nil {
		return err
	}

	fmt.Println("mcx doctor — verifying the plugin's chains and filters")

	root := registry.PluginRoot()
	source := "auto-detected cache"
	if os.Getenv("CLAUDE_PLUGIN_ROOT") != "" {
		source = "CLAUDE_PLUGIN_ROOT"
	}
	var problems []string
	if root == "" {
		fmt.Println("\nplugin root: NOT FOUND — no CLAUDE_PLUGIN_ROOT and no cache under ~/.claude/plugins/cache")
		problems = append(problems, "plugin root not found")
	} else {
		fmt.Printf("\nplugin root: %s (%s)\n", root, source)
	}

	cfgPath := *config
	if cfgPath == "" && root != "" {
		cfgPath = filepath.Join(root, "filters.yml")
	}
	cfg, err := filters.Load(cfgPath)
	if err != nil {
		fmt.Printf("\nfilters: ERROR loading %s: %v\n", cfgPath, err)
		problems = append(problems, "filter config failed to load")
	} else {
		fmt.Printf("\nfilters: %d tool(s) configured (%s)\n", len(cfg), cfgPath)
		if tool, ok := filters.SelfCheck(cfg); ok {
			fmt.Printf("  self-check: PASS — reshaped %s\n", tool)
		} else {
			fmt.Println("  self-check: FAIL — no configured filter reshaped a probe payload")
			problems = append(problems, "filter self-check failed")
		}
	}

	store, err := registry.Open()
	if err != nil {
		fmt.Printf("\nchains: ERROR opening registry: %v\n", err)
		problems = append(problems, "chain registry failed to open")
	} else if tools, err := store.List(); err != nil {
		fmt.Printf("\nchains: ERROR listing: %v\n", err)
		problems = append(problems, "chain listing failed")
	} else {
		byOrigin := map[string]int{}
		for _, t := range tools {
			byOrigin[t.Origin()]++
		}
		fmt.Printf("\nchains: %d resolved (plugin=%d project=%d user=%d)\n",
			len(tools), byOrigin["plugin"], byOrigin["project"], byOrigin["user"])
		if len(tools) == 0 {
			fmt.Println("  warning: no chains resolved — shipped chains should appear here")
		}
	}

	fmt.Println("\nNote: this verifies the mcx binary and its config reshape correctly. It cannot")
	fmt.Println("confirm Claude Code applies the PostToolUse result in this session — to confirm")
	fmt.Println("end-to-end, call a filtered MCP tool and check the dropped fields are gone.")

	if len(problems) > 0 {
		return fmt.Errorf("doctor found %d problem(s): %s", len(problems), strings.Join(problems, "; "))
	}
	return nil
}

// newestTranscript returns the most recently modified transcript for the current
// working directory's Claude Code project (~/.claude/projects/<slug>/*.jsonl,
// where <slug> is the cwd path with every non-alphanumeric character turned into '-').
func newestTranscript() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	cwd, err := os.Getwd()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(home, ".claude", "projects", projectSlug(cwd))
	ents, err := os.ReadDir(dir)
	if err != nil {
		return "", fmt.Errorf("no transcripts for this project (%s): %w", dir, err)
	}
	var newest string
	var newestMod time.Time
	for _, e := range ents {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".jsonl") {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		if newest == "" || info.ModTime().After(newestMod) {
			newest = filepath.Join(dir, e.Name())
			newestMod = info.ModTime()
		}
	}
	if newest == "" {
		return "", fmt.Errorf("no .jsonl transcripts in %s", dir)
	}
	return newest, nil
}

// projectSlug mirrors Claude Code's ~/.claude/projects/<slug> naming: every
// character that isn't a letter or digit becomes '-' (so path separators,
// dots, underscores, etc. all collapse to the same delimiter).
func projectSlug(path string) string {
	var b strings.Builder
	b.Grow(len(path))
	for _, r := range path {
		if r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' {
			b.WriteRune(r)
		} else {
			b.WriteByte('-')
		}
	}
	return b.String()
}

func printScanReport(path string, rep scan.Report) {
	fmt.Printf("Scanned %s — %d MCP call(s).\n", path, rep.Calls)
	if rep.Empty() {
		fmt.Println("No collapsible MCP patterns found.")
		return
	}
	if len(rep.ChainCandidates) > 0 {
		fmt.Printf("\nChain candidates (session had >=%d MCP calls total, no chain yet):\n", observe.SequentialThreshold)
		for _, c := range rep.ChainCandidates {
			fmt.Printf("  - %-40s x%d\n", observe.Short(c.Tool), c.Count)
		}
		fmt.Println("  -> invoke /mcx:new and run the fan-out ad hoc; register only when asked to save it.")
	}
	if len(rep.FilterCandidates) > 0 {
		fmt.Println("\nFilter candidates (large results, no filter configured):")
		for _, fc := range rep.FilterCandidates {
			fmt.Printf("  - %-40s ~%d tokens\n", observe.Short(fc.Tool), fc.Tokens)
		}
		fmt.Println("  -> invoke /mcx:new to evaluate and configure a filter.")
	}
}

// cmdSyncConnectors resolves the shipped url_configs.yml, then either reports the
// diff against local config (--list) or performs the idempotent write. The
// URL-matching, key-renaming, and raw-JSON round-trip logic lives in
// internal/connectors; this handler is flag-parsing plus output glue.
func cmdSyncConnectors(args []string) error {
	fs := flag.NewFlagSet("sync-connectors", flag.ContinueOnError)
	config := fs.String("config", "", "path to url_configs.yml (default: <plugin root>/url_configs.yml)")
	dryRun := fs.Bool("list", false, "show what would change as JSON, without writing")
	if err := fs.Parse(args); err != nil {
		return err
	}
	path := *config
	if path == "" {
		root := registry.PluginRoot()
		if root == "" {
			return errors.New("sync-connectors: plugin root not found (set CLAUDE_PLUGIN_ROOT or pass --config)")
		}
		path = filepath.Join(root, "url_configs.yml")
	}
	configs, err := connectors.Load(path)
	if err != nil {
		return err
	}

	if *dryRun {
		cwd, _ := os.Getwd()
		out, err := json.MarshalIndent(connectors.Plan(configs, cwd), "", "  ")
		if err != nil {
			return err
		}
		fmt.Println(string(out))
		return nil
	}

	res, err := connectors.Sync(configs)
	if err != nil {
		return err
	}
	if len(res.Added) > 0 {
		fmt.Printf("added: %s\n", strings.Join(res.Added, ", "))
	}
	if len(res.Renamed) > 0 {
		fmt.Printf("renamed to standard form: %s\n", strings.Join(res.Renamed, ", "))
	}
	if len(res.AlreadyConfigured) > 0 {
		fmt.Printf("already configured: %s\n", strings.Join(res.AlreadyConfigured, ", "))
	}
	if res.Changed {
		fmt.Println("Restart Claude Code and call one tool per new/renamed server (or run /mcp) to authenticate — sync writes config, not credentials.")
	}
	return nil
}
