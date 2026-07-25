# batch-edit-jira — apply the same field edits to many Jira issues; return per-issue confirmations.
fields = args["fields"] || {}
results = []
failed = []
(args["keys"] || []).each do |key|
  issue = forward(
    "jiraconfluencegusto",
    "editJiraIssue",
    {
      "cloudId" => args["cloudId"],
      "issueIdOrKey" => key,
      "fields" => fields
    }
  )
  f = issue["fields"] || {}
  results << {
    "key" => issue["key"],
    "summary" => f["summary"],
    "status" => f.dig("status", "name"),
    "updated" => f["updated"]
  }
rescue StandardError => e
  failed << { "key" => key, "error" => e.message }
end
emit(
  {
    "updated" => results.length,
    "changed" => fields.keys,
    "results" => results,
    "failed" => failed
  }
)
