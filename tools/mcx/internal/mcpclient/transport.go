package mcpclient

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"strings"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// ServerEntry is one MCP server definition, as found in a config source.
type ServerEntry struct {
	Type    string            `json:"type"`
	Command string            `json:"command"`
	Args    []string          `json:"args"`
	Env     map[string]string `json:"env"`
	URL     string            `json:"url"`
	Headers map[string]string `json:"headers"`
}

const (
	transportStdio = "stdio"
	transportHTTP  = "http"
)

func (e ServerEntry) transportType() (string, error) {
	switch strings.ToLower(strings.TrimSpace(e.Type)) {
	case "", "stdio":
		if strings.TrimSpace(e.Command) == "" {
			return "", fmt.Errorf("stdio MCP server requires command")
		}
		return transportStdio, nil
	case "http", "streamable-http", "streamable_http":
		endpoint := strings.TrimSpace(e.URL)
		if endpoint == "" {
			return "", fmt.Errorf("streamable HTTP MCP server requires url")
		}
		parsed, err := url.Parse(endpoint)
		if err != nil || parsed.Scheme == "" || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
			return "", fmt.Errorf("streamable HTTP MCP server has invalid url %q", e.URL)
		}
		for name := range e.Headers {
			if strings.TrimSpace(name) == "" {
				return "", fmt.Errorf("streamable HTTP MCP server has empty header name")
			}
		}
		return transportHTTP, nil
	default:
		return "", fmt.Errorf("unsupported MCP transport type %q", e.Type)
	}
}

func newTransport(ctx context.Context, entry ServerEntry) (mcp.Transport, error) {
	tt, err := entry.transportType()
	if err != nil {
		return nil, err
	}
	if tt == transportHTTP {
		return &mcp.StreamableClientTransport{
			Endpoint: strings.TrimSpace(entry.URL),
			HTTPClient: &http.Client{
				Transport: &headerRoundTripper{
					headers: cloneStringMap(entry.Headers),
					next:    http.DefaultTransport,
				},
			},
		}, nil
	}

	cmd := exec.CommandContext(ctx, entry.Command, entry.Args...)
	cmd.Env = os.Environ()
	for k, v := range entry.Env {
		cmd.Env = append(cmd.Env, k+"="+v)
	}
	return &mcp.CommandTransport{Command: cmd}, nil
}

type headerRoundTripper struct {
	headers map[string]string
	next    http.RoundTripper
}

func (rt *headerRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	next := rt.next
	if next == nil {
		next = http.DefaultTransport
	}
	if len(rt.headers) == 0 {
		return next.RoundTrip(req)
	}

	clone := req.Clone(req.Context())
	for name, value := range rt.headers {
		clone.Header.Set(name, value)
	}
	return next.RoundTrip(clone)
}

func cloneStringMap(in map[string]string) map[string]string {
	if len(in) == 0 {
		return nil
	}
	out := make(map[string]string, len(in))
	for k, v := range in {
		out[k] = v
	}
	return out
}
