# Worked example — 41 findings collapsed to six causes

Real case, 2026-09-02. A Rails 8.1 pull request added an Automations feature: 88 changed
files, a trigger model with five kinds, a run lifecycle driven by a separate execution
primitive, and new React pages. Two reviews had landed — a bot review with 15 comments
and a critique-only adversarial pass with 39 findings across five categories. The user
asked to "theorize about how we can address these in the most elegant, idiomatic way".

Read the annotations first, then the output. The annotations name the moves. The output
shows the register.

## The moves, in order

1. **Refused the count.** Opened with "39 findings is the wrong unit of work", then named
   six causes. Everything after that is diagnosis, not triage.
2. **Read the repo before proposing.** Three batched investigation passes: the schema
   against the model declarations, the sibling services, the existing comments.
3. **Found unused machinery, and led with it.** The runs table already carried five
   state-tracking timestamp columns, and the model already declared the gem option that
   fills them. Nobody used either. Hand-maintained `started_at` and `finished_at` shadowed
   them. That single discovery made several findings much cheaper than the review implied,
   so it went above the groups rather than inside one.
4. **Corrected an earlier draft claim against source.** An earlier note said call sites
   "bypass" the state machine for safety. The gem validates transitions on save, so plain
   attribute writes stay guarded — the unused part is the bang methods and the timestamps.
   The correction shipped in the same paragraph as the discovery.
5. **Attached a precedent per group.** An existing reconciler service for group A. An
   existing jsonb snapshot column pair for group B. An existing single-table-inheritance
   type column for group D.
6. **Named the dissolution test firing.** Group C made one of the bot's open findings stop
   existing rather than get a second patch, and the output says that is "the tell that this
   is the right layer".
7. **Said deletion out loud.** Group E resolves by removing broad rescues, not by adding
   handling.
8. **One sequencing, split.** A and E pre-merge. B, C, D as three sequenced follow-ups,
   C first because it was the only one closing a confidentiality finding.
9. **Kept the pushback.** None of it should happen before CI goes green and the branch
   merges.
10. **Named the disagreement.** C and D, explicitly.

## The output

Here is the shape I see. The 39 findings are not 39 problems — they are six, and each has a
precedent in this repo that tells us what "idiomatic" means *here* rather than in the abstract.

Worth stating up front, because it reframes several findings: `automation_runs` already carries
`queued_state_at`, `running_state_at`, `completed_state_at`, `failed_state_at`, and
`cancelled_state_at`. `Run` declares `stator field: :state, track: true`. Whoever wrote the
migration built the tracked-timestamp machinery and then nobody used it. Every call site writes
`update!(state: "running", started_at: Time.current)` and hand-maintains `started_at` and
`finished_at`, which shadow the columns stator fills for free. That is not a bug — Minion's own
comment records that stator validates on save, so `update!(state:)` is still guarded — but it
means several fixes cost a lot less than the findings imply.

### A. Liveness is inferred, never asserted

*Swallows ~8 findings, including both of the bot's newest*

Three workers each hold a partial theory of "is this run alive". The reaper infers death from
`minion.nil?`. The runtime guard infers overrun from `started_at`. Completion depends on one
inline `after_commit`. My approval exemption then punched a hole with no floor under it. Every
one of those is the same mistake: liveness is guessed from a state column instead of asserted
against the thing actually doing the work.

The Minion already owns a real lifecycle. So the idiom is one reconciler, not three guessers —
`Automations::Runs::Reconciler`, which walks non-terminal Runs and moves each to whatever its
Minion says. `after_commit` stays as the fast path, and stops being the only path. Precedent:
`CodeReviews::CommentReconciler`.

That single move closes the claim-to-launch window, the crash-after-`Minion.create!` blind spot,
the durable-retry gap, and the runtime-guard-versus-provisioning race — because none of them need
to be detected any more. A Run whose Minion never appeared is not a special case; it is just a Run
whose Minion says nothing.

The approval bound then becomes a policy line in the reconciler rather than a second exemption in
a guard worker. For the clock, Minion has `phase` but no `phase_changed_at`. Add that one column
and stator fills it on every phase change, for every Minion in the system. That is strictly better
than a bespoke `approval_started_at`, and it is what the gem is already asking for.

### B. The Run does not record what it ran

*Swallows ~5 findings*

`automation_runs` stores `automation_id` and free-text `cause`. No `trigger_id`, no payload, no
snapshot. `Dispatcher#launch` reads mutable Automation fields *after* the Run exists, so a
concurrent `Automations::Update` silently rewrites history.

The idiom is that a Run is an immutable execution record: `trigger_id` as a foreign key, plus a
`snapshot` jsonb resolved at claim time holding instructions, repos, and guards. Precedent is right
next door — `minion_phases` carries `params` and `result` jsonb for exactly this.

This is also what makes deduplication meaningful. Today the dedup key is the HMAC signature, which
is a hash of the body, so two legitimate identical deliveries collide. With a delivery ID on the
Run, dedup is dedup.

### C. Authorization matches on strings

*Swallows ~5 findings, including the bot's medusa gap*

`slots["repos"]` holds names, and `repo_matches?` accepts `github_full_name` **or** bare `name`. So
`"groot"` matches any reachable org's repo called `groot`.

Store `repo_ids`. Ambiguity becomes impossible, reachability becomes a join instead of a string set,
and "the trigger's repos are a subset of the automation's repos" becomes a model validation instead
of a controller check I have to remember to add per kind.

Note what that does to the finding I am currently holding: the bot says my guard is scoped to
`kind == "github"` while medusa and sentry also filter on `slots["repos"]`. Under foreign keys that
finding evaporates rather than getting a second patch. That is the tell that this is the right layer.

### D. Five trigger kinds share one untyped bag

*Swallows ~5 findings*

One `slots` jsonb serves schedule, github, sentry, medusa, and webhook. Validation is partial, the
client re-declares the event catalog independently, and Daily and Weekly are offered in the UI with
their qualifiers hidden behind silent defaults of 03:00 and Monday.

Single-table inheritance is the idiom, and `minion_phases.type` is the in-repo precedent. Each
subclass owns its validations, its `matches?`, its `next_fire_at` recomputation, and its own event
catalog — which the server then hands the client, killing the drift.

Schedule-not-recomputed-on-edit stops being a bug you fix and becomes an `after_save` that belongs
to one class.

### E. Workers rescue broadly and return

*Swallows ~3 findings*

`Match.dispatch`, the schedule worker, the runtime guard, and the reaper all catch everything, log,
and return success. Sidekiq's retry is the error handling, and these workers opt out of it. The fix
is deletion, not addition: return early on the specific "record vanished" case, let everything else
raise.

This is also what unblocks the schedule ack-ordering finding. Advance `next_fire_at` *after* a
successful dispatch and let retry cover the gap — which is only safe once the rescues are gone.

### F. Tests pin shape, not behavior

The dispatcher tests swap in a fake orchestrator that only sets Minion state, so they cannot see
startup failure or teardown. The narrow stub at the process boundary —
`Minions::Orchestrator.any_instance.expects(:stop)`, which is what I used in the runtime-guard test
— is the pattern already in the repo.

---

**What I would actually do.** A and E are small, they are mostly deletion, and between them they
close both of the bot's open findings plus five of the adversarial pass's P1s. They are the
pre-merge set.

B, C, and D are schema changes on a surface with no production users yet, which is the cheapest this
will ever be — but they are not review fixes, they are a second pass on the data model, and folding
them into a PR that is already 88 files would make it unreviewable. I would land them as three
sequenced follow-ups, C first, because it is the only one of the three that closes a confidentiality
finding.

The thing I would push back on: none of this is worth doing before CI is green and the branch is
merged. The flake is unrelated, and holding a correct PR open while we redesign the trigger model is
how it goes stale again.

Which of these do you want to dig into? C and D are the ones where I think reasonable people would
disagree with me.
