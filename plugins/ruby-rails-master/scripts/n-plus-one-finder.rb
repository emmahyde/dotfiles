#!/usr/bin/env ruby
# frozen_string_literal: true

# Heuristic N+1 hunter. Scans Ruby/ERB/HAML files for AR access inside
# iterating contexts. Reports candidates for review — *not* a substitute for
# Bullet, which sees actual queries at runtime.
#
# Usage:
#   ruby scripts/n-plus-one-finder.rb [path]   # default: app/
#
# Output: file:line — the suspicious construct + suggestion.

require "optparse"

paths = ARGV.empty? ? ["app/"] : ARGV
files = []

paths.each do |p|
  if File.directory?(p)
    files.concat(Dir.glob(File.join(p, "**/*.{rb,erb,haml}")))
  elsif File.file?(p)
    files << p
  end
end

# Patterns that suggest iteration
ITER_OPENERS = [
  /\beach\b/,
  /\beach_with_index\b/,
  /\bmap\b/,
  /\bcollect\b/,
  /\bselect\b/,
  /\breject\b/,
  /\binject\b/,
  /\breduce\b/,
  /\bflat_map\b/,
  /<%[=]?\s*.*\.\s*each\b/, # ERB
  /-\s*.*\.each\s+do\b/     # HAML
].freeze

# AR-ish access: dotted access likely to load an association.
AR_ACCESS_HINTS = [
  /\.\w+\.(find|where|order|count|first|last|all)\b/,
  /\.\w+\.\w+\b/  # foo.bar.baz — common Demeter / N+1 shape
].freeze

# Hard signals: a method call known to issue a query inside a loop variable.
HARD_HINTS = %w[
  .find
  .find_by
  .where
  .pluck
  .count
  .exists?
  .order
  .first
  .last
].freeze

found = 0

files.each do |file|
  lines = File.readlines(file, chomp: true)
  in_iter = false
  iter_indent = -1
  iter_at = -1

  lines.each_with_index do |line, i|
    indent = line[/^\s*/].length

    # detect end of iter block heuristically
    if in_iter && (indent <= iter_indent && line.strip.match?(/^(end|<%\s*end|-\s*end)/))
      in_iter = false
      iter_indent = -1
      iter_at = -1
    end

    if in_iter
      if HARD_HINTS.any? { |h| line.include?(h) }
        loc_var = line.match(/\b(\w+)\.(?:find|where|pluck|count|exists?|order|first|last)\b/)&.[](1)
        if loc_var && !%w[self Time Date Rails].include?(loc_var)
          puts "#{file}:#{i + 1}  N+1 candidate (loop opened at #{file}:#{iter_at + 1})"
          puts "  → #{line.strip}"
          puts "  Suggestion: preload the association before this loop."
          found += 1
        end
      elsif AR_ACCESS_HINTS.any? { |re| line =~ re } && line =~ /\b(?!self|Time|Date|Rails)\w+\.\w+\.\w+/
        puts "#{file}:#{i + 1}  Possible Demeter / N+1 chain (loop opened at #{file}:#{iter_at + 1})"
        puts "  → #{line.strip}"
        found += 1
      end
    end

    # detect start of iter block
    if !in_iter && ITER_OPENERS.any? { |re| line =~ re } && line =~ /\bdo(\s*\|.*\|)?\s*$|\{$/
      in_iter = true
      iter_indent = indent
      iter_at = i
    end
  end
end

puts "\n#{found} candidate(s) flagged. Verify with the `bullet` gem or by inspecting `bin/rails server` log."
puts "False positives are normal — this is a static heuristic. The gem catches it at runtime."
