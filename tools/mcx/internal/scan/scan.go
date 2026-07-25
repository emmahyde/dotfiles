// Package scan reads a Claude Code transcript (JSONL) and surfaces MCP call
// patterns that mcx could collapse: tools called often enough to deserve a chain,
// and tools whose results are large enough to deserve a filter. It is the
// retrospective counterpart to package observe, which nudges live.
package scan

import (
	"bufio"
	"encoding/json"
	"errors"
	"io"
	"sort"
	"strings"

	"github.com/emmahyde/mcx/internal/observe"
)

// ToolCount is a tool and how many times it was called.
type ToolCount struct {
	Tool  string
	Count int
}

// ToolSize is a tool and the largest single result it returned, in estimated tokens.
type ToolSize struct {
	Tool   string
	Tokens int
}

// Report is what a scan found.
type Report struct {
	Calls            int         // total MCP tool calls seen
	ChainCandidates  []ToolCount // MCP tools called, present once total MCP calls >= observe.SequentialThreshold (any tool, not just repeats), busiest first
	FilterCandidates []ToolSize  // MCP tools with a large result and no filter, biggest first
}

// Empty reports whether the scan found nothing worth acting on.
func (r Report) Empty() bool {
	return len(r.ChainCandidates) == 0 && len(r.FilterCandidates) == 0
}

type entry struct {
	Type    string `json:"type"`
	Message struct {
		Content json.RawMessage `json:"content"`
	} `json:"message"`
}

type block struct {
	Type      string          `json:"type"`
	Name      string          `json:"name"`
	ID        string          `json:"id"`
	ToolUseID string          `json:"tool_use_id"`
	Content   json.RawMessage `json:"content"`
}

// Scan parses transcript JSONL from r. filtered is the set of tool names already
// covered by a filter (excluded from filter candidates). Only MCP tools
// (name prefixed "mcp__") are considered — mcx does not manage native tools.
func Scan(r io.Reader, filtered map[string]bool) (Report, error) {
	counts := map[string]int{}
	maxTokens := map[string]int{}
	idToName := map[string]string{}

	br := bufio.NewReader(r)
	for {
		line, readErr := br.ReadBytes('\n')
		if len(line) > 0 {
			var e entry
			if json.Unmarshal(line, &e) == nil {
				var blocks []block
				// content is an array of blocks for tool_use/tool_result turns;
				// a plain string for ordinary text turns, which we skip.
				if json.Unmarshal(e.Message.Content, &blocks) == nil {
					for _, b := range blocks {
						switch b.Type {
						case "tool_use":
							if strings.HasPrefix(b.Name, "mcp__") {
								counts[b.Name]++
								idToName[b.ID] = b.Name
							}
						case "tool_result":
							if name := idToName[b.ToolUseID]; name != "" {
								if t := observe.EstimateTokens(b.Content); t > maxTokens[name] {
									maxTokens[name] = t
								}
							}
						}
					}
				}
			}
		}
		if readErr != nil {
			if errors.Is(readErr, io.EOF) {
				break
			}
			return Report{}, readErr
		}
	}

	rep := Report{}
	for _, n := range counts {
		rep.Calls += n
	}
	for tool, c := range counts {
		if rep.Calls >= observe.SequentialThreshold {
			rep.ChainCandidates = append(rep.ChainCandidates, ToolCount{Tool: tool, Count: c})
		}
		if t := maxTokens[tool]; t >= observe.CruftTokenThreshold && !filtered[tool] {
			rep.FilterCandidates = append(rep.FilterCandidates, ToolSize{Tool: tool, Tokens: t})
		}
	}
	sort.Slice(rep.ChainCandidates, func(i, j int) bool {
		return rep.ChainCandidates[i].Count > rep.ChainCandidates[j].Count
	})
	sort.Slice(rep.FilterCandidates, func(i, j int) bool {
		return rep.FilterCandidates[i].Tokens > rep.FilterCandidates[j].Tokens
	})
	return rep, nil
}
