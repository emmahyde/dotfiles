#!/usr/bin/env ruby
# frozen_string_literal: true

# capture_live — fetch real MCP payloads via `mcx forward` and write them as
# benchmark fixtures under bench/captures/ (gitignored — real data never lands in
# the repo). Run once to produce the numbers the README reports:
#
#   CLOUD_ID=<id> ruby bench/capture_live.rb
#   MCX_FIXTURES=bench/captures ruby bench/bench.rb
#
# Config via env (all have working defaults for the RETIRE project):
#   CLOUD_ID, JIRA_KEYS (comma-sep), NOTION_ID, SLACK_CHANNEL, SLACK_TS, PROJECT

require "json"
require "fileutils"

CLOUD = ENV["CLOUD_ID"] || "3fd33630-4e39-4689-ad04-db32e3843117"
PROJECT = ENV["PROJECT"] || "RETIRE"
KEYS = (ENV["JIRA_KEYS"] || "TICKET-1234,TICKET-1234,TICKET-1234,TICKET-1234,TICKET-1234").split(",")
NOTION_ID = ENV["NOTION_ID"] || "328ad673-c6c2-80d0-9d03-f6ec834170c9"
SLACK_CHANNEL = ENV["SLACK_CHANNEL"] || "C0ALGQCCHL7"
SLACK_TS = ENV["SLACK_TS"] || "1780488009.179439"

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
one = forward("jiraconfluencegusto", "getJiraIssue", { "cloudId" => CLOUD, "issueIdOrKey" => KEYS[0] })
save(dir, "get_jira_issue.json", one)
# editJiraIssue echoes the full issue back; the single-issue payload is that echo.
save(dir, "edit_jira_issue.json", one)

puts "fan-out getJiraIssue ×#{KEYS.length}"
fan = KEYS.map { |k| forward("jiraconfluencegusto", "getJiraIssue", { "cloudId" => CLOUD, "issueIdOrKey" => k }) }.compact
save(dir, "fanout_get_jira.json", fan)

puts "searchJiraIssues (10)"
search = forward("jiraconfluencegusto", "searchJiraIssuesUsingJql",
                 { "cloudId" => CLOUD, "jql" => "project = #{PROJECT} ORDER BY updated DESC", "maxResults" => 10,
                   "fields" => %w[summary status assignee] })
save(dir, "search_jira.json", search)

puts "sprint metrics (40)"
sprint = forward("jiraconfluencegusto", "searchJiraIssuesUsingJql",
                 { "cloudId" => CLOUD, "jql" => "project = #{PROJECT} ORDER BY updated DESC", "maxResults" => 40,
                   "fields" => %w[summary status assignee created resolutiondate] })
save(dir, "sprint_to_sheet.json", sprint)

puts "notion-fetch + jira epics (reconcile / cross-ref)"
notion = forward("notiongusto", "notion-fetch", { "id" => NOTION_ID })
epics = forward("jiraconfluencegusto", "searchJiraIssuesUsingJql",
                { "cloudId" => CLOUD, "jql" => "project = #{PROJECT} AND issuetype = Epic ORDER BY updated DESC",
                  "maxResults" => 50, "fields" => %w[summary status] })
save(dir, "notion_jira_reconcile.json", { "projectKey" => PROJECT, "notion" => notion, "jira" => epics }) if notion && epics
save(dir, "jira_notion_crossref.json", { "jira" => one, "notion" => notion }) if notion && one

puts "slack thread"
thread = forward("slackgusto", "slack_read_thread", { "channel_id" => SLACK_CHANNEL, "message_ts" => SLACK_TS })
save(dir, "slack_to_bug.json", thread)

puts "done → #{dir}"
