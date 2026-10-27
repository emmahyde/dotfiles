# Reference

Signatures verified against `com.unity.shadergraph@17.5.0` (Unity 6000.5.2f1, URP 17.5). Everything here is `internal`, so reach it by reflection on the `Unity.ShaderGraph.Editor` assembly.

## API signatures

| Member | Signature | Note |
|---|---|---|
| `GraphData.AddNode` | `void AddNode(AbstractMaterialNode node, bool usePreviewPref = true)` | Two params — matching on arity 1 fails |
| `GraphData.Connect` | `IEdge Connect(SlotReference from, SlotReference to)` | |
| `GraphData.isSubGraph` | `bool { get; set; }` | Set before adding nodes |
| `GraphData.outputNode` | `AbstractMaterialNode { get; set; }` | Subgraphs only |
| `SlotReference` ctor | `SlotReference(AbstractMaterialNode node, int slotId)` | Struct |
| `MaterialSlot.CreateMaterialSlot` | `(SlotValueType type, int slotId, string displayName, string shaderOutputName, SlotType slotType, Vector4 defaultValue, ShaderStageCapability = All, bool hidden = false)` | Factory — avoids per-type constructors |
| `SubGraphOutputNode.AddSlot` | `int AddSlot(ConcreteSlotValueType t)` | Returns the new slot id; ids start at 1 |
| `CustomFunctionNode.sourceType` | `HlslSourceType { File, String }` | Enum is under a `Drawing` namespace |
| `CustomFunctionNode.functionSource` | `string` | **GUID**, not a path |
| `CustomFunctionNode.functionName` | `string` | Base name, no `_float` / `_half` suffix |
| `FileUtilities.WriteShaderGraphToDisk` | `string WriteShaderGraphToDisk(string path, GraphData data)` | Returns the serialized text |

## HLSL contract

Custom Function Nodes in File mode require a `_float` and a `_half` variant of the same function. Outputs are trailing `out` parameters. Parameter order must match slot order: inputs by ascending slot id, then outputs.

```hlsl
#ifndef MY_LIB_INCLUDED
#define MY_LIB_INCLUDED

void MyFunc_float(float a, float b, out float result) { result = a + b; }
void MyFunc_half(half a, half b, out half result)     { result = a + b; }

#endif
```

Unity imports `.hlsl` as a `ShaderInclude` asset automatically. No `.meta` authoring needed.

## MultiJson format

A `.shadersubgraph` is a concatenation of independent JSON records, each with an `m_ObjectId`, cross-referenced by id rather than nested:

```json
{ "m_Type": "UnityEditor.ShaderGraph.GraphData",
  "m_Nodes": [ { "m_Id": "8f302b80..." } ],
  "m_OutputNode": { "m_Id": "8f302b80..." } }

{ "m_Type": "UnityEditor.ShaderGraph.Vector4MaterialSlot",
  "m_ObjectId": "6269a960...", "m_ShaderOutputName": "OutVector4" }
```

Flat and id-linked, so adding a node means appending records and wiring ids. Prefer building through `GraphData` anyway — Unity then owns id generation and the `m_SGVersion` stamps.

## Creating a full shader graph rather than a subgraph

`GraphUtil.CreateNewGraphWithOutputs(Target[], BlockFieldDescriptor[])` is public but interactive. The non-interactive core is `NewGraphAction.Action`, whose body is:

```csharp
var graph = new GraphData();
graph.AddContexts();
graph.InitializeOutputs(targets, blocks);
graph.AddCategory(CategoryData.DefaultCategory());
graph.path = "Shader Graphs";
FileUtilities.WriteShaderGraphToDisk(pathName, graph);
```

Replicate that. Do not invoke `Action` itself — see the dialog hazard below.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `isValid=False`, `functions=0` | HLSL did not bind | Check `functionName` matches, both `_float`/`_half` exist, slot count equals parameter count |
| Compile fails on `GetInstanceID` | `eval` treats warnings as errors | Use `GetEntityId()` |
| `ERROR: could not resolve ShaderGraph types` | Type outside the expected namespace | Fall back to scanning `assembly.GetTypes()` by `Name` |
| `AddNode not found` | Matched on arity 1 | It takes `(node, bool = true)`; fill defaults from `ParameterInfo.DefaultValue` |
| `No Unity Editor instances found` | Domain reload in progress | `unity status`, then retry |
| Editor stops responding entirely | A modal dialog opened | Only manual dismissal recovers it |
| `You may not pass in objects that are already persistent` | `SaveToSerializedFileAndForget` on an existing asset | That API is for non-persistent objects only |

## Dialog hazard

`CreateShaderSubGraph.Action` and `NewGraphAction.Action` both end with `ShaderGraphPreferences.GetOrPromptOpenNewGraphOnCreation()`. When the preference is unset this raises a modal dialog, which blocks the editor's command server with no programmatic recovery. Always replicate the body instead of calling these methods.

## Shipping generated shaders

Shader Graph output strips from player builds under the same rule as hand-written shaders: anything reached only through a runtime `Shader.Find()` string has no build-graph reference and is dropped. Register those in **Project Settings → Graphics → Always Included Shaders**. Editing `ProjectSettings/GraphicsSettings.asset` from a live editor is unreliable — `AssetDatabase.SaveAssets`, `File/Save Project`, and `SaveToSerializedFileAndForget` all decline to write it.
