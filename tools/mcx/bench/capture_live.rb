#!/usr/bin/env ruby
# frozen_string_literal: true

# Live captures require explicit identifiers because generated payloads may contain private data.

require "json"
require "fileutils"

REQUIRED_ENV = %w[
  JIRA_SERVER NOTION_SERVER SLACK_SERVER CLOUD_ID PROJECT JIRA_KEYS NOTION_ID SLACK_CHANNEL SLACK_TS
].freeze
missing_env = REQUIRED_ENV.select { |name| ENV[name].nil? || ENV[name].empty? }
abort("missing required environment variables: #{missing_env.join(', ')}") unless missing_env.empty?

JIRA_SERVER = ENV.fetch("JIRA_SERVER")
NOTION_SERVER = ENV.fetch("NOTION_SERVER")
SLACK_SERVER = ENV.fetch("SLACK_SERVER")
CLOUD = ENV.fetch("CLOUD_ID")
PROJECT = ENV.fetch("PROJECT")
KEYS = ENV.fetch("JIRA_KEYS").split(",").map(&:strip).reject(&:empty?)
NOTION_ID = ENV.fetch("NOTION_ID")
SLACK_CHANNEL = ENV.fetch("SLACK_CHANNEL")
SLACK_TS = ENV.fetch("SLACK_TS")

abort("JIRA_KEYS must contain at least one issue key") if KEYS.empty?

def forward(server, tool, args)
  out = IO.popen(["mcx", "forward", "--server", server, "--tool", tool, "--args", JSON.generate(args)], &:read)
  res = JSON.parse(out)
  if res["isError"]
    warn "  ! #{server}.#{tool}: #{res.dig('content', 0, 'text')}"
    return nil
  end
  txt = res.dig("content", 0, "text")
  txt ? JSON.parse(txt) : res
end

dir = File.join(__dir__, "captures")
FileUtils.mkdir_p(dir)
def save(dir, name, obj)
  return if obj.nil?

  File.write(File.join(dir, name), JSON.generate(obj))
  puts "  ✓ #{name} (#{File.size(File.join(dir, name))} bytes)"
end

puts "getJiraIssue #{KEYS[0]}"
one = forward(JIRA_SERVER, "getJiraIssue", { "cloudId" => CLOUD, "issueIdOrKey" => KEYS[0] })
save(dir, "get_jira_issue.json", one)
# editJiraIssue echoes the full issue back; the single-issue payload is that echo.
save(dir, "edit_jira_issue.json", one)

puts "fan-out getJiraIssue ×#{KEYS.length}"
fan = KEYS.map { |k| forward(JIRA_SERVER, "getJiraIssue", { "cloudId" => CLOUD, "issueIdOrKey" => k }) }.compact
save(dir, "fanout_get_jira.json", fan)

puts "searchJiraIssues (10)"
search = forward(JIRA_SERVER, "searchJiraIssuesUsingJql",
                 { "cloudId" => CLOUD, "jql" => "project = #{PROJECT} ORDER BY updated DESC", "maxResults" => 10,
                   "fields" => %w[summary status assignee] })
save(dir, "search_jira.json", search)

puts "sprint metrics (40)"
sprint = forward(JIRA_SERVER, "searchJiraIssuesUsingJql",
                 { "cloudId" => CLOUD, "jql" => "project = #{PROJECT} ORDER BY updated DESC", "maxResults" => 40,
                   "fields" => %w[summary status assignee created resolutiondate] })
save(dir, "sprint_to_sheet.json", sprint)

puts "notion-fetch + jira epics (reconcile / cross-ref)"
notion = forward(NOTION_SERVER, "notion-fetch", { "id" => NOTION_ID })
epics = forward(JIRA_SERVER, "searchJiraIssuesUsingJql",
                { "cloudId" => CLOUD, "jql" => "project = #{PROJECT} AND issuetype = Epic ORDER BY updated DESC",
                  "maxResults" => 50, "fields" => %w[summary status] })
save(dir, "notion_jira_reconcile.json", { "projectKey" => PROJECT, "notion" => notion, "jira" => epics }) if notion && epics
save(dir, "jira_notion_crossref.json", { "jira" => one, "notion" => notion }) if notion && one

puts "slack thread"
thread = forward(SLACK_SERVER, "slack_read_thread", { "channel_id" => SLACK_CHANNEL, "message_ts" => SLACK_TS })
save(dir, "slack_to_bug.json", thread)

puts "done → #{dir}"
