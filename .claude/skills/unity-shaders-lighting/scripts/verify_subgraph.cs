var PATH = "Assets/_Project/Presentation/Nodes/SectorCelBand.shadersubgraph";

UnityEditor.AssetDatabase.ImportAsset(PATH, UnityEditor.ImportAssetOptions.ForceSynchronousImport);
var asset = UnityEditor.AssetDatabase.LoadMainAssetAtPath(PATH);
if (asset == null) return "ERROR: did not load " + PATH;

var t = asset.GetType();
const System.Reflection.BindingFlags F =
    System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic |
    System.Reflection.BindingFlags.Instance;

var sb = new System.Text.StringBuilder();
sb.Append("type=").Append(t.Name);

// isValid=True plus a non-empty function list is the only proof the HLSL actually bound.
foreach (var name in new string[] { "isValid", "functionName", "inputStructName", "hlslName" }) {
    var p = t.GetProperty(name, F);
    var f = t.GetField(name, F);
    object v = p != null ? p.GetValue(asset) : (f != null ? f.GetValue(asset) : null);
    sb.Append(' ').Append(name).Append('=').Append(v == null ? "<n/a>" : v.ToString());
}

var fnField = t.GetField("functions", F);
if (fnField != null) {
    var list = fnField.GetValue(asset) as System.Collections.IList;
    sb.Append(" functions=").Append(list == null ? -1 : list.Count);
}

sb.Append(" guid=").Append(UnityEditor.AssetDatabase.AssetPathToGUID(PATH));
return sb.ToString();
