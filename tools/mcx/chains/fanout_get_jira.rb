# fanout_get_jira — fetch N Jira issues in one call and return a compact table.
jira_server = args["jiraServer"] || "jira"
def row(issue)
  f = issue["fields"] || {}
  {
    "key" => issue["key"],
    "summary" => f["summary"],
    "status" => f.dig("status", "name"),
    "assignee" => f.dig("assignee", "displayName") || "Unassigned"
  }
end

cloud = args["cloudId"]
rows = []
failed = []
(args["keys"] || []).each do |k|
  rows << row(
    forward(
      jira_server,
      "getJiraIssue",
      {
        "cloudId" => cloud,
        "issueIdOrKey" => k
      }
    )
  )
rescue StandardError => e
  failed << { "key" => k, "error" => e.message }
end

emit(
  {
    "count" => rows.length,
    "issues" => rows,
    "failed" => failed
  }
)
