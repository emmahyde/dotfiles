# batch_triage — flip one custom field across many Jira issues; return only a count.
field = args["field"]
value = args["value"]
done = []
failed = []
(args["keys"] || []).each do |key|
  forward(
    "jiraconfluencegusto",
    "editJiraIssue",
    {
      "cloudId" => args["cloudId"],
      "issueIdOrKey" => key,
      "fields" => {
        field => {
          "value" => value
        }
      }
    }
  )
  done << key
rescue StandardError => e
  failed << { "key" => key, "error" => e.message }
end
emit(
  {
    "updated" => done.length,
    "field" => field,
    "value" => value,
    "keys" => done,
    "failed" => failed
  }
)
