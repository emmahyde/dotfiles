// Edit these seven values; everything below is generic.
var HLSL_PATH   = "Assets/_Project/Presentation/ShaderLib/SectorCelBands.hlsl";
var FUNCTION    = "SectorCelBand";
var OUT_PATH    = "Assets/_Project/Presentation/Nodes/SectorCelBand.shadersubgraph";
var GRAPH_PATH  = "Sector";
// "Name:Type" where Type is Vector1|Vector2|Vector3|Vector4; order defines HLSL parameter order.
string[] INPUTS = { "NdotL:Vector1", "HiThreshold:Vector1", "MidThreshold:Vector1",
                    "HiValue:Vector1", "MidValue:Vector1", "ShadowValue:Vector1",
                    "Softness:Vector1" };
var OUTPUT      = "Band:Vector1";

const System.Reflection.BindingFlags F =
    System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic |
    System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Static;

System.Reflection.Assembly sgAsm = null;
foreach (var a in System.AppDomain.CurrentDomain.GetAssemblies())
    if (a.GetName().Name == "Unity.ShaderGraph.Editor") { sgAsm = a; break; }
if (sgAsm == null) return "ERROR: Unity.ShaderGraph.Editor not loaded";

// Not every type sits under UnityEditor.ShaderGraph; HlslSourceType is under Drawing.
System.Func<string, System.Type> T = n => {
    string[] ns = { "UnityEditor.ShaderGraph.", "UnityEditor.Graphing.", "UnityEditor.ShaderGraph.Internal." };
    foreach (var p in ns) { var t = sgAsm.GetType(p + n); if (t != null) return t; }
    foreach (var t in sgAsm.GetTypes()) if (t.Name == n) return t;
    return null;
};

var tGraph = T("GraphData"); var tCFN = T("CustomFunctionNode");
var tOut = T("SubGraphOutputNode"); var tFile = T("FileUtilities");
var tSlot = T("MaterialSlot"); var tSlotRef = T("SlotReference");
var tConcrete = T("ConcreteSlotValueType"); var tSVT = T("SlotValueType");
var tSlotType = T("SlotType"); var tHlsl = T("HlslSourceType");
var tStage = T("ShaderStageCapability");
if (tGraph == null || tCFN == null || tOut == null || tFile == null || tSlot == null ||
    tSlotRef == null || tConcrete == null || tSVT == null || tSlotType == null || tHlsl == null)
    return "ERROR: could not resolve ShaderGraph types";

UnityEditor.AssetDatabase.ImportAsset(HLSL_PATH, UnityEditor.ImportAssetOptions.ForceSynchronousImport);
// functionSource takes the GUID string, never a path.
var guid = UnityEditor.AssetDatabase.AssetPathToGUID(HLSL_PATH);
if (string.IsNullOrEmpty(guid)) return "ERROR: no GUID for " + HLSL_PATH;

var graph = System.Activator.CreateInstance(tGraph);
tGraph.GetProperty("isSubGraph", F).SetValue(graph, true);

var cfn = System.Activator.CreateInstance(tCFN);
tCFN.GetProperty("sourceType", F).SetValue(cfn, System.Enum.Parse(tHlsl, "File"));
tCFN.GetProperty("functionName", F).SetValue(cfn, FUNCTION);
tCFN.GetProperty("functionSource", F).SetValue(cfn, guid);

var createSlot = tSlot.GetMethod("CreateMaterialSlot", F);
System.Reflection.MethodInfo cfnAdd = null;
foreach (var m in tCFN.GetMethods(F)) {
    var ps = m.GetParameters();
    if (m.Name == "AddSlot" && ps.Length >= 1 && ps[0].ParameterType == tSlot) { cfnAdd = m; break; }
}
if (cfnAdd == null) return "ERROR: CustomFunctionNode.AddSlot(MaterialSlot) not found";

System.Action<int, string, bool> addSlot = (id, spec, isOut) => {
    var parts = spec.Split(':');
    var slot = createSlot.Invoke(null, new object[] {
        System.Enum.Parse(tSVT, parts[1]), id, parts[0], parts[0],
        System.Enum.Parse(tSlotType, isOut ? "Output" : "Input"),
        UnityEngine.Vector4.zero, System.Enum.Parse(tStage, "All"), false });
    var ps = cfnAdd.GetParameters();
    var args = new object[ps.Length];
    args[0] = slot;
    for (int i = 1; i < ps.Length; i++) args[i] = ps[i].DefaultValue;
    cfnAdd.Invoke(cfn, args);
};

for (int i = 0; i < INPUTS.Length; i++) addSlot(i + 1, INPUTS[i], false);
int outId = INPUTS.Length + 1;
addSlot(outId, OUTPUT, true);

System.Reflection.MethodInfo addNode = null;
foreach (var m in tGraph.GetMethods(F)) {
    var ps = m.GetParameters();
    if (m.Name == "AddNode" && ps.Length >= 1 && ps[0].ParameterType.IsInstanceOfType(cfn)) { addNode = m; break; }
}
System.Action<object> addN = n => {
    var ps = addNode.GetParameters();
    var args = new object[ps.Length];
    args[0] = n;
    for (int i = 1; i < ps.Length; i++) args[i] = ps[i].DefaultValue;
    addNode.Invoke(graph, args);
};
addN(cfn);

var outNode = System.Activator.CreateInstance(tOut);
addN(outNode);
tGraph.GetProperty("outputNode", F).SetValue(graph, outNode);
var outAdd = tOut.GetMethod("AddSlot", F, null, new System.Type[] { tConcrete }, null);
var sinkId = (int)outAdd.Invoke(outNode, new object[] {
    System.Enum.Parse(tConcrete, OUTPUT.Split(':')[1]) });

var edge = tGraph.GetMethod("Connect", F).Invoke(graph, new object[] {
    System.Activator.CreateInstance(tSlotRef, new object[] { cfn, outId }),
    System.Activator.CreateInstance(tSlotRef, new object[] { outNode, sinkId }) });

tGraph.GetProperty("path", F).SetValue(graph, GRAPH_PATH);

var dir = System.IO.Path.GetDirectoryName(OUT_PATH);
if (!System.IO.Directory.Exists(dir)) System.IO.Directory.CreateDirectory(dir);
tFile.GetMethod("WriteShaderGraphToDisk", F).Invoke(null, new object[] { OUT_PATH, graph });
UnityEditor.AssetDatabase.Refresh();
UnityEditor.AssetDatabase.ImportAsset(OUT_PATH, UnityEditor.ImportAssetOptions.ForceSynchronousImport);

var main = UnityEditor.AssetDatabase.LoadMainAssetAtPath(OUT_PATH);
return "guid=" + guid + " edge=" + (edge != null) + " sinkId=" + sinkId
     + " imported=" + (main == null ? "<null>" : main.GetType().Name)
     + " bytes=" + (System.IO.File.Exists(OUT_PATH) ? new System.IO.FileInfo(OUT_PATH).Length : -1);
