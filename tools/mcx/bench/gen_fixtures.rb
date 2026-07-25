#!/usr/bin/env ruby
# frozen_string_literal: true

# gen_fixtures — build deterministic, synthetic MCP payloads that mirror the
# shape and size of real Jira/Notion responses, so the benchmark runs out of the
# box with no network and no internal data. Seeded, so output is reproducible.
#
# These fixtures are SYNTHETIC (lorem text, PROJ-N keys, "Person N" names). They
# reproduce the token *ratios* of the real scenarios, not the exact byte counts.

require "json"
require "fileutils"

srand(42)

WORDS = %w[
  sprint retention payroll ledger migration rollout webhook retry idempotent
  latency backfill cohort schema invariant throttle reconcile epic burndown
  regression flaky cache tenant bearer refresh token endpoint payload digest
  sandbox forward registry manifest keychain transport precedence fixture
].freeze

def lorem(words)
  Array.new(words) { WORDS.sample }.join(" ").capitalize
end

def adf_paragraph(words)
  { "type" => "paragraph", "content" => [{ "type" => "text", "text" => lorem(words) }] }
end

def adf_doc(paragraphs, words_each)
  { "type" => "doc", "version" => 1, "content" => Array.new(paragraphs) { adf_paragraph(words_each) } }
end

STATUSES = ["To Do", "In Progress", "In Review", "Blocked", "Done"].freeze

def person(n)
  {
    "accountId" => format("%024d", n),
    "displayName" => "Person #{n}",
    "emailAddress" => "person#{n}@example.invalid",
    "active" => true,
    "timeZone" => "America/New_York",
    "avatarUrls" => { "48x48" => "https://example.invalid/a/#{n}.png", "24x24" => "https://example.invalid/b/#{n}.png" }
  }
end

def comment(n)
  {
    "id" => (10_000 + n).to_s,
    "author" => person(n % 6),
    "updateAuthor" => person(n % 6),
    "created" => "2026-07-#{format('%02d', (n % 28) + 1)}T09:00:00.000-0400",
    "updated" => "2026-07-#{format('%02d', (n % 28) + 1)}T09:30:00.000-0400",
    "body" => adf_doc(2, 40),
    "jsdPublic" => true
  }
end

# A full getJiraIssue-shaped object: heavy ADF description, many comments, and
# the field chrome that makes native payloads expensive.
# Sized so one issue lands near a real getJiraIssue's ~18k-token weight; the
# space-back ratio is then whatever falls out, not tuned to a target.
def full_issue(idx, comments: 46, desc_paragraphs: 38)
  key = "PROJ-#{idx}"
  {
    "expand" => "renderedFields,names,schema,operations,editmeta,changelog,versionedRepresentations",
    "id" => (20_000 + idx).to_s,
    "self" => "https://example.invalid/rest/api/3/issue/#{20_000 + idx}",
    "key" => key,
    "fields" => {
      "summary" => lorem(9),
      "description" => adf_doc(desc_paragraphs, 45),
      "status" => { "name" => STATUSES[idx % STATUSES.length], "id" => (idx % STATUSES.length).to_s,
                    "statusCategory" => { "key" => "indeterminate", "name" => "In Progress" } },
      "assignee" => person(idx % 8),
      "reporter" => person((idx + 3) % 8),
      "priority" => { "name" => %w[Low Medium High Highest][idx % 4], "id" => (idx % 4).to_s },
      "labels" => Array.new(4) { WORDS.sample },
      "created" => "2026-06-#{format('%02d', (idx % 28) + 1)}T08:00:00.000-0400",
      "updated" => "2026-07-#{format('%02d', (idx % 28) + 1)}T12:00:00.000-0400",
      "comment" => { "comments" => Array.new(comments) { |c| comment(c) }, "total" => comments,
                     "maxResults" => comments, "startAt" => 0 }
    }
  }
end

# A leaner searchJiraIssuesUsingJql issue: fields only, no comment tree.
def search_issue(idx, desc_paragraphs: 0)
  key = "PROJ-#{idx}"
  fields = {
    "summary" => lorem(9),
    "status" => { "name" => STATUSES[idx % STATUSES.length] },
    "assignee" => person(idx % 8),
    "created" => "2026-06-#{format('%02d', (idx % 28) + 1)}T08:00:00.000-0400",
    "resolutiondate" => nil
  }
  fields["description"] = adf_doc(desc_paragraphs, 40) if desc_paragraphs.positive?
  { "id" => (30_000 + idx).to_s, "key" => key, "fields" => fields }
end

def notion_page(refs)
  blocks = []
  refs.each_with_index do |r, i|
    blocks << { "object" => "block", "id" => format("%032d", i), "type" => "paragraph",
                "paragraph" => { "rich_text" => [{ "type" => "text",
                                                   "text" => { "content" => "#{lorem(30)} #{r} #{lorem(20)}" } }] } }
  end
  20.times do |i|
    blocks << { "object" => "block", "id" => format("%032d", 100 + i), "type" => "paragraph",
                "paragraph" => { "rich_text" => [{ "type" => "text", "text" => { "content" => lorem(45) } }] } }
  end
  { "object" => "page", "id" => format("%032d", 999), "properties" => { "title" => { "title" => [{ "plain_text" => "Roadmap" }] } },
    "children" => blocks }
end

dir = File.join(__dir__, "fixtures")
FileUtils.mkdir_p(dir)

def write(dir, name, obj)
  File.write(File.join(dir, name), JSON.generate(obj))
end

write(dir, "get_jira_issue.json", full_issue(1))
write(dir, "fanout_get_jira.json", (1..5).map { |i| full_issue(i) })

# Descriptions included so a 10-result search carries realistic weight.
write(dir, "search_jira.json",
      { "total" => 42, "startAt" => 0, "maxResults" => 10,
        "issues" => (1..10).map { |i| search_issue(i, desc_paragraphs: 6) } })

write(dir, "sprint_to_sheet.json",
      { "total" => 40, "startAt" => 0, "maxResults" => 40,
        "issues" => (1..40).map { |i| search_issue(i, desc_paragraphs: 3) } })

# Roadmap references PROJ-1..30 and PROJ-90 (a dangling ref); Jira lists 50 epics,
# so the reconcile digest reports both gap directions.
refs = (1..30).map { |i| "PROJ-#{i}" } + ["PROJ-90"]
jira_epics = { "total" => 50, "issues" => (1..50).map { |i| search_issue(i, desc_paragraphs: 4) } }
write(dir, "notion_jira_reconcile.json",
      { "projectKey" => "PROJ", "notion" => notion_page(refs), "jira" => jira_epics })

# editJiraIssue echoes the whole updated issue back — that bloated response is
# what the digest replaces with a one-line confirmation.
write(dir, "edit_jira_issue.json", full_issue(2))

# batch_triage flips one field across 14 issues; each edit echoes a full issue,
# so the native side is 14 bloated payloads for a 14-field-change task.
write(dir, "batch_triage.json", (1..14).map { |i| full_issue(i) })

# Cross-ref holds both a full issue and a full Notion page at once natively.
write(dir, "jira_notion_crossref.json",
      { "jira" => full_issue(3), "notion" => notion_page(%w[PROJ-3 PROJ-8]) })

# slack_read_thread returns an already-condensed thread as one text blob.
slack_thread = (+"=== THREAD PARENT MESSAGE ===\nFrom: Daily PR Review\n:thread: for review\n\n")
9.times do |i|
  slack_thread << "--- Reply #{i + 1} ---\nFrom: Person #{i}\n#{lorem(30)} "
  slack_thread << (i.even? ? "another false positive from the scanner " : "https://github.com/example/app/pull/#{600 + i} ")
  slack_thread << "\n\n"
end
write(dir, "slack_to_bug.json", { "messages" => slack_thread })

puts "wrote fixtures to #{dir}"
Dir.children(dir).sort.each { |f| puts "  #{f} (#{File.size(File.join(dir, f))} bytes)" }
