<!-- guardrail-kit-builder contract: v1.0 -->
You are here because you are about to draft or edit a kit's CLAUDE.md block or any
docs/guardrails file. These rules govern the kit's FORM. Violating them silently
degrades every rule the kit is trying to enforce — a kit that is hard to comply with
by construction gets skimmed, and a skimmed kit is a decorative one.

- F1. Every rule is one line, <=20 words where possible, opening with an imperative
  verb or a trigger clause (`When/Before/After <observable event>:`). No paragraphs.
  No hedges (usually / consider / try / generally). A line over ~30 words splits
  into sub-lines under the same ID.
- F2. Triggers are observable events the model detects while working ("writing a
  condition containing `!` plus `&&`") — never judgment states ("when logic is
  complex"), predictions ("will outlive this sitting"), or topic nouns
  ("debugging"). If you can't point to the exact token or action that fires it,
  it isn't a trigger yet.
- F3. Set an explicit CLAUDE.md budget before drafting and write it down in this
  file's project-specific notes: a default starting point is <=15 iron rules, one
  routing table, <=5 CAPS lines, kit core + footer <=60 lines. Adding a rule over
  budget requires demoting one to a doc in the same edit. Never merge two rules
  into one line to dodge the cap — that just hides the same cognitive load.
- F4. NEVER/ALWAYS/MUST in caps: bounded (5 is a reasonable default), reserved for
  irreversible damage — data loss, killed shared processes, pushed/force-pushed
  history, leaked secrets. Adding one over budget requires downgrading an existing
  one. Everyday importance is not irreversibility; don't caps-lock urgency.
- F5. Every prohibition carries its replacement action on the same line, after
  `->` or an em-dash. A prohibition without a replacement is invalid — rewrite it.
  ("Never X" alone tells the model what not to do and nothing about what to do
  instead, which is exactly the gap it will fill with something worse.)
- F6. Every iron rule ends with a parenthesized reason, <=8 words, naming the
  concrete harm ("missed callers break silently", "kills your own harness"). Long
  rationale belongs below the owning doc's `--- reference ---` divider, not in the
  compressed line.
- F7. Single source: a rule lives in exactly one file; cross-references are
  pointers by path + ID, never restatements. One sanctioned exception: a CLAUDE.md
  iron rule may be the COMPRESSED form of a doc rule — in that case the doc side
  cites the iron rule by name, and any trigger-phrase list or threshold the pair
  shares must stay byte-identical in both copies. Keep your own running list of
  which iron rules pair with which doc rules; when either side changes, check the
  list and update both, in the same edit.
- F8. CLAUDE.md layout, in order: routing table first, iron rules immediately
  after, any project-specific section next, hard stops + the post-compaction
  re-arm line last. Don't interleave project content into the kit zone — a reader
  (human or model) should be able to tell at a glance which lines are kit
  machinery and which are project facts.
- F9. Every rule names a greppable literal token — an exact command, path, or
  number (`git diff --stat HEAD`, `docs/STATE.md`, `>50 hits`). A rule with no
  literal token gets rewritten until it has one, or it doesn't belong in the kit;
  vague rules are exactly the ones that get silently reinterpreted.
- F10. Kit verbs name real tool actions (Read, Grep, Edit, Write, run a command) —
  never "see / consult / check / refer to" when a tool call is actually meant.
  Every doc reference is a full literal path, optionally with a rule ID after it.
- F11. Guardrail doc shape, top to bottom: a version comment on line 1; the first
  non-comment line restates the doc's routing-table trigger VERBATIM; the ID'd
  checklist fills the top; named procedures invoked by ID from the checklist or
  from CLAUDE.md may sit between the checklist and the `--- reference ---`
  divider; reference-section headers are second-person situations ("Your fix
  didn't change the error"), never topic nouns ("Debugging tips"). Cap each doc
  around 120 lines and 1,100 words; a doc that must grow past either splits by
  trigger into two docs, not by shrinking the content.
- F12. Checklist IDs are stable forever — pick a short unique prefix per doc (a
  common scheme: P for planning, C for code-edit, D for debug, V for verify, E for
  efficiency, S for session/state — but derive prefixes from your own doc names,
  don't force these), and never renumber or reuse a retired ID even after the rule
  it named is deleted. Grouping by theme may make numbering non-sequential inside
  a doc; that's fine and expected. Compliance with any rule is cited by ID plus one
  line of evidence, so a renumbered ID silently breaks every existing citation of it.
- F13. Examples: at most one GOOD/BAD pair per core rule, placed below the
  divider. GOOD is a 5-10 line mini-transcript of the correct tool sequence. BAD is
  <=3 lines, always prefixed `BAD (never do this):`. No unlabeled example code.
- F14. Numbers, not judgment words: "10 messages" not "recently", "2 failures" not
  "repeatedly", ">200 lines" not "long output". The exact value matters less than
  the fact that some exact value is stated — a number is checkable, a judgment
  word invites a different threshold every time it's read.
- F15. Kit files are edited only deliberately and verbatim-carefully: never
  regenerate a kit file from memory, never "clean up" wording in passing, never
  reflow. Any kit edit bumps the version comment on that file's first line and
  adds one entry to the project's migration log (create `docs/guardrails/
  MIGRATION-LOG.md` the first time you need it). Exemption: any file the kit
  explicitly designates as a project-authored archive (raw transported content,
  not kit prose) is exempt from these formatting contracts — reformatting an
  archive to match the contract destroys the reason it was kept verbatim.
- F16. Kit source paths stay relative wherever the kit is meant to be portable
  across projects. If you deploy one authored kit to multiple installs and need
  install-time absolute paths, do that as one deterministic, documented transform
  script — never by hand-editing paths into the source copy, which silently forks
  the two.

--- reference ---

## Why form is load-bearing

Models comply with what they can pattern-match at the moment of acting. Event-
phrased triggers fire because they match tokens the model actually generates mid-
task ("pytest exited 1"); topic headers describing a general area never fire at a
specific moment, so they get read once and then forgotten. Paste-verbs ("paste the
output") are self-enforcing because compliance is visible in the transcript;
check-verbs ("ensure", "make sure") invite assertion without evidence. Budgets
exist because always-on compliance load is roughly constant-sum: every rule added
to the permanently-loaded index silently taxes attention to every other rule
already there. Paired trigger lists must stay byte-identical because a model greps
its own draft against whichever copy it read most recently — a drifted pair is
worse than no pair, because it looks authoritative on both sides while agreeing
with neither.

## You inherited an existing kit and want to add one rule

Don't just append a checklist line and move on. Check: does it fit an existing
doc's trigger, or does it need a new one? Does it push any budget (F3/F4) over the
line, requiring a demotion elsewhere in the same edit? Does it duplicate a rule
already covered by another ID (F9's literal-token test usually surfaces this)? Only
after those three checks does the new line go in — otherwise the kit accretes the
same bloat it was built to prevent.

## You're not sure whether something is a rule or just a fact

A rule changes behavior at a specific moment ("before X, do Y"). A fact describes
the world and belongs in ordinary project documentation, not the kit — "the API
uses REST" is a fact; "before calling an unfamiliar API, paste its real signature"
is a rule. If a candidate line has no verb describing an action to take, it's
probably a fact in disguise; move it to README/docs, not to a checklist.
