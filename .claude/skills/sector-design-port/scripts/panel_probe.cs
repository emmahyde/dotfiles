// panel_probe.cs — paste into unityMCP execute_code (action: "execute") to verify
// a ported panel in play mode. Replace __PANEL__ / __NS__ before running.
//
// Rules learned the hard way (2026-08-30 session):
// - Enter PLAY MODE first. A plain MonoBehaviour's Update never ticks in edit mode,
//   and after a domain reload in edit mode its non-serialized fields are null.
// - The FIRST execute after entering play times out on the domain reload — retry,
//   it is not a failure.
// - execute_code auto-imports UnityEngine/UnityEditor ONLY: root.Q<T>() is an
//   extension method in UnityEngine.UIElements and will not compile. Use
//   UQueryExtensions.Query<T>(root) or reflection, as below.
// - resolvedStyle is 0 on the spawn frame; run the probe twice for measurements.

var panelType = System.Type.GetType("__NS__.__PANEL__, Assembly-CSharp");
if (panelType == null) return "panel type not found — check namespace/assembly";
var go = new UnityEngine.GameObject("Probe [UI Toolkit]");
var doc = go.AddComponent<UnityEngine.UIElements.UIDocument>();
doc.panelSettings = UnityEngine.Resources.Load<UnityEngine.UIElements.PanelSettings>("SectorHudPanel");
doc.sortingOrder = 15f;
var root = doc.rootVisualElement;
var panel = (UnityEngine.UIElements.VisualElement)System.Activator.CreateInstance(panelType);
root.Add(panel);
var sb = new System.Text.StringBuilder();
sb.Append("spawned ").Append(panelType.Name);
sb.Append(" | children=").Append(panel.childCount);
sb.Append(" | resolved w=").Append(panel.resolvedStyle.width).Append(" h=").Append(panel.resolvedStyle.height);
return sb.ToString();
