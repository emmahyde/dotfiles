# slack_to_bug — read a Slack thread and draft a triaged bug ticket.
SEVERITY = { /crash|outage|data loss|urgent|critical/i => "critical",
             /error|broken|fail|regression|blocked/i => "high",
             /false positive|flaky|slow|confusing/i => "medium" }.freeze

# thread_text yields newline-joined human-readable lines whether the Slack tool
# returns one text blob or the structured {messages:[{text:…}]} array shape.
def thread_text(thread)
  msgs = thread.is_a?(Hash) ? thread["messages"] : thread
  return msgs if msgs.is_a?(String)
  return msgs.map { |m| m.is_a?(Hash) ? (m["text"] || m["body"] || "").to_s : m.to_s }.join("\n") if msgs.is_a?(Array)

  # Unknown shape (or no "messages" key): serialize the whole thread so content
  # is preserved rather than lost to JSON.generate(nil) => "null".
  JSON.generate(msgs.nil? ? thread : msgs)
end

def triage(thread, cloud, project)
  text = thread_text(thread)
  severity = SEVERITY.find { |re, _| text =~ re }&.last || "low"
  pr_links = text.scan(%r{https://github\.com/\S+/pull/\d+}).uniq
  title = text.lines.map(&:strip).find { |l| l.length > 15 && l !~ %r{\Ahttps?://} && l !~ /\A---|\A===|\AFrom:|\ATime:|\AMessage TS:/ }
  title = (title || "Triaged from Slack thread")[0, 120]
  {
    "extracted" => { "title" => title, "severity" => severity, "pr_links" => pr_links },
    "dryrun_createIssue" => {
      "cloudId" => cloud, "projectKey" => project, "issueTypeName" => "Task",
      "summary" => title,
      "description" => "Severity: #{severity}\n\nDrafted from Slack thread. (DRY RUN)"
    }
  }
end

thread = forward(
  "slackgusto",
  "slack_read_thread",
  {
    "channel_id" => args["channel_id"],
    "message_ts" => args["message_ts"]
  }
)
emit(triage(thread, args["cloudId"], args["projectKey"] || "PROJ"))
