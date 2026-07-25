# Applied to the staging copy during `skills-sync.sh push`, never to ~/.claude/skills.
# Local skills keep the real values they need to function; the published copy gets generics.
# Every rule here must also satisfy LEAK_PATTERN in skills-sync.sh, or push aborts.
# Perl, not sed: BSD sed on macOS has no \b, so word boundaries silently never match.

s{https://github\.com/guideline-app/\S*}{https://github.com/your-org/your-repo/blob/abc1234/app/ops/deprecated_thing_op.rb#L7}g;
s{\bParticipantQuarterlyStatementGenerateOp\b}{ReplacementThingOp}g;
s{guideline-app/\*,\s*Gusto/\*}{your-org/*}g;
s{guideline-app}{your-org}g;
s{gustohq\.atlassian\.net}{your-org.atlassian.net}g;
s{RETIRE-\d+}{TICKET-1234}g;
s{\bgroot\b}{your-app}gi;
s{\bminions\b}{agent-runs}gi;
s{\bminion\b}{agent-run}gi;
s{/Users/[A-Za-z][A-Za-z.]*/}{\$HOME/}g;
