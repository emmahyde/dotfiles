package nudge

import (
	"strings"
	"testing"
)

func TestMentionsMcx(t *testing.T) {
	fire := []string{
		"mcx",
		"how do I use mcx to forward this call",
		"MCX register this script",
		"run Mcx list",
	}
	for _, p := range fire {
		if !MentionsMcx(p) {
			t.Errorf("expected mcx mention detected for %q", p)
		}
	}
	quiet := []string{
		"nothing here",
		"maxcompute", // must not match as a substring of a larger word
		"mcxx",
	}
	for _, p := range quiet {
		if MentionsMcx(p) {
			t.Errorf("expected no mcx mention for %q", p)
		}
	}
}

func TestMcxMessage(t *testing.T) {
	m := McxMessage()
	if !strings.Contains(m, "/mcx:mcx") {
		t.Errorf("message should point at the /mcx:mcx skill: %q", m)
	}
	if !strings.Contains(m, "never a typo") {
		t.Errorf("message should state mcx is never a typo: %q", m)
	}
}
