# search_jira — run a JQL search and return one compact row per hit.
jira_server = args.delete("jiraServer") || "jira"
args["fields"] ||= %w[summary status assignee]
raw = forward(jira_server, "searchJiraIssuesUsingJql", args)

issues = raw["issues"] || []
rows = issues.map do |i|
  f = i["fields"] || {}
  {
    "key" => i["key"],
    "summary" => f["summary"],
    "status" => f.dig("status", "name"),
    "assignee" => f.dig("assignee", "displayName") || "Unassigned"
  }
end

emit(
  {
    "total" => raw["total"] || issues.length,
    "results" => rows
  }
)
