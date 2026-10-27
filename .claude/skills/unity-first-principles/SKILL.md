---
name: unity-first-principles
description: |
  Explain Unity from first principles to a working software engineer who knows
  code but not game engines. Builds each idea before it names it, and translates
  through web and backend concepts first. Grounded in the "Unity 6: Beginner to
  Expert for Software Engineers" NotebookLM notebook. Use when the user asks what
  something is or why it behaves the way it does: "why does my component have no
  constructor", "why can I not use new on a MonoBehaviour", "Awake vs Start",
  "Update vs FixedUpdate vs LateUpdate", "what is Time.deltaTime", "why is script
  execution order random", "why did my code default not change anything", "why
  does the Inspector override my code", "what is SerializeField", "what is a
  prefab", "what is a prefab override", "what is a ScriptableObject", "why is my
  destroyed object not null", "why does ?. break in Unity", "what is fake null",
  "MissingReferenceException", "what is a draw call", "what is batching", "why is
  my frame rate bad with low poly count", "what is GC alloc", "why does my game
  stutter", "what is the frame budget", "what is a .meta file", "why did my
  references break", "what is a GUID", "what is domain reload", "why did my static
  not reset", "why can I not touch Transform from a thread", "what is the main
  thread", "eli5 unity", "first principles", "explain like I am five", "teach me
  unity", "I do not know Unity", "I come from web development".
---

# Unity From First Principles

## What this skill is for

Explain Unity to an engineer who writes good code and has never shipped a game. Build each idea from nothing. Name it only after the reader can already picture it.

Translate through web and backend concepts first, then say where the analogy breaks. An analogy that is never broken teaches a wrong model.

For game design questions — loops, economies, whether a decision is real — use the `game-first-principles` skill. For cameras, projection, meshes, and world space, use the `3d-first-principles` skill. This skill covers the engine only.

This is a teaching skill, not a production skill.

## How to explain (the contract)

Follow these rules. They are the skill. **Run E-GAP first — it decides whether the rest apply.**

- **E-GAP.** Diagnose the gap before picking a format. Ask what the reader already owns.
  - **Concept gap** — the reader has no analogous structure. Ramp. Use every rule below.
  - **Vocabulary gap** — the reader owns the abstraction and needs the noun mapped onto it. Do NOT ramp. Deliver three things: one mapping sentence, the full enumerated surface, a diagram. Then stop.

  The tell is decisive: **if the reader can name the analogous structure in their own domain, the build is already done.** "The texture gets passed into the shader as a param" is a finished model. Answering it with a constructed explanation reads as condescension and buries the data.

  Ramp length scales with the reader's model gap, never with the topic's depth.

- **E-ENUM.** On a vocabulary gap, the enumeration is the payload. "What else can be passed in" asks for the parameter list — all of it, with types and what each does. Prose about relationships is not a substitute for data you can read off the file. Open the file and list it.
- **E-BUILD.** *Concept gap only.* Build the idea, then name it. Never open with the jargon word. Wrong: "MonoBehaviours are managed wrappers over native objects." Right: "You called Destroy, then checked the variable, and it was not null. The C# object is still there. The thing it pointed at is gone. That gap has a name: *fake null*."
- **E-WEBFIRST.** Open with the closest web or backend idea, then break it. "A prefab is a class and an instance — until you learn that the instance stores a diff against the class, and the diff wins." On a vocabulary gap this rule *replaces* E-BUILD rather than preceding it: give the mapping and the break, and skip the construction.
- **E-JOB.** For a "why is it like this" question, answer in three steps. State the thing's job. Show the mechanism that job forces. Show why the obvious alternative fails at that job.
- **E-BREAKS.** Say what goes wrong when the reader gets it wrong. An idea with no failure mode is trivia.
- **E-NUMBERS.** Give the number, not the adjective. Not "GC is slow". Instead: "the budget is 16.67 ms and one collection pause costs 5 to 10 ms."
- **E-DRAW.** Draw it when the shape is the point. Two bodies joined by a pointer, a frame split into a budget, a reference resolved through a GUID — all shapes. Use the `ascii-design` skill.

Register: short active sentences, one idea each, present tense. See the `simple-english` skill for the full rule set.

## The sentence everything hangs off

> Your C# does not run the game. A C++ engine runs the game and calls your C# — on its thread, in its order, inside its 16.67 ms, using values from disk that outrank your source code.

Every principle below is one clause of that sentence. An engineer who holds the sentence can derive most of Unity without help.

| What the engine owns | Principle |
| --- | --- |
| the clock and the thread | U-GUEST |
| the values in your fields | U-DATA |
| the object's real body | U-TWOBODIES |
| the time you get per frame | U-BUDGET |
| what drawing actually costs | U-STATECHANGE |
| the process your code lives in | U-EDITOR |

## The six principles

### U-GUEST — your code is a callback, not a program

A web service has an entry point. You construct objects, wire them, and hand control to a framework you chose.

Unity inverts this. A C++ engine already runs. It owns the loop. Your class is a component it attaches to an object, and it calls named methods on a schedule you do not set.

That job forces the strangest rule a new engineer meets: **a MonoBehaviour has no usable constructor.** The engine creates the native object first, then binds a C# wrapper to it, then applies the serialized data. A C# constructor runs before any of that finishes. `GetComponent()` inside a constructor throws, because there is no GameObject yet to search.

So the constructor is replaced by a lifecycle:

| Method | When | Use it for |
| --- | --- | --- |
| `Awake` | on creation, even while disabled | this object's own state |
| `OnEnable` | every time it activates | subscribing to events |
| `Start` | once, before the first frame | reaching for *other* objects |
| `FixedUpdate` | fixed physics step, 0.02 s | forces and Rigidbody work |
| `Update` | every frame, variable | input and visuals |
| `LateUpdate` | every frame, after all Updates | cameras that follow |

`Awake` and `Start` are not style choices. `Awake` sets up self, `Start` reaches for others, and the split exists because **script execution order across different components is not guaranteed**. If component A grabs a reference in `Awake` that component B fills in its own `Awake`, the result depends on an order Unity never promised. Fix an order explicitly with `[DefaultExecutionOrder]`.

The engine owns the thread as well as the clock. Every `UnityEngine` API is main-thread only. A background thread that reads `transform.position` throws. The C# Job System exists to work around this, and it does so by refusing engine objects entirely — jobs touch unmanaged data such as `NativeArray` and nothing else.

Breaks when: an engineer writes `new MyComponent()`. C# allocates the object. It has no native body, no Transform, no GameObject, and it never receives a single lifecycle call. It is a corpse that compiles. Use `AddComponent<T>()` or `Instantiate()`.

Breaks when: movement is written as `position += speed` with no `Time.deltaTime`. The object then travels at the frame rate. A fast machine moves it twice as far as a slow one, and the bug is invisible on the machine that wrote it.

Breaks when: physics is driven from `Update`. Forces applied off the fixed step fight the interpolator, and objects jitter or tunnel through walls.

### U-DATA — the serialized file outranks your source code

Change a default in a backend service, redeploy, and the new default is live everywhere. This intuition is wrong in Unity, and it costs new engineers a day.

The job: designers and artists must tune values without editing code. To serve that, Unity writes every `public` and `[SerializeField]` field into the scene or prefab file as YAML. When the scene loads, the engine **deserializes that YAML over the memory your C# just initialized**.

So the file wins. Change `_moveSpeed` from 5 to 10 in your source, press Play, and the object still moves at 5 — because 5 is written in the scene file and it is applied second.

This is a dependency injection container whose config is a binary-ish file edited by hand through a GUI, and it always overrides constructor defaults. Once framed that way it stops being surprising.

Two hard consequences follow:

- **Renaming a serialized field silently wipes it.** The YAML keys on the field name. Rename `_speed` to `_moveSpeed` and Unity finds no `_moveSpeed` in the file, so it uses the code default and every configured value in every scene and prefab resets to nothing. `[FormerlySerializedAs("_speed")]` is the fix, and it stays on the field forever.
- **Prefabs store a diff, not a copy.** A prefab is the Prototype pattern. The instance in the scene points back to the asset and stores only its *overrides*. Edit the asset and every instance updates, except where an override wins. Edit an instance and you have created a new override, quietly.

Breaks when: an engineer edits a code default and reports that the change "did nothing". Nothing is broken. The file outranked them.

Breaks when: an engineer writes `renderer.material.color = red`. The `.material` accessor **clones the material** and returns the clone, which breaks batching. Worse, mutating a shared asset — a ScriptableObject, a material — at runtime in the editor edits the asset on disk, for every object that references it, permanently. Read with `sharedMaterial`. Write per-instance values with a `MaterialPropertyBlock`.

### U-TWOBODIES — every object has a C# body and a C++ body, and null is a lie

A `UnityEngine.Object` is two things joined by a pointer: a light C# wrapper, and a heavy native C++ object that holds the real transform, mesh, and physics state.

```
   your variable ──▶ C# wrapper ──▶ native C++ object
                     (managed heap)  (engine memory)

   after Destroy():
   your variable ──▶ C# wrapper ──▶  ✗  freed
                     still alive!
```

`Destroy(obj)` frees the native object immediately. The C# wrapper survives until the garbage collector gets to it. Touching the wrapper now reaches into freed memory and crashes the process.

The job: stop that crash without forcing engineers to track two lifetimes. Unity's answer is to **overload `==` and `!=`** so that a wrapper with a dead native body compares equal to null. That is why `if (obj != null)` is correct and reads as ordinary C#.

The trap is that `?.`, `??`, and `??=` are resolved by the compiler against the real C# reference. They never call the overload. So `obj?.SetActive(true)` sees a live wrapper, proceeds, and throws `MissingReferenceException`. The longer `if (obj != null)` skips it safely.

This inverts a rule the engineer already learned. In every other C# codebase `?.` is the safer, more modern form. Here it is the dangerous one.

Breaks when: a null-conditional operator is used on any Unity object. The failure appears only after something is destroyed, so it survives every test that does not destroy anything.

### U-BUDGET — a pause costs more than a total

Backend performance is throughput: requests per second, averaged. Game performance is a deadline that recurs 60 times a second.

At 60 fps the whole frame — input, game logic, physics, animation, culling, and rendering — fits in **16.67 ms**. Miss it once and the player sees a hitch.

That changes what "a memory problem" means. Total footprint does not cause stutter. **Stop-the-world garbage collection pauses cause stutter.** A collection pause of 5 to 10 ms eats most of the frame on its own, and the frame is dropped.

So the rule in this repo, and in every shipping Unity project, is stricter than it looks: **zero heap allocations in `Update`, `FixedUpdate`, and `LateUpdate`.** Not "few". Zero. The cost is not the allocation, it is the collection that the allocation eventually forces, landing on an unrelated frame.

That is why LINQ is banned from per-frame code while being fine in a menu. `.Where()` allocates an enumerator and a delegate. Called once when a panel opens, the cost is unmeasurable. Called 60 times a second on 200 objects, it schedules a stutter.

The escapes are ordinary once the deadline is understood: pool objects instead of instantiating them, cache `GetComponent` and `Camera.main` in `Awake`, reuse a cleared `List<T>` instead of allocating a new one, use the non-allocating physics calls such as `RaycastNonAlloc`.

Breaks when: an engineer optimizes average frame time and ships a build that measures well and feels bad. The average was never the product. The worst frame is.

### U-STATECHANGE — the CPU pays to switch, not to draw

The intuitive model is that more triangles cost more. It is close to wrong.

A modern GPU eats millions of triangles in parallel without complaint. The expensive part is on the CPU: before the GPU can draw anything, the CPU must set up the state — bind the shader, the textures, the vertex buffers — and issue a **draw call**.

So the cost scales with **the number of unique material-and-mesh pairs**, not with geometry. One mesh drawn 1000 times with one shared material is cheap. A thousand different materials is not.

The numbers make it concrete. A grass field of 62,500 individual GameObjects with separate materials renders at **29 fps** on a MacBook Air. The same geometry through GPU instancing or `Graphics.RenderMeshPrimitives` runs smoothly, because the triangle count was never the problem.

Batching systems exist to collapse these state changes — the SRP Batcher, GPU instancing, static and dynamic batching, sprite atlases. Each has a limit that silently breaks the batch when exceeded. UI Toolkit's shader batches up to **eight textures** per draw call; the ninth splits the batch.

Breaks when: an engineer profiles a slow scene, sees a low polygon count, and concludes rendering is not the bottleneck. Open the rendering stats and read the draw call and SetPass counts instead.

### U-EDITOR — the editor is a long-lived process, not a fresh run

`dotnet run` starts a clean process every time. Pressing Play does not. The Unity Editor is one long-lived program, and Play Mode is a mode inside it.

By default Unity hides this with a **domain reload**: it tears down and rebuilds the C# scripting domain on entering Play, so statics reset and the run looks fresh. The reload costs seconds, so engineers turn it off to iterate faster — and in doing so they opt into the truth.

With domain reload disabled, **static fields keep their values across Play sessions.** A static event that a destroyed MonoBehaviour subscribed to still holds a strong reference to it. Statics are GC roots, so that dead object is never collected, it keeps receiving events on the next Play, and the leak grows every session. Every `+=` in `OnEnable` needs its `-=` in `OnDisable`, and that pairing is not hygiene here — it is the difference between a working editor and one that must be restarted hourly.

The same long life explains asset identity. Unity must keep a material's link to its texture intact when files move, so it does not reference by path. On import it assigns a **GUID** and writes it into a companion **`.meta` file** next to the asset. Every scene, prefab, and material stores the GUID.

Move or rename an asset in Finder instead of in Unity and the `.meta` is left behind. Unity sees an unknown file, mints a **new GUID**, and every reference to the old one breaks — while the asset sits right there, visibly present. Never edit a `.meta` by hand. Always commit it with its asset.

Breaks when: a `.meta` file is missing from a commit. The next person to clone gets a project where every reference to that asset is empty, and nothing in the error message names the real cause.

## Translating from web and backend

Open with the left column. Always deliver the right column too.

| Web or backend idea | Unity counterpart | Where the analogy breaks |
| --- | --- | --- |
| DI container wiring constructors | the Inspector, deserialized over your fields | the config file wins over code, always |
| Class and instance | prefab asset and prefab instance | the instance stores a *diff*, and the diff wins |
| Config file | ScriptableObject | it is a live asset — mutating it at runtime edits it on disk |
| Request handler | `Update()` | it is called 60 times a second forever, not once per request |
| `null` | Unity fake null | `?.` and `??` bypass it and reach freed memory |
| p99 latency | the 16.67 ms frame deadline | there is no averaging; one slow frame is visible |
| Connection pool | object pool | the motive is avoiding GC pauses, not handshake cost |
| Content-addressed blob | asset GUID in a `.meta` file | the address lives in a sidecar file that is easy to lose |
| Process restart clears state | domain reload | it is optional, and turning it off keeps statics alive |
| Worker threads | the C# Job System | workers cannot touch a single engine object |
| Storybook component workbench | isolated authoring scene and Inspector | you adjust serialized props and trigger procedural rebuilds directly, bypassing runtime game loops |

## Where the answers come from

The user maintains a NotebookLM notebook, **"Unity 6: Beginner to Expert for Software Engineers"** (id `27b828a7-84c5-4b3c-839f-d680406d1ea8`).

Query it with `notebook_query` before or alongside a web search for any Unity best-practice or "what is the right way to do X in Unity 6" question. Its prose guidance is reliable and pitched at exactly this reader.

One caution, learned the hard way: **code blocks it returns have come back with corrupted array indices.** Treat any code from the notebook as pseudocode to rewrite, never as text to paste.

## Diagnosing a confused engineer

Match the complaint to the principle. Teach that principle, not the symptom.

| The engineer says | Teach |
| --- | --- |
| "Why does my component have no constructor?" | U-GUEST |
| "I called `new` and nothing happens" | U-GUEST — a corpse that compiles |
| "It runs at a different speed on my laptop" | U-GUEST — missing `Time.deltaTime` |
| "I get a random NullReference on some launches" | U-GUEST — unguaranteed execution order |
| "I changed the default and nothing changed" | U-DATA — the file outranks the source |
| "All my tuned values reset to zero" | U-DATA — a rename with no `[FormerlySerializedAs]` |
| "Editing one object changed all of them" | U-DATA — a shared asset mutated at runtime |
| "I checked for null and it still threw" | U-TWOBODIES — `?.` bypasses the overload |
| "It only crashes after something dies" | U-TWOBODIES |
| "The average frame time is fine but it feels bad" | U-BUDGET — the worst frame is the product |
| "Why is LINQ banned here but fine elsewhere?" | U-BUDGET — per-frame versus per-event |
| "Low poly count, still slow" | U-STATECHANGE — count draw calls, not triangles |
| "It was fast until I gave each one its own material" | U-STATECHANGE |
| "My static did not reset" | U-EDITOR — domain reload is off |
| "The editor gets slower until I restart it" | U-EDITOR — a static event holding dead objects |
| "All my references broke and the file is right there" | U-EDITOR — a lost `.meta`, a new GUID |

## Two cautions on teaching this

**Do not lead with DOTS, ECS, or Jobs.** They are the answer to a scaling problem the reader does not have yet. Teach the frame budget first. A reader who understands why 16.67 ms is a deadline can then hear what Jobs are for. A reader who does not will treat ECS as a style preference.

**Do not defend a Unity quirk as good design.** Several are historical. The reader is an engineer and will spot a rationalization instantly, which costs the credibility of everything true you said. Say what the job is, say what it costs, and let the design stand or fall on that.
