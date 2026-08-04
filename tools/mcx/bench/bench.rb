#!/usr/bin/env ruby
# frozen_string_literal: true

# bench — token-economy benchmark for mcx scenarios.
#
# For each scenario it measures, symmetrically, what accumulates in the model's
# context window:
#   native ctx = emit(tool_use args) + recv(raw MCP payload)
#   mcx ctx    = emit(`mcx run` command) + recv(distilled digest)
#   space back = native ctx / mcx ctx
#
# The digest is produced by running the chain through the REAL mcx executor
# (`mcx run <chain>`), with the network boundary mocked: MCX_FORWARD_REPLAY points
# the baked forward() at an ordered fixture queue instead of a live server. So the
# numbers reflect the exact production code path, not a standalone re-implementation.
# Tokeniser: tiktoken cl100k_base (see count_tokens.py).
#
#   ruby bench/bench.rb                       # synthetic fixtures (default)
#   MCX_FIXTURES=/path ruby bench/bench.rb    # point at a captures dir instead
#
# Fixtures are auto-generated (synthetic, seeded) if the fixtures dir is empty.

require "json"
require "tempfile"
require "tmpdir"

ROOT = File.expand_path("..", __dir__)
FIXDIR = ENV["MCX_FIXTURES"] || File.join(__dir__, "fixtures")
TOKENIZER = ENV["MCX_TOKENIZER"] || "uv run --with tiktoken python3"
MCX = File.join(ROOT, "bin", "mcx")
CONTEXT_WINDOW = 200_000
CLOUD = "…"

# Each scenario declares:
#   chain        the resolved chain name (as `mcx list` shows it)
#   args         ->(raw) the --args JSON string the model would pass
#   replay       ->(raw) the ordered list of raw payloads the chain's forward()
#                 calls should receive (matches call order; one entry per call)
#   native_recv  ->(raw) the raw MCP payload(s) the model would otherwise read
#   native_emit  ->(raw) the tool_use argument string(s) the model would emit
SCENARIOS = [
  {
    name: "getJiraIssue", chain: "get-jira-issue",
    args: ->(_r) { JSON.generate({ "cloudId" => CLOUD, "issueIdOrKey" => "PROJ-1" }) },
    replay: ->(r) { [r] },
    native_recv: ->(r) { JSON.generate(r) },
    native_emit: ->(_r) { JSON.generate({ "cloudId" => CLOUD, "issueIdOrKey" => "PROJ-1" }) }
  },
  {
    name: "5× getJiraIssue (fan-out)", chain: "fanout-get-jira",
    args: ->(r) { JSON.generate({ "cloudId" => CLOUD, "keys" => r.map { |i| i["key"] } }) },
    replay: ->(r) { r },
    native_recv: ->(r) { JSON.generate(r) },
    native_emit: ->(r) { r.map { |i| JSON.generate({ "cloudId" => CLOUD, "issueIdOrKey" => i["key"] }) }.join }
  },
  {
    name: "searchJiraIssues (10 results)", chain: "search-jira",
    args: ->(_r) { JSON.generate({ "cloudId" => CLOUD, "jql" => "project = PROJ ORDER BY updated DESC", "maxResults" => 10 }) },
    replay: ->(r) { [r] },
    native_recv: ->(r) { JSON.generate(r) },
    native_emit: ->(_r) { JSON.generate({ "cloudId" => CLOUD, "jql" => "project = PROJ ORDER BY updated DESC", "maxResults" => 10 }) }
  },
  {
    name: "Sprint metrics → Sheet (40 issues)", chain: "sprint-to-sheet",
    args: ->(_r) { JSON.generate({ "cloudId" => CLOUD }) },
    replay: ->(r) { [r] },
    native_recv: ->(r) { JSON.generate(r) },
    native_emit: ->(_r) { JSON.generate({ "cloudId" => CLOUD, "jql" => "sprint in openSprints() ORDER BY updated DESC", "maxResults" => 40 }) }
  },
  {
    name: "Notion roadmap ↔ Jira reconcile", chain: "notion-jira-reconcile",
    args: ->(r) { JSON.generate({ "cloudId" => CLOUD, "notionId" => "…", "projectKey" => r["projectKey"] || "PROJ" }) },
    replay: ->(r) { [r["notion"], r["jira"]] },
    # Cross-MCP: the model would hold BOTH payloads at once.
    native_recv: ->(r) { JSON.generate(r["notion"]) + JSON.generate(r["jira"]) },
    native_emit: ->(_r) { JSON.generate({ "id" => "…" }) + JSON.generate({ "cloudId" => CLOUD, "jql" => "project = PROJ AND issuetype = Epic", "maxResults" => 50 }) }
  },
  {
    name: "editJiraIssue (bloated response)", chain: "edit-jira-issue",
    args: ->(_r) { JSON.generate({ "cloudId" => CLOUD, "issueIdOrKey" => "PROJ-1", "fields" => { "summary" => "New title" } }) },
    replay: ->(r) { [r] },
    native_recv: ->(r) { JSON.generate(r) },
    native_emit: ->(_r) { JSON.generate({ "cloudId" => CLOUD, "issueIdOrKey" => "PROJ-1", "fields" => { "summary" => "New title" } }) }
  },
  {
    name: "batch-triage (14× editJiraIssue)", chain: "batch-triage",
    args: ->(r) { JSON.generate({ "cloudId" => CLOUD, "field" => "example_field", "value" => "Example Value", "keys" => r.map { |i| i["key"] } }) },
    replay: ->(r) { r },
    # Native: 14 edits, each echoing the whole updated issue back.
    native_recv: ->(r) { r.map { |i| JSON.generate(i) }.join },
    native_emit: ->(r) { r.map { |i| JSON.generate({ "cloudId" => CLOUD, "issueIdOrKey" => i["key"], "fields" => { "example_field" => { "value" => "Example Value" } } }) }.join }
  },
  {
    name: "Jira + Notion cross-ref", chain: "jira-notion-crossref",
    args: ->(_r) { JSON.generate({ "cloudId" => CLOUD, "issueIdOrKey" => "PROJ-1", "notionId" => "…" }) },
    replay: ->(r) { [r["jira"], r["notion"]] },
    native_recv: ->(r) { JSON.generate(r["jira"]) + JSON.generate(r["notion"]) },
    native_emit: ->(_r) { JSON.generate({ "cloudId" => CLOUD, "issueIdOrKey" => "PROJ-1" }) + JSON.generate({ "id" => "…" }) }
  },
  {
    name: "Slack thread → triaged bug", chain: "slack-to-bug",
    args: ->(_r) { JSON.generate({ "channel_id" => "…", "message_ts" => "…", "cloudId" => CLOUD, "projectKey" => "PROJ" }) },
    replay: ->(r) { [r] },
    native_recv: ->(r) { r["messages"].to_s },
    native_emit: ->(_r) { JSON.generate({ "channel_id" => "…", "message_ts" => "…" }) }
  }
].freeze

# Map a scenario's fixture filename off its chain name (chains/<name>.rb → <name>.json).
def fixture_name(chain)
  "#{chain.tr('-', '_')}.json"
end

def ensure_binary
  return if File.exist?(MCX)

  warn "building mcx binary…"
  system("go", "build", "-o", MCX, "./cmd/mcx", chdir: ROOT) || abort("go build failed")
end

def ensure_fixtures
  return if Dir.exist?(FIXDIR) && !Dir.glob(File.join(FIXDIR, "*.json")).empty?

  warn "fixtures missing; generating synthetic set…"
  system(RbConfig.ruby, File.join(__dir__, "gen_fixtures.rb")) || abort("fixture generation failed")
end

# run_digest runs the chain through the real executor with a fixture-backed
# forward (MCX_FORWARD_REPLAY), returning whatever the chain emits to stdout.
def run_digest(scenario, raw)
  queue = scenario[:replay].call(raw)
  Dir.mktmpdir("mcx-bench-") do |dir|
    qpath = File.join(dir, "replay.json")
    File.write(qpath, JSON.generate(queue))
    env = {
      "MCX_FORWARD_REPLAY" => qpath,
      "CLAUDE_PLUGIN_ROOT" => ROOT,
      "XDG_CONFIG_HOME" => dir # empty → no user-layer interference
    }
    out = IO.popen(env, [MCX, "run", scenario[:chain], "--args", scenario[:args].call(raw)], chdir: dir, &:read)
    abort("scenario #{scenario[:chain]} produced no output (exit #{$?.exitstatus})") if out.nil? || out.strip.empty?
    out
  end
end

def count_all(strings_by_label)
  cmd = "#{TOKENIZER} #{File.join(__dir__, 'count_tokens.py')} --batch"
  out = IO.popen(cmd, "r+") do |io|
    io.write(JSON.generate(strings_by_label))
    io.close_write
    io.read
  end
  JSON.parse(out)
rescue JSON::ParserError
  abort("tokenizer failed (is tiktoken available via '#{TOKENIZER}'?):\n#{out}")
end

ensure_binary
ensure_fixtures

to_count = {}
rows = SCENARIOS.filter_map do |s|
  fixture_path = File.join(FIXDIR, fixture_name(s[:chain]))
  unless File.exist?(fixture_path)
    warn "skipping #{s[:name]}: no fixture at #{fixture_path}"
    next
  end
  raw = JSON.parse(File.read(fixture_path))
  digest = run_digest(s, raw)
  to_count["#{s[:name]}|nrecv"] = s[:native_recv].call(raw)
  to_count["#{s[:name]}|nemit"] = s[:native_emit].call(raw)
  to_count["#{s[:name]}|mrecv"] = digest
  to_count["#{s[:name]}|memit"] = "mcx run #{s[:chain]} --args #{s[:args].call(raw)}"
  s
end

tok = count_all(to_count)

printf("%-34s %12s %10s %12s %10s %10s\n", "Scenario", "Native ctx", "% 200k", "mcx ctx", "% 200k", "space back")
puts "-" * 92
rows.each do |s|
  native = tok["#{s[:name]}|nrecv"] + tok["#{s[:name]}|nemit"]
  mcx = tok["#{s[:name]}|mrecv"] + tok["#{s[:name]}|memit"]
  ratio = mcx.zero? ? 0 : native.to_f / mcx
  printf("%-34s %12s %9.2f%% %12s %9.3f%% %9.1f×\n",
         s[:name], native, 100.0 * native / CONTEXT_WINDOW,
         mcx, 100.0 * mcx / CONTEXT_WINDOW, ratio)
end
