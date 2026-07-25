package mcpclient

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// Timeout is the per-call ceiling for a forwarded MCP invocation, honoring
// MCX_FORWARD_TIMEOUT ("2m", "90s", or bare seconds "120"). Default 120s.
func Timeout() time.Duration {
	const def = 120 * time.Second
	v := os.Getenv("MCX_FORWARD_TIMEOUT")
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

// CallTool connects to the configured server, calls one tool, then shuts down.
func CallTool(ctx context.Context, entry ServerEntry, toolName string, args map[string]any) (*mcp.CallToolResult, error) {
	if args == nil {
		args = map[string]any{}
	}
	transport, err := newTransport(ctx, entry)
	if err != nil {
		return nil, err
	}

	client := mcp.NewClient(&mcp.Implementation{Name: "mcx", Version: "1.0"}, nil)
	session, err := client.Connect(ctx, transport, nil)
	if err != nil {
		return nil, fmt.Errorf("connect: %w", err)
	}
	defer session.Close()

	result, err := session.CallTool(ctx, &mcp.CallToolParams{
		Name:      toolName,
		Arguments: args,
	})
	if err != nil {
		return nil, fmt.Errorf("call: %w", err)
	}
	return result, nil
}
