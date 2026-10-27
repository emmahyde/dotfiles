# Targeted discovery

## Run a conversation, not a form

Extract answers already present in the request. During creative discovery, ask 2–4 related questions per round. In specification mode, ask one decision question at a time with a recommended answer and wait for feedback; follow the main skill's requirements reference. Offer concrete contrasts when helpful, but allow the human to describe another direction. Include an undecided choice for taste decisions. Do not ask the human for facts that the repository can answer.

Cover every dimension below across the conversation. Mark a dimension not applicable only with a reason. Ask at least three distinct visualization questions tailored to the feature; do not satisfy visual discovery with a single style question. Ask high-impact questions first and use each answer to shape the next round.

## Core dimensions

| Dimension | Ask about | Example targeted question |
|---|---|---|
| Purpose | Player need and observable success | What can the player understand or do afterward that they cannot do now? |
| Scope | Audience, trigger, output, explicit exclusions | Is this for the player or a designer? What initiates it, what changes, and what must it not do? |
| Encounter | Place, progression, frequency, duration, loop tier | Does this appear on the first approach, only during a fault, or throughout operation? Which loop does it close (moment, encounter, voyage, campaign), and which of act, outcome, or learn does it add? |
| Introduction | First meeting: forced, offered, or discovered; then safe, stakes, combined | Is the player forced into this, offered it, or do they find it? Where do they meet it with a cheap mistake? When do stakes attach? Which other mechanic does it first trade off against? If it needs a text box to explain, what is the player unable to read at the controls? |
| Surfacing | Discovery, attention, camera, hierarchy | What reveals it: the world silhouette, a sound, an instrument, or an explicit prompt? What should remain unnoticed? |
| Visual experience | Composition, scale, form, material, state readability | What must read at gameplay zoom, and what should only appear on inspection? |
| Interaction | Inputs, agency, sequence, interruption, recovery | What does the player do first, what confirms it, and can they cancel or recover? |
| World impact | State change, persistence, system consequences, taps and drains | What changes in the world, who or what reacts, and how does the player see that consequence? For any quantity touched, what fills it and what drains it? |
| Lore | Who in the world made or controls it, what it costs them, what tension it creates, its state at the current timeline | Which faction, port rule, or timeline event in the project's lore docs explains why this exists? What does a player learn about the world by using it? |
| Challenge | Player difficulty and implementation risk, separately | Is the interesting difficulty observation, judgment, timing, execution, or resource tradeoffs? "Unfair" means doubt resolved after commitment: which information must the player be able to read before deciding? |
| Feel | Rhythm, weight, responsiveness, emotional arc | Should this feel deliberate and heavy, quick and precise, uncertain, reassuring, or something else? What response would ruin that feeling? |
| Constraints | Non-negotiables and existing framework | Which established rules must remain intact? What is the cheapest experiment that could disprove the idea? |

Translate mood into observable behavior. For example, turn “heavy” into acceleration, anticipation, settling, sound, and interruption behavior rather than adding decorative bulk alone.

## Tailor the visual questions

Choose at least three relevant prompts, then follow the human's answers rather than exhausting this list.

### 3D models and spatial structures

- What is the recognisable silhouette at the actual gameplay distance? Give a number: apparent size as a percentage of screen height or in pixels at the real camera FOV, not "reads well at distance". What is the scale anchor: a person, a ship, or an adjacent structure?
- Where does the player approach, enter, dock, or manipulate it? Which side must reveal that function without a label?
- What construction logic, material contrast, wear, or exposed mechanism explains how it works?
- How does the form change between idle, active, damaged, and depleted states?
- Which details must survive distant viewing, and which are only rewards for close inspection?

### Animation and motion

- What are the key poses, and what must remain readable during the transition?
- What anticipation, contact, and settling phases communicate intention and weight?
- How do speed, camera framing, trails, and occlusion affect readability at gameplay scale?
- What does an interrupted, reversed, repeated, or failed action look like?

### Major lighting and atmosphere

- What must the eye find first? Which areas may fall into darkness without hiding required information?
- Which light sources exist in the world, and which changes communicate danger, safety, depth, or time?
- What should the same material look like in direct light, shadow, and transition?
- How do silhouettes and HUD contrast survive the brightest and darkest intended conditions?

### Gameplay and systemic features

- What does the player believe about this mechanic before the first use, and what corrects that belief: a consequence they can see, or a paragraph?
- What visible cue communicates an available action before the player acts?
- What changes on screen during commitment, success, failure, and recovery?
- What should remain visible simultaneously: target, tool, consequence, resource state, or world reaction?
- How does the camera communicate range, direction, and risk without masking the actual world state?

### HUD, panels, and overlays

- What is the first fact the player must see, and which facts can wait for inspection?
- Where does the panel sit relative to the target, cursor, and other instruments? What may it occlude?
- What do empty, normal, selected, warning, unavailable, and overflow states look like?
- Which information needs shape, labels, or motion in addition to colour? What happens at the target resolution and UI scale?

## Preserve decisions and open dimensions

Keep a compact ledger in the conversation or an existing project design record. Do not create project documentation unless requested or required by the established workflow.

| Dimension | Answer | Status | Next use |
|---|---|---|---|
| Encounter | First arrival at a damaged dock | Confirmed | Hold constant across variants |
| Motion | Undecided | Viable for variation | Compare snap, damped settle, and slow mechanical sequence |
| Control | Direct drag, suggested by assistant | Assumption | Confirm or test; do not treat as a constraint |
| Lighting capability | Native receiver support not checked | Technical unknown | Inspect implementation before promising it |
| Lore anchor | `docs/PORT-LORE.md` berth rules | Confirmed | Cite the section; mark `Invented` when no doc supports the world consequence |

Treat “undecided”, “not sure”, and “show me” as **Viable for variation**, not as missing answers that block progress. Do not silently choose a default or repeatedly ask the same question. Separate creative openness from unknown technical support. Resolve technical unknowns through inspection or a scoped experiment.

Use the lore dimension for thinking, not for a registry. Lore that exists only in a document is DEBUG-ONLY lore: variant evidence must show where the player reads it. Write back to existing lore docs only when authorized, following the glossary rule in the requirements reference. Do not create a worldbuilding directory or run a lore-index tool inside the idea loop.

Conclude discovery with a brief: purpose, encounter, introduction, surfacing, interaction, world consequence, lore anchor, challenge, feel, visual anchors, fixed constraints, open dimensions, and success criteria. Move to variants when the remaining uncertainty is suitable for exploration. Do not force decisions merely to finish the questionnaire.
