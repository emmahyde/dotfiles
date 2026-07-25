package skillsync

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/emmahyde/mcx/internal/registry"
)

// isolate points HOME at a temp dir so Dir() resolves under it instead of the
// real ~/.claude/skills.
func isolate(t *testing.T) string {
	t.Helper()
	home := t.TempDir()
	t.Setenv("HOME", home)
	return home
}

func chain(name, desc string) registry.Tool {
	var t registry.Tool
	data, _ := json.Marshal(map[string]any{
		"name":        name,
		"description": desc,
	})
	_ = json.Unmarshal(data, &t)
	return t
}

func TestSyncCreatesSkillWithFrontmatter(t *testing.T) {
	home := isolate(t)

	created, removed, skipped, err := Sync([]registry.Tool{chain("hello", "says hello")})
	if err != nil {
		t.Fatalf("Sync: %v", err)
	}
	if len(removed) != 0 || len(skipped) != 0 {
		t.Fatalf("removed=%v skipped=%v, want none", removed, skipped)
	}
	if len(created) != 1 || created[0] != "hello" {
		t.Fatalf("created = %v, want [hello]", created)
	}

	skillPath := filepath.Join(home, ".claude", "skills", "hello", "SKILL.md")
	data, err := os.ReadFile(skillPath)
	if err != nil {
		t.Fatalf("SKILL.md not written: %v", err)
	}
	body := string(data)
	if !strings.Contains(body, "name: hello") || !strings.Contains(body, "description: says hello") {
		t.Errorf("SKILL.md missing frontmatter: %s", body)
	}
	if !strings.Contains(body, `mcx run '{"...": "..."}' hello`) {
		t.Errorf("SKILL.md missing mcx run invocation: %s", body)
	}

	markerPath := filepath.Join(home, ".claude", "skills", "hello", managedMarker)
	if _, err := os.Stat(markerPath); err != nil {
		t.Errorf("managed marker not written: %v", err)
	}
}

func TestSyncPrunesSkillForRemovedChain(t *testing.T) {
	isolate(t)

	if _, _, _, err := Sync([]registry.Tool{chain("hello", "says hello"), chain("bye", "says bye")}); err != nil {
		t.Fatalf("Sync (seed): %v", err)
	}

	created, removed, _, err := Sync([]registry.Tool{chain("hello", "says hello")})
	if err != nil {
		t.Fatalf("Sync (prune): %v", err)
	}
	if len(created) != 0 {
		t.Errorf("created = %v, want none (hello already synced)", created)
	}
	if len(removed) != 1 || removed[0] != "bye" {
		t.Fatalf("removed = %v, want [bye]", removed)
	}
}

func TestSyncNeverTouchesHandAuthoredSkill(t *testing.T) {
	home := isolate(t)

	handAuthoredDir := filepath.Join(home, ".claude", "skills", "hello")
	if err := os.MkdirAll(handAuthoredDir, 0o755); err != nil {
		t.Fatal(err)
	}
	handAuthoredPath := filepath.Join(handAuthoredDir, "SKILL.md")
	original := "---\ndescription: a human wrote this\n---\n\nhand-authored content\n"
	if err := os.WriteFile(handAuthoredPath, []byte(original), 0o644); err != nil {
		t.Fatal(err)
	}

	created, removed, skipped, err := Sync([]registry.Tool{chain("hello", "an mcx chain")})
	if err != nil {
		t.Fatalf("Sync: %v", err)
	}
	if len(created) != 0 || len(removed) != 0 {
		t.Fatalf("created=%v removed=%v, want none", created, removed)
	}
	if len(skipped) != 1 || skipped[0] != "hello" {
		t.Fatalf("skipped = %v, want [hello]", skipped)
	}

	data, err := os.ReadFile(handAuthoredPath)
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != original {
		t.Errorf("hand-authored SKILL.md was modified:\n%s", data)
	}
	if _, err := os.Stat(filepath.Join(handAuthoredDir, managedMarker)); err == nil {
		t.Error("hand-authored skill dir was marked as mcx-managed")
	}

	// A later sync that drops the chain must still leave the hand-authored
	// skill alone — it was never marked, so it isn't a removal candidate.
	if _, removed, _, err := Sync(nil); err != nil {
		t.Fatalf("Sync (empty): %v", err)
	} else if len(removed) != 0 {
		t.Fatalf("removed = %v, want none — hand-authored skill must survive", removed)
	}
	if _, err := os.Stat(handAuthoredPath); err != nil {
		t.Errorf("hand-authored SKILL.md was removed: %v", err)
	}
}

func TestSyncRefreshesDescriptionOnExistingManagedSkill(t *testing.T) {
	home := isolate(t)

	if _, _, _, err := Sync([]registry.Tool{chain("hello", "old description")}); err != nil {
		t.Fatalf("Sync (seed): %v", err)
	}

	created, _, _, err := Sync([]registry.Tool{chain("hello", "new description")})
	if err != nil {
		t.Fatalf("Sync (refresh): %v", err)
	}
	if len(created) != 0 {
		t.Errorf("created = %v, want none — hello already exists", created)
	}

	data, err := os.ReadFile(filepath.Join(home, ".claude", "skills", "hello", "SKILL.md"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(data), "description: new description") {
		t.Errorf("SKILL.md not refreshed: %s", data)
	}
}

func TestSyncWithNoChainsRemovesAllManagedSkills(t *testing.T) {
	home := isolate(t)

	if _, _, _, err := Sync([]registry.Tool{chain("hello", "says hello")}); err != nil {
		t.Fatalf("Sync (seed): %v", err)
	}

	_, removed, _, err := Sync(nil)
	if err != nil {
		t.Fatalf("Sync (empty): %v", err)
	}
	if len(removed) != 1 || removed[0] != "hello" {
		t.Fatalf("removed = %v, want [hello]", removed)
	}
	if _, err := os.Stat(filepath.Join(home, ".claude", "skills", "hello")); !os.IsNotExist(err) {
		t.Errorf("skill dir still present: err=%v", err)
	}
}
