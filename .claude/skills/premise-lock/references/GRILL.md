<!-- premise-lock contract: v1.0 -->
The premise has a fork you cannot resolve from the code, or the user invoked this skill on you.

- GR1. Ask with `AskUserQuestion`, never in prose (a prose question gets a prose answer, or none).
- GR2. Every option carries the consequence of choosing it, and the recommended option is first and labelled (a bare option hands the work back).
- GR12. One fork per call; add a 2nd question only when it is independent of the 1st (a dependent fork asked early gets answered against the wrong premise).
- GR3. Question answerable from the code: Grep or Read it, do not ask (the user is not your search index).
- GR4. Never ask about codebase patterns, technical risk, or implementation approach (the user decides what, you decide how).
- GR5. Ask only about intent: how they imagine it working, what it looks like, essential against nice-to-have, references they hold.
- GR6. Question adds a capability the work description does not name: write `DEFERRED: <thing>` and return to scope (discussion sets HOW, never WHETHER).
- GR7. Fork stays unresolved: append it to `## Open questions` in `.context/CONTEXT-<SLUG>.md`, naming the work it blocks (an unwritten fork resurfaces as rework).
- GR8. Decision reached: write it to `.context/CONTEXT-<SLUG>.md` in the same turn, before the next question (a decision held in chat decays).
- GR9. Segment ends: stamp `docs/STATE.md` with the locked premise and the open-question count (the next session starts blind otherwise).
- GR10. User invokes this skill on you mid-task: do not restart, post the block from item 4 and name the layer you were on (a restart discards the evidence).
- GR11. User says they do not know this area: run `zoom-out` before writing item 2 (a mechanism named in the wrong vocabulary cannot be confirmed).

--- reference ---

## The user invoked this skill on you

The trigger is not always yours. The user says "you're doing it again", "wrong layer", or runs `/premise-lock` directly. That means they detected the compensator chain from outside and you did not detect it from inside.

Do not start over. Starting over discards the measurements that are already good.

```
1. name the layer you were on          "I was tuning the shell's size constants."
2. re-post the block from item 4       the CAUSE line is the one that was wrong
3. mark superseded work                do not delete it, mark it
4. resume at the interview             one question, with your recommendation
```

## The .context document

Create it lazily, at the first resolved decision. One file per slug.

```markdown
# CONTEXT-<SLUG>

## Premise
1 PROBLEM    ...
2 MECHANISM  ...
4 CAUSE      file:line + number
5 TEST       command + runtime

## Decisions
- <decision> - <one line of why> - <date>

## Open questions
- [ ] <question> - blocks: <work> - recommended: <your answer>

## Deferred
- <out-of-scope idea raised during the session>
```

`## Open questions` is the load-bearing section. Every fork you could not close goes there with the work it blocks, so the next session reads the gap instead of rediscovering it.

## Your question is really a search

BAD (never do this):
```
Which camera renders the catalog bodies, and is it perspective or orthographic?
```

GOOD:
```
probe -> SceneryBackdropCam ortho=False fov=100 mask=0x20000000
         IsoCamera          ortho=True  size=21

Catalog bodies render on the perspective camera. That is the growth.
Recommended: move them to IsoCamera's layer. Confirm, or say wrong layer.
```

GR3 and GR2 work as a pair. Resolve what the code can answer, then ask the one thing only the user knows, and bring your answer with you.

## Stamping STATE.md

At segment end, append to `docs/STATE.md`:

```markdown
## <DATE> premise-lock: <SLUG>
- Locked: <the MECHANISM line>
- Cause: <file:line + number>
- Open questions: <n> (see .context/CONTEXT-<SLUG>.md)
- Constraints added: <verbatim user "don't / only / keep / stop" lines>
```

Verbatim is the rule for constraint lines. A paraphrased constraint decays within 50 turns.
