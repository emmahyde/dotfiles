# slack_review_digest — read the day's PR-review Slack threads and return only PRs still needing review.
#
# The Slack MCP tools return `messages` as a single preformatted STRING — blocks
# delimited by "=== Message from NAME (ID) at TIME ===" (channel reads) or
# "--- Reply K of N ---" / "=== THREAD PARENT MESSAGE ===" (thread reads), with
# "Message TS:" and "Reactions:" as text lines — NOT structured objects. So this
# chain parses that text rather than iterating hashes.

# Match senders like "Daily PR Review Thread - Example Team"; channel text is unreliable.
DAILY_PARENT_RE = /\ADaily PR .*Thread/i
PR_URL_RE = %r{https://github\.com/[^/\s|>]+/[^/\s|>]+/pull/\d+}
# Only an explicit "merged" reaction or a struck-through (~...~) post means "no
# longer needs review". white_check_mark is NOT a done-signal: a reply can be
# acked/approved yet still say "ready for re-review".
DONE_REACTIONS = %w[merged].freeze

# parse_messages turns a formatted Slack MCP `messages` string into ordered
# records: { ts:, from:, reactions: [names], text: }. Order is preserved, so for
# a channel read (newest-first) the first daily-parent match is the most recent.
# mcx forward hands back the raw MCP envelope: {"content":[{"type":"text",
# "text":"<json>"}]}, where the inner text is itself {"messages":"<formatted
# string>", ...}. Unwrap both layers to reach the formatted message string.
def messages_string(payload)
  obj = payload
  if obj.is_a?(Hash) && obj["content"].is_a?(Array)
    text = obj["content"].map { |c| c.is_a?(Hash) ? c["text"] : nil }.compact.join
    obj = begin
      JSON.parse(text)
    rescue StandardError
      text
    end
  end
  obj.is_a?(Hash) ? obj["messages"] : obj
end

def parse_messages(payload)
  str = messages_string(payload)
  return [] unless str.is_a?(String)

  records = []
  cur = nil
  flush = lambda do
    records << cur if cur && (cur[:ts] || !cur[:text].strip.empty?)
  end

  str.each_line do |line|
    # rstrip (not chomp): channel headers arrive as "=== ... === \n" with a
    # trailing space, which would defeat the "===\z" anchor below.
    l = line.rstrip

    if (m = l.match(/\A=== Message from (.+?) \(([A-Z0-9]+)\) at .* ===\z/))
      flush.call
      cur = { ts: nil, from: clean_name(m[1]), reactions: [], text: +"" }
      next
    elsif l =~ /\A--- Reply \d+ of \d+ ---\z/ || l =~ /\A=== THREAD PARENT MESSAGE ===\z/
      flush.call
      cur = { ts: nil, from: nil, reactions: [], text: +"" }
      next
    elsif l =~ /\A=== .* ===\z/ || l =~ /\A--- .* ---\z/
      # section divider (e.g. "=== THREAD REPLIES (3 total) ===") — not a message
      next
    end

    next unless cur

    if (m = l.match(/\AFrom:\s*(.+)\z/))
      cur[:from] ||= clean_name(m[1])
    elsif (m = l.match(/\AMessage TS:\s*([\d.]+)\s*\z/))
      cur[:ts] = m[1]
    elsif (m = l.match(/\AReactions:\s*(.+)\z/))
      cur[:reactions] = m[1].scan(/([a-z0-9_+-]+)\s*\(\d+\)/i).flatten
    elsif l =~ /\ATime:\s/
      next
    else
      cur[:text] << l << "\n"
    end
  end
  flush.call
  records
end

def clean_name(raw)
  raw.to_s.sub(/\s*<[^>]*>/, "").sub(/\s*\([A-Z0-9]+\)\s*\z/, "").strip
end

def struck?(text, url)
  text.match?(/~[^~]*#{Regexp.escape(url)}[^~]*~/)
end

def done?(record, url)
  return true if (record[:reactions] & DONE_REACTIONS).any?

  struck?(record[:text], url)
end

def blurb_for(text)
  # Human portion only — drop the GitHub-app unfurl, links, and slack markup.
  text.split(/App notification from/i).first.to_s
      .gsub(PR_URL_RE, "").gsub(/<[^>]*>/, "").gsub(/[~*_`]/, "")
      .gsub(/\s+/, " ").strip[0, 120]
end

channel_ids = args["channel_ids"]
raise "channel_ids must be a non-empty array" unless channel_ids.is_a?(Array) && !channel_ids.empty?
slack_server = args["slackServer"] || "slack"
since_hours = args["since_hours"] || 24
oldest = (Time.now - (since_hours * 3600)).to_f.to_s

generated_from = []
prs_by_url = {}

channel_ids.each do |cid|
  channel_resp = forward(
    slack_server,
    "slack_read_channel",
    { "channel_id" => cid, "oldest" => oldest, "limit" => 100, "response_format" => "detailed" }
  )
  parent = parse_messages(channel_resp).find { |r| r[:from] =~ DAILY_PARENT_RE }

  unless parent && parent[:ts]
    generated_from << { "channel_id" => cid, "thread_ts" => nil, "channel_matched" => false }
    next
  end

  ts = parent[:ts]
  generated_from << { "channel_id" => cid, "thread_ts" => ts, "channel_matched" => true }

  # Daily threads are small; a single detailed read (limit 200) covers them. The
  # string response format exposes no reliable pagination cursor, so we don't page.
  thread_resp = forward(
    slack_server,
    "slack_read_thread",
    { "channel_id" => cid, "message_ts" => ts, "limit" => 200, "response_format" => "detailed" }
  )

  parse_messages(thread_resp).each do |reply|
    text = reply[:text]
    text.scan(PR_URL_RE).uniq.each do |url|
      next if prs_by_url.key?(url)
      next if done?(reply, url)

      m = url.match(%r{github\.com/([^/]+/[^/]+)/pull/(\d+)})
      next unless m

      prs_by_url[url] = {
        "url" => url,
        "repo" => m[1],
        "number" => m[2].to_i,
        "poster" => reply[:from] || "unknown",
        "blurb" => blurb_for(text),
        "channel_id" => cid
      }
    end
  end
end

emit(
  {
    "generated_from" => generated_from,
    "count" => prs_by_url.size,
    "prs" => prs_by_url.values
  }
)
