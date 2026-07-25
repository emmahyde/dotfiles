# jira_notion_crossref — pull one Jira issue and one Notion page and report how they reference each other.
jira = forward(
  "jiraconfluencegusto",
  "getJiraIssue",
  {
    "cloudId" => args["cloudId"],
    "issueIdOrKey" => args["issueIdOrKey"]
  }
)
notion = forward(
  "notiongusto",
  "notion-fetch",
  {
    "id" => args["notionId"]
  }
)

f = jira["fields"] || {}
key = jira["key"].to_s
project = key.split("-").first || "PROJ"
notion_text = JSON.generate(notion)
jira_text = JSON.generate(jira)

notion_id = (notion["id"] || "").to_s
refs_to_jira = notion_text.scan(/#{Regexp.escape(project)}-\d+/).uniq.sort

emit(
  {
    "jira" => {
      "key" => key,
      "summary" => f["summary"],
      "status" => f.dig("status", "name")
    },
    "notion_title" => notion.dig("properties", "title", "title", 0, "plain_text"),
    "notion_refs_to_this_issue" => refs_to_jira.include?(key),
    "notion_refs_to_project" => refs_to_jira,
    "issue_links_notion_page" => !notion_id.empty? && jira_text.include?(notion_id.delete("-"))
  }
)
