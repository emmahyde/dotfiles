---
name: game-first-principles
description: |
  Explain game design — decisions, loops, economies, legibility, and consequence —
  from first principles, in plain short sentences, for a reader who does not know
  the jargon. Builds each idea before it names it. Grounded in sector-unity-proto's
  own decisions-under-constraint rubric and its open-work audits. Use when the user
  asks what something is or why it behaves the way it does: "what is a game loop",
  "what is a core loop", "why is my game boring", "what makes a decision
  interesting", "is this a game yet", "what is a dominant strategy", "why is
  coasting always right", "what is an inert decision", "why does nobody notice my
  system", "what is dead drama", "what is a feedback loop", "positive vs negative
  feedback", "what is a sink", "what is a faucet", "why is my economy inflating",
  "what is grind", "input vs output randomness", "why does a 95% miss feel unfair",
  "what is telegraphing", "what is game feel", "what is emergence", "systems vs
  content", "what is pacing", "risk reward", "how do I teach a mechanic", "eli5
  game design", "first principles", "explain like I am five", "teach me game
  design", "I do not know this area of design".
---

# Game Design From First Principles

## What this skill is for

Explain game design ideas to someone who has never used them. Build each idea from nothing. Name it only after they can already picture it.

Examples come from `sector-unity-proto`, because a real build with a real audit teaches better than an invented one. For graphics, cameras, and world space, use the `3d-first-principles` skill. For what the screen actually showed, use the `grievance` skill — a capture is ground truth and memory is not.

This is a teaching skill, not a production skill.

## How to explain (the contract)

Follow these six rules. They are the skill.

- **E-BUILD.** Build the idea, then name it. Never open with the jargon word. Wrong: "A dominant strategy collapses the decision space." Right: "If coasting is right on every trip, the burn profile menu is not asking you anything. That is a *dominant strategy*."
- **E-ONEPICTURE.** One physical analogy per idea. Never mix two analogies for one idea. A reader who holds two pictures holds neither.
- **E-BREAKS.** Say what goes wrong when you get it wrong. An idea with no failure mode is trivia. "Mutiny plots self-instigate every day with a leader, a grievance, and a goal — and a successful mutiny changes nothing."
- **E-NUMBERS.** Give the number, not the adjective. Not "you can't afford everything". Instead: "you land with about 430 credits, and the coil is 202, the refill about 300, rations 150. Pick two."
- **E-JOB.** For a "why is it like this" question, answer in three steps. State the thing's job. Show the mechanism that job forces. Show why the obvious alternative fails at that job.
- **E-DRAW.** Draw it when the shape is the point. A loop, a tension curve, and a tub with a tap and a drain are all shapes. Words alone make the reader rebuild the picture in their head.

Register: short active sentences, one idea each, present tense. See the `simple-english` skill for the full rule set.

## The test everything hangs off

`sector-unity-proto` audits itself against one rubric, and it is the best short definition of a decision worth having:

> A decision is INTERESTING only with all four of **stakes**, **information**, **tradeoff**, and **ownership** (consequences the game remembers).

All four, not three. Miss one and the decision is *inert*: it is on screen, it costs the player a click, and it is not a decision.

Four of the six principles below are those four parts. The other two are the machinery that produces them.

| Rubric part | Principle |
| --- | --- |
| stakes | P-UNCERTAIN |
| information | P-LEGIBLE |
| tradeoff | P-CHOICE |
| ownership | P-OWN |
| the loop that delivers all four | P-LOOP |
| the rates that keep them true | P-ECONOMY |

## The six principles

Teach them in order. A reader who holds all six can derive most of the rest without help.

### P-CHOICE — a decision needs two options a reasonable person could argue for

If one option is better in every situation, the player has nothing to decide. They have a chore. The sharpest symptom is when the best play is *not to play*.

That is not hypothetical. The first audit of this build found the optimal strategy was: never buy, never spend, never accept a contract, coast everywhere. Four menus, four dominant strategies, no decisions. Each broke for a specific reason:

- **Coasting** stopped dominating when contracts got deadlines that bite. A haulage job due on day 10 makes a fast burn worth its fuel.
- **Never buying** stopped dominating when a purchase could turn a profit at all. It used to be a guaranteed 40 percent loss — a trap wearing the clothes of a choice.
- **Never accepting** stopped dominating when delivery paid. A 500 credit contract took the player from 10 credits to 610.

A decision can also exist and still be dominated. Contract pay currently loses to the spot market by three to nine times, so the contract board is a real decision that a knowledgeable player still always answers the same way.

Breaks when: one option wins everywhere. The player finds it within an hour and repeats it forever. They will call the game boring, and they will be describing a structural fact rather than a mood.

### P-LOOP — the atom is act, outcome, learn, act again

The player acts. The world responds. The player reads the response. They act again knowing more.

Games run several of these at once, at different speeds. At honest distances a burn takes weeks, so this build lets the player compress time with a continuous knob — and takes it away on purpose. A detected fault forces compression back to 1x. The sim reaches into the pacing and says: this part you watch.

| Loop | Length | In this game |
| --- | --- | --- |
| Moment | 0.1–1 s | hold the mining laser, watch heat climb |
| Encounter | 10–60 s | work one rock, one repair, one dock |
| Voyage | 20–60 min | commit, burn, arrive, trade |
| Campaign | 10–100 h | reputation, crew, the ship you end up with |

Breaks when: the player is a passenger inside their own loop. Mining used to be a screensaver — it *happened to* the player rather than being *run by* them. Aim-and-hold, heat that forces a cadence, and a scan that costs 8 units of the same fuel that gets you home turned the same activity into a loop the player closes.

### P-UNCERTAIN — no doubt, no stakes

If the player already knows the outcome, nothing is at risk. Doubt comes from exactly three places: randomness, hidden information, and execution that is hard.

*When* the doubt resolves decides whether it feels fair. Doubt resolved **before** the decision — a NO BERTH warning at the destination, a named crisis on the intel board, a shortage you can read — hands the player a problem to solve. Doubt resolved **after** the decision overrules a commitment they already made.

Withholding is a design material, and it has to be maintained. Intel freshness is meant to decay; the decay never ticks, so old intel stays as trustworthy as new. Information is meant to travel at light speed; the delay is unwired. Each unwired piece quietly converts a judgement call into a lookup.

Breaks when: the player loses to information they could not have had. A fault that cannot be repaired because the scannable set does not contain the part it demands is not difficulty. It is the game keeping a secret and charging for it.

### P-LEGIBLE — the player can only play what they can read

A player acts on what they perceive, never on what is true. A deep simulation that shows nothing does not exist.

This build has a whole tier named for the failure: **dead drama — ticks every day, no audience.** Mutiny plots self-instigate daily with a leader, a grievance, and a goal, and a successful mutiny changes nothing. A nemesis's obsession escalates every day and can never arrive. The court runs its process day and has zero readers outside a debug tab. The crew scheduler computes where every crew member is, and the interior view draws none of them — the single largest built-but-invisible system in the repo.

The audit encodes the standard as a rule: anything whose only reader is the debug spreadsheet is **DEBUG-ONLY, not done** — that tab is a dump, not a surface.

Breaks when: you answer "the systems feel thin" by building another system. The audit's own recommendation is the opposite, and it calls this the highest leverage-to-effort tier in the project. Surface the drama you already simulate.

### P-OWN — a consequence the game forgets did not happen

The fourth part of the rubric, and the one that quietly voids the other three. A choice with stakes, information, and a real tradeoff still is not a decision if the world resets afterward.

Deployed mining infrastructure costs real credits, refuses invalid placement, and accrues yield daily — a genuine decision by three of the four tests. It has no save participant, so the rig bought with credits is gone on load.

The subtler damage is to knowledge. Player knowledge is not saved, so every load makes the player *omniscient by amnesia*: the fog surface has nothing left to withhold. Market prices reload to their seeded values under a player who remembers what they were. A restored crisis reattaches to a healthy stockpile, so it can never close naturally.

Ownership is also what makes a consequence land the other way. Selling into the wrong station breaches an exclusive claim and costs 150 credits, taking the player from 610 to 460. The game remembered, so the choice was real.

Breaks when: consequences are session-local. The player learns, correctly, that nothing they do is worth caring about. Certifications in this build are earned on skill milestones, displayed, and gate nothing — earned and inert.

### P-ECONOMY — every quantity is a tub with a tap and a drain

Fuel, credits, ore, rations, and the player's own hours are all the same shape: an amount, something filling it, something draining it. The way in is a *faucet*, the way out a *sink*. Design the rates; the amount is only ever what the rates make it.

The same number changes meaning entirely depending on whether a faucet exists. Fuel with no refuel is a doom clock — it only goes down, so the player hoards it and stops flying. Once refuelling is wired, fuel becomes a budget, and spending 8 units on a scan becomes a decision instead of a wound.

The squeeze is where the design lives, and it is arithmetic. Post-delivery the player holds about 430 credits. The coil is 202, the refill about 300, rations 150. Pick two. No script produced that tension; the rates did.

Breaks when: a drain has no matching tap, or a tap has no matching drain. The first produces hoarding and paralysis. The second produces a currency that stops meaning anything.

## Where to go next

- [Decisions and dominance](references/decisions-and-dominance.md) — applying the four-part rubric, auditing a build for dominant strategies, the decision-table method, input versus output randomness, how players misread probability, difficulty as a model gap, and teaching without tutorials.
- [Loops and economies](references/loops-and-economies.md) — nested loop timescales, closing a loop, compression and protected moments, stocks and flows, faucets and sinks with worked numbers, feedback polarity, runaway leaders, and grind arithmetic.

## Diagnosing a confused player

Match the complaint to the principle. Teach that principle, not the symptom.

| The player says | Teach |
| --- | --- |
| "It's boring" / "I do the same thing every trip" | P-CHOICE — look for the dominant strategy first |
| "The best move is to do nothing" | P-CHOICE — the exact failure the first audit named |
| "It's playing itself" / "I'm just watching" | P-LOOP — the player is a passenger |
| "That was unfair" after losing to a hidden rule | P-UNCERTAIN — doubt resolved after the commitment |
| "There's nothing going on" while systems tick daily | P-LEGIBLE — dead drama; surface it, do not build more |
| "The crew never do anything" | P-LEGIBLE — a debug dump is not a surface |
| "Why bother, it resets anyway" | P-OWN |
| "I already know everything on a fresh load" | P-OWN — omniscience by amnesia |
| "I never spend anything" | P-ECONOMY — a drain with no tap |
| "Money stopped mattering" | P-ECONOMY — a tap with no drain |

## Two cautions on auditing

**A source count cannot prove fun.** Reading call sites proves a decision is no longer inert. Only playing proves it *reads* as a tradeoff at the controls. Keep the two claims apart, and never let the first stand in for the second.

**"No call site" can be wrong.** Daily rig yield looked dead to a name-only search and was reached through a wrapper three calls deep. Check the wrapper surface before declaring a system unreachable.

## The definition of done worth stealing

The project calls it the 2am test: the sim **produces, names, and persists one story a player could retell, with the player's part credited.**

Read it against the rubric and it is all four parts at once. Produces is P-LOOP and P-ECONOMY. Names is P-LEGIBLE. Persists is P-OWN. *With the player's part credited* is P-CHOICE — the story has to have been theirs to change.
