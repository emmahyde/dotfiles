// Package nudge builds the additionalContext message for the UserPromptSubmit
// hook: whether a prompt names the mcx CLI/plugin itself, in which case the
// model should consult the mcx skill rather than guess. Live MCP fan-out
// detection lives in package observe instead, which sees actual PostToolUse
// calls rather than guessing from prompt wording.
package nudge

import "regexp"

var mcxWord = regexp.MustCompile(`(?i)\bmcx\b`)

// MentionsMcx reports whether the prompt names the mcx CLI/plugin. "mcx" is
// never a typo for something else — treat any mention as a signal to consult
// the mcx skill rather than guessing at intent.
func MentionsMcx(prompt string) bool {
	return mcxWord.MatchString(prompt)
}

// McxMessage builds the additionalContext string for a bare "mcx" mention.
func McxMessage() string {
	return `mcx note: this prompt mentions "mcx" — that is the mcx CLI/plugin (forwarding to MCP servers, registered chains, filters), never a typo. Call the /mcx:mcx skill for usage guidance before acting on this.`
}
