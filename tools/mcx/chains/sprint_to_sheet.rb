# sprint_to_sheet — roll up the open sprint into status/assignee counts and dry-run Sheet rows.
jira_server = args["jiraServer"] || "jira"
raw = forward(
  jira_server,
  "searchJiraIssuesUsingJql",
  {
    "cloudId" => args["cloudId"],
    "jql" => "sprint in openSprints() ORDER BY updated DESC",
    "maxResults" => 40,
    "fields" => %w[summary status assignee created resolutiondate]
  }
)

issues = raw["issues"] || []
by_status = Hash.new(0)
by_assignee = Hash.new(0)
issues.each do |i|
  f = i["fields"] || {}
  by_status[(f.dig("status", "name")) || "?"] += 1
  by_assignee[(f.dig("assignee", "displayName")) || "Unassigned"] += 1
end

top_assignees = by_assignee.sort_by { |_, v| -v }.first(10).to_h
sheet_rows = [%w[Status Count]] + by_status.map { |k, v| [k, v] }

emit(
  {
    "metrics" => {
      "total" => raw["total"] || issues.length,
      "sampled" => issues.length,
      "by_status" => by_status,
      "by_assignee" => top_assignees
    },
    "sheet_rows_dryrun" => sheet_rows
  }
)
