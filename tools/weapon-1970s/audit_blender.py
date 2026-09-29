"""Validate native Blender sources and build an editable weapon-sound audition reel.
Blender -b --python tools/weapon-1970s/audit_blender.py
Synthesis recipes remain in make_sounds.py; this project auditions the actual game WAVs.
"""
import bpy, json, math, wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DOC = ROOT / "docs/weapon-1970s-assets"
SRC = ROOT / "assets/source/weapons-1970s"
manifest = json.loads((DOC / "asset-manifest.json").read_text())
report = {}
for wid, meta in manifest.items():
    bpy.ops.wm.open_mainfile(filepath=str(ROOT / meta["source"]))
    collection = bpy.data.collections.get(wid)
    assert collection, wid
    meshes = [o for o in collection.all_objects if o.type == "MESH"]
    assert meshes and bpy.context.scene.camera, wid
    for obj in meshes:
        assert all(math.isfinite(c) for v in obj.data.vertices for c in v.co), obj.name
    for name in meta["animated"]:
        assert name in collection.all_objects, (wid, name)
    missing = [im.filepath for im in bpy.data.images if im.source == 'FILE' and not im.packed_file and not Path(bpy.path.abspath(im.filepath)).exists()]
    assert not missing, (wid, missing)
    report[wid] = {"meshes": len(meshes), "animated": meta["animated"], "missing_textures": missing, "native_source_verified": True}

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
scene.name = "Casino arsenal sound audition"
scene.render.fps = 30
editor = scene.sequence_editor_create()
strips = editor.strips
frame = 1
cue_list = []
for wid in manifest:
    folder = ROOT / "public/audio/weapons" / wid
    if not folder.exists(): continue
    scene.timeline_markers.new(wid.upper(), frame=frame)
    start = frame
    # Every sound is auditionable, including all report variants and reload beats.
    for path in sorted(folder.glob("*.wav")):
        with wave.open(str(path), 'rb') as wav:
            duration = wav.getnframes()/wav.getframerate()
            assert wav.getnchannels()==1 and wav.getsampwidth()==2 and wav.getframerate()==44100
        strip = strips.new_sound(f"{wid} · {path.stem}", str(path), channel=1, frame_start=frame)
        strip.volume = .6
        cue_list.append({"weapon":wid,"sound":path.stem,"frame":frame,"seconds":duration})
        frame += math.ceil(duration*30)+9
    frame += 24
    report[wid]["audition_start_seconds"] = (start-1)/30
scene.frame_end = frame
scene["instructions"] = "Space to audition. Timeline markers separate weapons. Original synthetic foley; see make_sounds.py."
text = bpy.data.texts.new("README — weapon audio")
text.write("Original game samples in an editable Blender sequencer.\nSpace: playback. Markers: weapon chapters.\nEvery source clip is packed; synthesis is reproducible via make_sounds.py.\n")
bpy.ops.file.pack_all()
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            area.type = 'SEQUENCE_EDITOR'
bpy.ops.wm.save_as_mainfile(filepath=str(SRC / "weapon-sound-audition.blend"), compress=True)
(DOC / "blender-source-audit.json").write_text(json.dumps({"blender":bpy.app.version_string,"weapons":report,"audio_cues":cue_list}, indent=2))
print(f"VERIFIED {len(report)} native sources; packed {len(cue_list)} audio cues into Blender.")
