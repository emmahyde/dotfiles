project = args["projectKey"]
raise "projectKey is required" unless project.is_a?(String) && !project.empty?
raise "invalid projectKey #{project.inspect}" unless project.match?(/\A[A-Za-z0-9_]+\z/)

jira_server = args["jiraServer"] || "jira"
notion_server = args["notionServer"] || "notion"
notion = forward(
  notion_server,
  "notion-fetch",
  {
    "id" => args["notionId"]
  }
)
jira = forward(
  jira_server,
  "searchJiraIssuesUsingJql",
  {
    "cloudId" => args["cloudId"],
    "jql" => "project = #{project} AND issuetype = Epic ORDER BY updated DESC",
    "maxResults" => 50,
    "fields" => %w[summary status]
  }
)

refs = JSON.generate(notion).scan(/#{Regexp.escape(project)}-\d+/).uniq.sort

issues = jira["issues"] || []
epics = {}
issues.each do |i|
  f = i["fields"] || {}
  epics[i["key"]] = { "summary" => f["summary"], "status" => f.dig("status", "name") }
end

# If the epic fetch hit the cap, the gap sets are computed from a partial set and
# cannot be trusted — flag it rather than report false gaps.
total = jira["total"]
truncated = total ? total > issues.length : issues.length >= 50

emit(
  {
    "roadmap_refs" => refs,
    "open_epics" => epics.map { |k, v| { "key" => k }.merge(v) },
    "gap_referenced_missing" => (refs - epics.keys).sort,
    "gap_epic_unlisted" => (epics.keys - refs).sort,
    "truncated" => truncated
  }
)
