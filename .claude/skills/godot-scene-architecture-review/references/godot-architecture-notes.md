# Godot Architecture Notes

Use this reference when reviewing Godot scene composition and ownership. The goal is not to force one architectural style, but to judge whether responsibilities, communication paths, and reuse boundaries are clear enough to keep the system understandable and changeable.

## 1. Scene ownership criteria

A scene has healthy ownership when:

- its main purpose can be described in one or two sentences
- the root node coordinates the scene's role without absorbing unrelated domain logic
- child scenes or nodes own their own local behavior and presentation details
- scene-local state is not pushed into globals without a persistence or cross-scene reason
- the path to "where should this change go?" is reasonably obvious to another developer

Warning signs:

- the root script is part coordinator, part state container, part gameplay service, and part UI adapter
- child nodes frequently reach into siblings or distant parents to do their work
- responsibilities are distributed according to convenience rather than ownership
- one scene exists mainly because no one knows where else a responsibility belongs

### Quick ownership questions

Ask:

- Which node or script is the natural owner of this responsibility?
- Is that ownership local, cross-scene, or truly global?
- If this behavior changes, is the edit location obvious?
- Does the current owner have enough context to own it cleanly?

## 2. Signal vs direct reference decision rules

Neither signals nor direct references are automatically superior. Choose based on ownership and coupling.

### Prefer direct reference when

- one node clearly owns or composes another
- the dependency is stable and explicit
- the caller legitimately needs a small, known API from the callee
- the relationship is local and easy to reason about from the scene tree

Examples:

- a parent view configuring a child widget it owns
- a scene root holding a clear reference to a local controller it composes

### Prefer signals when

- the sender should not need to know who reacts
- multiple listeners may care about the event
- the event crosses a coordination seam and you want looser coupling
- lifecycle order makes direct calls awkward but event semantics are natural

Examples:

- a button or child panel notifying intent upward
- a gameplay event being observed by UI, audio, and analytics layers

### Signal health warnings

Watch for:

- signals used everywhere to avoid naming real ownership
- event chains that make it hard to understand who changes state
- hidden lifecycle issues from connections that outlive their intended scope
- bidirectional signal spaghetti between UI and gameplay nodes

### Direct-reference warnings

Watch for:

- long node-path lookups into distant relatives
- sibling nodes mutating each other directly through implicit tree knowledge
- a child script that can only function because it knows too much about its parent hierarchy

## 3. Autoload: appropriate use vs abuse

Autoloads are appropriate when the responsibility is genuinely cross-scene, persistent, or application-wide.

Good fits include:

- save/profile/session management
- global configuration
- long-lived service adapters
- routing or app-level state that survives scene changes

Autoload abuse usually looks like:

- scene-local gameplay state promoted to a singleton for convenience
- UI scripts reading and mutating globals directly because local seams are weak
- an ever-growing global manager that becomes the answer to every coordination problem
- hiding poor ownership by moving logic upward until it is globally reachable

### Questions to ask before approving an autoload

- Does this responsibility need to survive scene transitions?
- Is the state truly shared across many systems, or just hard to pass cleanly?
- Would a scene root, coordinator, or injected dependency own this more honestly?
- Does the autoload create invisible coupling that raises future change cost?

## 4. UI and gameplay separation principles

The goal is not total isolation. The goal is a healthy seam.

Healthy separation often means:

- gameplay state and rules live outside purely presentational widgets
- UI observes state, renders it, and emits user intent
- a coordinator or gameplay-facing seam decides how intent changes the game
- the UI can be rearranged without rewriting the core gameplay rules

Warning signs:

- UI nodes directly mutating gameplay data structures across several unrelated systems
- gameplay code depending on UI node presence or concrete widget layout
- UI scripts becoming the de facto feature owner because they know too much about state transitions
- gameplay and presentation logic being inseparable inside the same script without a strong reason

Do not confuse UI/gameplay separation with eliminating all contact. The question is whether the contact is explicit, bounded, and easy to verify.

## 5. Reusable scene boundary principles

A reusable scene boundary is justified when it creates repeated composition value, clearer ownership, or easier testing — not just because the hierarchy looks large.

A boundary is usually healthy when:

- the child scene has one clear purpose
- it can be reasoned about with limited parent knowledge
- its contract with the parent is explicit enough to configure and observe
- similar behavior or composition would otherwise be duplicated

A boundary is probably premature when:

- the child scene exists only to hide a tiny amount of code with no reuse or clarity gain
- the extracted scene still depends on deep knowledge of the parent tree
- configuration becomes more complex than the behavior it extracted
- debugging and ownership become less obvious after the split

## 6. Reviewing over-centralization without overreacting

Godot scenes often need a coordinator. That is normal.

It becomes a problem when the coordinator:

- owns unrelated state domains
- mediates nearly every interaction in the scene
- becomes the only place where safe changes can be made
- grows because no other boundary is trusted

Do not recommend splitting a coordinator just because it is important. Recommend it when the importance has turned into ownership overload.

## 7. Testability and change-cost reminders

Architecture review should always connect back to verification.

Look for these questions:

- Can core responsibilities be reasoned about without booting the entire scene tree?
- Will a small scene change force edits in several distant scripts?
- Does adding a new UI element require touching gameplay state owners directly?
- Would a refactor reduce or increase the number of seams that need runtime verification?

Good architectural direction usually lowers at least one of these costs:

- understanding cost
- edit surface size
- regression risk during scene rewiring
- need for broad manual retesting
