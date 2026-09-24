# Page template

Section order and headings are fixed. Keep headings short, such as `Goal` and `Plan`.

````markdown
This page covers <work> under [EPIC-KEY](<jira url>), "<epic title>," and its N child tickets.
## Goal
<callout icon="🎯" color="green_bg">
	<One-sentence end state, stated as behavior, not build.> <A number: "at least 95% of X ...">. <What counts and what does not, e.g. "It doesn’t need to merge to hit this goal (at first); it only needs to capture X in a PR.">
</callout>
- **<Metric>.** <br>*<Definition. Today's baseline. The target.>* {color="yellow_bg"}
- **<Metric>.** <br>*<...>* {color="red_bg"}
- **<Metric>.** <br>*<...>* {color="purple_bg"}
- **<Metric>.** <br>*<...>* {color="blue_bg"}
## Orientation: how <X> reaches <Y> today
<Two sentences: which systems act on their own, and what the one gap is. Refer to nodes by legend color or label, never by node ID.>
<span color="blue_bg">**CI server**</span> <span color="purple_bg">**Flake service**</span> <span color="orange_bg">**Engineer**</span> <span color="green_bg">**Bot**</span> <span color="yellow_bg">**GitHub**</span> <span color="gray">white, dotted border = not built yet (draft)</span>
```mermaid
<current-vs-planned flowchart>
```
## Plan
<Two or three sentences reading the graph aloud: what unblocks what, which tracks run in parallel, what the dotted line means.>
<span color="pink_bg">**Spike**</span> <span color="blue_bg">**Roster fetch**</span> <span color="green_bg">**Sweep**</span> <span color="purple_bg">**Merge**</span>
```mermaid
<ticket dependency flowchart>
```
## Acceptance criteria, in product terms
The result the epic must produce, not the code path that produces it.
- <Observable outcome a user or operator would notice. No class names, no implementation.>
- <...>
- Where to learn more: <the records, services, and dirs a new engineer should read first>.
## Notes
- <Legend: white with a dotted border = still to build, solid = runs today.>
- <Each open question or ticket overlap, one bullet each.>
- <Explicit non-goal: what this epic does not do.>
---
Source tickets: [EPIC-KEY](<url>) (epic), KEY-1, KEY-2, ...
````

## Rules for the content

- **Goal is a number plus a scope caveat.** “100% of flakes” is a slogan; “at least 95% of flaky tests get a fix PR within one day (merge not required yet)” is a goal. If the user gives only a slogan, write the slogan and flag the missing number in your report.
- **Use 3–5 metrics, one line each.** Give a name, then *definition, baseline, target* in italics. Aim for coverage, latency, manual load, and automation.
- **Write AC as outcomes.** “Every quarantined test shows up with an open triage” is good. “`Poller` calls `FlakeClient#quarantined`” is not. Put code pointers only in the final “Where to learn more” bullet.
- **Use Notes for what the picture cannot show.** Include ticket overlaps, fake versus real dependencies, and non-goals. Three bullets is normal.
