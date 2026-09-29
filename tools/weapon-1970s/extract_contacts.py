"""Record the side-profile envelopes of the reference guns' hand-contact parts.
Blender -b --python tools/weapon-1970s/extract_contacts.py
Writes tools/weapon-1970s/reference-contacts.json (game/glTF coords: x right, y up, z muzzle).
"""
import bpy, json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
WANT = {
    "pistol": ["Grip frame", "Bakelite grip panels", "Trigger", "Trigger guard", "Rear backstrap", "Receiver"],
    "rifle": ["Walnut pistol grip", "Walnut handguard", "Trigger", "Trigger guard", "Walnut buttstock", "Receiver"],
    "shotgun": ["Stock wrist", "Walnut buttstock", "Pump", "Trigger", "Trigger guard", "Receiver"],
    "smg": ["Pistol grip", "Trigger", "Trigger guard", "Receiver"],
}
def hull(points):
    pts = sorted(set(points))
    if len(pts) < 3: return pts
    def cross(o, a, b): return (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0])
    lo, up = [], []
    for p in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0: lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(up) >= 2 and cross(up[-2], up[-1], p) <= 0: up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]
out = {}
for gun, names in WANT.items():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / f"public/models/{gun}.glb"))
    out[gun] = {}
    for o in bpy.data.objects:
        if o.type != "MESH" or o.name not in names: continue
        vs = [o.matrix_world @ v.co for v in o.data.vertices]
        g = [(v.x, v.z, -v.y) for v in vs]  # blender -> glTF
        zy = [(round(p[2], 4), round(p[1], 4)) for p in g]
        out[gun][o.name] = {
            "x": [min(p[0] for p in g), max(p[0] for p in g)],
            "hull_zy": hull(zy),
        }
Path(__file__).with_name("reference-contacts.json").write_text(json.dumps(out, indent=1))
print("wrote contacts", {k: list(v) for k, v in out.items()})
