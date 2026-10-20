# Loops and Economies

Depth for P-LOOP and P-ECONOMY. Examples are from `sector-unity-proto` and its audits.

## Nested loops

A game is not one loop. It is several, running at once, each built out of the one below it.

| Loop | Length | One turn of it | What it pays out |
| --- | --- | --- | --- |
| Moment | 0.1–1 s | hold the laser on a rock | heat climbs, ore ticks up |
| Encounter | 10–60 s | work one rock, one repair, one dock | ore in the hold, a fault cleared |
| Voyage | 20–60 min | commit, burn, arrive, trade | credits, a contract closed, a claim breached |
| Campaign | 10–100 h | the whole run | reputation, crew, the ship you end up with |

The rule that matters: **every loop needs its own payout.** A player who mines for forty minutes and learns nothing until they dock is running a forty-minute loop with nothing inside it. That is a long time to act on faith.

### Closing a loop

A loop closes only when all four steps happen. Name the missing one before changing anything.

1. **Act.** The player does something on purpose.
2. **Respond.** The world changes because of it.
3. **Read.** The player perceives the change.
4. **Learn.** They expect something different next time.

Step 3 is the one that goes missing, and it is the whole of P-LEGIBLE. The crew scheduler computes where every crew member is; the interior view draws none of them. The system responds correctly and invisibly, so the player never reaches step 4.

Step 1 is the one that goes missing in a system that looks busy and feels dead. Mining used to run itself — the player was inside the loop without driving it. Aim-and-hold, heat that forces a cadence, and a scan that costs 8 units of the same fuel that gets you home put the player back at step 1 without changing what mining *is*.

## Pacing and time compression

At honest interplanetary distances a burn takes weeks, so the game lets the player compress time on a continuous knob. That solves the boredom problem and creates a new one: the player can compress straight through the moments that were supposed to matter.

The fix is for the sim to reach into the pacing. A detected fault forces compression back to 1x. The player does not choose to pay attention; the world takes the fast-forward away.

This generalises. Any time you give the player a skip, decide what the skip may not skip, and enforce it from the simulation rather than from a dialog box.

## Stocks and flows

Any quantity in a game is a tub. Something fills it, something drains it, and an amount sits in the middle.

- The **stock** is how much is in the tub now — credits, fuel, ore, rations, hull integrity, the player's own evening.
- A **faucet** puts more in — contract payouts, ore sales, daily rig yield, refuelling.
- A **sink** takes it out — coils, repairs, rations, docking fees, the 8 units a scan costs.

Design the two rates. The stock is only ever what the rates make it, and tuning the stock directly is treating the symptom.

### A drain with no tap is a doom clock

Fuel is the clean example, and the same number means two completely different things depending on whether a faucet exists.

With no refuel, fuel only ever goes down. Every use is a wound, so the player hoards it and stops flying. The design intends fuel as a *budget* and the player experiences it as a *countdown*, and no amount of retuning the burn rate fixes that, because the problem is a missing faucet rather than a wrong number.

Wire refuelling and the same 8-unit scan cost becomes a purchase. A negative-balance floor — the audit proposes a −500 credit lien — matters more than it looks: without it, a player who runs dry with no credits is not in a tight spot, they are in a dead save.

### The desperation dial

The squeeze is where the design lives, and it is arithmetic rather than script:

```
after delivery   ~430 cr
coil              202 cr
refill           ~300 cr
rations           150 cr
```

Pick two. Nobody authored that dilemma. Four rates produced it, and it can be tuned by moving any one of them.

This is the single most useful move in economy design: **when you want tension, do not write a dilemma — set rates that cannot all be satisfied.** The player then invents the dilemma themselves, which is why it feels like theirs.

### Time has to be a sink too

If holding a position costs nothing, waiting is free and patience becomes a dominant strategy. The build has this bug in a precise form: the system that would drift stockpiles and prices day over day has no host caller, so nothing degrades while the player sits. Time is not priced, so there is never a reason to hurry.

Deadlines are the other half. A haulage contract due on day 10 is what made coasting stop dominating, because it finally attached a cost to the cheapest thing in the game.

### Attention is a stock

The player has a session length and it drains. A 45-minute voyage in a game played in 30-minute sittings gets abandoned mid-burn, and the player will report the game as exhausting rather than as mistimed.

Budget the player's real minutes the way you budget their credits.

## Feedback

Feedback is what happens when a loop's output feeds its own input. Two polarities, opposite jobs.

**Negative feedback pulls toward the middle.** The leader is slowed, the straggler helped. Its job is to keep the outcome uncertain, which protects P-UNCERTAIN late. Its cost is that it dilutes skill — a player who earned a lead does not keep it.

**Positive feedback amplifies whatever is already happening.** A good haul buys a better coil, which enables better hauls. Its job is to *end* games; without it an even match never resolves. Its cost is the runaway leader.

Trade economies are strongly positive-feedback by nature. Capital buys cargo capacity, capacity earns capital. Left alone, the first good voyage decides the run, and the remaining hours are a player performing an outcome they already know.

The brake belongs on the loop, not on the player. Three that keep skill intact:

- **Cap the amplification.** Hold capacity stops converting to profit past a ceiling.
- **Make the lead cost something.** More ship is more upkeep, more fuel, more crew to feed.
- **Let the world respond.** A player who floods one route drops its own price. Negative feedback the player caused reads as consequence rather than as rubber-banding.

### Why catch-up mechanics get resented

A mechanic that hands the trailing player a win regardless of what they did is negative feedback applied to the **outcome**. It reads as the game overruling a decision after the fact — the exact shape of output randomness.

Apply it to **opportunity** instead. Give the struggling player better options: a shorter route, a cheaper berth, better intel. They still have to play well to use it. The leader is threatened without being punished.

## Grind arithmetic

"Grindy" is almost never about the total. It is the ratio between a cost and the rate that pays for it. Always convert a price into time before judging it:

```
time to goal = cost / income rate
```

A 202-credit coil against 40 credits of profit a voyage is five voyages. Stated as "202 credits" it hides the only number the player actually experiences.

Two ratios worth checking on any progression:

- **Time to the next thing.** If it exceeds a session, the player logs off mid-climb with nothing gained.
- **Ratio between consecutive costs.** A steady 1.5x–2x reads as a curve. A jump from 600 to 12,000 reads as a wall, and players quit at walls rather than climbing them.

### When a faucet is mistuned, look for the strategy it kills

Contract pay currently loses to the spot market by three to nine times. Read that as a rate problem and the consequence is immediate: the contract board — deadlines, reputation, the whole structure built on top of it — is bypassed by any player who does the arithmetic.

A mistuned faucet does not merely make a number wrong. It deletes every system downstream of it.
