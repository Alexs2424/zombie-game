"""Render HUD art for every weapon from its shipped GLB in Blender.

  /Applications/Blender.app/Contents/MacOS/Blender -b --python tools/weapon-1970s/render_ui.py -- [ids...]

Outputs transparent PNGs in outputs/weapon-ui/ (ignored), converted to WebP in
public/ui/weapons/ by tools/weapon-1970s/pack_ui.py:
  <id>-side.png  orthographic profile, muzzle right (HUD weapon panel and slot strip)
  <id>-card.png  three-quarter hero render (pickup card / Mystery Box reveal)
Lighting: warm tungsten key, cool fill, gold rim, like a lit display case.
"""
import bpy, sys, math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "outputs/weapon-ui"
OUT.mkdir(parents=True, exist_ok=True)
IDS = ["pistol", "shotgun", "smg", "rifle", "revolver", "magnum", "tommy", "doublebarrel", "dual", "machinepistol", "lever",
       "autoshotgun", "sniper", "lmg", "launcher", "stick", "axe"]


def setup():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    names = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
    s.render.engine = "BLENDER_EEVEE" if "BLENDER_EEVEE" in names else "BLENDER_EEVEE_NEXT"
    s.render.film_transparent = True
    s.render.image_settings.file_format = "PNG"
    s.render.image_settings.color_mode = "RGBA"
    vt = [i.identifier for i in s.view_settings.bl_rna.properties["view_transform"].enum_items]
    s.view_settings.view_transform = "AgX" if "AgX" in vt else "Filmic"
    try:
        s.view_settings.look = "AgX - Punchy"
    except TypeError:
        pass
    s.view_settings.exposure = -0.7
    try:
        s.eevee.taa_render_samples = 96
    except AttributeError:
        pass
    w = bpy.data.worlds.new("Display case")
    s.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.09, 0.075, 0.06, 1)
    bg.inputs[1].default_value = 0.8
    return s


def bounds(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs if o.type == "MESH" for c in o.bound_box]
    lo = Vector([min(p[i] for p in pts) for i in range(3)])
    hi = Vector([max(p[i] for p in pts) for i in range(3)])
    return lo, hi


def light(name, loc, energy, size, color, target):
    d = bpy.data.lights.new(name, "AREA")
    d.energy, d.size, d.color = energy, size, color
    o = bpy.data.objects.new(name, d)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (target - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return o


EXPOSURE = {"dual": -1.45, "magnum": -1.0, "pistol": -1.0}  # bright nickel/pearl pieces


def render(wid):
    s = setup()
    s.view_settings.exposure = EXPOSURE.get(wid, s.view_settings.exposure)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / f"public/models/{wid}.glb"))
    # Loose reload props are hidden at rest in the game; keep them out of the HUD art too.
    doomed = set()
    for o in s.objects:
        if o.name.split(".")[0] in ("Loading shell", "Loading round", "Stripper clip"):
            doomed.add(o)
            doomed.update(o.children_recursive)
    for o in doomed:
        bpy.data.objects.remove(o, do_unlink=True)
    objs = [o for o in s.objects if o.type == "MESH"]
    lo, hi = bounds(objs)
    c, size = (lo + hi) / 2, (hi - lo).length
    for n, loc, e, sz, col in (("Key", (-0.5, -0.6, 1.3), 70, 2.2, (1, 0.88, 0.72)), ("Fill", (-1.2, 0.5, 0.2), 22, 2.0, (0.72, 0.8, 1)),
                               ("Rim", (0.4, 1.2, 0.7), 70, 0.8, (1, 0.78, 0.4)), ("Under", (-0.3, -0.4, -1.0), 10, 1.8, (1, 0.8, 0.6))):
        light(n, c + Vector(loc) * size, e * size * size * 3.2, sz * size, col, c)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    s.collection.objects.link(cam)
    s.camera = cam
    # Side profile from the shooter's right (Blender -X; muzzle to the right of frame).
    s.render.resolution_x, s.render.resolution_y = 720, 270
    cam.data.type = "ORTHO"
    span_len, span_h = hi.y - lo.y, hi.z - lo.z
    cam.data.ortho_scale = max(span_len, span_h * 720 / 270) * 1.06
    cam.location = c + Vector((-size * 2, 0, 0))
    cam.rotation_euler = (math.pi / 2, 0, -math.pi / 2)
    cam.data.clip_end = size * 10
    s.render.filepath = str(OUT / f"{wid}-side.png")
    bpy.ops.render.render(write_still=True)
    # Three-quarter hero card.
    s.render.resolution_x, s.render.resolution_y = 720, 420
    cam.data.type = "PERSP"
    cam.data.lens = 58
    d = Vector((-1.0, -0.62, 0.42)).normalized()
    cam.location = c + d * size * 1.85
    cam.rotation_euler = (c - cam.location).to_track_quat("-Z", "Y").to_euler()
    s.render.filepath = str(OUT / f"{wid}-card.png")
    bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    for wid in argv or IDS:
        render(wid)
        print("UI", wid)
