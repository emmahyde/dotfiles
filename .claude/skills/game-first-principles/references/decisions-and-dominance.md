# Decisions and Dominance

Depth for P-CHOICE, P-UNCERTAIN, P-LEGIBLE, and P-OWN. Examples are from `sector-unity-proto` and its audits.

## The four-part test

A decision is interesting only with all four:

| Part | The question it answers | Fails as |
| --- | --- | --- |
| Stakes | Can this go badly? | a formality |
| Information | Can I reason about it? | a coin flip |
| Tradeoff | Does picking one cost me another? | a free lunch |
| Ownership | Will the world remember? | a daydream |

Run the test on one thing at a time and write the answers down. Three yeses and a no is not "mostly a decision" — it is an inert decision with three parts built.

Worked, on deploying a mining rig:

- Stakes — yes. Real credits leave the wallet, and invalid placement is refused.
- Information — yes. The player sees the site, the cost, and the yield rate.
- Tradeoff — yes. That money is not buying the coil.
- Ownership — **no.** Nothing saves the rig. Reload and the credits are spent and the rig is gone.

The build cost of the missing part is one save participant. The design cost of leaving it missing is the entire decision.

## Auditing a build for dominant strategies

The method that found four dominant strategies in one pass:

1. **List every menu the player can open.** Not systems — menus. The places a player is asked to choose.
2. **For each, ask what a knowledgeable player picks every time.** If you can name it, that menu is not asking a question.
3. **Say why it wins, in numbers.** "Never buy" won because buying was a guaranteed 40 percent loss. That number is the finding; "the economy feels off" is not.
4. **Find the missing cost.** A dominant strategy is almost always an option with no downside attached. Coasting dominated because time was free; deadlines that bite made time expensive.

The four found: never buy, never spend, never accept a contract, coast everywhere. Note the shape they share — every one of them is a way of *declining to play*. When the optimal strategy is inaction, the game is not asking anything at all.

### Dominated is not the same as inert

The contract board now passes all four parts of the test. It is still answered the same way every time, because contract pay loses to the spot market by three to nine times. The decision exists and the tuning kills it.

Keep these separate when you report. "This is inert" is a wiring problem. "This is dominated" is a numbers problem. They need different fixes and the second one is usually cheaper.

## Two kinds of randomness

Both are dice. They land completely differently, and the difference is *when* relative to the player's commitment.

**Input randomness** happens before the decision. The world is shuffled, then the player plans against it. A NO BERTH warning at the destination, a named crisis on the intel board, a supply shortage you can read — all of these hand the player a problem and let them be clever.

**Output randomness** happens after. The player commits, then the dice decide. A fault that fires mid-burn overrules a plan already made.

Neither is banned. Output randomness creates the drama of not knowing. But every unit of it you add takes agency out, so make the player *feel* it coming first. This build does it correctly in one place: a detected fault forces time compression back to 1x. The randomness already resolved, and the game makes sure the player is watching when it does.

Breaks worst when output randomness is invisible *and* punishing. A fault that cannot be repaired because the scannable set does not contain the part it demands is a coin flip the player never saw flip.

### Players are bad at probability, and the design has to absorb it

Two facts that hold across every game with dice:

- A 95 percent chance that fails reads as a bug. Players do not experience 1-in-20; they experience betrayal.
- Long runs of bad luck get remembered and long runs of good luck do not.

The usual fixes are to bend the odds toward the player's intuition rather than to lecture them: floor the worst outcome, use a shuffled bag instead of independent rolls so a bad streak has a length limit, or move the randomness to the input side where it becomes a puzzle instead of a verdict.

## Legibility: the DEBUG-ONLY rule

The strongest thing the audit does is refuse to count invisible work as done:

> Anything whose only reader is `ShipStateSpreadsheet.cs` is **DEBUG-ONLY, not done** — that tab is a dump, not a surface.

Adopt this verbatim. It converts a vague argument about polish into a checkable property: name the non-debug reader, or the feature is not finished.

What it catches here is not small. Mutiny plots self-instigate daily with a leader, a grievance, and a goal, and a successful mutiny changes nothing. A nemesis's obsession escalates daily and can never arrive. The court runs a process day with zero Unity readers. All of it reaches the player through nothing but a debug dump.

The audit's own conclusion is worth keeping: this tier is the highest leverage-to-effort work in the project. Surfacing drama you already simulate beats simulating more.

### The guard that has never taken its true branch

A subtler legibility failure, and one worth searching for by hand: the build's factions are constructed from an empty dictionary and an empty array. Every `.IsValid` faction check compiles, runs, and has never once evaluated true.

Code that runs is not code that works. A branch nothing has reached is untested by definition, and a system nothing has reached is a design that has never actually been played. When you audit, check the data the system is fed, not only the code that would consume it.

## Ownership: what a save file is for

A save is not a convenience feature. It is the mechanism that makes consequence real, and gaps in it void decisions in order of how much the player earned them.

- **Purchases.** Deployed rigs vanish on load. The most expensive thing to lose.
- **Knowledge.** Player knowledge does not persist, so every load makes the player omniscient by amnesia — the fog surface has nothing left to withhold. Note the direction of the bug: the player is *rewarded* for reloading.
- **World state.** Market prices reload to seeded values under a player who remembers them, so a reload rewinds the market for everyone but the person reading it.
- **Consistency.** A restored crisis reattaches to a healthy stockpile, so it can never close naturally. This one is worse than losing the state — the world is now in a shape the rules cannot resolve.

Ownership works the other way too, and that is what proves it is a real mechanism rather than a chore. Selling into the wrong station breaches an exclusive claim and costs 150 credits, taking the player from 610 to 460. The player was punished, and the punishment is why the decision meant something.

### Earned and inert

Certifications are awarded on skill milestones, displayed to the player, and gate nothing. The game remembers, tells the player it remembers, and does not act on it.

This is the most common shape of half-built ownership, and the easiest to mistake for finished work. Persistence and display are two of three. The third is a rule somewhere that reads the value and behaves differently.

## Teaching without a tutorial

Players learn from consequence far better than from text. The order that works:

1. **Show it safely.** Let the player meet the mechanic where a mistake is cheap.
2. **Make it matter.** Give it stakes once the shape is understood.
3. **Combine it.** Put it against another mechanic so the player has to trade off.

A tutorial box is what you write when steps 1 and 2 are missing. If a mechanic needs a paragraph to explain, that paragraph is usually documenting a legibility failure — the mechanic is not observable at the controls, and the box is a workaround.

## The bar to aim at

The project calls it the 2am test: the sim **produces, names, and persists one story a player could retell, with the player's part credited.**

It is a better definition of done than any feature list, because it cannot be satisfied by any single system. Producing needs loops and economies. Naming needs legibility. Persisting needs ownership. Crediting the player's part needs the choice to have been real.

Point any "is this a game yet?" question at it.
